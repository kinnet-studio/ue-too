import type { WhiteboardDocument } from './document';
import type { Change, Shape } from './types';

// One undo step: each record's state before the step and after it
type Step = Map<
    string,
    { before: Shape | undefined; after: Shape | undefined }
>;

/**
 * Undo and redo for one person's edits to a {@link WhiteboardDocument}.
 *
 * @remarks
 * Only local changes are recorded; changes that came from other people
 * ({@link WhiteboardDocument.applyRemote}) never are, so undo only ever takes
 * back your own work. A tool brackets a gesture (one drag, one stroke) with
 * {@link History.begin} and {@link History.end} so the whole gesture is one
 * step; changes outside a gesture are a step each. Undo puts back each
 * record's state from before the step, even if someone else changed it since
 * (last write wins).
 *
 * @group Whiteboard Document
 */
export class History {
    private readonly _undo: Step[] = [];
    private readonly _redo: Step[] = [];
    private readonly _listeners = new Set<() => void>();
    private _open: Step | null = null;
    private _depth = 0;
    private _applying = false;
    private readonly _stop: () => void;

    constructor(private readonly _doc: WhiteboardDocument) {
        this._stop = _doc.subscribe(change => this.record(change));
    }

    /** Opens a step; nested begin/end pairs join the outer step */
    begin(): void {
        if (this._depth === 0) this._open = new Map();
        this._depth++;
        this.notify();
    }

    /** Closes the step; an empty step is dropped */
    end(): void {
        if (this._depth === 0) return;
        this._depth--;
        if (this._depth > 0) return;
        const step = this._open!;
        this._open = null;
        if (step.size > 0) this.push(step);
        this.notify();
    }

    /** Reverts everything the open step changed and drops it */
    cancel(): void {
        if (this._depth === 0) return;
        const step = this._open!;
        this._open = null;
        this._depth = 0;
        this.apply(step, 'before');
        this.notify();
    }

    /**
     * Takes back the last step, cancelling an open one first.
     *
     * @returns Whether there was anything to undo
     */
    undo(): boolean {
        const cancelled = this._depth > 0 && this._open!.size > 0;
        this.cancel();
        const step = this._undo.pop();
        if (!step) {
            if (cancelled) this.notify();
            return cancelled;
        }
        this.apply(step, 'before');
        this._redo.push(step);
        this.notify();
        return true;
    }

    /**
     * Puts back the last undone step.
     *
     * @returns Whether there was anything to redo
     */
    redo(): boolean {
        this.cancel();
        const step = this._redo.pop();
        if (!step) return false;
        this.apply(step, 'after');
        this._undo.push(step);
        this.notify();
        return true;
    }

    get canUndo(): boolean {
        return this._undo.length > 0;
    }

    get canRedo(): boolean {
        return this._redo.length > 0;
    }

    /** Whether a step is open (a gesture is under way) */
    get open(): boolean {
        return this._depth > 0;
    }

    /**
     * Listens for changes to {@link History.canUndo}, {@link History.canRedo}
     * and {@link History.open}.
     *
     * @returns A function that stops the listener
     */
    subscribe(listener: () => void): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    /** Stops recording */
    dispose(): void {
        this._stop();
        this._listeners.clear();
    }

    private record(change: Change): void {
        if (change.source !== 'local' || this._applying) return;
        const step = this._open ?? new Map();
        const note = (
            id: string,
            before: Shape | undefined,
            after: Shape | undefined
        ) => {
            const entry = step.get(id);
            if (entry) entry.after = after;
            else step.set(id, { before, after });
        };
        for (const shape of change.added) note(shape.id, undefined, shape);
        for (const [before, after] of change.updated) {
            note(before.id, before, after);
        }
        for (const shape of change.removed) note(shape.id, shape, undefined);
        if (!this._open) {
            this.push(step);
            this.notify();
        }
    }

    private push(step: Step): void {
        this._undo.push(step);
        this._redo.length = 0;
    }

    private apply(step: Step, side: 'before' | 'after'): void {
        this._applying = true;
        try {
            this._doc.transact(() => {
                for (const [id, states] of step) {
                    const shape = states[side];
                    if (shape) this._doc.put(shape);
                    else this._doc.remove(id);
                }
            });
        } finally {
            this._applying = false;
        }
    }

    private notify(): void {
        for (const listener of [...this._listeners]) listener();
    }
}
