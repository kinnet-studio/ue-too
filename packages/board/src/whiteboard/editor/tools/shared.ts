import { createId, createSeed } from '../../document/ids';
import type { ShapeBase, ShapeType } from '../../document/types';
import type { ToolContext } from '../tool-context';

/** The fields every new shape starts with: a fresh id and seed, on top, in the current style */
export function newShape<T extends ShapeType>(
    context: ToolContext,
    type: T,
    x: number,
    y: number
): ShapeBase<T> {
    return {
        id: createId(),
        type,
        x,
        y,
        rotation: 0,
        index: context.doc.nextIndex(),
        seed: createSeed(),
        style: { ...context.style() },
    };
}

/** Abandons the gesture: reverts what it changed and records nothing */
export const cancelGesture = {
    action: (context: ToolContext) => context.history.cancel(),
    defaultTargetState: 'IDLE' as const,
};
