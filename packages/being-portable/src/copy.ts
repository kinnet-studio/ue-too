import { LoadError, loadError } from './errors';
import { Limits } from './limits';
import { joinPath } from './util';

/** JSON-shaped data: the only thing the package reads from callers. */
export type PlainData =
    | null
    | boolean
    | number
    | string
    | readonly PlainData[]
    | PlainObject;

export type PlainObject = { readonly [key: string]: PlainData };

/** Nesting cap for the copy walk, so recursion never exhausts the call stack. */
export const MAX_COPY_DEPTH = 256;

export type CopyResult =
    | { readonly ok: true; readonly value: PlainData }
    | { readonly ok: false; readonly errors: LoadError[] };

export function isPlainObject(
    value: PlainData | undefined
): value is PlainObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class Stop {
    constructor(readonly error: LoadError) {}
}

/**
 * Copies `input` into fresh, frozen, null-prototype plain data.
 *
 * Rejects functions, symbols, class instances, accessors, holes, cycles and
 * non-finite numbers, and stops at `maxNodes`, `maxStringLength` or
 * {@link MAX_COPY_DEPTH}.
 */
export function copyPlainData(
    input: unknown,
    limits: Pick<Limits, 'maxNodes' | 'maxStringLength'>
): CopyResult {
    let nodes = 0;
    const ancestors = new Set<object>();

    const stop = (
        code: 'not-plain-data' | 'limit-exceeded',
        path: string,
        message: string
    ): never => {
        throw new Stop(loadError(code, path, message));
    };

    const visit = (value: unknown, path: string, depth: number): PlainData => {
        nodes += 1;
        if (nodes > limits.maxNodes) {
            stop('limit-exceeded', path, `more than ${limits.maxNodes} values`);
        }
        if (depth > MAX_COPY_DEPTH) {
            stop(
                'limit-exceeded',
                path,
                `nested deeper than ${MAX_COPY_DEPTH} levels`
            );
        }
        if (value === null || typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) {
                stop('not-plain-data', path, 'numbers must be finite');
            }
            return value;
        }
        if (typeof value === 'string') {
            if (value.length > limits.maxStringLength) {
                stop(
                    'limit-exceeded',
                    path,
                    `string longer than ${limits.maxStringLength} characters`
                );
            }
            return value;
        }
        if (typeof value !== 'object') {
            return stop(
                'not-plain-data',
                path,
                `${typeof value} is not JSON data`
            );
        }
        if (ancestors.has(value)) {
            stop('not-plain-data', path, 'the data contains a cycle');
        }
        ancestors.add(value);
        try {
            if (Array.isArray(value)) {
                if (Object.getPrototypeOf(value) !== Array.prototype) {
                    stop('not-plain-data', path, 'only plain arrays are data');
                }
                const out: PlainData[] = [];
                for (let index = 0; index < value.length; index++) {
                    const itemPath = joinPath(path, index);
                    const descriptor = Object.getOwnPropertyDescriptor(
                        value,
                        index
                    );
                    if (descriptor === undefined || !('value' in descriptor)) {
                        stop(
                            'not-plain-data',
                            itemPath,
                            'arrays may not have holes or accessors'
                        );
                    }
                    out.push(visit(descriptor!.value, itemPath, depth + 1));
                }
                return Object.freeze(out);
            }
            const prototype = Object.getPrototypeOf(value);
            if (prototype !== Object.prototype && prototype !== null) {
                stop('not-plain-data', path, 'only plain objects are data');
            }
            if (Object.getOwnPropertySymbols(value).length > 0) {
                stop('not-plain-data', path, 'symbol keys are not data');
            }
            const out: Record<string, PlainData> = Object.create(null);
            for (const key of Object.keys(value)) {
                const keyPath = joinPath(path, key);
                if (key.length > limits.maxStringLength) {
                    stop(
                        'limit-exceeded',
                        path,
                        `key longer than ${limits.maxStringLength} characters`
                    );
                }
                const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
                if (!('value' in descriptor)) {
                    stop('not-plain-data', keyPath, 'accessors are not data');
                }
                out[key] = visit(descriptor.value, keyPath, depth + 1);
            }
            return Object.freeze(out);
        } finally {
            ancestors.delete(value);
        }
    };

    try {
        return { ok: true, value: visit(input, '', 0) };
    } catch (error) {
        if (error instanceof Stop) {
            return { ok: false, errors: [error.error] };
        }
        throw error;
    }
}
