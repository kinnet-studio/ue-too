import { describe, expect, it } from 'vitest';

import { loadMachine } from '../src/api';
import { PortableMachine } from '../src/api-types';
import { Doc, gameDoc, vendingDoc } from './fixtures';
import { recordingHost } from './recording-host';

function load(doc: Doc, options = {}): PortableMachine {
    const result = loadMachine(doc, recordingHost().host, options);
    if (!result.ok) {
        throw new Error(JSON.stringify(result.errors));
    }
    return result.machine;
}

const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('snapshot', () => {
    it('captures state and context as JSON', () => {
        const machine = load(vendingDoc());
        machine.happens('insertCoin', { amount: 3 });
        const snapshot = machine.snapshot();
        expect(snapshot).toEqual({
            format: 'being-snapshot@1',
            machine: { id: 'vending', revision: 1 },
            state: 'HAS_MONEY',
            context: { balance: 3, sold: [] },
        });
        expect(roundTrip(snapshot)).toEqual(snapshot);
    });

    it('includes the running child only', () => {
        const machine = load(gameDoc());
        expect(machine.snapshot().child).toBeUndefined();
        machine.happens('begin');
        expect(machine.snapshot().child).toEqual({
            state: 'ROLLING',
            context: { points: 0, playerCount: 2 },
        });
    });

    it('refuses to snapshot or restore during an event', () => {
        const machine = load(vendingDoc());
        let thrown = '';
        let restored: unknown = null;
        machine.onHappens(() => {
            try {
                machine.snapshot();
            } catch (error) {
                thrown = (error as Error).message;
            }
            restored = machine.restore({});
        });
        machine.happens('insertCoin', { amount: 1 });
        expect(thrown).toMatch(/^reentrant-call/);
        expect(restored).toMatchObject({
            ok: false,
            errors: [{ code: 'reentrant-call' }],
        });
    });

    it('captures an unstarted machine', () => {
        const machine = load(vendingDoc(), { autoStart: false });
        expect(machine.snapshot().state).toBe('INITIAL');
    });
});

describe('restore', () => {
    it('continues exactly like an uninterrupted run', () => {
        const events: [string, unknown?][] = [
            ['begin'],
            ['roll', { value: 3 }],
            ['begin'],
        ];
        const later: [string, unknown?][] = [['roll', { value: 5 }], ['begin']];

        const uninterrupted = load(gameDoc());
        for (const [event, payload] of [...events, ...later]) {
            uninterrupted.happens(event, payload);
        }

        const first = load(gameDoc());
        for (const [event, payload] of events) {
            first.happens(event, payload);
        }
        const text = JSON.stringify(first.snapshot());
        const resumed = loadMachine(gameDoc(), recordingHost().host, {
            snapshot: JSON.parse(text),
        });
        if (!resumed.ok) throw new Error(JSON.stringify(resumed.errors));
        for (const [event, payload] of later) {
            resumed.machine.happens(event, payload);
        }
        expect(resumed.machine.snapshot()).toEqual(uninterrupted.snapshot());
        expect(resumed.restoreReport).toEqual({ dropped: [], defaulted: [] });
    });

    it('runs no statements, calls no effects and notifies no one', () => {
        const source = load(gameDoc());
        source.happens('begin');
        const recorder = recordingHost();
        const result = loadMachine(gameDoc(), recorder.host, {
            autoStart: false,
        });
        if (!result.ok) throw new Error('load failed');
        let notified = false;
        result.machine.onStateChange(() => (notified = true));
        expect(result.machine.restore(source.snapshot()).ok).toBe(true);
        expect(result.machine.currentState).toBe('PLAYING');
        expect(recorder.calls).toEqual([]);
        expect(notified).toBe(false);
        expect(result.machine.context.get('log')).toEqual(['enter PLAYING']);
    });

    it('rejects a snapshot of another machine or revision in strict mode', () => {
        const machine = load(vendingDoc());
        const snapshot = roundTrip(machine.snapshot()) as any;
        expect(
            machine.restore({
                ...snapshot,
                machine: { id: 'other', revision: 1 },
            })
        ).toMatchObject({ ok: false, errors: [{ code: 'machine-mismatch' }] });
        expect(
            machine.restore({
                ...snapshot,
                machine: { id: 'vending', revision: 2 },
            })
        ).toMatchObject({ ok: false, errors: [{ code: 'revision-mismatch' }] });
        expect(
            machine.restore({ ...snapshot, format: 'being-snapshot@9' })
        ).toMatchObject({
            ok: false,
            errors: [{ code: 'unsupported-format' }],
        });
    });

    it('checks states, fields and children', () => {
        const machine = load(gameDoc());
        machine.happens('begin');
        const snapshot = roundTrip(machine.snapshot()) as any;

        const cases: [any, string, string][] = [
            [{ ...snapshot, state: 'MOON' }, 'state-missing', 'state'],
            [
                { ...snapshot, context: { ...snapshot.context, score: 'x' } },
                'field-mismatch',
                'context.score',
            ],
            [
                { ...snapshot, context: { ...snapshot.context, extra: 1 } },
                'field-mismatch',
                'context.extra',
            ],
            [{ ...snapshot, child: undefined }, 'child-missing', 'child'],
            [{ ...snapshot, state: 'LOBBY' }, 'child-unexpected', 'child'],
            [
                { ...snapshot, child: { ...snapshot.child, state: 'INITIAL' } },
                'state-missing',
                'child.state',
            ],
        ];
        for (const [input, code, path] of cases) {
            const clean = roundTrip(input);
            expect(machine.restore(clean)).toMatchObject({
                ok: false,
                errors: [{ code, path }],
            });
        }
    });

    it('changes nothing when it fails', () => {
        const machine = load(vendingDoc());
        machine.happens('insertCoin', { amount: 3 });
        const before = machine.snapshot();
        const bad = {
            ...roundTrip(before),
            state: 'IDLE',
            context: { balance: 'x', sold: [] },
        };
        expect(machine.restore(bad).ok).toBe(false);
        expect(machine.snapshot()).toEqual(before);
    });

    it('reports at most 1000 errors', () => {
        const machine = load(vendingDoc());
        const context: Record<string, number> = { balance: 0 };
        for (let i = 0; i < 1500; i++) {
            context[`x${i}`] = 1;
        }
        const result = machine.restore({
            format: 'being-snapshot@1',
            machine: { id: 'vending', revision: 1 },
            state: 'IDLE',
            context,
        });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors).toHaveLength(1001);
        expect(result.errors[1000]).toMatchObject({
            code: 'limit-exceeded',
            path: '',
        });
        expect(result.errors[1000].message).toContain('501 more errors');
    });

    it('rejects values past the limits', () => {
        const result = loadMachine(
            vendingDoc(),
            recordingHost({ limits: { maxListLength: 2 } }).host,
            {
                snapshot: {
                    format: 'being-snapshot@1',
                    machine: { id: 'vending', revision: 1 },
                    state: 'IDLE',
                    context: { balance: 0, sold: ['a', 'b', 'c'] },
                },
            }
        );
        expect(result).toMatchObject({
            ok: false,
            errors: [{ code: 'limit-exceeded', path: 'context.sold' }],
        });
    });
});

