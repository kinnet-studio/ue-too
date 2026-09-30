const hasOwnProperty = Object.prototype.hasOwnProperty;

/** Own-property check that works on null-prototype objects. */
export function hasOwn(object: object, key: string): boolean {
    return hasOwnProperty.call(object, key);
}

/** `[key, value]` pairs of a record, or none when the record is absent. */
export function entriesOf<T>(
    record: Readonly<Record<string, T>> | undefined
): [string, T][] {
    if (record === undefined) {
        return [];
    }
    return Object.keys(record).map(key => [key, record[key]]);
}

/** Appends a key or index to a JSON path: `a.b`, `a[0]`. */
export function joinPath(base: string, key: string | number): string {
    if (typeof key === 'number') {
        return `${base}[${key}]`;
    }
    return base === '' ? key : `${base}.${key}`;
}

/** A readable message from anything thrown. */
export function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
