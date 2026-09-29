import { RestoreMode, RestoreResult } from './api-types';
import type { PortableStateMachine } from './compile/machine';
import { PlainData, PlainObject, copyPlainData, isPlainObject } from './copy';
import { LoadError, capErrors, loadError } from './errors';
import {
    LevelSnapshot,
    MachineDefinition,
    MachineSnapshot,
    Value,
} from './format/types';
import { checkValue, describeType, freezeValue } from './format/values';
import { SNAPSHOT_FORMAT, migrateSnapshot } from './migrate';
import { entriesOf, hasOwn, joinPath } from './util';
import { fieldType } from './validate/check';

/** Snapshot of the whole tree. Only the root can snapshot, and never mid-event. */
export function captureSnapshot(
    machine: PortableStateMachine
): MachineSnapshot {
    const runtime = machine.runtime;
    if (!runtime.isRoot) {
        throw new Error('snapshot() is only available on the root machine');
    }
    if (runtime.transaction.isActive) {
        throw new Error(
            'reentrant-call: snapshot() was called while the machine was busy; defer it, for example with queueMicrotask'
        );
    }
    return {
        format: SNAPSHOT_FORMAT,
        machine: {
            id: runtime.definition.id,
            revision: runtime.definition.revision,
        },
        ...captureLevel(machine),
    };
}

function captureLevel(machine: PortableStateMachine): LevelSnapshot {
    const state = machine.currentState;
    const context = machine.runtime.store.toRecord();
    const child = machine.childFor(state);
    return child === null
        ? { state, context }
        : { state, context, child: captureLevel(child) };
}

type PlannedLevel = {
    readonly machine: PortableStateMachine;
    readonly state: string;
    readonly values: ReadonlyMap<string, Value>;
};

type Report = { dropped: string[]; defaulted: string[] };

/**
 * Restores a snapshot into the tree. Every check runs before anything
 * changes; a failed restore leaves the machine as it was. Runs no
 * statements, calls no effects and notifies no subscribers.
 */
export function restoreSnapshot(
    machine: PortableStateMachine,
    snapshot: unknown,
    mode: RestoreMode
): RestoreResult {
    const runtime = machine.runtime;
    if (!runtime.isRoot) {
        throw new Error('restore() is only available on the root machine');
    }
    if (runtime.transaction.isActive) {
        return {
            ok: false,
            errors: [
                loadError(
                    'reentrant-call',
                    '',
                    'restore() was called while the machine was busy; defer it, for example with queueMicrotask'
                ),
            ],
        };
    }
    const copied = copyPlainData(snapshot, runtime.host.limits);
    if (!copied.ok) {
        return copied;
    }
    const migrated = migrateSnapshot(copied.value);
    if (!migrated.ok) {
        return migrated;
    }
    const errors: LoadError[] = [];
    checkHeader(migrated.value, runtime.definition, mode, errors);
    if (errors.length > 0) {
        return { ok: false, errors: capErrors(errors) };
    }
    const report: Report = { dropped: [], defaulted: [] };
    const plan: PlannedLevel[] = [];
    planLevel(machine, migrated.value, '', true, mode, plan, report, errors);
    if (errors.length > 0) {
        return { ok: false, errors: capErrors(errors) };
    }
    resetTree(machine);
    for (const level of plan) {
        level.machine.runtime.store.replaceAll(level.values);
        level.machine.rawSetState(level.state);
    }
    return { ok: true, report };
}

function checkHeader(
    document: PlainObject,
    definition: MachineDefinition,
    mode: RestoreMode,
    errors: LoadError[]
): void {
    const header = document.machine;
    if (
        !isPlainObject(header) ||
        Object.keys(header).sort().join(',') !== 'id,revision' ||
        typeof header.id !== 'string' ||
        typeof header.revision !== 'number'
    ) {
        errors.push(
            loadError(
                'invalid-structure',
                'machine',
                'machine must be { "id": string, "revision": number }'
            )
        );
        return;
    }
    if (header.id !== definition.id) {
        errors.push(
            loadError(
                'machine-mismatch',
                'machine.id',
                `the snapshot is of machine "${header.id}", not "${definition.id}"`
            )
        );
        return;
    }
    if (header.revision !== definition.revision && mode === 'strict') {
        errors.push(
            loadError(
                'revision-mismatch',
                'machine.revision',
                `the snapshot is of revision ${header.revision}; the definition is revision ${definition.revision}`
            )
        );
    }
}

