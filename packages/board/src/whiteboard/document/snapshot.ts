import { COLOR_NAMES, type Shape } from './types';

/**
 * The `schema` field every whiteboard snapshot carries.
 *
 * @group Whiteboard Document
 */
export const SNAPSHOT_SCHEMA = 'ue-too-whiteboard';

/**
 * The snapshot format this version writes and the newest it reads.
 *
 * @group Whiteboard Document
 */
export const SNAPSHOT_VERSION = 1;

/**
 * A whole document as plain JSON, for saving and loading.
 *
 * @group Whiteboard Document
 */
export interface Snapshot {
    schema: typeof SNAPSHOT_SCHEMA;
    version: number;
    records: Shape[];
}

/**
 * Thrown when a value isn't a whiteboard snapshot this version can read.
 *
 * @group Whiteboard Document
 */
export class SnapshotError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SnapshotError';
    }
}

type Fields = Record<string, unknown>;

const SIZES = new Set(['s', 'm', 'l']);
const FILLS = new Set(['none', 'hachure', 'solid']);
const COLORS = new Set<string>(COLOR_NAMES);

const isObject = (value: unknown): value is Fields =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);
const isPair = (value: unknown): boolean =>
    Array.isArray(value) &&
    value.length === 2 &&
    isNumber(value[0]) &&
    isNumber(value[1]);

const SHAPE_FIELDS: Record<Shape['type'], (shape: Fields) => boolean> = {
    rect: s => isNumber(s.w) && isNumber(s.h),
    ellipse: s => isNumber(s.w) && isNumber(s.h),
    note: s => isNumber(s.w) && isNumber(s.h) && typeof s.text === 'string',
    arrow: s => isPair(s.end),
    line: s => isPair(s.end),
    pen: s => Array.isArray(s.points) && s.points.every(isPair),
    text: s => typeof s.text === 'string',
};

/**
 * Whether a value is a complete, valid shape record.
 *
 * @group Whiteboard Document
 */
export function isShape(value: unknown): value is Shape {
    if (!isObject(value)) return false;
    const style = value.style;
    const fields = SHAPE_FIELDS[value.type as Shape['type']];
    return (
        fields !== undefined &&
        typeof value.id === 'string' &&
        value.id.length > 0 &&
        typeof value.index === 'string' &&
        value.index.length > 0 &&
        isNumber(value.x) &&
        isNumber(value.y) &&
        isNumber(value.rotation) &&
        isNumber(value.seed) &&
        isObject(style) &&
        COLORS.has(style.color as string) &&
        SIZES.has(style.size as string) &&
        FILLS.has(style.fill as string) &&
        fields(value)
    );
}

/**
 * Reads the records out of a snapshot.
 *
 * @remarks
 * Records that aren't valid shapes, and repeats of an id already read, are
 * dropped so one bad record doesn't cost the rest. A later format version
 * adds its migration here.
 *
 * @throws {@link SnapshotError} when the value isn't a snapshot, has another
 * schema, or comes from a newer version
 *
 * @group Whiteboard Document
 */
export function parseSnapshot(json: unknown): Shape[] {
    if (!isObject(json)) throw new SnapshotError('Not a snapshot');
    if (json.schema !== SNAPSHOT_SCHEMA) {
        throw new SnapshotError(`Unknown schema: ${String(json.schema)}`);
    }
    const version = json.version;
    if (!Number.isInteger(version) || (version as number) < 1) {
        throw new SnapshotError(`Bad version: ${String(version)}`);
    }
    if ((version as number) > SNAPSHOT_VERSION) {
        throw new SnapshotError(
            `Snapshot version ${version} is newer than ${SNAPSHOT_VERSION}`
        );
    }
    if (!Array.isArray(json.records)) {
        throw new SnapshotError('Snapshot has no records');
    }
    const seen = new Set<string>();
    const shapes: Shape[] = [];
    for (const record of json.records) {
        if (!isShape(record) || seen.has(record.id)) continue;
        seen.add(record.id);
        shapes.push(record);
    }
    return shapes;
}
