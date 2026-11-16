// A recording stand-in for CanvasRenderingContext2D and Path2D, so the
// painter can be tested without a browser.

export interface Call {
    name: string;
    args: unknown[];
}

export interface FakeContext {
    readonly calls: Call[];
    /** Every value assigned to a property, in order */
    sets(name: string): unknown[];
    /** Every call to a method, in order */
    called(name: string): Call[];
}

export function fakeContext(): CanvasRenderingContext2D & FakeContext {
    const calls: Call[] = [];
    const assigned: { name: string; value: unknown }[] = [];
    const props: Record<string, unknown> = { globalAlpha: 1 };
    const stack: Record<string, unknown>[] = [];
    const api: Record<string, unknown> = {
        calls,
        sets: (name: string) =>
            assigned.filter(a => a.name === name).map(a => a.value),
        called: (name: string) => calls.filter(c => c.name === name),
        measureText: (value: string) => ({ width: value.length * 10 }),
        save: () => {
            calls.push({ name: 'save', args: [] });
            stack.push({ ...props });
        },
        restore: () => {
            calls.push({ name: 'restore', args: [] });
            Object.assign(props, stack.pop());
        },
    };
    return new Proxy({} as CanvasRenderingContext2D & FakeContext, {
        get(_, key: string) {
            if (key in api) return api[key];
            if (key in props) return props[key];
            return (...args: unknown[]) => calls.push({ name: key, args });
        },
        set(_, key: string, value: unknown) {
            props[key] = value;
            assigned.push({ name: key, value });
            return true;
        },
    });
}

export interface FakePath {
    ops: unknown[][];
}

export function fakePath(): Path2D {
    const ops: unknown[][] = [];
    return new Proxy({ ops } as unknown as Path2D, {
        get(target, key: string) {
            if (key === 'ops') return ops;
            return (...args: unknown[]) => ops.push([key, ...args]);
        },
    });
}
