import { LoadError, loadError } from '../errors';

/** Every author-chosen name must match this. */
export const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const RESERVED_NAMES = new Set(['__proto__', 'constructor', 'prototype']);
const RESERVED_STATE_NAMES = new Set(['INITIAL', 'TERMINAL']);

export type NameKind =
    | 'id'
    | 'machine'
    | 'state'
    | 'event'
    | 'field'
    | 'effect'
    | 'argument'
    | 'guard';

/** `null` when `value` is a usable name of this kind, else the error. */
export function checkName(
    value: unknown,
    path: string,
    kind: NameKind
): LoadError | null {
    if (typeof value !== 'string') {
        return loadError(
            'invalid-structure',
            path,
            `${kind} name must be a string`
        );
    }
    if (!NAME_PATTERN.test(value)) {
        return loadError(
            'invalid-name',
            path,
            `"${value}" is not a valid ${kind} name; names match ${NAME_PATTERN.source}`
        );
    }
    if (
        RESERVED_NAMES.has(value) ||
        (kind === 'state' && RESERVED_STATE_NAMES.has(value))
    ) {
        return loadError(
            'reserved-name',
            path,
            `"${value}" is reserved and cannot be a ${kind} name`
        );
    }
    return null;
}
