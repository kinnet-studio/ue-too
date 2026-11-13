import {
    DummyKmtInputContext,
    type InputOrchestrator,
    createKmtInputStateMachine,
} from '@ue-too/board';
import { describe, expect, it } from 'bun:test';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Stage } from 'konva/lib/Stage';

import { KonvaInputParser } from '../src/konva-input-event-parser';

function setup() {
    const outputs: unknown[] = [];
    const parser = new KonvaInputParser(
        {} as Stage,
        createKmtInputStateMachine(new DummyKmtInputContext()),
        {
            processInputEventOutput: (output: unknown) => outputs.push(output),
        } as unknown as InputOrchestrator
    );
    const wheel = (ctrlKey: boolean) => {
        let prevented = false;
        parser.scrollHandler({
            evt: {
                clientX: 10,
                clientY: 10,
                deltaX: 0,
                deltaY: 5,
                ctrlKey,
                preventDefault: () => {
                    prevented = true;
                },
            },
        } as unknown as KonvaEventObject<WheelEvent, Stage>);
        return prevented;
    };
    return { wheel, outputs };
}

describe('KonvaInputParser wheel', () => {
    it('keeps a wheel over the stage from scrolling the page', () => {
        const { wheel, outputs } = setup();
        expect(wheel(false)).toBe(true);
        expect(outputs).toHaveLength(1);
    });

    it('keeps a pinch (Ctrl + wheel) from zooming the browser page', () => {
        const { wheel, outputs } = setup();
        expect(wheel(true)).toBe(true);
        expect(outputs).toHaveLength(1);
    });
});
