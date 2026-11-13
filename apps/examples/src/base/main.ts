import { Board } from '@ue-too/board';

import { followInputMode } from '../input-mode';

const canvas = document.getElementById('graph') as HTMLCanvasElement;
const board = new Board();
followInputMode(mode => board.setInputMode(mode));

board.alignCoordinateSystem = false;
board.attach(canvas);

function drawGrid(ctx: CanvasRenderingContext2D, spacing: number, extent: number) {
    ctx.save();
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    for (let x = -extent; x <= extent; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, -extent);
        ctx.lineTo(x, extent);
        ctx.stroke();
    }
    for (let y = -extent; y <= extent; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(-extent, y);
        ctx.lineTo(extent, y);
        ctx.stroke();
    }
    ctx.restore();
}

function drawOriginAxes(ctx: CanvasRenderingContext2D, length: number) {
    ctx.save();
    ctx.lineWidth = 2;
    // X axis (red)
    ctx.strokeStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, 0);
    ctx.stroke();
    // Y axis (green)
    ctx.strokeStyle = '#2ecc71';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, length);
    ctx.stroke();
    ctx.restore();
}

const shapes = [
    { x: 0, y: 0, w: 80, h: 80, color: '#3498db' },
    { x: 150, y: -50, w: 60, h: 60, color: '#e74c3c' },
    { x: -120, y: 80, w: 70, h: 40, color: '#2ecc71' },
    { x: 200, y: 100, w: 50, h: 90, color: '#f39c12' },
];

function step() {
    board.step(performance.now());
    if (board.context != undefined) {
        const ctx = board.context;
        drawGrid(ctx, 50, 500);
        drawOriginAxes(ctx, 100);

        for (const s of shapes) {
            ctx.save();
            ctx.fillStyle = s.color;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.rect(s.x, s.y, s.w, s.h);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = s.color;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }
    }
    requestAnimationFrame(step);
}

requestAnimationFrame(step);

canvas.addEventListener('click', event => {
    const point = { x: event.clientX, y: event.clientY };
    const pointInViewPort = board.convertWindowPoint2WorldCoord(point);
    console.log(pointInViewPort);
});
