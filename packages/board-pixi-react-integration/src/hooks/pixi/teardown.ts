/** The slice of `BaseAppComponents` the teardown needs. Structural so it can
 *  be unit-tested without a Pixi renderer. */
export interface TeardownTarget {
    cleanup: () => void;
    cleanups: (() => void)[];
    app: { destroy(rendererOptions: { removeView: boolean }, options: { children: boolean }): void };
}

/** Tears down an initialized app: every registered cleanup, then the Pixi
 *  application.
 *
 *  `cleanups` is the extension point — `baseInitApp` registers its own
 *  teardown there and apps push theirs after it. `cleanup` is kept for
 *  callers that still replace it via spread (`{ ...base, cleanup: … }`); it
 *  runs after the registered cleanups, but only when it is NOT already one
 *  of them, so the base teardown never runs twice and a replaced `cleanup`
 *  can no longer silently drop the base teardown. */
export function teardownComponents(components: TeardownTarget): void {
    for (const cleanup of components.cleanups) cleanup();
    if (!components.cleanups.includes(components.cleanup)) components.cleanup();
    // `removeView` detaches the <canvas>, so the element (and its now-lost
    // GL context) is discarded rather than reused.
    components.app.destroy({ removeView: true }, { children: true });
}
