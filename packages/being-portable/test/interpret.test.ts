import { describe, expect, it } from 'vitest';

import { PortableRuntimeFailure } from '../src/errors';
import { Expr, Stmt, Value } from '../src/format/types';
import { HostEffect, Services } from '../src/host';
import { EvalEnv, WorkMeter, evaluate } from '../src/interpret/expr';
import { validatePayload } from '../src/interpret/payload';
import {
    EffectCaller,
    OutputSink,
    StmtEnv,
    checkWrite,
    runStatements,
} from '../src/interpret/stmt';
import { ContextStore, StoreTransaction } from '../src/interpret/store';
import { DEFAULT_LIMITS, Limits } from '../src/limits';

const idle: StoreTransaction = { isActive: false, markDirty: () => {} };

const noMeter: WorkMeter = { charge: () => {} };

/** A meter that adds up every charge. */
function countingMeter(): WorkMeter & { units: number } {
    const meter = {
        units: 0,
        charge(units: number) {
            meter.units += units;
        },
    };
    return meter;
}

function store(): ContextStore {
    return new ContextStore(
        {
            n: { type: 'number', initial: 2 },
            s: { type: 'string', initial: 'hi' },
            items: { type: 'list', of: 'number', initial: [1, 2, 3] },
        },
        idle
    );
}

function env(
    overrides: Partial<EvalEnv> = {},
    services: Partial<Services> = {}
): EvalEnv {
    return {
        ctx: store(),
        payload: Object.freeze({ amount: 5 }),
        child: null,
        services: { random: () => 0.5, now: () => 1000, ...services },
        limits: DEFAULT_LIMITS,
        meter: noMeter,
        site: 'here',
        ...overrides,
    };
}

function failure(run: () => unknown): PortableRuntimeFailure {
    try {
        run();
    } catch (error) {
        if (error instanceof PortableRuntimeFailure) return error;
        throw error;
    }
    throw new Error('expected a failure');
}

const op = (name: string, ...args: Expr[]): Expr => ({ op: name, args });

/**
 * An array subclass holding `indexed`, whose iterator yields `yields[0]` the
 * first time, `yields[1]` the second, and so on (the last one after that).
 */
function lyingList(indexed: unknown[], yields: unknown[][]): Value {
    let call = 0;
    class Liar extends Array<unknown> {
        [Symbol.iterator]() {
            return yields[Math.min(call++, yields.length - 1)][
                Symbol.iterator
            ]();
        }
    }
    const list = new Liar();
    indexed.forEach(item => list.push(item));
    return list as unknown as Value;
}

