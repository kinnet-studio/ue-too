import {
    CameraView,
    DefaultBoardCamera,
    InputOrchestrator,
    ObservableInputTracker,
    SvgProxy,
    TouchInputTracker,
    VanillaKMTEventParser,
    VanillaTouchEventParser,
    ZoomPanPath,
    createCameraMuxWithAnimationAndLock,
    createDefaultCameraRig,
    createKmtInputStateMachine,
    createTouchInputStateMachine,
    createZoomPanPath,
} from '@ue-too/board';

import { DIAGRAM_FONT, DiagramResult, renderDiagram } from './diagram';
import { MAX_ZOOM, MIN_ZOOM, fitView } from './fit';
import { SAMPLE_DIAGRAM } from './sample';

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
const kmtParser = new VanillaKMTEventParser(
    createKmtInputStateMachine(new ObservableInputTracker(proxy)),
    orchestrator,
    stage
);
kmtParser.setUp();
const touchParser = new VanillaTouchEventParser(
    createTouchInputStateMachine(new TouchInputTracker(proxy)),
    orchestrator,
    stage
);
touchParser.setUp();

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
