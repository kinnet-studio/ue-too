import {
    CameraView,
    DefaultBoardCamera,
    InputOrchestrator,
    ObservableInputTracker,
    SvgProxy,
    TouchInputTracker,
    VanillaKMTEventParser,
    ZoomPanPath,
    createCameraMuxWithAnimationAndLock,
    createDefaultCameraRig,
    createKmtInputStateMachine,
    createOneFingerPanTouchInputStateMachine,
    createZoomPanPath,
} from '@ue-too/board';

import { followInputMode } from '../input-mode';
import { DIAGRAM_FONT, DiagramResult, renderDiagram } from './diagram';
import { MAX_ZOOM, MIN_ZOOM, fitView } from './fit';
import { enableLinkTaps } from './link-taps';
import { SAMPLE_DIAGRAM } from './sample';
import { StageTouchEventParser } from './stage-touch-parser';

const stage = document.getElementById('stage') as unknown as SVGSVGElement;
const cameraGroup = document.getElementById('camera') as unknown as SVGGElement;
const source = document.getElementById('source') as HTMLTextAreaElement;
const errorLine = document.getElementById('error') as HTMLPreElement;
const fitButton = document.getElementById('fit') as HTMLButtonElement;

// Wait this long after the last keystroke before re-rendering
const RENDER_DEBOUNCE_MS = 250;
const FLIGHT_MS = 1000;

// Pele measures labels with this stack; draw them with the same one
stage.style.setProperty('--pele-font', DIAGRAM_FONT);

const stageSize = stage.getBoundingClientRect();
const camera = new DefaultBoardCamera({
    viewPortWidth: stageSize.width,
    viewPortHeight: stageSize.height,
});
camera.setMinZoomLevel(MIN_ZOOM);
camera.setMaxZoomLevel(MAX_ZOOM);
const cameraRig = createDefaultCameraRig(camera);
const cameraMux = createCameraMuxWithAnimationAndLock();

// The proxy tracks the <svg>'s size and position for the input trackers;
// keep the camera's viewport in step with it
const proxy = new SvgProxy(stage);
proxy.subscribe(({ width, height }) => {
    camera.viewPortWidth = width;
    camera.viewPortHeight = height;
});

// Mouse, keyboard, trackpad and touch all drive the same camera
const orchestrator = new InputOrchestrator(cameraMux, cameraRig);
const kmtInputTracker = new ObservableInputTracker(proxy);
followInputMode(mode => kmtInputTracker.setMode(mode));
const kmtParser = new VanillaKMTEventParser(
    createKmtInputStateMachine(kmtInputTracker),
    orchestrator,
    stage
);
kmtParser.setUp();
const touchParser = new StageTouchEventParser(
    // One finger pans; two fingers pinch-zoom while their midpoint pans
    createOneFingerPanTouchInputStateMachine(new TouchInputTracker(proxy)),
    orchestrator,
    stage
);
touchParser.setUp();
// The touch parser cancels touchstart, which also cancels taps on links
enableLinkTaps(stage);

// The board only reads keys aimed at <body>. If the editor (or any other
// control) has focus and the user points at the diagram and presses Space,
// they mean "pan", not "type a space": hand the key to the board. Requiring
// the pointer to have moved since the last key leaves typing alone when the
// mouse is merely parked over the diagram.
let pointerOverStage = false;
let pointerMovedSinceKey = false;
stage.addEventListener('pointerenter', () => {
    pointerOverStage = true;
});
stage.addEventListener('pointerleave', () => {
    pointerOverStage = false;
});
window.addEventListener('pointermove', () => {
    pointerMovedSinceKey = true;
});
window.addEventListener(
    'keydown',
    e => {
        const focused = document.activeElement;
        const handOff =
            e.key === ' ' &&
            pointerOverStage &&
            pointerMovedSinceKey &&
            focused instanceof HTMLElement &&
            focused !== document.body;
        pointerMovedSinceKey = false;
        if (!handOff) {
            return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        focused.blur();
        document.body.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: ' ',
                code: 'Space',
                bubbles: true,
            })
        );
    },
    { capture: true }
);

