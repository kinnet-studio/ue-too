/**
 * The kinds of shape a whiteboard holds.
 *
 * @group Whiteboard Document
 */
export type ShapeType =
    | 'rect'
    | 'ellipse'
    | 'arrow'
    | 'line'
    | 'pen'
    | 'text'
    | 'note';

/**
 * A named colour. Records store the name, never a colour value, so the
 * renderer maps it per theme (light and dark) and a later palette change
 * doesn't rewrite saved drawings.
 *
 * @group Whiteboard Document
 */
export type ColorName = 'ink' | 'red' | 'blue' | 'green' | 'orange';

/**
 * Stroke and text size: small, medium or large.
 *
 * @group Whiteboard Document
 */
export type ShapeSize = 's' | 'm' | 'l';

/**
 * How a rectangle or ellipse is filled.
 *
 * @group Whiteboard Document
 */
export type ShapeFill = 'none' | 'hachure' | 'solid';

/**
 * The style every shape carries.
 *
 * @group Whiteboard Document
 */
export interface ShapeStyle {
    color: ColorName;
    size: ShapeSize;
    fill: ShapeFill;
}

/**
 * Fields every shape record has. Records are plain JSON and immutable: an
 * update replaces the whole record.
 *
 * @group Whiteboard Document
 */
export interface ShapeBase<T extends ShapeType> {
    /** Random, 16 base-62 characters */
    id: string;
    type: T;
    /** World position of the shape's origin (see each shape type) */
    x: number;
    y: number;
    /** Radians; always 0 for now */
    rotation: number;
    /** Fractional index: stacking order, sorted as a plain string */
    index: string;
    /** Fixes the sketchy wobble, so every viewer sees the same shape */
    seed: number;
    style: ShapeStyle;
}

/**
 * A rectangle; `x`, `y` is its top-left corner.
 *
 * @group Whiteboard Document
 */
export interface RectShape extends ShapeBase<'rect'> {
    w: number;
    h: number;
}

/**
 * An ellipse; `x`, `y` is the top-left corner of its box.
 *
 * @group Whiteboard Document
 */
export interface EllipseShape extends ShapeBase<'ellipse'> {
    w: number;
    h: number;
}

/**
 * A sticky note; `x`, `y` is its top-left corner. Its text wraps to its width.
 *
 * @group Whiteboard Document
 */
export interface NoteShape extends ShapeBase<'note'> {
    w: number;
    h: number;
    text: string;
}

/**
 * An arrow from `x`, `y` to `end` (relative to `x`, `y`), with its head at the end.
 *
 * @group Whiteboard Document
 */
export interface ArrowShape extends ShapeBase<'arrow'> {
    end: [number, number];
}

/**
 * A straight line from `x`, `y` to `end` (relative to `x`, `y`).
 *
 * @group Whiteboard Document
 */
export interface LineShape extends ShapeBase<'line'> {
    end: [number, number];
}

/**
 * A pen stroke; `points` are relative to `x`, `y`.
 *
 * @group Whiteboard Document
 */
export interface PenShape extends ShapeBase<'pen'> {
    points: [number, number][];
}

/**
 * Free text; `x`, `y` is its top-left corner. It grows to fit and may
 * contain newlines.
 *
 * @group Whiteboard Document
 */
export interface TextShape extends ShapeBase<'text'> {
    text: string;
}

/**
 * Any shape record.
 *
 * @group Whiteboard Document
 */
export type Shape =
    | RectShape
    | EllipseShape
    | NoteShape
    | ArrowShape
    | LineShape
    | PenShape
    | TextShape;

/**
 * Where a change came from: this client, or another one through a sync layer.
 *
 * @group Whiteboard Document
 */
export type ChangeSource = 'local' | 'remote';

/**
 * One batch of edits to a document.
 *
 * @remarks
 * `updated` pairs each record's state before the batch with its state after.
 *
 * @group Whiteboard Document
 */
export interface Change {
    added: Shape[];
    updated: [before: Shape, after: Shape][];
    removed: Shape[];
    source: ChangeSource;
}

/**
 * Every colour name, in palette order.
 *
 * @group Whiteboard Document
 */
export const COLOR_NAMES: readonly ColorName[] = [
    'ink',
    'red',
    'blue',
    'green',
    'orange',
];

/**
 * The style new shapes get until one is picked.
 *
 * @group Whiteboard Document
 */
export const DEFAULT_STYLE: ShapeStyle = {
    color: 'ink',
    size: 'm',
    fill: 'none',
};

/**
 * Stroke width for each size, in world units.
 *
 * @group Whiteboard Document
 */
export const STROKE_WIDTH: Record<ShapeSize, number> = {
    s: 1.5,
    m: 2.5,
    l: 4.5,
};

/**
 * Font size for each size, in world units.
 *
 * @group Whiteboard Document
 */
export const FONT_SIZE: Record<ShapeSize, number> = { s: 20, m: 28, l: 40 };

/**
 * Width and height of a new sticky note, in world units.
 *
 * @group Whiteboard Document
 */
export const NOTE_SIZE = 200;
