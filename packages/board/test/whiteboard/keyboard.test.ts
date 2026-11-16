import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import {
    type KeyLike,
    shortcutFor,
} from '../../src/whiteboard/editor/keyboard';

const dom = new JSDOM(
    '<!doctype html><input><textarea></textarea><select></select><div contenteditable="true"><span id="inside"></span></div><div id="plain"></div>'
);
const doc = dom.window.document;

function k(over: Partial<KeyLike>): KeyLike {
    return {
        key: 'x',
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        isComposing: false,
        target: doc.getElementById('plain'),
        ...over,
    };
}

describe('shortcutFor', () => {
    it.each([
        ['h', 'hand'],
        ['v', 'select'],
        ['r', 'rect'],
        ['R', 'rect'],
        ['o', 'ellipse'],
        ['a', 'arrow'],
        ['l', 'line'],
        ['p', 'pen'],
        ['t', 'text'],
        ['n', 'note'],
        ['e', 'eraser'],
    ])('%s picks %s', (key, tool) => {
        expect(shortcutFor(k({ key }))).toEqual({ type: 'tool', tool });
    });

    it('edits the selection', () => {
        expect(shortcutFor(k({ key: 'Delete' }))).toEqual({ type: 'delete' });
        expect(shortcutFor(k({ key: 'Backspace' }))).toEqual({
            type: 'delete',
        });
        expect(shortcutFor(k({ key: 'Escape' }))).toEqual({ type: 'escape' });
    });

    it('never fires while typing', () => {
        for (const tag of ['input', 'textarea', 'select']) {
            expect(
                shortcutFor(k({ key: 'r', target: doc.querySelector(tag) }))
            ).toBeNull();
        }
        expect(
            shortcutFor(k({ key: 'r', target: doc.getElementById('inside') }))
        ).toBeNull();
        expect(
            shortcutFor(
                k({
                    key: 'z',
                    ctrlKey: true,
                    target: doc.querySelector('input'),
                })
            )
        ).toBeNull();
        expect(shortcutFor(k({ key: 'r', isComposing: true }))).toBeNull();
    });

    it('leaves browser shortcuts alone', () => {
        expect(shortcutFor(k({ key: 'r', ctrlKey: true }))).toBeNull();
        expect(shortcutFor(k({ key: 'l', metaKey: true }))).toBeNull();
        expect(shortcutFor(k({ key: 'p', altKey: true }))).toBeNull();
        expect(shortcutFor(k({ key: ' ' }))).toBeNull();
        expect(shortcutFor(k({ key: 'F5' }))).toBeNull();
    });

    it('undo, redo and select all', () => {
        expect(shortcutFor(k({ key: 'z', metaKey: true }))).toEqual({
            type: 'undo',
        });
        expect(shortcutFor(k({ key: 'z', ctrlKey: true }))).toEqual({
            type: 'undo',
        });
        expect(
            shortcutFor(k({ key: 'Z', ctrlKey: true, shiftKey: true }))
        ).toEqual({ type: 'redo' });
        expect(shortcutFor(k({ key: 'y', ctrlKey: true }))).toEqual({
            type: 'redo',
        });
        expect(shortcutFor(k({ key: 'a', metaKey: true }))).toEqual({
            type: 'selectAll',
        });
    });

    it('works without a target', () => {
        expect(shortcutFor(k({ key: 'p', target: null }))).toEqual({
            type: 'tool',
            tool: 'pen',
        });
    });
});
