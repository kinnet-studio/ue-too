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

import { convertFromWindow2ViewPortWithCanvasOperator } from '../../utils/coorindate-conversion';
import { TouchContext, TouchPoints } from './touch-input-context';
import {
    TouchEventMapping,
    TouchEventPayload,
    TouchOutputEvent,
} from './touch-input-state-machine';

/**
 * States of the one-finger-pan touch input state machine.
 *
 * @remarks
 * - **IDLE**: No fingers down
 * - **PANNING**: One finger down; moving it pans the camera
 * - **PINCHING**: Two or more fingers down; the first two pinch-zoom and pan
 *
 * Every `touchstart` and `touchend` picks the next state from the number of
 * fingers still down, so lifting one finger mid-pinch drops back to
 * **PANNING** with the finger that remains.
 *
 * @category Input State Machine - Touch
 */
export type OneFingerPanTouchStates = 'IDLE' | 'PANNING' | 'PINCHING';

/**
 * Outputs of the one-finger-pan touch input state machine.
 *
 * @remarks
 * `touchmove` always outputs an array: one `pan` while **PANNING**, and a
 * `pan` followed by a `zoom` while **PINCHING**.
 * {@link InputOrchestrator.processInputEventOutput} applies them in order.
 *
 * @category Input State Machine - Touch
 */
export type OneFingerPanTouchInputEventOutputMapping = {
    touchmove: TouchOutputEvent[];
};

function createFingerCountGuards(): Guard<
    TouchContext,
    'oneFinger' | 'twoOrMoreFingers'
> {
    return {
        oneFinger: context => context.getCurrentTouchPointsCount() === 1,
        twoOrMoreFingers: context => context.getCurrentTouchPointsCount() >= 2,
    };
}

function createFingerCountEventGuards(): Partial<
    EventGuards<
        TouchEventMapping,
        OneFingerPanTouchStates,
        TouchContext,
        Guard<TouchContext, 'oneFinger' | 'twoOrMoreFingers'>
    >
> {
    const byFingerCount = () => [
        { guard: 'oneFinger' as const, target: 'PANNING' as const },
        { guard: 'twoOrMoreFingers' as const, target: 'PINCHING' as const },
    ];
    return {
        touchstart: byFingerCount(),
        touchend: byFingerCount(),
    };
}

function addFingers(context: TouchContext, payload: TouchEventPayload): void {
    context.addTouchPoints(payload.points);
}

function removeFingers(
    context: TouchContext,
    payload: TouchEventPayload
): void {
    context.removeTouchPoints(payload.points.map(point => point.ident));
}

function findPoint(points: TouchPoints[], ident: number): TouchPoints {
    // The tracker only returns fingers whose idents are in `points`.
    return points.find(point => point.ident === ident) as TouchPoints;
}

function flipYUnlessAligned(context: TouchContext, point: Point): Point {
    return context.alignCoordinateSystem ? point : { x: point.x, y: -point.y };
}

/**
 * Base for the one-finger-pan states: every state tracks fingers going down
 * and up, then moves to the state that matches how many are left.
 *
 * @category Input State Machine - Touch
 */
abstract class FingerCountState extends TemplateState<
    TouchEventMapping,
    TouchContext,
    OneFingerPanTouchStates,
    OneFingerPanTouchInputEventOutputMapping
> {
    protected _guards: Guard<TouchContext, 'oneFinger' | 'twoOrMoreFingers'> =
        createFingerCountGuards();

    protected _eventGuards: Partial<
        EventGuards<
            TouchEventMapping,
            OneFingerPanTouchStates,
            TouchContext,
            Guard<TouchContext, 'oneFinger' | 'twoOrMoreFingers'>
        >
    > = createFingerCountEventGuards();
}

/**
 * IDLE state: no fingers down.
 *
 * @remarks
 * One finger going down moves to **PANNING**, two or more to **PINCHING**.
 * Moves are not handled here.
 *
 * @category Input State Machine - Touch
 */
export class OneFingerPanIdleState extends FingerCountState {
    protected _eventReactions: EventReactions<
        TouchEventMapping,
        TouchContext,
        OneFingerPanTouchStates,
        OneFingerPanTouchInputEventOutputMapping
    > = {
        touchstart: { action: addFingers, defaultTargetState: 'IDLE' },
        touchend: { action: removeFingers, defaultTargetState: 'IDLE' },
    };
}

/**
 * PANNING state: one finger down, and moving it pans the camera.
 *
 * @remarks
 * Each move outputs a `pan` by how far the finger travelled since the
 * previous move, in window pixels, with y flipped when
 * {@link TouchContext.alignCoordinateSystem} is `false`. A second finger
 * going down moves to **PINCHING**; lifting the finger moves to **IDLE**.
 *
 * @category Input State Machine - Touch
 */
