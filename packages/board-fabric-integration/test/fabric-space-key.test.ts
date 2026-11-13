import {
    DummyKmtInputContext,
    type InputOrchestrator,
    createKmtInputStateMachine,
} from '@ue-too/board';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { StaticCanvas } from 'fabric';

import { FabricInputEventParser } from '../src/fabric-input-event-parser';

// Only a key aimed at the page (document.body) can mean "pan". The tests run
// without a DOM, so stand in a body for the duration of this file.
const body = { tagName: 'BODY' };
const g = globalThis as Record<string, unknown>;
const previousDocument = g.document;
beforeAll(() => {
    g.document = { body };
});
afterAll(() => {
    g.document = previousDocument;
});

function setup() {
    let hovered = false;
    // An interactive Fabric canvas wraps its two <canvas> layers in one div.
    const wrapperEl = {
        matches: (selector: string) => selector === ':hover' && hovered,
    };
    const parser = new FabricInputEventParser(
        { wrapperEl } as unknown as StaticCanvas,
        createKmtInputStateMachine(new DummyKmtInputContext()),
        { processInputEventOutput() {} } as unknown as InputOrchestrator
    );
    const press = (target: unknown = body) => {
        let prevented = false;
        parser.keydownHandler({
            key: ' ',
            target,
            preventDefault: () => {
                prevented = true;
            },
        } as unknown as KeyboardEvent);
        return prevented;
    };
    return {
        parser,
        press,
        hover: (value: boolean) => {
            hovered = value;
        },
    };
}

describe('FabricInputEventParser Space key', () => {
    it('keeps Space over the canvas from scrolling the page', () => {
        const { press, hover } = setup();
        hover(true);
        expect(press()).toBe(true);
    });

    it('keeps holding Space (key repeat) from scrolling the page', () => {
        const { press, hover } = setup();
        hover(true);
        press();
        expect(press()).toBe(true);
    });

    it('leaves Space to the page when the pointer is elsewhere', () => {
        const { press } = setup();
        expect(press()).toBe(false);
    });

    it('leaves a space typed into a field alone', () => {
        const { press, hover } = setup();
        hover(true);
        expect(press({ tagName: 'INPUT' })).toBe(false);
    });

    it('leaves Space to the page while disabled', () => {
        const { parser, press, hover } = setup();
        hover(true);
        parser.disable();
        expect(press()).toBe(false);
    });
});
