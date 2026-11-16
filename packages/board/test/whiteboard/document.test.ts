import { describe, expect, it } from 'vitest';

import { WhiteboardDocument } from '../../src/whiteboard/document/document';
import type { Change } from '../../src/whiteboard/document/types';
import { rect } from './shapes';

function watch(doc: WhiteboardDocument): Change[] {
    const seen: Change[] = [];
    doc.subscribe(change => seen.push(change));
    return seen;
}

describe('WhiteboardDocument', () => {
    it('a transaction emits one change', () => {
        const doc = new WhiteboardDocument();
        const seen = watch(doc);
        doc.transact(() => {
            doc.put(rect('a'));
            doc.put(rect('b'));
        });
        expect(seen).toHaveLength(1);
        expect(seen[0]!.added.map(s => s.id)).toEqual(['a', 'b']);
        expect(seen[0]!.source).toBe('local');
        expect(doc.size).toBe(2);
    });

    it('a put outside a transaction is its own change', () => {
        const doc = new WhiteboardDocument();
        const seen = watch(doc);
        doc.put(rect('a'));
        doc.put([rect('b'), rect('c')]);
        expect(seen.map(c => c.added.length)).toEqual([1, 2]);
    });

    it('changes to one record inside a transaction collapse', () => {
        const doc = new WhiteboardDocument([rect('a')]);
        const seen = watch(doc);
        doc.transact(() => {
            doc.put(rect('a', { x: 5 }));
            doc.put(rect('a', { x: 9 }));
        });
        expect(seen[0]!.updated).toHaveLength(1);
        expect(seen[0]!.updated[0]![0].x).toBe(0);
        expect(seen[0]!.updated[0]![1].x).toBe(9);

        doc.transact(() => {
            doc.put(rect('n'));
            doc.remove('n');
        });
        expect(seen).toHaveLength(1);
    });

    it('an add then an update inside a transaction is an add', () => {
        const doc = new WhiteboardDocument();
        const seen = watch(doc);
        doc.transact(() => {
            doc.put(rect('a'));
            doc.put(rect('a', { x: 4 }));
        });
        expect(seen[0]!.added.map(s => s.x)).toEqual([4]);
        expect(seen[0]!.updated).toEqual([]);
    });

    it('removing an existing record reports its last state', () => {
        const doc = new WhiteboardDocument([rect('a')]);
        const seen = watch(doc);
        doc.transact(() => {
            doc.put(rect('a', { x: 3 }));
            doc.remove('a');
        });
        expect(seen[0]!.removed.map(s => s.x)).toEqual([0]);
        expect(doc.get('a')).toBeUndefined();
    });

    it('removing unknown ids does nothing', () => {
        const doc = new WhiteboardDocument([rect('a')]);
        const seen = watch(doc);
        doc.remove(['nope']);
        expect(seen).toEqual([]);
    });

    it('putting the same record object again does nothing', () => {
        const a = rect('a');
        const doc = new WhiteboardDocument([a]);
        const seen = watch(doc);
        doc.put(a);
        expect(seen).toEqual([]);
    });

    it('nested transactions join the outer one', () => {
        const doc = new WhiteboardDocument();
        const seen = watch(doc);
        const result = doc.transact(() => {
            doc.put(rect('a'));
            doc.transact(() => doc.put(rect('b')));
            return 7;
        });
        expect(result).toBe(7);
        expect(seen).toHaveLength(1);
    });

    it('all() sorts by index then id', () => {
        const doc = new WhiteboardDocument([
            rect('y', { index: 'b' }),
            rect('z', { index: 'a' }),
            rect('x', { index: 'a' }),
        ]);
        expect(doc.all().map(s => s.id)).toEqual(['x', 'z', 'y']);
        doc.put(rect('w', { index: 'A' }));
        expect(doc.all().map(s => s.id)).toEqual(['w', 'x', 'z', 'y']);
    });

    it('applyRemote marks the source', () => {
        const doc = new WhiteboardDocument([rect('u'), rect('d')]);
        const seen = watch(doc);
        doc.applyRemote({
            added: [rect('r')],
            updated: [[rect('u'), rect('u', { x: 8 })]],
            removed: [rect('d')],
            source: 'remote',
        });
        expect(doc.get('r')).toBeDefined();
        expect(doc.get('u')!.x).toBe(8);
        expect(doc.get('d')).toBeUndefined();
        expect(seen).toHaveLength(1);
        expect(seen[0]!.source).toBe('remote');
    });

    it('nextIndex is above every shape', () => {
        const doc = new WhiteboardDocument();
        doc.put(rect('a', { index: doc.nextIndex() }));
        doc.put(rect('b', { index: doc.nextIndex() }));
        expect(doc.get('b')!.index > doc.get('a')!.index).toBe(true);
        expect(doc.all().map(s => s.id)).toEqual(['a', 'b']);
    });

    it('unsubscribe stops delivery', () => {
        const doc = new WhiteboardDocument();
        const seen: Change[] = [];
        const stop = doc.subscribe(change => seen.push(change));
        stop();
        doc.put(rect('a'));
        expect(seen).toEqual([]);
    });

    it('a listener sees the document after the change', () => {
        const doc = new WhiteboardDocument();
        let size = -1;
        doc.subscribe(() => (size = doc.size));
        doc.put(rect('a'));
        expect(size).toBe(1);
    });
});
