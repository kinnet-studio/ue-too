import { describe, expect, it } from 'vitest';

import { MAX_COPY_DEPTH, copyPlainData } from '../src/copy';
import { DEFAULT_LIMITS } from '../src/limits';
import { migrateDefinition, migrateSnapshot } from '../src/migrate';

const limits = DEFAULT_LIMITS;

function errorOf(input: unknown, override = limits) {
    const result = copyPlainData(input, override);
    if (result.ok) {
        throw new Error('expected the copy to fail');
    }
    return result.errors[0];
}

describe('copyPlainData', () => {
    it('copies JSON data into frozen null-prototype objects', () => {
        const input = { a: [1, 'x', true, null], b: { c: 2 } };
        const result = copyPlainData(input, limits);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const value = result.value as any;
        expect(value).toEqual(input);
        expect(value).not.toBe(input);
        expect(Object.getPrototypeOf(value)).toBeNull();
        expect(Object.isFrozen(value)).toBe(true);
        expect(Object.isFrozen(value.a)).toBe(true);
        input.b.c = 99;
        expect(value.b.c).toBe(2);
    });

    it('keeps __proto__ as an ordinary own key', () => {
        const input = JSON.parse('{"__proto__": {"polluted": true}}');
        const result = copyPlainData(input, limits);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const value = result.value as any;
        expect(Object.keys(value)).toEqual(['__proto__']);
        expect(({} as any).polluted).toBeUndefined();
    });

    it('rejects functions, symbols, undefined and class instances', () => {
        expect(errorOf({ f: () => 1 })).toMatchObject({
            code: 'not-plain-data',
            path: 'f',
        });
        expect(errorOf({ [Symbol('s')]: 1 }).code).toBe('not-plain-data');
        expect(errorOf([undefined]).path).toBe('[0]');
        expect(errorOf({ d: new Date() })).toMatchObject({
            code: 'not-plain-data',
            path: 'd',
        });
    });

    it('rejects array subclasses', () => {
        class Tagged extends Array<number> {}
        const tagged = new Tagged();
        tagged.push(1);
        expect(errorOf({ list: tagged })).toMatchObject({
            code: 'not-plain-data',
            path: 'list',
        });
    });

    it('rejects accessors, holes and non-finite numbers', () => {
        const withGetter = Object.defineProperty({}, 'x', {
            get: () => 1,
            enumerable: true,
        });
        expect(errorOf(withGetter)).toMatchObject({
            code: 'not-plain-data',
            path: 'x',
        });
        expect(errorOf([1, , 3]).path).toBe('[1]');
        expect(errorOf({ n: Number.POSITIVE_INFINITY }).code).toBe(
            'not-plain-data'
        );
    });

    it('rejects cycles but allows shared references', () => {
        const cyclic: any = { a: {} };
        cyclic.a.back = cyclic;
        expect(errorOf(cyclic)).toMatchObject({
            code: 'not-plain-data',
            path: 'a.back',
        });
        const shared = { x: 1 };
        expect(copyPlainData({ a: shared, b: shared }, limits).ok).toBe(true);
    });

    it('stops at maxNodes, maxStringLength and the depth cap', () => {
        const small = { ...limits, maxNodes: 3 };
        expect(errorOf([1, 2, 3], small).code).toBe('limit-exceeded');
        expect(
            errorOf('x'.repeat(11), { ...limits, maxStringLength: 10 }).code
        ).toBe('limit-exceeded');
        let deep: unknown = 1;
        for (let i = 0; i <= MAX_COPY_DEPTH; i++) {
            deep = [deep];
        }
        expect(errorOf(deep).code).toBe('limit-exceeded');
    });
});

describe('migrate', () => {
    it('accepts the current formats', () => {
        expect(migrateDefinition({ format: 'being-machine@1' }).ok).toBe(true);
        expect(migrateSnapshot({ format: 'being-snapshot@1' }).ok).toBe(true);
    });

    it('rejects unknown or newer formats', () => {
        const result = migrateDefinition({ format: 'being-machine@2' });
        expect(result).toMatchObject({
            ok: false,
            errors: [{ code: 'unsupported-format', path: 'format' }],
        });
    });

    it('rejects a missing format or a non-object', () => {
        expect(migrateDefinition({})).toMatchObject({
            ok: false,
            errors: [{ code: 'invalid-structure', path: 'format' }],
        });
        expect(migrateDefinition([])).toMatchObject({
            ok: false,
            errors: [{ code: 'invalid-structure', path: '' }],
        });
    });
});
