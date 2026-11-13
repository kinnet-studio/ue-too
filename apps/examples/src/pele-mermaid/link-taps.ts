/**
 * How far a finger may wander and still count as a tap, in CSS pixels.
 */
const TAP_SLOP_PX = 10;

/**
 * Makes links inside the stage tappable on touchscreens.
 *
 * The board's touch parser cancels every `touchstart` so the browser doesn't
 * scroll or zoom the page, and that also cancels the click a tap would
 * produce. This listens alongside it and, when a single finger lifts within
 * {@link TAP_SLOP_PX} of where it landed on a link, clicks that link. A drag
 * (which pans) or a second finger (which pinches) cancels the tap.
 */
export function enableLinkTaps(stage: SVGSVGElement): void {
    let tap: { id: number; x: number; y: number; link: Element } | undefined;

    stage.addEventListener(
        'touchstart',
        e => {
            if (e.touches.length !== 1) {
                tap = undefined;
                return;
            }
            const touch = e.changedTouches[0];
            const link =
                touch.target instanceof Element
                    ? touch.target.closest('a')
                    : null;
            tap =
                link !== null && stage.contains(link)
                    ? {
                          id: touch.identifier,
                          x: touch.clientX,
                          y: touch.clientY,
                          link,
                      }
                    : undefined;
        },
        { passive: true }
    );

    stage.addEventListener(
        'touchmove',
        e => {
            const current = tap;
            if (current === undefined) {
                return;
            }
            for (const touch of Array.from(e.changedTouches)) {
                if (
                    touch.identifier === current.id &&
                    Math.hypot(
                        touch.clientX - current.x,
                        touch.clientY - current.y
                    ) > TAP_SLOP_PX
                ) {
                    tap = undefined;
                }
            }
        },
        { passive: true }
    );

    stage.addEventListener(
        'touchend',
        e => {
            const current = tap;
            if (current === undefined || e.touches.length !== 0) {
                return;
            }
            tap = undefined;
            const touch = Array.from(e.changedTouches).find(
                t => t.identifier === current.id
            );
            if (
                touch === undefined ||
                Math.hypot(
                    touch.clientX - current.x,
                    touch.clientY - current.y
                ) > TAP_SLOP_PX
            ) {
                return;
            }
            current.link.dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                })
            );
        },
        { passive: true }
    );

    stage.addEventListener(
        'touchcancel',
        () => {
            tap = undefined;
        },
        { passive: true }
    );
}
