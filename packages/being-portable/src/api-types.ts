import { LoadError } from './errors';
import { MachineDefinition } from './format/types';

/**
 * @category Types
 */
export type ValidationResult =
    | { readonly ok: true; readonly definition: MachineDefinition }
    | { readonly ok: false; readonly errors: readonly LoadError[] };
