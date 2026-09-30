import { Expr, GuardRef, StateDefinition, Stmt, Value } from '../format/types';
import { evaluate } from '../interpret/expr';
import { OutputSink, runStatements } from '../interpret/stmt';
import { entriesOf, joinPath } from '../util';
import { guardLabel, uniqueName } from './names';
import { MachineRuntime, evalEnv, stmtEnv } from './runtime';

/** Reaction key `onDone` is registered under, for introspection only. */
export const DONE_EVENT = '$done';

export type CompiledGuard = (context: unknown) => boolean;

export type CompiledReaction = {
    readonly action: () => Value | undefined;
    readonly defaultTargetState?: string;
};

/** The four maps a being `TemplateState` reads. All null-prototype. */
export type CompiledParts = {
    readonly eventReactions: Record<string, CompiledReaction>;
    readonly guards: Record<string, CompiledGuard>;
    readonly eventGuards: Record<
        string,
        readonly { readonly guard: string; readonly target: string }[]
    >;
    readonly eventPreconditions: Record<string, readonly string[]>;
};

function compileGuard(
    runtime: MachineRuntime,
    expr: Expr,
    site: string
): CompiledGuard {
    return () => {
        const env = evalEnv(runtime, runtime.transaction.currentFrame());
        env.site = site;
        return evaluate(expr, env) === true;
    };
}

function compileAction(
    runtime: MachineRuntime,
    statements: readonly Stmt[],
    path: string
): () => Value | undefined {
    return () => {
        const sink: OutputSink = { value: undefined };
        runStatements(
            statements,
            stmtEnv(runtime, runtime.transaction.currentFrame(), sink),
            path
        );
        return sink.value;
    };
}

/** Named guards a state's `require`s and branches refer to. */
function usedGuardNames(state: StateDefinition): Set<string> {
    const used = new Set<string>();
    const note = (ref: GuardRef) => {
        if (typeof ref === 'string') {
            used.add(ref);
        }
    };
    for (const [, reaction] of entriesOf(state.on)) {
        reaction.require?.forEach(note);
        reaction.branches?.forEach(branch => note(branch.if));
    }
    state.onDone?.branches?.forEach(branch => note(branch.if));
    return used;
}

/**
 * Turns one state's `guards`, `on` and `onDone` into the maps being reads.
 * Named guards keep their names; inline guards are named by their printed
 * expression. A named guard nothing refers to is never type-checked, so it
 * is not compiled either.
 */
export function compileStateParts(
    runtime: MachineRuntime,
    state: StateDefinition,
    statePath: string
): CompiledParts {
    const guards: Record<string, CompiledGuard> = Object.create(null);
    const eventReactions: Record<string, CompiledReaction> =
        Object.create(null);
    const eventGuards: Record<string, { guard: string; target: string }[]> =
        Object.create(null);
    const eventPreconditions: Record<string, string[]> = Object.create(null);
    const taken = new Set<string>();
    const counters = new Map<string, number>();

    const used = usedGuardNames(state);
    for (const [name, expr] of entriesOf(state.guards)) {
        taken.add(name);
        if (used.has(name)) {
            guards[name] = compileGuard(
                runtime,
                expr,
                joinPath(joinPath(statePath, 'guards'), name)
            );
        }
    }
    const guardName = (ref: GuardRef, site: string): string => {
        if (typeof ref === 'string') {
            return ref;
        }
        const name = uniqueName(guardLabel(ref), taken, counters);
        taken.add(name);
        guards[name] = compileGuard(runtime, ref, site);
        return name;
    };
    const branchGuards = (
        branches: NonNullable<StateDefinition['onDone']>['branches'],
        path: string
    ) =>
        (branches ?? []).map((branch, index) => ({
            guard: guardName(
                branch.if,
                joinPath(joinPath(joinPath(path, 'branches'), index), 'if')
            ),
            target: branch.target,
        }));

    for (const [event, reaction] of entriesOf(state.on)) {
        const eventPath = joinPath(joinPath(statePath, 'on'), event);
        eventReactions[event] = {
            action: compileAction(
                runtime,
                reaction.do ?? [],
                joinPath(eventPath, 'do')
            ),
            defaultTargetState: reaction.target,
        };
        if (reaction.require !== undefined && reaction.require.length > 0) {
            eventPreconditions[event] = reaction.require.map((ref, index) =>
                guardName(ref, joinPath(joinPath(eventPath, 'require'), index))
            );
        }
        if (reaction.branches !== undefined && reaction.branches.length > 0) {
            eventGuards[event] = branchGuards(reaction.branches, eventPath);
        }
    }
    if (state.onDone !== undefined) {
        const donePath = joinPath(statePath, 'onDone');
        eventReactions[DONE_EVENT] = {
            action: () => undefined,
            defaultTargetState: state.onDone.target,
        };
        eventGuards[DONE_EVENT] = branchGuards(state.onDone.branches, donePath);
    }
    return { eventReactions, guards, eventGuards, eventPreconditions };
}
