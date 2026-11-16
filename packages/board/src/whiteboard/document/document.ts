import { compareShapes, indexBetween } from './fractional-index';
import type { Change, ChangeSource, Shape } from './types';

interface Pending {
    before: Shape | undefined;
    after: Shape | undefined;
}

/**
 * A whiteboard's shapes: a flat set of immutable records keyed by id, and a
 * stream of the changes made to them.
 *
 * @remarks
 * Every edit goes through {@link WhiteboardDocument.put} and
 * {@link WhiteboardDocument.remove}, grouped with
 * {@link WhiteboardDocument.transact}, and every group reaches subscribers as
 * one {@link Change}. Saving, redrawing and a later sync layer all listen to
 * that stream; {@link WhiteboardDocument.applyRemote} is how a sync layer
 * feeds other people's changes back in. Conflicts are last-write-wins per
 * record.
 *
 * @example
 * ```ts
 * const doc = new WhiteboardDocument();
 * doc.subscribe(change => console.log(change.added.length));
 * doc.transact(() => {
 *     doc.put(shapeA);
 *     doc.put(shapeB);
 * }); // logs 2, once
 * ```
 *
 * @group Whiteboard Document
 */
export class WhiteboardDocument {
    private readonly _shapes = new Map<string, Shape>();
    private readonly _listeners = new Set<(change: Change) => void>();
    private _pending: Map<string, Pending> | null = null;
    private _depth = 0;
    private _source: ChangeSource = 'local';
    private _sorted: Shape[] | null = null;

    /** @param shapes - Records to start with; no change is emitted for them */
    constructor(shapes: Shape[] = []) {
        for (const shape of shapes) this._shapes.set(shape.id, shape);
    }

    /** The record with this id, if any */
    get(id: string): Shape | undefined {
        return this._shapes.get(id);
    }

    /** How many records there are */
    get size(): number {
        return this._shapes.size;
    }

    /** Every record in stacking order (bottom first) */
    all(): readonly Shape[] {
        this._sorted ??= [...this._shapes.values()].sort(compareShapes);
        return this._sorted;
    }

    /** Adds records, or replaces the records with the same ids */
    put(shapes: Shape | Shape[]): void {
        const list = Array.isArray(shapes) ? shapes : [shapes];
        this.transact(() => {
            for (const shape of list) {
                const current = this._shapes.get(shape.id);
                if (current === shape) continue;
                this.track(shape.id, current, shape);
                this._shapes.set(shape.id, shape);
            }
        });
    }

    /** Removes the records with these ids; unknown ids are ignored */
    remove(ids: string | string[]): void {
        const list = Array.isArray(ids) ? ids : [ids];
        this.transact(() => {
            for (const id of list) {
                const current = this._shapes.get(id);
                if (!current) continue;
                this.track(id, current, undefined);
                this._shapes.delete(id);
            }
        });
    }

    /**
     * Runs `fn` and reports everything it changed as one {@link Change}.
     * Nested calls join the outermost one.
     */
    transact<T>(fn: () => T): T {
        if (this._depth === 0) this._pending = new Map();
        this._depth++;
        try {
            return fn();
        } finally {
            this._depth--;
            if (this._depth === 0) this.flush();
        }
    }

    /**
     * Listens for changes, delivered after each outermost transaction.
     *
     * @returns A function that stops the listener
     */
    subscribe(listener: (change: Change) => void): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    /**
     * Applies a change made by another client: puts its added records and the
     * `after` side of its updates, removes its removed records, and reports
     * the result with `source: 'remote'`.
     */
    applyRemote(change: Change): void {
        this._source = 'remote';
        try {
            this.transact(() => {
                this.put([
                    ...change.added,
                    ...change.updated.map(([, after]) => after),
                ]);
                this.remove(change.removed.map(shape => shape.id));
            });
        } finally {
            this._source = 'local';
        }
    }

    /** A stacking key above every record, for a new shape on top */
    nextIndex(): string {
        const shapes = this.all();
        return indexBetween(shapes[shapes.length - 1]?.index ?? null, null);
    }

    private track(
        id: string,
        before: Shape | undefined,
        after: Shape | undefined
    ): void {
        this._sorted = null;
        const pending = this._pending!;
        const entry = pending.get(id);
        if (entry) entry.after = after;
        else pending.set(id, { before, after });
    }

    private flush(): void {
        const pending = this._pending;
        this._pending = null;
        if (!pending || pending.size === 0) return;
        const change: Change = {
            added: [],
            updated: [],
            removed: [],
            source: this._source,
        };
        for (const { before, after } of pending.values()) {
            if (before && after) {
                if (before !== after) change.updated.push([before, after]);
            } else if (after) change.added.push(after);
            else if (before) change.removed.push(before);
        }
        if (
            change.added.length +
            change.updated.length +
            change.removed.length
        ) {
            for (const listener of [...this._listeners]) listener(change);
        }
    }
}
