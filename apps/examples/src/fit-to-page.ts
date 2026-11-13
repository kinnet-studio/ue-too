/** Space kept clear on each side of a fitted canvas, in CSS pixels. */
const GUTTER = 16;

export type Size = { width: number; height: number };

/**
 * The largest size with the design's aspect ratio that fits a page
 * `pageWidth` wide (less a gutter each side), never larger than the design.
 */
export function fitSize(
    designWidth: number,
    designHeight: number,
    pageWidth: number
): Size {
    const width = Math.floor(Math.min(designWidth, pageWidth - 2 * GUTTER));
    return {
        width,
        height: Math.floor((width * designHeight) / designWidth),
    };
}

/**
 * Sizes a canvas that its library needs in pixels (Konva, Fabric, a plain
 * SVG) to fit the page: calls `apply` with the fitted size now and again
 * whenever the window resize changes it.
 *
 * Canvases driven by `Board` don't need this: give them a CSS size such as
 * `width: min(800px, calc(100vw - 32px)); aspect-ratio: 4 / 3` and the board
 * follows it.
 */
export function fitToPage(
    designWidth: number,
    designHeight: number,
    apply: (size: Size) => void
): void {
    let current: Size | undefined;
    const fit = () => {
        const size = fitSize(
            designWidth,
            designHeight,
            document.documentElement.clientWidth
        );
        if (current?.width === size.width && current.height === size.height) {
            return;
        }
        current = size;
        apply(size);
    };
    fit();
    window.addEventListener('resize', fit);
}
