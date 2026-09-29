import { Defer, DelegatingState, EventResult } from '@ue-too/being';

import { PortableContext, PortableEvents, PortableOutputs } from '../api-types';
import { StateDefinition, Value } from '../format/types';
import { evaluate } from '../interpret/expr';
import { checkWrite, runStatements } from '../interpret/stmt';
import { entriesOf, joinPath } from '../util';
import type { PortableStateMachine } from './machine';
import { CompiledParts, DONE_EVENT, compileStateParts } from './parts';
import {
    HandlesArgs,
    MachineRuntime,
    evalEnv,
    runBlock,
    stmtEnv,
} from './runtime';
import { asBeingParts, payloadOf } from './state';

type DelegatingBase = DelegatingState<
    PortableEvents,
    PortableContext,
    string,
    PortableStateMachine,
    PortableOutputs
>;

/**
 * A state that hosts a child machine. Adds `with` (parent → child on entry)
 * and `final`/`onDone` (child → parent) to `DelegatingState`.
 */
export class PortableDelegatingState extends DelegatingState<
    PortableEvents,
    PortableContext,
    string,
    PortableStateMachine,
    PortableOutputs
> {
    private readonly parts: CompiledParts;

    protected _defer: Defer<
        PortableContext,
        PortableEvents,
        string,
        PortableOutputs
    > = {
        action: (_context, event, eventKey) =>
            this.forward(eventKey as string, event),
    };

    constructor(
        child: PortableStateMachine,
        private readonly runtime: MachineRuntime,
        private readonly state: StateDefinition,
        private readonly path: string
    ) {
        super(child);
        this.parts = compileStateParts(runtime, state, path);
        const parts = asBeingParts(this.parts);
        this._eventReactions = parts.eventReactions;
        this._guards = parts.guards;
        this._eventGuards = parts.eventGuards;
        this._eventPreconditions = parts.eventPreconditions;
    }

    handles(...params: HandlesArgs) {
        return this.runtime.transaction.withFrame(
            { payload: payloadOf(params), child: null },
            () => super.handles(...params)
        );
    }

    /** Parent `enter`, then `with`, then the child starts. */
    uponEnter(...params: Parameters<DelegatingBase['uponEnter']>): void {
        runBlock(this.runtime, this.state.enter, joinPath(this.path, 'enter'));
        this.child.runtime.context.prepareWith(this.withValues());
        try {
            this.runtime.transaction.delegate(() => super.uponEnter(...params));
        } finally {
            this.child.runtime.context.prepareWith(null);
        }
    }

    /** The child wraps up, then parent `exit`. */
    beforeExit(...params: Parameters<DelegatingBase['beforeExit']>): void {
        this.runtime.transaction.delegate(() => super.beforeExit(...params));
        runBlock(this.runtime, this.state.exit, joinPath(this.path, 'exit'));
    }

    private withValues(): ReadonlyMap<string, Value> | null {
        const entries = entriesOf(this.state.child?.with);
        if (entries.length === 0) {
            return null;
        }
        const env = evalEnv(this.runtime, null);
        const withPath = joinPath(joinPath(this.path, 'child'), 'with');
        const values = new Map<string, Value>();
        for (const [field, expr] of entries) {
            env.site = joinPath(withPath, field);
            const value = evaluate(expr, env);
            checkWrite(value, env);
            values.set(field, value);
        }
        return values;
    }

    private forward(
        event: string,
        payload: unknown
    ): EventResult<string, unknown> {
        const result = this.runtime.transaction.delegate(() =>
            this.child.happens(event, payload)
        );
        if (!result.handled) {
            return { handled: false };
        }
        const output =
            'output' in result && result.output !== undefined
                ? { output: result.output }
                : {};
        if (this.state.onDone !== undefined && this.child.isInFinalState()) {
            const target = this.runDone();
            return target === undefined
                ? { handled: true, ...output }
                : { handled: true, nextState: target, ...output };
        }
        return { handled: true, ...output };
    }

    /** Runs `onDone` with the finished child's context readable; returns the target. */
    private runDone(): string | undefined {
        const done = this.state.onDone!;
        const frame = { payload: null, child: this.child.runtime.store };
        return this.runtime.transaction.withFrame(frame, () => {
            if (done.do !== undefined) {
                runStatements(
                    done.do,
                    stmtEnv(this.runtime, frame, null),
                    joinPath(joinPath(this.path, 'onDone'), 'do')
                );
            }
            for (const mapping of this.parts.eventGuards[DONE_EVENT] ?? []) {
                if (this.parts.guards[mapping.guard](this.runtime.context)) {
                    return mapping.target;
                }
            }
            return done.target;
        });
    }
}
