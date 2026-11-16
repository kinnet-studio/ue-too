// Shared setup for the editor tests: a real Board without a canvas, and
// helpers that feed editor.input the pointer samples a browser would.
import { Board } from '@ue-too/board';
import type { Point } from '@ue-too/math';

import type { Shape } from '../../src/whiteboard/document/types';
import { Editor, type EditorOptions } from '../../src/whiteboard/editor/editor';
import type { PointerSample } from '../../src/whiteboard/editor/events';

export * from './shapes';

// Board's CanvasProxy constructs observers eagerly; with no canvas they never
// observe anything, so no-op stubs let Board run without a DOM
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

export function makeEditor(options: Partial<EditorOptions> = {}): {
    board: Board;
    editor: Editor;
} {
    const board = options.board ?? new Board();
    const editor = new Editor({ ...options, board });
    return { board, editor };
}

let clock = 1000;

export function mouse(
    x: number,
    y: number,
    extra: Partial<PointerSample> = {}
): PointerSample {
    clock += 16;
    return {
        id: 1,
        pointerType: 'mouse',
        button: 0,
        client: { x, y },
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        timeStamp: clock,
        ...extra,
    };
}

export function touch(id: number, x: number, y: number): PointerSample {
    return mouse(x, y, { id, pointerType: 'touch' });
}

/** Lets enough time pass that the next click isn't half of a double click */
export function wait(ms = 1000): void {
    clock += ms;
}

export function click(
    editor: Editor,
    p: Point,
    extra: Partial<PointerSample> = {}
): void {
    editor.input.down(mouse(p.x, p.y, extra));
    editor.input.up(mouse(p.x, p.y, extra));
}

export function dragPath(
    editor: Editor,
    points: Point[],
    extra: Partial<PointerSample> = {}
): void {
    const [first, ...rest] = points;
    editor.input.down(mouse(first!.x, first!.y, extra));
    for (const p of rest) editor.input.move(mouse(p.x, p.y, extra));
    const last = points[points.length - 1]!;
    editor.input.up(mouse(last.x, last.y, extra));
}

/** A press at `from`, ten moves to `to`, and a release there */
export function drag(
    editor: Editor,
    from: Point,
    to: Point,
    extra: Partial<PointerSample> = {}
): void {
    const points = Array.from({ length: 11 }, (_, i) => ({
        x: from.x + ((to.x - from.x) * i) / 10,
        y: from.y + ((to.y - from.y) * i) / 10,
    }));
    dragPath(editor, points, extra);
}

/** The document's only shape */
export function only(editor: Editor): Shape {
    const shapes = editor.document.all();
    if (shapes.length !== 1) {
        throw new Error(`expected one shape, found ${shapes.length}`);
    }
    return shapes[0]!;
}
