import { describe, expect, it } from 'vitest';

import type { EditorState } from '../../src/whiteboard/editor/editor';
import { click, drag, makeEditor, mouse, rect, wait } from './helpers';

describe('Editor with the hand tool', () => {
    it('starts with the hand tool', () => {
        const { editor } = makeEditor();
        expect(editor.tool).toBe('hand');
        expect(editor.getState()).toMatchObject({
            tool: 'hand',
            selection: [],
            canUndo: false,
            canRedo: false,
            empty: true,
            editingText: false,
        });
    });

    it('maps client to world at zoom 1', () => {
        const { editor } = makeEditor();
        expect(editor.toWorld({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
    });

    it('hand drag pans the camera', () => {
        const { board, editor } = makeEditor();
        drag(editor, { x: 0, y: 0 }, { x: 100, y: 0 });
        expect(board.camera.position.x).toBeCloseTo(-100);
    });

    it('hand click activates the background', () => {
        const hits: { x: number; y: number }[] = [];
        const { editor } = makeEditor({
            background: {
                hitTest: () => true,
                activate: world => hits.push(world),
            },
        });
        wait();
        click(editor, { x: 30, y: 40 });
        expect(hits).toEqual([{ x: 30, y: 40 }]);
    });

    it('a shape over the background wins', () => {
        let activated = 0;
        const { editor } = makeEditor({
            background: { hitTest: () => true, activate: () => activated++ },
        });
        editor.document.put(
            rect('r', {
                x: 0,
                y: 0,
                w: 100,
                h: 100,
                style: { color: 'ink', size: 'm', fill: 'solid' },
            })
        );
        wait();
        click(editor, { x: 50, y: 50 });
        expect(activated).toBe(0);
        wait();
        click(editor, { x: 150, y: 50 });
        expect(activated).toBe(1);
    });

    it('a drag never activates', () => {
        let activated = 0;
        const { editor } = makeEditor({
            background: { hitTest: () => true, activate: () => activated++ },
        });
        drag(editor, { x: 0, y: 0 }, { x: 40, y: 0 });
        expect(activated).toBe(0);
    });

    it('middle click activates the background too', () => {
        const buttons: number[] = [];
        const { editor } = makeEditor({
            background: {
                hitTest: () => true,
                activate: (_, pointer) => buttons.push(pointer.button),
            },
        });
        editor.input.down(mouse(5, 5, { button: 1 }));
        editor.input.up(mouse(5, 5, { button: 1 }));
        expect(buttons).toEqual([1]);
    });

    it('stands aside while the board pans with the space bar', () => {
        const { board, editor } = makeEditor();
        board.kmtInputStateMachine!.happens('spacebarDown', {});
        expect(board.kmtInputStateMachine!.currentState).not.toBe('IDLE');
        drag(editor, { x: 0, y: 0 }, { x: 100, y: 0 });
        expect(board.camera.position.x).toBeCloseTo(0);
    });

    it('setTool notifies subscribers once per change', () => {
        const { editor } = makeEditor();
        const seen: EditorState[] = [];
        editor.subscribe(state => seen.push(state));
        editor.setTool('pen');
        editor.setTool('pen');
        expect(editor.tool).toBe('pen');
        expect(seen.map(s => s.tool)).toEqual(['pen']);
    });

    it('reports when the board stops being empty', () => {
        const { editor } = makeEditor();
        const seen: boolean[] = [];
        editor.subscribe(state => seen.push(state.empty));
        editor.document.put(rect('r'));
        expect(seen).toEqual([false]);
        expect(editor.getState().canUndo).toBe(true);
    });

    it('destroy stops notifying', () => {
        const { editor } = makeEditor();
        let calls = 0;
        editor.subscribe(() => calls++);
        editor.destroy();
        editor.document.put(rect('r'));
        expect(calls).toBe(0);
    });
});
