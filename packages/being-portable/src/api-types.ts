import { BaseContext, StateMachine } from '@ue-too/being';

import { LoadError } from './errors';
import { MachineDefinition, Value } from './format/types';

/**
 * Event mapping of a portable machine. Events are only known at runtime, so
 * `happens` accepts any event name and an optional payload.
 *
 * @category Types
 */
export type PortableEvents = Record<never, never>;

/**
 * Output mapping of a portable machine; outputs are `unknown` statically.
 *
 * @category Types
 */
export type PortableOutputs = Record<never, never>;

/**
 * A read-only view of a portable machine's context. Only events change it.
 *
 * @category Types
 */
export interface PortableContext extends BaseContext {
    /** The field's current value. Lists are frozen. Throws for an unknown field. */
    get(field: string): Value;
    /** Every field's current value, frozen. */
    fields(): Readonly<Record<string, Value>>;
}

/**
 * A loaded machine: an ordinary `being` state machine plus its definition.
 *
 * @category Types
 */
export interface PortableMachine extends StateMachine<
    PortableEvents,
    PortableContext,
    string,
    PortableOutputs
> {
    /** The upgraded, normalized document, frozen. */
    readonly definition: MachineDefinition;
    readonly context: PortableContext;
}

/**
 * @category Types
 */
export type ValidationResult =
    | { readonly ok: true; readonly definition: MachineDefinition }
    | { readonly ok: false; readonly errors: readonly LoadError[] };

/**
 * @category Types
 */
export type LoadOptions = {
    /** Defaults to `true`. */
    readonly autoStart?: boolean;
};

/**
 * @category Types
 */
export type LoadResult =
    | { readonly ok: true; readonly machine: PortableMachine }
    | { readonly ok: false; readonly errors: readonly LoadError[] };
