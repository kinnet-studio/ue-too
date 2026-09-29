import { ContextFieldDefinition, Value } from '../format/types';
import { entriesOf } from '../util';

/** The part of a transaction a store needs. */
export interface StoreTransaction {
    readonly isActive: boolean;
    markDirty(store: ContextStore): void;
}

/**
 * One machine's context. Values are immutable (lists are frozen), so saving a
 * field's previous value on its first write in a transaction is enough to
 * roll it back.
 */
export class ContextStore {
    private readonly values = new Map<string, Value>();
    private readonly initial: ReadonlyMap<string, Value>;
    private saved: Map<string, Value> | null = null;

    constructor(
        fields: Readonly<Record<string, ContextFieldDefinition>>,
        private readonly transaction: StoreTransaction
    ) {
        const initial = new Map<string, Value>();
        for (const [name, field] of entriesOf(fields)) {
            initial.set(name, field.initial);
        }
        this.initial = initial;
        for (const [name, value] of initial) {
            this.values.set(name, value);
        }
    }

    has(field: string): boolean {
        return this.values.has(field);
    }

    get(field: string): Value {
        return this.values.get(field) as Value;
    }

    initialValue(field: string): Value {
        return this.initial.get(field) as Value;
    }

    fieldNames(): string[] {
        return [...this.values.keys()];
    }

    set(field: string, value: Value): void {
        if (this.transaction.isActive) {
            if (this.saved === null) {
                this.saved = new Map();
                this.transaction.markDirty(this);
            }
            if (!this.saved.has(field)) {
                this.saved.set(field, this.values.get(field) as Value);
            }
        }
        this.values.set(field, value);
    }

    resetToInitial(): void {
        for (const [name, value] of this.initial) {
            this.set(name, value);
        }
    }

    commitTransaction(): void {
        this.saved = null;
    }

    rollbackTransaction(): void {
        if (this.saved !== null) {
            for (const [name, value] of this.saved) {
                this.values.set(name, value);
            }
        }
        this.saved = null;
    }

    /** Replaces every value outside any transaction (restore). */
    replaceAll(values: ReadonlyMap<string, Value>): void {
        for (const [name, value] of values) {
            this.values.set(name, value);
        }
    }

    toRecord(): Record<string, Value> {
        const record: Record<string, Value> = {};
        for (const [name, value] of this.values) {
            record[name] = value;
        }
        return record;
    }
}
