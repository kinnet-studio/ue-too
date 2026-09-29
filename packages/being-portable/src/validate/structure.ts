import { PlainData, PlainObject, isPlainObject } from '../copy';
import { LoadError, LoadErrorCode, loadError } from '../errors';
import {
    checkValue,
    describeType,
    isScalarName,
    parseTypeSpec,
} from '../format/values';
import { Limits } from '../limits';
import { hasOwn, joinPath } from '../util';
import { NameKind, checkName } from './names';

type Shape = {
    readonly kind: string;
    readonly required: readonly string[];
    readonly optional: readonly string[];
};

const STATEMENT_SHAPES: readonly Shape[] = [
    { kind: 'set', required: ['set', 'to'], optional: [] },
    { kind: 'push', required: ['push', 'value'], optional: [] },
    { kind: 'removeAt', required: ['removeAt', 'index'], optional: [] },
    { kind: 'if', required: ['if', 'then'], optional: ['else'] },
    { kind: 'call', required: ['call'], optional: ['args', 'into'] },
    { kind: 'output', required: ['output'], optional: [] },
];

const EXPRESSION_KINDS = ['list', 'ctx', 'payload', 'childCtx', 'op'];

const BODY_REQUIRED = ['context', 'events', 'initialState', 'states'];
const BODY_OPTIONAL = ['outputs'];
const ROOT_REQUIRED = ['format', 'id', 'revision', ...BODY_REQUIRED];
const ROOT_OPTIONAL = ['effects', 'machines', ...BODY_OPTIONAL];
const STATE_KEYS = [
    'final',
    'guards',
    'enter',
    'exit',
    'on',
    'child',
    'onDone',
];

/**
 * Pass 1: checks that a migrated document has the shape of a definition.
 * When this returns no errors, the document can be read as a
 * `MachineDefinition`.
 */
export function checkStructure(
    document: PlainObject,
    limits: Limits
): LoadError[] {
    const checker = new StructureChecker(limits);
    checker.definition(document);
    return checker.errors;
}

class StructureChecker {
    readonly errors: LoadError[] = [];

    constructor(private readonly limits: Limits) {}

    definition(document: PlainObject): void {
        this.keys(document, '', ROOT_REQUIRED, ROOT_OPTIONAL);
        if (hasOwn(document, 'id')) {
            this.name(document.id, 'id', 'id');
        }
        if (hasOwn(document, 'revision')) {
            const revision = document.revision;
            if (
                typeof revision !== 'number' ||
                !Number.isInteger(revision) ||
                revision < 0
            ) {
                this.fail(
                    'invalid-structure',
                    'revision',
                    'revision must be a non-negative integer'
                );
            }
        }
        if (hasOwn(document, 'effects')) {
            this.record(document.effects, 'effects', 'effect', (value, path) =>
                this.effect(value, path)
            );
        }
        if (hasOwn(document, 'machines')) {
            const machines = this.record(
                document.machines,
                'machines',
                'machine',
                (value, path) => this.body(value, path)
            );
            if (
                machines !== null &&
                Object.keys(machines).length + 1 > this.limits.maxMachines
            ) {
                this.fail(
                    'limit-exceeded',
                    'machines',
                    `at most ${this.limits.maxMachines} machines including the root`
                );
            }
        }
        this.bodyFields(document, '');
    }

    private body(value: PlainData, path: string): void {
        const body = this.object(value, path);
        if (body === null) {
            return;
        }
        this.keys(body, path, BODY_REQUIRED, BODY_OPTIONAL);
        this.bodyFields(body, path);
    }

