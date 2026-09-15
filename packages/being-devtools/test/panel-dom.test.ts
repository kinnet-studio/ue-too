import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PanelDom, createPanelDom } from '../src/panel-dom';

let dom: JSDOM;
let panel: PanelDom | null = null;

beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    (globalThis as { document?: Document }).document = dom.window.document;
    (globalThis as { HTMLElement?: unknown }).HTMLElement =
        dom.window.HTMLElement;
});

afterEach(() => {
    panel?.destroy();
    panel = null;
    delete (globalThis as { document?: Document }).document;
    delete (globalThis as { HTMLElement?: unknown }).HTMLElement;
});

function wrapOf(p: PanelDom): HTMLElement {
    return p.host.shadowRoot!.querySelector<HTMLElement>('.wrap')!;
}

describe('createPanelDom sidebar', () => {
    it('starts with the sidebar shown', () => {
        panel = createPanelDom({});
        expect(wrapOf(panel).classList.contains('sidebar-hidden')).toBe(false);
    });

    it('hides and shows the sidebar via setSidebarOpen', () => {
        panel = createPanelDom({});
        panel.setSidebarOpen(false);
        expect(wrapOf(panel).classList.contains('sidebar-hidden')).toBe(true);
        panel.setSidebarOpen(true);
        expect(wrapOf(panel).classList.contains('sidebar-hidden')).toBe(false);
    });

    it('exposes the sidebar and a button to bring it back', () => {
        panel = createPanelDom({});
        expect(panel.sidebar.classList.contains('sidebar')).toBe(true);
        expect(panel.showSidebarButton.classList.contains('show-sidebar')).toBe(
            true
        );
    });

    it('labels the close control as a sidebar toggle when inline', () => {
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);
        panel = createPanelDom({ container });
        expect(panel.closeButton.title).toBe('Hide sidebar');
        expect(panel.host.className).toBe('inline');
    });

    it('keeps the close control as a panel close when overlaid', () => {
        panel = createPanelDom({});
        expect(panel.closeButton.title).toBe('Close');
    });
});
