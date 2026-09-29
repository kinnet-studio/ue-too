import { describe, expect, it } from 'vitest';

import { copyPlainData } from '../src/copy';
import { DEFAULT_LIMITS, Limits, resolveLimits } from '../src/limits';
import { checkDefinition } from '../src/validate';
import { Doc, gameDoc, vendingDoc } from './fixtures';

function check(doc: Doc, limits: Partial<Limits> = {}) {
    const resolved = resolveLimits(limits);
    const copied = copyPlainData(doc, resolved);
    if (!copied.ok) {
        throw new Error('fixture is not plain data');
    }
    return checkDefinition(copied.value, resolved);
}

function errorsOf(doc: Doc, limits: Partial<Limits> = {}) {
    const result = check(doc, limits);
    return result.ok
        ? []
        : result.errors.map(({ code, path }) => ({ code, path }));
}

describe('checkDefinition', () => {
    it('accepts the fixtures', () => {
        expect(errorsOf(vendingDoc())).toEqual([]);
        expect(errorsOf(gameDoc())).toEqual([]);
    });

    it('returns the frozen definition', () => {
        const result = check(vendingDoc());
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.definition.id).toBe('vending');
        expect(Object.isFrozen(result.definition.states)).toBe(true);
    });

    it('stops after the structure pass', () => {
        const doc = vendingDoc();
        doc.revision = 'one';
        doc.initialState = 'NOWHERE';
        expect(errorsOf(doc)).toEqual([
            { code: 'invalid-structure', path: 'revision' },
        ]);
    });

    it('reports several semantic errors at once', () => {
        const doc = vendingDoc();
        doc.initialState = 'NOWHERE';
        doc.states.IDLE.on.insertCoin.target = 'GONE';
        doc.states.IDLE.on.insertCoin.do[0].to.args[0] = { ctx: 'missing' };
        expect(errorsOf(doc)).toEqual([
            { code: 'unknown-state', path: 'initialState' },
            { code: 'unknown-state', path: 'states.IDLE.on.insertCoin.target' },
            {
                code: 'unknown-field',
                path: 'states.IDLE.on.insertCoin.do[0].to.args[0].ctx',
            },
        ]);
    });
});

