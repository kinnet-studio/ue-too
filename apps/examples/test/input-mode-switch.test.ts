import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { JSDOM } from 'jsdom';

import { createInputModePreference } from '../src/input-mode/preference';

// The switch module pulls in the i18n module, which reads localStorage and
// navigator.language as it loads: give it a DOM first, then import it.
let createInputModeSwitcher: typeof import('../src/input-mode').createInputModeSwitcher;
let document: Document;

beforeAll(async () => {
    const dom = new JSDOM('<!doctype html><body></body>', {
        url: 'http://localhost/',
    });
    const g = globalThis as Record<string, unknown>;
    g.window = dom.window;
    g.document = dom.window.document;
    g.localStorage = dom.window.localStorage;
    g.MouseEvent = dom.window.MouseEvent;
    Object.defineProperty(globalThis, 'navigator', {
        value: dom.window.navigator,
        configurable: true,
    });
    document = dom.window.document;
    ({ createInputModeSwitcher } = await import('../src/input-mode'));
});

let container: HTMLElement;
beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
});

function setup() {
    const preference = createInputModePreference(undefined);
    const toggle = createInputModeSwitcher(container, preference);
    const mouseClick = () =>
        toggle.dispatchEvent(
            new MouseEvent('click', { bubbles: true, detail: 1 })
        );
    return { preference, toggle, mouseClick };
}

describe('input mode switch', () => {
    it('is a switch named Trackpad, off for keyboard + mouse', () => {
        const { toggle } = setup();
        expect(toggle.getAttribute('role')).toBe('switch');
        expect(toggle.getAttribute('aria-label')).toBe('Trackpad');
        expect(toggle.getAttribute('aria-checked')).toBe('false');
    });

    it('shows both choices, translated with the page', () => {
        const { toggle } = setup();
        const labels = [...toggle.querySelectorAll('[data-i18n]')];
        expect(labels.map(l => l.getAttribute('data-i18n'))).toEqual([
            'input-mode.kmt',
            'input-mode.trackpad',
        ]);
        expect(labels.map(l => l.textContent)).toEqual([
            'Keyboard + Mouse',
            'Trackpad',
        ]);
    });

    it('a click switches to trackpad and remembers it', () => {
        const { preference, toggle, mouseClick } = setup();
        mouseClick();
        expect(preference.get()).toBe('trackpad');
        expect(toggle.getAttribute('aria-checked')).toBe('true');
    });

    it('a second click switches back to keyboard + mouse', () => {
        const { preference, toggle, mouseClick } = setup();
        mouseClick();
        mouseClick();
        expect(preference.get()).toBe('kmt');
        expect(toggle.getAttribute('aria-checked')).toBe('false');
    });

    it('reflects a choice made elsewhere', () => {
        const { preference, toggle } = setup();
        preference.set('trackpad');
        expect(toggle.getAttribute('aria-checked')).toBe('true');
    });

    it('hands focus back to the page after a mouse click, so Space still pans', () => {
        const { toggle, mouseClick } = setup();
        toggle.focus();
        mouseClick();
        expect(document.activeElement).not.toBe(toggle);
    });

    it('keeps focus when switched from the keyboard', () => {
        const { preference, toggle } = setup();
        toggle.focus();
        toggle.dispatchEvent(
            new MouseEvent('click', { bubbles: true, detail: 0 })
        );
        expect(preference.get()).toBe('trackpad');
        expect(document.activeElement).toBe(toggle);
    });
});
