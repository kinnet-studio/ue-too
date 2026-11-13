import { Board } from '@ue-too/board';

import { followInputMode } from '../input-mode';

const canvas = document.getElementById('graph') as HTMLCanvasElement;
const board = new Board();
followInputMode(mode => board.setInputMode(mode));

board.alignCoordinateSystem = false;

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

function step() {
    board.step(performance.now());
    if (board.context != undefined) {
        const ctx = board.context;
        drawGrid(ctx, 50, 500);

        // Draw a pulsing circle at origin to show the board is alive
        const pulse = Math.sin(performance.now() / 500) * 0.3 + 0.7;
        ctx.save();
        ctx.fillStyle = `rgba(52, 152, 219, ${pulse})`;
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.fillStyle = '#333';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Board attached', 0, 70);
        ctx.restore();
    }
    requestAnimationFrame(step);
}

requestAnimationFrame(step);

canvas.addEventListener('click', event => {
    const point = { x: event.clientX, y: event.clientY };
    const pointInViewPort = board.convertWindowPoint2WorldCoord(point);
    console.log(pointInViewPort);
});

const attachButton = document.querySelector(
    '#attach-canvas'
) as HTMLButtonElement;
attachButton.addEventListener('click', () => {
    board.attach(canvas);
});

const detachButton = document.querySelector(
    '#detach-canvas'
) as HTMLButtonElement;
detachButton.addEventListener('click', () => {
    board.tearDown();
});
