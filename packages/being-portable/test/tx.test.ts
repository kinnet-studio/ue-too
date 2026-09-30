import { describe, expect, it } from 'vitest';

import { PortableRuntimeFailure, RuntimeError } from '../src/errors';
import { ContextStore } from '../src/interpret/store';
import {
    MAX_QUEUED_REPORTS,
    Transaction,
    TxMachine,
} from '../src/interpret/tx';
import { DEFAULT_LIMITS } from '../src/limits';

function setup() {
    const errors: RuntimeError[] = [];
    const tx = new Transaction(
        error => errors.push(error),
        DEFAULT_LIMITS.maxEventWork
    );
    const store = new ContextStore({ n: { type: 'number', initial: 0 } }, tx);
    let state = 'A';
    const machine: TxMachine = { rawSetState: next => (state = next) };
    const moveTo = (next: string) => {
        tx.recordState(machine, state);
        state = next;
    };
    return { tx, store, errors, moveTo, state: () => state };
}

const failWith = () => {
    throw new PortableRuntimeFailure('index-out-of-range', 'boom', 'do[0]');
};

describe('Transaction', () => {
    it('commits on success', () => {
        const { tx, store, moveTo, state } = setup();
        const outcome = tx.run('go', () => {
            store.set('n', 1);
            moveTo('B');
            return 'done';
        });
        expect(outcome).toEqual({ ok: true, value: 'done' });
        expect(store.get('n')).toBe(1);
        expect(state()).toBe('B');
        expect(tx.isActive).toBe(false);
    });

    it('rolls back stores and states and reports a machine failure', () => {
        const { tx, store, errors, moveTo, state } = setup();
        const outcome = tx.run('go', () => {
            store.set('n', 1);
            moveTo('B');
            tx.callEffect('ping', 'do[0]', () => undefined);
            failWith();
        });
        expect(outcome).toEqual({ ok: false });
        expect(store.get('n')).toBe(0);
        expect(state()).toBe('A');
        expect(errors).toEqual([
            {
                code: 'index-out-of-range',
                message: 'boom',
                path: 'do[0]',
                event: 'go',
                effectsCalled: ['ping'],
            },
        ]);
    });

    it('rolls back and rethrows anything else', () => {
        const { tx, store, errors } = setup();
        expect(() =>
            tx.run(null, () => {
                store.set('n', 1);
                throw new TypeError('host bug');
            })
        ).toThrow('host bug');
        expect(store.get('n')).toBe(0);
        expect(errors).toEqual([]);
        expect(tx.isActive).toBe(false);
    });

    it('turns an effect exception into effect-failed', () => {
        const { tx, errors } = setup();
        tx.run('go', () =>
            tx.callEffect('launch', 'do[2]', () => {
                throw new Error('no fuel');
            })
        );
        expect(errors[0]).toMatchObject({
            code: 'effect-failed',
            path: 'do[2]',
            effectsCalled: ['launch'],
        });
        expect(errors[0].message).toContain('no fuel');
    });

    it('classifies entry by delegation and host code', () => {
        const { tx } = setup();
        expect(tx.entry()).toBe('new');
        tx.run('go', () => {
            expect(tx.entry()).toBe('reentrant');
            tx.delegate(() => {
                expect(tx.entry()).toBe('nested');
                tx.hostCode(() => expect(tx.entry()).toBe('reentrant'));
                tx.callEffect('e', '', () => {
                    expect(tx.entry()).toBe('reentrant');
                });
            });
        });
    });

    it('delivers errors raised during onError after it returns', () => {
        const reports: string[] = [];
        const tx: Transaction = new Transaction(error => {
            reports.push(error.event!);
            if (error.event === 'first') {
                tx.reportError({ ...error, event: 'second' });
                tx.reportError({ ...error, event: 'third' });
                reports.push('first done');
            }
        }, DEFAULT_LIMITS.maxEventWork);
        tx.run('first', failWith);
        expect(reports).toEqual(['first', 'first done', 'second', 'third']);
    });

    it('bounds the errors an onError that keeps calling back can cause', () => {
        const reports: RuntimeError[] = [];
        const tx: Transaction = new Transaction(error => {
            reports.push(error);
            tx.reportReentrant('again', 'happens()');
        }, DEFAULT_LIMITS.maxEventWork);
        tx.run('go', () => tx.reportReentrant('x', 'happens()'));
        expect(reports).toHaveLength(MAX_QUEUED_REPORTS + 2);
        expect(
            reports
                .slice(0, MAX_QUEUED_REPORTS + 1)
                .every(report => report.code === 'reentrant-call')
        ).toBe(true);
        expect(reports[MAX_QUEUED_REPORTS + 1]).toMatchObject({
            code: 'limit-exceeded',
            path: '',
            event: null,
        });
        expect(reports[MAX_QUEUED_REPORTS + 1].message).toContain('dropped');
        // The bound is per delivery: a later failure is delivered, and
        // bounded, the same way.
        const before = reports.length;
        tx.run('later', failWith);
        expect(reports[before].event).toBe('later');
        expect(reports.length - before).toBe(MAX_QUEUED_REPORTS + 2);
    });

    it('meters work inside a transaction only, per run', () => {
        const errors: RuntimeError[] = [];
        const tx = new Transaction(error => errors.push(error), 10);
        tx.charge(100, 'outside');
        expect(errors).toEqual([]);
        expect(tx.run('go', () => tx.charge(11, 'do[0]'))).toEqual({
            ok: false,
        });
        expect(errors).toEqual([
            {
                code: 'limit-exceeded',
                message: 'the event used more than 10 work units',
                path: 'do[0]',
                event: 'go',
                effectsCalled: [],
            },
        ]);
        expect(
            tx.run('go', () => {
                tx.charge(6, 'do[0]');
                tx.charge(4, 'do[1]');
                return 'fits';
            })
        ).toEqual({ ok: true, value: 'fits' });
    });

    it('stacks event frames', () => {
        const { tx } = setup();
        expect(tx.currentFrame()).toBeNull();
        const outer = { payload: null, child: null };
        const inner = { payload: Object.freeze({ a: 1 }), child: null };
        tx.withFrame(outer, () => {
            tx.withFrame(inner, () => expect(tx.currentFrame()).toBe(inner));
            expect(tx.currentFrame()).toBe(outer);
        });
    });
});
