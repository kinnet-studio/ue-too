import {
    CameraView,
    DEFAULT_ZOOM_PAN_RHO,
    ZoomPanPath,
    createZoomPanPath,
} from '../../src/camera';

const WIDTH = 800;

function samples(path: ZoomPanPath, count: number): CameraView[] {
    const views: CameraView[] = [];
    for (let i = 0; i <= count; i++) {
        views.push(path.at(i / count));
    }
    return views;
}

function minZoom(path: ZoomPanPath): number {
    return Math.min(...samples(path, 200).map(view => view.zoomLevel));
}

function expectViewClose(actual: CameraView, expected: CameraView, digits = 6) {
    expect(actual.position.x).toBeCloseTo(expected.position.x, digits);
    expect(actual.position.y).toBeCloseTo(expected.position.y, digits);
    expect(actual.zoomLevel).toBeCloseTo(expected.zoomLevel, digits);
}

function expectFinite(view: CameraView) {
    expect(Number.isFinite(view.position.x)).toBe(true);
    expect(Number.isFinite(view.position.y)).toBe(true);
    expect(Number.isFinite(view.zoomLevel)).toBe(true);
}

describe('createZoomPanPath', () => {
    const from: CameraView = { position: { x: 0, y: 0 }, zoomLevel: 2 };
    const to: CameraView = { position: { x: 3000, y: -1200 }, zoomLevel: 0.5 };

    it('starts exactly at the start view and ends exactly at the target view', () => {
        const path = createZoomPanPath(from, to, WIDTH);

        expect(path.at(0)).toEqual(from);
        expect(path.at(1)).toEqual(to);
    });

    it('reaches the target view by its own math, not only by snapping at t = 1', () => {
        const path = createZoomPanPath(from, to, WIDTH);

        expectViewClose(path.at(1e-9), from, 4);
        expectViewClose(path.at(1 - 1e-9), to, 4);
    });

    it('clamps progress outside [0, 1] instead of extrapolating', () => {
        const path = createZoomPanPath(from, to, WIDTH);

        expect(path.at(-0.5)).toEqual(path.at(0));
        expect(path.at(1.5)).toEqual(path.at(1));
    });

    it('returns fresh objects, so changing a sample leaves the inputs alone', () => {
        const path = createZoomPanPath(from, to, WIDTH);
        const start = path.at(0);
        start.position.x = 999;

        expect(from.position.x).toBe(0);
        expect(path.at(0).position.x).toBe(0);
    });

    it('only zooms when the position does not change', () => {
        const start: CameraView = { position: { x: 40, y: -20 }, zoomLevel: 1 };
        const end: CameraView = { position: { x: 40, y: -20 }, zoomLevel: 4 };
        const path = createZoomPanPath(start, end, WIDTH);
        const views = samples(path, 20);

        for (const view of views) {
            expect(view.position).toEqual(start.position);
        }
        for (let i = 1; i < views.length; i++) {
            expect(views[i]!.zoomLevel).toBeGreaterThan(
                views[i - 1]!.zoomLevel
            );
        }
        expect(path.length).toBeCloseTo(Math.log(4) / DEFAULT_ZOOM_PAN_RHO, 9);
    });

    it('has zero length and stays put when both views are the same', () => {
        const view: CameraView = { position: { x: 5, y: 7 }, zoomLevel: 1.5 };
        const path = createZoomPanPath(view, view, WIDTH);

        expect(path.length).toBe(0);
        expect(path.at(0.5)).toEqual(view);
    });

    it('zooms out mid-way on a long trip at the same zoom, symmetrically', () => {
        const start: CameraView = { position: { x: 0, y: 0 }, zoomLevel: 1 };
        const end: CameraView = { position: { x: 10000, y: 0 }, zoomLevel: 1 };
        const path = createZoomPanPath(start, end, WIDTH);
        const views = samples(path, 40);

        expect(path.at(0.5).zoomLevel).toBeLessThan(1);
        expect(path.at(0.5).position.x).toBeCloseTo(5000, 6);
        for (let i = 1; i < views.length; i++) {
            expect(views[i]!.position.x).toBeGreaterThan(
                views[i - 1]!.position.x
            );
            expect(views[i]!.position.y).toBe(0);
        }
    });

    it('keeps the camera on the straight line between the two positions', () => {
        const path = createZoomPanPath(from, to, WIDTH);
        const dx = to.position.x - from.position.x;
        const dy = to.position.y - from.position.y;
        const length = Math.hypot(dx, dy);

        for (const view of samples(path, 20)) {
            const ox = view.position.x - from.position.x;
            const oy = view.position.y - from.position.y;
            // Distance off the line, in world units
            expect(Math.abs(ox * dy - oy * dx) / length).toBeLessThan(1e-6);
        }
    });

    it('zooms out further with a higher rho', () => {
        const start: CameraView = { position: { x: 0, y: 0 }, zoomLevel: 1 };
        const end: CameraView = { position: { x: 5000, y: 0 }, zoomLevel: 1 };

        const low = minZoom(createZoomPanPath(start, end, WIDTH, { rho: 1 }));
        const high = minZoom(createZoomPanPath(start, end, WIDTH, { rho: 2 }));

        expect(high).toBeLessThan(low);
    });

    it('moves at constant perceived speed (the paper arc-length condition)', () => {
        const rho = DEFAULT_ZOOM_PAN_RHO;
        const path = createZoomPanPath(from, to, WIDTH);
        const dx = to.position.x - from.position.x;
        const dy = to.position.y - from.position.y;
        const distance = Math.hypot(dx, dy);
        // u: distance travelled along the line; w: visible world width
        const uw = (t: number) => {
            const view = path.at(t);
            const u =
                ((view.position.x - from.position.x) * dx +
                    (view.position.y - from.position.y) * dy) /
                distance;
            return { u, w: WIDTH / view.zoomLevel };
        };
        const h = 1e-6;

        for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
            const before = uw(t - h);
            const after = uw(t + h);
            const du = (after.u - before.u) / (2 * h);
            const dw = (after.w - before.w) / (2 * h);
            const { w } = uw(t);
            // rho^2 u'^2 + w'^2 / rho^2 = w^2 S^2, with t = s / S
            const speed = rho * rho * du * du + (dw * dw) / (rho * rho);
            const expected = w * w * path.length * path.length;
            expect(Math.abs(speed - expected) / expected).toBeLessThan(1e-4);
        }
    });

    it('stays finite on a very long trip', () => {
        const start: CameraView = { position: { x: 0, y: 0 }, zoomLevel: 1 };
        const end: CameraView = { position: { x: 1e7, y: 0 }, zoomLevel: 1 };
        const path = createZoomPanPath(start, end, WIDTH);

        expect(Number.isFinite(path.length)).toBe(true);
        samples(path, 50).forEach(expectFinite);
        expect(path.at(1)).toEqual(end);
    });

    it('behaves like a pure zoom when the pan is tiny', () => {
        const start: CameraView = { position: { x: 0, y: 0 }, zoomLevel: 1 };
        for (const pan of [1e-7, 1e-3]) {
            const end: CameraView = {
                position: { x: pan, y: 0 },
                zoomLevel: 2,
            };
            const path = createZoomPanPath(start, end, WIDTH);

            samples(path, 50).forEach(expectFinite);
            expect(path.length).toBeCloseTo(
                Math.log(2) / DEFAULT_ZOOM_PAN_RHO,
                6
            );
            const middle = path.at(0.5);
            expect(middle.zoomLevel).toBeCloseTo(Math.SQRT2, 6);
            expect(middle.position.x).toBeGreaterThanOrEqual(0);
            expect(middle.position.x).toBeLessThanOrEqual(pan);
            expect(middle.position.y).toBe(0);
        }
    });

    it('rejects a viewport width that is not a positive finite number', () => {
        for (const width of [0, -1, NaN, Infinity]) {
            expect(() => createZoomPanPath(from, to, width)).toThrow(
                RangeError
            );
        }
    });

    it('rejects a zoom level that is not a positive finite number', () => {
        for (const zoomLevel of [0, -1, NaN, Infinity]) {
            const bad: CameraView = { position: { x: 0, y: 0 }, zoomLevel };
            expect(() => createZoomPanPath(bad, to, WIDTH)).toThrow(RangeError);
            expect(() => createZoomPanPath(from, bad, WIDTH)).toThrow(
                RangeError
            );
        }
    });

    it('rejects a position that is not finite', () => {
        for (const bad of [NaN, Infinity, -Infinity]) {
            const badX: CameraView = {
                position: { x: bad, y: 0 },
                zoomLevel: 1,
            };
            const badY: CameraView = {
                position: { x: 0, y: bad },
                zoomLevel: 1,
            };
            for (const view of [badX, badY]) {
                expect(() => createZoomPanPath(view, to, WIDTH)).toThrow(
                    RangeError
                );
                expect(() => createZoomPanPath(from, view, WIDTH)).toThrow(
                    RangeError
                );
            }
        }
    });

    it('rejects a rho that is not a positive finite number', () => {
        for (const rho of [0, -1, NaN]) {
            expect(() => createZoomPanPath(from, to, WIDTH, { rho })).toThrow(
                RangeError
            );
        }
    });
});
