/**
 * Measures `happens()` on a flat and a nested portable machine.
 * Run from the repo root: `bun packages/being-portable/bench/happens.ts`
 */
import { loadMachine } from '../src/api';
import { PortableMachine } from '../src/api-types';
import { defineHost } from '../src/host';
import { gameDoc, vendingDoc } from '../test/fixtures';

const FRAME_MS = 1000 / 60;
const noop = () => {};

const host = defineHost({
    effects: {
        dispense: { args: { item: 'string' }, run: noop },
        refund: { args: { amount: 'number' }, run: noop },
        note: { args: { text: 'string' }, run: noop },
    },
    onError: error => {
        throw new Error(
            `benchmark machine failed: ${error.code} ${error.message}`
        );
    },
});

function load(doc: Record<string, any>): PortableMachine {
    const result = loadMachine(doc, host);
    if (!result.ok) {
        throw new Error(JSON.stringify(result.errors));
    }
    return result.machine;
}

function bench(
    name: string,
    events: [string, unknown?][],
    machine: PortableMachine
) {
    const cycles = 20_000;
    const run = () => {
        for (const [event, payload] of events) {
            machine.happens(event, payload);
        }
    };
    for (let i = 0; i < 1_000; i++) run();
    const start = performance.now();
    for (let i = 0; i < cycles; i++) run();
    const perEvent = (performance.now() - start) / (cycles * events.length);
    console.log(
        `${name}: ${(perEvent * 1000).toFixed(2)} µs per event, ` +
            `${Math.floor(FRAME_MS / perEvent)} events fit in one 60 FPS frame`
    );
}

bench(
    'vending (flat, guards, effects)',
    [['insertCoin', { amount: 2 }], ['insertCoin', { amount: 1 }], ['cancel']],
    load(vendingDoc())
);

const game = gameDoc();
game.states.PLAYING.enter = [];
game.states.PLAYING.exit = [];
bench(
    'game (nested child, with, onDone)',
    [['begin'], ['roll', { value: 3 }]],
    load(game)
);
