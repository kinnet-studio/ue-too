/** The slice of the app components the base teardown touches. Structural so
 *  the teardown can be unit-tested without a Pixi renderer. */
export interface BaseTeardownTarget {
    kmtParser: { tearDown(): void };
    touchParser: { tearDown(): void };
    canvasProxy: { tearDown(): void };
    cleanups: (() => void)[];
}

/** Attaches the base teardown to a components object and returns THAT SAME
 *  object with `cleanup` set.
 *
 *  The teardown reads `kmtParser` / `touchParser` off the object AT TEARDOWN
 *  TIME, not at creation: apps routinely assign extended parsers onto the
 *  returned components after `baseInitApp` resolves (tearing the originals
 *  down as part of the swap), and those swapped-in parsers own window-level
 *  keydown/keyup listeners. A teardown that closed over the original parser
 *  variables — or read from a different object than the one the app mutates
 *  — would leave the live parsers registered and retain the whole app graph
 *  across remounts. That is why this mutates and returns the same object
 *  rather than spreading into a new one.
 *
 *  The teardown is also registered in `cleanups`, so the React integration
 *  runs it even when an app replaces `cleanup` by spreading these components
 *  into its own object. */
export function attachBaseTeardown<T extends BaseTeardownTarget>(components: T): T & { cleanup: () => void } {
    const cleanup = () => {
        components.kmtParser.tearDown();
        components.touchParser.tearDown();
        components.canvasProxy.tearDown();
    };
    components.cleanups.push(cleanup);
    return Object.assign(components, { cleanup });
}
