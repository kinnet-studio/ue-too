import {
    DefaultBoardCamera,
    InputOrchestrator,
    ObservableInputTracker,
    SvgPositionDimensionPublisher,
    SvgProxy,
    VanillaKMTEventParser,
    createCameraMuxWithAnimationAndLock,
    createDefaultCameraRig,
    createKmtInputStateMachine,
} from '@ue-too/board';
import { PointCal } from '@ue-too/math';

import { fitToPage } from '../fit-to-page';
import { followInputMode } from '../input-mode';

const svg = document.querySelector('#graph') as SVGSVGElement;

const camera = new DefaultBoardCamera();

// 800 × 600, or narrower on a phone; one SVG unit stays one CSS pixel
fitToPage(800, 600, ({ width, height }) => {
    svg.setAttribute('width', width.toString());
    svg.setAttribute('height', height.toString());
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    camera.viewPortWidth = width;
    camera.viewPortHeight = height;
});
const cameraRig = createDefaultCameraRig(camera);
const cameraMux = createCameraMuxWithAnimationAndLock();

const observableInputTracker = new ObservableInputTracker(new SvgProxy(svg));
followInputMode(mode => observableInputTracker.setMode(mode));

const kmtInputStateMachine = createKmtInputStateMachine(observableInputTracker);

const svgPositionDimensionPublisher = new SvgPositionDimensionPublisher(svg);

const inputOrchestrator = new InputOrchestrator(cameraMux, cameraRig);

const kmtParser = new VanillaKMTEventParser(
    kmtInputStateMachine,
    inputOrchestrator,
    svg
);

kmtParser.setUp();

let svgPos = { x: 0, y: 0, width: 0, height: 0 };

svgPositionDimensionPublisher.onPositionUpdate(rect => {
    svgPos = rect;
});

const cameraGroup = document.querySelector('#camera') as SVGGElement;

function step(timestamp: number) {
    const { scale, rotation, translation } = camera.getTRS(1, true);
    cameraGroup.setAttribute(
        'transform',
        `translate(${translation.x}, ${translation.y}) scale(${scale.x}, ${scale.y}) rotate(${(rotation * 180) / Math.PI})`
    );
    requestAnimationFrame(step);
}

// Camera controls
const inputX = document.querySelector('#input-x') as HTMLInputElement;
const inputY = document.querySelector('#input-y') as HTMLInputElement;
const inputRotation = document.querySelector(
    '#input-rotation'
) as HTMLInputElement;
const inputZoom = document.querySelector('#input-zoom') as HTMLInputElement;
const applyButton = document.querySelector(
    '#apply-camera'
) as HTMLButtonElement;

applyButton.addEventListener('click', () => {
    const x = parseFloat(inputX.value) || 0;
    const y = parseFloat(inputY.value) || 0;
    const rotationDeg = parseFloat(inputRotation.value) || 0;
    const zoom = parseFloat(inputZoom.value) || 1;

    camera.setPosition({ x, y });
    camera.setRotation((rotationDeg * Math.PI) / 180);
    camera.setZoomLevel(zoom);
});

svg.addEventListener('pointerdown', e => {
    const viewportPosition = PointCal.subVector(
        { x: e.clientX, y: e.clientY },
        { x: svgPos.x + svgPos.width / 2, y: svgPos.y + svgPos.height / 2 }
    );
    console.log('svg position', svgPos);
    console.log('viewportPosition', viewportPosition);
    const worldPosition =
        camera.convertFromViewPort2WorldSpace(viewportPosition);
    console.log('worldPosition', worldPosition);
});

requestAnimationFrame(step);
