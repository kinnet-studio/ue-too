import { LoadError, LoadErrorCode, loadError } from '../errors';
import {
    EffectDeclaration,
    Expr,
    GuardRef,
    MachineBody,
    MachineDefinition,
    StateDefinition,
    Stmt,
    TypeSpec,
} from '../format/types';
import {
    BOOLEAN,
    NUMBER,
    STRING,
    ValueType,
    describeType,
    listType,
    parseTypeSpec,
    sameType,
    scalarType,
} from '../format/values';
import { Limits } from '../limits';
import { entriesOf, hasOwn, joinPath } from '../util';
import { OPERATORS } from './operators';
import { listBodies } from './references';

/**
 * Checking may visit at most `CHECK_WORK_FACTOR × maxNodes` expressions.
 * A named guard counts its whole expression at every place it is used, so
 * this also bounds the guard work any one event can do at runtime.
 */
const CHECK_WORK_FACTOR = 4;

/** Sentinel exception to stop expression walking when the work budget is exceeded. */
class CheckBudgetExceeded {}

type OutputRule =
    | { readonly kind: 'forbidden' }
    | { readonly kind: 'undeclared' }
    | { readonly kind: 'allowed'; readonly type: ValueType };

/** What an expression or statement may use where it appears. */
type Env = {
    readonly body: MachineBody;
    /** Payload fields, or `null` where there is no event. */
    readonly payload: Readonly<Record<string, TypeSpec>> | null;
    readonly event: string | null;
    /** The child machine whose context `childCtx` reads, only in onDone. */
    readonly child: MachineBody | null;
    readonly output: OutputRule;
    /** Where a named guard is being used, while checking it. */
    readonly site: string | null;
};

/** Context field type; the field must exist. */
export function fieldType(body: MachineBody, field: string): ValueType {
    const definition = body.context[field];
    return definition.type === 'list'
        ? listType(definition.of)
        : scalarType(definition.type);
}

const isBoolean = (type: ValueType) =>
    type.kind === 'scalar' && type.scalar === 'boolean';

/**
 * Passes 3 and 4 in one walk: every expression and statement type-checks,
 * and every construct is used where it is allowed. Parts with broken
 * references are skipped; pass 2 already reported them. A named guard is
 * checked where it is used; an unused one is not type-checked. Checking is
 * bounded by a work budget to prevent pathological reuse of large guards.
 */
export function checkTypes(
    definition: MachineDefinition,
    limits: Limits
): LoadError[] {
    const checker = new TypeChecker(definition, limits);
    checker.run();
    return checker.errors;
}

class TypeChecker {
    readonly errors: LoadError[] = [];
    private readonly effects: Readonly<Record<string, EffectDeclaration>>;
    private readonly machines: Readonly<Record<string, MachineBody>>;
    private visits = 0;
    private readonly budget: number;

    constructor(
        private readonly definition: MachineDefinition,
        limits: Limits
    ) {
        this.effects = definition.effects ?? {};
        this.machines = definition.machines ?? {};
        this.budget = limits.maxNodes * CHECK_WORK_FACTOR;
    }

    run(): void {
        try {
            for (const { path, body } of listBodies(this.definition)) {
                for (const [stateName, state] of entriesOf(body.states)) {
                    this.state(
                        body,
                        state,
                        joinPath(joinPath(path, 'states'), stateName)
                    );
                }
            }
        } catch (error) {
            if (!(error instanceof CheckBudgetExceeded)) {
                throw error;
            }
        }
    }

