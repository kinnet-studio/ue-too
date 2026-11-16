import { describe, expect, it } from 'vitest';

import type { ToolPointer } from '../../src/whiteboard/editor/events';
import {
    PointerInput,
    type PointerInputDeps,
} from '../../src/whiteboard/editor/pointer-input';
import { mouse, touch, wait } from './helpers';

function setup(overrides: Partial<PointerInputDeps> = {}) {
    const events: { name: string; payload: ToolPointer | {} }[] = [];
    const middle: ToolPointer[] = [];
    const cursors: (string | null)[] = [];
    const input = new PointerInput({
        toWorld: client => ({ x: client.x / 2, y: client.y / 2 }),
        boardBusy: () => false,
        ownsPointer: () => false,
        dispatch: (name, payload) => events.push({ name, payload }),
        middleClick: pointer => middle.push(pointer),
        setCursor: cursor => cursors.push(cursor),
        ...overrides,
    });
    const names = () => events.map(e => e.name);
    const last = () => events[events.length - 1]!.payload as ToolPointer;
    return { input, events, names, last, middle, cursors };
}

describe('PointerInput', () => {
    it('a press within the slop is a click', () => {
        wait();
        const { input, names, events } = setup();
        input.down(mouse(0, 0));
        input.move(mouse(3, 0));
        input.up(mouse(3, 0));
        expect(names()).toEqual(['pointerDown', 'pointerMove', 'pointerUp']);
        const move = events[1]!.payload as ToolPointer;
        expect(move.dragging).toBe(false);
        expect(move.pressed).toBe(true);
        expect(move.delta).toEqual({ x: 0, y: 0 });
    });

    it('converts to world coordinates', () => {
        const { input, last } = setup();
        input.down(mouse(10, 20));
        expect(last().world).toEqual({ x: 5, y: 10 });
        expect(last().client).toEqual({ x: 10, y: 20 });
    });

    it('the first drag move measures from the press', () => {
        const { input, last } = setup();
        input.down(mouse(0, 0));
        input.move(mouse(3, 0));
        input.move(mouse(8, 0));
        expect(last().dragging).toBe(true);
        expect(last().delta).toEqual({ x: 8, y: 0 });
        input.move(mouse(10, 1));
        expect(last().delta).toEqual({ x: 2, y: 1 });
    });

    it('stays dragging once past the slop', () => {
        const { input, last } = setup();
        input.down(mouse(0, 0));
        input.move(mouse(20, 0));
        input.move(mouse(1, 0));
        expect(last().dragging).toBe(true);
        input.up(mouse(1, 0));
        expect(last().dragging).toBe(true);
    });

    it('a second finger cancels and swallows', () => {
        const { input, names } = setup();
        input.down(touch(1, 0, 0));
        input.move(touch(1, 10, 0));
        input.down(touch(2, 50, 50));
        input.move(touch(1, 20, 0));
        input.up(touch(1, 20, 0));
        input.up(touch(2, 50, 50));
        expect(names()).toEqual(['pointerDown', 'pointerMove', 'cancel']);
        input.down(touch(3, 0, 0));
        expect(names().at(-1)).toBe('pointerDown');
    });

    it('stands aside while the board is busy', () => {
        const { input, names } = setup({ boardBusy: () => true });
        input.down(mouse(0, 0));
        input.move(mouse(30, 0));
        input.up(mouse(30, 0));
        expect(names()).toEqual([]);
    });

    it('screen controls own their presses', () => {
        const { input, names, cursors } = setup({
            ownsPointer: client => client.x > 100,
        });
        input.down(mouse(150, 0));
        input.move(mouse(160, 0));
        input.up(mouse(160, 0));
        expect(names()).toEqual([]);
        input.move(mouse(150, 0));
        expect(cursors.at(-1)).toBe('pointer');
        expect(names()).toEqual([]);
        input.move(mouse(10, 0));
        expect(cursors.at(-1)).toBe(null);
        expect(names()).toEqual(['pointerMove']);
    });

    it('hover moves report pressed: false', () => {
        const { input, last } = setup();
        input.move(mouse(4, 4));
        expect(last().pressed).toBe(false);
        expect(last().dragging).toBe(false);
    });

    it('touch moves without a press are not hovers', () => {
        const { input, names } = setup();
        input.move(touch(1, 4, 4));
        expect(names()).toEqual([]);
    });

    it('lost capture cancels', () => {
        const { input, names } = setup();
        input.down(mouse(0, 0));
        input.move(mouse(20, 0));
        input.lostCapture(1);
        expect(names().at(-1)).toBe('cancel');
        input.up(mouse(20, 0));
        expect(names().at(-1)).toBe('cancel');
    });

    it('cancel ends the gesture and forgets every pointer', () => {
        const { input, names } = setup();
        input.down(touch(1, 0, 0));
        input.cancel();
        expect(names()).toEqual(['pointerDown', 'cancel']);
        input.down(touch(2, 0, 0));
        expect(names().at(-1)).toBe('pointerDown');
    });

    it('double click', () => {
        wait();
        const { input, names } = setup();
        input.down(mouse(0, 0));
        input.up(mouse(0, 0));
        input.down(mouse(2, 0));
        input.up(mouse(2, 0));
        expect(names().filter(n => n === 'doubleClick')).toHaveLength(1);
        expect(names().at(-1)).toBe('doubleClick');
        wait(500);
        input.down(mouse(2, 0));
        input.up(mouse(2, 0));
        wait(500);
        input.down(mouse(2, 0));
        input.up(mouse(2, 0));
        expect(names().filter(n => n === 'doubleClick')).toHaveLength(1);
    });

    it('a drag is never half of a double click', () => {
        wait();
        const { input, names } = setup();
        input.down(mouse(0, 0));
        input.move(mouse(30, 0));
        input.up(mouse(30, 0));
        input.down(mouse(30, 0));
        input.up(mouse(30, 0));
        expect(names()).not.toContain('doubleClick');
    });

    it('middle click reports, middle drag does not', () => {
        const { input, middle, names } = setup();
        input.down(mouse(5, 5, { button: 1 }));
        input.up(mouse(5, 5, { button: 1 }));
        expect(middle).toHaveLength(1);
        expect(middle[0]!.button).toBe(1);
        input.down(mouse(5, 5, { button: 1 }));
        input.move(mouse(15, 5, { button: 1 }));
        input.up(mouse(15, 5, { button: 1 }));
        expect(middle).toHaveLength(1);
        expect(names()).toEqual([]);
    });

    it('ignores the right button', () => {
        const { input, names } = setup();
        input.down(mouse(5, 5, { button: 2 }));
        input.up(mouse(5, 5, { button: 2 }));
        expect(names()).toEqual([]);
    });
});
