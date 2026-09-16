import { describe, expect, it } from 'vitest';

import { DelegatingState } from '../src/delegating-state';
import {
    BaseContext,
    EventReactions,
    NO_OP,
    TemplateState,
    TemplateStateMachine,
} from '../src/interface';

// ---- child machine: a two-state toggle that reports an output on "tick" ----
type ChildEvents = { tick: {}; toggle: {} };
type ChildStates = 'A' | 'B';
type ChildOut = { tick: { type: 'ticked'; in: ChildStates } };

interface ChildContext extends BaseContext {
    setups: number;
    cleanups: number;
}

class ChildA extends TemplateState<
    ChildEvents,
    ChildContext,
    ChildStates,
    ChildOut
> {
    protected _eventReactions: EventReactions<
        ChildEvents,
        ChildContext,
        ChildStates,
        ChildOut
    > = {
        tick: { action: () => ({ type: 'ticked', in: 'A' }) },
        toggle: { action: NO_OP, defaultTargetState: 'B' },
    };
}
class ChildB extends TemplateState<
    ChildEvents,
    ChildContext,
    ChildStates,
    ChildOut
> {
    protected _eventReactions: EventReactions<
        ChildEvents,
        ChildContext,
        ChildStates,
        ChildOut
    > = {
        tick: { action: () => ({ type: 'ticked', in: 'B' }) },
        toggle: { action: NO_OP, defaultTargetState: 'A' },
    };
}
type ChildMachine = TemplateStateMachine<
    ChildEvents,
    ChildContext,
    ChildStates,
    ChildOut
>;

function createChild(context: ChildContext): ChildMachine {
    return new TemplateStateMachine<
        ChildEvents,
        ChildContext,
        ChildStates,
        ChildOut
    >(
        { A: new ChildA(), B: new ChildB() },
        'A',
        context,
        false // parent lifecycle starts it
    );
}

// ---- parent machine: IDLE <-> MOVE, where MOVE hosts the child ----
type ParentEvents = { enterMove: {}; exitMove: {} };
type ParentStates = 'IDLE' | 'MOVE';

class ParentIdle extends TemplateState<
    ParentEvents,
    BaseContext,
    ParentStates
> {
    protected _eventReactions: EventReactions<
        ParentEvents,
        BaseContext,
        ParentStates
    > = {
        enterMove: { action: NO_OP, defaultTargetState: 'MOVE' },
    };
}

class ParentMove extends DelegatingState<
    ParentEvents,
    BaseContext,
    ParentStates,
    ChildMachine
> {
    protected _eventReactions: EventReactions<
        ParentEvents,
        BaseContext,
        ParentStates
    > = {
        exitMove: { action: NO_OP, defaultTargetState: 'IDLE' },
    };
}

function setup() {
    const childContext: ChildContext = {
        setups: 0,
        cleanups: 0,
        setup() {
            this.setups++;
        },
        cleanup() {
            this.cleanups++;
        },
    };
    const move = new ParentMove(createChild(childContext));
    const parent = new TemplateStateMachine<
        ParentEvents,
        BaseContext,
        ParentStates
    >({ IDLE: new ParentIdle(), MOVE: move }, 'IDLE', {
        setup() {},
        cleanup() {},
    });
    return { parent, move, childContext };
}

describe('DelegatingState', () => {
    it('exposes the child machine it was constructed with', () => {
        const { move } = setup();
        expect(move.child.currentState).toBeDefined();
    });

    it('starts the child when the parent enters the state', () => {
        const { parent, move, childContext } = setup();
        expect(childContext.setups).toBe(0);
        parent.happens('enterMove');
        expect(childContext.setups).toBe(1);
        expect(move.child.currentState).toBe('A');
    });

    it('forwards an event the child handles and returns the child output', () => {
        const { parent } = setup();
        parent.happens('enterMove');
        const result = parent.happens('tick');
        expect(result).toEqual({
            handled: true,
            output: { type: 'ticked', in: 'A' },
        });
    });

    it('lets the child transition while the parent stays put', () => {
        const { parent, move } = setup();
        parent.happens('enterMove');
        parent.happens('toggle');
        expect(move.child.currentState).toBe('B');
        expect(parent.currentState).toBe('MOVE');
        expect(parent.happens('tick')).toMatchObject({
            output: { type: 'ticked', in: 'B' },
        });
    });

    it('falls through to its own reactions for events the child does not handle', () => {
        const { parent } = setup();
        parent.happens('enterMove');
        const result = parent.happens('exitMove');
        expect(result.handled).toBe(true);
        expect(parent.currentState).toBe('IDLE');
    });

    it('wraps up the child when the parent leaves the state', () => {
        const { parent, move, childContext } = setup();
        parent.happens('enterMove');
        parent.happens('exitMove');
        expect(childContext.cleanups).toBe(1);
        expect(move.child.currentState).toBe('TERMINAL');
    });

    it('restarts the child from its initial state on re-entry', () => {
        const { parent, move, childContext } = setup();
        parent.happens('enterMove');
        parent.happens('toggle');
        parent.happens('exitMove');
        parent.happens('enterMove');
        expect(childContext.setups).toBe(2);
        expect(move.child.currentState).toBe('A');
    });

    it('reports unhandled when neither the child nor the state reacts', () => {
        const { parent } = setup();
        parent.happens('enterMove');
        expect(parent.happens('nonsense')).toEqual({ handled: false });
        expect(parent.currentState).toBe('MOVE');
    });
});
