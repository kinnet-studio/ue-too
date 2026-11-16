/**
 * An axis-aligned box in world units: top-left corner, width and height.
 *
 * @group Whiteboard Geometry
 */
export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * The box with corners at two points, whichever way round they are.
 *
 * @group Whiteboard Geometry
 */
export function normalizeBox(
    x1: number,
    y1: number,
    x2: number,
    y2: number
): Box {
    return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        w: Math.abs(x2 - x1),
        h: Math.abs(y2 - y1),
    };
}

/**
 * The smallest box around all of `boxes`, or null when there are none.
 *
 * @group Whiteboard Geometry
 */
export function unionBoxes(boxes: Box[]): Box | null {
    if (boxes.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const box of boxes) {
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.w);
        maxY = Math.max(maxY, box.y + box.h);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Whether `inner` lies entirely inside `outer`.
 *
 * @group Whiteboard Geometry
 */
export function boxContainsBox(outer: Box, inner: Box): boolean {
    return (
        inner.x >= outer.x &&
        inner.y >= outer.y &&
        inner.x + inner.w <= outer.x + outer.w &&
        inner.y + inner.h <= outer.y + outer.h
    );
}

/**
 * Whether two boxes share any area.
 *
 * @group Whiteboard Geometry
 */
export function boxesOverlap(a: Box, b: Box): boolean {
    return (
        a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
    );
}
