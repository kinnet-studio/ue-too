import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { InputOrchestrator } from '../../src/input-interpretation/input-orchestrator';
import {
    DummyKmtInputContext,
    createKmtInputStateMachine,
} from '../../src/input-interpretation/input-state-machine';
import { VanillaKMTEventParser } from '../../src/input-interpretation/raw-input-parser';

// The parser only reads keys aimed at the page (document.body). The tests
// run without a DOM, so stand in a body for the duration of this file.
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
    const canvas = {
        matches: (selector: string) => selector === ':hover' && hovered,
        addEventListener() {},
        removeEventListener() {},
    };
    const parser = new VanillaKMTEventParser(
        createKmtInputStateMachine(new DummyKmtInputContext()),
        { processInputEventOutput() {} } as unknown as InputOrchestrator,
        canvas as unknown as HTMLCanvasElement
    );
    const press = (target: unknown = body) => {
        let prevented = false;
        parser.keypressHandler({
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

describe('VanillaKMTEventParser Space key', () => {
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
        const { press, hover } = setup();
        hover(false);
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
