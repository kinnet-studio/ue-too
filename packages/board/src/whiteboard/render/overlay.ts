import type { Box } from '../geometry/box';
import type { WhiteboardTheme } from './theme';

/**
 * Which handle of a selection: a corner or edge of the selection box, or an
 * end of a single line or arrow.
 *
 * @group Whiteboard Rendering
 */
export type HandleId =
    | 'nw'
    | 'n'
    | 'ne'
    | 'e'
    | 'se'
    | 's'
    | 'sw'
    | 'w'
    | 'start'
    | 'end';

/**
 * A resize handle and its centre in world units.
 *
 * @group Whiteboard Rendering
 */
export interface Handle {
    id: HandleId;
    x: number;
    y: number;
}

/**
 * What the selection overlay shows this frame.
 *
 * @group Whiteboard Rendering
 */
export interface SelectionOverlay {
    /** Box around the selected shapes, or null */
    selection: Box | null;
    handles: Handle[];
    /** The rubber band being dragged, or null */
    marquee: Box | null;
    /** Camera zoom, so the overlay keeps its size on screen */
    zoom: number;
}

// Sizes on screen, in CSS pixels
const OUTLINE_WIDTH = 1.5;
const OUTLINE_GAP = 4;
const HANDLE_SIZE = 8;
const MARQUEE_WIDTH = 1;
const MARQUEE_ALPHA = 0.1;

/**
 * Draws the selection outline, its handles and the marquee, all a constant
 * size on screen whatever the zoom.
 *
 * @group Whiteboard Rendering
 */
export function drawSelectionOverlay(
    ctx: CanvasRenderingContext2D,
    overlay: SelectionOverlay,
    theme: WhiteboardTheme
): void {
    const { selection, handles, marquee, zoom } = overlay;
    if (!selection && !marquee && handles.length === 0) return;
    ctx.save();
    ctx.strokeStyle = theme.selection;
    if (selection) {
        const gap = OUTLINE_GAP / zoom;
        ctx.lineWidth = OUTLINE_WIDTH / zoom;
        ctx.strokeRect(
            selection.x - gap,
            selection.y - gap,
            selection.w + gap * 2,
            selection.h + gap * 2
        );
    }
    if (handles.length > 0) {
        const size = HANDLE_SIZE / zoom;
        ctx.lineWidth = OUTLINE_WIDTH / zoom;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (const handle of handles) {
            ctx.rect(handle.x - size / 2, handle.y - size / 2, size, size);
        }
        ctx.fill();
        ctx.stroke();
    }
    if (marquee) {
        ctx.lineWidth = MARQUEE_WIDTH / zoom;
        ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h);
        ctx.globalAlpha = MARQUEE_ALPHA;
        ctx.fillStyle = theme.selection;
        ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h);
    }
    ctx.restore();
}
