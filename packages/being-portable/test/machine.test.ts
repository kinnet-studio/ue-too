import { extractMachineGraph } from '@ue-too/being';
import { describe, expect, it } from 'vitest';

import { loadMachine } from '../src/api';
import { PortableMachine } from '../src/api-types';
import { Host } from '../src/host';
import { Doc, vendingDoc } from './fixtures';
import { recordingHost } from './recording-host';

function load(doc: Doc, host: Host, autoStart = true): PortableMachine {
    const result = loadMachine(doc, host, { autoStart });
    if (!result.ok) {
        throw new Error(JSON.stringify(result.errors));
    }
    return result.machine;
}

describe('loadMachine', () => {
    it('returns errors instead of a machine for an invalid document', () => {
        const doc = vendingDoc();
        doc.initialState = 'NOWHERE';
        expect(loadMachine(doc, recordingHost().host)).toMatchObject({
            ok: false,
            errors: [{ code: 'unknown-state' }],
        });
    });

    it('starts unless autoStart is false', () => {
        const { host } = recordingHost();
        expect(load(vendingDoc(), host).currentState).toBe('IDLE');
        const idle = load(vendingDoc(), host, false);
        expect(idle.currentState).toBe('INITIAL');
        idle.start();
        expect(idle.currentState).toBe('IDLE');
    });

    it('exposes the normalized definition', () => {
        const machine = load(vendingDoc(), recordingHost().host);
        expect(machine.definition.id).toBe('vending');
        expect(JSON.parse(JSON.stringify(machine.definition))).toEqual(
            vendingDoc()
        );
    });
});

describe('a flat machine', () => {
    it('runs the vending machine', () => {
        const { host, calls } = recordingHost();
        const machine = load(vendingDoc(), host);
        expect(machine.happens('insertCoin', { amount: 3 })).toEqual({
            handled: true,
            nextState: 'HAS_MONEY',
        });
        expect(machine.currentState).toBe('HAS_MONEY');

        const result = machine.happens('select', { item: 'cola', price: 2 });
        expect(result).toEqual({
            handled: true,
            nextState: 'HAS_MONEY',
            output: 1,
        });
        expect(calls).toEqual([{ name: 'dispense', args: { item: 'cola' } }]);
        expect(machine.context.get('sold')).toEqual(['cola']);

        machine.happens('select', { item: 'gum', price: 1 });
        expect(machine.currentState).toBe('IDLE');
        expect(machine.context.fields()).toEqual({
            balance: 0,
            sold: ['cola', 'gum'],
        });
    });

    it('does not handle an event whose precondition fails', () => {
        const { host, calls } = recordingHost();
        const machine = load(vendingDoc(), host);
        machine.happens('insertCoin', { amount: 1 });
        expect(machine.happens('select', { item: 'cola', price: 2 })).toEqual({
            handled: false,
        });
        expect(machine.currentState).toBe('HAS_MONEY');
        expect(calls).toEqual([]);
    });

    it('ignores undeclared events quietly', () => {
        const { host, errors } = recordingHost();
        const machine = load(vendingDoc(), host);
        expect(machine.happens('teleport')).toEqual({ handled: false });
        expect(machine.happens('toString')).toEqual({ handled: false });
        expect(errors).toEqual([]);
    });

    it('reports a payload that does not match the event', () => {
        const { host, errors } = recordingHost();
        const machine = load(vendingDoc(), host);
        expect(machine.happens('insertCoin', { amount: '3' })).toEqual({
            handled: false,
        });
        expect(errors).toMatchObject([
            {
                code: 'payload-mismatch',
                path: 'events.insertCoin',
                event: 'insertCoin',
            },
        ]);
    });

    it('keeps the context read-only for the host', () => {
        const machine = load(vendingDoc(), recordingHost().host);
        expect(() => machine.context.get('missing')).toThrow('missing');
        expect(Object.isFrozen(machine.context.fields())).toBe(true);
        expect(() => machine.setContext(machine.context)).toThrow('setContext');
    });

    it('resets to the initial values', () => {
        const machine = load(vendingDoc(), recordingHost().host);
        machine.happens('insertCoin', { amount: 3 });
        machine.reset();
        expect(machine.currentState).toBe('IDLE');
        expect(machine.context.get('balance')).toBe(0);
    });
});