describe('structural restore', () => {
    function revisionTwo(): Doc {
        const doc = gameDoc();
        doc.revision = 2;
        delete doc.context.log;
        doc.states.PLAYING.enter = [];
        doc.states.PLAYING.exit = [];
        doc.context.score = { type: 'string', initial: 'none' };
        doc.states.PLAYING.onDone.do = [{ set: 'score', to: 'finished' }];
        doc.context.round = { type: 'number', initial: 1 };
        return doc;
    }

    it('keeps what fits, defaults what is new and drops the rest', () => {
        const machine = load(gameDoc());
        machine.happens('begin');
        const snapshot = machine.snapshot();

        expect(
            loadMachine(revisionTwo(), recordingHost().host, { snapshot })
        ).toMatchObject({ ok: false, errors: [{ code: 'revision-mismatch' }] });

        const result = loadMachine(revisionTwo(), recordingHost().host, {
            snapshot,
            restoreMode: 'structural',
        });
        if (!result.ok) throw new Error(JSON.stringify(result.errors));
        expect(result.restoreReport).toEqual({
            dropped: ['context.score', 'context.log'],
            defaulted: ['context.score', 'context.round'],
        });
        expect(result.machine.context.fields()).toEqual({
            players: 2,
            score: 'none',
            round: 1,
        });
        expect(result.machine.currentState).toBe('PLAYING');
    });

    it('drops a child the state no longer has', () => {
        const machine = load(gameDoc());
        machine.happens('begin');
        const doc = gameDoc();
        doc.revision = 2;
        delete doc.states.PLAYING.child;
        delete doc.states.PLAYING.onDone;
        const result = loadMachine(doc, recordingHost().host, {
            snapshot: machine.snapshot(),
            restoreMode: 'structural',
        });
        if (!result.ok) throw new Error(JSON.stringify(result.errors));
        expect(result.restoreReport?.dropped).toEqual(['child']);
    });

    it('still fails when the state is gone or a child would have to start', () => {
        const machine = load(gameDoc());
        machine.happens('begin');
        const snapshot = roundTrip(machine.snapshot()) as any;

        const gone = gameDoc();
        gone.revision = 2;
        gone.states.PLAYING2 = gone.states.PLAYING;
        delete gone.states.PLAYING;
        gone.states.LOBBY.on.begin.target = 'PLAYING2';
        expect(
            loadMachine(gone, recordingHost().host, {
                snapshot,
                restoreMode: 'structural',
            })
        ).toMatchObject({ ok: false, errors: [{ code: 'state-missing' }] });

        const lobby = { ...snapshot, state: 'LOBBY' };
        delete lobby.child;
        const withChild = gameDoc();
        withChild.revision = 2;
        withChild.states.LOBBY = {
            child: { machine: 'turn' },
            on: { begin: { target: 'PLAYING' } },
        };
        expect(
            loadMachine(withChild, recordingHost().host, {
                snapshot: lobby,
                restoreMode: 'structural',
            })
        ).toMatchObject({ ok: false, errors: [{ code: 'child-missing' }] });
    });
});
