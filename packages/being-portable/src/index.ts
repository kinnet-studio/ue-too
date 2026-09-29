/**
 * @packageDocumentation
 * Portable, serializable definitions for `@ue-too/being` state machines.
 *
 * A machine is a JSON document whose behavior is a small, statically checked
 * language. Documents from untrusted authors can be loaded safely, compiled
 * into ordinary being machines, and snapshotted and restored elsewhere.
 */

export { loadMachine, validateDefinition } from './api';
export { defineHost } from './host';
export { DEFAULT_LIMITS } from './limits';

export type {
    LoadOptions,
    LoadResult,
    PortableContext,
    PortableEvents,
    PortableMachine,
    PortableOutputs,
    RestoreMode,
    RestoreReport,
    RestoreResult,
    ValidationResult,
} from './api-types';
export type {
    LoadError,
    LoadErrorCode,
    RuntimeError,
    RuntimeErrorCode,
} from './errors';
export type {
    Branch,
    ChildDefinition,
    ContextFieldDefinition,
    DoneReaction,
    EffectDeclaration,
    Expr,
    GuardRef,
    LevelSnapshot,
    MachineBody,
    MachineDefinition,
    MachineSnapshot,
    Reaction,
    Scalar,
    ScalarValue,
    StateDefinition,
    Stmt,
    TypeSpec,
    Value,
} from './format/types';
export type {
    EffectImplementation,
    Host,
    HostDefinition,
    HostEffect,
    Services,
} from './host';
export type { ValueType } from './format/values';
export type { Limits } from './limits';