    private state(
        body: MachineBody,
        state: StateDefinition,
        statePath: string
    ): void {
        const noEvent: Env = {
            body,
            payload: null,
            event: null,
            child: null,
            output: { kind: 'forbidden' },
            site: null,
        };
        if (state.enter !== undefined) {
            this.statements(state.enter, joinPath(statePath, 'enter'), noEvent);
        }
        if (state.exit !== undefined) {
            this.statements(state.exit, joinPath(statePath, 'exit'), noEvent);
        }

        for (const [event, reaction] of entriesOf(state.on)) {
            if (!hasOwn(body.events, event)) {
                continue;
            }
            const outputs = body.outputs ?? {};
            const env: Env = {
                ...noEvent,
                payload: body.events[event],
                event,
                output: hasOwn(outputs, event)
                    ? { kind: 'allowed', type: parseTypeSpec(outputs[event])! }
                    : { kind: 'undeclared' },
            };
            const eventPath = joinPath(joinPath(statePath, 'on'), event);
            reaction.require?.forEach((ref, index) =>
                this.guardRef(
                    ref,
                    state,
                    statePath,
                    joinPath(joinPath(eventPath, 'require'), index),
                    env
                )
            );
            if (reaction.do !== undefined) {
                this.statements(reaction.do, joinPath(eventPath, 'do'), env);
            }
            reaction.branches?.forEach((branch, index) =>
                this.guardRef(
                    branch.if,
                    state,
                    statePath,
                    joinPath(
                        joinPath(joinPath(eventPath, 'branches'), index),
                        'if'
                    ),
                    env
                )
            );
        }

        if (
            state.child === undefined ||
            !hasOwn(this.machines, state.child.machine)
        ) {
            return;
        }
        const child = this.machines[state.child.machine];
        for (const [field, expr] of entriesOf(state.child.with)) {
            if (!hasOwn(child.context, field)) {
                continue;
            }
            const withPath = joinPath(
                joinPath(joinPath(statePath, 'child'), 'with'),
                field
            );
            const type = this.expr(expr, withPath, noEvent);
            const expected = fieldType(child, field);
            if (type !== null && !sameType(type, expected)) {
                this.fail(
                    'type-mismatch',
                    withPath,
                    `with.${field} must be ${describeType(expected)}, got ${describeType(type)}`
                );
            }
        }
        if (state.onDone !== undefined) {
            const doneEnv: Env = { ...noEvent, child };
            const donePath = joinPath(statePath, 'onDone');
            if (state.onDone.do !== undefined) {
                this.statements(
                    state.onDone.do,
                    joinPath(donePath, 'do'),
                    doneEnv
                );
            }
            state.onDone.branches?.forEach((branch, index) =>
                this.guardRef(
                    branch.if,
                    state,
                    statePath,
                    joinPath(
                        joinPath(joinPath(donePath, 'branches'), index),
                        'if'
                    ),
                    doneEnv
                )
            );
        }
    }

    private guardRef(
        ref: GuardRef,
        state: StateDefinition,
        statePath: string,
        path: string,
        env: Env
    ): void {
        if (typeof ref === 'string') {
            if (state.guards === undefined || !hasOwn(state.guards, ref)) {
                return;
            }
            const guardPath = joinPath(joinPath(statePath, 'guards'), ref);
            const type = this.expr(state.guards[ref], guardPath, {
                ...env,
                site: path,
            });
            if (type !== null && !isBoolean(type)) {
                this.fail(
                    'type-mismatch',
                    guardPath,
                    `guard "${ref}" must be boolean, got ${describeType(type)}`
                );
            }
            return;
        }
        const type = this.expr(ref, path, env);
        if (type !== null && !isBoolean(type)) {
            this.fail(
                'type-mismatch',
                path,
                `a guard must be boolean, got ${describeType(type)}`
            );
        }
    }

    private statements(
        statements: readonly Stmt[],
        path: string,
        env: Env
    ): void {
        statements.forEach((statement, index) =>
            this.statement(statement, joinPath(path, index), env)
        );
    }