export class OneFingerPanPanningState extends FingerCountState {
    protected _eventReactions: EventReactions<
        TouchEventMapping,
        TouchContext,
        OneFingerPanTouchStates,
        OneFingerPanTouchInputEventOutputMapping
    > = {
        touchstart: { action: addFingers, defaultTargetState: 'IDLE' },
        touchend: { action: removeFingers, defaultTargetState: 'IDLE' },
        touchmove: {
            action: (context, payload) => this.touchmove(context, payload),
            defaultTargetState: 'PANNING',
        },
    };

    touchmove(
        context: TouchContext,
        payload: TouchEventPayload
    ): TouchOutputEvent[] {
        const [previous] = context.getInitialTouchPointsPositions(
            payload.points.map(point => point.ident)
        );
        context.updateTouchPoints(payload.points);
        if (previous === undefined) {
            return [];
        }
        const current = findPoint(payload.points, previous.ident);
        return [
            {
                type: 'pan',
                delta: flipYUnlessAligned(
                    context,
                    PointCal.subVector(previous, current)
                ),
            },
        ];
    }
}

/**
 * PINCHING state: two or more fingers down; the first two pinch-zoom and pan.
 *
 * @remarks
 * Each move uses the first two tracked fingers in the move payload and
 * outputs, in order:
 * 1. a `pan` by how far their midpoint travelled since the previous move
 * 2. a `zoom` of `currentSpread / previousSpread - 1` anchored at the
 *    current midpoint (in viewport coordinates)
 *
 * The camera rig scales a zoom delta by the current zoom level, so this
 * keeps the content under both fingers. The `zoom` is left out when the two
 * fingers were on the same spot. Y is flipped in both outputs when
 * {@link TouchContext.alignCoordinateSystem} is `false`.
 *
 * Lifting fingers until one is left moves to **PANNING** with that finger;
 * lifting all of them moves to **IDLE**.
 *
 * @category Input State Machine - Touch
 */
export class OneFingerPanPinchingState extends FingerCountState {
    protected _eventReactions: EventReactions<
        TouchEventMapping,
        TouchContext,
        OneFingerPanTouchStates,
        OneFingerPanTouchInputEventOutputMapping
    > = {
        touchstart: { action: addFingers, defaultTargetState: 'IDLE' },
        touchend: { action: removeFingers, defaultTargetState: 'IDLE' },
        touchmove: {
            action: (context, payload) => this.touchmove(context, payload),
            defaultTargetState: 'PINCHING',
        },
    };

    touchmove(
        context: TouchContext,
        payload: TouchEventPayload
    ): TouchOutputEvent[] {
        const [previousA, previousB] = context.getInitialTouchPointsPositions(
            payload.points.map(point => point.ident)
        );
        context.updateTouchPoints(payload.points);
        if (previousA === undefined || previousB === undefined) {
            return [];
        }
        const currentA = findPoint(payload.points, previousA.ident);
        const currentB = findPoint(payload.points, previousB.ident);

        const previousMidpoint = PointCal.linearInterpolation(
            previousA,
            previousB,
            0.5
        );
        const currentMidpoint = PointCal.linearInterpolation(
            currentA,
            currentB,
            0.5
        );
        const outputs: TouchOutputEvent[] = [
            {
                type: 'pan',
                delta: flipYUnlessAligned(
                    context,
                    PointCal.subVector(previousMidpoint, currentMidpoint)
                ),
            },
        ];

        const previousSpread = PointCal.distanceBetweenPoints(
            previousA,
            previousB
        );
        if (previousSpread > 0) {
            const currentSpread = PointCal.distanceBetweenPoints(
                currentA,
                currentB
            );
            outputs.push({
                type: 'zoom',
                delta: currentSpread / previousSpread - 1,
                anchorPointInViewPort:
                    convertFromWindow2ViewPortWithCanvasOperator(
                        currentMidpoint,
                        context.canvas,
                        {
                            x: context.canvas.width / 2,
                            y: context.canvas.height / 2,
                        },
                        !context.alignCoordinateSystem
                    ),
            });
        }
        return outputs;
    }
}

/**
 * Type alias for the one-finger-pan touch input state machine.
 *
 * @category Input State Machine - Touch
 */
export type OneFingerPanTouchInputStateMachine = TemplateStateMachine<
    TouchEventMapping,
    TouchContext,
    OneFingerPanTouchStates,
    OneFingerPanTouchInputEventOutputMapping
>;

/**
 * Creates a touch input state machine where one finger pans and two fingers
 * pinch-zoom.
 *
 * @param context - Touch point tracking and canvas access, e.g. a
 * {@link TouchInputTracker}
 * @returns A machine that takes the same events as
 * {@link createTouchInputStateMachine}'s
 *
 * @remarks
 * An opt-in alternative to the board's default touch machine, which leaves
 * single-finger touches alone for the app's own UI.
 *
 * **State Flow**:
 * ```
 * IDLE ──1 finger──▶ PANNING ──2nd finger──▶ PINCHING
 *   ▲                   │  ▲                     │
 *   └──last finger up───┘  └───down to 1 finger──┘
 * ```
 *
 * See {@link OneFingerPanPanningState} and {@link OneFingerPanPinchingState}
 * for the outputs. To change the behaviour, start from
 * {@link expandOneFingerPanTouchInputStateMachine}.
 *
 * @category Input State Machine - Touch
 *
 * @example
 * Use it on a board:
 * ```typescript
 * const board = new Board(canvas);
 * board.setTouchInputStateMachine(createOneFingerPanTouchInputStateMachine);
 * ```
 *
 * @example
 * Wire it to your own parser:
 * ```typescript
 * const machine = createOneFingerPanTouchInputStateMachine(
 *     new TouchInputTracker(canvasProxy)
 * );
 * const parser = new VanillaTouchEventParser(machine, orchestrator, canvas);
 * parser.setUp();
 * ```
 */
