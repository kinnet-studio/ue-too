import { RuntimeError } from '../src/errors';
import { Value } from '../src/format/types';
import { Host, HostDefinition, defineHost } from '../src/host';

export type Recorder = {
    readonly host: Host;
    readonly calls: { name: string; args: Record<string, Value> }[];
    readonly errors: RuntimeError[];
};

/**
 * A host whose effects record their calls. `overrides` replaces parts of the
 * host definition; `run` overrides replace individual effect bodies.
 */
export function recordingHost(
    overrides: HostDefinition = {},
    run: Record<string, (args: Record<string, Value>) => Value | void> = {}
): Recorder {
    const calls: Recorder['calls'] = [];
    const errors: RuntimeError[] = [];
    const record =
        (name: string) =>
        (args: Readonly<Record<string, Value>>): Value | void => {
            calls.push({ name, args: { ...args } });
            return run[name]?.({ ...args });
        };
    const host = defineHost({
        effects: {
            dispense: { args: { item: 'string' }, run: record('dispense') },
            refund: { args: { amount: 'number' }, run: record('refund') },
            note: { args: { text: 'string' }, run: record('note') },
        },
        onError: error => errors.push(error),
        ...overrides,
    });
    return { host, calls, errors };
}