    private statement(statement: Stmt, path: string, env: Env): void {
        const at = (key: string) => joinPath(path, key);
        if ('set' in statement) {
            const field = this.field(env, statement.set, at('set'));
            const type = this.expr(statement.to, at('to'), env);
            if (field !== null && type !== null && !sameType(field, type)) {
                this.fail(
                    'type-mismatch',
                    at('to'),
                    `${statement.set} is ${describeType(field)}, got ${describeType(type)}`
                );
            }
            return;
        }
        if ('push' in statement) {
            const field = this.field(env, statement.push, at('push'));
            const type = this.expr(statement.value, at('value'), env);
            if (field !== null && field.kind !== 'list') {
                this.fail(
                    'type-mismatch',
                    at('push'),
                    `push needs a list field; ${statement.push} is ${describeType(field)}`
                );
                return;
            }
            if (
                field !== null &&
                type !== null &&
                field.kind === 'list' &&
                !sameType(type, scalarType(field.of))
            ) {
                this.fail(
                    'type-mismatch',
                    at('value'),
                    `${statement.push} holds ${field.of}, got ${describeType(type)}`
                );
            }
            return;
        }
        if ('removeAt' in statement) {
            const field = this.field(env, statement.removeAt, at('removeAt'));
            const type = this.expr(statement.index, at('index'), env);
            if (field !== null && field.kind !== 'list') {
                this.fail(
                    'type-mismatch',
                    at('removeAt'),
                    `removeAt needs a list field; ${statement.removeAt} is ${describeType(field)}`
                );
            }
            if (type !== null && !sameType(type, NUMBER)) {
                this.fail(
                    'type-mismatch',
                    at('index'),
                    `index must be number, got ${describeType(type)}`
                );
            }
            return;
        }
        if ('if' in statement) {
            const type = this.expr(statement.if, at('if'), env);
            if (type !== null && !isBoolean(type)) {
                this.fail(
                    'type-mismatch',
                    at('if'),
                    `condition must be boolean, got ${describeType(type)}`
                );
            }
            this.statements(statement.then, at('then'), env);
            if (statement.else !== undefined) {
                this.statements(statement.else, at('else'), env);
            }
            return;
        }
        if ('call' in statement) {
            this.call(statement, path, env);
            return;
        }
        const type = this.expr(statement.output, at('output'), env);
        if (env.output.kind === 'forbidden') {
            this.fail(
                'misplaced',
                path,
                'output is only allowed in the do of an on reaction'
            );
        } else if (env.output.kind === 'undeclared') {
            this.fail(
                'output-not-declared',
                path,
                `event "${env.event}" declares no output`
            );
        } else if (type !== null && !sameType(type, env.output.type)) {
            this.fail(
                'type-mismatch',
                at('output'),
                `the output of "${env.event}" is ${describeType(env.output.type)}, got ${describeType(type)}`
            );
        }
    }

    private call(
        statement: Extract<Stmt, { call: string }>,
        path: string,
        env: Env
    ): void {
        if (!hasOwn(this.effects, statement.call)) {
            this.fail(
                'unknown-effect',
                joinPath(path, 'call'),
                `"${statement.call}" is not declared in effects`
            );
            return;
        }
        const effect = this.effects[statement.call];
        const given = statement.args ?? {};
        const argsPath = joinPath(path, 'args');
        for (const [name] of entriesOf(effect.args)) {
            if (!hasOwn(given, name)) {
                this.fail(
                    'arity-mismatch',
                    argsPath,
                    `missing argument "${name}" for effect ${statement.call}`
                );
            }
        }
        for (const [name, expr] of entriesOf(given)) {
            const argPath = joinPath(argsPath, name);
            const type = this.expr(expr, argPath, env);
            if (!hasOwn(effect.args, name)) {
                this.fail(
                    'arity-mismatch',
                    argPath,
                    `effect ${statement.call} has no argument "${name}"`
                );
                continue;
            }
            const expected = parseTypeSpec(effect.args[name])!;
            if (type !== null && !sameType(type, expected)) {
                this.fail(
                    'type-mismatch',
                    argPath,
                    `argument ${name} must be ${describeType(expected)}, got ${describeType(type)}`
                );
            }
        }
        if (statement.into === undefined) {
            return;
        }
        const intoPath = joinPath(path, 'into');
        if (effect.returns === undefined) {
            this.fail(
                'into-without-returns',
                intoPath,
                `effect ${statement.call} does not declare returns`
            );
            return;
        }
        const field = this.field(env, statement.into, intoPath);
        const returns = parseTypeSpec(effect.returns)!;
        if (field !== null && !sameType(field, returns)) {
            this.fail(
                'type-mismatch',
                intoPath,
                `${statement.into} is ${describeType(field)}, but effect ${statement.call} returns ${describeType(returns)}`
            );
        }
    }

    private field(env: Env, name: string, path: string): ValueType | null {
        if (!hasOwn(env.body.context, name)) {
            this.fail(
                'unknown-field',
                path,
                `"${name}" is not a context field`
            );
            return null;
        }
        return fieldType(env.body, name);
    }

