import { Board } from '@ue-too/board';

import { followInputMode } from '../input-mode';

const canvas = document.getElementById('graph') as HTMLCanvasElement;
const board = new Board(canvas);
followInputMode(mode => board.setInputMode(mode));

function drawGrid(ctx: CanvasRenderingContext2D, spacing: number, extent: number) {
    ctx.save();
    ctx.strokeStyle = '#e8e8e8';
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

// Scattered landmarks to navigate to
const landmarks = [
    { x: 0, y: 0, r: 30, color: '#3498db', label: 'Origin' },
    { x: 200, y: -150, r: 25, color: '#e74c3c', label: 'A' },
    { x: -180, y: 120, r: 25, color: '#2ecc71', label: 'B' },
    { x: 300, y: 200, r: 25, color: '#f39c12', label: 'C' },
    { x: -250, y: -200, r: 25, color: '#9b59b6', label: 'D' },
];

function step() {
    board.step(performance.now());
    const ctx = board.context;
    drawGrid(ctx, 50, 500);

    for (const lm of landmarks) {
        ctx.save();
        ctx.fillStyle = lm.color;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(lm.x, lm.y, lm.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lm.label, lm.x, lm.y);
        ctx.restore();
    }

    requestAnimationFrame(step);
}

requestAnimationFrame(step);

// navigate the canvas using w, a, s, d
window.addEventListener('keydown', event => {
    if (event.key === 'a') {
        board.getCameraRig().panByViewPort({ x: -10, y: 0 });
    } else if (event.key === 'd') {
        board.getCameraRig().panByViewPort({ x: 10, y: 0 });
    } else if (event.key === 'w') {
        board.getCameraRig().panByViewPort({ x: 0, y: -10 });
    } else if (event.key === 's') {
        board.getCameraRig().panByViewPort({ x: 0, y: 10 });
    }
});
