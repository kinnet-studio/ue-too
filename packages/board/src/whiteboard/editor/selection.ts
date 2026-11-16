import type { WhiteboardDocument } from '../document/document';

/**
 * Which shapes are selected.
 *
 * @group Whiteboard Editor
 */
export class Selection {
    private _ids: readonly string[] = [];
    private readonly _listeners = new Set<() => void>();

    /** The selected ids, in the order they were selected */
    get ids(): readonly string[] {
        return this._ids;
    }

    has(id: string): boolean {
        return this._ids.includes(id);
    }

    /** Selects exactly these ids */
    set(ids: string[]): void {
        const next = [...new Set(ids)];
        if (
            next.length === this._ids.length &&
            next.every((id, i) => id === this._ids[i])
        ) {
            return;
        }
        this._ids = next;
        this.notify();
    }

    /** Adds the id, or removes it when it is already selected */
    toggle(id: string): void {
        this.set(
            this.has(id)
                ? this._ids.filter(other => other !== id)
                : [...this._ids, id]
        );
    }

    clear(): void {
        this.set([]);
    }

    /** Drops ids no longer in the document (after an undo or an erase) */
    prune(doc: WhiteboardDocument): void {
        this.set(this._ids.filter(id => doc.get(id) !== undefined));
    }

    /**
     * Listens for selection changes.
     *
     * @returns A function that stops the listener
     */
    subscribe(listener: () => void): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    private notify(): void {
        for (const listener of [...this._listeners]) listener();
    }
}
