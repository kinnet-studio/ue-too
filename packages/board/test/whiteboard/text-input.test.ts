import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import {
    DomTextInput,
    type TextInputSession,
} from '../../src/whiteboard/editor/text-input';

function setup(overrides: Partial<TextInputSession> = {}) {
    const dom = new JSDOM('<!doctype html><div id="parent"></div>');
    const parent = dom.window.document.getElementById('parent')!;
    const commits: string[] = [];
    const inputs: string[] = [];
    const input = new DomTextInput(parent);
    input.open({
        text: 'Hi',
        font: '700 28px Hand',
        color: '#123456',
        lineHeight: 35,
        rect: { x: 10, y: 20, w: 172, h: 172 },
        scale: 2,
        wrap: true,
        onInput: text => inputs.push(text),
        onCommit: text => commits.push(text),
        ...overrides,
    });
    const textarea = parent.querySelector('textarea')!;
    const key = (k: string, isComposing = false) => {
        const event = new dom.window.KeyboardEvent('keydown', {
            key: k,
            isComposing,
            cancelable: true,
            bubbles: true,
        });
        textarea.dispatchEvent(event);
        return event;
    };
    return { dom, parent, input, textarea, commits, inputs, key };
}

describe('DomTextInput', () => {
    it('opens a textarea over the shape with its text and font', () => {
        const { textarea, input } = setup();
        expect(input.active).toBe(true);
        expect(textarea.value).toBe('Hi');
        expect(textarea.style.left).toBe('10px');
        expect(textarea.style.top).toBe('20px');
        expect(textarea.style.width).toBe('172px');
        expect(textarea.style.transform).toBe('scale(2)');
        expect(textarea.style.font).toContain('28px');
        expect(textarea.spellcheck).toBe(false);
    });

    it('reports typing', () => {
        const { dom, textarea, inputs } = setup();
        textarea.value = 'Hello';
        textarea.dispatchEvent(new dom.window.Event('input'));
        expect(inputs).toEqual(['Hello']);
    });

    it('commits on Escape and goes away', () => {
        const { parent, input, key, commits } = setup();
        const event = key('Escape');
        expect(event.defaultPrevented).toBe(true);
        expect(commits).toEqual(['Hi']);
        expect(parent.querySelector('textarea')).toBeNull();
        expect(input.active).toBe(false);
    });

    it('Escape during IME composition cancels the conversion, not editing', () => {
        const { input, key, commits } = setup();
        expect(key('Escape', true).defaultPrevented).toBe(false);
        expect(commits).toEqual([]);
        expect(input.active).toBe(true);
    });

    it('Enter adds a line', () => {
        const { key, commits } = setup();
        expect(key('Enter').defaultPrevented).toBe(false);
        expect(commits).toEqual([]);
    });

    it('commits once on blur or close', () => {
        const { dom, textarea, input, commits } = setup();
        textarea.dispatchEvent(new dom.window.FocusEvent('blur'));
        input.close();
        expect(commits).toEqual(['Hi']);
    });

    it('follows the camera', () => {
        const { textarea, input } = setup();
        input.reposition({ x: 40, y: 50, w: 172, h: 172 }, 0.5);
        expect(textarea.style.left).toBe('40px');
        expect(textarea.style.transform).toBe('scale(0.5)');
    });

    it('text that grows does not wrap', () => {
        const { textarea } = setup({ wrap: false });
        expect(textarea.getAttribute('wrap')).toBe('off');
        expect(textarea.style.whiteSpace).toBe('pre');
    });
});
