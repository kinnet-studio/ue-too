import type { ToolPointer } from '../events';
import {
    type ToolContext,
    type ToolMachine,
    type ToolServices,
    createToolMachine,
} from '../tool-context';

/**
 * The hand tool's states.
 *
 * @group Whiteboard Editor
 */
export type HandStates = 'IDLE' | 'PRESSED' | 'PANNING';

/**
 * A click with no shape on top activates whatever the app put underneath.
 *
 * @returns Whether something was activated
 */
export function activateBackground(
    context: Pick<ToolServices, 'shapeAt' | 'background'>,
    pointer: ToolPointer
): boolean {
    if (context.shapeAt(pointer.world)) return false;
    if (!context.background.hitTest(pointer.world)) return false;
    context.background.activate(pointer.world, pointer);
    return true;
}

function hoverCursor(
    context: ToolContext,
    pointer: ToolPointer,
    idle: string
): void {
    const overBackground =
        !context.shapeAt(pointer.world) &&
        context.background.hitTest(pointer.world);
    context.setCursor(overBackground ? 'pointer' : idle);
}

const pan = (context: ToolContext, pointer: ToolPointer) =>
    context.panByScreen({ x: -pointer.delta.x, y: -pointer.delta.y });

/**
 * The hand tool: drag to pan; a click on the app's background activates it.
 *
 * @group Whiteboard Editor
 */
export function createHandTool(context: ToolContext): ToolMachine<HandStates> {
    // Whether the last move was a drag: the guard that starts panning reads it
    let dragging = false;
    return createToolMachine<HandStates>(
        context,
        {
            IDLE: {
                enter: ctx => ctx.setCursor('grab'),
                reactions: {
                    pointerDown: {
                        action: () => {},
                        defaultTargetState: 'PRESSED',
                    },
                    pointerMove: {
                        action: (ctx, p) => hoverCursor(ctx, p, 'grab'),
                    },
                },
            },
            PRESSED: {
                reactions: {
                    pointerMove: {
                        action: (ctx, p) => {
                            dragging = p.dragging;
                            if (dragging) pan(ctx, p);
                        },
                    },
                    pointerUp: {
                        action: (ctx, p) => void activateBackground(ctx, p),
                        defaultTargetState: 'IDLE',
                    },
                    cancel: { action: () => {}, defaultTargetState: 'IDLE' },
                },
                guards: { dragging: () => dragging },
                routes: {
                    pointerMove: [{ guard: 'dragging', target: 'PANNING' }],
                },
            },
            PANNING: {
                enter: ctx => ctx.setCursor('grabbing'),
                reactions: {
                    pointerMove: { action: pan },
                    pointerUp: { action: () => {}, defaultTargetState: 'IDLE' },
                    cancel: { action: () => {}, defaultTargetState: 'IDLE' },
                },
            },
        },
        'IDLE'
    );
}
