import type { Point } from '@ue-too/math';

/**
 * Every tool the editor has, in toolbar order.
 *
 * @group Whiteboard Editor
 */
export const TOOL_NAMES = [
    'hand',
    'select',
    'rect',
    'ellipse',
    'arrow',
    'line',
    'pen',
    'text',
    'note',
    'eraser',
] as const;

/**
 * A tool's name.
 *
 * @group Whiteboard Editor
 */
export type ToolName = (typeof TOOL_NAMES)[number];

/**
 * One pointer event as the editor needs it, from the DOM or any other
 * source (tests, a custom event layer).
 *
 * @group Whiteboard Editor
 */
export interface PointerSample {
    id: number;
    pointerType: 'mouse' | 'pen' | 'touch';
    /** 0 primary, 1 middle, 2 secondary */
    button: number;
    /** Window coordinates in CSS pixels */
    client: Point;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    /** Milliseconds, as `event.timeStamp` */
    timeStamp: number;
}

/**
 * A pointer event as tools receive it.
 *
 * @group Whiteboard Editor
 */
export interface ToolPointer {
    world: Point;
    client: Point;
    /**
     * Client pixels since the previous dispatched point; zero until the press
     * becomes a drag, and the first drag move measures from the press
     */
    delta: Point;
    /** Whether a press is under way (false for a mouse hovering) */
    pressed: boolean;
    /** Whether the press has moved past {@link DRAG_SLOP} */
    dragging: boolean;
    button: number;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    pointerType: PointerSample['pointerType'];
}

/**
 * The events tool state machines handle.
 *
 * @group Whiteboard Editor
 */
export type ToolEvents = {
    pointerDown: ToolPointer;
    pointerMove: ToolPointer;
    pointerUp: ToolPointer;
    doubleClick: ToolPointer;
    /** The gesture under way is abandoned: revert it */
    cancel: {};
    /** Switch to the tool the editor asked for (the editor machine only) */
    pickTool: {};
};

/**
 * How far a press moves, in screen pixels, before it counts as a drag.
 *
 * @group Whiteboard Editor
 */
export const DRAG_SLOP = 5;

/**
 * The most time between two clicks of a double click, in milliseconds.
 *
 * @group Whiteboard Editor
 */
export const DOUBLE_CLICK_MS = 400;

/**
 * How far apart two clicks of a double click can be, in screen pixels.
 *
 * @group Whiteboard Editor
 */
export const DOUBLE_CLICK_SLOP = 6;

/**
 * How close a press has to be to a shape to hit it, in screen pixels.
 *
 * @group Whiteboard Editor
 */
export const HIT_TOLERANCE_PX = 6;
