import { describe, expect, it } from 'vitest';

import {
    createStateExtender,
    createStateWidener,
    extendState,
} from '../src/expansion';
import {
    BaseContext,
    EventReactions,
    Guard,
    NO_OP,
    State,
    TemplateState,
    TemplateStateMachine,
} from '../src/interface';

// ---- the original ("small") machine ----
type SmallEvents = { a: {}; b: { x: number } };
type SmallStates = 'S1' | 'S2';
type SmallOut = { b: { type: 'pan'; x: number } };

interface SmallContext extends BaseContext {
    entered: string[];
    exited: string[];
}

class SmallS1 extends TemplateState<
    SmallEvents,
    SmallContext,
    SmallStates,
    SmallOut
> {
    protected _eventReactions: EventReactions<
        SmallEvents,
        SmallContext,
        SmallStates,
        SmallOut
    > = {
        a: { action: NO_OP, defaultTargetState: 'S2' },
        b: { action: (_c, p) => ({ type: 'pan', x: p.x }) },
    };
    uponEnter(context: SmallContext): void {
        context.entered.push('S1');
    }
    beforeExit(context: SmallContext): void {
        context.exited.push('S1');
    }
}
class SmallS2 extends TemplateState<
    SmallEvents,
    SmallContext,
    SmallStates,
    SmallOut
> {
    protected _eventReactions: EventReactions<
        SmallEvents,
        SmallContext,
        SmallStates,
        SmallOut
    > = {
        a: { action: NO_OP, defaultTargetState: 'S1' },
    };
}

// ---- the expanded ("big") machine ----
type BigEvents = SmallEvents & { c: {} };
type BigStates = SmallStates | 'S3';
type BigOut = SmallOut & { c: { type: 'rotate' } };
interface BigContext extends SmallContext {
    allowC: boolean;
}

class BigS3 extends TemplateState<BigEvents, BigContext, BigStates, BigOut> {
    protected _eventReactions: EventReactions<
        BigEvents,
        BigContext,
        BigStates,
        BigOut
    > = {
        c: { action: () => ({ type: 'rotate' }), defaultTargetState: 'S1' },
    };
}

const widen = createStateWidener<BigEvents, BigContext, BigStates, BigOut>();

function createContext(): BigContext {
    return { entered: [], exited: [], allowC: true, setup() {}, cleanup() {} };
}

function createBigMachine(
    s1: State<BigEvents, BigContext, BigStates, BigOut>,
    context = createContext()
) {
    return new TemplateStateMachine<BigEvents, BigContext, BigStates, BigOut>(
        { S1: s1, S2: widen(new SmallS2()), S3: new BigS3() },
        'S1',
        context
    );
}

describe('createStateWidener', () => {
    it('lets an original state run unchanged inside the expanded machine', () => {
        const machine = createBigMachine(widen(new SmallS1()));
        expect(machine.happens('b', { x: 7 })).toMatchObject({
            output: { type: 'pan', x: 7 },
        });
        machine.happens('a');
        expect(machine.currentState).toBe('S2');
    });

    it('leaves expanded-only events unhandled in a widened original state', () => {
        const machine = createBigMachine(widen(new SmallS1()));
        expect(machine.happens('c')).toEqual({ handled: false });
        expect(machine.currentState).toBe('S1');
    });

    it('rejects a target that narrows the original at the type level', () => {
        const narrow = createStateWidener<
            { a: {} },
            BigContext,
            BigStates,
            {}
        >();
        // @ts-expect-error - dropping event "b" is not a superset of SmallEvents
        const bad: State<{ a: {} }, BigContext, BigStates, {}> = narrow(
            new SmallS1()
        );
        expect(bad).toBeDefined();
    });
});

describe('extendState', () => {
    it('keeps the inherited reactions when nothing is overridden', () => {
        const machine = createBigMachine(
            extendState<BigEvents, BigContext, BigStates, BigOut>(
                new SmallS1(),
                {}
            )
        );
        expect(machine.happens('b', { x: 3 })).toMatchObject({
            output: { type: 'pan', x: 3 },
        });
    });

    it('adds reactions for expanded events', () => {
        const s1 = extendState<BigEvents, BigContext, BigStates, BigOut>(
            new SmallS1(),
            {
                eventReactions: {
                    c: {
                        action: () => ({ type: 'rotate' as const }),
                        defaultTargetState: 'S3',
                    },
                },
            }
        );
        const machine = createBigMachine(s1);
        expect(machine.happens('c')).toMatchObject({
            output: { type: 'rotate' },
        });
        expect(machine.currentState).toBe('S3');
    });

    it('lets an override wrap the inherited reaction', () => {
        const s1 = extendState<BigEvents, BigContext, BigStates, BigOut>(
            new SmallS1(),
            {
                eventReactions: inherited => {
                    const base = inherited.b!;
                    return {
                        b: {
                            ...base,
                            action: (context, payload, machine) => {
                                const out = base.action(
                                    context,
                                    payload,
                                    machine
                                );
                                return out ? { ...out, x: out.x * 2 } : out;
                            },
                        },
                    };
                },
            }
        );
        const machine = createBigMachine(s1);
        expect(machine.happens('b', { x: 5 })).toMatchObject({
            output: { type: 'pan', x: 10 },
        });
        // untouched inherited reaction still there
        machine.happens('a');
        expect(machine.currentState).toBe('S2');
    });

    it('runs the inherited uponEnter and beforeExit through the wrappers', () => {
        const s1 = extendState<BigEvents, BigContext, BigStates, BigOut>(
            new SmallS1(),
            {
                uponEnter: (context, _m, _from, inherited) => {
                    inherited();
                    context.entered.push('extra');
                },
                beforeExit: (context, _m, _to, inherited) => {
                    context.exited.push('pre');
                    inherited();
                },
            }
        );
        const context = createContext();
        const machine = createBigMachine(s1, context);
        expect(context.entered).toEqual(['S1', 'extra']);
        machine.happens('a');
        expect(context.exited).toEqual(['pre', 'S1']);
    });

    it('merges added guards with the inherited ones', () => {
        const s1 = extendState<BigEvents, BigContext, BigStates, BigOut>(
            new SmallS1(),
            {
                guards: { allowC: context => context.allowC } as Guard<
                    BigContext,
                    'allowC'
                >,
                eventReactions: {
                    c: { action: NO_OP, defaultTargetState: 'S1' },
                },
                eventGuards: { c: [{ guard: 'allowC', target: 'S3' }] },
            }
        );
        const context = createContext();
        const machine = createBigMachine(s1, context);
        machine.happens('c');
        expect(machine.currentState).toBe('S3');
    });
});

describe('createStateExtender', () => {
    it('binds the expansion generics once for repeated use', () => {
        const extend = createStateExtender<
            BigEvents,
            BigContext,
            BigStates,
            BigOut
        >();
        const s1 = extend(new SmallS1(), {
            eventReactions: { c: { action: NO_OP, defaultTargetState: 'S3' } },
        });
        const machine = createBigMachine(s1);
        machine.happens('c');
        expect(machine.currentState).toBe('S3');
    });
});
