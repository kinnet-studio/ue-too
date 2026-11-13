import { describe, expect, it } from 'vitest';

import Board from '../../src/boardify';
import {
    createOneFingerPanTouchInputStateMachine,
    createTouchInputStateMachine,
} from '../../src/input-interpretation/input-state-machine';
import { VanillaTouchEventParser } from '../../src/input-interpretation/raw-input-parser';

// Board's CanvasProxy constructs ResizeObserver/IntersectionObserver/MutationObserver
// eagerly. With no canvas they never observe anything, so no-op stubs suffice to let
// Board instantiate in a DOM-free test runner.
class NoopObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): unknown[] {
        return [];
    }
}
globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??=
    NoopObserver as unknown as typeof IntersectionObserver;
globalThis.MutationObserver ??=
    NoopObserver as unknown as typeof MutationObserver;

function touchEvent(
    touches: { identifier: number; clientX: number; clientY: number }[]
): TouchEvent {
    return {
        changedTouches: touches,
        targetTouches: touches,
        touches,
        preventDefault: () => {},
    } as unknown as TouchEvent;
}

describe('Board.setTouchInputStateMachine', () => {
    it('installs and returns the machine the factory builds', () => {
        const board = new Board();
        const machine = board.setTouchInputStateMachine(
            createOneFingerPanTouchInputStateMachine
        );
        expect(machine.possibleStates).toContain('PANNING');
        expect(board.touchParser.stateMachine).toBe(machine);
        expect(board.touchInputStateMachine).toBe(machine);
    });

    it("builds the machine on the board's own touch context", () => {
        const board = new Board();
        const machine = board.setTouchInputStateMachine(
            createOneFingerPanTouchInputStateMachine
        );
        board.alignCoordinateSystem = false;
        expect(machine.context.alignCoordinateSystem).toBe(false);
    });

    it('pans the camera with one finger once the machine is installed', () => {
        const board = new Board();
        board.setTouchInputStateMachine(
            createOneFingerPanTouchInputStateMachine
        );
        const parser = board.touchParser as VanillaTouchEventParser;
        parser.touchstartHandler(
            touchEvent([{ identifier: 0, clientX: 100, clientY: 100 }])
        );
        parser.touchmoveHandler(
            touchEvent([{ identifier: 0, clientX: 130, clientY: 90 }])
        );
        expect(board.camera.position.x).toBeCloseTo(-30);
        expect(board.camera.position.y).toBeCloseTo(10);
    });

    it('zooms the camera with a two-finger pinch once the machine is installed', () => {
        const board = new Board();
        board.setTouchInputStateMachine(
            createOneFingerPanTouchInputStateMachine
        );
        const parser = board.touchParser as VanillaTouchEventParser;
        parser.touchstartHandler(
            touchEvent([
                { identifier: 0, clientX: 100, clientY: 100 },
                { identifier: 1, clientX: 200, clientY: 100 },
            ])
        );
        parser.touchmoveHandler(
            touchEvent([
                { identifier: 0, clientX: 90, clientY: 100 },
                { identifier: 1, clientX: 210, clientY: 100 },
            ])
        );
        expect(board.camera.zoomLevel).toBeCloseTo(1.2);
    });

    it('can switch back to the default touch machine', () => {
        const board = new Board();
        board.setTouchInputStateMachine(
            createOneFingerPanTouchInputStateMachine
        );
        const machine = board.setTouchInputStateMachine(
            createTouchInputStateMachine
        );
        expect(machine.possibleStates).toContain('PENDING');
        expect(board.touchInputStateMachine).toBe(machine);
    });

    it('keeps touch input disabled if it was disabled', () => {
        const board = new Board();
        board.touchParser.disable();
        board.setTouchInputStateMachine(
            createOneFingerPanTouchInputStateMachine
        );
        expect(board.touchParser.disabled).toBe(true);
    });
});
