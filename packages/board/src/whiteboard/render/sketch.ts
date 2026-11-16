import {
    type NoteShape,
    STROKE_WIDTH,
    type Shape,
    type ShapeSize,
} from '../document/types';
import type { Box } from '../geometry/box';
import { seededRandom } from './random';

/**
 * One path command in world units: move, line, cubic Bézier, close.
 *
 * @group Whiteboard Rendering
 */
export type PathOp =
    | ['M', number, number]
    | ['L', number, number]
    | ['C', number, number, number, number, number, number]
    | ['Z'];

/**
 * One path of a sketched shape and how to paint it.
 *
 * @remarks
 * `outline` and `hachure` are stroked in the shape's colour, `solid` is
 * filled in its colour at low opacity, `paper` is a note's sheet.
 *
 * @group Whiteboard Rendering
 */
export interface SketchPart {
    kind: 'stroke' | 'fill';
    role: 'outline' | 'hachure' | 'solid' | 'paper';
    ops: PathOp[];
}

type Random = () => number;
type Pair = [number, number];

const HACHURE_ANGLE = (-41 * Math.PI) / 180;
const ARROW_HEAD_ANGLE = 0.5;
const NOTE_JITTER = 1.8;
const MAX_NOTE_TILT = 0.035;

const spread = (rnd: Random, amount: number) => (rnd() * 2 - 1) * amount;

// A hand-drawn line: each pass is a Bézier with both ends nudged and the
// middle bowed a little to one side
function roughLine(
    ops: PathOp[],
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    rnd: Random,
    roughness = 1,
    passes = 2
): void {
    const length = Math.hypot(x2 - x1, y2 - y1) || 1;
    const offset = roughness * Math.min(2.4, length * 0.05 + 0.6);
    const nx = -(y2 - y1) / length;
    const ny = (x2 - x1) / length;
    for (let pass = 0; pass < passes; pass++) {
        const o = pass === 0 ? offset : offset * 1.4;
        const bow = spread(rnd, Math.min(length * 0.012, 3) * roughness);
        const sx = x1 + spread(rnd, o);
        const sy = y1 + spread(rnd, o);
        const ex = x2 + spread(rnd, o);
        const ey = y2 + spread(rnd, o);
        ops.push(
            ['M', sx, sy],
            [
                'C',
                sx + (ex - sx) * 0.35 + nx * bow + spread(rnd, o * 0.4),
                sy + (ey - sy) * 0.35 + ny * bow + spread(rnd, o * 0.4),
                sx + (ex - sx) * 0.7 + nx * bow + spread(rnd, o * 0.4),
                sy + (ey - sy) * 0.7 + ny * bow + spread(rnd, o * 0.4),
                ex,
                ey,
            ]
        );
    }
}

// A smooth curve through points (Catmull-Rom turned into Béziers)
function curveThrough(ops: PathOp[], points: Pair[]): void {
    ops.push(['M', points[0]![0], points[0]![1]]);
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] ?? points[i]!;
        const p1 = points[i]!;
        const p2 = points[i + 1]!;
        const p3 = points[i + 2] ?? p2;
        ops.push([
            'C',
            p1[0] + (p2[0] - p0[0]) / 6,
            p1[1] + (p2[1] - p0[1]) / 6,
            p2[0] - (p3[0] - p1[0]) / 6,
            p2[1] - (p3[1] - p1[1]) / 6,
            p2[0],
            p2[1],
        ]);
    }
}

function ellipsePoints(
    box: Box,
    rnd: Random,
    turn: number,
    jitter: number
): Pair[] {
    const rx = box.w / 2;
    const ry = box.h / 2;
    const cx = box.x + rx;
    const cy = box.y + ry;
    const count = 18;
    const start = rnd() * Math.PI * 2;
    const points: Pair[] = [];
    for (let i = 0; i <= count; i++) {
        const t = start + (turn * i) / count;
        const k = 1 + spread(rnd, jitter);
        points.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]);
    }
    return points;
}

// Drawn twice, each a little past a full turn so the ends overlap
function roughEllipse(ops: PathOp[], box: Box, rnd: Random): void {
    for (let pass = 0; pass < 2; pass++) {
        const overlap = 0.25 + rnd() * 0.25;
        curveThrough(ops, ellipsePoints(box, rnd, Math.PI * 2 + overlap, 0.03));
    }
}

