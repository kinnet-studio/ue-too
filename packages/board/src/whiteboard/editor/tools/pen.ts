import type { PenShape } from '../../document/types';
import { roundPoints, simplifyPoints } from '../../geometry/simplify';
import {
    type ToolContext,
    type ToolMachine,
    createToolMachine,
} from '../tool-context';
import { cancelGesture, newShape } from './shared';

/**
 * The pen's states.
 *
 * @group Whiteboard Editor
 */
export type PenStates = 'IDLE' | 'DRAWING';

// Points closer than this on screen add nothing a hand can draw
const MIN_STEP_PX = 0.5;
// How far, in screen px, a point may stray from the finished stroke before
// simplification keeps it: under half a pixel, the stroke doesn't visibly
// change when the pen lifts
const SIMPLIFY_TOLERANCE_PX = 0.5;

/**
 * The pen: drag to draw a stroke; a tap leaves a dot. The pen stays picked.
 *
 * @group Whiteboard Editor
 */
export function createPenTool(context: ToolContext): ToolMachine<PenStates> {
    let stroke: PenShape | null = null;

    return createToolMachine<PenStates>(
        context,
        {
            IDLE: {
                enter: ctx => ctx.setCursor('crosshair'),
                reactions: {
                    pointerDown: {
                        action: (ctx, p) => {
                            ctx.history.begin();
                            stroke = {
                                ...newShape(ctx, 'pen', p.world.x, p.world.y),
                                points: [[0, 0]],
                            };
                            ctx.doc.put(stroke);
                        },
                        defaultTargetState: 'DRAWING',
                    },
                },
            },
            DRAWING: {
                reactions: {
                    pointerMove: {
                        action: (ctx, p) => {
                            if (!stroke) return;
                            const x = p.world.x - stroke.x;
                            const y = p.world.y - stroke.y;
                            const [lx, ly] =
                                stroke.points[stroke.points.length - 1]!;
                            if (
                                Math.hypot(x - lx, y - ly) <
                                MIN_STEP_PX / ctx.zoom()
                            ) {
                                return;
                            }
                            stroke = {
                                ...stroke,
                                points: [...stroke.points, [x, y]],
                            };
                            ctx.doc.put(stroke);
                        },
                    },
                    pointerUp: {
                        action: ctx => {
                            if (!stroke) return;
                            ctx.doc.put({
                                ...stroke,
                                points: roundPoints(
                                    simplifyPoints(
                                        stroke.points,
                                        SIMPLIFY_TOLERANCE_PX / ctx.zoom()
                                    )
                                ),
                            });
                            ctx.history.end();
                            stroke = null;
                        },
                        defaultTargetState: 'IDLE',
                    },
                    cancel: {
                        action: ctx => {
                            stroke = null;
                            cancelGesture.action(ctx);
                        },
                        defaultTargetState: 'IDLE',
                    },
                },
            },
        },
        'IDLE'
    );
}
