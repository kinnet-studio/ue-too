import { describe, expect, it } from 'vitest';

import {
    TouchInputTracker,
    createTouchInputStateMachine,
} from '../../src/input-interpretation/input-state-machine';
import { DummyCanvas } from '../../src/input-interpretation/input-state-machine/kmt-input-context';

// Canvas at (10, 20), 200 × 100, so its center in the window is (110, 70).
function createMachine(alignCoordinateSystem: boolean) {
    const canvas = new DummyCanvas();
    canvas.position = { x: 10, y: 20 };
    canvas.width = 200;
    canvas.height = 100;
    const tracker = new TouchInputTracker(canvas);
    tracker.alignCoordinateSystem = alignCoordinateSystem;
    const machine = createTouchInputStateMachine(tracker);
    machine.happens('touchstart', {
        points: [
            { ident: 0, x: 100, y: 100 },
            { ident: 1, x: 200, y: 100 },
        ],
    });
    return machine;
}

// Both fingers slide by (+20, +10) without changing their spread.
const SLIDE = [
    { ident: 0, x: 120, y: 110 },
    { ident: 1, x: 220, y: 110 },
];

// Spread goes 100 → 120 around a fixed midpoint at (150, 100).
const SPREAD = [
    { ident: 0, x: 90, y: 100 },
    { ident: 1, x: 210, y: 100 },
];

describe('createTouchInputStateMachine', () => {
    it('pans on the first two-finger move', () => {
        const machine = createMachine(true);
        expect(machine.happens('touchmove', { points: SLIDE })).toMatchObject({
            output: { type: 'pan', delta: { x: -20, y: -10 } },
        });
        expect(machine.currentState).toBe('IN_PROGRESS');
    });

    it('flips the pan y on the first move when the coordinate system is not aligned', () => {
        const machine = createMachine(false);
        expect(machine.happens('touchmove', { points: SLIDE })).toMatchObject({
            output: { type: 'pan', delta: { x: -20, y: 10 } },
        });
    });

    it('flips the zoom anchor y on the first move when the coordinate system is not aligned', () => {
        const machine = createMachine(false);
        expect(machine.happens('touchmove', { points: SPREAD })).toMatchObject({
            output: {
                type: 'zoom',
                anchorPointInViewPort: { x: 40, y: -30 },
            },
        });
    });

    it('gives the same output for the same move whether or not it is the first', () => {
        const first = createMachine(false);
        const firstOutput = (
            first.happens('touchmove', { points: SLIDE }) as {
                output: unknown;
            }
        ).output;

        const later = createMachine(false);
        later.happens('touchmove', {
            points: [
                { ident: 0, x: 100, y: 100 },
                { ident: 1, x: 200, y: 100 },
            ],
        });
        expect(later.currentState).toBe('IN_PROGRESS');
        const laterOutput = (
            later.happens('touchmove', { points: SLIDE }) as {
                output: unknown;
            }
        ).output;

        expect(firstOutput).toEqual(laterOutput);
    });
});
