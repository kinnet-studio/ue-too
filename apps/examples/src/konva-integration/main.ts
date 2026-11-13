import {
    DefaultBoardCamera,
    EdgeAutoCameraInput,
    InputOrchestrator,
    createDefaultCameraRig,
} from '@ue-too/board';
import { createCameraMuxWithAnimationAndLock } from '@ue-too/board';
import { CanvasProxy, ObservableInputTracker } from '@ue-too/board';
import { createKmtInputStateMachine } from '@ue-too/board';
import { VanillaKMTEventParser } from '@ue-too/board';
import { RawUserInputPublisher } from '@ue-too/board';
import { KonvaInputParser } from '@ue-too/board-konva-integration';
import Konva from 'konva';

import { followInputMode } from '../input-mode';

const canvas = document.getElementById('graph') as HTMLCanvasElement;
const camera = new DefaultBoardCamera({
    viewPortWidth: 800,
    viewPortHeight: 600,
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

// first we need to create a stage
const stage = new Konva.Stage({
    container: 'graph', // id of container <div>
    width: 800,
    height: 600,
});

const konvaInputParser = new KonvaInputParser(
    stage,
    kmtInputStateMachine,
    inputOrchestrator
);
konvaInputParser.setUp();

function update() {
    const { scale, rotation, translation } = camera.getTRS(1, true);
    stage.x(translation.x);
    stage.y(translation.y);
    stage.scale({ x: scale.x, y: scale.y });
    stage.rotation(rotation);
    requestAnimationFrame(update);
}

requestAnimationFrame(update);

// then create layer
const layer = new Konva.Layer();

// create our shape
const circle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: 100,
    fill: 'red',
    stroke: 'black',
    strokeWidth: 4,
});

// add the shape to the layer
layer.add(circle);

// add the layer to the stage
stage.add(layer);
