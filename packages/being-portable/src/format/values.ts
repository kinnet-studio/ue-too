import { Limits } from '../limits';
import { Scalar, Value } from './types';

/** The canonical form of a {@link TypeSpec}. */
export type ValueType =
    | { readonly kind: 'scalar'; readonly scalar: Scalar }
    | { readonly kind: 'list'; readonly of: Scalar };

export function scalarType(scalar: Scalar): ValueType {
    return { kind: 'scalar', scalar };
}

export function listType(of: Scalar): ValueType {
    return { kind: 'list', of };
}

export const NUMBER = scalarType('number');
export const STRING = scalarType('string');
export const BOOLEAN = scalarType('boolean');

export function isScalarName(value: unknown): value is Scalar {
    return value === 'number' || value === 'string' || value === 'boolean';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses a TypeSpec; `null` when it is not one. */
export function parseTypeSpec(spec: unknown): ValueType | null {
    if (isScalarName(spec)) {
        return scalarType(spec);
    }
    if (!isRecord(spec)) {
        return null;
    }
    const keys = Object.keys(spec).sort().join(',');
    if (keys === 'type' && isScalarName(spec.type)) {
        return scalarType(spec.type);
    }
    if (keys === 'of,type' && spec.type === 'list' && isScalarName(spec.of)) {
        return listType(spec.of);
    }
    return null;
}

export function sameType(a: ValueType, b: ValueType): boolean {
    if (a.kind === 'scalar' && b.kind === 'scalar') {
        return a.scalar === b.scalar;
    }
    if (a.kind === 'list' && b.kind === 'list') {
        return a.of === b.of;
    }
    return false;
}

export function describeType(type: ValueType): string {
    return type.kind === 'scalar' ? type.scalar : `list of ${type.of}`;
}

export type ValueCheck = 'ok' | 'type' | 'limit';

type ValueLimits = Pick<Limits, 'maxListLength' | 'maxStringLength'>;

function checkScalar(
    value: unknown,
    scalar: Scalar,
    limits: ValueLimits
): ValueCheck {
    if (scalar === 'number') {
        return typeof value === 'number' && Number.isFinite(value)
            ? 'ok'
            : 'type';
    }
    if (scalar === 'boolean') {
        return typeof value === 'boolean' ? 'ok' : 'type';
    }
    if (typeof value !== 'string') {
        return 'type';
    }
    return value.length > limits.maxStringLength ? 'limit' : 'ok';
}

/** Whether `value` has `type` and fits the list and string limits. */
export function checkValue(
    value: unknown,
    type: ValueType,
    limits: ValueLimits
): ValueCheck {
    if (type.kind === 'scalar') {
        return checkScalar(value, type.scalar, limits);
    }
    if (!Array.isArray(value)) {
        return 'type';
    }
    if (value.length > limits.maxListLength) {
        return 'limit';
    }
    for (const item of value) {
        const check = checkScalar(item, type.of, limits);
        if (check !== 'ok') {
            return check;
        }
    }
    return 'ok';
}

/** Scalars as they are; lists copied and frozen. */
export function freezeValue(value: Value): Value {
    return typeof value === 'object' ? Object.freeze([...value]) : value;
}

/**
 * Takes a value from host code (a payload field, an effect result) once, so
 * that checking the result checks exactly what is stored. A list is copied
 * by index into a fresh frozen array, never through its iterator or
 * `Symbol.species`, and at most `maxListLength + 1` items are copied: enough
 * for the check to see an over-long list. Anything else is returned as is.
 */
export function copyHostValue(
    value: unknown,
    limits: Pick<Limits, 'maxListLength'>
): unknown {
    if (!Array.isArray(value)) {
        return value;
    }
    const length = Math.min(value.length, limits.maxListLength + 1);
    const copy: unknown[] = [];
    for (let index = 0; index < length; index++) {
        copy.push(value[index]);
    }
    return Object.freeze(copy);
}
