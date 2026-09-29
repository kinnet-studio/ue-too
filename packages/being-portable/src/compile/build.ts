import { MachineDefinition } from '../format/types';
import { Host, Services } from '../host';
import { ContextStore } from '../interpret/store';
import { Transaction } from '../interpret/tx';
import { entriesOf, joinPath } from '../util';
import { PortableContextImpl } from './context';
import { PortableDelegatingState } from './delegating';
import { PortableStateInstance, PortableStateMachine } from './machine';
import { MachineRuntime } from './runtime';
import { PortableState } from './state';

/**
 * Builds the machine tree for a validated definition. The root and every
 * child share one transaction. Each state with a `child` gets its own
 * instance of that child machine.
 */
export function buildMachineTree(
    definition: MachineDefinition,
    host: Host
): PortableStateMachine {
    const transaction = new Transaction(host.onError, host.limits.maxEventWork);
    const services: Services = Object.freeze({
        random: () => transaction.hostCode(() => host.services.random()),
        now: () => transaction.hostCode(() => host.services.now()),
    });

    const build = (key: string | null): PortableStateMachine => {
        const body = key === null ? definition : definition.machines![key];
        const path = key === null ? '' : joinPath('machines', key);
        const store = new ContextStore(body.context, transaction);
        const runtime: MachineRuntime = {
            definition,
            body,
            path,
            isRoot: key === null,
            transaction,
            host,
            services,
            store,
            context: new PortableContextImpl(store),
            children: new Map(),
            finalStates: new Set(
                entriesOf(body.states)
                    .filter(([, state]) => state.final === true)
                    .map(([name]) => name)
            ),
        };
        const states: Record<string, PortableStateInstance> =
            Object.create(null);
        for (const [name, state] of entriesOf(body.states)) {
            const statePath = joinPath(joinPath(path, 'states'), name);
            if (state.child !== undefined) {
                const child = build(state.child.machine);
                runtime.children.set(name, child);
                states[name] = new PortableDelegatingState(
                    child,
                    runtime,
                    state,
                    statePath
                );
            } else {
                states[name] = new PortableState(runtime, state, statePath);
            }
        }
        return new PortableStateMachine(states, body.initialState, runtime);
    };

    return build(null);
}
