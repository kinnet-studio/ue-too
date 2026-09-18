import {
    DEFAULT_BOARD_CAMERA_BOUNDARIES,
    DEFAULT_BOARD_CAMERA_ZOOM_BOUNDARIES,
    DefaultBoardCamera,
} from '../../src/camera';

/**
 * A camera must own its limit objects. The in-place mutators
 * (setMin/MaxZoomLevel, setHorizontal/VerticalBoundaries) used to write
 * through to whatever object the camera was constructed or configured with —
 * including the module-level DEFAULT_* constants, so one camera's limits
 * leaked into every camera created after it.
 */
describe('camera option isolation', () => {
    it('setMinZoomLevel does not leak into the default zoom limits or later cameras', () => {
        const a = new DefaultBoardCamera();
        a.setMinZoomLevel(0.5);

        expect(DEFAULT_BOARD_CAMERA_ZOOM_BOUNDARIES).toEqual({ min: 0.1, max: 10 });
        expect(new DefaultBoardCamera().zoomBoundaries).toEqual({ min: 0.1, max: 10 });
        expect(new DefaultBoardCamera({ viewPortWidth: 800 }).zoomBoundaries).toEqual({
            min: 0.1,
            max: 10,
        });
    });

    it('setMaxZoomLevel does not leak into the default zoom limits', () => {
        const a = new DefaultBoardCamera();
        a.setMaxZoomLevel(3);

        expect(DEFAULT_BOARD_CAMERA_ZOOM_BOUNDARIES).toEqual({ min: 0.1, max: 10 });
        expect(new DefaultBoardCamera().zoomBoundaries).toEqual({ min: 0.1, max: 10 });
    });

    it('setHorizontal/VerticalBoundaries do not leak into the default boundaries or later cameras', () => {
        const a = new DefaultBoardCamera();
        a.setHorizontalBoundaries(-5, 5);
        a.setVerticalBoundaries(-7, 7);

        const expected = { min: { x: -10000, y: -10000 }, max: { x: 10000, y: 10000 } };
        expect(DEFAULT_BOARD_CAMERA_BOUNDARIES).toEqual(expected);
        expect(new DefaultBoardCamera().boundaries).toEqual(expected);
    });

    it('does not mutate the objects passed to the constructor', () => {
        const boundaries = { min: { x: -50, y: -50 }, max: { x: 50, y: 50 } };
        const zoomLevelBoundaries = { min: 0.2, max: 4 };
        const camera = new DefaultBoardCamera({ boundaries, zoomLevelBoundaries });

        camera.setMinZoomLevel(0.5);
        camera.setMaxZoomLevel(3);
        camera.setHorizontalBoundaries(-10, 10);
        camera.setVerticalBoundaries(-20, 20);

        expect(boundaries).toEqual({ min: { x: -50, y: -50 }, max: { x: 50, y: 50 } });
        expect(zoomLevelBoundaries).toEqual({ min: 0.2, max: 4 });
        // ...while the camera itself took the new limits.
        expect(camera.zoomBoundaries).toEqual({ min: 0.5, max: 3 });
        expect(camera.boundaries).toEqual({ min: { x: -10, y: -20 }, max: { x: 10, y: 20 } });
    });

    it('does not mutate an object assigned through the boundaries setter', () => {
        const boundaries = { min: { x: -50, y: -50 }, max: { x: 50, y: 50 } };
        const camera = new DefaultBoardCamera();
        camera.boundaries = boundaries;

        camera.setHorizontalBoundaries(-10, 10);

        expect(boundaries).toEqual({ min: { x: -50, y: -50 }, max: { x: 50, y: 50 } });
        expect(camera.boundaries).toEqual({ min: { x: -10, y: -50 }, max: { x: 10, y: 50 } });
    });

    it('normalizes reversed rotation limits without mutating the caller object', () => {
        const limits = { start: 2, end: 1 };
        const camera = new DefaultBoardCamera();
        camera.rotationBoundaries = limits;

        expect(limits).toEqual({ start: 2, end: 1 });
        expect(camera.rotationBoundaries).toEqual({ start: 1, end: 2 });
    });
});
