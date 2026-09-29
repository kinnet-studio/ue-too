import { ValidationResult } from './api-types';
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
