import { describe, expect, it } from 'vitest';

import { WhiteboardDocument } from '../../src/whiteboard/document/document';
import { click, drag, line, makeEditor, mouse, rect, wait } from './helpers';

function eraserOn(shapes = threeLines()) {
    return makeEditor({
        initialTool: 'eraser',
        document: new WhiteboardDocument(shapes),
    });
}

function threeLines() {
    return [50, 100, 150].map((x, i) =>
        line(`l${i}`, { x, y: 0, end: [0, 100], index: `a${i}` })
    );
}

describe('the eraser', () => {
    it('a drag across shapes erases them all in one step', () => {
        const { editor } = eraserOn();
        drag(editor, { x: 0, y: 50 }, { x: 200, y: 50 });
        expect(editor.document.size).toBe(0);
        editor.undo();
        expect(editor.document.size).toBe(3);
        expect(editor.tool).toBe('eraser');
    });

    it('marked shapes are faded until release', () => {
        const { editor } = eraserOn();
        editor.input.down(mouse(0, 50));
        editor.input.move(mouse(60, 50));
        editor.input.move(mouse(110, 50));
        expect(editor.erasing.size).toBe(2);
        expect(editor.document.size).toBe(3);
        editor.input.up(mouse(110, 50));
        expect(editor.erasing.size).toBe(0);
        expect(editor.document.size).toBe(1);
    });

    it('a fast drag between samples still hits', () => {
        const { editor } = eraserOn([
            line('v', { x: 100, y: 0, end: [0, 100] }),
        ]);
        editor.input.down(mouse(0, 50));
        editor.input.move(mouse(200, 50));
        editor.input.up(mouse(200, 50));
        expect(editor.document.size).toBe(0);
    });

    it('a tap erases the topmost shape only', () => {
        const solid = { color: 'ink', size: 'm', fill: 'solid' } as const;
        const { editor } = eraserOn([
            rect('below', { index: 'a', style: solid }),
            rect('above', { index: 'b', style: solid }),
        ]);
        wait();
        click(editor, { x: 50, y: 30 });
        expect(editor.document.all().map(s => s.id)).toEqual(['below']);
    });

    it('cancel erases nothing', () => {
        const { editor } = eraserOn();
        editor.input.down(mouse(0, 50));
        editor.input.move(mouse(60, 50));
        editor.input.cancel();
        expect(editor.document.size).toBe(3);
        expect(editor.erasing.size).toBe(0);
        expect(editor.history.canUndo).toBe(false);
    });

    it('missing everything changes nothing', () => {
        const { editor } = eraserOn();
        drag(editor, { x: 0, y: 300 }, { x: 200, y: 300 });
        expect(editor.document.size).toBe(3);
        expect(editor.history.canUndo).toBe(false);
    });
});
