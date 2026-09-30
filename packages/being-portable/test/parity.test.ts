import { createVendingMachine } from '@ue-too/being';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { loadMachine } from '../src/api';
import { defineHost } from '../src/host';
import { Doc } from './fixtures';

const say = (text: string) => ({ call: 'say', args: { text } });

/** being's `vending-machine-example.ts`, written as a portable document. */
function vendingExampleDoc(): Doc {
    const events = {
        insertBills: {},
        selectCoke: {},
        selectRedBull: {},
        selectWater: {},
        cancelTransaction: {},
    };
    return {
        format: 'being-machine@1',
        id: 'vendingExample',
        revision: 1,
        context: {},
        events,
        effects: { say: { args: { text: 'string' } } },
        initialState: 'IDLE',
        states: {
            IDLE: {
                on: {
                    insertBills: {
                        do: [say('inserted bills')],
                        target: 'ONE_DOLLAR_INSERTED',
                    },
                },
            },
            ONE_DOLLAR_INSERTED: {
                on: {
                    insertBills: {
                        do: [say('inserted bills')],
                        target: 'TWO_DOLLARS_INSERTED',
                    },
                    selectCoke: {
                        do: [say('selected coke; thank you for your purchase')],
                        target: 'IDLE',
                    },
                    selectRedBull: {
                        do: [
                            say(
                                'selected red bull; not enough money, 1 dollar short, please insert more money'
                            ),
                        ],
                    },
                    selectWater: {
                        do: [
                            say(
                                'selected water; not enough money, 2 dollars short, please insert more money'
                            ),
                        ],
                    },
                    cancelTransaction: {
                        do: [
                            say(
                                'cancelled transaction; refunding 1 dollar; please take your money'
                            ),
                        ],
                        target: 'IDLE',
                    },
                },
            },
            TWO_DOLLARS_INSERTED: {
                on: {
                    insertBills: {
                        do: [say('inserted bills')],
                        target: 'THREE_DOLLARS_INSERTED',
                    },
                    selectCoke: {
                        do: [say('selected coke; thank you for your purchase')],
                        target: 'IDLE',
                    },
                    selectRedBull: {
                        do: [
                            say(
                                'selected red bull; thank you for your purchase'
                            ),
                        ],
                        target: 'IDLE',
                    },
                    selectWater: {
                        do: [
                            say(
                                'selected water; not enough money, 1 dollars short, please insert more money'
                            ),
                        ],
                    },
                    cancelTransaction: {
                        do: [
                            say(
                                'cancelled transaction; refunding 2 dollars; please take your money'
                            ),
                        ],
                        target: 'IDLE',
                    },
                },
            },
            THREE_DOLLARS_INSERTED: {
                on: {
                    insertBills: {
                        do: [
                            say(
                                'not taking more bills; returning the inserted bills'
                            ),
                        ],
                    },
                    selectCoke: {
                        do: [say('selected coke; change: 1 dollar')],
                        target: 'IDLE',
                    },
                    selectRedBull: {
                        do: [say('selected red bull; change: 2 dollars')],
                        target: 'IDLE',
                    },
                    selectWater: { do: [say('selected water; no change')] },
                    cancelTransaction: {
                        do: [
                            say(
                                'cancelled transaction; refunding 3 dollars; please take your money'
                            ),
                        ],
                        target: 'IDLE',
                    },
                },
            },
        },
    };
}

const SEQUENCE = [
    'insertBills',
    'selectWater',
    'insertBills',
    'selectRedBull',
    'insertBills',
    'insertBills',
    'insertBills',
    'insertBills',
    'selectWater',
    'selectCoke',
    'selectCoke',
    'insertBills',
    'cancelTransaction',
];

describe('parity with the hand-written vending example', () => {
    let logSpy: ReturnType<typeof spyOn>;
    beforeEach(() => {
        logSpy = spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => logSpy.mockRestore());

    it('visits the same states and says the same things', () => {
        const original = createVendingMachine();
        const originalStates: string[] = [];
        for (const event of SEQUENCE) {
            original.happens(event as 'insertBills');
            originalStates.push(original.currentState);
        }
        const originalLines = logSpy.mock.calls.map(call => String(call[0]));

        const lines: string[] = [];
        const host = defineHost({
            effects: {
                say: {
                    args: { text: 'string' },
                    run: ({ text }) => {
                        lines.push(text as string);
                    },
                },
            },
        });
        const result = loadMachine(vendingExampleDoc(), host);
        if (!result.ok) throw new Error(JSON.stringify(result.errors));
        const states: string[] = [];
        for (const event of SEQUENCE) {
            result.machine.happens(event);
            states.push(result.machine.currentState);
        }

        expect(states).toEqual(originalStates);
        // every event but the second selectCoke (unhandled in IDLE) says something
        expect(lines).toHaveLength(SEQUENCE.length - 1);
        expect(lines).toEqual(originalLines);
    });
});
