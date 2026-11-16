import { describe, expect, it } from 'vitest';

import { WhiteboardDocument } from '../../src/whiteboard/document/document';
import type {
    NoteShape,
    Shape,
    TextShape,
} from '../../src/whiteboard/document/types';
import type {
    TextInput,
    TextInputSession,
} from '../../src/whiteboard/editor/text-input';
import type { Box } from '../../src/whiteboard/geometry/box';
import { fakeContext, fakePath } from './fake-canvas';
import { click, makeEditor, note, only, rect, wait } from './helpers';

class FakeTextInput implements TextInput {
    session: TextInputSession | null = null;
    opened: TextInputSession[] = [];
    repositioned: Box[] = [];
    text = '';

    get active(): boolean {
        return this.session !== null;
    }

    open(session: TextInputSession): void {
        this.session = session;
        this.opened.push(session);
        this.text = session.text;
    }

    reposition(rect: Box): void {
        this.repositioned.push(rect);
    }

    close(): void {
        const session = this.session;
        this.session = null;
        session?.onCommit(this.text);
    }

    type(text: string): void {
        this.text = text;
        this.session!.onInput(text);
    }
}

function textEditor(shapes: Shape[] = []) {
    const input = new FakeTextInput();
    const setup = makeEditor({
        textInput: input,
        createPath: fakePath,
        document: new WhiteboardDocument(shapes),
    });
    return { ...setup, input };
}

describe('text and notes', () => {
    it('placing text opens editing and typing updates the shape', () => {
        const { editor, input } = textEditor();
        editor.setTool('text');
        wait();
        click(editor, { x: 10, y: 20 });
        expect(input.active).toBe(true);
        expect(editor.getState().editingText).toBe(true);
        expect(only(editor)).toMatchObject({
            type: 'text',
            x: 10,
            y: 20,
            text: '',
        });
        input.type('Hello');
        expect((only(editor) as TextShape).text).toBe('Hello');
        input.close();
        expect(editor.getState().editingText).toBe(false);
        expect(editor.tool).toBe('select');
        expect(editor.getState().selection).toEqual([only(editor).id]);
        editor.undo();
        expect(editor.document.size).toBe(0);
    });

    it('notes are placed centred on the click', () => {
        const { editor, input } = textEditor();
        editor.setTool('note');
        wait();
        click(editor, { x: 0, y: 0 });
        expect(only(editor)).toMatchObject({
            type: 'note',
            x: -100,
            y: -100,
            w: 200,
            h: 200,
        });
        expect(input.session!.wrap).toBe(true);
    });

    it('empty text is removed when editing ends, empty notes stay', () => {
        const { editor, input } = textEditor();
        editor.setTool('text');
        wait();
        click(editor, { x: 0, y: 0 });
        input.type('   ');
        input.close();
        expect(editor.document.size).toBe(0);
        editor.setTool('note');
        wait();
        click(editor, { x: 0, y: 0 });
        input.close();
        expect(editor.document.size).toBe(1);
    });

    it('double-click edits an existing note', () => {
        const { editor, input } = textEditor([
            note('n', { x: 0, y: 0, text: 'Old' }),
        ]);
        editor.setTool('select');
        wait();
        click(editor, { x: 50, y: 50 });
        click(editor, { x: 50, y: 50 });
        expect(input.session!.text).toBe('Old');
        input.type('New');
        input.close();
        expect((editor.document.get('n') as NoteShape).text).toBe('New');
        editor.undo();
        expect((editor.document.get('n') as NoteShape).text).toBe('Old');
    });

    it('the session follows the camera', () => {
        const { board, editor, input } = textEditor();
        editor.setTool('text');
        wait();
        click(editor, { x: 0, y: 0 });
        const opening = input.session!.rect;
        board.getCameraRig().panByViewPort({ x: 50, y: 0 });
        editor.draw(fakeContext());
        expect(input.repositioned.at(-1)!.x).toBeCloseTo(opening.x - 50);
    });

    it('the shape being edited hides its own text', () => {
        const { editor, input } = textEditor([
            note('n', { x: 0, y: 0, text: 'Secret' }),
        ]);
        editor.setTool('select');
        wait();
        click(editor, { x: 50, y: 50 });
        click(editor, { x: 50, y: 50 });
        expect(input.active).toBe(true);
        const ctx = fakeContext();
        editor.draw(ctx);
        expect(ctx.called('fillText')).toEqual([]);
    });

    it('a press on the canvas ends editing first', () => {
        const { editor, input } = textEditor([rect('r', { x: 300, y: 0 })]);
        editor.setTool('text');
        wait();
        click(editor, { x: 0, y: 0 });
        input.type('Kept');
        wait();
        click(editor, { x: 500, y: 500 });
        expect(input.active).toBe(false);
        expect(
            editor.document
                .all()
                .some(s => s.type === 'text' && s.text === 'Kept')
        ).toBe(true);
    });

    it('switching tools keeps the text being typed', () => {
        const { editor, input } = textEditor();
        editor.setTool('text');
        wait();
        click(editor, { x: 0, y: 0 });
        input.type('Stay');
        editor.setTool('pen');
        expect(input.active).toBe(false);
        expect((only(editor) as TextShape).text).toBe('Stay');
    });
});
