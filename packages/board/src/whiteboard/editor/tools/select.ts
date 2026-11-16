import type { Point } from '@ue-too/math';

import type { Shape } from '../../document/types';
import { type Box, normalizeBox } from '../../geometry/box';
import type { HandleId } from '../../render/overlay';
import type { ToolPointer } from '../events';
import {
    handleAt,
    handlesFor,
    resizeBox,
    resizeShape,
    selectionBox,
} from '../selection';
import {
    type ToolContext,
    type ToolMachine,
    createToolMachine,
} from '../tool-context';
import { activateBackground } from './hand';
import { cancelGesture } from './shared';

/**
 * The select tool's states.
 *
 * @group Whiteboard Editor
 */
export type SelectStates =
    | 'IDLE'
    | 'POINTING_SHAPE'
    | 'MOVING'
    | 'POINTING_HANDLE'
    | 'RESIZING'
    | 'POINTING_EMPTY'
    | 'MARQUEE';

const RESIZE_CURSORS: Record<HandleId, string> = {
    nw: 'nwse-resize',
    se: 'nwse-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
    n: 'ns-resize',
    s: 'ns-resize',
    e: 'ew-resize',
    w: 'ew-resize',
    start: 'move',
    end: 'move',
};

function selectedShapes(context: ToolContext): Shape[] {
    return context.selection.ids
        .map(id => context.doc.get(id))
        .filter((shape): shape is Shape => shape !== undefined);
}

function handleUnder(context: ToolContext, world: Point): HandleId | null {
    const handles = handlesFor(selectedShapes(context), context.env);
    return handleAt(handles, world, context.zoom());
}

/**
 * The select tool: click to select (Shift adds or removes), drag a shape to
 * move the selection, drag a handle to resize (Shift keeps the proportions),
 * drag on empty canvas for a marquee, double-click text or a note to edit
 * it. A click on empty canvas activates the app's background.
 *
 * @group Whiteboard Editor
 */
