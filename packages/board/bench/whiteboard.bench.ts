/**
 * Whiteboard rendering benchmark: a busy board (500 shapes, 50,000 pen
 * points) sketched cold, then painted warm from the path cache.
 *
 * Usage: bun run bench/whiteboard.bench.ts (from packages/board)
 *
 * It measures the JavaScript work of a frame with a no-op canvas, not
 * rasterizing. Exits 1 when a warm frame's median passes the 4 ms budget
 * (a quarter of the 16.7 ms a 60 FPS frame has).
 */
import type { Shape, ShapeFill } from '../src/whiteboard/document/types';
import { ShapePainter } from '../src/whiteboard/render/painter';
import { sketchShape } from '../src/whiteboard/render/sketch';
import { DEFAULT_THEME } from '../src/whiteboard/render/theme';

const RUNS = 20;
const WARM_BUDGET_MS = 4;

const noop = () => {};
const ctx = new Proxy({ globalAlpha: 1 } as Record<string, unknown>, {
    get: (target, key: string) => (key in target ? target[key] : noop),
    set: (target, key: string, value) => ((target[key] = value), true),
}) as unknown as CanvasRenderingContext2D;
const path = () =>
    ({
        moveTo: noop,
        lineTo: noop,
        bezierCurveTo: noop,
        closePath: noop,
    }) as unknown as Path2D;
const env = { measure: (text: string) => text.length * 14, family: 'Caveat' };

function board(): Shape[] {
    const shapes: Shape[] = [];
    let n = 0;
    const base = () => ({
        id: `s${n}`,
        x: (n % 25) * 120,
        y: Math.floor(n / 25) * 120,
        rotation: 0,
        index: `a${String(n).padStart(4, '0')}`,
        seed: n++,
    });
    const fills: ShapeFill[] = ['none', 'hachure', 'solid'];
    for (let i = 0; i < 100; i++) {
        shapes.push({
            ...base(),
            type: i % 2 ? 'rect' : 'ellipse',
            w: 100,
            h: 70,
            style: { color: 'ink', size: 'm', fill: fills[i % 3]! },
        });
    }
    for (let i = 0; i < 50; i++) {
        shapes.push({
            ...base(),
            type: 'note',
            w: 200,
            h: 200,
            text: 'Remember to try the eraser on this one',
            style: { color: 'ink', size: 'm', fill: 'none' },
        });
        shapes.push({
            ...base(),
            type: 'arrow',
            end: [90, 40],
            style: { color: 'blue', size: 'm', fill: 'none' },
        });
    }
    for (let i = 0; i < 300; i++) {
        shapes.push({
            ...base(),
            type: 'pen',
            points: Array.from(
                { length: 167 },
                (_, k) =>
                    [k * 0.6, Math.sin(k / 9 + i) * 20] as [number, number]
            ),
            style: { color: 'red', size: 's', fill: 'none' },
        });
    }
    return shapes;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)]!;
}

const shapes = board();
const points = shapes.reduce(
    (sum, s) => sum + (s.type === 'pen' ? s.points.length : 0),
    0
);

const cold: number[] = [];
for (let run = 0; run < RUNS; run++) {
    const started = performance.now();
    for (const shape of shapes) sketchShape(shape);
    cold.push(performance.now() - started);
}

const painter = new ShapePainter({ createPath: path });
for (const shape of shapes) painter.paint(ctx, shape, DEFAULT_THEME, env);
const warm: number[] = [];
for (let run = 0; run < RUNS; run++) {
    const started = performance.now();
    for (const shape of shapes) painter.paint(ctx, shape, DEFAULT_THEME, env);
    warm.push(performance.now() - started);
}

console.log(`${shapes.length} shapes, ${points} pen points, ${RUNS} runs`);
console.log(`sketch every shape (cold): median ${median(cold).toFixed(2)} ms`);
console.log(
    `paint every shape (warm):  median ${median(warm).toFixed(2)} ms (budget ${WARM_BUDGET_MS} ms)`
);
if (median(warm) > WARM_BUDGET_MS) process.exit(1);