describe('evaluate', () => {
    it('reads literals, context, payload and lists', () => {
        const e = env();
        expect(evaluate(3, e)).toBe(3);
        expect(evaluate({ ctx: 'n' }, e)).toBe(2);
        expect(evaluate({ payload: 'amount' }, e)).toBe(5);
        const list = evaluate({ list: [1, { ctx: 'n' }] }, e);
        expect(list).toEqual([1, 2]);
        expect(Object.isFrozen(list)).toBe(true);
    });

    it('applies arithmetic and comparison', () => {
        const e = env();
        expect(evaluate(op('+', 1, 2, 3), e)).toBe(6);
        expect(evaluate(op('-', 5, 2), e)).toBe(3);
        expect(evaluate(op('%', 7, 4), e)).toBe(3);
        expect(evaluate(op('max', 1, 9, 4), e)).toBe(9);
        expect(evaluate(op('round', 2.5), e)).toBe(3);
        expect(evaluate(op('>=', { ctx: 'n' }, 2), e)).toBe(true);
        expect(evaluate(op('==', 'a', 'a'), e)).toBe(true);
    });

    it('short-circuits and, or and cond', () => {
        const e = env();
        const boom = op('at', { ctx: 'items' }, 99);
        expect(evaluate(op('and', false, op('==', boom, 1)), e)).toBe(false);
        expect(evaluate(op('or', true, op('==', boom, 1)), e)).toBe(true);
        expect(evaluate(op('cond', true, 1, boom), e)).toBe(1);
        expect(evaluate(op('not', false), e)).toBe(true);
    });

    it('handles strings and lists', () => {
        const e = env();
        expect(evaluate(op('concat', 'a', { ctx: 's' }), e)).toBe('ahi');
        expect(evaluate(op('toString', 1.5), e)).toBe('1.5');
        expect(evaluate(op('length', { ctx: 'items' }), e)).toBe(3);
        expect(evaluate(op('at', { ctx: 'items' }, 1), e)).toBe(2);
        expect(evaluate(op('contains', { ctx: 'items' }, 3), e)).toBe(true);
        expect(evaluate(op('indexOf', { ctx: 'items' }, 9), e)).toBe(-1);
    });

    it('uses the services for randomInt and now', () => {
        expect(evaluate(op('randomInt', 1, 6), env())).toBe(4);
        expect(evaluate(op('now'), env())).toBe(1000);
    });

    it('fails on runtime conditions with the current site', () => {
        const e = env();
        expect(failure(() => evaluate(op('/', 1, 0), e))).toMatchObject({
            code: 'non-finite-number',
            path: 'here',
        });
        expect(
            failure(() => evaluate(op('at', { ctx: 'items' }, 3), e)).code
        ).toBe('index-out-of-range');
        expect(
            failure(() => evaluate(op('at', { ctx: 'items' }, 0.5), e)).code
        ).toBe('not-an-integer');
        expect(failure(() => evaluate(op('randomInt', 6, 1), e)).code).toBe(
            'invalid-range'
        );
    });

    it('rejects bad service values and service exceptions', () => {
        const bad = env({}, { random: () => 1 });
        expect(failure(() => evaluate(op('randomInt', 1, 6), bad)).code).toBe(
            'service-invalid'
        );
        const throwing = env(
            {},
            {
                now: () => {
                    throw new Error('clock down');
                },
            }
        );
        expect(failure(() => evaluate(op('now'), throwing)).message).toContain(
            'clock down'
        );
    });

    it('charges one unit per node plus what an operator scans or builds', () => {
        const cost = (expr: Expr) => {
            const meter = countingMeter();
            evaluate(expr, env({ meter }));
            return meter.units;
        };
        expect(cost(3)).toBe(1);
        expect(cost({ ctx: 'n' })).toBe(1);
        expect(cost(op('+', 1, 2))).toBe(3);
        // node + its 2 items + the 2-item list it builds
        expect(cost({ list: [1, 2] })).toBe(5);
        // node + list + needle + the 3 items it scans
        expect(cost(op('contains', { ctx: 'items' }, 3))).toBe(6);
        expect(cost(op('indexOf', { ctx: 'items' }, 9))).toBe(6);
        // node + 2 args + the 3 characters it builds
        expect(cost(op('concat', 'ab', 'c'))).toBe(6);
        expect(cost(op('length', { ctx: 'items' }))).toBe(2);
        expect(cost(op('at', { ctx: 'items' }, 0))).toBe(3);
        expect(cost(op('toString', 1))).toBe(2);
    });

    it('caps concat results', () => {
        const limits: Limits = { ...DEFAULT_LIMITS, maxStringLength: 4 };
        expect(
            failure(() => evaluate(op('concat', 'abc', 'de'), env({ limits })))
                .code
        ).toBe('limit-exceeded');
    });
});

function stmtEnv(
    overrides: Partial<StmtEnv> = {},
    effects: Record<string, Partial<HostEffect>> = {}
): { env: StmtEnv; calls: string[] } {
    const calls: string[] = [];
    const caller: EffectCaller = {
        callEffect: (name, _site, run) => {
            calls.push(name);
            return run();
        },
    };
    const map = new Map<string, HostEffect>();
    for (const [name, effect] of Object.entries(effects)) {
        map.set(name, {
            args: new Map(),
            returns: null,
            run: () => undefined,
            ...effect,
        });
    }
    return {
        env: {
            ...env(),
            effects: map,
            calls: caller,
            output: null,
            ...overrides,
        },
        calls,
    };
}

