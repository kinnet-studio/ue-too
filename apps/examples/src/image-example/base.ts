import { Board, drawArrow } from '@ue-too/board';

import { fitToPage } from '../fit-to-page';
import { followInputMode } from '../input-mode';

const canvas = document.getElementById('graph') as HTMLCanvasElement;
// 800 × 600, or smaller to fit a phone or a short window; the board
// follows the canvas's CSS size
fitToPage(canvas, 800, 600, ({ width, height }) => {
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
});
const board = new Board(canvas);
followInputMode(mode => board.setInputMode(mode));

let userImage: HTMLImageElement | null = null;

const fileInput = document.getElementById('image-upload') as HTMLInputElement;
fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
        userImage = img;
        URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
});

function draw(timestamp: number) {
    board.step(timestamp);

    if (userImage) {
        board.context.drawImage(userImage, 0, 0);
    }

    // draw the axis arrow as reference
    board.context.save();
    board.context.strokeStyle = 'red';
    drawArrow(
        board.context,
        1,
        { x: 0, y: 0 },
        { x: 0, y: board.camera.boundaries.max.y },
        10,
        0.3
    );
    board.context.restore();

    board.context.save();
    board.context.strokeStyle = 'green';
    drawArrow(
        board.context,
        1,
        { x: 0, y: 0 },
        { x: board.camera.boundaries.max.x, y: 0 },
        10,
        0.3
    );
    board.context.restore();

    requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
