import { describe, expect, it } from 'vitest';

import { WhiteboardDocument } from '../../src/whiteboard/document/document';
import { busyBoard } from './busy-board';
import { makeEditor, mouse, wait } from './helpers';

// Per-event budgets on the busy board, generous enough for a slow CI machine
// (a 60 FPS frame has 16.7 ms for everything)
const ERASE_MOVE_BUDGET_MS = 6;
const HOVER_BUDGET_MS = 0.7;

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)]!;
}

describe('a busy board stays responsive', () => {
    it('an eraser stroke moving 100 px per event fits the frame budget', () => {
        const { editor } = makeEditor({
            document: new WhiteboardDocument(busyBoard()),
            initialTool: 'eraser',
        });
        const times: number[] = [];
        for (let run = 0; run < 20; run++) {
            const y = 30 + (run % 10) * 120;
            editor.input.down(mouse(0, y));
            editor.input.move(mouse(10, y));
            const started = performance.now();
            editor.input.move(mouse(110, y));
            times.push(performance.now() - started);
            editor.input.cancel();
        }
        expect(median(times)).toBeLessThan(ERASE_MOVE_BUDGET_MS);
    });

    it('hovering with the select tool fits the frame budget', () => {
        const { editor } = makeEditor({
            document: new WhiteboardDocument(busyBoard()),
            initialTool: 'select',
        });
        wait();
        const times: number[] = [];
        for (let i = 0; i < 60; i++) {
            const started = performance.now();
            editor.input.move(mouse(i * 37, (i * 53) % 1200));
            times.push(performance.now() - started);
        }
        expect(median(times)).toBeLessThan(HOVER_BUDGET_MS);
    });

    it('the broad phase still finds what a stroke touches', () => {
        const { editor } = makeEditor({
            document: new WhiteboardDocument(busyBoard()),
            initialTool: 'eraser',
        });
        editor.input.down(mouse(-5, 35));
        editor.input.move(mouse(10, 35));
        editor.input.move(mouse(250, 35));
        expect([...editor.erasing].sort()).toEqual(['s0', 's1', 's2']);
    });
});
