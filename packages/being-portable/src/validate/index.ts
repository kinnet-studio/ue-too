import { PlainData } from '../copy';
import { LoadError } from '../errors';
import { MachineDefinition } from '../format/types';
import { Limits } from '../limits';
import { migrateDefinition } from '../migrate';
import { checkTypes } from './check';
import { checkReferences } from './references';
import { checkStructure } from './structure';

export type DefinitionCheck =
    | { readonly ok: true; readonly definition: MachineDefinition }
    | { readonly ok: false; readonly errors: LoadError[] };

function dedupe(errors: LoadError[]): LoadError[] {
    const seen = new Set<string>();
    return errors.filter(error => {
        const key = `${error.code}\u0000${error.path}\u0000${error.message}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/**
 * Runs migration and the four passes on already-copied data. Stops after the
 * structure pass when it finds errors.
 */
export function checkDefinition(
    document: PlainData,
    limits: Limits
): DefinitionCheck {
    const migrated = migrateDefinition(document);
    if (!migrated.ok) {
        return migrated;
    }
    const structural = checkStructure(migrated.value, limits);
    if (structural.length > 0) {
        return { ok: false, errors: structural };
    }
    const definition = migrated.value as unknown as MachineDefinition;
    const errors = dedupe([
        ...checkReferences(definition, limits),
        ...checkTypes(definition, limits),
    ]);
    return errors.length > 0 ? { ok: false, errors } : { ok: true, definition };
}
