/**
 * Caps that keep a document from a stranger from exhausting memory.
 *
 * @category Types
 */
export type Limits = {
    /** Total JSON values in a document or snapshot. */
    readonly maxNodes: number;
    /** Machines in `machines` plus the root. */
    readonly maxMachines: number;
    /** States per machine. */
    readonly maxStates: number;
    /** Statements per list. */
    readonly maxStatements: number;
    /** Nested `if` depth. */
    readonly maxStatementDepth: number;
    /** Expression nesting depth. */
    readonly maxExpressionDepth: number;
    /** Child-machine nesting depth. */
    readonly maxNestingDepth: number;
    /** Machine instances the tree builds. */
    readonly maxMachineInstances: number;
    /** Items in any list value. */
    readonly maxListLength: number;
    /** Characters in any string value. */
    readonly maxStringLength: number;
};

/**
 * The limits used when a host does not override them.
 *
 * @category Core
 */
export const DEFAULT_LIMITS: Limits = Object.freeze({
    maxNodes: 50_000,
    maxMachines: 64,
    maxStates: 256,
    maxStatements: 256,
    maxStatementDepth: 16,
    maxExpressionDepth: 32,
    maxNestingDepth: 8,
    maxMachineInstances: 256,
    maxListLength: 10_000,
    maxStringLength: 10_000,
});

/** Defaults with overrides applied. Throws on a non-positive or non-integer override. */
export function resolveLimits(overrides: Partial<Limits> = {}): Limits {
    const merged: Limits = { ...DEFAULT_LIMITS, ...overrides };
    for (const [name, value] of Object.entries(merged)) {
        if (!Number.isInteger(value) || value < 1) {
            throw new Error(`limit ${name} must be a positive integer`);
        }
    }
    return Object.freeze(merged);
}
