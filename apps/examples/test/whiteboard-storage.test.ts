import { WhiteboardDocument } from '@ue-too/board/whiteboard';
import { describe, expect, it } from 'bun:test';

import { STORAGE_KEY, loadBoard, saveBoard } from '../src/whiteboard/storage';

function memoryStorage(): Storage {
    const items = new Map<string, string>();
    return {
        get length() {
            return items.size;
        },
        clear: () => items.clear(),
        getItem: key => items.get(key) ?? null,
        key: index => [...items.keys()][index] ?? null,
        removeItem: key => void items.delete(key),
        setItem: (key, value) => void items.set(key, value),
    };
}

const rect = (id: string) => ({
    id,
    type: 'rect' as const,
    x: 0,
    y: 0,
    w: 10,
    h: 10,
    rotation: 0,
    index: 'V',
    seed: 1,
    style: { color: 'ink' as const, size: 'm' as const, fill: 'none' as const },
});

const quiet = () => {};

describe('whiteboard example storage', () => {
    it('round-trips a drawing', () => {
        const storage = memoryStorage();
        const doc = new WhiteboardDocument();
        const saver = saveBoard(doc, storage, { warn: quiet });
        doc.put(rect('a'));
        saver.flush();
        expect(loadBoard(storage, quiet).size).toBe(1);
        saver.dispose();
    });

    it('a saved value it cannot read stays until the first edit', () => {
        const storage = memoryStorage();
        storage.setItem(STORAGE_KEY, '{not json');
        const doc = loadBoard(storage, quiet);
        expect(doc.size).toBe(0);
        const saver = saveBoard(doc, storage, { warn: quiet });
        // The visitor only looks, then leaves: pagehide flushes
        saver.flush();
        expect(storage.getItem(STORAGE_KEY)).toBe('{not json');
        doc.put(rect('a'));
        saver.flush();
        expect(JSON.parse(storage.getItem(STORAGE_KEY)!).records).toHaveLength(
            1
        );
        saver.dispose();
    });

    it('a save from a newer version is left alone too', () => {
        const storage = memoryStorage();
        const newer = JSON.stringify({
            schema: 'ue-too-whiteboard',
            version: 99,
            records: [],
        });
        storage.setItem(STORAGE_KEY, newer);
        const doc = loadBoard(storage, quiet);
        saveBoard(doc, storage, { warn: quiet }).flush();
        expect(storage.getItem(STORAGE_KEY)).toBe(newer);
    });

    it('debounces, and warns once when saving fails', async () => {
        const storage = memoryStorage();
        let writes = 0;
        const warnings: string[] = [];
        storage.setItem = () => {
            writes++;
            throw new Error('QuotaExceededError');
        };
        const doc = new WhiteboardDocument();
        const saver = saveBoard(doc, storage, {
            delay: 5,
            warn: message => warnings.push(message),
        });
        doc.put(rect('a'));
        doc.put(rect('b'));
        doc.put(rect('c'));
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(writes).toBe(1);
        doc.put(rect('d'));
        saver.flush();
        expect(writes).toBe(2);
        expect(warnings).toHaveLength(1);
        saver.dispose();
    });

    it('works with no storage at all', () => {
        expect(loadBoard(null, quiet).size).toBe(0);
        const doc = new WhiteboardDocument();
        const saver = saveBoard(doc, null, { warn: quiet });
        doc.put(rect('a'));
        saver.flush();
        saver.dispose();
    });
});
