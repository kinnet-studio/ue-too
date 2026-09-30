import { describe, expect, it } from 'vitest';

import {
    checkValue,
    describeType,
    listType,
    parseTypeSpec,
    sameType,
    scalarType,
} from '../src/format/values';
import { DEFAULT_LIMITS, resolveLimits } from '../src/limits';

describe('parseTypeSpec', () => {
    it('reads bare scalars and the object forms', () => {
        expect(parseTypeSpec('number')).toEqual(scalarType('number'));
        expect(parseTypeSpec({ type: 'string' })).toEqual(scalarType('string'));
        expect(parseTypeSpec({ type: 'list', of: 'boolean' })).toEqual(
            listType('boolean')
        );
    });

    it('rejects anything else', () => {
        expect(parseTypeSpec('object')).toBeNull();
        expect(parseTypeSpec({ type: 'list' })).toBeNull();
        expect(parseTypeSpec({ type: 'number', of: 'number' })).toBeNull();
        expect(parseTypeSpec({ type: 'list', of: 'list' })).toBeNull();
        expect(parseTypeSpec(['number'])).toBeNull();
        expect(parseTypeSpec(null)).toBeNull();
    });
});

describe('sameType and describeType', () => {
    it('compares kinds and element types', () => {
        expect(sameType(scalarType('number'), scalarType('number'))).toBe(true);
        expect(sameType(scalarType('number'), listType('number'))).toBe(false);
        expect(sameType(listType('string'), listType('number'))).toBe(false);
        expect(describeType(listType('string'))).toBe('list of string');
    });
});

describe('checkValue', () => {
    const limits = { maxListLength: 3, maxStringLength: 5 };

    it('accepts values of the type', () => {
        expect(checkValue(1.5, scalarType('number'), limits)).toBe('ok');
        expect(checkValue([true], listType('boolean'), limits)).toBe('ok');
    });

    it('reports type mismatches, including non-finite numbers', () => {
        expect(checkValue('1', scalarType('number'), limits)).toBe('type');
        expect(checkValue(Number.NaN, scalarType('number'), limits)).toBe(
            'type'
        );
        expect(checkValue([1, 'x'], listType('number'), limits)).toBe('type');
    });

    it('reports strings and lists past the limits', () => {
        expect(checkValue('toolong', scalarType('string'), limits)).toBe(
            'limit'
        );
        expect(checkValue([1, 2, 3, 4], listType('number'), limits)).toBe(
            'limit'
        );
        expect(checkValue(['toolong'], listType('string'), limits)).toBe(
            'limit'
        );
    });
});

describe('resolveLimits', () => {
    it('applies overrides over the defaults', () => {
        const limits = resolveLimits({ maxStates: 4 });
        expect(limits.maxStates).toBe(4);
        expect(limits.maxNodes).toBe(DEFAULT_LIMITS.maxNodes);
        expect(Object.isFrozen(limits)).toBe(true);
    });

    it('throws on a non-positive or fractional limit', () => {
        expect(() => resolveLimits({ maxStates: 0 })).toThrow('maxStates');
        expect(() => resolveLimits({ maxNodes: 1.5 })).toThrow('maxNodes');
    });
});