describe('references', () => {
    it('checks events, guards and branch targets', () => {
        const doc = vendingDoc();
        doc.states.IDLE.on.teleport = {};
        doc.states.HAS_MONEY.on.select.require = ['canFly'];
        doc.states.HAS_MONEY.on.select.branches[0].target = 'MOON';
        expect(errorsOf(doc)).toEqual([
            { code: 'unknown-event', path: 'states.IDLE.on.teleport' },
            {
                code: 'unknown-guard',
                path: 'states.HAS_MONEY.on.select.require[0]',
            },
            {
                code: 'unknown-state',
                path: 'states.HAS_MONEY.on.select.branches[0].target',
            },
        ]);
    });

    it('checks child machines and with fields', () => {
        const doc = gameDoc();
        doc.states.PLAYING.child.with.nope = 1;
        doc.states.LOBBY.child = { machine: 'missing' };
        expect(errorsOf(doc)).toEqual([
            { code: 'unknown-machine', path: 'states.LOBBY.child.machine' },
            { code: 'unknown-field', path: 'states.PLAYING.child.with.nope' },
        ]);
    });

    it('checks final states and onDone', () => {
        const doc = gameDoc();
        doc.machines.turn.states.DONE.on = { roll: {} };
        doc.machines.turn.initialState = 'DONE';
        doc.states.LOBBY.onDone = { target: 'LOBBY' };
        expect(errorsOf(doc)).toEqual([
            { code: 'on-done-without-child', path: 'states.LOBBY.onDone' },
            {
                code: 'final-initial-state',
                path: 'machines.turn.initialState',
            },
            {
                code: 'final-state-has-reactions',
                path: 'machines.turn.states.DONE',
            },
        ]);
    });

    it('reports onDone when the child can never finish', () => {
        const doc = gameDoc();
        delete doc.machines.turn.states.DONE.final;
        expect(errorsOf(doc)).toEqual([
            { code: 'on-done-unreachable', path: 'states.PLAYING.onDone' },
        ]);
    });

    it('requires child events and outputs to match the parent', () => {
        const doc = gameDoc();
        doc.machines.turn.events.roll = { value: 'string' };
        doc.machines.turn.events.extra = {};
        doc.machines.turn.outputs = { roll: 'number' };
        expect(errorsOf(doc).map(error => error.code)).toEqual([
            'child-event-mismatch',
            'child-event-mismatch',
            'child-event-mismatch',
            // the child's own roll reaction now multiplies a string
            'type-mismatch',
        ]);
    });

    it('rejects machine cycles', () => {
        const doc = gameDoc();
        doc.machines.turn.states.ROLLING.child = { machine: 'turn' };
        delete doc.machines.turn.states.ROLLING.on;
        expect(errorsOf(doc)).toContainEqual({
            code: 'machine-cycle',
            path: 'machines.turn',
        });
    });

    it('enforces nesting depth and instance count', () => {
        const chain = gameDoc();
        chain.machines.inner = {
            context: {},
            events: {},
            initialState: 'A',
            states: { A: {} },
        };
        chain.machines.turn.states.ROLLING.child = { machine: 'inner' };
        delete chain.machines.turn.states.ROLLING.on;
        delete chain.machines.turn.states.ROLLING.enter;
        delete chain.machines.turn.states.ROLLING.exit;
        expect(errorsOf(chain, { maxNestingDepth: 1 })).toEqual([
            { code: 'limit-exceeded', path: 'machines' },
        ]);

        const wide = gameDoc();
        wide.states.LOBBY.child = { machine: 'turn' };
        delete wide.states.LOBBY.on;
        expect(errorsOf(wide, { maxMachineInstances: 2 })).toEqual([
            { code: 'limit-exceeded', path: 'machines' },
        ]);
        expect(DEFAULT_LIMITS.maxMachineInstances).toBe(256);
    });
});

