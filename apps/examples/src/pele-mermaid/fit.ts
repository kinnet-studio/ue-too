import type { CameraView } from '@ue-too/board';

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 10;

/**
 * The camera view that shows a whole diagram, whose top-left corner is at
 * world (0, 0), inside a viewport with `padding` CSS pixels on every side.
 */
export function fitView(
    diagram: { width: number; height: number },
    viewport: { width: number; height: number },
    padding = 40
): CameraView {
    const zoom = Math.min(
        (viewport.width - 2 * padding) / diagram.width,
        (viewport.height - 2 * padding) / diagram.height
    );
    return {
        position: { x: diagram.width / 2, y: diagram.height / 2 },
        zoomLevel: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)),
    };
}
