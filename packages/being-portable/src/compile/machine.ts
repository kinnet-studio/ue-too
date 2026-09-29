import { EventResult, State, TemplateStateMachine } from '@ue-too/being';

import {
    PortableContext,
    PortableEvents,
    PortableMachine,
    PortableOutputs,
    RestoreMode,
    RestoreResult,
} from '../api-types';
import { MachineDefinition, MachineSnapshot } from '../format/types';
import { validatePayload } from '../interpret/payload';
import { TxMachine } from '../interpret/tx';
import { captureSnapshot, restoreSnapshot } from '../snapshot';
import { hasOwn, joinPath } from '../util';
import { MachineRuntime } from './runtime';

type Base = TemplateStateMachine<
    PortableEvents,
    PortableContext,
    string,
    PortableOutputs
>;

export type PortableStateInstance = State<
    PortableEvents,
    PortableContext,
    string,
    PortableOutputs
>;

/**
 * A compiled machine. Every public entry point runs inside the tree's
 * transaction: a new one from host code, the running one when a parent
 * delegates to this child, and never from inside an effect or subscriber.
 * Host code drives only the root; a child runs only when its parent
 * delegates to it.
 */
export class PortableStateMachine
    extends TemplateStateMachine<
        PortableEvents,
        PortableContext,
        string,
        PortableOutputs
    >
    implements PortableMachine, TxMachine
{
    readonly runtime: MachineRuntime;

    constructor(
        states: Record<string, PortableStateInstance>,
        initialState: string,
        runtime: MachineRuntime
    ) {
        super(states, initialState, runtime.context, false);
        this.runtime = runtime;
    }

    get definition(): MachineDefinition {
        return this.runtime.definition;
    }

    happens(
        ...args: [event: string, payload?: unknown]
    ): EventResult<string, unknown> {
        const [event, payload] = args;
        const transaction = this.runtime.transaction;
        const entry = transaction.entry();
        if (entry === 'nested') {
            return super.happens(event, payload);
        }
        if (entry === 'reentrant') {
            transaction.reportReentrant(
                typeof event === 'string' ? event : null,
                'happens()'
            );
            return { handled: false };
        }
        this.refuseUnlessRoot();
        const events = this.runtime.body.events;
        if (typeof event !== 'string' || !hasOwn(events, event)) {
            return { handled: false };
        }
        const checked = validatePayload(
            events[event],
            payload,
            this.runtime.host.limits
        );
        if (!checked.ok) {
            this.runtime.host.onError({
                code: 'payload-mismatch',
                message: checked.message,
                path: joinPath(joinPath(this.runtime.path, 'events'), event),
                event,
                effectsCalled: [],
            });
            return { handled: false };
        }
        const outcome = transaction.run(event, () =>
            super.happens(event, checked.value)
        );
        return outcome.ok ? outcome.value : { handled: false };
    }

    start(): void {
        this.lifecycle('start()', () =>
            this.runtime.context.allowSetup(() => super.start())
        );
    }

    reset(): void {
        this.lifecycle('reset()', () => {
            super.wrapup();
            this.switchTo('INITIAL');
            this.runtime.context.allowSetup(() => super.start());
        });
    }

    wrapup(): void {
        this.lifecycle('wrapup()', () => super.wrapup());
    }

    private lifecycle(call: string, body: () => void): void {
        const transaction = this.runtime.transaction;
        const entry = transaction.entry();
        if (entry === 'nested') {
            body();
            return;
        }
        if (entry === 'reentrant') {
            throw new Error(
                `reentrant-call: ${call} was called while the machine was busy; defer it, for example with queueMicrotask`
            );
        }
        this.refuseUnlessRoot();
        transaction.run(null, body);
    }

    /** A child machine only runs when its parent delegates to it. */
    private refuseUnlessRoot(): void {
        if (!this.runtime.isRoot) {
            throw new Error(
                'child machines are driven by their parent machine'
            );
        }
    }

    switchTo(state: string): void {
        this.runtime.transaction.recordState(this, this.currentState);
        super.switchTo(state);
    }

    /** Sets the state without hooks or recording; for rollback and restore. */
    rawSetState(state: string): void {
        this._currentState = state;
    }

    setContext(): void {
        throw new Error(
            'a portable machine owns its context; setContext() is not supported'
        );
    }

    onStateChange(callback: Parameters<Base['onStateChange']>[0]): () => void {
        return super.onStateChange((from, to) =>
            this.runtime.transaction.hostCode(() => callback(from, to))
        );
    }

    onHappens(callback: Parameters<Base['onHappens']>[0]): () => void {
        return super.onHappens((args, context) =>
            this.runtime.transaction.hostCode(() => callback(args, context))
        );
    }

    onEventResult(callback: Parameters<Base['onEventResult']>[0]): () => void {
        return super.onEventResult((args, result, context) =>
            this.runtime.transaction.hostCode(() =>
                callback(args, result, context)
            )
        );
    }

    snapshot(): MachineSnapshot {
        return captureSnapshot(this);
    }

    restore(
        snapshot: unknown,
        options: { readonly mode?: RestoreMode } = {}
    ): RestoreResult {
        return restoreSnapshot(this, snapshot, options.mode ?? 'strict');
    }

    isInFinalState(): boolean {
        return this.runtime.finalStates.has(this.currentState);
    }

    /** The child machine the given state hosts, if any. */
    childFor(state: string): PortableStateMachine | null {
        return this.runtime.children.get(state) ?? null;
    }
}
