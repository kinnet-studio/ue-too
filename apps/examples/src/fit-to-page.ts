/** Space kept clear around a fitted canvas, in CSS pixels. */
const GUTTER = 16;
/** On a window too short for everything (a phone held sideways), stop
 *  shrinking here: a tiny canvas is less use than one that runs off-screen. */
const MIN_ROOM_HEIGHT = 200;

export type Size = { width: number; height: number };

/**
 * The largest size with the design's aspect ratio that fits `room`, never
 * larger than the design.
 */
export function fitSize(
    designWidth: number,
    designHeight: number,
    room: Size
): Size {
    const scale = Math.min(
        1,
        room.width / designWidth,
        room.height / designHeight
    );
    const width = Math.floor(designWidth * scale);
    return {
        width,
        height: Math.floor((width * designHeight) / designWidth),
    };
}

function isInFlow(element: Element): boolean {
    const style = getComputedStyle(element);
    return (
        style.display !== 'none' &&
        style.position !== 'absolute' &&
        style.position !== 'fixed'
    );
}

/**
 * The room `graph` has on the page: the window width less a gutter each side,
 * and the window height less a gutter top and bottom, the rest of the
 * page's column (instructions, controls) and the gaps between them.
 */
function roomFor(graph: Element, column: Element): Size {
    const items = [...column.children].filter(isInFlow);
    const others = items.filter(item => !item.contains(graph));
    const othersHeight = others.reduce(
        (sum, item) => sum + item.getBoundingClientRect().height,
        0
    );
    const gaps =
        (parseFloat(getComputedStyle(column).rowGap) || 0) *
        Math.max(0, items.length - 1);
    const style = getComputedStyle(graph);
    const borderX =
        parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const borderY =
        parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    return {
        width: document.documentElement.clientWidth - 2 * GUTTER - borderX,
        height: Math.max(
            MIN_ROOM_HEIGHT,
            window.innerHeight - 2 * GUTTER - othersHeight - gaps - borderY
        ),
    };
}

/**
 * Sizes an example's canvas to fit the window, so the page neither scrolls
 * sideways on a phone nor cuts off its instructions on a short laptop
 * screen: calls `apply` with the fitted size now and again whenever the
 * window or the rest of the page's column changes size.
 *
 * `graph` must sit in the page's `.container` column.
 */
export function fitToPage(
    graph: Element,
    designWidth: number,
    designHeight: number,
    apply: (size: Size) => void
): void {
    const column = graph.closest('.container');
    if (!column) {
        throw new Error('fitToPage: the canvas is not in a .container');
    }
    let current: Size | undefined;
    const fit = () => {
        const size = fitSize(designWidth, designHeight, roomFor(graph, column));
        if (current?.width === size.width && current.height === size.height) {
            return;
        }
        current = size;
        apply(size);
    };
    fit();
    window.addEventListener('resize', fit);
    // The instructions change height when the language changes or the top
    // bar moves onto its own line; the canvas takes what is left.
    const observer = new ResizeObserver(fit);
    for (const item of column.children) {
        if (!item.contains(graph)) observer.observe(item);
    }
}
