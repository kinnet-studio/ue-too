import { RuntimeErrorCode, raise } from '../errors';
import { ScalarValue, Stmt, Value } from '../format/types';
import { checkValue, describeType, freezeValue } from '../format/values';
import { HostEffect } from '../host';
import { EvalEnv, evaluate } from './expr';

/** Where an `output` statement writes. */
export type OutputSink = { value: Value | undefined };

/** Runs an effect on behalf of a statement; the transaction implements it. */
export interface EffectCaller {
    callEffect(
        name: string,
        site: string,
        run: () => Value | void
    ): Value | void;
}

export type StmtEnv = EvalEnv & {
    readonly effects: ReadonlyMap<string, HostEffect>;
    readonly calls: EffectCaller;
    /** `null` where `output` is not allowed (the checker guarantees it is unused). */
    readonly output: OutputSink | null;
};

function fail(env: EvalEnv, code: RuntimeErrorCode, message: string): never {
    return raise(env.site, code, message);
}

function checkString(value: string, env: EvalEnv): void {
    if (value.length > env.limits.maxStringLength) {
        fail(
            env,
            'limit-exceeded',
            `string longer than ${env.limits.maxStringLength} characters`
        );
    }
}

/**
 * Fails when a value about to be written exceeds the list or string limits,
 * or is a non-finite number (a backstop: operators already check).
 */
export function checkWrite(value: Value, env: EvalEnv): void {
    if (typeof value === 'string') {
        checkString(value, env);
        return;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            fail(env, 'non-finite-number', `cannot write ${value}`);
        }
        return;
    }
    if (typeof value !== 'object') {
        return;
    }
    if (value.length > env.limits.maxListLength) {
        fail(
            env,
            'limit-exceeded',
            `list longer than ${env.limits.maxListLength} items`
        );
    }
    for (const item of value) {
        if (typeof item === 'string') {
            checkString(item, env);
        }
    }
}

/** Runs validated statements in order. Throws `PortableRuntimeFailure` on failure. */
export function runStatements(
    statements: readonly Stmt[],
    env: StmtEnv,
    path: string
): void {
    for (let index = 0; index < statements.length; index++) {
        const statement = statements[index];
        const site = `${path}[${index}]`;
        env.site = site;
        if ('set' in statement) {
            const value = evaluate(statement.to, env);
            checkWrite(value, env);
            env.ctx.set(statement.set, value);
        } else if ('push' in statement) {
            const item = evaluate(statement.value, env) as ScalarValue;
            const items = env.ctx.get(statement.push) as readonly ScalarValue[];
            if (items.length + 1 > env.limits.maxListLength) {
                fail(
                    env,
                    'limit-exceeded',
                    `list longer than ${env.limits.maxListLength} items`
                );
            }
            if (typeof item === 'string') {
                checkString(item, env);
            }
            env.ctx.set(statement.push, Object.freeze([...items, item]));
        } else if ('removeAt' in statement) {
            const index = evaluate(statement.index, env) as number;
            const items = env.ctx.get(
                statement.removeAt
            ) as readonly ScalarValue[];
            if (!Number.isInteger(index)) {
                fail(
                    env,
                    'not-an-integer',
                    `removeAt index must be an integer, got ${index}`
                );
            }
            if (index < 0 || index >= items.length) {
                fail(
                    env,
                    'index-out-of-range',
                    `index ${index} is outside a list of ${items.length}`
                );
            }
            env.ctx.set(
                statement.removeAt,
                Object.freeze([
                    ...items.slice(0, index),
                    ...items.slice(index + 1),
                ])
            );
        } else if ('if' in statement) {
            const taken = evaluate(statement.if, env) === true;
            const branch = taken ? statement.then : statement.else;
            if (branch !== undefined) {
                runStatements(
                    branch,
                    env,
                    `${site}.${taken ? 'then' : 'else'}`
                );
            }
        } else if ('call' in statement) {
            runCall(statement, env, site);
        } else {
            const value = evaluate(statement.output, env);
            checkWrite(value, env);
            if (env.output !== null) {
                env.output.value = value;
            }
        }
    }
}

function runCall(
    statement: Extract<Stmt, { call: string }>,
    env: StmtEnv,
    site: string
): void {
    const effect = env.effects.get(statement.call);
    if (effect === undefined) {
        throw new Error(`effect ${statement.call} is not available`);
    }
    const args: Record<string, Value> = Object.create(null);
    const given = statement.args ?? {};
    for (const name of Object.keys(given)) {
        args[name] = evaluate(given[name], env);
    }
    env.site = site;
    Object.freeze(args);
    const returned = env.calls.callEffect(statement.call, site, () =>
        effect.run(args)
    );
    if (statement.into === undefined) {
        return;
    }
    const returns = effect.returns!;
    const check = checkValue(returned, returns, env.limits);
    if (check !== 'ok') {
        fail(
            env,
            check === 'limit' ? 'limit-exceeded' : 'effect-return-mismatch',
            `effect ${statement.call} returned ${Array.isArray(returned) ? 'a list' : typeof returned}, expected ${describeType(returns)}`
        );
    }
    env.ctx.set(statement.into, freezeValue(returned as Value));
}
