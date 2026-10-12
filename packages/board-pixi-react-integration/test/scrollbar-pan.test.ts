import {
    DefaultBoardCamera,
    createDefaultCameraRig,
    getScrollBar,
} from '@ue-too/board';

import {
    scrollBarDragToWorldDelta,
    scrollBarKeyToWorldDelta,
} from '../src/components/canvas/scrollbar-pan';

function setup(zoomLevel = 1) {
    const camera = new DefaultBoardCamera({
        viewPortWidth: 1200,
        viewPortHeight: 800,
        boundaries: {
            min: { x: -5000, y: -5000 },
            max: { x: 5000, y: 5000 },
        },
    });
    camera.setZoomLevel(zoomLevel);
    const rig = createDefaultCameraRig(camera);
    return { camera, rig };
}

describe('scrollBarDragToWorldDelta', () => {
    // The thumb must track the pointer 1:1 regardless of where the canvas sits in
    // the window. The drag is a pointer delta (clientX/Y − previous), which is
    // already in canvas CSS pixels; it used to be run through
    // convertFromWindow2Canvas, which subtracted the canvas's window offset from
    // every move event (with the canvas at (8, 64), each +5px move event moved
    // the vertical thumb −59px).
    it.each([1, 2])(
        'moves both thumbs 1:1 with the pointer over many small move events (zoom %d)',
        zoomLevel => {
            const { camera, rig } = setup(zoomLevel);
            const before = getScrollBar(camera);

            for (let i = 0; i < 10; i++) {
                rig.panByWorld(
                    scrollBarDragToWorldDelta(camera, 'horizontal', 5)
                );
                rig.panByWorld(
                    scrollBarDragToWorldDelta(camera, 'vertical', 5)
                );
            }

            const after = getScrollBar(camera);
            expect(after.horizontal! - before.horizontal!).toBeCloseTo(50);
            expect(after.vertical! - before.vertical!).toBeCloseTo(50);
        }
    );

    it('moves the thumbs back when dragging the other way', () => {
        const { camera, rig } = setup();
        const before = getScrollBar(camera);

        rig.panByWorld(scrollBarDragToWorldDelta(camera, 'horizontal', -30));
        rig.panByWorld(scrollBarDragToWorldDelta(camera, 'vertical', -30));

        const after = getScrollBar(camera);
        expect(after.horizontal! - before.horizontal!).toBeCloseTo(-30);
        expect(after.vertical! - before.vertical!).toBeCloseTo(-30);
    });

    it('only pans along the dragged axis', () => {
        const { camera } = setup();

        expect(scrollBarDragToWorldDelta(camera, 'horizontal', 5).y).toBe(0);
        expect(scrollBarDragToWorldDelta(camera, 'vertical', 5).x).toBe(0);
    });

    it('does not pan without boundaries', () => {
        const { camera } = setup();
        camera.boundaries = undefined;

        expect(scrollBarDragToWorldDelta(camera, 'horizontal', 5)).toEqual({
            x: 0,
            y: 0,
        });
        expect(scrollBarDragToWorldDelta(camera, 'vertical', 5)).toEqual({
            x: 0,
            y: 0,
        });
    });
});

describe('scrollBarKeyToWorldDelta', () => {
    it('Home scrolls the vertical thumb to the top and End to the bottom', () => {
        const { camera, rig } = setup();

        rig.panByWorld(scrollBarKeyToWorldDelta(camera, 'vertical', 'Home')!);
        const atHome = getScrollBar(camera);
        expect(atHome.vertical).toBeCloseTo(0);

        rig.panByWorld(scrollBarKeyToWorldDelta(camera, 'vertical', 'End')!);
        const atEnd = getScrollBar(camera);
        expect(atEnd.vertical! + atEnd.verticalLength!).toBeCloseTo(
            camera.viewPortHeight
        );
    });

    it('Home scrolls the horizontal thumb to the left and End to the right', () => {
        const { camera, rig } = setup();

        rig.panByWorld(scrollBarKeyToWorldDelta(camera, 'horizontal', 'Home')!);
        const atHome = getScrollBar(camera);
        expect(atHome.horizontal).toBeCloseTo(0);

        rig.panByWorld(scrollBarKeyToWorldDelta(camera, 'horizontal', 'End')!);
        const atEnd = getScrollBar(camera);
        expect(atEnd.horizontal! + atEnd.horizontalLength!).toBeCloseTo(
            camera.viewPortWidth
        );
    });

    it('arrow keys step the thumb by 5% of the viewport', () => {
        const { camera, rig } = setup();
        const before = getScrollBar(camera);

        rig.panByWorld(
            scrollBarKeyToWorldDelta(camera, 'horizontal', 'ArrowRight')!
        );
        rig.panByWorld(
            scrollBarKeyToWorldDelta(camera, 'vertical', 'ArrowDown')!
        );
        const forward = getScrollBar(camera);
        expect(forward.horizontal! - before.horizontal!).toBeCloseTo(60);
        expect(forward.vertical! - before.vertical!).toBeCloseTo(40);

        rig.panByWorld(
            scrollBarKeyToWorldDelta(camera, 'horizontal', 'ArrowLeft')!
        );
        rig.panByWorld(
            scrollBarKeyToWorldDelta(camera, 'vertical', 'ArrowUp')!
        );
        const back = getScrollBar(camera);
        expect(back.horizontal).toBeCloseTo(before.horizontal!);
        expect(back.vertical).toBeCloseTo(before.vertical!);
    });

    it("ignores keys that don't belong to the axis", () => {
        const { camera } = setup();

        expect(
            scrollBarKeyToWorldDelta(camera, 'horizontal', 'ArrowDown')
        ).toBeUndefined();
        expect(
            scrollBarKeyToWorldDelta(camera, 'vertical', 'ArrowRight')
        ).toBeUndefined();
        expect(
            scrollBarKeyToWorldDelta(camera, 'vertical', 'a')
        ).toBeUndefined();
    });

    it('ignores keys without boundaries', () => {
        const { camera } = setup();
        camera.boundaries = undefined;

        expect(
            scrollBarKeyToWorldDelta(camera, 'vertical', 'Home')
        ).toBeUndefined();
    });
});
