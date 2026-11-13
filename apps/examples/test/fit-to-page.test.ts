import { describe, expect, it } from 'bun:test';

import { fitSize } from '../src/fit-to-page';

describe('fitSize', () => {
    it('keeps the design size when the page has room', () => {
        expect(fitSize(800, 600, 1200)).toEqual({ width: 800, height: 600 });
    });

    it('shrinks to the room left by a 16px gutter on each side', () => {
        expect(fitSize(800, 600, 390).width).toBe(390 - 32);
    });

    it('keeps the design aspect ratio when it shrinks', () => {
        expect(fitSize(800, 600, 390)).toEqual({ width: 358, height: 268 });
        expect(fitSize(600, 500, 390)).toEqual({ width: 358, height: 298 });
    });
});
