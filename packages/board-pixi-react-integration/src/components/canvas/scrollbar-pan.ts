import {
    BoardCamera,
    translationHeightOf,
    translationWidthOf,
} from '@ue-too/board';

export type ScrollBarAxis = 'horizontal' | 'vertical';

type WorldDelta = { x: number; y: number };

/**
 * World-space pan for dragging a scroll bar thumb by `dragPx` along `axis`.
 *
 * `dragPx` is a pointer delta (current `clientX`/`clientY` minus the previous
 * one). A delta between two window positions is already a canvas CSS-pixel
 * delta, so it must not go through `convertFromWindow2Canvas`: that converts
 * points and would subtract the canvas's window offset from every move event.
 */
export function scrollBarDragToWorldDelta(
    camera: BoardCamera,
    axis: ScrollBarAxis,
    dragPx: number
): WorldDelta {
    if (axis === 'horizontal') {
        const percentage = dragPx / camera.viewPortWidth;
        return {
            x: percentage * (translationWidthOf(camera.boundaries) ?? 0),
            y: 0,
        };
    }
    const percentage = dragPx / camera.viewPortHeight;
    return {
        x: 0,
        y: percentage * (translationHeightOf(camera.boundaries) ?? 0),
    };
}

/**
 * World-space pan for a key pressed on a focused scroll bar, or `undefined` if
 * the key isn't a scroll key for `axis` (or the camera has no boundaries along
 * it), in which case the event should be left alone.
 */
export function scrollBarKeyToWorldDelta(
    camera: BoardCamera,
    axis: ScrollBarAxis,
    key: string
): WorldDelta | undefined {
    const boundaries = camera.boundaries;
    if (!boundaries) {
        return undefined;
    }

    if (axis === 'horizontal') {
        const width = translationWidthOf(boundaries);
        if (width == null) {
            return undefined;
        }

        const viewportWidth = camera.viewPortWidth;
        const scrollStep = viewportWidth * 0.05; // 5% of viewport width
        const scrollPercentage = scrollStep / viewportWidth;
        const worldStep = scrollPercentage * width;

        switch (key) {
            case 'ArrowLeft':
                return { x: -worldStep, y: 0 };
            case 'ArrowRight':
                return { x: worldStep, y: 0 };
            case 'Home': {
                // Move to leftmost position
                if (boundaries.min?.x == null) {
                    return { x: 0, y: 0 };
                }
                const viewportLeft = camera.convertFromViewPort2WorldSpace({
                    x: -viewportWidth / 2,
                    y: 0,
                }).x;
                return { x: boundaries.min.x - viewportLeft, y: 0 };
            }
            case 'End': {
                // Move to rightmost position
                if (boundaries.max?.x == null) {
                    return { x: 0, y: 0 };
                }
                const viewportRight = camera.convertFromViewPort2WorldSpace({
                    x: viewportWidth / 2,
                    y: 0,
                }).x;
                return { x: boundaries.max.x - viewportRight, y: 0 };
            }
            default:
                return undefined;
        }
    }

    const height = translationHeightOf(boundaries);
    if (height == null) {
        return undefined;
    }

    const viewportHeight = camera.viewPortHeight;
    const scrollStep = viewportHeight * 0.05; // 5% of viewport height
    const scrollPercentage = scrollStep / viewportHeight;
    const worldStep = scrollPercentage * height;

    switch (key) {
        case 'ArrowUp':
            return { x: 0, y: -worldStep };
        case 'ArrowDown':
            return { x: 0, y: worldStep };
        // The world is y-down, so the top of the scrollable area is min.y.
        case 'Home': {
            // Move to topmost position
            if (boundaries.min?.y == null) {
                return { x: 0, y: 0 };
            }
            const viewportTop = camera.convertFromViewPort2WorldSpace({
                x: 0,
                y: -viewportHeight / 2,
            }).y;
            return { x: 0, y: boundaries.min.y - viewportTop };
        }
        case 'End': {
            // Move to bottommost position
            if (boundaries.max?.y == null) {
                return { x: 0, y: 0 };
            }
            const viewportBottom = camera.convertFromViewPort2WorldSpace({
                x: 0,
                y: viewportHeight / 2,
            }).y;
            return { x: 0, y: boundaries.max.y - viewportBottom };
        }
        default:
            return undefined;
    }
}
