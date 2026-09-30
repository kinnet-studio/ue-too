import { BaseContext, StateMachine } from '@ue-too/being';

import { LoadError } from './errors';
import { MachineDefinition, MachineSnapshot, Value } from './format/types';

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
 * How {@link PortableMachine.restore} treats a snapshot from another revision.
 *
 * @category Types
 */
export type RestoreMode = 'strict' | 'structural';

/**
 * What a structural restore changed. Paths are JSON paths into the snapshot.
 *
 * @category Types
 */
export type RestoreReport = {
    readonly dropped: readonly string[];
    readonly defaulted: readonly string[];
};

/**
 * @category Types
 */
export type RestoreResult =
    | { readonly ok: true; readonly report: RestoreReport }
    | { readonly ok: false; readonly errors: readonly LoadError[] };

/**
 * A loaded machine: an ordinary `being` state machine plus its definition,
 * snapshot and restore.
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
    /** Throws while the machine is handling an event. */
    snapshot(): MachineSnapshot;
    restore(
        snapshot: unknown,
        options?: { readonly mode?: RestoreMode }
    ): RestoreResult;
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
    /** Restore this snapshot instead of starting. */
    readonly snapshot?: unknown;
    /** Defaults to `'strict'`. */
    readonly restoreMode?: RestoreMode;
    /** Defaults to `true`. Ignored when `snapshot` is given. */
    readonly autoStart?: boolean;
};

/**
 * @category Types
 */
export type LoadResult =
    | {
          readonly ok: true;
          readonly machine: PortableMachine;
          /** Present when a snapshot was restored. */
          readonly restoreReport?: RestoreReport;
      }
    | { readonly ok: false; readonly errors: readonly LoadError[] };
