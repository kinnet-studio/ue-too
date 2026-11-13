import { afterEach, beforeAll, describe, expect, it, mock } from 'bun:test';
import { JSDOM } from 'jsdom';

// baseInitApp needs a DOM (CanvasProxy measures the canvas, the parsers add
// listeners) and a Pixi Application. A jsdom window covers the first; a fake
// Application covers the second — the input wiring under test is real.
class NoopObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): unknown[] {
        return [];
    }
}

class FakeApplication {
    canvas!: HTMLCanvasElement;
    renderer = { width: 800, height: 600, on() {} };
    stage = {
        localTransform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
        setFromMatrix() {},
    };
    ticker = { add() {} };
    async init(options: { canvas: HTMLCanvasElement }) {
        this.canvas = options.canvas;
    }
}

mock.module('pixi.js', () => ({
    Application: FakeApplication,
    Matrix: class {},
}));

let baseInitApp: typeof import('../src/init-app').baseInitApp;
let document: Document;
const cleanups: (() => void)[] = [];

beforeAll(async () => {
    const dom = new JSDOM('<!doctype html><canvas></canvas>');
    const g = globalThis as Record<string, unknown>;
    g.window = dom.window;
    g.document = dom.window.document;
    g.devicePixelRatio = 1;
    // The parsers hand an AbortSignal to jsdom's addEventListener, which only
    // accepts its own.
    g.AbortController = dom.window.AbortController;
    g.matchMedia = () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
    });
    g.ResizeObserver = NoopObserver;
    g.IntersectionObserver = NoopObserver;
    g.MutationObserver = NoopObserver;
    g.DOMRect ??= class {
        constructor(
            public x = 0,
            public y = 0,
            public width = 0,
            public height = 0
        ) {}
        get left() {
            return this.x;
        }
        get top() {
            return this.y;
        }
    };
    (dom.window as unknown as Record<string, unknown>).ResizeObserver =
        NoopObserver;
    document = dom.window.document;
    ({ baseInitApp } = await import('../src/init-app'));
});

afterEach(() => {
    cleanups.splice(0).forEach(cleanup => cleanup());
});

async function init(option: Parameters<typeof baseInitApp>[1]) {
    const canvas = document.createElement('canvas');
    const components = await baseInitApp(canvas, option);
    cleanups.push(components.cleanup);
    return components;
}

describe('baseInitApp input mode', () => {
    it('starts in keyboard-mouse mode', async () => {
        const { observableInputTracker } = await init({});
        expect(observableInputTracker.mode).toBe('kmt');
    });

    it('starts in the input mode it is given', async () => {
        const { observableInputTracker } = await init({
            inputMode: 'trackpad',
        });
        expect(observableInputTracker.mode).toBe('trackpad');
    });
});
