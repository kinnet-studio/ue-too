import {
    EventGuards,
    EventReactions,
    Guard,
    State,
    StateExtender,
    TemplateState,
    TemplateStateMachine,
    createStateExtender,
} from '@ue-too/being';
import { PointCal } from '@ue-too/math';
import type { Point } from '@ue-too/math';

import { TouchContext, TouchPoints } from './touch-input-context';

/**
 * Possible states of the touch input state machine.
 *
 * @remarks
 * State transitions:
 * - **IDLE**: No touches active, or single touch (reserved for UI)
 * - **PENDING**: Exactly two touches active, waiting for movement to determine gesture type
 * - **IN_PROGRESS**: Two-finger gesture in progress (pan or zoom)
 *
 * The state machine only handles two-finger gestures. Single-finger touches are ignored
 * to avoid interfering with UI interactions (button clicks, text selection, etc.).
 *
 * @category Input State Machine - Touch
 */
export type TouchStates = 'IDLE' | 'PENDING' | 'IN_PROGRESS';

/**
 * Payload for touch events containing active touch points.
 *
 * @property points - Array of touch points involved in this event
 *
 * @category Input State Machine - Touch
 */
export type TouchEventPayload = {
    points: TouchPoints[];
};

/**
 * Output events produced by the touch state machine for the orchestrator.
 *
 * @remarks
 * Touch gestures are recognized from two-finger interactions:
 *
 * **Pan Gesture**:
 * - Two fingers move in the same direction
 * - Delta is calculated from the midpoint movement
 * - Triggers when midpoint delta > distance delta
 *
 * **Zoom Gesture**:
 * - Two fingers move toward/away from each other (pinch)
 * - Delta is calculated from distance change between fingers
 * - Anchor point is the midpoint between fingers
 * - Triggers when distance delta > midpoint delta
 *
 * **Coordinate Spaces**:
 * - Pan delta is in window pixels
 * - Zoom anchor point is in viewport coordinates
 *
 * @category Input State Machine - Touch
 */
export type TouchOutputEvent =
    | { type: 'pan'; delta: Point }
    | { type: 'zoom'; delta: number; anchorPointInViewPort: Point }
    | { type: 'none' };

/**
 * Event mapping for the touch input state machine.
 *
 * @remarks
 * Maps touch event names to their payload types. The state machine handles
 * the three core touch events: touchstart, touchmove, and touchend.
 *
 * @category Input State Machine - Touch
 */
export type TouchEventMapping = {
    touchstart: TouchEventPayload;
    touchmove: TouchEventPayload;
    touchend: TouchEventPayload;
};

/**
 * Mapping of events to their output types.
 *
 * @remarks
 * Only touchmove produces outputs (pan or zoom gestures).
 * touchstart and touchend only manage state transitions.
 *
 * @category Input State Machine - Touch
 */
export type TouchInputEventOutputMapping = {
    touchmove: TouchOutputEvent;
};

/**
 * IDLE state - waiting for two-finger touch.
 *
 * @remarks
 * This state handles touch lifecycle but only transitions to PENDING when exactly
 * two touches are active. Single touches and three+ touches are ignored.
 *
 * **Guard Condition**:
 * Transitions to PENDING only when `getCurrentTouchPointsCount() === 2`.
 * This ensures the state machine only handles two-finger gestures.
 *
 * @category Input State Machine - Touch
 */
export class IdleState extends TemplateState<
    TouchEventMapping,
    TouchContext,
    TouchStates,
    TouchInputEventOutputMapping
