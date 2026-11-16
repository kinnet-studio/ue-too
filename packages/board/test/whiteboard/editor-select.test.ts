import { describe, expect, it } from 'vitest';

import { WhiteboardDocument } from '../../src/whiteboard/document/document';
import type { ArrowShape, Shape } from '../../src/whiteboard/document/types';
import {
    arrow,
    click,
    drag,
    makeEditor,
    mouse,
    note,
    rect,
    wait,
} from './helpers';

const solid = { color: 'ink', size: 'm', fill: 'solid' } as const;

// Starts from a document that already holds the shapes, so setting up
// isn't an undo step
function selectEditor(shapes: Shape[], options = {}) {
    return makeEditor({
        initialTool: 'select',
        document: new WhiteboardDocument(shapes),
        ...options,
    });
}

describe('the select tool', () => {
    it('click selects, Shift-click adds, empty click clears', () => {
        const { editor } = selectEditor([
            rect('a', { x: 0, y: 0, style: solid }),
            rect('b', { x: 200, y: 0, style: solid }),
        ]);
        wait();
        click(editor, { x: 50, y: 30 });
        expect(editor.getState().selection).toEqual(['a']);
        wait();
        click(editor, { x: 250, y: 30 }, { shiftKey: true });
        expect(editor.getState().selection).toEqual(['a', 'b']);
        wait();
        click(editor, { x: 250, y: 30 }, { shiftKey: true });
        expect(editor.getState().selection).toEqual(['a']);
        wait();
        click(editor, { x: 150, y: 300 });
        expect(editor.getState().selection).toEqual([]);
    });

    it('a click on one shape of a selection selects just that one', () => {
        const { editor } = selectEditor([
            rect('a', { x: 0, y: 0, style: solid }),
            rect('b', { x: 200, y: 0, style: solid }),
        ]);
        editor.selectAll();
        wait();
        click(editor, { x: 50, y: 30 });
        expect(editor.getState().selection).toEqual(['a']);
    });

    it('dragging moves every selected shape as one step', () => {
        const { editor } = selectEditor([
            rect('a', { x: 0, y: 0, style: solid }),
            rect('b', { x: 200, y: 0, style: solid }),
        ]);
        editor.selectAll();
        drag(editor, { x: 50, y: 30 }, { x: 80, y: 30 });
        expect(editor.document.get('a')!.x).toBe(30);
        expect(editor.document.get('b')!.x).toBe(230);
        editor.undo();
        expect(editor.document.get('a')!.x).toBe(0);
        expect(editor.document.get('b')!.x).toBe(200);
    });

    it('dragging an unselected shape selects and moves it', () => {
        const { editor } = selectEditor([rect('a', { style: solid })]);
        drag(editor, { x: 50, y: 30 }, { x: 60, y: 50 });
        expect(editor.getState().selection).toEqual(['a']);
        expect(editor.document.get('a')).toMatchObject({ x: 10, y: 20 });
    });

    it('marquee selects shapes fully inside', () => {
        const { editor } = selectEditor([
            rect('in', { x: 10, y: 10, w: 20, h: 20 }),
            rect('out', { x: 90, y: 10, w: 100, h: 20 }),
        ]);
        drag(editor, { x: 0, y: 0 }, { x: 100, y: 100 });
        expect(editor.getState().selection).toEqual(['in']);
    });

    it('Shift keeps the old selection while marqueeing', () => {
        const { editor } = selectEditor([
            rect('a', { x: 10, y: 10, w: 20, h: 20 }),
            rect('b', { x: 300, y: 10, w: 20, h: 20 }),
        ]);
        drag(editor, { x: 0, y: 0 }, { x: 100, y: 100 });
        drag(editor, { x: 290, y: 0 }, { x: 400, y: 100 }, { shiftKey: true });
        expect([...editor.getState().selection].sort()).toEqual(['a', 'b']);
    });

    it('dragging a corner handle resizes', () => {
        const { editor } = selectEditor([
            rect('a', { x: 0, y: 0, w: 100, h: 100, style: solid }),
        ]);
        wait();
        click(editor, { x: 50, y: 50 });
        drag(editor, { x: 100, y: 100 }, { x: 150, y: 120 });
        expect(editor.document.get('a')).toMatchObject({ w: 150, h: 120 });
        editor.undo();
        expect(editor.document.get('a')).toMatchObject({ w: 100, h: 100 });
    });

    it('dragging an arrow end moves only that end', () => {
        const { editor } = selectEditor([
            arrow('a', { x: 0, y: 0, end: [100, 0] }),
        ]);
        wait();
        click(editor, { x: 50, y: 0 });
        drag(editor, { x: 100, y: 0 }, { x: 100, y: 60 });
        const moved = editor.document.get('a') as ArrowShape;
        expect(moved.x).toBe(0);
        expect(moved.y).toBe(0);
        expect(moved.end).toEqual([100, 60]);
    });

    it('dragging an arrow start keeps its end in place', () => {
        const { editor } = selectEditor([
            arrow('a', { x: 0, y: 0, end: [100, 0] }),
        ]);
        wait();
        click(editor, { x: 50, y: 0 });
        drag(editor, { x: 0, y: 0 }, { x: 20, y: 40 });
        const moved = editor.document.get('a') as ArrowShape;
        expect(moved).toMatchObject({ x: 20, y: 40 });
        expect(moved.end).toEqual([80, -40]);
    });

    it('Delete removes the selection as one step', () => {
        const { editor } = selectEditor([rect('a'), rect('b', { x: 300 })]);
        editor.selectAll();
        editor.deleteSelection();
        expect(editor.document.size).toBe(0);
        editor.undo();
        expect(editor.document.size).toBe(2);
    });

    it('a shape over the background is selected, the background is not activated', () => {
        let activated = 0;
        const { editor } = selectEditor([rect('a', { style: solid })], {
            background: { hitTest: () => true, activate: () => activated++ },
        });
        wait();
        click(editor, { x: 50, y: 30 });
        expect(activated).toBe(0);
        expect(editor.getState().selection).toEqual(['a']);
    });

    it('an empty click on the background activates it', () => {
        let activated = 0;
        const { editor } = selectEditor([], {
            background: { hitTest: () => true, activate: () => activated++ },
        });
        wait();
        click(editor, { x: 50, y: 30 });
        expect(activated).toBe(1);
    });

    it('undo prunes the selection', () => {
        const { editor } = makeEditor();
        editor.setTool('rect');
        drag(editor, { x: 0, y: 0 }, { x: 50, y: 50 });
        expect(editor.getState().selection).toHaveLength(1);
        editor.undo();
        expect(editor.getState().selection).toEqual([]);
    });

    it('cancel during a move puts the shapes back', () => {
        const { editor } = selectEditor([rect('a', { style: solid })]);
        editor.input.down(mouse(50, 30));
        editor.input.move(mouse(90, 30));
        editor.input.cancel();
        expect(editor.document.get('a')!.x).toBe(0);
        expect(editor.history.canUndo).toBe(false);
    });

    it('double-click asks to edit notes', () => {
        const { editor } = selectEditor([note('n', { x: 0, y: 0 })]);
        const edited: string[] = [];
        (editor as unknown as { editText(id: string): void }).editText = id =>
            edited.push(id);
        wait();
        click(editor, { x: 50, y: 50 });
        click(editor, { x: 50, y: 50 });
        expect(edited).toEqual(['n']);
    });

    it('picking a drawing tool clears the selection', () => {
        const { editor } = selectEditor([rect('a')]);
        editor.selectAll();
        editor.setTool('pen');
        expect(editor.getState().selection).toEqual([]);
    });
});
