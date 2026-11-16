import type { Board } from '@ue-too/board';
import { describe, expect, it } from 'vitest';

import type {
    ArrowShape,
    LineShape,
    PenShape,
} from '../../src/whiteboard/document/types';
import type { Editor } from '../../src/whiteboard/editor/editor';
import { type PathOp, sketchShape } from '../../src/whiteboard/render/sketch';
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

type Pt = { x: number; y: number };

// The rendered stroke as a polyline: lines as they are, curves finely cut
function flatten(ops: PathOp[]): Pt[] {
    const out: Pt[] = [];
    let at: Pt = { x: 0, y: 0 };
    for (const op of ops) {
        if (op[0] === 'M' || op[0] === 'L') {
            at = { x: op[1], y: op[2] };
            out.push(at);
        } else if (op[0] === 'C') {
            const [, x1, y1, x2, y2, x, y] = op;
            for (let i = 1; i <= 32; i++) {
                const t = i / 32;
                const u = 1 - t;
                out.push({
                    x:
                        u ** 3 * at.x +
                        3 * u * u * t * x1 +
                        3 * u * t * t * x2 +
                        t ** 3 * x,
                    y:
                        u ** 3 * at.y +
                        3 * u * u * t * y1 +
                        3 * u * t * t * y2 +
                        t ** 3 * y,
                });
            }
            at = { x, y };
        }
    }
    return out;
}

function distanceToPolyline(p: Pt, line: Pt[]): number {
    if (line.length === 1)
        return Math.hypot(p.x - line[0]!.x, p.y - line[0]!.y);
    let best = Infinity;
    for (let i = 0; i < line.length - 1; i++) {
        const a = line[i]!;
        const b = line[i + 1]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSq = dx * dx + dy * dy;
        const t =
            lengthSq === 0
                ? 0
                : Math.max(
                      0,
                      Math.min(
                          1,
                          ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq
                      )
                  );
        best = Math.min(
            best,
            Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
        );
    }
    return best;
}

// How far, in screen px, the finished stroke strays from where the pointer went
function strayFromDrawn(editor: Editor, board: Board, drawn: Pt[]): number {
    const rendered = flatten(sketchShape(only(editor))[0]!.ops);
    const zoom = board.camera.zoomLevel;
    return Math.max(
        ...drawn.map(
            client =>
                distanceToPolyline(editor.toWorld(client), rendered) * zoom
        )
    );
}

// A hand-drawn zigzag, then a small loop, sampled every screen px
function scribble(): Pt[] {
    const corners: Pt[] = [
        { x: 100, y: 100 },
        { x: 140, y: 160 },
        { x: 180, y: 100 },
        { x: 220, y: 160 },
    ];
    const points: Pt[] = [];
    for (let i = 0; i < corners.length - 1; i++) {
        const a = corners[i]!;
        const b = corners[i + 1]!;
        const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
        for (let k = 0; k < n; k++) {
            points.push({
                x: a.x + ((b.x - a.x) * k) / n,
                y: a.y + ((b.y - a.y) * k) / n,
            });
        }
    }
    for (let t = 0; t <= Math.PI * 2; t += 1 / 30) {
        points.push({ x: 220 + 30 * Math.sin(t), y: 130 + 30 * Math.cos(t) });
    }
    return points;
}

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

    it('a finished pen stroke stays where it was drawn', () => {
        const { board, editor } = makeEditor();
        editor.setTool('pen');
        const drawn = scribble();
        dragPath(editor, drawn);
        expect(strayFromDrawn(editor, board, drawn)).toBeLessThanOrEqual(0.55);
    });

    it('a stroke drawn zoomed in keeps its detail when it ends', () => {
        const { board, editor } = makeEditor();
        board.camera.setZoomLevel(4);
        editor.setTool('pen');
        const drawn = scribble();
        dragPath(editor, drawn);
        expect(strayFromDrawn(editor, board, drawn)).toBeLessThanOrEqual(0.55);
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
