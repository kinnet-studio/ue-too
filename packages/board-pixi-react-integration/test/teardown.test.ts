import { teardownComponents } from '../src/hooks/pixi/teardown';

function fakeComponents(overrides: { cleanup?: () => void } = {}) {
    const calls: string[] = [];
    const base = () => calls.push('base');
    const components = {
        cleanups: [base],
        cleanup: overrides.cleanup ?? base,
        app: { destroy: () => calls.push('destroy') },
    };
    return { components, calls };
}

describe('teardownComponents', () => {
    it('runs every registered cleanup, then destroys the app', () => {
        const { components, calls } = fakeComponents();
        components.cleanups.push(() => calls.push('editor'));

        teardownComponents(components);

        expect(calls).toEqual(['base', 'editor', 'destroy']);
    });

    it('does not run the base teardown twice when `cleanup` is the same function registered in `cleanups`', () => {
        const { components, calls } = fakeComponents();

        teardownComponents(components);

        expect(calls.filter(c => c === 'base')).toHaveLength(1);
    });

    it('still runs a `cleanup` that an app replaced via spread (legacy extension), after the registered cleanups', () => {
        const { components, calls } = fakeComponents({ cleanup: () => calls.push('override') });

        teardownComponents(components);

        expect(calls).toEqual(['base', 'override', 'destroy']);
    });

    it('destroys the app with removeView so the canvas is discarded, and its children', () => {
        const destroyArgs: unknown[][] = [];
        const components = {
            cleanups: [],
            cleanup: () => {},
            app: { destroy: (...args: unknown[]) => { destroyArgs.push(args); } },
        };

        teardownComponents(components);

        expect(destroyArgs).toEqual([[{ removeView: true }, { children: true }]]);
    });
});
