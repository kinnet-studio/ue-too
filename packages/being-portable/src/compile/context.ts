import { PortableContext } from '../api-types';
import { Value } from '../format/types';
import { ContextStore } from '../interpret/store';

/** The `context` of a portable machine: a read-only view over its store. */
export class PortableContextImpl implements PortableContext {
    private pendingWith: ReadonlyMap<string, Value> | null = null;
    private setupAllowed = false;

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

    /**
     * Runs the machine's own `start()` with one `setup()` call allowed. Any
     * other `setup()` call, from the host or from an effect while the start
     * runs, throws.
     */
    allowSetup<T>(body: () => T): T {
        this.setupAllowed = true;
        try {
            return body();
        } finally {
            this.setupAllowed = false;
        }
    }

    /** Called by `start()`: back to initial values, then any pending `with`. */
    setup(): void {
        if (!this.setupAllowed) {
            throw new Error(
                'setup() is run by the machine itself; the host cannot reset its context'
            );
        }
        this.setupAllowed = false;
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
