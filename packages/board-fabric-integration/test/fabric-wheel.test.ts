import {
    DummyKmtInputContext,
    type InputOrchestrator,
    createKmtInputStateMachine,
} from '@ue-too/board';
import { describe, expect, it } from 'bun:test';
import type { StaticCanvas, TPointerEventInfo } from 'fabric';

import { FabricInputEventParser } from '../src/fabric-input-event-parser';

function setup() {
    const outputs: unknown[] = [];
    const parser = new FabricInputEventParser(
        {} as StaticCanvas,
        createKmtInputStateMachine(new DummyKmtInputContext()),
        {
            processInputEventOutput: (output: unknown) => outputs.push(output),
        } as unknown as InputOrchestrator
    );
    const wheel = (ctrlKey: boolean) => {
        let prevented = false;
        parser.scrollHandler({
            e: {
                clientX: 10,
                clientY: 10,
                deltaX: 0,
                deltaY: 5,
                ctrlKey,
                preventDefault: () => {
                    prevented = true;
                },
            },
        } as unknown as TPointerEventInfo<WheelEvent>);
        return prevented;
    };
    return { parser, wheel, outputs };
}

describe('FabricInputEventParser wheel', () => {
    it('keeps a wheel over the canvas from scrolling the page', () => {
        const { wheel, outputs } = setup();
        expect(wheel(false)).toBe(true);
        expect(outputs).toHaveLength(1);
    });

    it('keeps a pinch (Ctrl + wheel) from zooming the browser page', () => {
        const { wheel, outputs } = setup();
        expect(wheel(true)).toBe(true);
        expect(outputs).toHaveLength(1);
    });

    it('leaves the wheel to the page while disabled', () => {
        const { parser, wheel, outputs } = setup();
        parser.disable();
        expect(wheel(false)).toBe(false);
        expect(outputs).toHaveLength(0);
    });
});