    private expr(expr: Expr, path: string, env: Env): ValueType | null {
        this.visits += 1;
        if (this.visits > this.budget) {
            this.fail(
                'limit-exceeded',
                path,
                `checking this document visits more than ${this.budget} expressions; a named guard counts its whole expression every place it is used`
            );
            throw new CheckBudgetExceeded();
        }
        if (typeof expr === 'number') {
            return NUMBER;
        }
        if (typeof expr === 'string') {
            return STRING;
        }
        if (typeof expr === 'boolean') {
            return BOOLEAN;
        }
        if ('list' in expr) {
            return this.list(expr, path, env);
        }
        if ('ctx' in expr) {
            return this.field(env, expr.ctx, joinPath(path, 'ctx'));
        }
        if ('payload' in expr) {
            if (env.payload === null) {
                this.fail(
                    'misplaced',
                    path,
                    this.atSite(
                        'payload is only available in on reactions',
                        env
                    )
                );
                return null;
            }
            if (!hasOwn(env.payload, expr.payload)) {
                this.fail(
                    'unknown-field',
                    joinPath(path, 'payload'),
                    this.atSite(
                        `event "${env.event}" has no payload field "${expr.payload}"`,
                        env
                    )
                );
                return null;
            }
            return parseTypeSpec(env.payload[expr.payload]);
        }
        if ('childCtx' in expr) {
            if (env.child === null) {
                this.fail(
                    'misplaced',
                    path,
                    this.atSite('childCtx is only available in onDone', env)
                );
                return null;
            }
            if (!hasOwn(env.child.context, expr.childCtx)) {
                this.fail(
                    'unknown-field',
                    joinPath(path, 'childCtx'),
                    this.atSite(
                        `the child machine has no context field "${expr.childCtx}"`,
                        env
                    )
                );
                return null;
            }
            return fieldType(env.child, expr.childCtx);
        }
        return this.op(expr, path, env);
    }

    private list(
        expr: Extract<Expr, { list: readonly Expr[] }>,
        path: string,
        env: Env
    ): ValueType | null {
        const listPath = joinPath(path, 'list');
        const types = expr.list.map((item, index) =>
            this.expr(item, joinPath(listPath, index), env)
        );
        if (types.some(type => type === null)) {
            return null;
        }
        if (types.length === 0) {
            if (expr.of === undefined) {
                this.fail(
                    'empty-list-needs-type',
                    path,
                    'an empty list needs "of" to say what it holds'
                );
                return null;
            }
            return listType(expr.of);
        }
        const first = types[0]!;
        if (first.kind !== 'scalar') {
            this.fail(
                'type-mismatch',
                joinPath(listPath, 0),
                'list items must be numbers, strings or booleans'
            );
            return null;
        }
        for (let index = 1; index < types.length; index++) {
            if (!sameType(types[index]!, first)) {
                this.fail(
                    'type-mismatch',
                    joinPath(listPath, index),
                    `list items must all be ${first.scalar}`
                );
                return null;
            }
        }
        if (expr.of !== undefined && expr.of !== first.scalar) {
            this.fail(
                'type-mismatch',
                path,
                `the list says it holds ${expr.of} but its items are ${first.scalar}`
            );
            return null;
        }
        return listType(first.scalar);
    }

    private op(
        expr: Extract<Expr, { op: string }>,
        path: string,
        env: Env
    ): ValueType | null {
        const rule = OPERATORS.get(expr.op);
        if (rule === undefined) {
            this.fail(
                'unknown-operator',
                joinPath(path, 'op'),
                `"${expr.op}" is not an operator`
            );
            return null;
        }
        const args = expr.args ?? [];
        if (args.length < rule.min || args.length > rule.max) {
            const expected =
                rule.min === rule.max
                    ? `${rule.min}`
                    : rule.max === Number.POSITIVE_INFINITY
                      ? `at least ${rule.min}`
                      : `${rule.min} to ${rule.max}`;
            this.fail(
                'arity-mismatch',
                path,
                `${expr.op} takes ${expected} arguments, got ${args.length}`
            );
            return null;
        }
        const argsPath = joinPath(path, 'args');
        const types = args.map((arg, index) =>
            this.expr(arg, joinPath(argsPath, index), env)
        );
        if (types.some(type => type === null)) {
            return null;
        }
        const result = rule.type(types as ValueType[]);
        if (typeof result === 'string') {
            this.fail('type-mismatch', path, `${expr.op} ${result}`);
            return null;
        }
        return result;
    }

    private atSite(message: string, env: Env): string {
        return env.site === null
            ? message
            : `${message} (when used at ${env.site})`;
    }

    private fail(code: LoadErrorCode, path: string, message: string): void {
        this.errors.push(loadError(code, path, message));
    }
}
