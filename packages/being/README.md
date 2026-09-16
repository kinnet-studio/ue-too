# being

[![npm version](https://img.shields.io/npm/v/@ue-too/being.svg)](https://www.npmjs.com/package/@ue-too/being)
[![license](https://img.shields.io/npm/l/@ue-too/being.svg)](https://github.com/kinnet-studio/ue-too/blob/main/LICENSE.txt)

This is a library that helps with building finite state machines.

> Disclaimer: I am not an expert on finite state machines; this is just what I use and it works for me, and the features are tailored to what I need. You would probably be better off using a library like [xstate](https://stately.ai/docs).

> Try it live: the vending machine built below is shipped as `createVendingMachine`, and runs in the [state machine visualizer example](https://kinnet-studio.github.io/ue-too/state-machine-visualizer/) — state chart, event log and context inspector, driven by [`@ue-too/being-devtools`](https://github.com/kinnet-studio/ue-too/tree/main/packages/being-devtools).

If you still want to try it out, here is an example of how to use it:

Let's say we want to build a state machine for a vending machine.

To make it simple, the vending machine only accepts dollar bills and sells 3 types of items at $1, $2, and $3.

The items are:

- Coke (1 dollar)
- Red Bull (2 dollars)
- Water (3 dollars)

There are only 3 kinds of actions that the user can take:

- insert coins
- select an item (we can break it into multiple events; each event representing a different item)
- cancel the transaction

With the above information, we can create a state machine for the vending machine.

For the `@ue-too/being` library, there are 3 main things that we need to define and be clear on in order to create a state machine:

- All possible states of the state machine.
- All possible events that can happen in the state machine.
- The context of the state machine.
- The rules for the state transitions.

Let's start with the all possible states of the state machine.

> There are many ways to represent the vending machine in a state machine. My way is only one possible way but you can probably come up with a better way or at least what makes sense to you.

I'm defining the states as follows:

- IDLE
- 1 Dollar Inserted
- 2 Dollars Inserted
- 3 Dollars Inserted

To create a type that is a string literal union of the states, we can use the utilty type `CreateStateType`.

```ts
import { CreateStateType } from '@ue-too/being';

const VENDING_MACHINE_STATES = [
    'IDLE',
    'ONE_DOLLAR_INSERTED',
    'TWO_DOLLARS_INSERTED',
    'THREE_DOLLARS_INSERTED',
] as const;
export type VendingMachineStates = CreateStateType<
    typeof VENDING_MACHINE_STATES
>;
```

Next, we should define all the possible events and their payload.

```ts
type VendingMachineEvents = {
    insertBills: {};
    selectCoke: {};
    selectRedBull: {};
    selectWater: {};
    cancelTransaction: {};
};
```

Sometimes we need variables to keep track of certain attributes that can persists across different states; that's where the context comes along.

For this example we don't need keep tabs on any attribute, so we can just use the `BaseContext` as our interface of context.

The interface `State` and `StateMachine` only accepts context extending or implements the `BaseContext` to ensure that context has a `setup` and `cleanup` method.

```ts
import { BaseContext } from "@ue-too/being";

const context: BaseContext = {
    setup: () => void,
    cleanup: () => void,
}
```

Next, we can start implementing the different states of the state machine.

To do that we can use the `TemplateState` as a starting point.

`TemplateState` is an abstract class that covers most of the boilerplate code. You just need to define the reaction corresponding to the events.

`TemplateState` takes in 3 generic arguments which are (in order) all the event payload mapping, the context, and the type created using `CreateStateType` (essentially the union string of all the possible states the state machine can be in.)

There's only one thing required to override in the abstract class which is the `eventReactions`. For the type definition refer to the interface `EventReactions`.

It's an object with the key being the event name and the value being the reaction and the default target state to transition to after the reaction.

The `EventReactions` looks like this:

```ts
export type EventReactions<
    EventPayloadMapping,
    Context extends BaseContext,
    States extends string,
> = {
    [K in keyof Partial<EventPayloadMapping>]: {
        action: (
            context: Context,
            event: EventPayloadMapping[K],
            stateMachine: StateMachine<EventPayloadMapping, Context, States>
        ) => void;
        defaultTargetState?: States;
    };
};
```

The `defaultTargetState` is an optional property. if omitted, the state machine would stay in the current state after the reaction. (except for when there're guards to evaluate, but more on that later)

Now let's implement the `IdleState`.

In the idle state, we only care about the `insertBills` event.

```ts
import { EventReactions, TemplateState } from '@ue-too/being';

class IdleState extends TemplateState<
    VendingMachineEvents,
    BaseContext,
    VendingMachineStates
> {
    public eventReactions: EventReactions<
        VendingMachineEvents,
        BaseContext,
        VendingMachineStates
    > = {
        insertBills: {
            action: (context, event, stateMachine) => {
                console.log('inserted bills');
            },
            defaultTargetState: 'ONE_DOLLAR_INSERTED',
        },
    };
}
```

After that we can implement the `OneDollarInsertedState`.

```ts
import { EventReactions, TemplateState } from '@ue-too/being';

class OneDollarInsertedState extends TemplateState<
    VendingMachineEvents,
    BaseContext,
    VendingMachineStates
> {
    public eventReactions: EventReactions<
        VendingMachineEvents,
        BaseContext,
        VendingMachineStates
    > = {
        insertBills: {
            action: (context, event, stateMachine) => {
                console.log('inserted bills');
            },
            defaultTargetState: 'TWO_DOLLARS_INSERTED',
        },
        selectCoke: {
            action: (context, event, stateMachine) => {
                console.log('selected coke');
            },
            defaultTargetState: 'IDLE',
        },
        selectRedBull: {
            action: (context, event, stateMachine) => {
                console.log('not enough money, 1 dollar short');
            },
        },
        selectWater: {
            action: (context, event, stateMachine) => {
                console.log('not enough money, 2 dollars short');
            },
        },
        cancelTransaction: {
            action: (context, event, stateMachine) => {
                console.log('cancelled transaction');
                console.log('refunding 1 dollar');
            },
            defaultTargetState: 'IDLE',
        },
    };
}
```

For the implementation of the `TwoDollarsInsertedState` and `ThreeDollarsInsertedState`, it's very similar to the `OneDollarInsertedState`.

```ts
import { EventReactions, TemplateState } from '@ue-too/being';

class TwoDollarsInsertedState extends TemplateState<
    VendingMachineEvents,
    BaseContext,
    VendingMachineStates
> {
    public eventReactions: EventReactions<
        VendingMachineEvents,
        BaseContext,
        VendingMachineStates
    > = {
        insertBills: {
            action: (context, event, stateMachine) => {
                console.log('inserted bills');
            },
            defaultTargetState: 'THREE_DOLLARS_INSERTED',
        },
        selectCoke: {
            action: (context, event, stateMachine) => {
                console.log('selected coke');
            },
            defaultTargetState: 'IDLE',
        },
        selectRedBull: {
            action: (context, event, stateMachine) => {
                console.log('selected red bull');
            },
            defaultTargetState: 'IDLE',
        },
        selectWater: {
            action: (context, event, stateMachine) => {
                console.log('not enough money, 1 dollars short');
            },
        },
        cancelTransaction: {
            action: (context, event, stateMachine) => {
                console.log('cancelled transaction');
                console.log('refunding 2 dollars');
            },
            defaultTargetState: 'IDLE',
        },
    };
}

class ThreeDollarsInsertedState extends TemplateState<
    VendingMachineEvents,
    BaseContext,
    VendingMachineStates
> {
    public eventReactions: EventReactions<
        VendingMachineEvents,
        BaseContext,
        VendingMachineStates
    > = {
        insertBills: {
            action: (context, event, stateMachine) => {
                console.log('not taking more bills');
                console.log('returning the inserted bills');
            },
        },
        selectCoke: {
            action: (context, event, stateMachine) => {
                console.log('selected coke');
                console.log('no change');
            },
            defaultTargetState: 'IDLE',
        },
        selectRedBull: {
            action: (context, event, stateMachine) => {
                console.log('selected red bull');
                console.log('change: 1 dollar');
            },
            defaultTargetState: 'IDLE',
        },
        selectWater: {
            action: (context, event, stateMachine) => {
                console.log('selected water');
                console.log('no change');
            },
        },
        cancelTransaction: {
            action: (context, event, stateMachine) => {
                console.log('cancelled transaction');
                console.log('refunding 3 dollars');
            },
            defaultTargetState: 'IDLE',
        },
    };
}
```

With all the states implemented, we can now create the state machine.

```ts
import { TemplateStateMachine } from "@ue-too/being";

const context: BaseContext = {
    setup: () => void,
    cleanup: () => void,
}

const vendingMachine = new TemplateStateMachine<VendingMachineEvents, BaseContext, VendingMachineStates>({
    "IDLE": new IdleState(),
    "ONE_DOLLAR_INSERTED": new OneDollarInsertedState(),
    "TWO_DOLLARS_INSERTED": new TwoDollarsInsertedState(),
    "THREE_DOLLARS_INSERTED": new ThreeDollarsInsertedState(),
}, "IDLE", context);

vendingMachine.happens("insertBills");

vendingMachine.happens("selectCoke");

```

For the full complete example code, please refer to the `src/vending-machine-example.ts` file.

## Composing state machines

Two helpers cover the cases where one machine is built out of another.

### Widening and extending existing states

At runtime a state only consults its own reactions, so a state written for a small machine works unchanged inside a machine with more events and states: events it does not list come back `handled: false`. The `State` type is invariant in its generics though, so the compiler rejects the registration. `createStateWidener` is the cast for that, guarded so a target that _narrows_ the original is a type error. `extendState` (or `createStateExtender`, which binds the generics once) builds a state for the wider machine out of an existing one plus additions: new or overriding reactions, extra guards, and wrapped `uponEnter` / `beforeExit` hooks.

```ts
import {
    TemplateStateMachine,
    createStateExtender,
    createStateWidener,
} from '@ue-too/being';

type BigEvents = SmallEvents & { c: {} };
type BigStates = SmallStates | 'S3';

const widen = createStateWidener<BigEvents, BigContext, BigStates, BigOut>();
const extend = createStateExtender<BigEvents, BigContext, BigStates, BigOut>();

const machine = new TemplateStateMachine<
    BigEvents,
    BigContext,
    BigStates,
    BigOut
>(
    {
        S1: extend(new SmallS1(), {
            eventReactions: inherited => ({
                c: { action: startC, defaultTargetState: 'S3' }, // add
                b: { ...inherited.b!, action: wrap(inherited.b!.action) }, // wrap
            }),
            uponEnter: (context, _machine, _from, inherited) => {
                inherited();
                context.somethingExtra();
            },
        }),
        S2: widen(new SmallS2()), // reused as is
        S3: new BigS3(),
    },
    'S1',
    context
);
```

Shared event names must keep the same payload in both machines; the cast cannot check that.

### Hosting a machine inside a state

`DelegatingState` owns a complete child machine and offers every event to it first. When the child handles the event its output is returned and the parent stays put (the child's `nextState` is dropped, since it names a child state). When the child declines, the state's own reactions run, which is where a subclass declares its exits. Entering the state starts or restarts the child; leaving it calls `wrapup()` on the child.

```ts
import { DelegatingState, NO_OP } from '@ue-too/being';

class MoveState extends DelegatingState<
    AppEvents,
    BaseContext,
    AppStates,
    KmtInputStateMachine
> {
    constructor(context: KmtInputContext) {
        super(createKmtInputStateMachine(context));
    }
    protected _eventReactions = {
        switchToApp: { action: NO_OP, defaultTargetState: 'IDLE' },
    };
}
```

Subclasses that override `uponEnter` or `beforeExit` must call `super`. Use widening when new states need direct transitions to and from the original ones; use a `DelegatingState` when whole modes switch on and off.
