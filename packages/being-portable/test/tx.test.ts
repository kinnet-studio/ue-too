import { describe, expect, it } from 'vitest';

import { PortableRuntimeFailure, RuntimeError } from '../src/errors';
import { ContextStore } from '../src/interpret/store';
import { Transaction, TxMachine } from '../src/interpret/tx';

function setup() {
    const errors: RuntimeError[] = [];
    const tx = new Transaction(error => errors.push(error));
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

    it('does not recurse when onError calls back during a re-entrant report', () => {
        const reports: RuntimeError[] = [];
        const tx: Transaction = new Transaction(error => {
            reports.push(error);
            tx.reportReentrant('again', 'happens()');
        });
        tx.run('go', () => tx.reportReentrant('x', 'happens()'));
        expect(reports.map(report => report.code)).toEqual(['reentrant-call']);
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
