import { LoadOptions, LoadResult, ValidationResult } from './api-types';
import { buildMachineTree } from './compile/build';
import { copyPlainData } from './copy';
import { Host, checkHostEffects } from './host';
import { DEFAULT_LIMITS, Limits, resolveLimits } from './limits';
import { checkDefinition } from './validate';

/**
 * Checks an untrusted document without building a machine. With a host, also
 * checks that the host supplies every declared effect with matching types.
 *
 * Limits come from `options.limits` if given, else from the host, else the
 * defaults.
 *
 * @category Core
 */
export function validateDefinition(
    document: unknown,
    options: { readonly limits?: Partial<Limits>; readonly host?: Host } = {}
): ValidationResult {
    const limits =
        options.limits !== undefined
            ? resolveLimits(options.limits)
            : (options.host?.limits ?? DEFAULT_LIMITS);
    const copied = copyPlainData(document, limits);
    if (!copied.ok) {
        return copied;
    }
    const checked = checkDefinition(copied.value, limits);
    if (!checked.ok || options.host === undefined) {
        return checked;
    }
    const hostErrors = checkHostEffects(checked.definition, options.host);
    return hostErrors.length > 0 ? { ok: false, errors: hostErrors } : checked;
}

/**
 * Validates an untrusted document and builds its machine. Returns every error
 * instead of a machine when the document is invalid.
 *
 * @example
 * ```ts
 * const result = loadMachine(JSON.parse(text), host);
 * if (!result.ok) return showErrors(result.errors);
 * result.machine.happens('insertCoin', { amount: 1 });
 * ```
 *
 * @category Core
 */
export function loadMachine(
    document: unknown,
    host: Host,
    options: LoadOptions = {}
): LoadResult {
    const validated = validateDefinition(document, { host });
    if (!validated.ok) {
        return validated;
    }
    const machine = buildMachineTree(validated.definition, host);
    if (options.snapshot !== undefined) {
        const restored = machine.restore(options.snapshot, {
            mode: options.restoreMode ?? 'strict',
        });
        return restored.ok
            ? { ok: true, machine, restoreReport: restored.report }
            : { ok: false, errors: restored.errors };
    }
    if (options.autoStart ?? true) {
        machine.start();
    }
    return { ok: true, machine };
}
