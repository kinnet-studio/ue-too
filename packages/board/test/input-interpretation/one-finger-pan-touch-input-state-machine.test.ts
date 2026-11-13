import { NO_OP, TemplateState } from '@ue-too/being';
import type { EventReactions } from '@ue-too/being';
import { PointCal } from '@ue-too/math';
import { describe, expect, it } from 'vitest';

import {
    OneFingerPanTouchInputEventOutputMapping,
    OneFingerPanTouchStates,
    TouchContext,
    TouchEventMapping,
    TouchInputTracker,
    TouchOutputEvent,
    createOneFingerPanTouchInputStateMachine,
    expandOneFingerPanTouchInputStateMachine,
} from '../../src/input-interpretation/input-state-machine';
import { DummyCanvas } from '../../src/input-interpretation/input-state-machine/kmt-input-context';

// Canvas at (10, 20), 200 × 100, so its center in the window is (110, 70).
function createTracker(alignCoordinateSystem = true): TouchInputTracker {
    const canvas = new DummyCanvas();
    canvas.position = { x: 10, y: 20 };
    canvas.width = 200;
    canvas.height = 100;
    const tracker = new TouchInputTracker(canvas);
    tracker.alignCoordinateSystem = alignCoordinateSystem;
    return tracker;
}

function createMachine(alignCoordinateSystem = true) {
    return createOneFingerPanTouchInputStateMachine(
        createTracker(alignCoordinateSystem)
    );
}

function moveOutput(
    machine: ReturnType<typeof createMachine>,
    points: { ident: number; x: number; y: number }[]
): TouchOutputEvent[] {
    const result = machine.happens('touchmove', { points });
    expect(result.handled).toBe(true);
    return (result as { output: TouchOutputEvent[] }).output;
}

