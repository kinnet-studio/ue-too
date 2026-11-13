import { Animation, NumberAnimationHelper } from '@ue-too/animate';
import {
    Board,
    CameraMuxWithAnimationAndLock,
    CameraView,
    ZoomPanPath,
    createZoomPanPath,
    drawRuler,
} from '@ue-too/board';
import { Point } from '@ue-too/math';

import { fitToPage } from '../fit-to-page';
import { followInputMode } from '../input-mode';

const tileImage = new Image();
tileImage.src = new URL('./tile.png', import.meta.url).href;

const canvas = document.getElementById('graph') as HTMLCanvasElement;
// 800 × 600, or smaller to fit a phone or a short window; the board
// follows the canvas's CSS size
fitToPage(canvas, 800, 600, ({ width, height }) => {
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
});
const backButton = document.getElementById(
    'back-to-start'
) as HTMLButtonElement;
const board = new Board(canvas);
followInputMode(mode => board.setInputMode(mode));
const cameraMux = board.cameraMux as CameraMuxWithAnimationAndLock;
const cameraRig = board.getCameraRig();

const FLIGHT_DURATION = 1000;
// A press that moves further than this is a drag, not a click
const CLICK_SLOP = 4;

function currentView(): CameraView {
    return {
        position: { ...board.camera.position },
        zoomLevel: board.camera.zoomLevel,
    };
}

// Where the camera starts, so "Back to start" can fly home
const home = currentView();

// The flight in progress, if any
let path: ZoomPanPath | null = null;

// Progress runs from 0 to 1; each frame maps it to a view on the path and
// hands that view to the camera through the mux
const flight = new Animation(
    [
        { percentage: 0, value: 0 },
        { percentage: 1, value: 1 },
    ],
    (progress: number) => {
        if (path === null) {
            return;
        }
        const view = path.at(progress);
        cameraMux.notifyZoomInputAnimation(view.zoomLevel);
        cameraRig.zoomTo(view.zoomLevel);
        const pan = cameraMux.notifyPanToAnimationInput(view.position);
        if (pan.allowPassThrough) {
            cameraRig.panToWorld(view.position);
        }
    },
    new NumberAnimationHelper(),
    FLIGHT_DURATION
);
// Ease in and out; the path itself moves at a constant perceived speed
flight.easeFunction = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

function flyTo(target: CameraView) {
    path = createZoomPanPath(currentView(), target, board.camera.viewPortWidth);
    // Put the mux's pan and zoom into their animation state; user input
    // moves them out of it again
    cameraMux.initatePanTransition();
    cameraMux.initateZoomTransition();
    flight.start();
}

// The user panned or zoomed during the flight: let them have the camera
function userTookOver(): boolean {
    return (
        cameraMux.panStateMachine.currentState !== 'TRANSITION' ||
        cameraMux.zoomStateMachine.currentState !== 'TRANSITION'
    );
}

function drawDotGrid(ctx: CanvasRenderingContext2D) {
    const zoom = board.camera.zoomLevel;
    const rect = canvas.getBoundingClientRect();
    const topLeft = board.convertWindowPoint2WorldCoord({
        x: rect.left,
        y: rect.top,
    });
    const bottomRight = board.convertWindowPoint2WorldCoord({
        x: rect.right,
        y: rect.bottom,
    });
    const minX = Math.min(topLeft.x, bottomRight.x);
    const maxX = Math.max(topLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, bottomRight.y);
    const maxY = Math.max(topLeft.y, bottomRight.y);
    // Double the spacing while the dots would be closer than 20px on screen
    let spacing = 100;
    while (spacing * zoom < 20) {
        spacing *= 2;
    }
    const size = 3 / zoom;
    ctx.fillStyle = '#c8c8c8';
    ctx.beginPath();
    for (
        let x = Math.floor(minX / spacing) * spacing;
        x <= maxX;
        x += spacing
    ) {
        for (
            let y = Math.floor(minY / spacing) * spacing;
            y <= maxY;
            y += spacing
        ) {
            ctx.rect(x - size / 2, y - size / 2, size, size);
        }
    }
    ctx.fill();
}

function drawStartMarker(ctx: CanvasRenderingContext2D, at: Point) {
    const zoom = board.camera.zoomLevel;
    // Constant size on screen at any zoom
    ctx.strokeStyle = '#e08a2e';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(at.x, at.y, 12 / zoom, 0, Math.PI * 2);
    ctx.moveTo(at.x - 18 / zoom, at.y);
    ctx.lineTo(at.x + 18 / zoom, at.y);
    ctx.moveTo(at.x, at.y - 18 / zoom);
    ctx.lineTo(at.x, at.y + 18 / zoom);
    ctx.stroke();
}

function drawViewportRuler() {
    const halfWidth = board.camera.viewPortWidth / 2;
    const halfHeight = board.camera.viewPortHeight / 2;
    const sign = board.alignCoordinateSystem ? 1 : -1;
    const topLeft = board.camera.convertFromViewPort2WorldSpace({
        x: -halfWidth,
        y: -halfHeight * sign,
    });
    const topRight = board.camera.convertFromViewPort2WorldSpace({
        x: halfWidth,
        y: -halfHeight * sign,
    });
    const bottomLeft = board.camera.convertFromViewPort2WorldSpace({
        x: -halfWidth,
        y: halfHeight * sign,
    });
    drawRuler(
        board.context,
        topLeft,
        topRight,
        bottomLeft,
        board.alignCoordinateSystem,
        board.camera.zoomLevel
    );
}

let lastTimestamp: number | undefined;

function step(timestamp: number) {
    const deltaTime =
        lastTimestamp === undefined ? 0 : timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    if (flight.playing && userTookOver()) {
        flight.stop();
        path = null;
    }
    flight.animate(deltaTime);

    board.step(timestamp);
    const ctx = board.context;
    drawDotGrid(ctx);
    if (tileImage.complete) {
        ctx.drawImage(tileImage, 0, 0);
    }
    drawStartMarker(ctx, home.position);
    drawViewportRuler();
    requestAnimationFrame(step);
}

// Tell a click from the end of a drag (Space + drag also ends in a click)
let pressedAt: Point | null = null;
canvas.addEventListener('pointerdown', e => {
    pressedAt = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener('click', e => {
    const press = pressedAt;
    pressedAt = null;
    if (
        press === null ||
        Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP
    ) {
        return;
    }
    const target = board.convertWindowPoint2WorldCoord({
        x: e.clientX,
        y: e.clientY,
    });
    flyTo({ position: target, zoomLevel: board.camera.zoomLevel });
});

backButton.addEventListener('click', () => {
    flyTo(home);
});

requestAnimationFrame(step);
