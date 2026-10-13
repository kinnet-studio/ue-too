import {
    CreateStateType,
    EventArgs,
    EventGuards,
    EventReactions,
    EventResult,
    Guard,
    NO_OP,
    TemplateState,
    TemplateStateMachine,
} from '@ue-too/being';
import type { Point } from '@ue-too/math';

import { convertFromWindow2ViewPortWithCanvasOperator } from '../../utils/coorindate-conversion';
import {
    Canvas,
    CursorStyle,
    DummyKmtInputContext,
    KmtInputContext,
    ObservableInputTracker,
} from './kmt-input-context';

const KMT_INPUT_STATES = [
    'IDLE',
    'READY_TO_PAN_VIA_SPACEBAR',
    'READY_TO_PAN_VIA_SCROLL_WHEEL',
    'PAN',
    'INITIAL_PAN',
    'PAN_VIA_SCROLL_WHEEL',
    'DISABLED',
] as const;

/**
 * Possible states of the Keyboard/Mouse/Trackpad input state machine.
 *
 * @remarks
 * State transitions:
 * - **IDLE**: Default state, waiting for user input
 * - **READY_TO_PAN_VIA_SPACEBAR**: Spacebar pressed, ready to pan with left-click drag
 * - **INITIAL_PAN**: First frame of pan via spacebar (detects accidental clicks)
 * - **PAN**: Active panning via spacebar + left-click drag
 * - **READY_TO_PAN_VIA_SCROLL_WHEEL**: Middle mouse button pressed, ready to pan
 * - **PAN_VIA_SCROLL_WHEEL**: Active panning via middle-click drag
 * - **DISABLED**: Input temporarily disabled (e.g., during UI interactions)
 *
 * @category Input State Machine - KMT
 */
export type KmtInputStates = CreateStateType<typeof KMT_INPUT_STATES>;

/**
 * Payload for pointer events (mouse button press/release/move).
 *
 * @property x - X coordinate in window space
 * @property y - Y coordinate in window space
 *
 * @category Input State Machine - KMT
 */
export type PointerEventPayload = {
    x: number;
    y: number;
};

/**
 * @internal
 */
type EmptyPayload = {};

/**
 * Payload for scroll wheel events.
 *
 * @property deltaX - Horizontal scroll delta
 * @property deltaY - Vertical scroll delta
 *
 * @category Input State Machine - KMT
 */
export type ScrollEventPayload = {
    deltaX: number;
    deltaY: number;
};

/**
 * Payload for scroll events combined with ctrl key (zoom gesture).
 *
 * @property deltaX - Horizontal scroll delta
 * @property deltaY - Vertical scroll delta
 * @property x - Cursor X coordinate in window space (zoom anchor point)
 * @property y - Cursor Y coordinate in window space (zoom anchor point)
 *
 * @category Input State Machine - KMT
 */
export type ScrollWithCtrlEventPayload = {
    deltaX: number;
    deltaY: number;
    x: number;
    y: number;
};

/**
 * Event mapping for the KMT input state machine.
 *
 * @remarks
 * Maps event names to their payload types. Used by the state machine framework
 * to provide type-safe event handling.
 *
 * Key events:
 * - **leftPointerDown/Up/Move**: Left mouse button interactions
 * - **middlePointerDown/Up/Move**: Middle mouse button interactions (pan)
 * - **spacebarDown/Up**: Spacebar for pan mode
 * - **scroll**: Regular scroll (pan or zoom depending on device)
 * - **scrollWithCtrl**: Ctrl + scroll (always zoom)
 * - **disable/enable**: Temporarily disable/enable input processing
 *
 * @category Input State Machine - KMT
 */
