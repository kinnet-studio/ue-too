import { PortableRuntimeFailure, RuntimeError } from '../errors';
import { Value } from '../format/types';
import { describeError } from '../util';
import { PayloadRecord, WorkMeter } from './expr';
import { EffectCaller } from './stmt';
import { ContextStore, StoreTransaction } from './store';

/** Errors queued while `onError` runs, per delivery; the rest are dropped. */
export const MAX_QUEUED_REPORTS = 100;

/** What guards and actions can read about the event being handled. */
export type EventFrame = {
    readonly payload: PayloadRecord | null;
    /** The finished child's context, only while `onDone` runs. */
    readonly child: ContextStore | null;
};

/** A machine whose current state the transaction can put back. */
export interface TxMachine {
    rawSetState(state: string): void;
}

/**
 * How a call on a machine relates to a running transaction:
 * - `new`: nothing is running; start a transaction.
 * - `nested`: a parent is delegating to its child; join the running one.
 * - `reentrant`: host code (an effect, a service, a subscriber) called back in.
 */
export type TxEntry = 'new' | 'nested' | 'reentrant';

export type TxOutcome<T> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false };

/**
 * One transaction shared by a whole machine tree. It saves each touched
 * store's and machine's previous values, rolls them back on failure, meters
 * the work each run does, and reports machine failures to the host.
 */
export class Transaction implements StoreTransaction, EffectCaller, WorkMeter {
    private active = false;
    private work = 0;
    private hostDepth = 0;
    private delegationDepth = 0;
    private reporting = false;
    private readonly queued: RuntimeError[] = [];
    private accepted = 0;
    private dropped = 0;
    private event: string | null = null;
    private effectsCalled: string[] = [];
    private readonly frames: EventFrame[] = [];
    private readonly dirty: ContextStore[] = [];
    private readonly savedStates = new Map<TxMachine, string>();

    constructor(
        private readonly onError: (error: RuntimeError) => void,
        private readonly maxEventWork: number
    ) {}

    get isActive(): boolean {
        return this.active;
    }

    entry(): TxEntry {
        if (!this.active) {
            return 'new';
        }
        return this.hostDepth === 0 && this.delegationDepth > 0
            ? 'nested'
            : 'reentrant';
    }

    /**
     * Runs `body` as one transaction. A `PortableRuntimeFailure` rolls back and
     * is reported to `onError`; any other exception rolls back and is rethrown.
     */
    run<T>(event: string | null, body: () => T): TxOutcome<T> {
        this.active = true;
        this.event = event;
        this.effectsCalled = [];
        this.work = 0;
        try {
            const value = body();
            for (const store of this.dirty) {
                store.commitTransaction();
            }
            return { ok: true, value };
        } catch (error) {
            for (const store of this.dirty) {
                store.rollbackTransaction();
            }
            this.savedStates.forEach((state, machine) =>
                machine.rawSetState(state)
            );
            if (!(error instanceof PortableRuntimeFailure)) {
                throw error;
            }
            const report: RuntimeError = {
                code: error.code,
                message: error.message,
                path: error.path,
                event,
                effectsCalled: [...this.effectsCalled],
            };
            this.end();
            this.report(report);
            return { ok: false };
        } finally {
            this.end();
        }
    }

    private end(): void {
        this.active = false;
        this.event = null;
        this.hostDepth = 0;
        this.delegationDepth = 0;
        this.frames.length = 0;
        this.dirty.length = 0;
        this.savedStates.clear();
    }

    reportReentrant(event: string | null, call: string): void {
        const during =
            this.event === null
                ? 'a start, reset or wrapup'
                : `event "${this.event}"`;
        this.report({
            code: 'reentrant-call',
            message: `${call} was called during ${during}; defer it, for example with queueMicrotask`,
            path: '',
            event,
            effectsCalled: [],
        });
    }

    /** Reports a failure found outside a run, such as a bad payload. */
    reportError(error: RuntimeError): void {
        this.report(error);
    }

    /**
     * Delivers `error` to `onError`. An error raised while `onError` runs
     * (for example by an event it starts) is queued and delivered after it
     * returns, in order. At most {@link MAX_QUEUED_REPORTS} are queued per
     * delivery, so an `onError` that keeps causing errors cannot loop
     * forever; if more were raised, one `limit-exceeded` error says how
     * many were dropped.
     */
    private report(error: RuntimeError): void {
        if (this.reporting) {
            if (this.accepted < MAX_QUEUED_REPORTS) {
                this.accepted += 1;
                this.queued.push(error);
            } else {
                this.dropped += 1;
            }
            return;
        }
        this.reporting = true;
        try {
            this.onError(error);
            for (
                let next = this.queued.shift();
                next !== undefined;
                next = this.queued.shift()
            ) {
                this.onError(next);
            }
            if (this.dropped > 0) {
                this.onError({
                    code: 'limit-exceeded',
                    message: `onError caused more than ${MAX_QUEUED_REPORTS} further errors; ${this.dropped} were dropped`,
                    path: '',
                    event: null,
                    effectsCalled: [],
                });
            }
        } finally {
            this.reporting = false;
            this.queued.length = 0;
            this.accepted = 0;
            this.dropped = 0;
        }
    }

    /**
     * Adds to the running transaction's work; fails it past `maxEventWork`.
     * Outside a transaction (a tool calling a guard) nothing is metered.
     */
    charge(units: number, site: string): void {
        if (!this.active) {
            return;
        }
        this.work += units;
        if (this.work > this.maxEventWork) {
            throw new PortableRuntimeFailure(
                'limit-exceeded',
                `the event used more than ${this.maxEventWork} work units`,
                site
            );
        }
    }

    markDirty(store: ContextStore): void {
        this.dirty.push(store);
    }

    /** Saves a machine's state before its first change in this transaction. */
    recordState(machine: TxMachine, state: string): void {
        if (this.active && !this.savedStates.has(machine)) {
            this.savedStates.set(machine, state);
        }
    }

    /** Runs a parent's call into its child. */
    delegate<T>(body: () => T): T {
        this.delegationDepth += 1;
        try {
            return body();
        } finally {
            this.delegationDepth -= 1;
        }
    }

    /** Runs host code: anything it calls back into the tree is re-entrant. */
    hostCode<T>(body: () => T): T {
        this.hostDepth += 1;
        try {
            return body();
        } finally {
            this.hostDepth -= 1;
        }
    }

    callEffect(
        name: string,
        site: string,
        run: () => Value | void
    ): Value | void {
        this.effectsCalled.push(name);
        this.hostDepth += 1;
        try {
            return run();
        } catch (error) {
            throw new PortableRuntimeFailure(
                'effect-failed',
                `effect ${name} threw: ${describeError(error)}`,
                site
            );
        } finally {
            this.hostDepth -= 1;
        }
    }

    withFrame<T>(frame: EventFrame, body: () => T): T {
        this.frames.push(frame);
        try {
            return body();
        } finally {
            this.frames.pop();
        }
    }

    currentFrame(): EventFrame | null {
        return this.frames.length === 0
            ? null
            : this.frames[this.frames.length - 1];
    }
}
