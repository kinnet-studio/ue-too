import { LoadError, LoadErrorCode, loadError } from '../errors';
import {
    DoneReaction,
    GuardRef,
    MachineBody,
    MachineDefinition,
    Reaction,
    TypeSpec,
} from '../format/types';
import { parseTypeSpec, sameType } from '../format/values';
import { Limits } from '../limits';
import { entriesOf, hasOwn, joinPath } from '../util';

export type BodyEntry = {
    /** `null` for the root, else the key in `machines`. */
    readonly key: string | null;
    readonly path: string;
    readonly body: MachineBody;
};

/** The root and every machine in `machines`, with their JSON paths. */
export function listBodies(definition: MachineDefinition): BodyEntry[] {
    return [
        { key: null, path: '', body: definition },
        ...entriesOf(definition.machines).map(([key, body]) => ({
            key,
            path: joinPath('machines', key),
            body,
        })),
    ];
}

type Fail = (code: LoadErrorCode, path: string, message: string) => void;

/**
 * Pass 2: every named state, event, field, guard and machine exists; child
 * machines agree with their parents; no machine cycles; the tree fits the
 * nesting and instance limits.
 */
export function checkReferences(
    definition: MachineDefinition,
    limits: Limits
): LoadError[] {
    const errors: LoadError[] = [];
    const fail: Fail = (code, path, message) =>
        errors.push(loadError(code, path, message));
    const machines = definition.machines ?? {};

    for (const { key, path, body } of listBodies(definition)) {
        const initialPath = joinPath(path, 'initialState');
        if (!hasOwn(body.states, body.initialState)) {
            fail(
                'unknown-state',
                initialPath,
                `initialState "${body.initialState}" is not a state`
            );
        } else if (key !== null && body.states[body.initialState].final) {
            fail(
                'final-initial-state',
                initialPath,
                'a child machine cannot start in a final state'
            );
        }

        const stateRef = (target: string, targetPath: string) => {
            if (!hasOwn(body.states, target)) {
                fail(
                    'unknown-state',
                    targetPath,
                    `"${target}" is not a state of this machine`
                );
            }
        };

        for (const [stateName, state] of entriesOf(body.states)) {
            const statePath = joinPath(joinPath(path, 'states'), stateName);
            const guards = state.guards ?? {};
            const guardRef = (ref: GuardRef, refPath: string) => {
                if (typeof ref === 'string' && !hasOwn(guards, ref)) {
                    fail(
                        'unknown-guard',
                        refPath,
                        `"${ref}" is not a guard of state ${stateName}`
                    );
                }
            };
            const reaction = (
                value: Reaction | DoneReaction,
                reactionPath: string
            ) => {
                if ('require' in value) {
                    value.require?.forEach((ref, index) =>
                        guardRef(
                            ref,
                            joinPath(joinPath(reactionPath, 'require'), index)
                        )
                    );
                }
                value.branches?.forEach((branch, index) => {
                    const branchPath = joinPath(
                        joinPath(reactionPath, 'branches'),
                        index
                    );
                    guardRef(branch.if, joinPath(branchPath, 'if'));
                    stateRef(branch.target, joinPath(branchPath, 'target'));
                });
                if (value.target !== undefined) {
                    stateRef(value.target, joinPath(reactionPath, 'target'));
                }
            };

            if (
                state.final === true &&
                (state.on !== undefined || state.child !== undefined)
            ) {
                fail(
                    'final-state-has-reactions',
                    statePath,
                    'a final state cannot have on or child'
                );
            }
            for (const [event, value] of entriesOf(state.on)) {
                const eventPath = joinPath(joinPath(statePath, 'on'), event);
                if (!hasOwn(body.events, event)) {
                    fail(
                        'unknown-event',
                        eventPath,
                        `"${event}" is not declared in events`
                    );
                }
                reaction(value, eventPath);
            }
            if (state.onDone !== undefined) {
                reaction(state.onDone, joinPath(statePath, 'onDone'));
            }

            if (state.child === undefined) {
                if (state.onDone !== undefined) {
                    fail(
                        'on-done-without-child',
                        joinPath(statePath, 'onDone'),
                        'onDone is only allowed on a state with a child'
                    );
                }
                continue;
            }
            const childPath = joinPath(statePath, 'child');
            const childKey = state.child.machine;
            if (!hasOwn(machines, childKey)) {
                fail(
                    'unknown-machine',
                    joinPath(childPath, 'machine'),
                    `"${childKey}" is not in machines`
                );
                continue;
            }
            const child = machines[childKey];
            for (const [field] of entriesOf(state.child.with)) {
                if (!hasOwn(child.context, field)) {
                    fail(
                        'unknown-field',
                        joinPath(joinPath(childPath, 'with'), field),
                        `"${field}" is not a context field of machine ${childKey}`
                    );
                }
            }
            if (
                state.onDone !== undefined &&
                !Object.values(child.states).some(s => s.final === true)
            ) {
                fail(
                    'on-done-unreachable',
                    joinPath(statePath, 'onDone'),
                    `machine ${childKey} has no final state, so onDone can never run`
                );
            }
            checkChildEvents(
                body,
                child,
                childKey,
                joinPath(childPath, 'machine'),
                fail
            );
        }
    }

    if (!checkCycles(definition, fail)) {
        checkTreeSize(definition, limits, fail);
    }
    return errors;
}

