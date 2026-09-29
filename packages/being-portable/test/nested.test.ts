import { extractMachineGraph } from '@ue-too/being';
import { describe, expect, it } from 'vitest';

import { loadMachine } from '../src/api';
import { PortableMachine } from '../src/api-types';
import { defineHost } from '../src/host';
import { Doc, gameDoc } from './fixtures';
import { Recorder, recordingHost } from './recording-host';

function load(doc: Doc, recorder: Recorder): PortableMachine {
    const result = loadMachine(doc, recorder.host);
    if (!result.ok) {
        throw new Error(JSON.stringify(result.errors));
    }
    return result.machine;
}

const note = (text: string) => ({ call: 'note', args: { text } });

function child(machine: PortableMachine, state = 'PLAYING'): PortableMachine {
    return (machine.states[state] as unknown as { child: PortableMachine })
        .child;
}

describe('nested machines', () => {
    it('starts the child with values from with', () => {
        const recorder = recordingHost();
        const machine = load(gameDoc(), recorder);
        machine.happens('begin');
        const turn = child(machine);
        expect(turn.currentState).toBe('ROLLING');
        expect(turn.context.get('playerCount')).toBe(2);
        expect(machine.context.get('log')).toEqual(['enter PLAYING']);
    });

    it('runs onDone in the same event when the child finishes', () => {
        const recorder = recordingHost();
        const machine = load(gameDoc(), recorder);
        machine.happens('begin');
        expect(machine.happens('roll', { value: 3 })).toEqual({
            handled: true,
            nextState: 'LOBBY',
        });
        expect(machine.currentState).toBe('LOBBY');
        expect(machine.context.get('score')).toBe(6);
        expect(machine.context.get('log')).toEqual([
            'enter PLAYING',
            'exit PLAYING',
        ]);
    });

    it('enters parent first and exits child first', () => {
        const doc = gameDoc();
        doc.states.PLAYING.enter = [note('parent enter')];
        doc.states.PLAYING.exit = [note('parent exit')];
        const recorder = recordingHost();
        const machine = load(doc, recorder);
        machine.happens('begin');
        machine.happens('quit');
        expect(recorder.calls.map(call => call.args.text)).toEqual([
            'parent enter',
            'turn starts',
            'turn ends',
            'parent exit',
        ]);
        expect(machine.currentState).toBe('LOBBY');
    });

    it('restarts the child fresh on every entry', () => {
        const doc = gameDoc();
        doc.states.LOBBY.on.begin.do = [{ set: 'players', to: 3 }];
        const machine = load(doc, recordingHost());
        machine.happens('begin');
        machine.happens('roll', { value: 1 });
        machine.happens('begin');
        const turn = child(machine);
        expect(turn.currentState).toBe('ROLLING');
        expect(turn.context.get('points')).toBe(0);
        expect(turn.context.get('playerCount')).toBe(3);
    });

    it('stays when onDone has no target, and the child rests', () => {
        const doc = gameDoc();
        delete doc.states.PLAYING.onDone.target;
        const machine = load(doc, recordingHost());
        machine.happens('begin');
        machine.happens('roll', { value: 2 });
        expect(machine.currentState).toBe('PLAYING');
        expect(child(machine).currentState).toBe('DONE');
        expect(machine.happens('roll', { value: 2 })).toEqual({
            handled: false,
        });
    });

    it('passes the child output through', () => {
        const doc = gameDoc();
        doc.outputs = { roll: 'number' };
        doc.machines.turn.outputs = { roll: 'number' };
        doc.machines.turn.states.ROLLING.on.roll.do.push({
            output: { ctx: 'points' },
        });
        const machine = load(doc, recordingHost());
        machine.happens('begin');
        expect(machine.happens('roll', { value: 4 })).toEqual({
            handled: true,
            nextState: 'LOBBY',
            output: 8,
        });
    });

    it('rolls back the whole tree when onDone fails', () => {
        const doc = gameDoc();
        doc.states.PLAYING.onDone.do.push({
            removeAt: 'log',
            index: 99,
        });
        const recorder = recordingHost();
        const machine = load(doc, recorder);
        machine.happens('begin');
        expect(machine.happens('roll', { value: 3 })).toEqual({
            handled: false,
        });
        expect(machine.currentState).toBe('PLAYING');
        expect(child(machine).currentState).toBe('ROLLING');
        expect(child(machine).context.get('points')).toBe(0);
        expect(machine.context.get('score')).toBe(0);
        expect(recorder.errors[0]).toMatchObject({
            code: 'index-out-of-range',
            path: 'states.PLAYING.onDone.do[1]',
            effectsCalled: ['note'],
        });
    });

    it('refuses calls on a child that do not come from its parent', () => {
        const machine = load(gameDoc(), recordingHost());
        machine.happens('begin');
        const turn = child(machine);
        const message = 'child machines are driven by their parent machine';
        expect(() => turn.happens('roll', { value: 3 })).toThrow(message);
        expect(() => turn.start()).toThrow(message);
        expect(() => turn.reset()).toThrow(message);
        expect(() => turn.wrapup()).toThrow(message);
        expect(turn.currentState).toBe('ROLLING');
        expect(turn.context.get('points')).toBe(0);
        expect(machine.happens('roll', { value: 3 }).handled).toBe(true);
        expect(machine.context.get('score')).toBe(6);
    });

    it('shows onDone as a $done edge that events cannot trigger', () => {
        const machine = load(gameDoc(), recordingHost());
        expect(extractMachineGraph(machine).edges).toContainEqual({
            from: 'PLAYING',
            to: 'LOBBY',
            event: '$done',
        });
        machine.happens('begin');
        expect(machine.happens('$done')).toEqual({ handled: false });
        expect(machine.currentState).toBe('PLAYING');
    });

    it('chains onDone through three levels in one event', () => {
        const leaf = {
            context: {},
            events: { go: {} },
            initialState: 'A',
            states: {
                A: { on: { go: { target: 'END' } } },
                END: { final: true },
            },
        };
        const mid = {
            context: {},
            events: { go: {} },
            initialState: 'M',
            states: {
                M: { child: { machine: 'leaf' }, onDone: { target: 'MEND' } },
                MEND: { final: true },
            },
        };
        const doc = {
            format: 'being-machine@1',
            id: 'deep',
            revision: 1,
            context: {},
            events: { go: {} },
            machines: { leaf, mid },
            initialState: 'R',
            states: {
                R: {
                    child: { machine: 'mid' },
                    onDone: { target: 'FINISHED' },
                },
                FINISHED: {},
            },
        };
        const result = loadMachine(doc, defineHost());
        if (!result.ok) throw new Error(JSON.stringify(result.errors));
        expect(result.machine.happens('go')).toEqual({
            handled: true,
            nextState: 'FINISHED',
        });
    });
});
