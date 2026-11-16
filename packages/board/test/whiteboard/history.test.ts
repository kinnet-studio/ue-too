import { describe, expect, it } from 'vitest';

import { WhiteboardDocument } from '../../src/whiteboard/document/document';
import { History } from '../../src/whiteboard/document/history';
import { rect } from './shapes';

function setup(shapes = [rect('base')]) {
    const doc = new WhiteboardDocument(shapes);
    return { doc, history: new History(doc) };
}

describe('History', () => {
    it('a gesture is one step', () => {
        const { doc, history } = setup([]);
        history.begin();
        doc.put(rect('a'));
        doc.put(rect('a', { x: 5 }));
        doc.put(rect('a', { x: 10 }));
        history.end();
        expect(history.undo()).toBe(true);
        expect(doc.get('a')).toBeUndefined();
        expect(history.redo()).toBe(true);
        expect(doc.get('a')!.x).toBe(10);
        expect(history.canRedo).toBe(false);
    });

    it('each change outside a gesture is its own step', () => {
        const { doc, history } = setup([]);
        doc.put(rect('a'));
        doc.put(rect('b'));
        history.undo();
        expect(doc.get('b')).toBeUndefined();
        expect(doc.get('a')).toBeDefined();
    });

    it('nested begin and end join the outer step', () => {
        const { doc, history } = setup([]);
        history.begin();
        doc.put(rect('a'));
        history.begin();
        doc.put(rect('b'));
        history.end();
        expect(history.open).toBe(true);
        history.end();
        history.undo();
        expect(doc.size).toBe(0);
    });

    it('an empty step is dropped', () => {
        const { history } = setup();
        history.begin();
        history.end();
        expect(history.canUndo).toBe(false);
    });

    it('cancel reverts and records nothing', () => {
        const { doc, history } = setup([rect('a')]);
        history.begin();
        doc.put(rect('a', { x: 50 }));
        doc.put(rect('b'));
        history.cancel();
        expect(doc.get('a')!.x).toBe(0);
        expect(doc.get('b')).toBeUndefined();
        expect(history.canUndo).toBe(false);
        expect(history.open).toBe(false);
    });

    it('undo during an open step cancels it first', () => {
        const { doc, history } = setup([]);
        doc.put(rect('a'));
        history.begin();
        doc.put(rect('b'));
        expect(history.undo()).toBe(true);
        expect(doc.get('b')).toBeUndefined();
        expect(doc.get('a')).toBeUndefined();
        expect(history.open).toBe(false);
        history.redo();
        expect(doc.get('a')).toBeDefined();
        expect(doc.get('b')).toBeUndefined();
    });

    it('remote changes are not undone', () => {
        const { doc, history } = setup([]);
        doc.put(rect('mine'));
        doc.applyRemote({
            added: [rect('theirs')],
            updated: [],
            removed: [],
            source: 'remote',
        });
        history.undo();
        expect(doc.get('mine')).toBeUndefined();
        expect(doc.get('theirs')).toBeDefined();
        expect(history.canUndo).toBe(false);
    });

    it('undo restores my before even after a remote edit (last write wins)', () => {
        const { doc, history } = setup([rect('a')]);
        doc.put(rect('a', { x: 5 }));
        doc.applyRemote({
            added: [],
            updated: [[rect('a', { x: 5 }), rect('a', { x: 7 })]],
            removed: [],
            source: 'remote',
        });
        history.undo();
        expect(doc.get('a')!.x).toBe(0);
    });

    it('a new change clears redo', () => {
        const { doc, history } = setup([]);
        doc.put(rect('a'));
        history.undo();
        expect(history.canRedo).toBe(true);
        doc.put(rect('b'));
        expect(history.canRedo).toBe(false);
    });

    it('undo and redo themselves are not new steps', () => {
        const { doc, history } = setup([]);
        doc.put(rect('a'));
        history.undo();
        history.redo();
        history.undo();
        expect(doc.get('a')).toBeUndefined();
        expect(history.canUndo).toBe(false);
    });

    it('returns false with nothing to undo or redo', () => {
        const { history } = setup();
        expect(history.undo()).toBe(false);
        expect(history.redo()).toBe(false);
    });

    it('tells listeners when canUndo or canRedo change', () => {
        const { doc, history } = setup([]);
        let calls = 0;
        history.subscribe(() => calls++);
        doc.put(rect('a'));
        history.undo();
        expect(calls).toBeGreaterThanOrEqual(2);
    });

    it('stops recording once disposed', () => {
        const { doc, history } = setup([]);
        history.dispose();
        doc.put(rect('a'));
        expect(history.canUndo).toBe(false);
    });
});
