import { RuntimeErrorCode, raise } from '../errors';
import { Expr, ScalarValue, Value } from '../format/types';
import { Services } from '../host';
import { Limits } from '../limits';
import { describeError } from '../util';
import { ContextStore } from './store';

/** A validated, frozen, null-prototype payload. */
export type PayloadRecord = Readonly<Record<string, Value>>;

/** What an expression can read while it runs. */
export type EvalEnv = {
    readonly ctx: ContextStore;
    readonly payload: PayloadRecord | null;
    readonly child: ContextStore | null;
    readonly services: Services;
    readonly limits: Limits;
    /** JSON path reported if evaluation fails. The caller keeps it current. */
    site: string;
};

function fail(env: EvalEnv, code: RuntimeErrorCode, message: string): never {
    return raise(env.site, code, message);
}

function finite(value: number, op: string, env: EvalEnv): number {
    if (!Number.isFinite(value)) {
        fail(env, 'non-finite-number', `${op} produced ${value}`);
    }
    return value;
}

function integer(value: number, what: string, env: EvalEnv): number {
    if (!Number.isInteger(value)) {
        fail(env, 'not-an-integer', `${what} must be an integer, got ${value}`);
    }
    return value;
}

function service(env: EvalEnv, name: 'random' | 'now'): number {
    let value: unknown;
    try {
        value = env.services[name]();
    } catch (error) {
        fail(
            env,
            'service-invalid',
            `${name}() threw: ${describeError(error)}`
        );
    }
    const valid =
        typeof value === 'number' &&
        Number.isFinite(value) &&
        (name === 'now' || (value >= 0 && value < 1));
    if (!valid) {
        fail(
            env,
            'service-invalid',
            name === 'random'
                ? `random() returned ${String(value)}; it must return a number in [0, 1)`
                : `now() returned ${String(value)}; it must return a finite number`
        );
    }
    return value as number;
}

/**
 * Evaluates a validated expression. Types are already guaranteed by the
 * checker; only runtime conditions (ranges, finiteness, limits) can fail.
 */
export function evaluate(expr: Expr, env: EvalEnv): Value {
    if (typeof expr !== 'object') {
        return expr;
    }
    if ('list' in expr) {
        return Object.freeze(
            expr.list.map(item => evaluate(item, env) as ScalarValue)
        );
    }
    if ('ctx' in expr) {
        return env.ctx.get(expr.ctx);
    }
    if ('payload' in expr) {
        if (env.payload === null) {
            throw new Error('payload is not available outside an event');
        }
        return env.payload[expr.payload];
    }
    if ('childCtx' in expr) {
        if (env.child === null) {
            throw new Error('childCtx is only available in onDone');
        }
        return env.child.get(expr.childCtx);
    }
    return applyOperator(expr.op, expr.args ?? [], env);
}

function applyOperator(op: string, args: readonly Expr[], env: EvalEnv): Value {
    const number = (index: number) => evaluate(args[index], env) as number;
    const numbers = () => args.map(arg => evaluate(arg, env) as number);
    const list = (index: number) =>
        evaluate(args[index], env) as readonly ScalarValue[];
    switch (op) {
        case '+':
            return finite(
                numbers().reduce((sum, value) => sum + value),
                op,
                env
            );
        case '*':
            return finite(
                numbers().reduce((product, value) => product * value),
                op,
                env
            );
        case '-':
            return finite(number(0) - number(1), op, env);
        case '/':
            return finite(number(0) / number(1), op, env);
        case '%':
            return finite(number(0) % number(1), op, env);
        case 'min':
            return Math.min(...numbers());
        case 'max':
            return Math.max(...numbers());
        case 'abs':
            return Math.abs(number(0));
        case 'floor':
            return Math.floor(number(0));
        case 'ceil':
            return Math.ceil(number(0));
        case 'round':
            return Math.round(number(0));
        case '==':
            return evaluate(args[0], env) === evaluate(args[1], env);
        case '!=':
            return evaluate(args[0], env) !== evaluate(args[1], env);
        case '<':
            return number(0) < number(1);
        case '<=':
            return number(0) <= number(1);
        case '>':
            return number(0) > number(1);
        case '>=':
            return number(0) >= number(1);
        case 'and':
            return args.every(arg => evaluate(arg, env) === true);
        case 'or':
            return args.some(arg => evaluate(arg, env) === true);
        case 'not':
            return evaluate(args[0], env) !== true;
        case 'cond':
            return evaluate(args[0], env) === true
                ? evaluate(args[1], env)
                : evaluate(args[2], env);
        case 'concat': {
            let text = '';
            for (const arg of args) {
                text += evaluate(arg, env) as string;
                if (text.length > env.limits.maxStringLength) {
                    fail(
                        env,
                        'limit-exceeded',
                        `concat produced more than ${env.limits.maxStringLength} characters`
                    );
                }
            }
            return text;
        }
        case 'toString':
            return String(evaluate(args[0], env));
        case 'length':
            return (evaluate(args[0], env) as string | readonly ScalarValue[])
                .length;
        case 'at': {
            const items = list(0);
            const index = integer(number(1), 'at index', env);
            if (index < 0 || index >= items.length) {
                fail(
                    env,
                    'index-out-of-range',
                    `index ${index} is outside a list of ${items.length}`
                );
            }
            return items[index];
        }
        case 'contains':
            return list(0).includes(evaluate(args[1], env) as ScalarValue);
        case 'indexOf':
            return list(0).indexOf(evaluate(args[1], env) as ScalarValue);
        case 'randomInt': {
            const min = integer(number(0), 'randomInt min', env);
            const max = integer(number(1), 'randomInt max', env);
            if (min > max) {
                fail(
                    env,
                    'invalid-range',
                    `randomInt min ${min} is greater than max ${max}`
                );
            }
            return min + Math.floor(service(env, 'random') * (max - min + 1));
        }
        case 'now':
            return service(env, 'now');
        default:
            throw new Error(`unknown operator ${op}`);
    }
}
