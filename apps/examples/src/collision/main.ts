import {
    Board,
    CameraPanEventPayload,
    CameraState,
    CameraZoomEventPayload,
} from '@ue-too/board';
import {
    Canvas2DContextRenderSystem,
    CollisionSystem,
    INPUT_COMPONENT,
    InputComponent,
    PHYSICS_COMPONENT,
    PhysicsComponent,
    PhysicsSystem,
    Polygon,
    RENDER_COMPONENT,
    RIGID_BODY_COMPONENT,
    RenderComponent,
    RigidBodyComponent,
    VisaulCircleBody,
    VisualPolygonBody,
    World,
    updateAABBForPolygonRaw,
} from '@ue-too/dynamics';
import { Coordinator } from '@ue-too/ecs';
import { Point, PointCal } from '@ue-too/math';

import { followInputMode } from '../input-mode';
import { InputSystem } from './input-system';

// FPS tracking variables
let frameCount = 0;
let lastTime = performance.now();
let fpsElement: HTMLElement;

let element = document.getElementById('graph') as HTMLCanvasElement;
let board = new Board(element);
followInputMode(mode => board.setInputMode(mode));
board.camera.boundaries = {
    min: { x: -5000, y: -5000 },
    max: { x: 5000, y: 5000 },
};
const coordinator = new Coordinator();
const physicsSystem = new PhysicsSystem(coordinator);
const collisionSystem = new CollisionSystem(coordinator);
const renderSystem = new Canvas2DContextRenderSystem(
    coordinator,
    board.context
);
const inputSystem = new InputSystem(coordinator);

const entity = coordinator.createEntity();
const vertices = [
    { x: 20, y: 10 },
    { x: -20, y: 10 },
    { x: -20, y: -10 },
    { x: 20, y: -10 },
];
// const center = getRandomPoint(0, 300);
const center = { x: 310, y: 0 };
const aabb = updateAABBForPolygonRaw(vertices, center, 0);

coordinator.addComponentToEntity<RigidBodyComponent>(
    RIGID_BODY_COMPONENT,
    entity,
    {
        center: center,
        orientationAngle: 0,
        mass: 300,
        AABB: aabb,
        staticFrictionCoeff: 0.3,
        dynamicFrictionCoeff: 0.3,
        momentOfInertia: 1,
        isStatic: false,
        isMovingStatic: false,
        shapeType: 'polygon',
        vertices: [
            { x: 20, y: 10 },
            { x: -20, y: 10 },
            { x: -20, y: -10 },
            { x: 20, y: -10 },
        ],
    }
);

coordinator.addComponentToEntity<RenderComponent>(RENDER_COMPONENT, entity, {
    show: true,
});

coordinator.addComponentToEntity<PhysicsComponent>(PHYSICS_COMPONENT, entity, {
    force: { x: 0, y: 0 },
    angularDampingFactor: 0.005,
    linearAcceleration: { x: 0, y: 0 },
    angularAcceleration: 0,
    linearVelocity: { x: 0, y: 0 },
    angularVelocity: 0,
});

for (let i = 0; i < 1; i++) {
    const entity = coordinator.createEntity();
    const vertices = [
        { x: 20, y: 10 },
        { x: -20, y: 10 },
        { x: -20, y: -10 },
        { x: 20, y: -10 },
    ];
    const center = getRandomPoint(-5000, 5000);
    // const center = {x: 300, y: 0};
    const aabb = updateAABBForPolygonRaw(vertices, center, 0);
    coordinator.addComponentToEntity<RigidBodyComponent>(
        RIGID_BODY_COMPONENT,
        entity,
        {
            center: center,
            orientationAngle: 0,
            mass: 1,
            AABB: aabb,
            staticFrictionCoeff: 0.3,
            dynamicFrictionCoeff: 0.3,
            momentOfInertia: 1,
            isStatic: false,
            isMovingStatic: false,
            shapeType: 'polygon',
            vertices: [
                { x: 20, y: 10 },
                { x: -20, y: 10 },
                { x: -20, y: -10 },
                { x: 20, y: -10 },
            ],
        }
    );
    coordinator.addComponentToEntity<PhysicsComponent>(
        PHYSICS_COMPONENT,
        entity,
        {
            force: { x: 0, y: 0 },
            angularDampingFactor: 0.005,
            linearAcceleration: { x: 0, y: 0 },
            angularAcceleration: 0,
            linearVelocity: { x: 0, y: 0 },
            angularVelocity: 0,
        }
    );
    coordinator.addComponentToEntity<RenderComponent>(
        RENDER_COMPONENT,
        entity,
        {
            show: true,
        }
    );
}

board.fullScreen = true;
let keyController: Map<string, boolean>;
keyController = new Map<string, boolean>();

keyController.set('KeyA', false);
keyController.set('KeyW', false);
keyController.set('KeyS', false);
keyController.set('KeyD', false);
keyController.set('KeyQ', false);
keyController.set('KeyE', false);

