import { describe, expect, it } from 'vitest';

import type {
    ArrowShape,
    LineShape,
    PenShape,
} from '../../src/whiteboard/document/types';
import {
    click,
    drag,
    dragPath,
    makeEditor,
    mouse,
    only,
    touch,
    wait,
} from './helpers';

describe('creating shapes', () => {
    it('drags a rectangle corner to corner, either direction', () => {
        const { editor } = makeEditor();
        editor.setTool('rect');
        drag(editor, { x: 100, y: 80 }, { x: 20, y: 10 });
        expect(only(editor)).toMatchObject({
            type: 'rect',
            x: 20,
            y: 10,
            w: 80,
            h: 70,
        });
        expect(editor.tool).toBe('select');
        expect(editor.getState().selection).toEqual([only(editor).id]);
    });

    it('gives new shapes the current style, a seed and an index', () => {
        const { editor } = makeEditor();
        editor.setTool('ellipse');
        drag(editor, { x: 0, y: 0 }, { x: 50, y: 30 });
        const shape = only(editor);
        expect(shape.style).toEqual({ color: 'ink', size: 'm', fill: 'none' });
        expect(Number.isInteger(shape.seed)).toBe(true);
        expect(shape.index.length).toBeGreaterThan(0);
        expect(shape.id).toMatch(/^[0-9A-Za-z]{16}$/);
    });

    it('Shift makes a circle', () => {
        const { editor } = makeEditor();
        editor.setTool('ellipse');
        drag(editor, { x: 0, y: 0 }, { x: 100, y: 40 }, { shiftKey: true });
        expect(only(editor)).toMatchObject({ type: 'ellipse', w: 100, h: 100 });
    });

    it('Shift keeps the drag direction', () => {
        const { editor } = makeEditor();
        editor.setTool('rect');
        drag(editor, { x: 0, y: 0 }, { x: -100, y: 40 }, { shiftKey: true });
        expect(only(editor)).toMatchObject({ x: -100, y: 0, w: 100, h: 100 });
    });

    it('a click makes a default shape', () => {
        const { editor } = makeEditor();
        editor.setTool('rect');
        wait();
        click(editor, { x: 0, y: 0 });
        expect(only(editor)).toMatchObject({ x: -80, y: -50, w: 160, h: 100 });
    });

    it('drags an arrow from start to end', () => {
        const { editor } = makeEditor();
        editor.setTool('arrow');
        drag(editor, { x: 10, y: 10 }, { x: 110, y: 60 });
        const arrow = only(editor) as ArrowShape;
        expect(arrow).toMatchObject({ type: 'arrow', x: 10, y: 10 });
        expect(arrow.end).toEqual([100, 50]);
        expect(editor.tool).toBe('select');
    });

    it('Shift snaps arrows to 15 degrees', () => {
        const { editor } = makeEditor();
        editor.setTool('arrow');
        drag(editor, { x: 0, y: 0 }, { x: 100, y: 8 }, { shiftKey: true });
        const arrow = only(editor) as ArrowShape;
        expect(arrow.end[1]).toBeCloseTo(0);
        expect(arrow.end[0]).toBeCloseTo(Math.hypot(100, 8));
    });

    it('a click makes a default line', () => {
        const { editor } = makeEditor();
        editor.setTool('line');
        wait();
        click(editor, { x: 5, y: 5 });
        expect((only(editor) as LineShape).end).toEqual([160, 0]);
    });

    it('pen keeps drawing and thins points by screen distance', () => {
        const { editor } = makeEditor();
        editor.setTool('pen');
        dragPath(
            editor,
            Array.from({ length: 50 }, (_, i) => ({ x: i * 0.2, y: 0 }))
        );
        expect(editor.tool).toBe('pen');
        expect((only(editor) as PenShape).points.length).toBeLessThan(25);
    });

    it('pen strokes are simplified and rounded when they end', () => {
        const { editor } = makeEditor();
        editor.setTool('pen');
        dragPath(
            editor,
            Array.from({ length: 40 }, (_, i) => ({ x: i * 3.333, y: 7.777 }))
        );
        const stroke = only(editor) as PenShape;
        expect(stroke.points.length).toBe(2);
        for (const [x, y] of stroke.points) {
            expect(Math.round(x * 100) / 100).toBe(x);
            expect(Math.round(y * 100) / 100).toBe(y);
        }
    });

    it('a pen tap leaves a dot', () => {
        const { editor } = makeEditor();
        editor.setTool('pen');
        wait();
        click(editor, { x: 3, y: 4 });
        expect(only(editor)).toMatchObject({
            type: 'pen',
            x: 3,
            y: 4,
            points: [[0, 0]],
        });
    });

    it('one gesture is one undo step', () => {
        const { editor } = makeEditor();
        editor.setTool('rect');
        drag(editor, { x: 0, y: 0 }, { x: 80, y: 80 });
        editor.undo();
        expect(editor.document.size).toBe(0);
        editor.redo();
        expect(editor.document.size).toBe(1);
    });

    it('new shapes stack on top', () => {
        const { editor } = makeEditor();
        editor.setTool('rect');
        drag(editor, { x: 0, y: 0 }, { x: 80, y: 80 });
        editor.setTool('rect');
        drag(editor, { x: 10, y: 10 }, { x: 90, y: 90 });
        const [first, second] = editor.document.all();
        expect(second!.index > first!.index).toBe(true);
    });

    it('drawing tools ignore the background', () => {
        let activated = 0;
        const { editor } = makeEditor({
            background: { hitTest: () => true, activate: () => activated++ },
        });
        editor.setTool('rect');
        wait();
        click(editor, { x: 0, y: 0 });
        expect(activated).toBe(0);
        expect(editor.document.size).toBe(1);
    });

    it('undo mid-drag cancels the gesture', () => {
        const { editor } = makeEditor();
        editor.setTool('rect');
        editor.input.down(mouse(0, 0));
        editor.input.move(mouse(50, 50));
        editor.undo();
        expect(editor.document.size).toBe(0);
        expect(editor.history.canRedo).toBe(false);
        editor.input.up(mouse(50, 50));
        expect(editor.document.size).toBe(0);
        expect(editor.history.canUndo).toBe(false);
    });

    it('a second finger cancels a stroke', () => {
        const { editor } = makeEditor();
        editor.setTool('pen');
        editor.input.down(touch(1, 0, 0));
        editor.input.move(touch(1, 20, 0));
        editor.input.down(touch(2, 50, 50));
        expect(editor.document.size).toBe(0);
        expect(editor.history.canUndo).toBe(false);
        editor.input.up(touch(1, 20, 0));
        editor.input.up(touch(2, 50, 50));
        expect(editor.document.size).toBe(0);
        expect(editor.tool).toBe('pen');
    });
});
