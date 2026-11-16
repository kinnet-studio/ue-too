import type { Point } from '@ue-too/math';

import type { WhiteboardDocument } from '../document/document';
import type { Shape } from '../document/types';
import { shapeBounds } from '../geometry/bounds';
import { type Box, normalizeBox, unionBoxes } from '../geometry/box';
import type { TextEnv } from '../geometry/text';
import type { Handle, HandleId } from '../render/overlay';

/**
 * Which shapes are selected.
 *
 * @group Whiteboard Editor
 */
export class Selection {
    private _ids: readonly string[] = [];
    private readonly _listeners = new Set<() => void>();

    /** The selected ids, in the order they were selected */
    get ids(): readonly string[] {
        return this._ids;
    }

    has(id: string): boolean {
        return this._ids.includes(id);
    }

    /** Selects exactly these ids */
    set(ids: string[]): void {
        const next = [...new Set(ids)];
        if (
            next.length === this._ids.length &&
            next.every((id, i) => id === this._ids[i])
        ) {
            return;
        }
        this._ids = next;
        this.notify();
    }

    /** Adds the id, or removes it when it is already selected */
    toggle(id: string): void {
        this.set(
            this.has(id)
                ? this._ids.filter(other => other !== id)
                : [...this._ids, id]
        );
    }

    clear(): void {
        this.set([]);
    }

    /** Drops ids no longer in the document (after an undo or an erase) */
    prune(doc: WhiteboardDocument): void {
        this.set(this._ids.filter(id => doc.get(id) !== undefined));
    }

    /**
     * Listens for selection changes.
     *
     * @returns A function that stops the listener
     */
    subscribe(listener: () => void): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    private notify(): void {
        for (const listener of [...this._listeners]) listener();
    }
}

type Pair = [number, number];

const BOX_HANDLES: Record<string, { x: 0 | 0.5 | 1; y: 0 | 0.5 | 1 }> = {
    nw: { x: 0, y: 0 },
    n: { x: 0.5, y: 0 },
    ne: { x: 1, y: 0 },
    e: { x: 1, y: 0.5 },
    se: { x: 1, y: 1 },
    s: { x: 0.5, y: 1 },
    sw: { x: 0, y: 1 },
    w: { x: 0, y: 0.5 },
};

// How close, in screen pixels, a press has to be to a handle's centre
const HANDLE_REACH_PX = 8;

function pointsFrame(x: number, y: number, points: Pair[]): Box {
    const xs = points.map(p => x + p[0]);
    const ys = points.map(p => y + p[1]);
    return normalizeBox(
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs),
        Math.max(...ys)
    );
}

/** A shape's geometry without its stroke: what selection boxes and resizing use */
function shapeFrame(shape: Shape, env: TextEnv): Box {
    switch (shape.type) {
        case 'rect':
        case 'ellipse':
        case 'note':
            return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
        case 'line':
        case 'arrow':
            return pointsFrame(shape.x, shape.y, [[0, 0], shape.end]);
        case 'pen':
            return pointsFrame(shape.x, shape.y, shape.points);
        case 'text':
            return shapeBounds(shape, env);
    }
}

/**
 * The box around the selected shapes' geometry, or null with none selected.
 *
 * @group Whiteboard Editor
 */
export function selectionBox(shapes: Shape[], env: TextEnv): Box | null {
    return unionBoxes(shapes.map(shape => shapeFrame(shape, env)));
}

/**
 * The handles a selection offers: both ends of a single line or arrow, none
 * for a single text shape, otherwise the corners and edges of the box.
 *
 * @group Whiteboard Editor
 */
export function handlesFor(shapes: Shape[], env: TextEnv): Handle[] {
    const only = shapes.length === 1 ? shapes[0]! : null;
    if (only?.type === 'line' || only?.type === 'arrow') {
        return [
            { id: 'start', x: only.x, y: only.y },
            { id: 'end', x: only.x + only.end[0], y: only.y + only.end[1] },
        ];
    }
    if (only?.type === 'text') return [];
    const box = selectionBox(shapes, env);
    if (!box) return [];
    return Object.entries(BOX_HANDLES).map(([id, at]) => ({
        id: id as HandleId,
        x: box.x + box.w * at.x,
        y: box.y + box.h * at.y,
    }));
}

/**
 * The handle under a world point, within 8 screen pixels whatever the zoom.
 *
 * @group Whiteboard Editor
 */
export function handleAt(
    handles: Handle[],
    world: Point,
    zoom: number
): HandleId | null {
    const reach = HANDLE_REACH_PX / zoom;
    for (const handle of handles) {
        if (
            Math.abs(world.x - handle.x) <= reach &&
            Math.abs(world.y - handle.y) <= reach
        ) {
            return handle.id;
        }
    }
    return null;
}

/**
 * The box after dragging one of its handles by `delta`.
 *
 * @remarks
 * Dragging past the opposite edge flips the box rather than giving it a
 * negative size. `keepAspect` (Shift) holds the box's proportions when a
 * corner is dragged.
 *
 * @group Whiteboard Editor
 */
export function resizeBox(
    start: Box,
    handle: HandleId,
    delta: Point,
    keepAspect: boolean
): Box {
    const at = BOX_HANDLES[handle];
    if (!at) return start;
    let left = start.x;
    let right = start.x + start.w;
    let top = start.y;
    let bottom = start.y + start.h;
    if (at.x === 0) left += delta.x;
    if (at.x === 1) right += delta.x;
    if (at.y === 0) top += delta.y;
    if (at.y === 1) bottom += delta.y;
    const corner = at.x !== 0.5 && at.y !== 0.5;
    if (keepAspect && corner && start.w > 0 && start.h > 0) {
        const sx = (right - left) / start.w;
        const sy = (bottom - top) / start.h;
        const scale = Math.max(Math.abs(sx), Math.abs(sy));
        const w = (sx < 0 ? -1 : 1) * scale * start.w;
        const h = (sy < 0 ? -1 : 1) * scale * start.h;
        if (at.x === 0) left = right - w;
        else right = left + w;
        if (at.y === 0) top = bottom - h;
        else bottom = top + h;
    }
    return normalizeBox(left, top, right, bottom);
}

/**
 * A shape fitted from one box into another: positions, sizes, line ends and
 * pen points scale with the box; text moves but keeps its size.
 *
 * @group Whiteboard Editor
 */
export function resizeShape(shape: Shape, from: Box, to: Box): Shape {
    const sx = from.w === 0 ? 1 : to.w / from.w;
    const sy = from.h === 0 ? 1 : to.h / from.h;
    const mapX = (x: number) => to.x + (x - from.x) * sx;
    const mapY = (y: number) => to.y + (y - from.y) * sy;
    const moved = { x: mapX(shape.x), y: mapY(shape.y) };
    switch (shape.type) {
        case 'rect':
        case 'ellipse':
        case 'note':
            return { ...shape, ...moved, w: shape.w * sx, h: shape.h * sy };
        case 'line':
        case 'arrow':
            return {
                ...shape,
                ...moved,
                end: [
                    mapX(shape.x + shape.end[0]) - moved.x,
                    mapY(shape.y + shape.end[1]) - moved.y,
                ],
            };
        case 'pen':
            return {
                ...shape,
                ...moved,
                points: shape.points.map(([x, y]): Pair => [x * sx, y * sy]),
            };
        case 'text':
            return { ...shape, ...moved };
    }
}