describe('createOneFingerPanTouchInputStateMachine', () => {
    it('starts in IDLE', () => {
        expect(createMachine().currentState).toBe('IDLE');
    });

    it('enters PANNING when one finger goes down', () => {
        const machine = createMachine();
        machine.happens('touchstart', {
            points: [{ ident: 0, x: 100, y: 100 }],
        });
        expect(machine.currentState).toBe('PANNING');
    });

    it('pans by how far the finger moved since the last move', () => {
        const machine = createMachine();
        machine.happens('touchstart', {
            points: [{ ident: 0, x: 100, y: 100 }],
        });
        expect(moveOutput(machine, [{ ident: 0, x: 130, y: 90 }])).toEqual([
            { type: 'pan', delta: { x: -30, y: 10 } },
        ]);
        expect(moveOutput(machine, [{ ident: 0, x: 140, y: 90 }])).toEqual([
            { type: 'pan', delta: { x: -10, y: 0 } },
        ]);
    });

    it('flips the pan y delta when the coordinate system is not aligned', () => {
        const machine = createMachine(false);
        machine.happens('touchstart', {
            points: [{ ident: 0, x: 100, y: 100 }],
        });
        expect(moveOutput(machine, [{ ident: 0, x: 130, y: 90 }])).toEqual([
            { type: 'pan', delta: { x: -30, y: -10 } },
        ]);
    });

    it('enters PINCHING when a second finger goes down', () => {
        const machine = createMachine();
        machine.happens('touchstart', {
            points: [{ ident: 0, x: 100, y: 100 }],
        });
        machine.happens('touchstart', {
            points: [{ ident: 1, x: 200, y: 100 }],
        });
        expect(machine.currentState).toBe('PINCHING');
    });

    it('enters PINCHING when two fingers go down together', () => {
        const machine = createMachine();
        machine.happens('touchstart', {
            points: [
                { ident: 0, x: 100, y: 100 },
                { ident: 1, x: 200, y: 100 },
            ],
        });
        expect(machine.currentState).toBe('PINCHING');
    });

    it('zooms by the ratio of finger spread around the midpoint', () => {
        const machine = createMachine();
        machine.happens('touchstart', {
            points: [
                { ident: 0, x: 100, y: 100 },
                { ident: 1, x: 200, y: 100 },
            ],
        });
        // Spread goes 100 → 120 around a fixed midpoint at (150, 100).
        const output = moveOutput(machine, [
            { ident: 0, x: 90, y: 100 },
            { ident: 1, x: 210, y: 100 },
        ]);
        expect(output).toEqual([
            { type: 'pan', delta: { x: 0, y: 0 } },
            {
                type: 'zoom',
                delta: expect.closeTo(0.2, 10),
                anchorPointInViewPort: { x: 40, y: 30 },
            },
        ]);
    });

    it('pans with the midpoint while pinching', () => {
        const machine = createMachine();
        machine.happens('touchstart', {
            points: [
                { ident: 0, x: 100, y: 100 },
                { ident: 1, x: 200, y: 100 },
            ],
        });
        // Both fingers slide by (+20, +10) without changing their spread.
        const output = moveOutput(machine, [
            { ident: 0, x: 120, y: 110 },
            { ident: 1, x: 220, y: 110 },
        ]);
        expect(output).toEqual([
            { type: 'pan', delta: { x: -20, y: -10 } },
            {
                type: 'zoom',
                delta: 0,
                anchorPointInViewPort: { x: 60, y: 40 },
            },
        ]);
    });

    it('flips pinch pan and anchor y when the coordinate system is not aligned', () => {
        const machine = createMachine(false);
        machine.happens('touchstart', {
            points: [
                { ident: 0, x: 100, y: 100 },
                { ident: 1, x: 200, y: 100 },
            ],
        });
        const output = moveOutput(machine, [
            { ident: 0, x: 120, y: 110 },
            { ident: 1, x: 220, y: 110 },
        ]);
        expect(output).toEqual([
            { type: 'pan', delta: { x: -20, y: 10 } },
            {
                type: 'zoom',
                delta: 0,
                anchorPointInViewPort: { x: 60, y: -40 },
            },
        ]);
    });

    it('does not zoom when the two fingers start on the same spot', () => {
        const machine = createMachine();
        machine.happens('touchstart', {
            points: [
                { ident: 0, x: 100, y: 100 },
                { ident: 1, x: 100, y: 100 },
            ],
        });
        const output = moveOutput(machine, [
            { ident: 0, x: 90, y: 100 },
            { ident: 1, x: 110, y: 100 },
        ]);
        expect(output).toEqual([{ type: 'pan', delta: { x: 0, y: 0 } }]);
    });

    it('stays PINCHING on the first two fingers when a third goes down', () => {
        const machine = createMachine();
        machine.happens('touchstart', {
            points: [
                { ident: 0, x: 100, y: 100 },
                { ident: 1, x: 200, y: 100 },
            ],
        });
        machine.happens('touchstart', {
            points: [{ ident: 2, x: 500, y: 500 }],
        });
        expect(machine.currentState).toBe('PINCHING');
        const output = moveOutput(machine, [
            { ident: 0, x: 90, y: 100 },
            { ident: 1, x: 210, y: 100 },
            { ident: 2, x: 900, y: 900 },
        ]);
        expect(output[1]).toMatchObject({
            type: 'zoom',
            delta: expect.closeTo(0.2, 10),
        });
    });

    it('goes back to PANNING with the remaining finger, without a jump', () => {
        const machine = createMachine();
        machine.happens('touchstart', {
            points: [
                { ident: 0, x: 100, y: 100 },
                { ident: 1, x: 200, y: 100 },
            ],
        });
        moveOutput(machine, [
            { ident: 0, x: 90, y: 100 },
            { ident: 1, x: 210, y: 100 },
        ]);
        machine.happens('touchend', {
            points: [{ ident: 0, x: 90, y: 100 }],
        });
        expect(machine.currentState).toBe('PANNING');
        // Finger 1 was last at (210, 100), so the pan starts from there.
        expect(moveOutput(machine, [{ ident: 1, x: 220, y: 100 }])).toEqual([
            { type: 'pan', delta: { x: -10, y: 0 } },
        ]);
    });

    it('returns to IDLE when the last finger lifts', () => {
        const machine = createMachine();
        machine.happens('touchstart', {
            points: [{ ident: 0, x: 100, y: 100 }],
        });
        machine.happens('touchend', {
            points: [{ ident: 0, x: 100, y: 100 }],
        });
        expect(machine.currentState).toBe('IDLE');
    });

    it('returns to IDLE when both pinching fingers lift together', () => {
        const machine = createMachine();
        machine.happens('touchstart', {
            points: [
                { ident: 0, x: 100, y: 100 },
                { ident: 1, x: 200, y: 100 },
            ],
        });
        machine.happens('touchend', {
            points: [
                { ident: 0, x: 100, y: 100 },
                { ident: 1, x: 200, y: 100 },
            ],
        });
        expect(machine.currentState).toBe('IDLE');
    });

    it('ignores moves while IDLE', () => {
        const machine = createMachine();
        const result = machine.happens('touchmove', {
            points: [{ ident: 0, x: 100, y: 100 }],
        });
        expect(result.handled).toBe(false);
        expect(machine.currentState).toBe('IDLE');
    });
});