function jitteredPolygon(
    points: Pair[],
    amount: number,
    rnd: Random
): PathOp[] {
    const ops: PathOp[] = points.map(([x, y], i) => [
        i === 0 ? 'M' : 'L',
        x + spread(rnd, amount),
        y + spread(rnd, amount),
    ]) as PathOp[];
    ops.push(['Z']);
    return ops;
}

// Clips the segment a→b to a box (Liang–Barsky); null when it misses
function clipToBox(a: Pair, b: Pair, box: Box): [Pair, Pair] | null {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    let t0 = 0;
    let t1 = 1;
    const edges: [number, number][] = [
        [-dx, a[0] - box.x],
        [dx, box.x + box.w - a[0]],
        [-dy, a[1] - box.y],
        [dy, box.y + box.h - a[1]],
    ];
    for (const [p, q] of edges) {
        if (p === 0) {
            if (q < 0) return null;
            continue;
        }
        const t = q / p;
        if (p < 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
        if (t0 > t1) return null;
    }
    return [
        [a[0] + dx * t0, a[1] + dy * t0],
        [a[0] + dx * t1, a[1] + dy * t1],
    ];
}

// Clips the segment a→b to the ellipse inscribed in a box
function clipToEllipse(a: Pair, b: Pair, box: Box): [Pair, Pair] | null {
    const rx = box.w / 2;
    const ry = box.h / 2;
    if (rx === 0 || ry === 0) return null;
    const cx = box.x + rx;
    const cy = box.y + ry;
    const ua = (a[0] - cx) / rx;
    const va = (a[1] - cy) / ry;
    const du = (b[0] - a[0]) / rx;
    const dv = (b[1] - a[1]) / ry;
    const qa = du * du + dv * dv;
    const qb = 2 * (ua * du + va * dv);
    const qc = ua * ua + va * va - 1;
    const discriminant = qb * qb - 4 * qa * qc;
    if (qa === 0 || discriminant <= 0) return null;
    const root = Math.sqrt(discriminant);
    const t0 = Math.max(0, (-qb - root) / (2 * qa));
    const t1 = Math.min(1, (-qb + root) / (2 * qa));
    if (t0 >= t1) return null;
    const at = (t: number): Pair => [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
    ];
    return [at(t0), at(t1)];
}

// Parallel strokes across the shape, each clipped to it
function hachure(
    box: Box,
    size: ShapeSize,
    clip: (a: Pair, b: Pair, box: Box) => [Pair, Pair] | null,
    rnd: Random
): PathOp[] {
    const ops: PathOp[] = [];
    const gap = 4 + 2 * STROKE_WIDTH[size];
    const dx = Math.cos(HACHURE_ANGLE);
    const dy = Math.sin(HACHURE_ANGLE);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const half = Math.hypot(box.w, box.h) / 2 + gap;
    for (let d = -half; d <= half; d += gap) {
        const ox = cx - dy * d;
        const oy = cy + dx * d;
        const segment = clip(
            [ox - dx * half, oy - dy * half],
            [ox + dx * half, oy + dy * half],
            box
        );
        if (!segment) continue;
        const [[x1, y1], [x2, y2]] = segment;
        roughLine(ops, x1, y1, x2, y2, rnd, 0.6, 1);
    }
    return ops;
}

function smooth(points: Pair[]): Pair[] {
    return points.map((p, i) => {
        const a = points[Math.max(0, i - 1)]!;
        const c = points[Math.min(points.length - 1, i + 1)]!;
        return [(a[0] + 2 * p[0] + c[0]) / 4, (a[1] + 2 * p[1] + c[1]) / 4];
    });
}

// A smoothed stroke through the pen's points, joined by midpoints; a hand
// stroke is already hand-drawn, so no wobble is added
function penOps(shape: Extract<Shape, { type: 'pen' }>): PathOp[] {
    const points = smooth(
        shape.points.map(([x, y]): Pair => [shape.x + x, shape.y + y])
    );
    const first = points[0]!;
    if (points.length === 1) {
        return [
            ['M', first[0], first[1]],
            ['L', first[0] + 0.01, first[1]],
        ];
    }
    const ops: PathOp[] = [['M', first[0], first[1]]];
    let current = first;
    for (let i = 1; i < points.length - 1; i++) {
        const control = points[i]!;
        const next = points[i + 1]!;
        const end: Pair = [
            (control[0] + next[0]) / 2,
            (control[1] + next[1]) / 2,
        ];
        // A quadratic through `control`, written as the matching cubic
        ops.push([
            'C',
            current[0] + ((control[0] - current[0]) * 2) / 3,
            current[1] + ((control[1] - current[1]) * 2) / 3,
            end[0] + ((control[0] - end[0]) * 2) / 3,
            end[1] + ((control[1] - end[1]) * 2) / 3,
            end[0],
            end[1],
        ]);
        current = end;
    }
    const last = points[points.length - 1]!;
    ops.push(['L', last[0], last[1]]);
    return ops;
}

function boxCorners(box: Box): Pair[] {
    return [
        [box.x, box.y],
        [box.x + box.w, box.y],
        [box.x + box.w, box.y + box.h],
        [box.x, box.y + box.h],
    ];
}

/**
 * The hand-drawn paths for a shape, in world units, fills first.
 *
 * @remarks
 * A pure function of the record: all of its randomness comes from the
 * shape's seed, so a shape looks the same every frame and for everyone.
 * Text has no paths (it is drawn with the handwriting font instead).
 *
 * @group Whiteboard Rendering
 */
export function sketchShape(shape: Shape): SketchPart[] {
    const rnd = seededRandom(shape.seed);
    switch (shape.type) {
        case 'rect':
        case 'ellipse': {
            const box = { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
            const isRect = shape.type === 'rect';
            const parts: SketchPart[] = [];
            if (shape.style.fill === 'hachure') {
                parts.push({
                    kind: 'stroke',
                    role: 'hachure',
                    ops: hachure(
                        box,
                        shape.style.size,
                        isRect ? clipToBox : clipToEllipse,
                        rnd
                    ),
                });
            } else if (shape.style.fill === 'solid') {
                const ops: PathOp[] = [];
                if (isRect)
                    ops.push(...jitteredPolygon(boxCorners(box), 1, rnd));
                else {
                    curveThrough(
                        ops,
                        ellipsePoints(box, rnd, Math.PI * 2, 0.02)
                    );
                    ops.push(['Z']);
                }
                parts.push({ kind: 'fill', role: 'solid', ops });
            }
            const outline: PathOp[] = [];
            if (isRect) {
                const corners = boxCorners(box);
                for (let i = 0; i < 4; i++) {
                    const [ax, ay] = corners[i]!;
                    const [bx, by] = corners[(i + 1) % 4]!;
                    roughLine(outline, ax, ay, bx, by, rnd);
                }
            } else {
                roughEllipse(outline, box, rnd);
            }
            parts.push({ kind: 'stroke', role: 'outline', ops: outline });
            return parts;
        }
        case 'line':
        case 'arrow': {
            const ops: PathOp[] = [];
            const x2 = shape.x + shape.end[0];
            const y2 = shape.y + shape.end[1];
            roughLine(ops, shape.x, shape.y, x2, y2, rnd);
            if (shape.type === 'arrow') {
                const length = Math.hypot(shape.end[0], shape.end[1]);
                const head = Math.min(20, length * 0.3);
                const angle = Math.atan2(shape.end[1], shape.end[0]);
                for (const side of [-1, 1]) {
                    const a = angle + side * ARROW_HEAD_ANGLE;
                    roughLine(
                        ops,
                        x2 - Math.cos(a) * head,
                        y2 - Math.sin(a) * head,
                        x2,
                        y2,
                        rnd,
                        0.7
                    );
                }
            }
            return [{ kind: 'stroke', role: 'outline', ops }];
        }
        case 'pen':
            return [{ kind: 'stroke', role: 'outline', ops: penOps(shape) }];
        case 'note':
            return [
                {
                    kind: 'fill',
                    role: 'paper',
                    ops: jitteredPolygon(
                        boxCorners({
                            x: shape.x,
                            y: shape.y,
                            w: shape.w,
                            h: shape.h,
                        }),
                        NOTE_JITTER,
                        rnd
                    ),
                },
            ];
        case 'text':
            return [];
        default: {
            const _exhaustive: never = shape;
            return _exhaustive;
        }
    }
}

/**
 * The small tilt a note is drawn with, in radians, taken from its seed.
 *
 * @group Whiteboard Rendering
 */
export function noteTilt(shape: NoteShape): number {
    return spread(seededRandom(shape.seed + 1), MAX_NOTE_TILT);
}