export type KmtInputEventMapping = {
    leftPointerDown: PointerEventPayload;
    leftPointerUp: PointerEventPayload;
    leftPointerMove: PointerEventPayload;
    spacebarDown: EmptyPayload;
    spacebarUp: EmptyPayload;
    escapeKey: EmptyPayload;
    stayIdle: EmptyPayload;
    cursorOnElement: EmptyPayload;
    scroll: ScrollWithCtrlEventPayload;
    scrollWithCtrl: ScrollWithCtrlEventPayload;
    middlePointerDown: PointerEventPayload;
    middlePointerUp: PointerEventPayload;
    middlePointerMove: PointerEventPayload;
    disable: EmptyPayload;
    enable: EmptyPayload;
    pointerMove: PointerEventPayload;
    arrowUp: EmptyPayload;
    arrowDown: EmptyPayload;
    F: EmptyPayload;
    G: EmptyPayload;
    Q: EmptyPayload;
};

/**
 * @internal
 */
type PanEventOutput = {
    type: 'pan';
    delta: Point;
};

/**
 * @internal
 */
type ZoomEventOutput = {
    type: 'zoom';
    delta: number;
    anchorPoint: Point;
};

/**
 * Output events produced by the KMT state machine for the orchestrator.
 *
 * @remarks
 * These high-level gesture events are the result of recognizing patterns in raw DOM events.
 * The orchestrator receives these events and coordinates camera control and observer notification.
 *
 * **Event Types**:
 * - **pan**: Camera translation with delta in viewport coordinates
 * - **zoom**: Camera scale change with anchor point in viewport coordinates
 * - **rotate**: Camera rotation change (currently unused in KMT)
 * - **cursor**: Cursor style change request (handled by state uponEnter/beforeExit)
 * - **none**: No action required
 *
 * **Coordinate Spaces**:
 * - Pan delta is in viewport pixels
 * - Zoom anchor point is in viewport coordinates (origin at viewport center)
 *
 * @category Input State Machine - KMT
 */
export type KmtOutputEvent =
    | { type: 'pan'; delta: Point }
    | { type: 'zoom'; delta: number; anchorPointInViewPort: Point }
    | { type: 'rotate'; deltaRotation: number }
    | { type: 'cursor'; style: CursorStyle }
    | { type: 'none' };

/**
 * Mapping of events to their output types.
 *
 * @remarks
 * Defines which events produce outputs. Not all events produce outputs - some only
 * cause state transitions. This mapping is used by the state machine framework for
 * type-safe output handling.
 *
 * @category Input State Machine - KMT
 */
export type KmtInputEventOutputMapping = {
    middlePointerMove: KmtOutputEvent;
    scroll: KmtOutputEvent;
    scrollWithCtrl: KmtOutputEvent;
    leftPointerMove: KmtOutputEvent;
};

/**
 * @internal
 */
export type KmtIdleStatePossibleTargetStates =
    | 'IDLE'
    | 'READY_TO_PAN_VIA_SPACEBAR'
    | 'READY_TO_PAN_VIA_SCROLL_WHEEL'
    | 'DISABLED';

/**
 * Largest zoom change a single wheel event may make: ×1.25 in, ÷1.25 out.
 *
 * @remarks
 * The camera rig applies a zoom delta additively (`zoom + delta·zoom`), and a
 * standard Windows wheel notch is `deltaY = 100`, so a delta linear in
 * `deltaY` can take a single zoom-out notch to a zoom ≤ 0. {@link KmtIdleState}
 * instead treats the scaled wheel delta as a log step (`delta = exp(step) − 1`),
 * which keeps the zoom positive and in/out symmetric, and caps the step at
 * this factor so one event is bounded whatever `deltaY` the platform reports.
 * Small trackpad/pinch deltas are effectively unchanged.
 *
 * @category Input State Machine - KMT
 */
export const MAX_WHEEL_ZOOM_FACTOR = 1.25;

const WHEEL_ZOOM_SENSITIVITY = 0.025;
const MAX_WHEEL_ZOOM_LOG_STEP = Math.log(MAX_WHEEL_ZOOM_FACTOR);