    private bodyFields(body: PlainObject, path: string): void {
        if (hasOwn(body, 'context')) {
            this.record(
                body.context,
                joinPath(path, 'context'),
                'field',
                (value, fieldPath) => this.contextField(value, fieldPath)
            );
        }
        if (hasOwn(body, 'events')) {
            this.record(
                body.events,
                joinPath(path, 'events'),
                'event',
                (value, eventPath) =>
                    this.record(value, eventPath, 'field', (spec, specPath) =>
                        this.typeSpec(spec, specPath)
                    )
            );
        }
        if (hasOwn(body, 'outputs')) {
            this.record(
                body.outputs,
                joinPath(path, 'outputs'),
                'event',
                (spec, specPath) => this.typeSpec(spec, specPath)
            );
        }
        if (hasOwn(body, 'initialState')) {
            this.name(
                body.initialState,
                joinPath(path, 'initialState'),
                'state'
            );
        }
        if (hasOwn(body, 'states')) {
            const statesPath = joinPath(path, 'states');
            const states = this.record(
                body.states,
                statesPath,
                'state',
                (value, statePath) => this.state(value, statePath)
            );
            if (
                states !== null &&
                Object.keys(states).length > this.limits.maxStates
            ) {
                this.fail(
                    'limit-exceeded',
                    statesPath,
                    `at most ${this.limits.maxStates} states per machine`
                );
            }
        }
    }

    private contextField(value: PlainData, path: string): void {
        const field = this.object(value, path);
        if (field === null) {
            return;
        }
        const isList = field.type === 'list';
        this.keys(
            field,
            path,
            isList ? ['type', 'of', 'initial'] : ['type', 'initial'],
            []
        );
        const type = parseTypeSpec(
            isList ? { type: field.type, of: field.of } : field.type
        );
        if (type === null) {
            this.fail(
                'invalid-structure',
                joinPath(path, 'type'),
                'type must be "number", "string", "boolean", or "list" with "of"'
            );
            return;
        }
        if (!hasOwn(field, 'initial')) {
            return;
        }
        const check = checkValue(field.initial, type, this.limits);
        if (check === 'type') {
            this.fail(
                'type-mismatch',
                joinPath(path, 'initial'),
                `initial value must be ${describeType(type)}`
            );
        } else if (check === 'limit') {
            this.fail(
                'limit-exceeded',
                joinPath(path, 'initial'),
                'initial value is longer than the limits allow'
            );
        }
    }

    private effect(value: PlainData, path: string): void {
        const effect = this.object(value, path);
        if (effect === null) {
            return;
        }
        this.keys(effect, path, ['args'], ['returns']);
        if (hasOwn(effect, 'args')) {
            this.record(
                effect.args,
                joinPath(path, 'args'),
                'argument',
                (spec, specPath) => this.typeSpec(spec, specPath)
            );
        }
        if (hasOwn(effect, 'returns')) {
            this.typeSpec(effect.returns, joinPath(path, 'returns'));
        }
    }

    private state(value: PlainData, path: string): void {
        const state = this.object(value, path);
        if (state === null) {
            return;
        }
        this.keys(state, path, [], STATE_KEYS);
        if (hasOwn(state, 'final') && typeof state.final !== 'boolean') {
            this.fail(
                'invalid-structure',
                joinPath(path, 'final'),
                'final must be true or false'
            );
        }
        if (hasOwn(state, 'guards')) {
            this.record(
                state.guards,
                joinPath(path, 'guards'),
                'guard',
                (expr, exprPath) => this.expr(expr, exprPath, 1)
            );
        }
        for (const block of ['enter', 'exit']) {
            if (hasOwn(state, block)) {
                this.statements(state[block], joinPath(path, block), 0);
            }
        }
        if (hasOwn(state, 'on')) {
            this.record(
                state.on,
                joinPath(path, 'on'),
                'event',
                (reaction, reactionPath) =>
                    this.reaction(reaction, reactionPath, true)
            );
        }
        if (hasOwn(state, 'child')) {
            this.child(state.child, joinPath(path, 'child'));
        }
        if (hasOwn(state, 'onDone')) {
            this.reaction(state.onDone, joinPath(path, 'onDone'), false);
        }
    }

    private child(value: PlainData, path: string): void {
        const child = this.object(value, path);
        if (child === null) {
            return;
        }
        this.keys(child, path, ['machine'], ['with']);
        if (hasOwn(child, 'machine')) {
            this.name(child.machine, joinPath(path, 'machine'), 'machine');
        }
        if (hasOwn(child, 'with')) {
            this.record(
                child.with,
                joinPath(path, 'with'),
                'field',
                (expr, exprPath) => this.expr(expr, exprPath, 1)
            );
        }
    }