window.addEventListener('keypress', e => {
    if (keyController.has(e.code)) {
        keyController.set(e.code, true);
    }
});

window.addEventListener('keyup', e => {
    if (keyController.has(e.code)) {
        keyController.set(e.code, false);
    }
});

const context = board.context;
let world = new World(10000, 10000, 'dynamictree');
world._context = context;
for (let index = 0; index < 1000; index++) {
    if (index == 0) {
        let vertices = [
            { x: 20, y: 10 },
            { x: -20, y: 10 },
            { x: -20, y: -10 },
            { x: 20, y: -10 },
        ];
        // let body = new VisaulCircleBody(getRandomPoint(0, 100), 5, context, 0, 200);
        let initialCenter = getRandomPoint(-300, 300);
        initialCenter.z = 100;
        let body = new VisaulCircleBody(initialCenter, 5, context, 0, 300);
        world.addRigidBody(index.toString(), body);
    } else {
        // let body = new VisaulCircleBody(getRandomPoint(0, 100), 5, context, 0, 50);
        let body = new VisaulCircleBody(
            getRandomPoint(-5000, 5000),
            5,
            context,
            0,
            50
        );
        world.addRigidBody(index.toString(), body);
    }
}
const initCameraPos = world.getRigidBodyList()[0].center;
// element.getCamera().setPositionWithClamp(initCameraPos);
function step(timestamp: number) {
    // FPS calculation
    frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime;

    // Update FPS display every 10 frames (approximately every 160ms at 60fps)
    if (frameCount % 10 === 0) {
        const fps = Math.round(1000 / (deltaTime / 10));
        if (fpsElement) {
            fpsElement.textContent = fps.toString();
        }
        lastTime = currentTime;
    }

    board.step(timestamp);
    // console.log(world.getRigidBodyList()[0].center);
    let rigidBodies = world.getRigidBodyList();
    const physicsComponent =
        coordinator.getComponentFromEntity<PhysicsComponent>(
            PHYSICS_COMPONENT,
            entity
        );
    const rigidBodyComponent =
        coordinator.getComponentFromEntity<RigidBodyComponent>(
            RIGID_BODY_COMPONENT,
            entity
        );
    if (keyController.get('KeyW')) {
        const force = { x: 3000, y: 0 };
        const forceTransformed = PointCal.rotatePoint(
            force,
            rigidBodyComponent.orientationAngle
        );
        physicsComponent.force = PointCal.addVector(
            physicsComponent.force,
            forceTransformed
        );
        rigidBodies[0].applyForceInOrientation({ x: 3000, y: 0 });
    }
    if (keyController.get('KeyA')) {
        const force = { x: 0, y: 3000 };
        const forceTransformed = PointCal.rotatePoint(
            force,
            rigidBodyComponent.orientationAngle
        );
        physicsComponent.force = PointCal.addVector(
            physicsComponent.force,
            forceTransformed
        );
        rigidBodies[0].applyForceInOrientation({ x: 0, y: 3000 });
    }
    if (keyController.get('KeyS')) {
        const force = { x: -3000, y: 0 };
        const forceTransformed = PointCal.rotatePoint(
            force,
            rigidBodyComponent.orientationAngle
        );
        physicsComponent.force = PointCal.addVector(
            physicsComponent.force,
            forceTransformed
        );
        rigidBodies[0].applyForceInOrientation({ x: -3000, y: 0 });
    }
    if (keyController.get('KeyD')) {
        const force = { x: 0, y: -3000 };
        const forceTransformed = PointCal.rotatePoint(
            force,
            rigidBodyComponent.orientationAngle
        );
        physicsComponent.force = PointCal.addVector(
            physicsComponent.force,
            forceTransformed
        );
        rigidBodies[0].applyForceInOrientation({ x: 0, y: -3000 });
    }
    if (keyController.get('KeyQ')) {
        const physicsComponent =
            coordinator.getComponentFromEntity<PhysicsComponent>(
                PHYSICS_COMPONENT,
                entity
            );
        physicsComponent.angularVelocity = 0.5;
        rigidBodies[0].angularVelocity = 0.5;
    }
    if (keyController.get('KeyE')) {
        const physicsComponent =
            coordinator.getComponentFromEntity<PhysicsComponent>(
                PHYSICS_COMPONENT,
                entity
            );
        physicsComponent.angularVelocity = -0.5;
        rigidBodies[0].angularVelocity = -0.5;
    }
    world.step(0.016);
    renderSystem.update(0.016);
    collisionSystem.update(0.016);
    physicsSystem.update(0.016);
    window.requestAnimationFrame(step);
}

// Initialize FPS element
fpsElement = document.getElementById('fps-value') as HTMLElement;

step(0);

function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandom(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

function getRandomPoint(min: number, max: number): Point {
    return { x: getRandom(min, max), y: getRandom(min, max) };
}

// let worker = new Worker("./physicsWorker.js");
