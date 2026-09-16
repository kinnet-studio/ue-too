import { NO_OP, TemplateState } from '@ue-too/being';
import type { EventReactions } from '@ue-too/being';
import { describe, expect, it } from 'vitest';

import {
    DummyKmtInputContext,
    KmtInputContext,
    KmtInputEventMapping,
    KmtInputEventOutputMapping,
    KmtInputStates,
    KmtOutputEvent,
    PointerEventPayload,
    TouchContext,
    TouchEventMapping,
    TouchInputEventOutputMapping,
    TouchStates,
    createKmtInputStateMachine,
    expandKmtInputStateMachine,
    expandTouchInputStateMachine,
} from '../../src/input-interpretation/input-state-machine';
import { DummyCanvas } from '../../src/input-interpretation/input-state-machine/kmt-input-context';

// ---------------- KMT expansion under test ----------------
type ExpEvents = KmtInputEventMapping & { rightPointerUp: PointerEventPayload };
type ExpStates = KmtInputStates | 'PLACEMENT';
type ExpOut = KmtInputEventOutputMapping & { rightPointerUp: KmtOutputEvent };
type ExpContext = KmtInputContext & { placements: number };

class ExpContextImpl extends DummyKmtInputContext implements ExpContext {
    placements = 0;
}

class PlacementState extends TemplateState<
    ExpEvents,
    ExpContext,
    ExpStates,
    ExpOut
> {
    protected _eventReactions: EventReactions<
        ExpEvents,
        ExpContext,
        ExpStates,
        ExpOut
    > = {
        escapeKey: { action: NO_OP, defaultTargetState: 'IDLE' },
    };
    uponEnter(context: ExpContext): void {
        context.placements++;
    }
}

function createExpandedKmt(context = new ExpContextImpl()) {
    return expandKmtInputStateMachine<ExpEvents, ExpContext, ExpStates, ExpOut>(
        context,
        (stock, extend) => ({
            ...stock,
            IDLE: extend(stock.IDLE, {
                eventReactions: inherited => ({
                    rightPointerUp: {
                        action: () => ({ type: 'none' as const }),
                        defaultTargetState: 'PLACEMENT',
                    },
                    scroll: {
                        ...inherited.scroll!,
                        action: (c, payload, m) => {
                            const out = inherited.scroll!.action(c, payload, m);
                            return out && out.type === 'zoom'
                                ? { ...out, delta: out.delta / 2 }
                                : out;
                        },
                    },
                }),
            }),
            PLACEMENT: new PlacementState(),
        })
    );
}

describe('expandKmtInputStateMachine', () => {
    it('hands the callback every stock state already widened', () => {
        let keys: string[] = [];
        expandKmtInputStateMachine<
            KmtInputEventMapping,
            KmtInputContext,
            KmtInputStates,
            KmtInputEventOutputMapping
        >(new DummyKmtInputContext(), stock => {
            keys = Object.keys(stock).sort();
            return stock;
        });
        expect(keys).toEqual(
            [
                'IDLE',
                'READY_TO_PAN_VIA_SPACEBAR',
                'INITIAL_PAN',
                'PAN',
                'READY_TO_PAN_VIA_SCROLL_WHEEL',
                'PAN_VIA_SCROLL_WHEEL',
                'DISABLED',
            ].sort()
        );
    });

    it('keeps the stock gestures working in the expanded machine', () => {
        const machine = createExpandedKmt();
        machine.happens('spacebarDown');
        expect(machine.currentState).toBe('READY_TO_PAN_VIA_SPACEBAR');
        machine.happens('spacebarUp');
        expect(machine.currentState).toBe('IDLE');
    });

    it('reaches the added state through the added event and comes back', () => {
        const context = new ExpContextImpl();
        const machine = createExpandedKmt(context);
        machine.happens('rightPointerUp', { x: 1, y: 1 });
        expect(machine.currentState).toBe('PLACEMENT');
        expect(context.placements).toBe(1);
        machine.happens('escapeKey');
        expect(machine.currentState).toBe('IDLE');
    });

    it('lets an extension wrap an inherited reaction', () => {
        const payload = { x: 10, y: 10, deltaX: 0, deltaY: 40 };
        const stock = createKmtInputStateMachine(
            new DummyKmtInputContext()
        ).happens('scroll', payload);
        const expanded = createExpandedKmt().happens('scroll', payload);
        expect(stock).toMatchObject({ output: { type: 'zoom' } });
        expect(expanded).toMatchObject({ output: { type: 'zoom' } });
        const stockDelta = (stock as { output: { delta: number } }).output
            .delta;
        const expandedDelta = (expanded as { output: { delta: number } }).output
            .delta;
        expect(expandedDelta).toBeCloseTo(stockDelta / 2);
    });
});

// ---------------- touch expansion under test ----------------
type TouchExpEvents = TouchEventMapping & { longPress: {} };
type TouchExpStates = TouchStates | 'HOLD';

class DummyTouchContext implements TouchContext {
    alignCoordinateSystem = false;
    canvas = new DummyCanvas();
    addTouchPoints = NO_OP;
    removeTouchPoints = NO_OP;
    updateTouchPoints = NO_OP;
    getCurrentTouchPointsCount = () => 0;
    getInitialTouchPointsPositions = () => [];
    setup(): void {}
    cleanup(): void {}
}

class HoldState extends TemplateState<
    TouchExpEvents,
    TouchContext,
    TouchExpStates,
    TouchInputEventOutputMapping
> {
    protected _eventReactions: EventReactions<
        TouchExpEvents,
        TouchContext,
        TouchExpStates,
        TouchInputEventOutputMapping
    > = {
        touchend: { action: NO_OP, defaultTargetState: 'IDLE' },
    };
}

describe('expandTouchInputStateMachine', () => {
    it('hands the callback every stock touch state', () => {
        let keys: string[] = [];
        expandTouchInputStateMachine<
            TouchEventMapping,
            TouchContext,
            TouchStates,
            TouchInputEventOutputMapping
        >(new DummyTouchContext(), stock => {
            keys = Object.keys(stock).sort();
            return stock;
        });
        expect(keys).toEqual(['IDLE', 'PENDING', 'IN_PROGRESS'].sort());
    });

    it('reaches an added touch state through an added event', () => {
        const machine = expandTouchInputStateMachine<
            TouchExpEvents,
            TouchContext,
            TouchExpStates,
            TouchInputEventOutputMapping
        >(new DummyTouchContext(), (stock, extend) => ({
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