function planLevel(
    machine: PortableStateMachine,
    level: PlainData | undefined,
    path: string,
    isRoot: boolean,
    mode: RestoreMode,
    plan: PlannedLevel[],
    report: Report,
    errors: LoadError[]
): void {
    if (!isPlainObject(level)) {
        errors.push(loadError('invalid-structure', path, 'expected an object'));
        return;
    }
    const allowed = isRoot
        ? ['format', 'machine', 'state', 'context', 'child']
        : ['state', 'context', 'child'];
    for (const key of Object.keys(level)) {
        if (!allowed.includes(key)) {
            errors.push(
                loadError(
                    'invalid-structure',
                    joinPath(path, key),
                    `unknown key "${key}"`
                )
            );
        }
    }
    const statePath = joinPath(path, 'state');
    const state = level.state;
    if (typeof state !== 'string') {
        errors.push(
            loadError('invalid-structure', statePath, 'state must be a string')
        );
        return;
    }
    const pseudo = state === 'INITIAL' || state === 'TERMINAL';
    if (pseudo && !isRoot) {
        errors.push(
            loadError(
                'state-missing',
                statePath,
                'a running child machine must be in one of its states'
            )
        );
        return;
    }
    if (!pseudo && !hasOwn(machine.runtime.body.states, state)) {
        errors.push(
            loadError(
                'state-missing',
                statePath,
                `"${state}" is not a state of this machine`
            )
        );
        return;
    }
    const values = planContext(
        machine,
        level.context,
        joinPath(path, 'context'),
        mode,
        report,
        errors
    );
    const child = pseudo ? null : machine.childFor(state);
    const childPath = joinPath(path, 'child');
    if (child !== null) {
        if (hasOwn(level, 'child')) {
            planLevel(
                child,
                level.child,
                childPath,
                false,
                mode,
                plan,
                report,
                errors
            );
        } else {
            errors.push(
                loadError(
                    'child-missing',
                    childPath,
                    `state ${state} runs a child machine, but the snapshot has no child`
                )
            );
        }
    } else if (hasOwn(level, 'child')) {
        if (mode === 'strict') {
            errors.push(
                loadError(
                    'child-unexpected',
                    childPath,
                    `state ${state} has no child machine`
                )
            );
        } else {
            report.dropped.push(childPath);
        }
    }
    if (values !== null) {
        plan.push({ machine, state, values });
    }
}

function planContext(
    machine: PortableStateMachine,
    context: PlainData | undefined,
    path: string,
    mode: RestoreMode,
    report: Report,
    errors: LoadError[]
): Map<string, Value> | null {
    if (!isPlainObject(context)) {
        errors.push(
            loadError('invalid-structure', path, 'context must be an object')
        );
        return null;
    }
    const { body, store, host } = machine.runtime;
    const values = new Map<string, Value>();
    for (const [field] of entriesOf(body.context)) {
        const fieldPath = joinPath(path, field);
        if (!hasOwn(context, field)) {
            if (mode === 'strict') {
                errors.push(
                    loadError(
                        'field-mismatch',
                        fieldPath,
                        `the snapshot has no value for ${field}`
                    )
                );
            } else {
                report.defaulted.push(fieldPath);
                values.set(field, store.initialValue(field));
            }
            continue;
        }
        const type = fieldType(body, field);
        const check = checkValue(context[field], type, host.limits);
        if (check === 'ok') {
            values.set(field, freezeValue(context[field] as Value));
        } else if (check === 'limit') {
            errors.push(
                loadError(
                    'limit-exceeded',
                    fieldPath,
                    `${field} is longer than the limits allow`
                )
            );
        } else if (mode === 'strict') {
            errors.push(
                loadError(
                    'field-mismatch',
                    fieldPath,
                    `${field} must be ${describeType(type)}`
                )
            );
        } else {
            report.dropped.push(fieldPath);
            report.defaulted.push(fieldPath);
            values.set(field, store.initialValue(field));
        }
    }
    for (const key of Object.keys(context)) {
        if (hasOwn(body.context, key)) {
            continue;
        }
        const keyPath = joinPath(path, key);
        if (mode === 'strict') {
            errors.push(
                loadError(
                    'field-mismatch',
                    keyPath,
                    `${key} is not a context field`
                )
            );
        } else {
            report.dropped.push(keyPath);
        }
    }
    return values;
}

/** Every machine back to `INITIAL` with initial values, outside any transaction. */
function resetTree(machine: PortableStateMachine): void {
    const store = machine.runtime.store;
    store.replaceAll(
        new Map(
            store.fieldNames().map(field => [field, store.initialValue(field)])
        )
    );
    machine.rawSetState('INITIAL');
    for (const child of machine.runtime.children.values()) {
        resetTree(child);
    }
}