describe('runStatements', () => {
    it('runs set, push, removeAt and if', () => {
        const { env: e } = stmtEnv();
        const statements: Stmt[] = [
            { set: 'n', to: op('+', { ctx: 'n' }, { payload: 'amount' }) },
            { push: 'items', value: 4 },
            { removeAt: 'items', index: 0 },
            {
                if: op('>', { ctx: 'n' }, 5),
                then: [{ set: 's', to: 'big' }],
                else: [{ set: 's', to: 'small' }],
            },
        ];
        runStatements(statements, e, 'do');
        expect(e.ctx.get('n')).toBe(7);
        expect(e.ctx.get('items')).toEqual([2, 3, 4]);
        expect(e.ctx.get('s')).toBe('big');
        expect(Object.isFrozen(e.ctx.get('items'))).toBe(true);
    });

    it('writes output to the sink', () => {
        const sink: OutputSink = { value: undefined };
        const { env: e } = stmtEnv({ output: sink });
        runStatements([{ output: op('*', { ctx: 'n' }, 10) }], e, 'do');
        expect(sink.value).toBe(20);
    });

    it('calls effects with frozen args and writes into', () => {
        let received: Readonly<Record<string, Value>> | null = null;
        const { env: e, calls } = stmtEnv(
            {},
            {
                draw: {
                    returns: { kind: 'scalar', scalar: 'string' },
                    run: args => {
                        received = args;
                        return 'card';
                    },
                },
            }
        );
        runStatements(
            [{ call: 'draw', args: { n: { ctx: 'n' } }, into: 's' }],
            e,
            'do'
        );
        expect(calls).toEqual(['draw']);
        expect(received).toEqual({ n: 2 });
        expect(Object.isFrozen(received)).toBe(true);
        expect(e.ctx.get('s')).toBe('card');
    });

    it('rejects an effect return of the wrong type', () => {
        const { env: e } = stmtEnv(
            {},
            {
                draw: {
                    returns: { kind: 'scalar', scalar: 'string' },
                    run: () => 7,
                },
            }
        );
        expect(
            failure(() => runStatements([{ call: 'draw', into: 's' }], e, 'do'))
        ).toMatchObject({ code: 'effect-return-mismatch', path: 'do[0]' });
    });

    it('reports the path of the failing nested statement', () => {
        const { env: e } = stmtEnv();
        expect(
            failure(() =>
                runStatements(
                    [
                        {
                            if: true,
                            then: [
                                { set: 'n', to: 1 },
                                { removeAt: 'items', index: 9 },
                            ],
                        },
                    ],
                    e,
                    'on.x.do'
                )
            )
        ).toMatchObject({
            code: 'index-out-of-range',
            path: 'on.x.do[0].then[1]',
        });
    });

    it('rejects a randomInt range too wide to count, changing nothing', () => {
        const { env: e } = stmtEnv();
        expect(
            failure(() =>
                runStatements(
                    [{ set: 'n', to: op('randomInt', -1e308, 1e308) }],
                    e,
                    'do'
                )
            )
        ).toMatchObject({ code: 'invalid-range', path: 'do[0]' });
        expect(e.ctx.get('n')).toBe(2);
    });

    it('never writes a non-finite number', () => {
        expect(
            failure(() => checkWrite(Number.POSITIVE_INFINITY, env())).code
        ).toBe('non-finite-number');
        expect(failure(() => checkWrite(Number.NaN, env())).code).toBe(
            'non-finite-number'
        );
    });

    it('charges one unit per statement plus what it copies or scans', () => {
        const cost = (statement: Stmt, effects = {}) => {
            const meter = countingMeter();
            const { env: e } = stmtEnv({ meter }, effects);
            runStatements([statement], e, 'do');
            return meter.units;
        };
        expect(cost({ set: 'n', to: 1 })).toBe(2);
        // statement + literal + the 3 characters written
        expect(cost({ set: 's', to: 'hey' })).toBe(5);
        // statement + literal + the 3-item list it copies
        expect(cost({ push: 'items', value: 4 })).toBe(5);
        expect(cost({ removeAt: 'items', index: 0 })).toBe(5);
        // statement + list node, item and length + the 1 item written
        expect(cost({ set: 'items', to: { list: [1] } })).toBe(5);
        // statement + arg + call + the 3-item list argument + 2 items returned
        expect(
            cost(
                {
                    call: 'pick',
                    args: { from: { ctx: 'items' } },
                    into: 'items',
                },
                {
                    pick: {
                        returns: { kind: 'list', of: 'number' },
                        run: () => [7, 8],
                    },
                }
            )
        ).toBe(8);
    });

    it('checks the same effect result it stores, whatever the iterator says', () => {
        const pick = (result: Value) => ({
            pick: {
                returns: { kind: 'list', of: 'number' } as const,
                run: () => result,
            },
        });
        const honest = stmtEnv({}, pick(lyingList([7, 8], [[7, 8], ['x']])));
        runStatements([{ call: 'pick', into: 'items' }], honest.env, 'do');
        expect(honest.env.ctx.get('items')).toEqual([7, 8]);
        expect(Object.getPrototypeOf(honest.env.ctx.get('items'))).toBe(
            Array.prototype
        );

        const lying = stmtEnv({}, pick(lyingList(['x'], [[7]])));
        expect(
            failure(() =>
                runStatements(
                    [{ call: 'pick', into: 'items' }],
                    lying.env,
                    'do'
                )
            ).code
        ).toBe('effect-return-mismatch');
        expect(lying.env.ctx.get('items')).toEqual([1, 2, 3]);
    });

    it('enforces list and string limits on writes', () => {
        const limits: Limits = {
            ...DEFAULT_LIMITS,
            maxListLength: 3,
            maxStringLength: 3,
        };
        const { env: e } = stmtEnv({ limits });
        expect(
            failure(() => runStatements([{ push: 'items', value: 4 }], e, 'do'))
                .code
        ).toBe('limit-exceeded');
        expect(
            failure(() => runStatements([{ set: 's', to: 'long' }], e, 'do'))
                .code
        ).toBe('limit-exceeded');
    });
});

