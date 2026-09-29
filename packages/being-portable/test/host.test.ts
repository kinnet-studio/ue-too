import { describe, expect, it } from 'vitest';

import { validateDefinition } from '../src/api';
import { defineHost } from '../src/host';
import { vendingDoc } from './fixtures';

const noop = () => {};

describe('defineHost', () => {
    it('fills in services, limits and onError', () => {
        const host = defineHost();
        expect(host.effects.size).toBe(0);
        expect(typeof host.services.random()).toBe('number');
        expect(host.limits.maxNodes).toBe(50_000);
        expect(Object.isFrozen(host)).toBe(true);
    });

    it('parses effect signatures', () => {
        const host = defineHost({
            effects: {
                draw: {
                    args: { n: 'number' },
                    returns: { type: 'list', of: 'string' },
                    run: () => [],
                },
            },
        });
        const draw = host.effects.get('draw')!;
        expect(draw.args.get('n')).toEqual({
            kind: 'scalar',
            scalar: 'number',
        });
        expect(draw.returns).toEqual({ kind: 'list', of: 'string' });
    });

    it('throws on a malformed host', () => {
        expect(() =>
            defineHost({ effects: { 'bad name': { args: {}, run: noop } } })
        ).toThrow('defineHost');
        expect(() =>
            defineHost({
                effects: { e: { args: { x: 'float' as any }, run: noop } },
            })
        ).toThrow('argument x of effect e');
        expect(() =>
            defineHost({ effects: { e: { args: {} } as any } })
        ).toThrow('run function');
        expect(() => defineHost({ limits: { maxNodes: -1 } })).toThrow(
            'maxNodes'
        );
    });
});

describe('validateDefinition', () => {
    it('returns the frozen definition', () => {
        const result = validateDefinition(vendingDoc());
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.definition.id).toBe('vending');
        expect(Object.isFrozen(result.definition.states)).toBe(true);
    });

    it('rejects input that is not JSON data before validating it', () => {
        expect(
            validateDefinition({ ...vendingDoc(), id: () => 1 })
        ).toMatchObject({
            ok: false,
            errors: [{ code: 'not-plain-data', path: 'id' }],
        });
    });
});

describe('host effect checks', () => {
    const matching = {
        dispense: { args: { item: 'string' as const }, run: noop },
        refund: { args: { amount: 'number' as const }, run: noop },
    };

    it('accepts a host with exactly matching effects, plus extras', () => {
        const host = defineHost({
            effects: {
                ...matching,
                extra: { args: {}, run: noop },
            },
        });
        expect(validateDefinition(vendingDoc(), { host }).ok).toBe(true);
    });

    it('reports missing effects', () => {
        const host = defineHost({ effects: { dispense: matching.dispense } });
        expect(validateDefinition(vendingDoc(), { host })).toMatchObject({
            ok: false,
            errors: [{ code: 'missing-effect', path: 'effects.refund' }],
        });
    });

    it('reports signature mismatches in args and returns', () => {
        const host = defineHost({
            effects: {
                dispense: { args: { item: 'number' }, run: noop },
                refund: {
                    args: { amount: 'number' },
                    returns: 'number',
                    run: noop,
                },
            },
        });
        const result = validateDefinition(vendingDoc(), { host });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors.map(error => error.path)).toEqual([
            'effects.dispense',
            'effects.refund',
        ]);
        expect(result.errors[0].message).toContain('(item: string)');
    });

    it('caps the host effect errors it reports', () => {
        const doc = vendingDoc();
        for (let i = 0; i < 1500; i++) {
            doc.effects[`e${i}`] = { args: {} };
        }
        const result = validateDefinition(doc, { host: defineHost() });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors).toHaveLength(1001);
        expect(result.errors[0].code).toBe('missing-effect');
        expect(result.errors[1000]).toMatchObject({
            code: 'limit-exceeded',
            path: '',
        });
        expect(result.errors[1000].message).toContain('502 more errors');
    });

    it('uses the host limits unless limits are given', () => {
        const host = defineHost({
            effects: matching,
            limits: { maxNodes: 10 },
        });
        expect(validateDefinition(vendingDoc(), { host })).toMatchObject({
            ok: false,
            errors: [{ code: 'limit-exceeded' }],
        });
        expect(
            validateDefinition(vendingDoc(), {
                host,
                limits: { maxNodes: 1000 },
            }).ok
        ).toBe(true);
    });
});
