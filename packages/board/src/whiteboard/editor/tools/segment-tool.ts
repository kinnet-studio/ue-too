import type { Point } from '@ue-too/math';

import type { ArrowShape, LineShape } from '../../document/types';
import type { ToolPointer } from '../events';
import {
    type ToolContext,
    type ToolMachine,
    createToolMachine,
} from '../tool-context';
import { cancelGesture, newShape } from './shared';

type SegmentStates = 'IDLE' | 'CREATING';

// A click without a drag makes a segment this long, pointing right
const DEFAULT_LENGTH = 160;
const SNAP = Math.PI / 12;

/** The end point relative to `start`; with `snap`, its angle is a multiple of 15° */
function segmentEnd(start: Point, end: Point, snap: boolean): [number, number] {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (!snap) return [dx, dy];
    const length = Math.hypot(dx, dy);
    const angle = Math.round(Math.atan2(dy, dx) / SNAP) * SNAP;
    return [Math.cos(angle) * length, Math.sin(angle) * length];
}

/**
 * The arrow and line tools: drag from start to end (Shift snaps the angle to
 * 15°), or click for a default-length segment. Afterwards the editor
 * switches to Select with the new shape selected.
 *
 * @group Whiteboard Editor
 */
export function createSegmentTool(
    context: ToolContext,
    type: 'arrow' | 'line'
): ToolMachine<SegmentStates> {
    let start: Point = { x: 0, y: 0 };
    let shape: ArrowShape | LineShape | null = null;

    const stretch = (ctx: ToolContext, p: ToolPointer) => {
        if (!shape || !p.dragging) return;
        shape = { ...shape, end: segmentEnd(start, p.world, p.shiftKey) };
        ctx.doc.put(shape);
    };

    return createToolMachine<SegmentStates>(
        context,
        {
            IDLE: {
                enter: ctx => ctx.setCursor('crosshair'),
                reactions: {
                    pointerDown: {
                        action: (ctx, p) => {
                            ctx.history.begin();
                            start = p.world;
                            const created = {
                                ...newShape(ctx, type, start.x, start.y),
                                end: [0, 0],
                            } as ArrowShape | LineShape;
                            shape = created;
                            ctx.doc.put(created);
                        },
                        defaultTargetState: 'CREATING',
                    },
                },
            },
            CREATING: {
                reactions: {
                    pointerMove: { action: stretch },
                    pointerUp: {
                        action: (ctx, p) => {
                            if (!shape) return;
                            if (p.dragging) stretch(ctx, p);
                            else {
                                shape = { ...shape, end: [DEFAULT_LENGTH, 0] };
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