describe('ContextStore', () => {
    it('rolls back to the values before the transaction', () => {
        const dirty: ContextStore[] = [];
        const tx = {
            isActive: true,
            markDirty: (s: ContextStore) => dirty.push(s),
        };
        const s = new ContextStore({ n: { type: 'number', initial: 1 } }, tx);
        s.set('n', 2);
        s.set('n', 3);
        expect(dirty).toEqual([s]);
        s.rollbackTransaction();
        expect(s.get('n')).toBe(1);
        s.set('n', 4);
        s.commitTransaction();
        s.set('n', 5);
        s.rollbackTransaction();
        expect(s.get('n')).toBe(4);
    });
});

describe('validatePayload', () => {
    const fields = {
        amount: 'number' as const,
        tags: { type: 'list' as const, of: 'string' as const },
    };

    it('copies a valid payload into a frozen null-prototype record', () => {
        const tags = ['a'];
        const result = validatePayload(
            fields,
            { amount: 1, tags },
            DEFAULT_LIMITS
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(Object.getPrototypeOf(result.value)).toBeNull();
        tags.push('b');
        expect(result.value.tags).toEqual(['a']);
    });

    it('rejects missing, extra and mistyped fields', () => {
        expect(validatePayload(fields, { amount: 1 }, DEFAULT_LIMITS).ok).toBe(
            false
        );
        expect(
            validatePayload(
                fields,
                { amount: 1, tags: [], x: 1 },
                DEFAULT_LIMITS
            ).ok
        ).toBe(false);
        expect(
            validatePayload(fields, { amount: '1', tags: [] }, DEFAULT_LIMITS)
                .ok
        ).toBe(false);
        expect(validatePayload(fields, [1], DEFAULT_LIMITS).ok).toBe(false);
    });

    it('checks the same list data it stores, whatever the iterator says', () => {
        const honest = validatePayload(
            fields,
            {
                amount: 1,
                tags: lyingList(
                    ['a', 'b'],
                    [
                        ['a', 'b'],
                        [1, 2],
                    ]
                ),
            },
            DEFAULT_LIMITS
        );
        expect(honest.ok).toBe(true);
        if (!honest.ok) return;
        expect(honest.value.tags).toEqual(['a', 'b']);
        expect(Object.getPrototypeOf(honest.value.tags)).toBe(Array.prototype);
        expect(Object.isFrozen(honest.value.tags)).toBe(true);

        const lying = validatePayload(
            fields,
            { amount: 1, tags: lyingList([1, 2], [['a', 'b']]) },
            DEFAULT_LIMITS
        );
        expect(lying.ok).toBe(false);
    });

    it('rejects an over-long list without copying all of it', () => {
        const result = validatePayload(
            fields,
            { amount: 1, tags: new Array(1_000_000_000) },
            DEFAULT_LIMITS
        );
        expect(result).toEqual({
            ok: false,
            message: 'payload field "tags" is longer than the limits allow',
        });
    });

    it('allows no payload for an event without fields', () => {
        expect(validatePayload({}, undefined, DEFAULT_LIMITS).ok).toBe(true);
        expect(validatePayload(fields, undefined, DEFAULT_LIMITS).ok).toBe(
            false
        );
    });
});
