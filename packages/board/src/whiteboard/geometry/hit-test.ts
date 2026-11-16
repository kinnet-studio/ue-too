import type { Point } from '@ue-too/math';

import { STROKE_WIDTH, type Shape } from '../document/types';
import { shapeBounds } from './bounds';
import { type Box, boxContainsBox } from './box';
import type { TextEnv } from './text';

function distanceToSegment(
    p: Point,
    ax: number,
    ay: number,
    bx: number,
    by: number
): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t =
        lengthSq === 0
            ? 0
            : Math.max(
                  0,
                  Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / lengthSq)
              );
    return Math.hypot(p.x - (ax + t * dx), p.y - (ay + t * dy));
}

function inBox(p: Point, box: Box, pad = 0): boolean {
    return (
        p.x >= box.x - pad &&
        p.x <= box.x + box.w + pad &&
        p.y >= box.y - pad &&
        p.y <= box.y + box.h + pad
    );
}

// Distance from p to the rectangle's border, inside or out
function distanceToRectOutline(p: Point, box: Box): number {
    if (inBox(p, box)) {
        return Math.min(
            p.x - box.x,
            box.x + box.w - p.x,
            p.y - box.y,
            box.y + box.h - p.y
        );
    }
    const dx = Math.max(box.x - p.x, 0, p.x - (box.x + box.w));
    const dy = Math.max(box.y - p.y, 0, p.y - (box.y + box.h));
    return Math.hypot(dx, dy);
}

// Where p sits relative to an ellipse: k < 1 inside, 1 on it; and roughly how
// far it is from the outline, measured along the ray from the centre
function ellipseMeasure(p: Point, box: Box): { k: number; distance: number } {
    const rx = box.w / 2;
    const ry = box.h / 2;
    const dx = p.x - (box.x + rx);
    const dy = p.y - (box.y + ry);
    if (rx === 0 || ry === 0) {
        return { k: Infinity, distance: distanceToRectOutline(p, box) };
    }
    const k = Math.hypot(dx / rx, dy / ry);
    if (k === 0) return { k, distance: Math.min(rx, ry) };
    return { k, distance: Math.abs(1 - 1 / k) * Math.hypot(dx, dy) };
}

/**
 * Whether a world point hits a shape.
 *
 * @remarks
 * Strokes (lines, arrows, pen strokes, the outlines of unfilled rectangles
 * and ellipses) hit within `tolerance` of the stroke's edge. Filled
 * rectangles and ellipses, notes and text hit anywhere inside. `tolerance`
 * is in world units: pass screen pixels divided by the zoom.
 *
 * @group Whiteboard Geometry
 */
export function hitShape(
    shape: Shape,
    p: Point,
    tolerance: number,
    env: TextEnv
): boolean {
    const reach = tolerance + STROKE_WIDTH[shape.style.size] / 2;
    switch (shape.type) {
        case 'rect': {
            const box = { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
            if (shape.style.fill !== 'none' && inBox(p, box)) return true;
            return distanceToRectOutline(p, box) <= reach;
        }
        case 'ellipse': {
            const box = { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
            const { k, distance } = ellipseMeasure(p, box);
            if (shape.style.fill !== 'none' && k <= 1) return true;
            return distance <= reach;
        }
        case 'note':
        case 'text':
            return inBox(p, shapeBounds(shape, env), tolerance);
        case 'line':
        case 'arrow':
            return (
                distanceToSegment(
                    p,
                    shape.x,
                    shape.y,
                    shape.x + shape.end[0],
                    shape.y + shape.end[1]
                ) <= reach
            );
        case 'pen': {
            const points = shape.points;
            if (points.length === 1) {
                return (
                    Math.hypot(
                        p.x - (shape.x + points[0]![0]),
                        p.y - (shape.y + points[0]![1])
                    ) <= reach
                );
            }
            for (let i = 1; i < points.length; i++) {
                const [ax, ay] = points[i - 1]!;
                const [bx, by] = points[i]!;
                if (
                    distanceToSegment(
                        p,
                        shape.x + ax,
                        shape.y + ay,
                        shape.x + bx,
                        shape.y + by
                    ) <= reach
                ) {
                    return true;
                }
            }
            return false;
        }
        default: {
            const _exhaustive: never = shape;
            return _exhaustive;
        }
    }
}

/**
 * The shapes lying entirely inside a box, as a marquee selects them.
 *
 * @group Whiteboard Geometry
 */
export function shapesInBox(
    shapes: readonly Shape[],
    box: Box,
    env: TextEnv
): Shape[] {
    return shapes.filter(shape => boxContainsBox(box, shapeBounds(shape, env)));
}
