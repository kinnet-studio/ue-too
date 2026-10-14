import { describe, expect, it } from 'vitest';

import {
    DefaultBoardCamera,
    type ZoomLevelLimits,
    createDefaultCameraRig,
} from '../../src/camera';
import {
    DummyKmtInputContext,
    KmtOutputEvent,
    MAX_WHEEL_ZOOM_FACTOR,
    createKmtInputStateMachine,
} from '../../src/input-interpretation/input-state-machine';

/** Drives wheel events through the stock KMT machine into a default camera
 *  rig — the same path a canvas wheel event takes via the orchestrator. */
function setup(
    startZoom: number,
    zoomLevelBoundaries?: ZoomLevelLimits,
    eventName: 'scroll' | 'scrollWithCtrl' = 'scroll'
) {
    const camera = new DefaultBoardCamera({
        zoomLevel: startZoom,
        ...(zoomLevelBoundaries ? { zoomLevelBoundaries } : {}),
    });
    const rig = createDefaultCameraRig(camera);
    const machine = createKmtInputStateMachine(new DummyKmtInputContext());
    const wheel = (deltaY: number) => {
        const result = machine.happens(eventName, {
            x: 50,
            y: 50,
            deltaX: 0,
            deltaY,
        }) as { handled: boolean; output: KmtOutputEvent };
        expect(result.output.type).toBe('zoom');
        if (result.output.type === 'zoom') {
            rig.zoomByAt(
                result.output.delta,
                result.output.anchorPointInViewPort
            );
        }
        return camera.zoomLevel;
    };
    return { wheel };
}

describe('KMT wheel zoom', () => {
    // Windows mouse wheels report deltaY = 100 per notch (3 lines × 33⅓px);
    // other "lines to scroll" settings give multiples of 33⅓.
    for (const deltaY of [100, 66.67, 33.33, 120]) {
        it(`one zoom-out notch (deltaY ${deltaY}) zooms out by at most one step`, () => {
            const { wheel } = setup(20, { min: 1, max: 150 });
            const z = wheel(deltaY);
            expect(z).toBeLessThan(20);
            expect(z).toBeGreaterThanOrEqual(20 / MAX_WHEEL_ZOOM_FACTOR - 1e-9);
        });
    }

    it('one zoom-out notch zooms out under the default zoom limits', () => {
        // Previously the target went negative, the clamp landed a float hair
        // below the 0.1 floor, and setZoomLevel rejected it: no zoom at all.
        for (const startZoom of [5, 7]) {
            const { wheel } = setup(startZoom);
            expect(wheel(100)).toBeLessThan(startZoom);
        }
    });

    it('one zoom-in notch is bounded by the same per-event factor', () => {
        const { wheel } = setup(20, { min: 1, max: 150 });
        expect(wheel(-100)).toBeLessThanOrEqual(
            20 * MAX_WHEEL_ZOOM_FACTOR + 1e-9
        );
    });

    it('a notch in then a notch out returns to the starting zoom', () => {
        for (const deltaY of [100, 120, 40, 4, 0.5]) {
            const { wheel } = setup(20, { min: 1, max: 150 });
            wheel(-deltaY);
            expect(wheel(deltaY)).toBeCloseTo(20, 9);
        }
    });

    it('zoom only ever moves in the wheel direction and stays positive', () => {
        const { wheel } = setup(20, { min: 0.001, max: 150 });
        let prev = 20;
        for (const deltaY of [1, 10, 50, 99, 100, 101, 150, 500]) {
            const z = wheel(deltaY);
            expect(z).toBeLessThan(prev);
            expect(z).toBeGreaterThan(0);
            prev = z;
        }
    });

    it('small trackpad pinch deltas keep their near-linear feel', () => {
        const { wheel } = setup(20, { min: 1, max: 150 }, 'scrollWithCtrl');
        // Pre-fix: zoom × (1 − 0.025 · deltaY) for small deltaY.
        expect(wheel(2) / 20).toBeCloseTo(1 - 0.05, 2);
    });

    it('repeated zoom-out notches still reach the floor', () => {
        const { wheel } = setup(20, { min: 1, max: 150 });
        let z = 20;
        for (let i = 0; i < 100; i++) z = wheel(100);
        expect(z).toBe(1);
    });
});
