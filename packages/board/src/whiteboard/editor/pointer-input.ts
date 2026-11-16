import type { Point } from '@ue-too/math';

import {
    DOUBLE_CLICK_MS,
    DOUBLE_CLICK_SLOP,
    DRAG_SLOP,
    type PointerSample,
    type ToolPointer,
} from './events';

/**
 * What {@link PointerInput} needs from the editor around it.
 *
 * @group Whiteboard Editor
 */
export interface PointerInputDeps {
    toWorld(client: Point): Point;
    /** The board is in one of its own gestures (Space + drag, middle-drag) */
    boardBusy(): boolean;
    /** The app's screen-space controls take presses at this point */
    ownsPointer(client: Point): boolean;
    dispatch(
        event:
            | 'pointerDown'
            | 'pointerMove'
            | 'pointerUp'
            | 'doubleClick'
            | 'cancel',
        payload: ToolPointer | {}
    ): void;
    /** A middle-button click (no drag) happened */
    middleClick(pointer: ToolPointer): void;
    /** Overrides the cursor, or hands it back to the tool with null */
    setCursor(cursor: string | null): void;
}

interface Press {
    id: number;
    start: Point;
    anchor: Point;
    dragging: boolean;
}

/**
 * Turns raw pointer events into tool events, and decides which presses are
 * the whiteboard's.
 *
 * @remarks
 * A primary-button press (or a touch or pen contact) starts a gesture,
 * unless the board is busy with one of its own gestures or the app's
 * screen-space controls own that spot. A second pointer during a gesture
 * cancels it, and everything is ignored until every pointer is up: two
 * fingers belong to the board's pinch and pan. A press becomes a drag past
 * {@link DRAG_SLOP} pixels; two clicks close in time and space also report
 * a `doubleClick`. A mouse hovering reports moves with `pressed: false`.
 *
 * @group Whiteboard Editor
 */
export class PointerInput {
    private readonly _down = new Set<number>();
    private _press: Press | null = null;
    private _ignored: number | null = null;
    private _swallow = false;
    private _middle: { id: number; start: Point; dragged: boolean } | null =
        null;
    private _lastClick: { time: number; client: Point } | null = null;
    private _overOwned = false;

    constructor(private readonly _deps: PointerInputDeps) {}

    /** Whether a gesture is under way */
    get pressed(): boolean {
        return this._press !== null;
    }

    down(s: PointerSample): void {
        if (s.pointerType === 'mouse' && s.button === 1) {
            this._middle = { id: s.id, start: s.client, dragged: false };
            return;
        }
        if (s.pointerType === 'mouse' && s.button !== 0) return;
        this._down.add(s.id);
        if (this._down.size > 1) {
            this._swallow = true;
            if (this._press) {
                this._press = null;
                this._deps.dispatch('cancel', {});
            }
            return;
        }
        if (this._swallow) return;
        if (this._deps.boardBusy() || this._deps.ownsPointer(s.client)) {
            this._ignored = s.id;
            return;
        }
        this._press = {
            id: s.id,
            start: s.client,
            anchor: s.client,
            dragging: false,
        };
        this._deps.dispatch(
            'pointerDown',
            this.pointer(s, true, false, { x: 0, y: 0 })
        );
    }

    move(s: PointerSample): void {
        const middle = this._middle;
        if (middle && s.id === middle.id && s.pointerType === 'mouse') {
            if (distance(s.client, middle.start) >= DRAG_SLOP) {
                middle.dragged = true;
            }
            return;
        }
        const press = this._press;
        if (press && s.id === press.id) {
            let delta = { x: 0, y: 0 };
            if (
                !press.dragging &&
                distance(s.client, press.start) >= DRAG_SLOP
            ) {
                press.dragging = true;
            }
            if (press.dragging) {
                delta = {
                    x: s.client.x - press.anchor.x,
                    y: s.client.y - press.anchor.y,
                };
                press.anchor = s.client;
            }
            this._deps.dispatch(
                'pointerMove',
                this.pointer(s, true, press.dragging, delta)
            );
            return;
        }
        if (this._down.size > 0 || s.pointerType !== 'mouse') return;
        const owned = this._deps.ownsPointer(s.client);
        if (owned !== this._overOwned) {
            this._overOwned = owned;
            this._deps.setCursor(owned ? 'pointer' : null);
        }
        if (!owned) {
            this._deps.dispatch(
                'pointerMove',
                this.pointer(s, false, false, { x: 0, y: 0 })
            );
        }
    }

    up(s: PointerSample): void {
        const middle = this._middle;
        if (
            middle &&
            s.id === middle.id &&
            s.pointerType === 'mouse' &&
            s.button === 1
        ) {
            this._middle = null;
            if (!middle.dragged) {
                this._deps.middleClick(
                    this.pointer(s, false, false, { x: 0, y: 0 })
                );
            }
            return;
        }
        this._down.delete(s.id);
        if (this._down.size === 0) this._swallow = false;
        if (this._ignored === s.id) {
            this._ignored = null;
            return;
        }
        const press = this._press;
        if (!press || press.id !== s.id) return;
        this._press = null;
        this._deps.dispatch(
            'pointerUp',
            this.pointer(s, true, press.dragging, { x: 0, y: 0 })
        );
        if (press.dragging) {
            this._lastClick = null;
            return;
        }
        const last = this._lastClick;
        if (
            last &&
            s.timeStamp - last.time <= DOUBLE_CLICK_MS &&
            distance(s.client, last.client) <= DOUBLE_CLICK_SLOP
        ) {
            this._lastClick = null;
            this._deps.dispatch(
                'doubleClick',
                this.pointer(s, false, false, { x: 0, y: 0 })
            );
        } else {
            this._lastClick = { time: s.timeStamp, client: s.client };
        }
    }

    /** The browser took the pointer away from the canvas mid-gesture */
    lostCapture(id: number): void {
        if (this._press?.id !== id) return;
        this._press = null;
        this._deps.dispatch('cancel', {});
    }

    /** Abandons the gesture and forgets every pointer (window blur, pointercancel) */
    cancel(): void {
        const hadPress = this._press !== null;
        this._press = null;
        this._down.clear();
        this._ignored = null;
        this._swallow = false;
        this._middle = null;
        if (hadPress) this._deps.dispatch('cancel', {});
    }

    private pointer(
        s: PointerSample,
        pressed: boolean,
        dragging: boolean,
        delta: Point
    ): ToolPointer {
        return {
            world: this._deps.toWorld(s.client),
            client: s.client,
            delta,
            pressed,
            dragging,
            button: s.button,
            shiftKey: s.shiftKey,
            ctrlKey: s.ctrlKey,
            metaKey: s.metaKey,
            pointerType: s.pointerType,
        };
    }
}

function distance(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