// Panning drags a linked node along under the cursor, so the press and the
// release land on the same link and the browser would follow it. Swallow
// the click (and middle-button auxclick) that ends a drag.
const DRAG_SLOP_PX = 4;
let pressedAt: { x: number; y: number } | undefined;
let dragged = false;
stage.addEventListener(
    'pointerdown',
    e => {
        // Touch produces no native click here (the touch parser cancels
        // touchstart); link taps are handled by enableLinkTaps instead
        if (e.pointerType === 'touch') {
            pressedAt = undefined;
            dragged = false;
            return;
        }
        pressedAt = { x: e.clientX, y: e.clientY };
        dragged = false;
    },
    { capture: true }
);
window.addEventListener('pointermove', e => {
    if (
        pressedAt !== undefined &&
        Math.hypot(e.clientX - pressedAt.x, e.clientY - pressedAt.y) >
            DRAG_SLOP_PX
    ) {
        dragged = true;
    }
});
function endPress(): void {
    pressedAt = undefined;
    // The click that ends this press is dispatched in the same task; clear
    // the flag after it so later clicks (e.g. Enter on a link) still work
    if (dragged) {
        setTimeout(() => {
            dragged = false;
        }, 0);
    }
}
window.addEventListener('pointerup', endPress, { capture: true });
window.addEventListener('pointercancel', endPress, { capture: true });
function swallowClickAfterDrag(e: MouseEvent): void {
    if (dragged) {
        e.preventDefault();
        e.stopPropagation();
    }
}
stage.addEventListener('click', swallowClickAfterDrag, { capture: true });
stage.addEventListener('auxclick', swallowClickAfterDrag, { capture: true });

// Size of the diagram on screen now; its top-left corner is world (0, 0)
let current = { width: 0, height: 0 };

function showDiagram(result: Extract<DiagramResult, { ok: true }>): void {
    cameraGroup.replaceChildren(result.element);
    current = { width: result.width, height: result.height };
}

// Re-render as the user types. A failed render keeps the last good diagram
// on screen; nothing here touches the camera
let pendingRender: ReturnType<typeof setTimeout> | undefined;
source.addEventListener('input', () => {
    clearTimeout(pendingRender);
    pendingRender = setTimeout(() => {
        const result = renderDiagram(source.value);
        if (result.ok) {
            showDiagram(result);
            errorLine.textContent = '';
        } else {
            errorLine.textContent = result.message;
        }
    }, RENDER_DEBOUNCE_MS);
});

// The camera flight in progress, if any; `start` is set on its first frame
let flight: { path: ZoomPanPath; start: number | undefined } | undefined;

function currentView(): CameraView {
    return {
        position: { ...camera.position },
        zoomLevel: camera.zoomLevel,
    };
}

// Fly the camera to `target` along a zoom-and-pan path. Pan or zoom input
// moves the mux out of its transition states, which ends the flight
function flyTo(target: CameraView): void {
    flight = {
        path: createZoomPanPath(currentView(), target, camera.viewPortWidth),
        start: undefined,
    };
    cameraMux.initatePanTransition();
    cameraMux.initateZoomTransition();
}

function advanceFlight(now: number): void {
    if (flight === undefined) {
        return;
    }
    if (
        cameraMux.panStateMachine.currentState !== 'TRANSITION' ||
        cameraMux.zoomStateMachine.currentState !== 'TRANSITION'
    ) {
        // The user took over the camera
        flight = undefined;
        return;
    }
    flight.start ??= now;
    const t = Math.min(1, (now - flight.start) / FLIGHT_MS);
    const view = flight.path.at((1 - Math.cos(Math.PI * t)) / 2);
    cameraMux.notifyZoomInputAnimation(view.zoomLevel);
    cameraRig.zoomTo(view.zoomLevel);
    if (cameraMux.notifyPanToAnimationInput(view.position).allowPassThrough) {
        cameraRig.panToWorld(view.position);
    }
    if (t === 1) {
        flight = undefined;
    }
}

fitButton.addEventListener('click', () => {
    flyTo(
        fitView(current, {
            width: camera.viewPortWidth,
            height: camera.viewPortHeight,
        })
    );
});

function step(now: number) {
    advanceFlight(now);
    const { a, b, c, d, e, f } = camera.getTransform(1, true);
    cameraGroup.setAttribute(
        'transform',
        `matrix(${a} ${b} ${c} ${d} ${e} ${f})`
    );
    requestAnimationFrame(step);
}

source.value = SAMPLE_DIAGRAM;
const first = renderDiagram(SAMPLE_DIAGRAM);
if (first.ok) {
    showDiagram(first);
    const start = fitView(current, {
        width: camera.viewPortWidth,
        height: camera.viewPortHeight,
    });
    camera.setZoomLevel(start.zoomLevel);
    camera.setPosition(start.position);
}

requestAnimationFrame(step);
