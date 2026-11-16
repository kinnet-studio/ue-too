import { FONT_SIZE, STROKE_WIDTH, type Shape } from '../document/types';
import type { Box } from './box';
import { LINE_HEIGHT, type TextEnv, textFont, textLines } from './text';

// An arrow's head reaches sideways past its shaft
const ARROW_HEAD_REACH = 10;

function pointsBox(
    x: number,
    y: number,
    points: [number, number][],
    pad: number
): Box {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [px, py] of points) {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
    }
    return {
        x: x + minX - pad,
        y: y + minY - pad,
        w: maxX - minX + pad * 2,
        h: maxY - minY + pad * 2,
    };
}

/**
 * The box a shape covers in world units, including half its stroke.
 *
 * @remarks
 * Text measures its widest line (at least half a font size wide) and is as
 * tall as its lines.
 *
 * @group Whiteboard Geometry
 */
export function shapeBounds(shape: Shape, env: TextEnv): Box {
    const half = STROKE_WIDTH[shape.style.size] / 2;
    switch (shape.type) {
        case 'rect':
        case 'ellipse':
            return {
                x: shape.x - half,
                y: shape.y - half,
                w: shape.w + half * 2,
                h: shape.h + half * 2,
            };
        case 'note':
            return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
        case 'line':
            return pointsBox(shape.x, shape.y, [[0, 0], shape.end], half);
        case 'arrow':
            return pointsBox(
                shape.x,
                shape.y,
                [[0, 0], shape.end],
                half + ARROW_HEAD_REACH
            );
        case 'pen':
            return pointsBox(shape.x, shape.y, shape.points, half);
        case 'text': {
            const size = FONT_SIZE[shape.style.size];
            const font = textFont(shape.style.size, env.family);
            const lines = textLines(shape, env);
            const width = Math.max(
                size / 2,
                ...lines.map(line => env.measure(line, font))
            );
            return {
                x: shape.x,
                y: shape.y,
                w: width,
                h: lines.length * size * LINE_HEIGHT,
            };
        }
        default: {
            const _exhaustive: never = shape;
            return _exhaustive;
        }
    }
}
