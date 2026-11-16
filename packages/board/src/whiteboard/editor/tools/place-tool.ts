import type { Point } from '@ue-too/math';

import {
    NOTE_SIZE,
    type NoteShape,
    type TextShape,
} from '../../document/types';
import {
    type ToolContext,
    type ToolMachine,
    createToolMachine,
} from '../tool-context';
import { newShape } from './shared';

type PlaceStates = 'IDLE' | 'PRESSED';

/**
 * The text and sticky-note tools: a click places an empty text box (its
 * top-left at the click) or a note (centred on it) and starts editing it.
 * A drag counts as a click where it started. Placing and typing are one
 * undo step; afterwards the editor switches to Select.
 *
 * @group Whiteboard Editor
 */
export function createPlaceTool(
    context: ToolContext,
    type: 'text' | 'note'
): ToolMachine<PlaceStates> {
    let at: Point = { x: 0, y: 0 };

    const place = (ctx: ToolContext) => {
        const shape: TextShape | NoteShape =
            type === 'text'
                ? { ...newShape(ctx, 'text', at.x, at.y), text: '' }
                : {
                      ...newShape(
                          ctx,
                          'note',
                          at.x - NOTE_SIZE / 2,
                          at.y - NOTE_SIZE / 2
                      ),
                      w: NOTE_SIZE,
                      h: NOTE_SIZE,
                      text: '',
                  };
        // The step stays open while editing, so placing and typing undo together
        ctx.history.begin();
        ctx.doc.put(shape);
        ctx.editText(shape.id);
        ctx.history.end();
        ctx.requestTool('select', [shape.id]);
    };

    return createToolMachine<PlaceStates>(
        context,
        {
            IDLE: {
                enter: ctx =>
                    ctx.setCursor(type === 'text' ? 'text' : 'crosshair'),
                reactions: {
                    pointerDown: {
                        action: (_, p) => {
                            at = p.world;
                        },
                        defaultTargetState: 'PRESSED',
                    },
                },
            },
            PRESSED: {
                reactions: {
                    pointerMove: { action: () => {} },
                    pointerUp: { action: place, defaultTargetState: 'IDLE' },
                    cancel: { action: () => {}, defaultTargetState: 'IDLE' },
                },
            },
        },
        'IDLE'
    );
}
