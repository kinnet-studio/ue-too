import { describe, expect, it } from 'vitest';

import { WhiteboardDocument } from '../../src/whiteboard/document/document';
import type { Shape } from '../../src/whiteboard/document/types';
import type { KeyLike } from '../../src/whiteboard/editor/keyboard';
import type {
    TextInput,
    TextInputSession,
} from '../../src/whiteboard/editor/text-input';
import { click, drag, makeEditor, mouse, rect, wait } from './helpers';

function withShapes(shapes: Shape[], options = {}) {
    return makeEditor({ document: new WhiteboardDocument(shapes), ...options });
}

function key(over: Partial<KeyLike>) {
    let prevented = false;
    const event = {
        key: 'x',
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        target: null,
        preventDefault: () => (prevented = true),
        ...over,
    };
    return { event, prevented: () => prevented };
}

describe('editor commands', () => {
    it('setStyle restyles the selection in one step and sets the next style', () => {
        const { editor } = withShapes([rect('a'), rect('b', { x: 300 })]);
        editor.selectAll();
        editor.setStyle({ color: 'red', size: 'l' });
        expect(editor.document.all().map(s => s.style.color)).toEqual([
            'red',
            'red',
        ]);
        expect(editor.getState().style).toMatchObject({
            color: 'red',
            size: 'l',
        });
        editor.undo();
        expect(editor.document.all().map(s => s.style.color)).toEqual([
            'ink',
            'ink',
        ]);
        editor.setTool('rect');
        drag(editor, { x: 0, y: 500 }, { x: 50, y: 550 });
        expect(editor.document.all().at(-1)!.style).toMatchObject({
            color: 'red',
            size: 'l',
        });
    });

    it('selectionStyle reports shared values only', () => {
        const { editor } = withShapes([
            rect('a', { style: { color: 'red', size: 'm', fill: 'none' } }),
            rect('b', {
                x: 300,
                style: { color: 'blue', size: 'm', fill: 'none' },
            }),
        ]);
        expect(editor.getState().selectionStyle).toBeNull();
        editor.selectAll();
        expect(editor.getState().selectionStyle).toEqual({
            size: 'm',
            fill: 'none',
        });
    });

    it('clear is one undoable step', () => {
        const { editor } = withShapes([rect('a'), rect('b'), rect('c')]);
        editor.clear();
        expect(editor.document.size).toBe(0);
        expect(editor.getState().empty).toBe(true);
        editor.undo();
        expect(editor.document.size).toBe(3);
    });

    it('clear does nothing on an empty board', () => {
        const { editor } = makeEditor();
        editor.clear();
        expect(editor.history.canUndo).toBe(false);
    });

    it('switching tools mid-drag cancels the gesture', () => {
        const { editor } = makeEditor();
        editor.setTool('rect');
        editor.input.down(mouse(0, 0));
        editor.input.move(mouse(60, 60));
        editor.setTool('pen');
        expect(editor.document.size).toBe(0);
        expect(editor.history.canUndo).toBe(false);
        editor.input.up(mouse(60, 60));
        expect(editor.document.size).toBe(0);
    });

    it('keys pick tools and run commands', () => {
        const { editor } = withShapes([rect('a')]);
        const r = key({ key: 'r' });
        expect(editor.handleKey(r.event)).toBe(true);
        expect(r.prevented()).toBe(true);
        expect(editor.tool).toBe('rect');
        editor.handleKey(key({ key: 'a', ctrlKey: true }).event);
        expect(editor.tool).toBe('select');
        expect(editor.getState().selection).toEqual(['a']);
        editor.handleKey(key({ key: 'Delete' }).event);
        expect(editor.document.size).toBe(0);
        editor.handleKey(key({ key: 'z', ctrlKey: true }).event);
        expect(editor.document.size).toBe(1);
        editor.handleKey(
            key({ key: 'z', ctrlKey: true, shiftKey: true }).event
        );
        expect(editor.document.size).toBe(0);
    });

    it('Escape clears the selection', () => {
        const { editor } = withShapes([rect('a')]);
        editor.selectAll();
        editor.handleKey(key({ key: 'Escape' }).event);
        expect(editor.getState().selection).toEqual([]);
    });

    it('Delete with nothing selected leaves the key alone', () => {
        const { editor } = makeEditor();
        const del = key({ key: 'Backspace' });
        expect(editor.handleKey(del.event)).toBe(false);
        expect(del.prevented()).toBe(false);
    });

    it('unknown keys are not handled', () => {
        const { editor } = makeEditor();
        const other = key({ key: 'q' });
        expect(editor.handleKey(other.event)).toBe(false);
        expect(other.prevented()).toBe(false);
    });

    it('keys are ignored while editing text', () => {
        const session: { current: TextInputSession | null } = { current: null };
        const textInput: TextInput = {
            open: s => (session.current = s),
            reposition: () => {},
            close: () => {
                session.current?.onCommit('');
                session.current = null;
            },
            get active() {
                return session.current !== null;
            },
        };
        const { editor } = makeEditor({ textInput });
        editor.setTool('text');
        wait();
        click(editor, { x: 0, y: 0 });
        expect(editor.getState().editingText).toBe(true);
        expect(editor.handleKey(key({ key: 'r' }).event)).toBe(false);
        expect(editor.tool).toBe('select');
        expect(editor.getState().editingText).toBe(true);
    });
});
