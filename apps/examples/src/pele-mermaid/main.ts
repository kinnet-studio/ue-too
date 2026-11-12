import {
    DefaultBoardCamera,
    InputOrchestrator,
    ObservableInputTracker,
    SvgProxy,
    TouchInputTracker,
    VanillaKMTEventParser,
    VanillaTouchEventParser,
    createCameraMuxWithAnimationAndLock,
    createDefaultCameraRig,
    createKmtInputStateMachine,
    createTouchInputStateMachine,
} from '@ue-too/board';

import { DIAGRAM_FONT, DiagramResult, renderDiagram } from './diagram';
import { MAX_ZOOM, MIN_ZOOM, fitView } from './fit';
import { SAMPLE_DIAGRAM } from './sample';

const stage = document.getElementById('stage') as unknown as SVGSVGElement;
const cameraGroup = document.getElementById('camera') as unknown as SVGGElement;
const source = document.getElementById('source') as HTMLTextAreaElement;

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

function step() {
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