export function createOneFingerPanTouchInputStateMachine(
    context: TouchContext
): OneFingerPanTouchInputStateMachine {
    return new TemplateStateMachine<
        TouchEventMapping,
        TouchContext,
        OneFingerPanTouchStates,
        OneFingerPanTouchInputEventOutputMapping
    >(
        {
            IDLE: new OneFingerPanIdleState(),
            PANNING: new OneFingerPanPanningState(),
            PINCHING: new OneFingerPanPinchingState(),
        },
        'IDLE',
        context
    );
}

/**
 * The callback {@link expandOneFingerPanTouchInputStateMachine} calls with the
 * stock states.
 *
 * @remarks
 * `stock` holds every built-in one-finger-pan state already typed for the
 * expanded machine; `extend` is {@link createStateExtender} bound to the same
 * generics. Return the full state map for the expanded machine.
 *
 * @category Input State Machine - Touch
 */
export type OneFingerPanTouchInputStateMachineExpansion<
    E extends TouchEventMapping,
    C extends TouchContext,
    S extends string,
    O extends OneFingerPanTouchInputEventOutputMapping &
        Partial<Record<keyof E, unknown>>,
> = (
    stock: Record<OneFingerPanTouchStates, State<E, C, S, O>>,
    extend: StateExtender<E, C, S, O>
) => Record<S, State<E, C, S, O>>;

/**
 * Builds a one-finger-pan touch input state machine with more events, states,
 * context or outputs than the stock one, reusing every built-in state.
 *
 * @param context - The expanded context; must satisfy {@link TouchContext}
 * @param define - Receives the stock states and an `extend` helper, returns
 * the expanded state map. See {@link OneFingerPanTouchInputStateMachineExpansion}.
 * @param initialState - Defaults to `'IDLE'`
 * @returns A machine over the expanded generics
 *
 * @remarks
 * Same rules as {@link expandTouchInputStateMachine}: every generic must be a
 * superset of the stock one, `S` must include every
 * {@link OneFingerPanTouchStates} member, and shared events keep the stock
 * payload.
 *
 * @category Input State Machine - Touch
 *
 * @example
 * Halve the pan speed while panning with one finger:
 * ```typescript
 * const machine = expandOneFingerPanTouchInputStateMachine<
 *     TouchEventMapping,
 *     TouchContext,
 *     OneFingerPanTouchStates,
 *     OneFingerPanTouchInputEventOutputMapping
 * >(context, (stock, extend) => ({
 *     ...stock,
 *     PANNING: extend(stock.PANNING, {
 *         eventReactions: inherited => ({
 *             touchmove: {
 *                 ...inherited.touchmove!,
 *                 action: (context, payload, machine) =>
 *                     inherited.touchmove!.action(context, payload, machine)
 *                         ?.map(output =>
 *                             output.type === 'pan'
 *                                 ? { ...output, delta: PointCal.multiplyVectorByScalar(output.delta, 0.5) }
 *                                 : output
 *                         ),
 *             },
 *         }),
 *     }),
 * }));
 * ```
 */
export function expandOneFingerPanTouchInputStateMachine<
    E extends TouchEventMapping,
    C extends TouchContext,
    S extends string,
    O extends OneFingerPanTouchInputEventOutputMapping &
        Partial<Record<keyof E, unknown>>,
>(
    context: C,
    define: [OneFingerPanTouchStates] extends [S]
        ? OneFingerPanTouchInputStateMachineExpansion<E, C, S, O>
        : {
              error: 'expanded states must include every OneFingerPanTouchStates member';
          },
    initialState: S = 'IDLE' as S
): TemplateStateMachine<E, C, S, O> {
    const widen = (
        state: State<
            TouchEventMapping,
            TouchContext,
            OneFingerPanTouchStates,
            OneFingerPanTouchInputEventOutputMapping
        >
    ) => state as unknown as State<E, C, S, O>;
    const stock: Record<OneFingerPanTouchStates, State<E, C, S, O>> = {
        IDLE: widen(new OneFingerPanIdleState()),
        PANNING: widen(new OneFingerPanPanningState()),
        PINCHING: widen(new OneFingerPanPinchingState()),
    };
    const states = (
        define as OneFingerPanTouchInputStateMachineExpansion<E, C, S, O>
    )(stock, createStateExtender<E, C, S, O>());
    return new TemplateStateMachine<E, C, S, O>(states, initialState, context);
}