/**
 * IDLE state - default state waiting for user input.
 *
 * @remarks
 * This is the default state of the KMT input state machine. It handles scroll events
 * for panning and zooming, and transitions to pan-ready states when the user presses
 * spacebar or middle-click.
 *
 * **Responsibilities**:
 * - Process scroll events (pan or zoom depending on device and modifiers)
 * - Detect spacebar press to enter pan mode
 * - Detect middle-click to enter pan mode
 * - Distinguish between mouse and trackpad input modalities
 *
 * **Scroll Behavior**:
 * - Ctrl + Scroll: Always zoom (both mouse and trackpad)
 * - Scroll (no Ctrl): Pan (trackpad) or Zoom (mouse, determined by modality detection)
 *
 * **Input Modality Detection**:
 * The state tracks horizontal scroll deltas to distinguish trackpads (which produce deltaX)
 * from mice (which typically only produce deltaY). This affects zoom behavior.
 *
 * @category Input State Machine - KMT
 */
export class KmtIdleState extends TemplateState<
    KmtInputEventMapping,
    KmtInputContext,
    KmtInputStates,
    KmtInputEventOutputMapping
> {
    constructor() {
        super();
    }

    protected _guards: Guard<KmtInputContext, 'isIdle'> = {
        isIdle: () => true,
    };

    protected _eventGuards: Partial<
        EventGuards<
            KmtInputEventMapping,
            KmtInputStates,
            KmtInputContext,
            Guard<KmtInputContext>
        >
    > = {};

    // Arrow function properties must be defined before _eventReactions to ensure proper initialization order
    scrollPan = (
        context: KmtInputContext,
        payload: ScrollEventPayload
    ): KmtOutputEvent => {
        const delta = { ...payload };
        if (!context.alignCoordinateSystem) {
            delta.deltaY = -delta.deltaY;
        }
        return {
            type: 'pan',
            delta: { x: delta.deltaX, y: delta.deltaY },
        };
    };

    scrollZoom = (
        context: KmtInputContext,
        payload: ScrollWithCtrlEventPayload
    ): KmtOutputEvent => {
        // Multiplicative and capped; see MAX_WHEEL_ZOOM_FACTOR.
        const zoomStep = Math.max(
            -MAX_WHEEL_ZOOM_LOG_STEP,
            Math.min(
                MAX_WHEEL_ZOOM_LOG_STEP,
                -payload.deltaY * WHEEL_ZOOM_SENSITIVITY
            )
        );
        const cursorPosition = { x: payload.x, y: payload.y };
        const anchorPointInViewPort =
            convertFromWindow2ViewPortWithCanvasOperator(
                cursorPosition,
                context.canvas,
                { x: context.canvas.width / 2, y: context.canvas.height / 2 },
                !context.alignCoordinateSystem
            );
        return {
            type: 'zoom',
            delta: Math.expm1(zoomStep),
            anchorPointInViewPort,
        };
    };

    scrollHandler = (
        context: KmtInputContext,
        payload: ScrollWithCtrlEventPayload
    ): KmtOutputEvent => {
        if (payload.deltaX === 0 && payload.deltaY !== 0) {
            context.addKmtTrackpadTrackScore();
        } else if (payload.deltaX !== 0 && payload.deltaY !== 0) {
            context.subtractKmtTrackpadTrackScore();
        }
        if (context.mode === 'kmt') {
            return this.scrollZoom(context, payload);
        } else {
            return this.scrollPan(context, payload);
        }
    };

    scrollWithCtrlHandler = (
        context: KmtInputContext,
        payload: ScrollWithCtrlEventPayload
    ): KmtOutputEvent => {
        return this.scrollZoom(context, payload);
    };

    protected _eventReactions: EventReactions<
        KmtInputEventMapping,
        KmtInputContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    > = {
            spacebarDown: {
                action: this.spacebarDownHandler,
                defaultTargetState: 'READY_TO_PAN_VIA_SPACEBAR',
            },
            scroll: {
                action: this.scrollHandler,
                defaultTargetState: 'IDLE',
            },
            scrollWithCtrl: {
                action: this.scrollWithCtrlHandler,
                defaultTargetState: 'IDLE',
            },
            middlePointerDown: {
                action: this.middlePointerDownHandler,
                defaultTargetState: 'READY_TO_PAN_VIA_SCROLL_WHEEL',
            },
            disable: {
                action: NO_OP,
                defaultTargetState: 'DISABLED',
            },
        };

    uponEnter(context: KmtInputContext): void {
        context.canvas.setCursor(CursorStyle.DEFAULT);
    }

    spacebarDownHandler(
        context: KmtInputContext,
        payload: EmptyPayload
    ): number {
        // context.canvas.setCursor(CursorStyle.GRAB);
        return 1;
    }

    middlePointerDownHandler(
        context: KmtInputContext,
        payload: PointerEventPayload
    ): void {
        // probably from kmt
        context.addKmtTrackpadTrackScore();
        if (context.mode === 'TBD') {
            context.setMode('kmt');
        }
        context.setInitialCursorPosition({ x: payload.x, y: payload.y });
    }
}

