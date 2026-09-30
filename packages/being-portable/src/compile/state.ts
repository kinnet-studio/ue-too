import {
    EventGuards,
    EventPreconditions,
    EventReactions,
    Guard,
    TemplateState,
} from '@ue-too/being';

import { PortableContext, PortableEvents, PortableOutputs } from '../api-types';
import { StateDefinition } from '../format/types';
import { PayloadRecord } from '../interpret/expr';
import { joinPath } from '../util';
import { CompiledParts, compileStateParts } from './parts';
import { HandlesArgs, MachineRuntime, runBlock } from './runtime';

type Guards = Guard<PortableContext>;

/** The compiled maps, typed the way `TemplateState` stores them. */
export type BeingParts = {
    readonly eventReactions: EventReactions<
        PortableEvents,
        PortableContext,
        string,
        PortableOutputs
    >;
    readonly guards: Guards;
    readonly eventGuards: Partial<
        EventGuards<PortableEvents, string, PortableContext, Guards>
    >;
    readonly eventPreconditions: Partial<
        EventPreconditions<PortableEvents, PortableContext, Guards>
    >;
};

/**
 * The compiled maps are keyed by runtime event names, which being's types
 * cannot see (`PortableEvents` has no static keys), hence the casts.
 */
export function asBeingParts(parts: CompiledParts): BeingParts {
    return parts as unknown as BeingParts;
}

/** The payload a being `handles` call carries. */
export function payloadOf(params: HandlesArgs): PayloadRecord | null {
    return (params[0][1] ?? null) as PayloadRecord | null;
}

/** A state from a document, without a child machine. */
export class PortableState extends TemplateState<
    PortableEvents,
    PortableContext,
    string,
    PortableOutputs
> {
    constructor(
        private readonly runtime: MachineRuntime,
        private readonly state: StateDefinition,
        private readonly path: string
    ) {
        super();
        const parts = asBeingParts(compileStateParts(runtime, state, path));
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

    uponEnter(): void {
        runBlock(this.runtime, this.state.enter, joinPath(this.path, 'enter'));
    }

    beforeExit(): void {
        runBlock(this.runtime, this.state.exit, joinPath(this.path, 'exit'));
    }
}