    private reaction(
        value: PlainData,
        path: string,
        allowRequire: boolean
    ): void {
        const reaction = this.object(value, path);
        if (reaction === null) {
            return;
        }
        this.keys(
            reaction,
            path,
            [],
            allowRequire
                ? ['require', 'do', 'branches', 'target']
                : ['do', 'branches', 'target']
        );
        if (allowRequire && hasOwn(reaction, 'require')) {
            this.array(
                reaction.require,
                joinPath(path, 'require'),
                (ref, refPath) => this.guardRef(ref, refPath)
            );
        }
        if (hasOwn(reaction, 'do')) {
            this.statements(reaction.do, joinPath(path, 'do'), 0);
        }
        if (hasOwn(reaction, 'branches')) {
            this.array(
                reaction.branches,
                joinPath(path, 'branches'),
                (branch, branchPath) => this.branch(branch, branchPath)
            );
        }
        if (hasOwn(reaction, 'target')) {
            this.name(reaction.target, joinPath(path, 'target'), 'state');
        }
    }

    private branch(value: PlainData, path: string): void {
        const branch = this.object(value, path);
        if (branch === null) {
            return;
        }
        this.keys(branch, path, ['if', 'target'], []);
        if (hasOwn(branch, 'if')) {
            this.guardRef(branch.if, joinPath(path, 'if'));
        }
        if (hasOwn(branch, 'target')) {
            this.name(branch.target, joinPath(path, 'target'), 'state');
        }
    }

    private guardRef(value: PlainData, path: string): void {
        if (typeof value === 'string') {
            this.name(value, path, 'guard');
        } else {
            this.expr(value, path, 1);
        }
    }

    private statements(value: PlainData, path: string, ifDepth: number): void {
        const list = this.list(value, path);
        if (list === null) {
            return;
        }
        if (list.length > this.limits.maxStatements) {
            this.fail(
                'limit-exceeded',
                path,
                `at most ${this.limits.maxStatements} statements per list`
            );
        }
        list.forEach((statement, index) =>
            this.statement(statement, joinPath(path, index), ifDepth)
        );
    }

    private statement(value: PlainData, path: string, ifDepth: number): void {
        const statement = this.object(value, path, 'a statement');
        if (statement === null) {
            return;
        }
        const shapes = STATEMENT_SHAPES.filter(shape =>
            hasOwn(statement, shape.kind)
        );
        if (shapes.length !== 1) {
            this.fail(
                'invalid-structure',
                path,
                'a statement must have exactly one of set, push, removeAt, if, call, output'
            );
            return;
        }
        const shape = shapes[0];
        this.keys(statement, path, shape.required, shape.optional);
        const child = (key: string) => joinPath(path, key);
        switch (shape.kind) {
            case 'set':
                this.name(statement.set, child('set'), 'field');
                this.optionalExpr(statement, 'to', path);
                break;
            case 'push':
                this.name(statement.push, child('push'), 'field');
                this.optionalExpr(statement, 'value', path);
                break;
            case 'removeAt':
                this.name(statement.removeAt, child('removeAt'), 'field');
                this.optionalExpr(statement, 'index', path);
                break;
            case 'if':
                if (ifDepth + 1 > this.limits.maxStatementDepth) {
                    this.fail(
                        'limit-exceeded',
                        path,
                        `if statements may nest at most ${this.limits.maxStatementDepth} deep`
                    );
                    break;
                }
                this.expr(statement.if, child('if'), 1);
                if (hasOwn(statement, 'then')) {
                    this.statements(statement.then, child('then'), ifDepth + 1);
                }
                if (hasOwn(statement, 'else')) {
                    this.statements(statement.else, child('else'), ifDepth + 1);
                }
                break;
            case 'call':
                this.name(statement.call, child('call'), 'effect');
                if (hasOwn(statement, 'args')) {
                    this.record(
                        statement.args,
                        child('args'),
                        'argument',
                        (expr, exprPath) => this.expr(expr, exprPath, 1)
                    );
                }
                if (hasOwn(statement, 'into')) {
                    this.name(statement.into, child('into'), 'field');
                }
                break;
            case 'output':
                this.expr(statement.output, child('output'), 1);
                break;
        }
    }

    private optionalExpr(owner: PlainObject, key: string, path: string): void {
        if (hasOwn(owner, key)) {
            this.expr(owner[key], joinPath(path, key), 1);
        }
    }

