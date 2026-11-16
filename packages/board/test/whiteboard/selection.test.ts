import { describe, expect, it } from 'vitest';

import type {
    ArrowShape,
    PenShape,
    TextShape,
} from '../../src/whiteboard/document/types';
import {
    handleAt,
    handlesFor,
    resizeBox,
    resizeShape,
    selectionBox,
} from '../../src/whiteboard/editor/selection';
import { arrow, env, pen, rect, text } from './shapes';

describe('resizeBox', () => {
    const box = { x: 0, y: 0, w: 100, h: 50 };

    it('moves only the dragged edges', () => {
        expect(resizeBox(box, 'e', { x: 20, y: 99 }, false)).toEqual({
            x: 0,
            y: 0,
            w: 120,
            h: 50,
        });
        expect(resizeBox(box, 'nw', { x: 10, y: 5 }, false)).toEqual({
            x: 10,
            y: 5,
            w: 90,
            h: 45,
        });
    });

    it('resizing past the opposite edge flips instead of going negative', () => {
        expect(resizeBox(box, 'e', { x: -150, y: 0 }, false)).toEqual({
            x: -50,
            y: 0,
            w: 50,
            h: 50,
        });
    });

    it('keepAspect holds the ratio from a corner', () => {
        expect(resizeBox(box, 'se', { x: 100, y: 0 }, true)).toEqual({
            x: 0,
            y: 0,
            w: 200,
            h: 100,
        });
        expect(resizeBox(box, 'nw', { x: -100, y: 0 }, true)).toEqual({
            x: -100,
            y: -50,
            w: 200,
            h: 100,
        });
    });
});

describe('resizeShape', () => {
    const from = { x: 0, y: 0, w: 100, h: 100 };
    const to = { x: 50, y: 0, w: 200, h: 50 };

    it('scales rectangles', () => {
        expect(
            resizeShape(rect('r', { x: 0, y: 0, w: 100, h: 100 }), from, to)
        ).toMatchObject({ x: 50, y: 0, w: 200, h: 50 });
    });

    it('scales pen points about the box', () => {
        const out = resizeShape(
            pen('p', {
                x: 10,
                y: 20,
                points: [
                    [0, 0],
                    [10, 20],
                ],
            }),
            from,
            to
        ) as PenShape;
        expect(out.x).toBe(70);
        expect(out.y).toBe(10);
        expect(out.points).toEqual([
            [0, 0],
            [20, 10],
        ]);
    });

    it('moves both ends of an arrow', () => {
        const out = resizeShape(
            arrow('a', { x: 0, y: 0, end: [100, 100] }),
            from,
            to
        ) as ArrowShape;
        expect(out).toMatchObject({ x: 50, y: 0 });
        expect(out.end).toEqual([200, 50]);
    });

    it('moves text without resizing it', () => {
        const out = resizeShape(
            text('t', { x: 50, y: 50 }),
            from,
            to
        ) as TextShape;
        expect(out).toMatchObject({ x: 150, y: 25, style: { size: 'm' } });
    });
});

describe('handles', () => {
    it('a box selection has eight handles around its frame', () => {
        const handles = handlesFor(
            [rect('a', { x: 0, y: 0, w: 100, h: 100 })],
            env
        );
        expect(handles.map(h => h.id).sort()).toEqual(
            ['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w'].sort()
        );
        expect(handles.find(h => h.id === 'se')).toEqual({
            id: 'se',
            x: 100,
            y: 100,
        });
    });

    it('a single arrow has handles at its ends', () => {
        expect(
            handlesFor([arrow('a', { x: 5, y: 5, end: [10, 0] })], env)
        ).toEqual([
            { id: 'start', x: 5, y: 5 },
            { id: 'end', x: 15, y: 5 },
        ]);
    });

    it('a single text shape has no handles', () => {
        expect(handlesFor([text('t')], env)).toEqual([]);
    });

    it('handles are found within 8 screen px at any zoom', () => {
        const hs = handlesFor([rect('a', { x: 0, y: 0, w: 100, h: 100 })], env);
        expect(handleAt(hs, { x: 100 + 7 / 4, y: 100 }, 4)).toBe('se');
        expect(handleAt(hs, { x: 100 + 9 / 4, y: 100 }, 4)).toBe(null);
        expect(handleAt(hs, { x: 100 + 30, y: 100 }, 0.25)).toBe('se');
    });

    it('the selection box spans every selected shape', () => {
        expect(
            selectionBox(
                [
                    rect('a', { x: 0, y: 0, w: 10, h: 10 }),
                    rect('b', { x: 50, y: 20, w: 10, h: 10 }),
                ],
                env
            )
        ).toEqual({ x: 0, y: 0, w: 60, h: 30 });
        expect(selectionBox([], env)).toBeNull();
    });
});
