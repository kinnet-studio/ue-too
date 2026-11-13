import { Board } from '@ue-too/board';
import {
    RigidBody,
    VisaulCircleBody,
    VisualPolygonBody,
    World,
} from '@ue-too/dynamics';
import { FixedPinJoint, PinJoint } from '@ue-too/dynamics';

import { followInputMode } from '../input-mode';

const world = new World(1000, 1000);
world.resolveCollision = false;
const bodies: RigidBody[] = [];
const randomPoint = randomPointGenerator(
    { x: -500, y: -500 },
    { x: 500, y: 500 }
);

const canvas = document.getElementById('graph') as HTMLCanvasElement;
const board = new Board(canvas);
followInputMode(mode => board.setInputMode(mode));

const forceMap = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    KeyQ: false,
    KeyE: false,
};

const abLength = 200;
const linkageLength = 150;
const acLinkInitialOrientation =
    (90 * Math.PI) / 180 - Math.acos(abLength / 4 / linkageLength);
const bdLinkInitialOrientation =
    (180 * Math.PI) / 180 - Math.acos(abLength / 4 / linkageLength);
const cTriangleLinkInitialCenter = {
    x: abLength / 4,
    y:
        -linkageLength *
        Math.sin((90 * Math.PI) / 180 - acLinkInitialOrientation),
};
const acLink = new VisualPolygonBody(
    { x: 0, y: 0 },
    [
        { x: 0.5, y: 0 },
        { x: 0.5, y: -linkageLength },
        { x: -0.5, y: -linkageLength },
        { x: -0.5, y: 0 },
    ],
    board.context,
    acLinkInitialOrientation,
    100
);
const bdLink = new VisualPolygonBody(
    { x: abLength, y: 0 },
    [
        { x: 0.5, y: 0 },
        { x: 0.5, y: -linkageLength },
        { x: -0.5, y: -linkageLength },
        { x: -0.5, y: 0 },
    ],
    board.context,
    -acLinkInitialOrientation,
    100
);
const cTriangleLink = new VisualPolygonBody(
    cTriangleLinkInitialCenter,
    [
        { x: 0, y: 0 },
        { x: abLength / 2, y: 0 },
        {
            x: abLength / 4,
            y:
                linkageLength *
                Math.sin((90 * Math.PI) / 180 - acLinkInitialOrientation),
        },
    ],
    board.context,
    0,
    100
);
const acFixedPin = new FixedPinJoint(acLink, acLink.center, { x: 0, y: 0 });
const bdFixedPin = new FixedPinJoint(
    bdLink,
    { x: 0, y: 0 },
    { x: abLength, y: 0 }
);
const bcPin = new PinJoint(
    cTriangleLink,
    acLink,
    { x: 0, y: 0 },
    { x: 0, y: -linkageLength }
);
const cdPin = new PinJoint(
    cTriangleLink,
    bdLink,
    { x: abLength / 2, y: 0 },
    { x: 0, y: -linkageLength }
);

world.addRigidBody(`acLink`, acLink);
world.addRigidBody(`bdLink`, bdLink);
world.addRigidBody(`cTriangleLink`, cTriangleLink);
world.addConstraint(acFixedPin);
world.addConstraint(bdFixedPin);
world.addConstraint(bcPin);
world.addConstraint(cdPin);

board.fullScreen = true;
board.camera.setPosition({ x: abLength / 2, y: 0 });
board.camera.setZoomLevel(2);

board.alignCoordinateSystem = false;
let lastTime = 0;
world._context = board.context;
function step(timestamp: number) {
    // console.time("step");
    const deltaTime = timestamp - lastTime;
    board.step(deltaTime);
    appleForce();
    board.context.lineWidth = 1 / board.camera.zoomLevel;
    world.step(0.016);
    lastTime = timestamp;
    // console.timeEnd("step");
    requestAnimationFrame(step);
}
step(0);

function visibilityChange() {
    if (!document.hidden) {
        lastTime = performance.now();
    }
}

window.addEventListener('visibilitychange', visibilityChange);

function randomPointGenerator(
    min: { x: number; y: number },
    max: { x: number; y: number }
): () => { x: number; y: number } {
    return function () {
        return {
            x: Math.random() * (max.x - min.x) + min.x,
            y: Math.random() * (max.y - min.y) + min.y,
        };
    };
}

function appleForce() {
    if (forceMap['ArrowUp']) {
        acLink.applyForceInOrientation({ x: 0, y: -3000 });
    }
    if (forceMap['ArrowDown']) {
        acLink.applyForceInOrientation({ x: 0, y: 3000 });
    }
    if (forceMap['ArrowLeft']) {
        acLink.applyForceInOrientation({ x: -3000, y: 0 });
    }
    if (forceMap['ArrowRight']) {
        acLink.applyForceInOrientation({ x: 3000, y: 0 });
    }
    if (forceMap['KeyQ']) {
        acLink.angularVelocity = 0.1;
    }
    if (forceMap['KeyE']) {
        acLink.angularVelocity = -0.1;
    }
}

function keydownHandler(e: KeyboardEvent) {
    if (e.key === 'ArrowUp') {
        forceMap['ArrowUp'] = true;
    }
    if (e.key === 'ArrowDown') {
        forceMap['ArrowDown'] = true;
    }
    if (e.key === 'ArrowLeft') {
        forceMap['ArrowLeft'] = true;
    }
    if (e.key === 'ArrowRight') {
        forceMap['ArrowRight'] = true;
    }
    if (e.code === 'KeyQ') {
        forceMap['KeyQ'] = true;
    }
    if (e.code === 'KeyE') {
        forceMap['KeyE'] = true;
    }
}

function keyupHandler(e: KeyboardEvent) {
    if (e.key === 'ArrowUp') {
        forceMap['ArrowUp'] = false;
    }
    if (e.key === 'ArrowDown') {
        forceMap['ArrowDown'] = false;
    }
    if (e.key === 'ArrowLeft') {
        forceMap['ArrowLeft'] = false;
    }
    if (e.key === 'ArrowRight') {
        forceMap['ArrowRight'] = false;
    }
    if (e.code === 'KeyQ') {
        forceMap['KeyQ'] = false;
    }
    if (e.code === 'KeyE') {
        forceMap['KeyE'] = false;
    }
}

window.addEventListener('keydown', keydownHandler);
window.addEventListener('keyup', keyupHandler);