export class DisabledState extends TemplateState<
    KmtInputEventMapping,
    KmtInputContext,
    KmtInputStates,
    KmtInputEventOutputMapping
> {
    constructor() {
        super();
    }

    uponEnter(context: KmtInputContext): void {
        context.canvas.setCursor(CursorStyle.DEFAULT);
        // context.toggleOnEdgeAutoCameraInput();
    }

    beforeExit(context: KmtInputContext): void {
        // context.toggleOffEdgeAutoCameraInput();
    }

    protected _eventReactions: EventReactions<
        KmtInputEventMapping,
        KmtInputContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    > = {
            enable: {
                action: NO_OP,
                defaultTargetState: 'IDLE',
            },
        };
}

/**
 * @description The ready to pan via space bar state of the keyboard mouse and trackpad input state machine.
 *
 * @category Input State Machine
 */
export class ReadyToPanViaSpaceBarState extends TemplateState<
    KmtInputEventMapping,
    KmtInputContext,
    KmtInputStates,
    KmtInputEventOutputMapping
> {
    constructor() {
        super();
    }

    protected _eventReactions: EventReactions<
        KmtInputEventMapping,
        KmtInputContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    > = {
            spacebarUp: {
                action: NO_OP,
                defaultTargetState: 'IDLE',
            },
            leftPointerDown: {
                action: this.leftPointerDownHandler,
                defaultTargetState: 'INITIAL_PAN',
            },
            disable: {
                action: context => context.cancelCurrentAction(),
                defaultTargetState: 'DISABLED',
            },
            leftPointerMove: {
                action: NO_OP,
                defaultTargetState: 'READY_TO_PAN_VIA_SPACEBAR',
            },
        };

    uponEnter(context: KmtInputContext): void {
        context.canvas.setCursor(CursorStyle.GRAB);
    }

    leftPointerDownHandler(
        context: KmtInputContext,
        payload: PointerEventPayload
    ): void {
        context.setInitialCursorPosition({ x: payload.x, y: payload.y });
    }
}

/**
 * @description The initial pan state of the keyboard mouse and trackpad input state machine.
 *
 * @category Input State Machine
 */
export class InitialPanState extends TemplateState<
    KmtInputEventMapping,
    KmtInputContext,
    KmtInputStates,
    KmtInputEventOutputMapping
> {
    constructor() {
        super();
    }

    protected _eventReactions: EventReactions<
        KmtInputEventMapping,
        KmtInputContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    > = {
            leftPointerUp: {
                action: NO_OP,
                defaultTargetState: 'READY_TO_PAN_VIA_SPACEBAR',
            },
            leftPointerMove: {
                action: this.leftPointerMoveHandler,
                defaultTargetState: 'PAN',
            },
            spacebarUp: {
                action: () => 'IDLE',
                defaultTargetState: 'IDLE',
            },
            leftPointerDown: {
                action: () => 'PAN',
                defaultTargetState: 'PAN',
            },
        };

    uponEnter(context: KmtInputContext): void {
        context.canvas.setCursor(CursorStyle.GRABBING);
    }

    leftPointerMoveHandler(
        context: KmtInputContext,
        payload: PointerEventPayload
    ): KmtOutputEvent {
        const delta = {
            x: context.initialCursorPosition.x - payload.x,
            y: context.initialCursorPosition.y - payload.y,
        };
        if (!context.alignCoordinateSystem) {
            delta.y = -delta.y;
        }
        context.setInitialCursorPosition({ x: payload.x, y: payload.y });
        return {
            type: 'pan',
            delta: delta,
        };
    }
}

