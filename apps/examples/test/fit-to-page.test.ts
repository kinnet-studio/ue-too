import { describe, expect, it } from 'bun:test';

import { fitSize } from '../src/fit-to-page';

describe('fitSize', () => {
    it('keeps the design size when there is room', () => {
        expect(fitSize(800, 600, { width: 1200, height: 900 })).toEqual({
            width: 800,
            height: 600,
        });
    });

    it('shrinks to a narrow room, keeping the aspect ratio', () => {
        expect(fitSize(800, 600, { width: 358, height: 900 })).toEqual({
            width: 358,
            height: 268,
        });
        expect(fitSize(600, 500, { width: 358, height: 900 })).toEqual({
            width: 358,
            height: 298,
        });
    });

    it('shrinks to a short room, keeping the aspect ratio', () => {
        expect(fitSize(800, 600, { width: 1334, height: 460 })).toEqual({
            width: 613,
            height: 459,
        });
    });

    it('takes the tighter of the two limits', () => {
        const size = fitSize(800, 600, { width: 400, height: 250 });
        expect(size.width).toBeLessThanOrEqual(400);
        expect(size.height).toBeLessThanOrEqual(250);
        expect(size).toEqual({ width: 333, height: 249 });
    });
});
