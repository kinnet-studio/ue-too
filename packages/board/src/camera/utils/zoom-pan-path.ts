import { Point } from '@ue-too/math';

/**
 * Where the camera is and how far it is zoomed in.
 *
 * @property position - Camera center in world coordinates
 * @property zoomLevel - Zoom level (1 = 100%, must be greater than 0)
 *
 * @category Camera
 */
export type CameraView = { position: Point; zoomLevel: number };

/**
 * Options for {@link createZoomPanPath}.
 *
 * @property rho - How much the path zooms out to travel. Higher values zoom out
 * further and pan less; must be greater than 0. Defaults to
 * {@link DEFAULT_ZOOM_PAN_RHO}.
 *
 * @category Camera
 */
export type ZoomPanPathOptions = { rho?: number };

/**
 * A smooth camera path between two views, made by {@link createZoomPanPath}.
 *
 * @category Camera
 */
export type ZoomPanPath = {
    /**
     * How long the trip feels, in the metric of Van Wijk & Nuij's paper.
     * A longer or deeper trip gives a bigger number, so it can scale an
     * animation's duration. It is 0 when both views are the same.
     */
    readonly length: number;
    /**
     * The camera view at progress `t`.
     *
     * @param t - Progress from 0 (start view) to 1 (target view). Values
     * outside that range are clamped. Equal steps of `t` look like equal
     * amounts of motion, so layer any easing on top of `t`.
     * @returns A new view object; `at(0)` is exactly the start view and
     * `at(1)` exactly the target view.
     */
    at(t: number): CameraView;
};

/**
 * Default zoom/pan trade-off for {@link createZoomPanPath}: about 1.42, the
 * average from the user study in Van Wijk & Nuij's paper.
 *
 * @category Camera
 */
export const DEFAULT_ZOOM_PAN_RHO = 1.42;

function assertPositiveFinite(value: number, name: string): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(
            `${name} must be a positive finite number, got ${value}`
        );
    }
}

/**
 * Creates a smooth zoom-and-pan camera path between two views.
 *
 * @param from - Start view
 * @param to - Target view
 * @param viewPortWidth - Width of the viewport in CSS pixels
 * (`camera.viewPortWidth`). The visible world width is
 * `viewPortWidth / zoomLevel`, which sets how far the path zooms out.
 * @param options - See {@link ZoomPanPathOptions}
 * @returns The path; sample it with {@link ZoomPanPath.at}
 * @throws RangeError if `viewPortWidth`, either zoom level or `rho` is not a
 * positive finite number
 *
 * @remarks
 * Moving the camera and changing its zoom at the same rate looks wrong: the
 * zoom outruns the pan and the target drifts off screen before snapping back.
 * This follows Van Wijk & Nuij, "Smooth and efficient zooming and panning"
 * (2003): on a long trip the camera zooms out, glides across, and zooms back
 * in, so the viewer keeps their bearings. The path is the shortest one in the
 * paper's metric and moves at a constant perceived speed. Rotation is not
 * part of the path.
 *
 * The function only computes views; drive it with your own frame loop and
 * apply each view to the camera. With {@link CameraMuxWithAnimationAndLock},
 * start the flight with `initatePanTransition()` and
 * `initateZoomTransition()`, then on each frame report the view through
 * `notifyZoomInputAnimation()` and `notifyPanToAnimationInput()` and apply it
 * with the camera rig. The camera's zoom and position limits still apply: a
 * path that zooms out past the minimum zoom is clamped there.
 *
 * @example
 * ```typescript
 * const camera = board.camera;
 * const path = createZoomPanPath(
 *     { position: camera.position, zoomLevel: camera.zoomLevel },
 *     { position: { x: 5000, y: 0 }, zoomLevel: 2 },
 *     camera.viewPortWidth
 * );
 *
 * const duration = 1000;
 * const startTime = performance.now();
 * function frame(now: number) {
 *     const t = Math.min(1, (now - startTime) / duration);
 *     const eased = (1 - Math.cos(Math.PI * t)) / 2;
 *     const view = path.at(eased);
 *     rig.zoomTo(view.zoomLevel);
 *     rig.panToWorld(view.position);
 *     if (t < 1) requestAnimationFrame(frame);
 * }
 * requestAnimationFrame(frame);
 * ```
 *
 * @category Camera
 */
export function createZoomPanPath(
    from: CameraView,
    to: CameraView,
    viewPortWidth: number,
    options: ZoomPanPathOptions = {}
): ZoomPanPath {
    const rho = options.rho ?? DEFAULT_ZOOM_PAN_RHO;
    assertPositiveFinite(viewPortWidth, 'viewPortWidth');
    assertPositiveFinite(from.zoomLevel, 'from.zoomLevel');
    assertPositiveFinite(to.zoomLevel, 'to.zoomLevel');
    assertPositiveFinite(rho, 'rho');

    const start: CameraView = {
        position: { x: from.position.x, y: from.position.y },
        zoomLevel: from.zoomLevel,
    };
    const end: CameraView = {
        position: { x: to.position.x, y: to.position.y },
        zoomLevel: to.zoomLevel,
    };

    // The paper works in (u, w): u is the distance travelled along the
    // straight line from start to end, w the visible world width
    const dx = end.position.x - start.position.x;
    const dy = end.position.y - start.position.y;
    const distance = Math.hypot(dx, dy);
    const w0 = viewPortWidth / start.zoomLevel;
    const w1 = viewPortWidth / end.zoomLevel;
    const rho2 = rho * rho;

    let length: number;
    let u: (s: number) => number;
    let w: (s: number) => number;

    if (distance <= 1e-9 * Math.max(w0, w1)) {
        // No pan to speak of: zoom at a constant perceived speed. The general
        // formula below divides by the distance, so it can't handle this.
        const k = w1 < w0 ? -1 : 1;
        length = Math.abs(Math.log(w1 / w0)) / rho;
        u = s => (length === 0 ? 0 : (distance * s) / length);
        w = s => w0 * Math.exp(k * rho * s);
    } else {
        const b0 =
            (w1 * w1 - w0 * w0 + rho2 * rho2 * distance * distance) /
            (2 * w0 * rho2 * distance);
        const b1 =
            (w1 * w1 - w0 * w0 - rho2 * rho2 * distance * distance) /
            (2 * w1 * rho2 * distance);
        // The paper's r = ln(-b + sqrt(b^2 + 1)), which loses precision for
        // large b; it equals asinh(-b)
        const r0 = -Math.asinh(b0);
        const r1 = -Math.asinh(b1);
        const coshR0 = Math.cosh(r0);
        const sinhR0 = Math.sinh(r0);
        length = (r1 - r0) / rho;
        u = s => (w0 / rho2) * (coshR0 * Math.tanh(rho * s + r0) - sinhR0);
        w = s => (w0 * coshR0) / Math.cosh(rho * s + r0);
    }

    return {
        length,
        at(t: number): CameraView {
            if (!(t > 0)) {
                return {
                    position: { ...start.position },
                    zoomLevel: start.zoomLevel,
                };
            }
            if (t >= 1) {
                return {
                    position: { ...end.position },
                    zoomLevel: end.zoomLevel,
                };
            }
            const s = t * length;
            const fraction = distance === 0 ? 0 : u(s) / distance;
            return {
                position: {
                    x: start.position.x + dx * fraction,
                    y: start.position.y + dy * fraction,
                },
                zoomLevel: viewPortWidth / w(s),
            };
        },
    };
}
