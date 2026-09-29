import { PlainData, PlainObject, isPlainObject } from './copy';
import { LoadError, loadError } from './errors';

/** The definition format this version reads and writes. */
export const MACHINE_FORMAT = 'being-machine@1';

/** The snapshot format this version reads and writes. */
export const SNAPSHOT_FORMAT = 'being-snapshot@1';

type Migration = {
    readonly from: string;
    readonly migrate: (document: PlainObject) => PlainObject;
};

// Each entry upgrades one older format to the next. Empty until @2 exists.
const MACHINE_MIGRATIONS: readonly Migration[] = [];
const SNAPSHOT_MIGRATIONS: readonly Migration[] = [];

export type MigrateResult =
    | { readonly ok: true; readonly value: PlainObject }
    | { readonly ok: false; readonly errors: LoadError[] };

function migrate(
    document: PlainData,
    current: string,
    migrations: readonly Migration[]
): MigrateResult {
    if (!isPlainObject(document)) {
        return {
            ok: false,
            errors: [loadError('invalid-structure', '', 'expected an object')],
        };
    }
    let value = document;
    for (let step = 0; step <= migrations.length; step++) {
        const format = value.format;
        if (typeof format !== 'string') {
            return {
                ok: false,
                errors: [
                    loadError(
                        'invalid-structure',
                        'format',
                        'format must be a string'
                    ),
                ],
            };
        }
        if (format === current) {
            return { ok: true, value };
        }
        const next = migrations.find(migration => migration.from === format);
        if (next === undefined) {
            break;
        }
        value = next.migrate(value);
    }
    return {
        ok: false,
        errors: [
            loadError(
                'unsupported-format',
                'format',
                `format "${String(value.format)}" is not supported; this version reads ${current}`
            ),
        ],
    };
}

export function migrateDefinition(document: PlainData): MigrateResult {
    return migrate(document, MACHINE_FORMAT, MACHINE_MIGRATIONS);
}

export function migrateSnapshot(document: PlainData): MigrateResult {
    return migrate(document, SNAPSHOT_FORMAT, SNAPSHOT_MIGRATIONS);
}
