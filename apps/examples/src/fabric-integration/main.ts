import {
    CanvasProxy,
    DefaultBoardCamera,
    EdgeAutoCameraInput,
    InputOrchestrator,
    ObservableInputTracker,
    RawUserInputPublisher,
    VanillaKMTEventParser,
    createCameraMuxWithAnimationAndLock,
    createDefaultCameraRig,
    createKmtInputStateMachine,
} from '@ue-too/board';
import { FabricInputEventParser } from '@ue-too/board-fabric-integration';
import { Canvas, FabricText, Rect, TMat2D } from 'fabric';

import { fitToPage } from '../fit-to-page';
import { followInputMode } from '../input-mode';

const canvas = document.getElementById('graph') as HTMLCanvasElement;
const fabricCanvas = new Canvas('graph', { selection: false });
const helloWorld = new FabricText('Hello world!', {
    left: 0,
    top: 0,
});
fabricCanvas.add(helloWorld);

const rectangle = new Rect({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    originX: 'left',
    originY: 'top',
    fill: 'transparent',
    stroke: 'black',
    strokeWidth: 2,
});
fabricCanvas.add(rectangle);

const camera = new DefaultBoardCamera({
    position: { x: 0, y: 0 },
    rotation: 0,
    zoomLevel: 2,
});

// 800 × 600, or narrower on a phone
fitToPage(800, 600, size => {
    fabricCanvas.setDimensions(size);
    camera.viewPortWidth = size.width;
    camera.viewPortHeight = size.height;
});
const canvasProxy = new CanvasProxy(canvas);
const cameraRig = createDefaultCameraRig(camera);
const inputOrchestrator = new InputOrchestrator(
    createCameraMuxWithAnimationAndLock(),
    cameraRig,
    new RawUserInputPublisher()
);
const observableInputTracker = new ObservableInputTracker(canvasProxy);
followInputMode(mode => observableInputTracker.setMode(mode));
const kmtInputStateMachine = createKmtInputStateMachine(observableInputTracker);
const kmtParser = new VanillaKMTEventParser(
    kmtInputStateMachine,
    inputOrchestrator,
    canvas
);
// kmtParser.setUp();

fabricCanvas.on('mouse:wheel', event => {
    console.log('mouse:down', event);
});

const fabricInputEventParser = new FabricInputEventParser(
    fabricCanvas,
    kmtInputStateMachine,
    inputOrchestrator
);
fabricInputEventParser.setUp();
function step() {
    const transform = camera.getTransform(1, true);
    const matrix: TMat2D = [
        transform.a,
        transform.b,
        transform.c,
        transform.d,
        transform.e,
        transform.f,
    ];
    // const matrix: TMat2D = [1, 0, 0, 1, 0, 0];
    fabricCanvas.setViewportTransform(matrix);
    requestAnimationFrame(step);
}
console.log(fabricCanvas.getObjects());

requestAnimationFrame(step);

const buttonToggleMovementMode = document.getElementById(
    'button-toggle-movement-mode'
) as HTMLButtonElement;

buttonToggleMovementMode.addEventListener('click', () => {
    if (fabricInputEventParser.disabled) {
        fabricInputEventParser.enable();
        fabricCanvas.selection = false;
        buttonToggleMovementMode.textContent = 'Disable Movement Mode';
    } else {
        fabricInputEventParser.disable();
        fabricCanvas.selection = true;
        buttonToggleMovementMode.textContent = 'Enable Movement Mode';
    }
});
