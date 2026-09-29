import { PortableContext } from '../api-types';
import { Value } from '../format/types';
import { ContextStore } from '../interpret/store';

/** The `context` of a portable machine: a read-only view over its store. */
export class PortableContextImpl implements PortableContext {
    private pendingWith: ReadonlyMap<string, Value> | null = null;

    constructor(readonly store: ContextStore) {}

    get(field: string): Value {
        if (!this.store.has(field)) {
            throw new Error(`unknown context field "${field}"`);
        }
        return this.store.get(field);
    }

    fields(): Readonly<Record<string, Value>> {
        return Object.freeze(this.store.toRecord());
    }

    /** Called by `start()`: back to initial values, then any pending `with`. */
    setup(): void {
        this.store.resetToInitial();
        const pending = this.pendingWith;
        this.pendingWith = null;
        if (pending !== null) {
            for (const [field, value] of pending) {
                this.store.set(field, value);
            }
        }
    }

    cleanup(): void {}

    /** Values a parent's `with` writes over the initial values on the next setup. */
    prepareWith(values: ReadonlyMap<string, Value> | null): void {
        this.pendingWith = values;
    }
}