    private expr(value: PlainData, path: string, depth: number): void {
        if (depth > this.limits.maxExpressionDepth) {
            this.fail(
                'limit-exceeded',
                path,
                `expressions may nest at most ${this.limits.maxExpressionDepth} deep`
            );
            return;
        }
        if (
            typeof value === 'number' ||
            typeof value === 'string' ||
            typeof value === 'boolean'
        ) {
            return;
        }
        const expr = this.object(value, path, 'an expression');
        if (expr === null) {
            return;
        }
        const kinds = EXPRESSION_KINDS.filter(kind => hasOwn(expr, kind));
        if (kinds.length !== 1) {
            this.fail(
                'invalid-structure',
                path,
                'an expression object must have exactly one of list, ctx, payload, childCtx, op'
            );
            return;
        }
        const kind = kinds[0];
        if (kind === 'list') {
            this.keys(expr, path, ['list'], ['of']);
            const listPath = joinPath(path, 'list');
            this.list(expr.list, listPath)?.forEach((item, index) =>
                this.expr(item, joinPath(listPath, index), depth + 1)
            );
            if (hasOwn(expr, 'of') && !isScalarName(expr.of)) {
                this.fail(
                    'invalid-structure',
                    joinPath(path, 'of'),
                    'of must be "number", "string" or "boolean"'
                );
            }
            return;
        }
        if (kind === 'op') {
            this.keys(expr, path, ['op'], ['args']);
            if (typeof expr.op !== 'string') {
                this.fail(
                    'invalid-structure',
                    joinPath(path, 'op'),
                    'op must be a string'
                );
            }
            if (hasOwn(expr, 'args')) {
                const argsPath = joinPath(path, 'args');
                this.list(expr.args, argsPath)?.forEach((arg, index) =>
                    this.expr(arg, joinPath(argsPath, index), depth + 1)
                );
            }
            return;
        }
        this.keys(expr, path, [kind], []);
        this.name(expr[kind], joinPath(path, kind), 'field');
    }

    private typeSpec(value: PlainData, path: string): void {
        if (parseTypeSpec(value) === null) {
            this.fail(
                'invalid-structure',
                path,
                'expected a type: "number", "string", "boolean", { "type": ... } or { "type": "list", "of": ... }'
            );
        }
    }

    private fail(code: LoadErrorCode, path: string, message: string): void {
        this.errors.push(loadError(code, path, message));
    }

    private object(
        value: PlainData | undefined,
        path: string,
        what = 'an object'
    ): PlainObject | null {
        if (isPlainObject(value)) {
            return value;
        }
        this.fail('invalid-structure', path, `expected ${what}`);
        return null;
    }

    private list(
        value: PlainData | undefined,
        path: string
    ): readonly PlainData[] | null {
        if (Array.isArray(value)) {
            return value;
        }
        this.fail('invalid-structure', path, 'expected a list');
        return null;
    }

    private array(
        value: PlainData,
        path: string,
        each: (item: PlainData, itemPath: string) => void
    ): void {
        this.list(value, path)?.forEach((item, index) =>
            each(item, joinPath(path, index))
        );
    }

    private keys(
        object: PlainObject,
        path: string,
        required: readonly string[],
        optional: readonly string[]
    ): void {
        for (const key of required) {
            if (!hasOwn(object, key)) {
                this.fail('invalid-structure', path, `missing "${key}"`);
            }
        }
        for (const key of Object.keys(object)) {
            if (!required.includes(key) && !optional.includes(key)) {
                this.fail(
                    'invalid-structure',
                    joinPath(path, key),
                    `unknown key "${key}"`
                );
            }
        }
    }

    private name(value: PlainData, path: string, kind: NameKind): void {
        const error = checkName(value, path, kind);
        if (error !== null) {
            this.errors.push(error);
        }
    }

    private record(
        value: PlainData,
        path: string,
        kind: NameKind,
        each: (item: PlainData, itemPath: string) => void
    ): PlainObject | null {
        const record = this.object(value, path);
        if (record === null) {
            return null;
        }
        for (const key of Object.keys(record)) {
            const itemPath = joinPath(path, key);
            this.name(key, itemPath, kind);
            each(record[key], itemPath);
        }
        return record;
    }
}