// ---------------- expansion ----------------
type ExpEvents = TouchEventMapping & { longPress: {} };
type ExpStates = OneFingerPanTouchStates | 'HOLD';

class HoldState extends TemplateState<
    ExpEvents,
    TouchContext,
    ExpStates,
    OneFingerPanTouchInputEventOutputMapping
> {
    protected _eventReactions: EventReactions<
        ExpEvents,
        TouchContext,
        ExpStates,
        OneFingerPanTouchInputEventOutputMapping
    > = {
        touchend: { action: NO_OP, defaultTargetState: 'IDLE' },
    };
}

describe('expandOneFingerPanTouchInputStateMachine', () => {
    it('hands the callback every stock state', () => {
        let keys: string[] = [];
        expandOneFingerPanTouchInputStateMachine<
            TouchEventMapping,
            TouchContext,
            OneFingerPanTouchStates,
            OneFingerPanTouchInputEventOutputMapping
        >(createTracker(), stock => {
            keys = Object.keys(stock).sort();
            return stock;
        });
        expect(keys).toEqual(['IDLE', 'PANNING', 'PINCHING'].sort());
    });

    it('keeps stock behaviour in states it leaves alone', () => {
        const machine = expandOneFingerPanTouchInputStateMachine<
            ExpEvents,
            TouchContext,
            ExpStates,
            OneFingerPanTouchInputEventOutputMapping
        >(createTracker(), (stock, extend) => ({
            ...stock,
            IDLE: extend(stock.IDLE, {
                eventReactions: {
                    longPress: { action: NO_OP, defaultTargetState: 'HOLD' },
                },
            }),
            HOLD: new HoldState(),
        }));
        machine.happens('touchstart', {
            points: [{ ident: 0, x: 100, y: 100 }],
        });
        expect(machine.currentState).toBe('PANNING');
        const result = machine.happens('touchmove', {
            points: [{ ident: 0, x: 130, y: 90 }],
        });
        expect(result).toMatchObject({
            output: [{ type: 'pan', delta: { x: -30, y: 10 } }],
        });
    });

    it('lets an extension wrap an inherited reaction', () => {
        // Same as the expandOneFingerPanTouchInputStateMachine doc example.
        const machine = expandOneFingerPanTouchInputStateMachine<
            TouchEventMapping,
            TouchContext,
            OneFingerPanTouchStates,
            OneFingerPanTouchInputEventOutputMapping
        >(createTracker(), (stock, extend) => ({
            ...stock,
            PANNING: extend(stock.PANNING, {
                eventReactions: inherited => ({
                    touchmove: {
                        ...inherited.touchmove!,
                        action: (context, payload, machine) =>
                            inherited
                                .touchmove!.action(context, payload, machine)
                                ?.map(output =>
                                    output.type === 'pan'
                                        ? {
                                              ...output,
                                              delta: PointCal.multiplyVectorByScalar(
                                                  output.delta,
                                                  0.5
                                              ),
                                          }
                                        : output
                                ),
                    },
                }),
            }),
        }));
        machine.happens('touchstart', {
            points: [{ ident: 0, x: 100, y: 100 }],
        });
        const result = machine.happens('touchmove', {
            points: [{ ident: 0, x: 130, y: 90 }],
        });
        expect(result).toMatchObject({
            output: [{ type: 'pan', delta: { x: -15, y: 5 } }],
        });
    });

    it('reaches an added state through an added event', () => {
        const machine = expandOneFingerPanTouchInputStateMachine<
            ExpEvents,
            TouchContext,
            ExpStates,
            OneFingerPanTouchInputEventOutputMapping
        >(createTracker(), (stock, extend) => ({
            ...stock,
            IDLE: extend(stock.IDLE, {
                eventReactions: {
                    longPress: { action: NO_OP, defaultTargetState: 'HOLD' },
                },
            }),
            HOLD: new HoldState(),
        }));
        machine.happens('longPress');
        expect(machine.currentState).toBe('HOLD');
        machine.happens('touchend', { points: [] });
        expect(machine.currentState).toBe('IDLE');
    });
});
