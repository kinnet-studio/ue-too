import { describe, expect, it } from 'vitest';

import { WhiteboardDocument } from '../../src/whiteboard/document/document';
import {
    SNAPSHOT_SCHEMA,
    SNAPSHOT_VERSION,
    SnapshotError,
    isShape,
    parseSnapshot,
} from '../../src/whiteboard/document/snapshot';
import { arrow, ellipse, line, note, pen, rect, text } from './shapes';

describe('snapshots', () => {
    it('round-trips through JSON', () => {
        const doc = new WhiteboardDocument([
            rect('a', { index: 'a' }),
            pen('p', { index: 'b' }),
            note('n', { index: 'c' }),
            text('t', { index: 'd' }),
            arrow('r', { index: 'e' }),
            line('l', { index: 'f' }),
            ellipse('e', { index: 'g' }),
        ]);
        const snapshot = doc.toSnapshot();
        expect(snapshot.schema).toBe(SNAPSHOT_SCHEMA);
        expect(snapshot.version).toBe(SNAPSHOT_VERSION);
        const copy = WhiteboardDocument.fromSnapshot(
            JSON.parse(JSON.stringify(snapshot))
        );
        expect(copy.all()).toEqual(doc.all());
    });

    it.each([
        [null],
        ['x'],
        [[]],
        [{ schema: 'other', version: 1, records: [] }],
        [{ schema: SNAPSHOT_SCHEMA, version: 2, records: [] }],
        [{ schema: SNAPSHOT_SCHEMA, version: 1.5, records: [] }],
        [{ schema: SNAPSHOT_SCHEMA, records: [] }],
        [{ schema: SNAPSHOT_SCHEMA, version: 1, records: 'nope' }],
    ])('rejects %j', bad => {
        expect(() => parseSnapshot(bad)).toThrow(SnapshotError);
    });

    it('drops records it cannot use and keeps the rest', () => {
        const records = [
            rect('a'),
            { ...rect('b'), w: 'wide' },
            { ...rect('c'), type: 'star' },
            {
                ...rect('d'),
                style: { color: 'pink', size: 'm', fill: 'none' },
            },
            { ...rect('e'), x: Number.NaN },
            { ...pen('f'), points: [[0, 0], [1]] },
            { ...rect('g'), id: 7 },
            rect('a', { x: 99 }),
        ];
        const shapes = parseSnapshot({
            schema: SNAPSHOT_SCHEMA,
            version: 1,
            records,
        });
        expect(shapes.map(s => s.id)).toEqual(['a']);
        expect(shapes[0]!.x).toBe(0);
    });

    it('recognises every shape type', () => {
        for (const shape of [
            rect('a'),
            ellipse('b'),
            note('c'),
            arrow('d'),
            line('e'),
            pen('f'),
            text('g'),
        ]) {
            expect(isShape(shape)).toBe(true);
        }
        expect(isShape({ ...text('h'), text: 3 })).toBe(false);
        expect(isShape({ ...arrow('i'), end: [1] })).toBe(false);
    });
});
