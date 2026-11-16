type Pair = [number, number];

function distanceToLine(p: Pair, a: Pair, b: Pair): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / length;
}

/**
 * Drops points that stray less than `tolerance` from the line through their
 * neighbours (Ramer–Douglas–Peucker), keeping both ends.
 *
 * @remarks
 * Iterative, so very long strokes can't overflow the call stack.
 *
 * @group Whiteboard Geometry
 */
export function simplifyPoints(points: Pair[], tolerance: number): Pair[] {
    if (points.length < 3) return points.slice();
    const keep = new Uint8Array(points.length);
    keep[0] = 1;
    keep[points.length - 1] = 1;
    const stack: [number, number][] = [[0, points.length - 1]];
    while (stack.length > 0) {
        const [first, last] = stack.pop()!;
        let farthest = -1;
        let farthestDistance = tolerance;
        for (let i = first + 1; i < last; i++) {
            const distance = distanceToLine(
                points[i]!,
                points[first]!,
                points[last]!
            );
            if (distance > farthestDistance) {
                farthest = i;
                farthestDistance = distance;
            }
        }
        if (farthest !== -1) {
            keep[farthest] = 1;
            stack.push([first, farthest], [farthest, last]);
        }
    }
    return points.filter((_, i) => keep[i] === 1);
}

function round(value: number, factor: number): number {
    return (
        (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor || 0
    );
}

/**
 * Rounds every coordinate to `decimals` places (half away from zero), to keep
 * saved drawings small.
 *
 * @group Whiteboard Geometry
 */
export function roundPoints(points: Pair[], decimals = 2): Pair[] {
    const factor = 10 ** decimals;
    return points.map(([x, y]) => [round(x, factor), round(y, factor)]);
}