export function createSelectTool(
    context: ToolContext
): ToolMachine<SelectStates> {
    // What the press landed on; the pointerDown routes read it
    let pressed: 'handle' | 'shape' | 'empty' = 'empty';
    let dragging = false;
    let start: ToolPointer | null = null;
    let pressedId: string | null = null;
    let handle: HandleId | null = null;
    let startBox: Box | null = null;
    let originals: Shape[] = [];
    let marqueeBase: readonly string[] = [];

    const isDrag = (p: ToolPointer) => (dragging = p.dragging);

    const move = (ctx: ToolContext, p: ToolPointer) => {
        if (!start) return;
        const dx = p.world.x - start.world.x;
        const dy = p.world.y - start.world.y;
        ctx.doc.put(originals.map(s => ({ ...s, x: s.x + dx, y: s.y + dy })));
    };

    const resize = (ctx: ToolContext, p: ToolPointer) => {
        if (!start || !handle) return;
        const only = originals[0];
        if ((handle === 'start' || handle === 'end') && only) {
            if (only.type !== 'line' && only.type !== 'arrow') return;
            const endX = only.x + only.end[0];
            const endY = only.y + only.end[1];
            ctx.doc.put(
                handle === 'end'
                    ? { ...only, end: [p.world.x - only.x, p.world.y - only.y] }
                    : {
                          ...only,
                          x: p.world.x,
                          y: p.world.y,
                          end: [endX - p.world.x, endY - p.world.y],
                      }
            );
            return;
        }
        if (!startBox) return;
        const to = resizeBox(
            startBox,
            handle,
            { x: p.world.x - start.world.x, y: p.world.y - start.world.y },
            p.shiftKey
        );
        ctx.doc.put(originals.map(s => resizeShape(s, startBox!, to)));
    };

    const marquee = (ctx: ToolContext, p: ToolPointer) => {
        if (!start) return;
        const box = normalizeBox(
            start.world.x,
            start.world.y,
            p.world.x,
            p.world.y
        );
        ctx.overlay.marquee = box;
        ctx.selection.set([
            ...marqueeBase,
            ...ctx.shapesInBox(box).map(shape => shape.id),
        ]);
    };

    const endGesture = {
        action: (ctx: ToolContext) => ctx.history.end(),
        defaultTargetState: 'IDLE' as const,
    };
    const dragRoute = (target: SelectStates) => ({
        guards: { dragging: () => dragging },
        routes: { pointerMove: [{ guard: 'dragging', target }] },
    });

    return createToolMachine<SelectStates>(
        context,
        {
            IDLE: {
                enter: ctx => ctx.setCursor('default'),
                reactions: {
                    pointerDown: {
                        action: (ctx, p) => {
                            start = p;
                            dragging = false;
                            handle = handleUnder(ctx, p.world);
                            if (handle) {
                                pressed = 'handle';
                                originals = selectedShapes(ctx);
                                startBox = selectionBox(originals, ctx.env);
                                ctx.history.begin();
                                return;
                            }
                            const shape = ctx.shapeAt(p.world);
                            if (shape) {
                                pressed = 'shape';
                                pressedId = shape.id;
                                if (p.shiftKey) ctx.selection.toggle(shape.id);
                                else if (!ctx.selection.has(shape.id)) {
                                    ctx.selection.set([shape.id]);
                                }
                                originals = selectedShapes(ctx);
                                ctx.history.begin();
                                return;
                            }
                            pressed = 'empty';
                            marqueeBase = p.shiftKey ? ctx.selection.ids : [];
                        },
                    },
                    pointerMove: {
                        action: (ctx, p) => {
                            const over = handleUnder(ctx, p.world);
                            if (over)
                                return ctx.setCursor(RESIZE_CURSORS[over]);
                            const shape = ctx.shapeAt(p.world);
                            if (shape) {
                                return ctx.setCursor(
                                    ctx.selection.has(shape.id)
                                        ? 'move'
                                        : 'default'
                                );
                            }
                            ctx.setCursor(
                                ctx.background.hitTest(p.world)
                                    ? 'pointer'
                                    : 'default'
                            );
                        },
                    },
                    doubleClick: {
                        action: (ctx, p) => {
                            const shape = ctx.shapeAt(p.world);
                            if (
                                shape?.type === 'text' ||
                                shape?.type === 'note'
                            ) {
                                ctx.selection.set([shape.id]);
                                ctx.editText(shape.id);
                            }
                        },
                    },
                },
                guards: {
                    handle: () => pressed === 'handle',
                    shape: () => pressed === 'shape',
                    empty: () => pressed === 'empty',
                },
                routes: {
                    pointerDown: [
                        { guard: 'handle', target: 'POINTING_HANDLE' },
                        { guard: 'shape', target: 'POINTING_SHAPE' },
                        { guard: 'empty', target: 'POINTING_EMPTY' },
                    ],
                },
            },
            POINTING_SHAPE: {
                reactions: {
                    pointerMove: {
                        action: (ctx, p) => {
                            if (isDrag(p)) move(ctx, p);
                        },
                    },
                    pointerUp: {
                        action: (ctx, p) => {
                            ctx.history.end();
                            // A plain click on one shape of a selection picks just that one
                            if (
                                !p.shiftKey &&
                                pressedId &&
                                ctx.selection.ids.length > 1
                            ) {
                                ctx.selection.set([pressedId]);
                            }
                        },
                        defaultTargetState: 'IDLE',
                    },
                    cancel: cancelGesture,
                },
                ...dragRoute('MOVING'),
            },
            MOVING: {
                enter: ctx => ctx.setCursor('move'),
                reactions: {
                    pointerMove: { action: move },
                    pointerUp: endGesture,
                    cancel: cancelGesture,
                },
            },
            POINTING_HANDLE: {
                reactions: {
                    pointerMove: {
                        action: (ctx, p) => {
                            if (isDrag(p)) resize(ctx, p);
                        },
                    },
                    pointerUp: endGesture,
                    cancel: cancelGesture,
                },
                ...dragRoute('RESIZING'),
            },
            RESIZING: {
                reactions: {
                    pointerMove: { action: resize },
                    pointerUp: endGesture,
                    cancel: cancelGesture,
                },
            },
            POINTING_EMPTY: {
                reactions: {
                    pointerMove: {
                        action: (ctx, p) => {
                            if (isDrag(p)) marquee(ctx, p);
                        },
                    },
                    pointerUp: {
                        action: (ctx, p) => {
                            if (!p.shiftKey) ctx.selection.clear();
                            activateBackground(ctx, p);
                        },
                        defaultTargetState: 'IDLE',
                    },
                    cancel: { action: () => {}, defaultTargetState: 'IDLE' },
                },
                ...dragRoute('MARQUEE'),
            },
            MARQUEE: {
                reactions: {
                    pointerMove: { action: marquee },
                    pointerUp: {
                        action: ctx => {
                            ctx.overlay.marquee = null;
                        },
                        defaultTargetState: 'IDLE',
                    },
                    cancel: {
                        action: ctx => {
                            ctx.overlay.marquee = null;
                            ctx.selection.set([...marqueeBase]);
                        },
                        defaultTargetState: 'IDLE',
                    },
                },
            },
        },
        'IDLE'
    );
}
