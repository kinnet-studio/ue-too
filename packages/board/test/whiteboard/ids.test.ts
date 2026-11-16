import { describe, expect, it } from 'vitest';

import { createId, createSeed } from '../../src/whiteboard/document/ids';

describe('createId', () => {
    it('ids are 16 base-62 characters and differ', () => {
        const ids = new Set(Array.from({ length: 1000 }, () => createId()));
        expect(ids.size).toBe(1000);
        for (const id of ids) expect(id).toMatch(/^[0-9A-Za-z]{16}$/);
    });

    it('rejects bytes that would bias the alphabet instead of wrapping them', () => {
        // Wrapping 255 into the alphabet would make some characters likelier
        // than others; such bytes are drawn again
        const alternating = (bytes: Uint8Array) =>
            bytes.map((_, i) => (i % 2 === 0 ? 255 : 247));
        expect(createId(alternating)).toBe('z'.repeat(16));
    });

    it('uses the random source it is given', () => {
        const zeros = (bytes: Uint8Array) => bytes.fill(0);
        expect(createId(zeros)).toBe('0000000000000000');
    });
});

describe('createSeed', () => {
    it('is a non-negative 31-bit integer', () => {
        for (let i = 0; i < 100; i++) {
            const seed = createSeed();
            expect(Number.isInteger(seed)).toBe(true);
            expect(seed).toBeGreaterThanOrEqual(0);
            expect(seed).toBeLessThan(2 ** 31);
        }
    });
});
