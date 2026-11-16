import { describe, expect, it } from 'vitest';

import { shapeBounds } from '../../src/whiteboard/geometry/bounds';
import {
    boxContainsBox,
    boxesOverlap,
    normalizeBox,
    unionBoxes,
} from '../../src/whiteboard/geometry/box';
import { hitShape, shapesInBox } from '../../src/whiteboard/geometry/hit-test';
import {
    roundPoints,
    simplifyPoints,
} from '../../src/whiteboard/geometry/simplify';
import {
    LINE_HEIGHT,
    NOTE_PADDING,
    textFont,
    textLines,
} from '../../src/whiteboard/geometry/text';
import { arrow, ellipse, env, line, note, pen, rect, text } from './shapes';

const filled = <T extends { style: { fill: string } }>(
    shape: T,
    fill: 'hachure' | 'solid'
): T => ({ ...shape, style: { ...shape.style, fill } });

describe('boxes', () => {
    it('normalizes either drag direction', () => {
        expect(normalizeBox(10, 20, 0, 5)).toEqual({
            x: 0,
            y: 5,
            w: 10,
            h: 15,
        });
    });

    it('unions, contains and overlaps', () => {
        const a = { x: 0, y: 0, w: 10, h: 10 };
        const b = { x: 20, y: 5, w: 10, h: 10 };
        expect(unionBoxes([a, b])).toEqual({ x: 0, y: 0, w: 30, h: 15 });
        expect(unionBoxes([])).toBeNull();
        expect(boxContainsBox({ x: -1, y: -1, w: 12, h: 12 }, a)).toBe(true);
        expect(boxContainsBox(a, b)).toBe(false);
        expect(boxesOverlap(a, b)).toBe(false);
        expect(boxesOverlap(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    });
});

describe('hitShape', () => {
    it('unfilled rectangles hit on the outline only', () => {
        const r = rect('a', { x: 0, y: 0, w: 100, h: 50 });
        expect(hitShape(r, { x: 50, y: 25 }, 6, env)).toBe(false);
        expect(hitShape(r, { x: 50, y: 3 }, 6, env)).toBe(true);
        expect(hitShape(r, { x: 50, y: -5 }, 6, env)).toBe(true);
        expect(hitShape(r, { x: 50, y: -20 }, 6, env)).toBe(false);
        expect(hitShape(filled(r, 'hachure'), { x: 50, y: 25 }, 6, env)).toBe(
            true
        );
    });

    it('tolerance follows zoom, measured from the stroke edge', () => {
        const l = line('l', { x: 0, y: 0, end: [100, 0] });
        // 24 world units at zoom 0.25
        expect(hitShape(l, { x: 50, y: 20 }, 6 / 0.25, env)).toBe(true);
        // 1.5 world units at zoom 4, plus half the 2.5-unit stroke
        expect(hitShape(l, { x: 50, y: 2.5 }, 6 / 4, env)).toBe(true);
        expect(hitShape(l, { x: 50, y: 3 }, 6 / 4, env)).toBe(false);
        // past the ends
        expect(hitShape(l, { x: 120, y: 0 }, 6, env)).toBe(false);
    });

    it('ellipses hit inside only when filled', () => {
        const e = ellipse('e', { x: 0, y: 0, w: 100, h: 50 });
        expect(hitShape(e, { x: 50, y: 25 }, 6, env)).toBe(false);
        expect(hitShape(filled(e, 'solid'), { x: 50, y: 25 }, 6, env)).toBe(
            true
        );
        expect(hitShape(e, { x: 50, y: 1 }, 6, env)).toBe(true);
        expect(hitShape(e, { x: 2, y: 2 }, 6, env)).toBe(false);
    });

    it('pen strokes hit along every segment', () => {
        const p = pen('p', {
            x: 10,
            y: 10,
            points: [
                [0, 0],
                [100, 0],
                [100, 100],
            ],
        });
        expect(hitShape(p, { x: 110, y: 60 }, 6, env)).toBe(true);
        expect(hitShape(p, { x: 60, y: 60 }, 6, env)).toBe(false);
    });

    it('a one-point pen stroke hits near the point', () => {
        const p = pen('p', { x: 10, y: 10, points: [[0, 0]] });
        expect(hitShape(p, { x: 13, y: 10 }, 6, env)).toBe(true);
        expect(hitShape(p, { x: 30, y: 10 }, 6, env)).toBe(false);
    });

    it('arrows hit along the shaft', () => {
        const a = arrow('a', { x: 0, y: 0, end: [0, 100] });
        expect(hitShape(a, { x: 3, y: 50 }, 6, env)).toBe(true);
    });

    it('notes and text hit anywhere inside', () => {
        expect(hitShape(note('n'), { x: 100, y: 100 }, 6, env)).toBe(true);
        const t = text('t', { text: 'Hello' });
        expect(hitShape(t, { x: 10, y: 10 }, 6, env)).toBe(true);
        expect(hitShape(t, { x: 300, y: 10 }, 6, env)).toBe(false);
    });
});

describe('text layout', () => {
    it('notes wrap to their width', () => {
        const n = note('n', { w: 200, text: 'aaaa bbbb cccc dddd eeee' });
        const lines = textLines(n, env);
        expect(lines.length).toBeGreaterThan(1);
        for (const l of lines) {
            expect(
                env.measure(l, textFont('m', env.family))
            ).toBeLessThanOrEqual(200 - 2 * NOTE_PADDING);
        }
        expect(lines.join(' ')).toBe('aaaa bbbb cccc dddd eeee');
    });

    it('notes keep paragraphs and give long words their own line', () => {
        const n = note('n', { w: 100, text: 'a\n\nabcdefghijklmnop b' });
        expect(textLines(n, env)).toEqual(['a', '', 'abcdefghijklmnop', 'b']);
    });

    it('text splits on newlines only', () => {
        expect(textLines(text('t', { text: 'one two\nthree' }), env)).toEqual([
            'one two',
            'three',
        ]);
    });

    it('text bounds grow with lines', () => {
        const one = shapeBounds(text('a', { text: 'a' }), env);
        const two = shapeBounds(text('b', { text: 'a\nb' }), env);
        expect(two.h).toBeCloseTo(one.h * 2);
        expect(one.h).toBeCloseTo(28 * LINE_HEIGHT);
    });

    it('fonts follow the size', () => {
        expect(textFont('l', 'Hand')).toBe('700 40px Hand');
    });
});

describe('shapeBounds', () => {
    it('includes half the stroke', () => {
        expect(
            shapeBounds(rect('a', { x: 0, y: 0, w: 10, h: 10 }), env)
        ).toEqual({
            x: -1.25,
            y: -1.25,
            w: 12.5,
            h: 12.5,
        });
    });

    it('covers pen points relative to the origin', () => {
        const b = shapeBounds(
            pen('p', {
                x: 100,
                y: 100,
                points: [
                    [-10, 5],
                    [20, -5],
                ],
            }),
            env
        );
        expect(b.x).toBeCloseTo(88.75);
        expect(b.y).toBeCloseTo(93.75);
        expect(b.w).toBeCloseTo(32.5);
    });

    it('covers both ends of a line drawn backwards', () => {
        const b = shapeBounds(line('l', { x: 50, y: 0, end: [-50, 20] }), env);
        expect(b.x).toBeLessThanOrEqual(0);
        expect(b.x + b.w).toBeGreaterThanOrEqual(50);
    });
});

describe('shapesInBox', () => {
    it('marquee selects only shapes fully inside', () => {
        const inside = rect('in', { x: 10, y: 10, w: 10, h: 10 });
        const across = rect('across', { x: 90, y: 10, w: 30, h: 10 });
        expect(
            shapesInBox(
                [inside, across],
                { x: 0, y: 0, w: 100, h: 100 },
                env
            ).map(s => s.id)
        ).toEqual(['in']);
    });
});

describe('points', () => {
    it('simplify keeps the ends and drops near-collinear points', () => {
        const points = Array.from(
            { length: 5000 },
            (_, i) => [i, Math.sin(i / 400) * 0.1] as [number, number]
        );
        const out = simplifyPoints(points, 0.5);
        expect(out[0]).toEqual(points[0]);
        expect(out.at(-1)).toEqual(points.at(-1));
        expect(out.length).toBeLessThan(100);
    });

    it('simplify keeps corners', () => {
        const out = simplifyPoints(
            [
                [0, 0],
                [50, 0],
                [100, 0],
                [100, 50],
                [100, 100],
            ],
            0.5
        );
        expect(out).toEqual([
            [0, 0],
            [100, 0],
            [100, 100],
        ]);
    });

    it('simplify handles a 50,000-point stroke quickly', () => {
        // A long wavy scribble: many kept points and deep, uneven splits
        const points = Array.from(
            { length: 50000 },
            (_, i) =>
                [i * 0.5, Math.sin(i / 50) * 40 + Math.sin(i / 7) * 3] as [
                    number,
                    number,
                ]
        );
        const started = performance.now();
        const out = simplifyPoints(points, 0.5);
        expect(performance.now() - started).toBeLessThan(1000);
        expect(out.length).toBeGreaterThan(1000);
        expect(out.length).toBeLessThan(points.length);
    });

    it('rounds to two decimals', () => {
        expect(roundPoints([[1.23456, -0.005]])).toEqual([[1.23, -0.01]]);
    });
});