/**
 * @description The ready to pan via scroll wheel state of the keyboard mouse and trackpad input state machine.
 *
 * @category Input State Machine
 */
export class ReadyToPanViaScrollWheelState extends TemplateState<
    KmtInputEventMapping,
    KmtInputContext,
    KmtInputStates,
    KmtInputEventOutputMapping
> {
    constructor() {
        super();
    }

    protected _eventReactions: EventReactions<
        KmtInputEventMapping,
        KmtInputContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    > = {
            middlePointerUp: {
                action: NO_OP,
                defaultTargetState: 'IDLE',
            },
            middlePointerMove: {
                action: NO_OP,
                defaultTargetState: 'PAN_VIA_SCROLL_WHEEL',
            },
        };

    uponEnter(context: KmtInputContext): void {
        context.canvas.setCursor(CursorStyle.GRABBING);
    }
}

/**
 * @description The pan state of the keyboard mouse and trackpad input state machine.
 *
 * @category Input State Machine
 */
export class PanState extends TemplateState<
    KmtInputEventMapping,
    KmtInputContext,
    KmtInputStates,
    KmtInputEventOutputMapping
> {
    constructor() {
        super();
    }

    protected _eventReactions: EventReactions<
        KmtInputEventMapping,
        KmtInputContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    > = {
            leftPointerUp: {
                action: NO_OP,
                defaultTargetState: 'READY_TO_PAN_VIA_SPACEBAR',
            },
            leftPointerMove: {
                action: this.leftPointerMoveHandler,
                defaultTargetState: 'PAN',
            },
            spacebarUp: {
                action: NO_OP,
                defaultTargetState: 'IDLE',
            },
        };

    uponEnter(context: KmtInputContext): void {
        context.canvas.setCursor(CursorStyle.GRABBING);
    }

    beforeExit(context: KmtInputContext): void {
        context.canvas.setCursor(CursorStyle.DEFAULT);
    }

    leftPointerMoveHandler(
        context: KmtInputContext,
        payload: PointerEventPayload
    ): KmtOutputEvent {
        const delta = {
            x: context.initialCursorPosition.x - payload.x,
            y: context.initialCursorPosition.y - payload.y,
        };
        if (!context.alignCoordinateSystem) {
            delta.y = -delta.y;
        }
        context.setInitialCursorPosition({ x: payload.x, y: payload.y });
        return {
            type: 'pan',
            delta: delta,
        };
    }
}

/**
 * @description The pan via scroll wheel state of the keyboard mouse and trackpad input state machine.
 *
 * @category Input State Machine
 */
export class PanViaScrollWheelState extends TemplateState<
    KmtInputEventMapping,
    KmtInputContext,
    KmtInputStates,
    KmtInputEventOutputMapping
> {
    protected _eventReactions: EventReactions<
        KmtInputEventMapping,
        KmtInputContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    > = {
            middlePointerUp: {
                action: NO_OP,
                defaultTargetState: 'IDLE',
            },
            middlePointerMove: {
                action: this.middlePointerMoveHandler,
                defaultTargetState: 'PAN_VIA_SCROLL_WHEEL',
            },
        };

    middlePointerMoveHandler(
        context: KmtInputContext,
        payload: PointerEventPayload
    ): KmtOutputEvent {
        const delta = {
            x: context.initialCursorPosition.x - payload.x,
            y: context.initialCursorPosition.y - payload.y,
        };
        if (!context.alignCoordinateSystem) {
            delta.y = -delta.y;
        }
        context.setInitialCursorPosition({ x: payload.x, y: payload.y });
        return {
            type: 'pan',
            delta: delta,
        };
    }

    uponEnter(context: KmtInputContext): void {
        context.canvas.setCursor(CursorStyle.GRABBING);
    }
}

export class KmtEmptyState extends TemplateState<
    KmtInputEventMapping,
    KmtInputContext,
    KmtInputStates,
    KmtInputEventOutputMapping
> {
    constructor() {
        super();
    }
}

/**
 * Type alias for the KMT input state machine.
 *
 * @category Input State Machine - KMT
 */
