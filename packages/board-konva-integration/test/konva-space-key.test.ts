import {
    DummyKmtInputContext,
    type InputOrchestrator,
    createKmtInputStateMachine,
} from '@ue-too/board';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Stage } from 'konva/lib/Stage';

import { KonvaInputParser } from '../src/konva-input-event-parser';

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
    const container = {
        matches: (selector: string) => selector === ':hover' && hovered,
    };
    const parser = new KonvaInputParser(
        { container: () => container } as unknown as Stage,
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
        press,
        hover: (value: boolean) => {
            hovered = value;
        },
    };
}

describe('KonvaInputParser Space key', () => {
    it('keeps Space over the stage from scrolling the page', () => {
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
});
