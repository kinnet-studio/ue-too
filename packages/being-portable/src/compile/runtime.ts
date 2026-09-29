import { TemplateState } from '@ue-too/being';

import { PortableContext, PortableEvents, PortableOutputs } from '../api-types';
import { MachineBody, MachineDefinition, Stmt } from '../format/types';
import { Host, Services } from '../host';
import { EvalEnv } from '../interpret/expr';
import { OutputSink, StmtEnv, runStatements } from '../interpret/stmt';
import { ContextStore } from '../interpret/store';
import { EventFrame, Transaction } from '../interpret/tx';
import { PortableContextImpl } from './context';
import type { PortableStateMachine } from './machine';

/** The being state base every compiled state extends. */
export type PortableStateBase = TemplateState<
    PortableEvents,
    PortableContext,
    string,
    PortableOutputs
>;

export type HandlesArgs = Parameters<PortableStateBase['handles']>;

/** Everything a compiled machine and its states share. */
export type MachineRuntime = {
    readonly definition: MachineDefinition;
    readonly body: MachineBody;
    /** JSON path of the body: `''` for the root, `machines.<key>` for a child. */
    readonly path: string;
    readonly isRoot: boolean;
    readonly transaction: Transaction;
    readonly host: Host;
    /** Host services wrapped so any call back into the tree is re-entrant. */
    readonly services: Services;
    readonly store: ContextStore;
    readonly context: PortableContextImpl;
    /** Child machine per state name, for states with a `child`. */
    readonly children: Map<string, PortableStateMachine>;
    readonly finalStates: ReadonlySet<string>;
};

export function evalEnv(
    runtime: MachineRuntime,
    frame: EventFrame | null
): EvalEnv {
    return {
        ctx: runtime.store,
        payload: frame?.payload ?? null,
        child: frame?.child ?? null,
        services: runtime.services,
        limits: runtime.host.limits,
        meter: runtime.transaction,
        site: '',
    };
}

export function stmtEnv(
    runtime: MachineRuntime,
    frame: EventFrame | null,
    output: OutputSink | null
): StmtEnv {
    return {
        ...evalEnv(runtime, frame),
        effects: runtime.host.effects,
        calls: runtime.transaction,
        output,
    };
}

/** Runs `enter` or `exit` statements: no event, no output. */
export function runBlock(
    runtime: MachineRuntime,
    statements: readonly Stmt[] | undefined,
    path: string
): void {
    if (statements !== undefined && statements.length > 0) {
        runStatements(statements, stmtEnv(runtime, null, null), path);
    }
}