describe('types and placement', () => {
    it('type-checks operators and statements', () => {
        const doc = vendingDoc();
        doc.states.IDLE.on.insertCoin.do = [
            { set: 'balance', to: 'lots' },
            { push: 'balance', value: 1 },
            { push: 'sold', value: 1 },
            { set: 'balance', to: { op: 'concat', args: ['a', 'b'] } },
            { set: 'balance', to: { op: '+', args: [1] } },
            { set: 'balance', to: { op: 'pow', args: [1, 2] } },
            { if: 1, then: [] },
        ];
        expect(errorsOf(doc)).toEqual([
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[0].to',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[1].push',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[2].value',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[3].to',
            },
            {
                code: 'arity-mismatch',
                path: 'states.IDLE.on.insertCoin.do[4].to',
            },
            {
                code: 'unknown-operator',
                path: 'states.IDLE.on.insertCoin.do[5].to.op',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[6].if',
            },
        ]);
    });

    it('does not resolve operators through prototypes', () => {
        const doc = vendingDoc();
        doc.states.IDLE.on.insertCoin.do = [
            { set: 'balance', to: { op: 'constructor', args: [] } },
            { set: 'balance', to: { op: 'hasOwnProperty', args: [] } },
        ];
        expect(errorsOf(doc).map(error => error.code)).toEqual([
            'unknown-operator',
            'unknown-operator',
        ]);
    });

    it('types list literals', () => {
        const doc = vendingDoc();
        doc.states.IDLE.on.insertCoin.do = [
            { set: 'sold', to: { list: [] } },
            { set: 'sold', to: { list: [], of: 'string' } },
            { set: 'sold', to: { list: ['a', 1] } },
            { set: 'sold', to: { list: ['a'], of: 'number' } },
        ];
        expect(errorsOf(doc)).toEqual([
            {
                code: 'empty-list-needs-type',
                path: 'states.IDLE.on.insertCoin.do[0].to',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[2].to.list[1]',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[3].to',
            },
        ]);
    });

    it('rejects payload outside on reactions and childCtx outside onDone', () => {
        const doc = gameDoc();
        doc.states.LOBBY.enter = [
            {
                push: 'log',
                value: { op: 'toString', args: [{ payload: 'value' }] },
            },
        ];
        doc.states.LOBBY.on.begin.do = [
            { set: 'score', to: { childCtx: 'points' } },
        ];
        doc.states.PLAYING.child.with.playerCount = { payload: 'value' };
        expect(errorsOf(doc)).toEqual([
            { code: 'misplaced', path: 'states.LOBBY.enter[0].value.args[0]' },
            { code: 'misplaced', path: 'states.LOBBY.on.begin.do[0].to' },
            {
                code: 'misplaced',
                path: 'states.PLAYING.child.with.playerCount',
            },
        ]);
    });

    it('checks named guards at each use', () => {
        const doc = vendingDoc();
        doc.states.HAS_MONEY.on.cancel.require = ['canAfford'];
        const result = check(doc);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors).toEqual([
            {
                code: 'unknown-field',
                path: 'states.HAS_MONEY.guards.canAfford.args[1].payload',
                message:
                    'event "cancel" has no payload field "price" (when used at states.HAS_MONEY.on.cancel.require[0])',
            },
        ]);
    });

    it('checks output placement and type', () => {
        const doc = vendingDoc();
        doc.states.IDLE.on.insertCoin.do.push({ output: 1 });
        doc.states.HAS_MONEY.enter = [{ output: 1 }];
        doc.states.HAS_MONEY.on.select.do[3] = { output: 'x' };
        expect(errorsOf(doc)).toEqual([
            {
                code: 'output-not-declared',
                path: 'states.IDLE.on.insertCoin.do[1]',
            },
            { code: 'misplaced', path: 'states.HAS_MONEY.enter[0]' },
            {
                code: 'type-mismatch',
                path: 'states.HAS_MONEY.on.select.do[3].output',
            },
        ]);
    });

    it('checks effect calls', () => {
        const doc = vendingDoc();
        doc.effects.draw = { args: {}, returns: 'string' };
        doc.states.IDLE.on.insertCoin.do = [
            { call: 'launch', args: {} },
            { call: 'dispense', args: {} },
            { call: 'dispense', args: { item: 1, extra: 2 } },
            { call: 'refund', args: { amount: 1 }, into: 'balance' },
            { call: 'draw', into: 'balance' },
            { call: 'draw', into: 'sold' },
        ];
        expect(errorsOf(doc)).toEqual([
            {
                code: 'unknown-effect',
                path: 'states.IDLE.on.insertCoin.do[0].call',
            },
            {
                code: 'arity-mismatch',
                path: 'states.IDLE.on.insertCoin.do[1].args',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[2].args.item',
            },
            {
                code: 'arity-mismatch',
                path: 'states.IDLE.on.insertCoin.do[2].args.extra',
            },
            {
                code: 'into-without-returns',
                path: 'states.IDLE.on.insertCoin.do[3].into',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[4].into',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[5].into',
            },
        ]);
    });

    it('type-checks with against the child field', () => {
        const doc = gameDoc();
        doc.states.PLAYING.child.with.playerCount = 'two';
        expect(errorsOf(doc)).toEqual([
            {
                code: 'type-mismatch',
                path: 'states.PLAYING.child.with.playerCount',
            },
        ]);
    });

    it('caps the work of re-checking named guards at each use', () => {
        const doc = vendingDoc();
        doc.states.HAS_MONEY.guards.big = {
            op: 'and',
            args: Array.from({ length: 200 }, () => true),
        };
        doc.states.HAS_MONEY.on.select.require = Array.from(
            { length: 1000 },
            () => 'big'
        );
        expect(errorsOf(doc).map(error => error.code)).toEqual([
            'limit-exceeded',
        ]);
    });
});
