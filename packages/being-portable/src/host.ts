import { LoadError, RuntimeError, loadError } from './errors';
import { MachineDefinition, TypeSpec, Value } from './format/types';
import {
    ValueType,
    describeType,
    parseTypeSpec,
    sameType,
} from './format/values';
import { Limits, resolveLimits } from './limits';
import { entriesOf, joinPath } from './util';
import { checkName } from './validate/names';

/**
 * One host capability, as the host writes it.
 *
 * @category Types
 */
export type EffectImplementation = {
    /** Argument names and types; must match the document's declaration exactly. */
    readonly args: Readonly<Record<string, TypeSpec>>;
    /** Return type; must match the document's declaration exactly. */
    readonly returns?: TypeSpec;
    /** Receives validated, frozen arguments. */
    readonly run: (args: Readonly<Record<string, Value>>) => Value | void;
};

/**
 * Sources of randomness and time for `randomInt` and `now`.
 *
 * @category Types
 */
export type Services = {
    /** A number in `[0, 1)`. */
    readonly random: () => number;
    /** A finite number, usually milliseconds. */
    readonly now: () => number;
};

/**
 * What a host passes to {@link defineHost}.
 *
 * @category Types
 */
export type HostDefinition = {
    readonly effects?: Readonly<Record<string, EffectImplementation>>;
    /** Defaults to `Math.random` and `Date.now`. */
    readonly services?: Partial<Services>;
    readonly limits?: Partial<Limits>;
    /** Receives every runtime failure. Defaults to `console.error`. */
    readonly onError?: (error: RuntimeError) => void;
};

/** An effect after {@link defineHost} parsed its types. */
export type HostEffect = {
    readonly args: ReadonlyMap<string, ValueType>;
    readonly returns: ValueType | null;
    readonly run: (args: Readonly<Record<string, Value>>) => Value | void;
};

/**
 * A validated host, made by {@link defineHost}.
 *
 * @category Types
 */
export interface Host {
    readonly effects: ReadonlyMap<string, HostEffect>;
    readonly services: Services;
    readonly limits: Limits;
    readonly onError: (error: RuntimeError) => void;
}

function defaultOnError(error: RuntimeError): void {
    console.error(
        `[being-portable] ${error.code} at ${error.path || '(root)'}: ${error.message}`
    );
}

function hostType(spec: unknown, what: string): ValueType {
    const type = parseTypeSpec(spec);
    if (type === null) {
        throw new Error(`defineHost: ${what} is not a valid type`);
    }
    return type;
}

/**
 * Validates and freezes a host. Host code is trusted, so a malformed host
 * throws instead of returning errors.
 *
 * @category Core
 */
export function defineHost(definition: HostDefinition = {}): Host {
    const effects = new Map<string, HostEffect>();
    for (const [name, implementation] of entriesOf(definition.effects)) {
        const nameError = checkName(name, joinPath('effects', name), 'effect');
        if (nameError !== null) {
            throw new Error(`defineHost: ${nameError.message}`);
        }
        if (typeof implementation.run !== 'function') {
            throw new Error(`defineHost: effect ${name} needs a run function`);
        }
        const args = new Map<string, ValueType>();
        for (const [arg, spec] of entriesOf(implementation.args)) {
            const argError = checkName(arg, arg, 'argument');
            if (argError !== null) {
                throw new Error(`defineHost: ${argError.message}`);
            }
            args.set(arg, hostType(spec, `argument ${arg} of effect ${name}`));
        }
        const returns =
            implementation.returns === undefined
                ? null
                : hostType(implementation.returns, `returns of effect ${name}`);
        effects.set(
            name,
            Object.freeze({ args, returns, run: implementation.run })
        );
    }
    return Object.freeze({
        effects,
        services: Object.freeze({
            random: definition.services?.random ?? Math.random,
            now: definition.services?.now ?? Date.now,
        }),
        limits: resolveLimits(definition.limits),
        onError: definition.onError ?? defaultOnError,
    });
}

/** Every effect the document declares must exist on the host with the same types. */
export function checkHostEffects(
    definition: MachineDefinition,
    host: Host
): LoadError[] {
    const errors: LoadError[] = [];
    for (const [name, declaration] of entriesOf(definition.effects)) {
        const path = joinPath('effects', name);
        const effect = host.effects.get(name);
        if (effect === undefined) {
            errors.push(
                loadError(
                    'missing-effect',
                    path,
                    `the host does not provide effect ${name}`
                )
            );
            continue;
        }
        const declaredArgs = entriesOf(declaration.args);
        const argsMatch =
            declaredArgs.length === effect.args.size &&
            declaredArgs.every(([arg, spec]) => {
                const hostArg = effect.args.get(arg);
                return (
                    hostArg !== undefined &&
                    sameType(hostArg, parseTypeSpec(spec)!)
                );
            });
        const declaredReturns =
            declaration.returns === undefined
                ? null
                : parseTypeSpec(declaration.returns)!;
        const returnsMatch =
            declaredReturns === null || effect.returns === null
                ? declaredReturns === effect.returns
                : sameType(declaredReturns, effect.returns);
        if (!argsMatch || !returnsMatch) {
            errors.push(
                loadError(
                    'effect-signature-mismatch',
                    path,
                    `effect ${name} is declared as ${signature(declaration.args, declaredReturns)} but the host provides ${hostSignature(effect)}`
                )
            );
        }
    }
    return errors;
}

function signature(
    args: Readonly<Record<string, TypeSpec>>,
    returns: ValueType | null
): string {
    const list = entriesOf(args)
        .map(([name, spec]) => `${name}: ${describeType(parseTypeSpec(spec)!)}`)
        .join(', ');
    return `(${list})${returns === null ? '' : ` -> ${describeType(returns)}`}`;
}

function hostSignature(effect: HostEffect): string {
    const list = [...effect.args]
        .map(([name, type]) => `${name}: ${describeType(type)}`)
        .join(', ');
    return `(${list})${effect.returns === null ? '' : ` -> ${describeType(effect.returns)}`}`;
}