function typeOf(spec: TypeSpec): ReturnType<typeof parseTypeSpec> {
    return parseTypeSpec(spec);
}

function samePayload(
    a: Readonly<Record<string, TypeSpec>>,
    b: Readonly<Record<string, TypeSpec>>
): boolean {
    const keysA = Object.keys(a);
    if (keysA.length !== Object.keys(b).length) {
        return false;
    }
    return keysA.every(
        key => hasOwn(b, key) && sameType(typeOf(a[key])!, typeOf(b[key])!)
    );
}

function checkChildEvents(
    parent: MachineBody,
    child: MachineBody,
    childKey: string,
    path: string,
    fail: Fail
): void {
    for (const [event, payload] of entriesOf(child.events)) {
        if (!hasOwn(parent.events, event)) {
            fail(
                'child-event-mismatch',
                path,
                `machine ${childKey} declares event "${event}", which this machine does not`
            );
        } else if (!samePayload(parent.events[event], payload)) {
            fail(
                'child-event-mismatch',
                path,
                `event "${event}" has a different payload in machine ${childKey}`
            );
        }
    }
    const parentOutputs = parent.outputs ?? {};
    for (const [event, spec] of entriesOf(child.outputs)) {
        if (!hasOwn(parentOutputs, event)) {
            fail(
                'child-event-mismatch',
                path,
                `machine ${childKey} declares an output for "${event}", which this machine does not`
            );
        } else if (!sameType(typeOf(parentOutputs[event])!, typeOf(spec)!)) {
            fail(
                'child-event-mismatch',
                path,
                `the output of "${event}" has a different type in machine ${childKey}`
            );
        }
    }
}

function childKeys(
    body: MachineBody,
    machines: Readonly<Record<string, MachineBody>>
): string[] {
    const keys: string[] = [];
    for (const [, state] of entriesOf(body.states)) {
        if (
            state.child !== undefined &&
            hasOwn(machines, state.child.machine)
        ) {
            keys.push(state.child.machine);
        }
    }
    return keys;
}

/** Reports machines that contain themselves; returns whether any did. */
function checkCycles(definition: MachineDefinition, fail: Fail): boolean {
    const machines = definition.machines ?? {};
    const marks = new Map<string, 'visiting' | 'done'>();
    let found = false;
    const visit = (key: string): void => {
        const mark = marks.get(key);
        if (mark === 'done') {
            return;
        }
        if (mark === 'visiting') {
            found = true;
            fail(
                'machine-cycle',
                joinPath('machines', key),
                `machine ${key} contains itself through its children`
            );
            return;
        }
        marks.set(key, 'visiting');
        for (const child of childKeys(machines[key], machines)) {
            visit(child);
        }
        marks.set(key, 'done');
    };
    for (const key of Object.keys(machines)) {
        visit(key);
    }
    return found;
}

/** Nesting depth and instance count from the root. Assumes no cycles. */
function checkTreeSize(
    definition: MachineDefinition,
    limits: Limits,
    fail: Fail
): void {
    const machines = definition.machines ?? {};
    const depths = new Map<string, number>();
    const counts = new Map<string, number>();
    const cap = limits.maxMachineInstances + 1;

    const depthOf = (body: MachineBody): number =>
        childKeys(body, machines).reduce(
            (deepest, key) => Math.max(deepest, 1 + memo(depths, key, depthOf)),
            0
        );
    const countOf = (body: MachineBody): number =>
        Math.min(
            cap,
            childKeys(body, machines).reduce(
                (total, key) => total + memo(counts, key, countOf),
                1
            )
        );
    const memo = (
        cache: Map<string, number>,
        key: string,
        compute: (body: MachineBody) => number
    ): number => {
        const cached = cache.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const value = compute(machines[key]);
        cache.set(key, value);
        return value;
    };

    if (depthOf(definition) > limits.maxNestingDepth) {
        fail(
            'limit-exceeded',
            'machines',
            `child machines may nest at most ${limits.maxNestingDepth} deep`
        );
    }
    if (countOf(definition) > limits.maxMachineInstances) {
        fail(
            'limit-exceeded',
            'machines',
            `the machine tree would build more than ${limits.maxMachineInstances} machines`
        );
    }
}
