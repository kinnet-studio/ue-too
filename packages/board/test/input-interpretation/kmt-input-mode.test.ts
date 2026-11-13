import { describe, expect, it } from 'vitest';

import {
    DummyCanvas,
    KmtOutputEvent,
    ObservableInputTracker,
    createKmtInputStateMachine,
} from '../../src/input-interpretation/input-state-machine';

const plainWheel = { x: 50, y: 50, deltaX: 0, deltaY: 10 };
const twoAxisWheel = { x: 50, y: 50, deltaX: 4, deltaY: 10 };

function setup(inputMode?: 'kmt' | 'trackpad') {
    const tracker = new ObservableInputTracker(new DummyCanvas(), inputMode);
    const machine = createKmtInputStateMachine(tracker);
    const wheel = (payload = plainWheel): KmtOutputEvent => {
        const result = machine.happens('scroll', payload) as {
            output: KmtOutputEvent;
        };
        return result.output;
    };
    const middleClick = () => {
        machine.happens('middlePointerDown', { x: 50, y: 50 });
        machine.happens('middlePointerUp', { x: 50, y: 50 });
    };
    return { tracker, wheel, middleClick };
}

describe('KMT input mode', () => {
    it('starts in keyboard-mouse mode', () => {
        expect(setup().tracker.mode).toBe('kmt');
    });

    it('a plain wheel zooms out of the box', () => {
        expect(setup().wheel().type).toBe('zoom');
    });

    it('can start in trackpad mode', () => {
        const { tracker, wheel } = setup('trackpad');
        expect(tracker.mode).toBe('trackpad');
        expect(wheel().type).toBe('pan');
    });

    it('does not score wheel events unless auto-detection is turned on', () => {
        const { tracker, wheel } = setup();
        wheel(plainWheel);
        wheel(plainWheel);
        expect(tracker.kmtTrackpadTrackScore).toBe(0);
        wheel(twoAxisWheel);
        expect(tracker.kmtTrackpadTrackScore).toBe(0);
    });

    it('a middle click does not change a chosen trackpad mode', () => {
        const { tracker, middleClick } = setup('trackpad');
        middleClick();
        expect(tracker.mode).toBe('trackpad');
    });

    describe('with auto-detection turned on', () => {
        it('is undecided and a plain wheel pans', () => {
            const { tracker, wheel } = setup();
            tracker.enableInputModeDetection();
            expect(tracker.mode).toBe('TBD');
            expect(wheel().type).toBe('pan');
        });

        it('scores wheel events', () => {
            const { tracker, wheel } = setup();
            tracker.enableInputModeDetection();
            wheel(plainWheel);
            expect(tracker.kmtTrackpadTrackScore).toBe(1);
        });

        it('a middle click settles on keyboard-mouse', () => {
            const { tracker, middleClick } = setup('trackpad');
            tracker.enableInputModeDetection();
            middleClick();
            expect(tracker.mode).toBe('kmt');
        });
    });
});
