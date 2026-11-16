import { describe, expect, it } from 'vitest';

import {
    compareShapes,
    indexBetween,
} from '../../src/whiteboard/document/fractional-index';

describe('indexBetween', () => {
    it('keys sort between their neighbours', () => {
        const pairs: [string | null, string | null][] = [
            [null, null],
            ['V', null],
            [null, 'V'],
            ['V', 'W'],
            ['V', 'V1'],
            ['az', 'b'],
            ['z', null],
            ['zz', null],
            ['1', '2'],
            [null, '1'],
        ];
        for (const [a, b] of pairs) {
            const key = indexBetween(a, b);
            if (a !== null) expect(key > a).toBe(true);
            if (b !== null) expect(key < b).toBe(true);
            expect(key.endsWith('0')).toBe(false);
            expect(key.length).toBeGreaterThan(0);
        }
    });

    it('1000 appends stay short', () => {
        let key: string | null = null;
        for (let i = 0; i < 1000; i++) {
            const next = indexBetween(key, null);
            if (key !== null) expect(next > key).toBe(true);
            key = next;
        }
        expect(key!.length).toBeLessThanOrEqual(30);
    });

    it('50 inserts at one spot stay short', () => {
        const low = indexBetween(null, null);
        let high = indexBetween(low, null);
        for (let i = 0; i < 50; i++) {
            const next = indexBetween(low, high);
            expect(next > low && next < high).toBe(true);
            high = next;
        }
        expect(high.length).toBeLessThanOrEqual(12);
    });

    it('many inserts before the first key stay ordered', () => {
        let key = indexBetween(null, null);
        for (let i = 0; i < 100; i++) {
            const next = indexBetween(null, key);
            expect(next < key).toBe(true);
            key = next;
        }
    });
});

describe('compareShapes', () => {
    it('orders by index first', () => {
        expect(
            compareShapes({ index: 'a', id: 'z' }, { index: 'b', id: 'a' })
        ).toBeLessThan(0);
    });

    it('ties break by id', () => {
        expect(
            compareShapes({ index: 'V', id: 'b' }, { index: 'V', id: 'a' })
        ).toBeGreaterThan(0);
        expect(
            compareShapes({ index: 'V', id: 'a' }, { index: 'V', id: 'a' })
        ).toBe(0);
    });
});
