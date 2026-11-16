import { FONT_SIZE, STROKE_WIDTH, type Shape } from '../document/types';
import {
    LINE_HEIGHT,
    NOTE_PADDING,
    type TextEnv,
    textFont,
    textLines,
} from '../geometry/text';
import { type PathOp, type SketchPart, noteTilt, sketchShape } from './sketch';
import type { WhiteboardTheme } from './theme';

/**
 * How one shape is painted this frame.
 *
 * @group Whiteboard Rendering
 */
export interface PaintOptions {
    /** Drawn at 30% opacity (shapes the eraser has marked) */
    faded?: boolean;
    /** Text left out (the shape whose text is being edited) */
    hideText?: boolean;
}

interface CachedPart {
    part: SketchPart;
    path: Path2D;
}

// Faded shapes, and solid fills, are drawn at these opacities
const FADED_ALPHA = 0.3;
const SOLID_ALPHA = 0.25;

function buildPath(ops: PathOp[], path: Path2D): Path2D {
    for (const op of ops) {
        switch (op[0]) {
            case 'M':
                path.moveTo(op[1], op[2]);
                break;
            case 'L':
                path.lineTo(op[1], op[2]);
                break;
            case 'C':
                path.bezierCurveTo(op[1], op[2], op[3], op[4], op[5], op[6]);
                break;
            case 'Z':
                path.closePath();
                break;
        }
    }
    return path;
}

/**
 * Paints shapes onto a 2D canvas in their sketchy style.
 *
 * @remarks
 * Each record's paths are built once and cached against the record object
 * (records are immutable, so an edited shape is a new object and gets new
 * paths). Colours and widths are applied when painting, so a theme switch
 * reuses the cache. Paint inside the board's transform: shapes are in world
 * units.
 *
 * @group Whiteboard Rendering
 */
export class ShapePainter {
    private readonly _cache = new WeakMap<Shape, CachedPart[]>();
    private readonly _createPath: () => Path2D;
    private _built = 0;

    /** @param options.createPath - Makes an empty path; `new Path2D()` by default */
    constructor(options: { createPath?: () => Path2D } = {}) {
        this._createPath = options.createPath ?? (() => new Path2D());
    }

    /** How many records have had their paths built (for tests) */
    get cacheSize(): number {
        return this._built;
    }

    /** Paints one shape */
    paint(
        ctx: CanvasRenderingContext2D,
        shape: Shape,
        theme: WhiteboardTheme,
        env: TextEnv,
        options: PaintOptions = {}
    ): void {
        const color = theme.colors[shape.style.color];
        const width = STROKE_WIDTH[shape.style.size];
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (options.faded) ctx.globalAlpha = ctx.globalAlpha * FADED_ALPHA;
        if (shape.type === 'note') {
            const cx = shape.x + shape.w / 2;
            const cy = shape.y + shape.h / 2;
            ctx.translate(cx, cy);
            ctx.rotate(noteTilt(shape));
            ctx.translate(-cx, -cy);
        }
        for (const { part, path } of this.parts(shape)) {
            switch (part.role) {
                case 'outline':
                    ctx.strokeStyle = color;
                    ctx.lineWidth = width;
                    ctx.stroke(path);
                    break;
                case 'hachure':
                    ctx.strokeStyle = color;
                    ctx.lineWidth = width / 2;
                    ctx.stroke(path);
                    break;
                case 'solid': {
                    const alpha = ctx.globalAlpha;
                    ctx.globalAlpha = alpha * SOLID_ALPHA;
                    ctx.fillStyle = color;
                    ctx.fill(path);
                    ctx.globalAlpha = alpha;
                    break;
                }
                case 'paper':
                    ctx.fillStyle = theme.paper[shape.style.color];
                    ctx.fill(path);
                    break;
            }
        }
        if (
            (shape.type === 'text' || shape.type === 'note') &&
            !options.hideText
        ) {
            const size = FONT_SIZE[shape.style.size];
            const inset = shape.type === 'note' ? NOTE_PADDING : 0;
            ctx.font = textFont(shape.style.size, env.family);
            ctx.fillStyle = shape.type === 'note' ? theme.paperText : color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            textLines(shape, env).forEach((line, i) => {
                if (line) {
                    ctx.fillText(
                        line,
                        shape.x + inset,
                        shape.y + inset + i * size * LINE_HEIGHT
                    );
                }
            });
        }
        ctx.restore();
    }

    private parts(shape: Shape): CachedPart[] {
        let parts = this._cache.get(shape);
        if (!parts) {
            parts = sketchShape(shape).map(part => ({
                part,
                path: buildPath(part.ops, this._createPath()),
            }));
            this._cache.set(shape, parts);
            this._built++;
        }
        return parts;
    }
}
