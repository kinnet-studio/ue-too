import type { Point } from '@ue-too/math';

import { hitShape } from '../../geometry/hit-test';
import { HIT_TOLERANCE_PX } from '../events';
import {
    type ToolContext,
    type ToolMachine,
    createToolMachine,
} from '../tool-context';

type EraserStates = 'IDLE' | 'ERASING';

/** Marks every shape the path from `from` to `to` touches, sampled finely enough not to skip any */
function markAlong(context: ToolContext, from: Point, to: Point): void {
    const tolerance = HIT_TOLERANCE_PX / context.zoom();
    const steps = Math.max(
        1,
        Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / tolerance)
    );
    const shapes = context.doc.all();
    for (let i = 1; i <= steps; i++) {
        const point = {
            x: from.x + ((to.x - from.x) * i) / steps,
            y: from.y + ((to.y - from.y) * i) / steps,
        };
        for (const shape of shapes) {
            if (hitShape(shape, point, tolerance, context.env)) {
                context.overlay.erasing.add(shape.id);
            }
        }
    }
}

/**
 * The eraser: drag across shapes to mark them (they fade), release to
 * delete them all as one undo step; a tap deletes the topmost shape. It
 * stays picked.
 *
 * @group Whiteboard Editor
 */
export function createEraserTool(
    context: ToolContext
): ToolMachine<EraserStates> {
    let last: Point = { x: 0, y: 0 };

    return createToolMachine<EraserStates>(
        context,
        {
            IDLE: {
                enter: ctx => ctx.setCursor('crosshair'),
                reactions: {
                    pointerDown: {
                        action: (ctx, p) => {
                            last = p.world;
                            const shape = ctx.shapeAt(p.world);
                            if (shape) ctx.overlay.erasing.add(shape.id);
                        },
                        defaultTargetState: 'ERASING',
                    },
                },
            },
            ERASING: {
                reactions: {
                    pointerMove: {
                        action: (ctx, p) => {
                            markAlong(ctx, last, p.world);
                            last = p.world;
                        },
                    },
                    pointerUp: {
                        action: ctx => {
                            const marked = [...ctx.overlay.erasing];
                            ctx.overlay.erasing.clear();
                            if (marked.length > 0) ctx.doc.remove(marked);
                        },
                        defaultTargetState: 'IDLE',
                    },
                    cancel: {
                        action: ctx => ctx.overlay.erasing.clear(),
                        defaultTargetState: 'IDLE',
                    },
                },
            },
        },
        'IDLE'
    );
}
