import { describe, expect, it } from 'vitest';

import { PlainObject, copyPlainData } from '../src/copy';
import { DEFAULT_LIMITS, Limits } from '../src/limits';
import { checkStructure } from '../src/validate/structure';
import { Doc, vendingDoc } from './fixtures';

function structureErrors(doc: Doc, limits: Limits = DEFAULT_LIMITS) {
    const copied = copyPlainData(doc, limits);
    if (!copied.ok) {
        throw new Error('fixture is not plain data');
    }
    return checkStructure(copied.value as PlainObject, limits).map(
        ({ code, path }) => ({ code, path })
    );
}

describe('checkStructure', () => {
    it('accepts the vending machine', () => {
        expect(structureErrors(vendingDoc())).toEqual([]);
    });

    it('reports missing and unknown keys', () => {
        const doc = vendingDoc();
        delete doc.initialState;
        doc.extra = true;
        expect(structureErrors(doc)).toEqual([
            { code: 'invalid-structure', path: '' },
            { code: 'invalid-structure', path: 'extra' },
        ]);
    });

    it('checks id and revision', () => {
        const doc = vendingDoc();
        doc.id = 'has space';
        doc.revision = -1;
        expect(structureErrors(doc)).toEqual([
            { code: 'invalid-name', path: 'id' },
            { code: 'invalid-structure', path: 'revision' },
        ]);
    });

    it('rejects reserved names in every name position', () => {
        const doc = vendingDoc();
        doc.context = JSON.parse(
            '{"__proto__": {"type": "number", "initial": 0}}'
        );
        doc.states.INITIAL = {};
        doc.events.constructor = {};
        expect(structureErrors(doc)).toEqual([
            { code: 'reserved-name', path: 'context.__proto__' },
            { code: 'reserved-name', path: 'events.constructor' },
            { code: 'reserved-name', path: 'states.INITIAL' },
        ]);
    });

    it('caps names at 128 characters', () => {
        const fits = 'S'.repeat(128);
        const tooLong = 'S'.repeat(129);
        const doc = vendingDoc();
        doc.states[fits] = {};
        expect(structureErrors(doc)).toEqual([]);
        doc.states[tooLong] = {};
        expect(structureErrors(doc)).toEqual([
            { code: 'invalid-name', path: `states.${tooLong}` },
        ]);
    });

    it('checks context fields and their initial values', () => {
        const doc = vendingDoc();
        doc.context.balance.initial = 'zero';
        doc.context.bad = { type: 'object', initial: 1 };
        doc.context.items = { type: 'list', initial: [] };
        doc.context.nested = {
            type: { type: 'list', of: 'string' },
            initial: [],
        };
        expect(structureErrors(doc)).toEqual([
            { code: 'type-mismatch', path: 'context.balance.initial' },
            { code: 'invalid-structure', path: 'context.bad.type' },
            { code: 'invalid-structure', path: 'context.items' },
            { code: 'invalid-structure', path: 'context.items.type' },
            { code: 'invalid-structure', path: 'context.nested.type' },
        ]);
    });

    it('checks type specs in events, outputs and effects', () => {
        const doc = vendingDoc();
        doc.events.select.price = 'float';
        doc.outputs.select = { type: 'list' };
        doc.effects.refund.returns = 'void';
        expect(structureErrors(doc)).toEqual([
            { code: 'invalid-structure', path: 'effects.refund.returns' },
            { code: 'invalid-structure', path: 'events.select.price' },
            { code: 'invalid-structure', path: 'outputs.select' },
        ]);
    });

    it('requires exactly one statement kind', () => {
        const doc = vendingDoc();
        doc.states.IDLE.on.insertCoin.do = [
            { set: 'balance', push: 'sold', to: 1 },
            { nope: 1 },
            'set',
        ];
        expect(structureErrors(doc)).toEqual([
            {
                code: 'invalid-structure',
                path: 'states.IDLE.on.insertCoin.do[0]',
            },
            {
                code: 'invalid-structure',
                path: 'states.IDLE.on.insertCoin.do[1]',
            },
            {
                code: 'invalid-structure',
                path: 'states.IDLE.on.insertCoin.do[2]',
            },
        ]);
    });

    it('requires exactly one expression kind', () => {
        const doc = vendingDoc();
        doc.states.IDLE.on.insertCoin.do = [
            { set: 'balance', to: { ctx: 'balance', payload: 'amount' } },
            { set: 'balance', to: null },
            { set: 'balance', to: [1] },
        ];
        expect(structureErrors(doc).map(error => error.path)).toEqual([
            'states.IDLE.on.insertCoin.do[0].to',
            'states.IDLE.on.insertCoin.do[1].to',
            'states.IDLE.on.insertCoin.do[2].to',
        ]);
    });

    it('allows require only in on reactions', () => {
        const doc = vendingDoc();
        doc.states.HAS_MONEY.onDone = { require: ['canAfford'] };
        expect(structureErrors(doc)).toEqual([
            {
                code: 'invalid-structure',
                path: 'states.HAS_MONEY.onDone.require',
            },
        ]);
    });

    it('enforces the structural limits', () => {
        const limits: Limits = {
            ...DEFAULT_LIMITS,
            maxStates: 1,
            maxStatements: 1,
            maxExpressionDepth: 1,
            maxStatementDepth: 1,
        };
        const doc = vendingDoc();
        doc.states.IDLE.on.insertCoin.do.push({ set: 'balance', to: 0 });
        doc.states.HAS_MONEY.enter = [
            { if: true, then: [{ if: true, then: [] }] },
        ];
        const codes = structureErrors(doc, limits);
        expect(codes).toContainEqual({
            code: 'limit-exceeded',
            path: 'states',
        });
        expect(codes).toContainEqual({
            code: 'limit-exceeded',
            path: 'states.IDLE.on.insertCoin.do',
        });
        expect(codes).toContainEqual({
            code: 'limit-exceeded',
            path: 'states.IDLE.on.insertCoin.do[0].to.args[0]',
        });
        expect(codes).toContainEqual({
            code: 'limit-exceeded',
            path: 'states.HAS_MONEY.enter[0].then[0]',
        });
    });

    it('caps list literals at maxListLength', () => {
        const doc = vendingDoc();
        doc.states.IDLE.on.insertCoin.do = [
            { set: 'sold', to: { list: ['a', 'b'] } },
            { set: 'sold', to: { list: ['a', 'b', 'c'] } },
        ];
        expect(
            structureErrors(doc, { ...DEFAULT_LIMITS, maxListLength: 2 })
        ).toEqual([
            {
                code: 'limit-exceeded',
                path: 'states.IDLE.on.insertCoin.do[1].to',
            },
        ]);
    });

    it('checks child and machines', () => {
        const doc = vendingDoc();
        doc.machines = { inner: { states: {} } };
        doc.states.IDLE.child = { machine: 'inner', extra: 1 };
        expect(structureErrors(doc)).toEqual([
            { code: 'invalid-structure', path: 'machines.inner' },
            { code: 'invalid-structure', path: 'machines.inner' },
            { code: 'invalid-structure', path: 'machines.inner' },
            { code: 'invalid-structure', path: 'states.IDLE.child.extra' },
        ]);
    });
});
