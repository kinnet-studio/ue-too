import { describe, expect, it } from 'vitest';

import { CanvasProxy } from '../../src/input-interpretation/input-state-machine';

// CanvasProxy constructs ResizeObserver/IntersectionObserver/MutationObserver
// eagerly and reads window.getComputedStyle. No-op stubs are enough to drive it
// in a DOM-free runner, since nothing here depends on real layout.
class NoopObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): unknown[] {
        return [];
    }
}
globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??=
    NoopObserver as unknown as typeof IntersectionObserver;
globalThis.MutationObserver ??=
    NoopObserver as unknown as typeof MutationObserver;

const zeroEdges = {
    paddingLeft: '0px',
    paddingTop: '0px',
    paddingRight: '0px',
    paddingBottom: '0px',
    borderLeftWidth: '0px',
    borderTopWidth: '0px',
    borderRightWidth: '0px',
    borderBottomWidth: '0px',
};

class StubDOMRect {
    readonly top: number;
    readonly left: number;
    readonly right: number;
    readonly bottom: number;
    constructor(
        readonly x = 0,
        readonly y = 0,
        readonly width = 0,
        readonly height = 0
    ) {
        this.top = y;
        this.left = x;
        this.right = x + width;
        this.bottom = y + height;
    }
}
globalThis.DOMRect ??= StubDOMRect as unknown as typeof DOMRect;

const stubMediaQueryList = {
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
};
globalThis.matchMedia ??= (() =>
    stubMediaQueryList) as unknown as typeof matchMedia;

globalThis.window ??= {
    devicePixelRatio: 2,
    getComputedStyle: () => zeroEdges,
    matchMedia: globalThis.matchMedia,
    addEventListener: () => {},
    removeEventListener: () => {},
} as unknown as typeof globalThis.window;

/**
 * A canvas stub reporting `rect` as its laid-out size. `style` mimics a
 * CSSStyleDeclaration closely enough for this: unset properties read back as
 * the empty string, which is what the proxy tests for.
 */
function fakeCanvas(rect: { width: number; height: number }) {
    return {
        width: 300,
        height: 150,
        style: { width: '', height: '', aspectRatio: '' } as Record<
            string,
            string
        >,
        getBoundingClientRect: () => ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: rect.width,
            bottom: rect.height,
            width: rect.width,
            height: rect.height,
        }),
    } as unknown as HTMLCanvasElement & { style: Record<string, string> };
}

describe('CanvasProxy buffer sync', () => {
    it('sizes the canvas from a laid-out measurement', () => {
        const canvas = fakeCanvas({ width: 800, height: 600 });
        const proxy = new CanvasProxy(canvas);

        proxy.setCanvasHeight(600);
        proxy.setCanvasWidth(800);

        expect(canvas.style.height).toBe('600px');
        expect(canvas.style.width).toBe('800px');
        expect(canvas.height).toBe(1200);
        expect(canvas.width).toBe(1600);
    });

    it('ignores a zero measurement instead of writing it to the inline style', () => {
        // A canvas inside a display:none subtree measures 0x0. Writing that
        // zero to style.height is unrecoverable: the element can never be
        // given a height by layout again, and its own size is what gets
        // measured next frame.
        const canvas = fakeCanvas({ width: 0, height: 0 });
        const proxy = new CanvasProxy(canvas);

        proxy.setCanvasHeight(0);
        proxy.setCanvasWidth(0);

        expect(canvas.style.height).toBe('');
        expect(canvas.style.width).toBe('');
    });

    it('never writes a NaN aspect ratio for a zero measurement', () => {
        const canvas = fakeCanvas({ width: 0, height: 0 });
        const proxy = new CanvasProxy(canvas);

        proxy.setCanvasHeight(0);

        expect(canvas.style.aspectRatio).toBe('');
    });

    it('still sizes the canvas once layout gives it a real size', () => {
        // The sequence the bug produced: a zero frame while hidden, then a
        // real measurement once the canvas is shown. The real one must land.
        const canvas = fakeCanvas({ width: 0, height: 0 });
        const proxy = new CanvasProxy(canvas);

        proxy.setCanvasHeight(0);
        proxy.setCanvasWidth(0);
        proxy.setCanvasHeight(868);
        proxy.setCanvasWidth(1102);

        expect(canvas.style.height).toBe('868px');
        expect(canvas.style.width).toBe('1102px');
        expect(canvas.height).toBe(1736);
        expect(canvas.width).toBe(2204);
    });
});