export type KmtInputStateMachine = TemplateStateMachine<
    KmtInputEventMapping,
    KmtInputContext,
    KmtInputStates,
    KmtInputEventOutputMapping
>;

/**
 * Creates a new KMT (Keyboard/Mouse/Trackpad) input state machine.
 *
 * @param context - The context providing state and canvas access for the state machine
 * @returns A configured state machine ready to process KMT input events
 *
 * @remarks
 * This factory function creates a fully configured state machine with all KMT gesture
 * recognition states. The state machine processes raw input events and produces
 * high-level gesture outputs (pan, zoom, rotate).
 *
 * **State Flow**:
 * ```
 * IDLE → (spacebar) → READY_TO_PAN_VIA_SPACEBAR → (click) → INITIAL_PAN → PAN
 * IDLE → (middle-click) → READY_TO_PAN_VIA_SCROLL_WHEEL → PAN_VIA_SCROLL_WHEEL
 * IDLE → (scroll) → [produces pan or zoom output, stays in IDLE]
 * ```
 *
 * **Gesture Recognition**:
 * - **Pan via spacebar**: Spacebar + left-click drag
 * - **Pan via middle-click**: Middle-click drag
 * - **Zoom**: Ctrl + scroll (mouse) or scroll (trackpad, auto-detected)
 * - **Pan via scroll**: Scroll (trackpad) or scroll without Ctrl (varies by device)
 *
 * @category Input State Machine - KMT
 *
 * @example
 * ```typescript
 * const canvasProxy = new CanvasProxy(canvasElement);
 * const context = new ObservableInputTracker(canvasProxy);
 * const stateMachine = createKmtInputStateMachine(context);
 *
 * // Process an event
 * const result = stateMachine.happens("scroll", {
 *   deltaX: 0,
 *   deltaY: 10,
 *   x: 500,
 *   y: 300
 * });
 *
 * // Check for output
 * if (result.output) {
 *   console.log("Gesture recognized:", result.output.type);
 * }
 * ```
 */
export function createKmtInputStateMachine(
    context: KmtInputContext
): KmtInputStateMachine {
    const states = {
        IDLE: new KmtIdleState(),
        READY_TO_PAN_VIA_SPACEBAR: new ReadyToPanViaSpaceBarState(),
        INITIAL_PAN: new InitialPanState(),
        PAN: new PanState(),
        READY_TO_PAN_VIA_SCROLL_WHEEL: new ReadyToPanViaScrollWheelState(),
        PAN_VIA_SCROLL_WHEEL: new PanViaScrollWheelState(),
        DISABLED: new DisabledState(),
    };
    return new TemplateStateMachine<
        KmtInputEventMapping,
        KmtInputContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    >(states, 'IDLE', context);
}

export function createKmtInputStateMachineWithCanvas(
    canvas: Canvas
): KmtInputStateMachine {
    const context = new ObservableInputTracker(canvas);

    return createKmtInputStateMachine(context);
}

export class KmtInputStateMachineWebWorkerProxy extends TemplateStateMachine<
    KmtInputEventMapping,
    KmtInputContext,
    KmtInputStates,
    KmtInputEventOutputMapping
> {
    private _webworker: Worker;

    constructor(webworker: Worker) {
        super(
            {
                IDLE: new KmtEmptyState(),
                READY_TO_PAN_VIA_SPACEBAR: new KmtEmptyState(),
                INITIAL_PAN: new KmtEmptyState(),
                PAN: new KmtEmptyState(),
                READY_TO_PAN_VIA_SCROLL_WHEEL: new KmtEmptyState(),
                PAN_VIA_SCROLL_WHEEL: new KmtEmptyState(),
                DISABLED: new DisabledState(),
            },
            'IDLE',
            new DummyKmtInputContext()
        );
        this._webworker = webworker;
    }

    happens(
        ...args: EventArgs<
            KmtInputEventMapping,
            keyof KmtInputEventMapping | string
        >
    ): EventResult<KmtInputStates> {
        this._webworker.postMessage({
            type: 'kmtInputStateMachine',
            event: args[0],
            payload: args[1],
        });
        return { handled: true, nextState: 'IDLE' };
    }
}
