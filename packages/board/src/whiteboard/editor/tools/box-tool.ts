import type { Point } from '@ue-too/math';

import type { EllipseShape, RectShape } from '../../document/types';
import { normalizeBox } from '../../geometry/box';
import type { ToolPointer } from '../events';
import {
    type ToolContext,
    type ToolMachine,
    createToolMachine,
} from '../tool-context';
import { cancelGesture, newShape } from './shared';

type BoxStates = 'IDLE' | 'CREATING';

// A click without a drag makes a shape this size, centred on the click
const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 100;

/** The box from `start` to `end`; with `square`, its sides are equal and it keeps the drag's direction */
function dragBox(start: Point, end: Point, square: boolean) {
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    if (square) {
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        dx = (dx < 0 ? -1 : 1) * side;
        dy = (dy < 0 ? -1 : 1) * side;
    }
    return normalizeBox(start.x, start.y, start.x + dx, start.y + dy);
}

/**
 * The rectangle and ellipse tools: drag from corner to corner (Shift for a
 * square or circle), or click for a default-sized shape. Afterwards the
 * editor switches to Select with the new shape selected.
 *
 * @group Whiteboard Editor
 */
export function createBoxTool(
    context: ToolContext,
    type: 'rect' | 'ellipse'
): ToolMachine<BoxStates> {
    let start: Point = { x: 0, y: 0 };
    let shape: RectShape | EllipseShape | null = null;

    const resize = (ctx: ToolContext, p: ToolPointer) => {
        if (!shape || !p.dragging) return;
        const box = dragBox(start, p.world, p.shiftKey);
        shape = { ...shape, x: box.x, y: box.y, w: box.w, h: box.h };
        ctx.doc.put(shape);
    };

    return createToolMachine<BoxStates>(
        context,
        {
            IDLE: {
                enter: ctx => ctx.setCursor('crosshair'),
                reactions: {
                    pointerDown: {
                        action: (ctx, p) => {
                            ctx.history.begin();
                            start = p.world;
                            shape = {
                                ...newShape(ctx, type, start.x, start.y),
                                w: 0,
                                h: 0,
                            };
                            ctx.doc.put(shape);
                        },
                        defaultTargetState: 'CREATING',
                    },
                },
            },
            CREATING: {
                reactions: {
                    pointerMove: { action: resize },
                    pointerUp: {
                        action: (ctx, p) => {
                            if (!shape) return;
                            if (p.dragging) resize(ctx, p);
                            else {
                                shape = {
                                    ...shape,
                                    x: start.x - DEFAULT_WIDTH / 2,
                                    y: start.y - DEFAULT_HEIGHT / 2,
                                    w: DEFAULT_WIDTH,
                                    h: DEFAULT_HEIGHT,
                                };
                                ctx.doc.put(shape);
                            }
                            ctx.history.end();
                            ctx.requestTool('select', [shape.id]);
                            shape = null;
                        },
                        defaultTargetState: 'IDLE',
                    },
                    cancel: cancelGesture,
                },
            },
        },
        'IDLE'
    );
}
