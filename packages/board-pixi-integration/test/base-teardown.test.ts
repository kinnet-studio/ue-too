import { attachBaseTeardown } from '../src/base-teardown';

function fakeParser() {
    return { tornDown: 0, tearDown() { this.tornDown += 1; } };
}

function fakeComponents() {
    return {
        kmtParser: fakeParser(),
        touchParser: fakeParser(),
        canvasProxy: fakeParser(),
        cleanups: [] as (() => void)[],
    };
}

describe('attachBaseTeardown', () => {
    it('tears down the parsers assigned onto the RETURNED object at teardown time, not the originals', () => {
        const parts = fakeComponents();
        const originalKmt = parts.kmtParser;
        const originalTouch = parts.touchParser;

        const components = attachBaseTeardown(parts);

        // An app swaps in extended parsers on the object it was handed
        // (tearing the originals down itself, as the swap protocol requires).
        const swappedKmt = fakeParser();
        const swappedTouch = fakeParser();
        originalKmt.tearDown();
        originalTouch.tearDown();
        components.kmtParser = swappedKmt;
        components.touchParser = swappedTouch;

        components.cleanup();

        expect(swappedKmt.tornDown).toBe(1);
        expect(swappedTouch.tornDown).toBe(1);
        expect(components.canvasProxy.tornDown).toBe(1);
        // Originals were torn down by the swap only — not again by us.
        expect(originalKmt.tornDown).toBe(1);
        expect(originalTouch.tornDown).toBe(1);
    });

    it('registers the base teardown as the first entry of `cleanups`', () => {
        const components = attachBaseTeardown(fakeComponents());

        expect(components.cleanups).toEqual([components.cleanup]);
    });
});
