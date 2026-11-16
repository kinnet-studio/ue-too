import { JSDOM, VirtualConsole } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { WhiteboardDocument } from '../../src/whiteboard/document/document';
import { fakePath } from './fake-canvas';
import { click, makeEditor, note, text, wait } from './helpers';

// A DOM canvas whose text measuring we control, and a document.fonts that
// records requests and lets the test announce a font arriving
function domCanvas() {
    const dom = new JSDOM('<!doctype html><body><canvas></canvas></body>', {
        virtualConsole: new VirtualConsole(),
    });
    const doc = dom.window.document;
    const canvas = doc.querySelector('canvas')!;
    const metrics = { charWidth: 10 };
    const create = doc.createElement.bind(doc);
    doc.createElement = ((tag: string) => {
        const element = create(tag);
        if (tag === 'canvas') {
            (element as HTMLCanvasElement).getContext = (() => ({
                font: '',
                measureText: (value: string) => ({
                    width: value.length * metrics.charWidth,
                }),
            })) as unknown as HTMLCanvasElement['getContext'];
        }
        return element;
    }) as typeof doc.createElement;
    const loads: string[] = [];
    const listeners: Record<string, () => void> = {};
    Object.defineProperty(doc, 'fonts', {
        value: {
            load: (font: string) => {
                loads.push(font);
                return Promise.resolve([]);
            },
            addEventListener: (type: string, fn: () => void) =>
                (listeners[type] = fn),
            removeEventListener: () => {},
        },
    });
    return {
        canvas: canvas as unknown as HTMLCanvasElement,
        metrics,
        loads,
        fontsArrive: () => listeners.loadingdone?.(),
    };
}

describe('the handwriting font', () => {
    it('is requested as soon as saved text is on the board', () => {
        const { canvas, loads } = domCanvas();
        makeEditor({ canvas, document: new WhiteboardDocument([note('n')]) });
        expect(loads).toHaveLength(1);
    });

    it('is not requested for a board without text', () => {
        const { canvas, loads } = domCanvas();
        makeEditor({ canvas });
        expect(loads).toEqual([]);
    });

    it('text is measured again once fonts arrive', () => {
        const { canvas, metrics, fontsArrive } = domCanvas();
        const { editor } = makeEditor({
            canvas,
            createPath: fakePath,
            initialTool: 'select',
            document: new WhiteboardDocument([
                text('t', { x: 0, y: 0, text: 'Hello' }),
            ]),
        });
        // Five characters, 10 wide each: a click at x = 80 misses the text
        wait();
        click(editor, { x: 80, y: 10 });
        expect(editor.getState().selection).toEqual([]);
        // The real font is wider
        metrics.charWidth = 20;
        fontsArrive();
        wait();
        click(editor, { x: 80, y: 10 });
        expect(editor.getState().selection).toEqual(['t']);
    });
});