> {
    protected _eventReactions: EventReactions<
        TouchEventMapping,
        TouchContext,
        TouchStates,
        TouchInputEventOutputMapping
    > = {
        touchstart: {
            action: this.touchstart,
            defaultTargetState: 'IDLE',
        },
        touchend: {
            action: this.touchend,
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<TouchContext, 'touchPointsCount'> = {
        touchPointsCount: ((context: TouchContext) => {
            return context.getCurrentTouchPointsCount() === 2;
        }).bind(this),
    };

    protected _eventGuards: Partial<
        EventGuards<
            TouchEventMapping,
            TouchStates,
            TouchContext,
            typeof this._guards
        >
    > = {
        touchstart: [
            {
                guard: 'touchPointsCount',
                target: 'PENDING',
            },
        ],
        touchend: [
            {
                guard: 'touchPointsCount',
                target: 'PENDING',
            },
        ],
    };

    touchstart(context: TouchContext, payload: TouchEventPayload): void {
        context.addTouchPoints(payload.points);
    }

    touchend(context: TouchContext, payload: TouchEventPayload): void {
        context.removeTouchPoints(payload.points.map(p => p.ident));
    }
}

/**
 * @description The pending state of the touch input state machine.
 *
 * @category Input State Machine
 */
export class PendingState extends TemplateState<
    TouchEventMapping,
    TouchContext,
    TouchStates,
    TouchInputEventOutputMapping
> {
    protected _eventReactions: EventReactions<
        TouchEventMapping,
        TouchContext,
        TouchStates,
        TouchInputEventOutputMapping
    > = {
        touchstart: {
            action: this.touchstart,
            defaultTargetState: 'IDLE',
        },
        touchend: {
            action: this.touchend,
            defaultTargetState: 'IDLE',
        },
        touchmove: {
            action: this.touchmove,
            defaultTargetState: 'IN_PROGRESS',
        },
    };

    touchstart(context: TouchContext, payload: TouchEventPayload): void {
        context.addTouchPoints(payload.points);
    }

    touchend(context: TouchContext, payload: TouchEventPayload): void {
        context.removeTouchPoints(payload.points.map(p => p.ident));
    }

    touchmove(
        context: TouchContext,
        payload: TouchEventPayload
    ): TouchOutputEvent {
        const idents = payload.points.map(p => p.ident);
        const initialPositions = context.getInitialTouchPointsPositions(idents);
        const currentPositions = payload.points;
        const initialStartAndEndDistance = PointCal.distanceBetweenPoints(
            initialPositions[0],
            initialPositions[1]
        );
        const currentStartAndEndDistance = PointCal.distanceBetweenPoints(
            currentPositions[0],
            currentPositions[1]
        );
        const midPoint = PointCal.linearInterpolation(
            initialPositions[0],
            initialPositions[1],
            0.5
        );
        const currentMidPoint = PointCal.linearInterpolation(
            currentPositions[0],
            currentPositions[1],
            0.5
        );
        const midPointDelta = PointCal.subVector(midPoint, currentMidPoint);
        const cameraCenterInWindow = {
            x: context.canvas.position.x + context.canvas.width / 2,
            y: context.canvas.position.y + context.canvas.height / 2,
        };
        const midPointInViewPort = PointCal.subVector(
            midPoint,
            cameraCenterInWindow
        );
        let panZoom =
            Math.abs(currentStartAndEndDistance - initialStartAndEndDistance) >
            PointCal.distanceBetweenPoints(midPoint, currentMidPoint)
                ? 'ZOOMING'
                : 'PANNING';

        context.updateTouchPoints(currentPositions);
        switch (panZoom) {
            case 'ZOOMING':
                return {
                    type: 'zoom',
                    delta:
                        (currentStartAndEndDistance -
                            initialStartAndEndDistance) *
                        0.005,
                    anchorPointInViewPort: midPointInViewPort,
                };
            case 'PANNING':
                return {
                    type: 'pan',
                    delta: midPointDelta,
                };
            default:
                console.warn('Unknown panZoom state', panZoom);
                return { type: 'none' };
        }
    }
}

/**
 * @description The in progress state of the touch input state machine.
 *
 * @category Input State Machine
 */
export class InProgressState extends TemplateState<
    TouchEventMapping,
    TouchContext,
    TouchStates,
    TouchInputEventOutputMapping
> {
    protected _eventReactions: EventReactions<
        TouchEventMapping,
        TouchContext,
        TouchStates,
        TouchInputEventOutputMapping
    > = {
        touchmove: {
            action: this.touchmove,
            defaultTargetState: 'IN_PROGRESS',
        },
        touchend: {
            action: this.touchend,
            defaultTargetState: 'IDLE',
        },
        touchstart: {
            action: () => 'IDLE',
            defaultTargetState: 'IDLE',
        },
    };

    touchmove(
        context: TouchContext,
        payload: TouchEventPayload
    ): TouchOutputEvent {
        const idents = payload.points.map(p => p.ident);
        const initialPositions = context.getInitialTouchPointsPositions(idents);
        const currentPositions = payload.points;
        const initialStartAndEndDistance = PointCal.distanceBetweenPoints(
            initialPositions[0],
            initialPositions[1]
        );
        const currentStartAndEndDistance = PointCal.distanceBetweenPoints(
            currentPositions[0],
            currentPositions[1]
        );
        const midPoint = PointCal.linearInterpolation(
            initialPositions[0],
            initialPositions[1],
            0.5
        );
        const currentMidPoint = PointCal.linearInterpolation(
            currentPositions[0],
            currentPositions[1],
            0.5
        );
        const midPointDelta = PointCal.subVector(midPoint, currentMidPoint);
        const cameraCenterInWindow = {
            x: context.canvas.position.x + context.canvas.width / 2,
            y: context.canvas.position.y + context.canvas.height / 2,
        };
        const midPointInViewPort = PointCal.subVector(
            midPoint,
            cameraCenterInWindow
        );
        let panZoom =
            Math.abs(currentStartAndEndDistance - initialStartAndEndDistance) >
            PointCal.distanceBetweenPoints(midPoint, currentMidPoint)
                ? 'ZOOMING'
                : 'PANNING';

        context.updateTouchPoints(currentPositions);
        switch (panZoom) {
            case 'ZOOMING':
                if (!context.alignCoordinateSystem) {
                    midPointInViewPort.y = -midPointInViewPort.y;
                }
                return {
                    type: 'zoom',
                    delta:
                        -(
                            initialStartAndEndDistance -
                            currentStartAndEndDistance
                        ) * 0.005,
                    anchorPointInViewPort: midPointInViewPort,
                };
            case 'PANNING':
                if (!context.alignCoordinateSystem) {
                    midPointDelta.y = -midPointDelta.y;
                }
                return {
                    type: 'pan',
                    delta: midPointDelta,
                };
            default:
                console.warn('Unknown panZoom state', panZoom);
                return { type: 'none' };
        }
    }

    touchend(context: TouchContext, payload: TouchEventPayload): void {
        context.removeTouchPoints(payload.points.map(p => p.ident));
    }
}

/**
 * Type alias for the touch input state machine.
 *
 * @category Input State Machine - Touch
 */
export type TouchInputStateMachine = TemplateStateMachine<
    TouchEventMapping,
    TouchContext,
    TouchStates,
    TouchInputEventOutputMapping
>;

/**
 * Creates a new touch input state machine for multi-touch gesture recognition.
 *
 * @param context - The context providing touch point tracking and canvas access
 * @returns A configured state machine ready to process touch events
 *
 * @remarks
 * This factory creates a state machine that recognizes two-finger pan and pinch-to-zoom gestures.
 *
 * **State Flow**:
 * ```
 * IDLE → (2 touches start) → PENDING → (touch move) → IN_PROGRESS
 * IN_PROGRESS → (touch end) → IDLE
 * ```
 *
 * **Gesture Recognition Algorithm**:
 * 1. Wait for exactly 2 touches (IDLE → PENDING)
 * 2. On first move, determine gesture type:
 *    - If distance change > midpoint change: ZOOM
 *    - If midpoint change > distance change: PAN
 * 3. Continue producing pan/zoom outputs until touches end
 *
 * **Pan Gesture**:
 * Delta = current midpoint - initial midpoint
 *
 * **Zoom Gesture**:
 * Delta = (current distance - initial distance) * 0.005
 * Anchor = midpoint in viewport coordinates
 *
 * @category Input State Machine - Touch
 *
 * @example
 * ```typescript
 * const canvasProxy = new CanvasProxy(canvasElement);
 * const context = new TouchInputTracker(canvasProxy);
 * const stateMachine = createTouchInputStateMachine(context);
 *
 * // Process a touch start event with 2 fingers
 * const result = stateMachine.happens("touchstart", {
 *   points: [
 *     {ident: 0, x: 100, y: 200},
 *     {ident: 1, x: 300, y: 200}
 *   ]
 * });
 * console.log(result.nextState); // "PENDING"
 * ```
 */
export function createTouchInputStateMachine(
    context: TouchContext
): TouchInputStateMachine {
    return new TemplateStateMachine<
        TouchEventMapping,
        TouchContext,
        TouchStates,
        TouchInputEventOutputMapping
    >(
        {
            IDLE: new IdleState(),
            PENDING: new PendingState(),
            IN_PROGRESS: new InProgressState(),
        },
        'IDLE',
        context
    );
}

/**
 * The callback {@link expandTouchInputStateMachine} calls with the stock states.
 *
 * @remarks
 * `stock` holds every built-in touch state already typed for the expanded
 * machine; `extend` is {@link createStateExtender} bound to the same generics.
 * Return the full state map for the expanded machine.
 *
 * @category Input State Machine - Touch
 */
export type TouchInputStateMachineExpansion<
    E extends TouchEventMapping,
    C extends TouchContext,
    S extends string,
    O extends TouchInputEventOutputMapping & Partial<Record<keyof E, unknown>>,
> = (
    stock: Record<TouchStates, State<E, C, S, O>>,
    extend: StateExtender<E, C, S, O>
) => Record<S, State<E, C, S, O>>;

/**
 * Builds a touch input state machine with more events, states, context or
 * outputs than the stock one, reusing every built-in state.
 *
 * @param context - The expanded context; must satisfy {@link TouchContext}
 * @param define - Receives the stock states and an `extend` helper, returns the
 * expanded state map. See {@link TouchInputStateMachineExpansion}.
 * @param initialState - Defaults to `'IDLE'`
 * @returns A machine over the expanded generics
 *
 * @remarks
 * Same rules as {@link expandKmtInputStateMachine}: every generic must be a
 * superset of the stock one, `S` must include every {@link TouchStates} member,
 * and shared events keep the stock payload.
 *
 * @category Input State Machine - Touch
 */
export function expandTouchInputStateMachine<
    E extends TouchEventMapping,
    C extends TouchContext,
    S extends string,
    O extends TouchInputEventOutputMapping & Partial<Record<keyof E, unknown>>,
>(
    context: C,
    define: [TouchStates] extends [S]
        ? TouchInputStateMachineExpansion<E, C, S, O>
        : { error: 'expanded states must include every TouchStates member' },
    initialState: S = 'IDLE' as S
): TemplateStateMachine<E, C, S, O> {
    const widen = (
        state: State<
            TouchEventMapping,
            TouchContext,
            TouchStates,
            TouchInputEventOutputMapping
        >
    ) => state as unknown as State<E, C, S, O>;
    const stock: Record<TouchStates, State<E, C, S, O>> = {
        IDLE: widen(new IdleState()),
        PENDING: widen(new PendingState()),
        IN_PROGRESS: widen(new InProgressState()),
    };
    const states = (define as TouchInputStateMachineExpansion<E, C, S, O>)(
        stock,
        createStateExtender<E, C, S, O>()
    );
    return new TemplateStateMachine<E, C, S, O>(states, initialState, context);
}
