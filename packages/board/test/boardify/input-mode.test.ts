import { describe, expect, it } from 'vitest';

import Board from '../../src/boardify';

// Board's CanvasProxy constructs ResizeObserver/IntersectionObserver/MutationObserver
// eagerly. With no canvas they never observe anything, so no-op stubs suffice to let
// Board instantiate in a DOM-free test runner. The input-mode logic under test is real.
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

describe('Board input mode', () => {
    it('defaults to keyboard-mouse', () => {
        const board = new Board();
        expect(board.inputMode).toBe('kmt');
    });

    it('inputMode reflects setInputMode("kmt")', () => {
        const board = new Board();
        board.setInputMode('kmt');
        expect(board.inputMode).toBe('kmt');
    });

    it('inputMode reflects setInputMode("trackpad")', () => {
        const board = new Board();
        board.setInputMode('trackpad');
        expect(board.inputMode).toBe('trackpad');
    });

    it('toggleInputMode flips kmt -> trackpad', () => {
        const board = new Board();
        board.setInputMode('kmt');
        board.toggleInputMode();
        expect(board.inputMode).toBe('trackpad');
    });

    it('toggleInputMode flips trackpad -> kmt', () => {
        const board = new Board();
        board.setInputMode('trackpad');
        board.toggleInputMode();
        expect(board.inputMode).toBe('kmt');
    });

    it('toggleInputMode from TBD lands on kmt', () => {
        const board = new Board();
        board.setInputMode('trackpad');
        board.enableAutoInputMode();
        expect(board.inputMode).toBe('TBD');
        board.toggleInputMode();
        expect(board.inputMode).toBe('kmt');
    });

    it('enableAutoInputMode returns to TBD after a manual lock', () => {
        const board = new Board();
        board.setInputMode('kmt');
        expect(board.inputMode).toBe('kmt');
        board.enableAutoInputMode();
        expect(board.inputMode).toBe('TBD');
    });
});
