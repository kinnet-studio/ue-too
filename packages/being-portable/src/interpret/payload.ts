import { TypeSpec, Value } from '../format/types';
import {
    checkValue,
    describeType,
    freezeValue,
    parseTypeSpec,
} from '../format/values';
import { Limits } from '../limits';
import { hasOwn } from '../util';
import { PayloadRecord } from './expr';

export type PayloadCheck =
    | { readonly ok: true; readonly value: PayloadRecord }
    | { readonly ok: false; readonly message: string };

const EMPTY_PAYLOAD: PayloadRecord = Object.freeze(Object.create(null));

/**
 * Checks a host-supplied payload against an event's declared fields and
 * copies it into a frozen, null-prototype record.
 */
export function validatePayload(
    fields: Readonly<Record<string, TypeSpec>>,
    payload: unknown,
    limits: Pick<Limits, 'maxListLength' | 'maxStringLength'>
): PayloadCheck {
    const declared = Object.keys(fields);
    if (payload === undefined || payload === null) {
        return declared.length === 0
            ? { ok: true, value: EMPTY_PAYLOAD }
            : {
                  ok: false,
                  message: `missing payload; expected ${declared.join(', ')}`,
              };
    }
    if (typeof payload !== 'object' || Array.isArray(payload)) {
        return { ok: false, message: 'payload must be an object' };
    }
    const prototype = Object.getPrototypeOf(payload);
    if (prototype !== Object.prototype && prototype !== null) {
        return { ok: false, message: 'payload must be a plain object' };
    }
    for (const key of Object.keys(payload)) {
        if (!hasOwn(fields, key)) {
            return { ok: false, message: `unexpected payload field "${key}"` };
        }
    }
    const record: Record<string, Value> = Object.create(null);
    for (const name of declared) {
        const descriptor = Object.getOwnPropertyDescriptor(payload, name);
        if (descriptor === undefined || !('value' in descriptor)) {
            return { ok: false, message: `missing payload field "${name}"` };
        }
        const type = parseTypeSpec(fields[name])!;
        const check = checkValue(descriptor.value, type, limits);
        if (check === 'type') {
            return {
                ok: false,
                message: `payload field "${name}" must be ${describeType(type)}`,
            };
        }
        if (check === 'limit') {
            return {
                ok: false,
                message: `payload field "${name}" is longer than the limits allow`,
            };
        }
        record[name] = freezeValue(descriptor.value as Value);
    }
    return { ok: true, value: Object.freeze(record) };
}