describe('atomic events', () => {
    it('rolls back when an effect throws mid-event', () => {
        const { host, errors } = recordingHost(
            {},
            {
                refund: () => {
                    throw new Error('jammed');
                },
            }
        );
        const machine = load(vendingDoc(), host);
        machine.happens('insertCoin', { amount: 3 });
        expect(machine.happens('cancel')).toEqual({ handled: false });
        expect(machine.currentState).toBe('HAS_MONEY');
        expect(machine.context.get('balance')).toBe(3);
        expect(errors).toMatchObject([
            {
                code: 'effect-failed',
                path: 'states.HAS_MONEY.on.cancel.do[0]',
                event: 'cancel',
                effectsCalled: ['refund'],
            },
        ]);
    });

    it('rolls back a transition when enter fails', () => {
        const doc = vendingDoc();
        doc.states.HAS_MONEY.enter = [
            { set: 'balance', to: { op: '/', args: [1, 0] } },
        ];
        const { host, errors } = recordingHost();
        const machine = load(doc, host);
        expect(machine.happens('insertCoin', { amount: 3 })).toEqual({
            handled: false,
        });
        expect(machine.currentState).toBe('IDLE');
        expect(machine.context.get('balance')).toBe(0);
        expect(errors[0]).toMatchObject({
            code: 'non-finite-number',
            path: 'states.HAS_MONEY.enter[0]',
        });
    });

    it('leaves the machine in INITIAL when start fails', () => {
        const doc = vendingDoc();
        doc.states.IDLE.enter = [{ removeAt: 'sold', index: 0 }];
        const { host, errors } = recordingHost();
        const result = loadMachine(doc, host);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.machine.currentState).toBe('INITIAL');
        expect(errors[0]).toMatchObject({
            code: 'index-out-of-range',
            event: null,
        });
    });

    it('rolls back and rethrows when a subscriber throws', () => {
        const { host, errors } = recordingHost();
        const machine = load(vendingDoc(), host);
        machine.onStateChange(() => {
            throw new Error('subscriber bug');
        });
        expect(() => machine.happens('insertCoin', { amount: 3 })).toThrow(
            'subscriber bug'
        );
        expect(machine.currentState).toBe('IDLE');
        expect(machine.context.get('balance')).toBe(0);
        expect(errors).toEqual([]);
    });
});

describe('re-entry', () => {
    it('rejects happens() from inside an effect and keeps the outer event', () => {
        let machine: PortableMachine | null = null;
        let inner: unknown = null;
        const { host, errors } = recordingHost(
            {},
            {
                refund: () => {
                    inner = machine!.happens('insertCoin', { amount: 9 });
                },
            }
        );
        machine = load(vendingDoc(), host);
        machine.happens('insertCoin', { amount: 3 });
        expect(machine.happens('cancel')).toEqual({
            handled: true,
            nextState: 'IDLE',
        });
        expect(inner).toEqual({ handled: false });
        expect(machine.context.get('balance')).toBe(0);
        expect(errors).toMatchObject([
            { code: 'reentrant-call', event: 'insertCoin' },
        ]);
    });

    it('rejects happens() from a subscriber, and reset throws', () => {
        const { host, errors } = recordingHost();
        const machine = load(vendingDoc(), host);
        let thrown = '';
        machine.onHappens(() => {
            machine.happens('cancel');
            try {
                machine.reset();
            } catch (error) {
                thrown = (error as Error).message;
            }
        });
        machine.happens('insertCoin', { amount: 1 });
        expect(machine.currentState).toBe('HAS_MONEY');
        expect(errors.map(error => error.code)).toEqual(['reentrant-call']);
        expect(thrown).toMatch(/^reentrant-call/);
    });

    it('lets onError start a new event after a failure', () => {
        let machine: PortableMachine | null = null;
        const { host } = recordingHost({
            onError: () => {
                machine!.happens('insertCoin', { amount: 1 });
            },
        });
        machine = load(vendingDoc(), host);
        machine.happens('insertCoin', { amount: 'bad' as unknown as number });
        expect(machine.context.get('balance')).toBe(1);
    });
});

describe('introspection', () => {
    it('shows named and inline guards in the graph', () => {
        const machine = load(vendingDoc(), recordingHost().host);
        const edges = extractMachineGraph(machine).edges.filter(
            edge => edge.event === 'select'
        );
        expect(edges).toEqual([
            {
                from: 'HAS_MONEY',
                to: 'IDLE',
                event: 'select',
                preconditions: ['canAfford'],
            },
            {
                from: 'HAS_MONEY',
                to: 'HAS_MONEY',
                event: 'select',
                guard: 'balance > 0',
                preconditions: ['canAfford'],
            },
        ]);
    });

    it('lets tools call ctx-only guards outside an event', () => {
        const doc = vendingDoc();
        doc.states.HAS_MONEY.guards.hasMoney = {
            op: '>',
            args: [{ ctx: 'balance' }, 0],
        };
        const machine = load(doc, recordingHost().host);
        machine.happens('insertCoin', { amount: 1 });
        const guards = machine.states.HAS_MONEY.guards;
        expect(guards.hasMoney(machine.context)).toBe(true);
        expect(() => guards.canAfford(machine.context)).toThrow('payload');
    });
});
