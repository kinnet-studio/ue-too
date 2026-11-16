import { describe, expect, it } from 'vitest';

import type { Shape } from '../../src/whiteboard/document/types';
import { shapeBounds } from '../../src/whiteboard/geometry/bounds';
import { seededRandom } from '../../src/whiteboard/render/random';
import { noteTilt, sketchShape } from '../../src/whiteboard/render/sketch';
import { arrow, ellipse, env, line, note, pen, rect, text } from './shapes';

const withFill = <T extends Shape>(
    shape: T,
    fill: 'none' | 'hachure' | 'solid'
): T => ({
    ...shape,
    style: { ...shape.style, fill },
});

function sampleShapes(): Shape[] {
    const at = { x: 37, y: -52 };
    return [
        ...(['none', 'hachure', 'solid'] as const).flatMap(fill => [
            withFill(rect(`r-${fill}`, { ...at, w: 160, h: 90 }), fill),
            withFill(ellipse(`e-${fill}`, { ...at, w: 160, h: 90 }), fill),
        ]),
        arrow('a', { ...at, end: [140, 60] }),
        line('l', { ...at, end: [-80, 120] }),
        pen('p', {
            ...at,
            points: Array.from(
                { length: 30 },
                (_, i) => [i * 4, Math.sin(i / 3) * 20] as [number, number]
            ),
        }),
        pen('dot', { ...at, points: [[0, 0]] }),
        note('n', at),
        text('t', at),
    ];
}

describe('seededRandom', () => {
    it('repeats for a seed and stays in [0, 1)', () => {
        const a = seededRandom(42);
        const b = seededRandom(42);
        for (let i = 0; i < 100; i++) {
            const value = a();
            expect(value).toBe(b());
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
        expect(seededRandom(1)()).not.toBe(seededRandom(2)());
    });
});

describe('sketchShape', () => {
    it('is a pure function of the record', () => {
        for (const shape of sampleShapes()) {
            expect(sketchShape(shape)).toEqual(
                sketchShape(structuredClone(shape))
            );
        }
    });

    it('the seed changes the wobble', () => {
        const a = rect('a', { seed: 1 });
        expect(sketchShape(a)).not.toEqual(sketchShape({ ...a, seed: 2 }));
    });

    it('stays near the shape', () => {
        for (const shape of sampleShapes()) {
            const b = shapeBounds(shape, env);
            const margin = 6;
            for (const part of sketchShape(shape)) {
                for (const op of part.ops) {
                    for (let i = 1; i < op.length; i += 2) {
                        const x = op[i] as number;
                        const y = op[i + 1] as number;
                        expect(x).toBeGreaterThanOrEqual(b.x - margin);
                        expect(x).toBeLessThanOrEqual(b.x + b.w + margin);
                        expect(y).toBeGreaterThanOrEqual(b.y - margin);
                        expect(y).toBeLessThanOrEqual(b.y + b.h + margin);
                    }
                }
            }
        }
    });

    it('fills only when asked', () => {
        const r = rect('a');
        expect(sketchShape(r).map(p => p.role)).toEqual(['outline']);
        expect(
            sketchShape(withFill(r, 'hachure'))
                .map(p => p.role)
                .sort()
        ).toEqual(['hachure', 'outline']);
        expect(
            sketchShape(withFill(r, 'solid'))
                .map(p => p.role)
                .sort()
        ).toEqual(['outline', 'solid']);
        const e = ellipse('e');
        expect(
            sketchShape(withFill(e, 'hachure'))
                .map(p => p.role)
                .sort()
        ).toEqual(['hachure', 'outline']);
    });

    it('draws fills before outlines', () => {
        const parts = sketchShape(withFill(rect('a'), 'solid'));
        expect(parts.map(p => p.role)).toEqual(['solid', 'outline']);
        expect(parts[0]!.kind).toBe('fill');
        expect(parts[1]!.kind).toBe('stroke');
    });

    it('hatches with several clipped lines', () => {
        const hachure = sketchShape(
            withFill(rect('a', { w: 160, h: 90 }), 'hachure')
        ).find(p => p.role === 'hachure')!;
        expect(hachure.ops.filter(op => op[0] === 'M').length).toBeGreaterThan(
            10
        );
    });

    it('text has no sketch and notes are paper', () => {
        expect(sketchShape(text('t'))).toEqual([]);
        const parts = sketchShape(note('n'));
        expect(parts.map(p => [p.kind, p.role])).toEqual([['fill', 'paper']]);
    });

    it('a one-point pen stroke still draws', () => {
        const ops = sketchShape(pen('p', { points: [[0, 0]] }))[0]!.ops;
        expect(ops.length).toBe(2);
    });

    it('note tilt is small and stable', () => {
        for (let seed = 0; seed < 50; seed++) {
            const n = note('n', { seed });
            expect(Math.abs(noteTilt(n))).toBeLessThanOrEqual(0.035);
            expect(noteTilt(n)).toBe(noteTilt({ ...n }));
        }
    });
});
