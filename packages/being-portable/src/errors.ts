/**
 * Why a definition or snapshot was rejected.
 *
 * @category Types
 */
export type LoadErrorCode =
    | 'not-plain-data'
    | 'limit-exceeded'
    | 'unsupported-format'
    | 'invalid-structure'
    | 'invalid-name'
    | 'reserved-name'
    | 'unknown-state'
    | 'unknown-event'
    | 'unknown-field'
    | 'unknown-effect'
    | 'unknown-guard'
    | 'unknown-machine'
    | 'unknown-operator'
    | 'machine-cycle'
    | 'type-mismatch'
    | 'arity-mismatch'
    | 'misplaced'
    | 'empty-list-needs-type'
    | 'output-not-declared'
    | 'into-without-returns'
    | 'child-event-mismatch'
    | 'on-done-without-child'
    | 'on-done-unreachable'
    | 'final-initial-state'
    | 'final-state-has-reactions'
    | 'missing-effect'
    | 'effect-signature-mismatch'
    | 'machine-mismatch'
    | 'revision-mismatch'
    | 'state-missing'
    | 'field-mismatch'
    | 'child-missing'
    | 'child-unexpected'
    | 'reentrant-call';

/**
 * One problem found while loading a definition or restoring a snapshot.
 *
 * @category Types
 */
export type LoadError = {
    readonly code: LoadErrorCode;
    readonly message: string;
    /** JSON path into the document, e.g. `states.READY.on.select.do[1]`. */
    readonly path: string;
};

/**
 * Why an event, start, reset or wrapup failed.
 *
 * @category Types
 */
export type RuntimeErrorCode =
    | 'payload-mismatch'
    | 'index-out-of-range'
    | 'not-an-integer'
    | 'invalid-range'
    | 'non-finite-number'
    | 'limit-exceeded'
    | 'effect-failed'
    | 'effect-return-mismatch'
    | 'service-invalid'
    | 'reentrant-call';

/**
 * A failure reported to the host's `onError`. The machine tree has already
 * been rolled back when this is reported.
 *
 * @category Types
 */
export type RuntimeError = {
    readonly code: RuntimeErrorCode;
    readonly message: string;
    /** JSON path of the statement or guard that failed. */
    readonly path: string;
    /** The event being handled, or `null` for start, reset and wrapup. */
    readonly event: string | null;
    /** Effects that ran before the failure. They are not undone. */
    readonly effectsCalled: readonly string[];
};

export function loadError(
    code: LoadErrorCode,
    path: string,
    message: string
): LoadError {
    return { code, path, message };
}

/** Thrown inside the interpreter; the transaction turns it into a {@link RuntimeError}. */
export class PortableRuntimeFailure extends Error {
    readonly code: RuntimeErrorCode;
    readonly path: string;

    constructor(code: RuntimeErrorCode, message: string, path: string) {
        super(message);
        this.name = 'PortableRuntimeFailure';
        this.code = code;
        this.path = path;
    }
}

/** Throws a {@link PortableRuntimeFailure} at `path`. */
export function raise(
    path: string,
    code: RuntimeErrorCode,
    message: string
): never {
    throw new PortableRuntimeFailure(code, message, path);
}
