# Whiteboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sketchy whiteboard editor (shapes, arrows, lines, pen, text, sticky notes, eraser, select, undo) inside `@ue-too/board`, published as `@ue-too/board/whiteboard` and ready to move into its own package, then used on the docs site's home page with a bottom dock and saving to the browser.

**Architecture:** `src/whiteboard/` holds a DOM-free document (records, changes, history, snapshot), DOM-free geometry, a seeded sketch generator with a cached Canvas 2D painter, and an `Editor` that runs each tool as a `@ue-too/being` machine beside the board's own gestures. It imports board only as `@ue-too/board` (a package self-reference, verified to work in `bun test`, `tsc` and `Bun.build`), so detaching it is a folder move. The docs site draws the hero, calls `editor.draw(ctx)`, and renders the dock in Vue.

**Tech Stack:** TypeScript (strict), Bun, Nx, `bun test` with `vitest`-style imports, `@ue-too/being`, `@ue-too/math`, Canvas 2D, jsdom (tests), Vite (examples app), VitePress + Vue + Playwright (docs).

**Spec:** `docs/superpowers/specs/2026-11-16-whiteboard-design.md` (ue-too repo). Read it before starting; this plan argues from it.

## Global Constraints

- Two repos, both on branch `claude/sleepy-curie-eno08y`: Part 1 in `/home/user/ue-too`, Part 2 in `/home/user/ue-too-documentation`.
- **Part 2 does not start until `@ue-too/board@0.21.0` is on npm** (`npm view @ue-too/board@0.21.0 version` prints `0.21.0`). The user publishes it by running "Publish to NPM" from `main` with `version-type: minor` after Part 1 merges. Never trigger a release.
- Run ue-too tasks from the repo root through Nx (`bunx nx test board`, `bunx nx build board`); single test files with `cd packages/board && bun test <path>`.
- Prettier: 4-space indent, single quotes, trailing comma `es5` in ue-too. The docs repo uses its existing 2-space, no-semicolon style.
- No new runtime dependencies in `@ue-too/board` (stays `@ue-too/math`, `@ue-too/being`). `@fontsource/caveat` is added only to the examples app and the docs site.
- Every file under `packages/board/src/whiteboard/` imports only `@ue-too/board`, `@ue-too/being`, `@ue-too/math` and files inside `src/whiteboard/`. Nothing outside `src/whiteboard/` imports it.
- Nothing from the whiteboard is re-exported from `packages/board/src/index.ts`.
- Every exported symbol has JSDoc and a TypeDoc `@group` tag: `Whiteboard Document`, `Whiteboard Geometry`, `Whiteboard Rendering` or `Whiteboard Editor`.
- Commits: conventional, scoped. Part 1 product commits are `feat(board): ...` (tests and fixes inside the same feature may use `test(board):` / `fix(board):`); never add `!` or `BREAKING CHANGE`. Example app: `feat(examples): ...`. Docs repo: `feat: ...` / `test: ...`. End every commit message with the attribution lines from the session's system reminder.
- Spec values used across tasks: stroke widths `s 1.5 / m 2.5 / l 4.5`, text sizes `s 20 / m 28 / l 40` px, notes `200 × 200`, hit tolerance `6` screen px, drag slop `5` screen px, pen thinning `0.5` screen px, pen simplification tolerance `0.5` world units, coordinates rounded to `2` decimals, colors `ink red blue green orange`, save debounce `400` ms, storage key `ue-too:home-whiteboard`, pan limit `4000`, zoom `0.25`–`4`.

## Review Focus

1. **A gesture that loses its pointer** (`pointercancel`, `lostpointercapture`, window `blur`, a tool switch, or Ctrl+Z pressed mid-drag): the gesture is cancelled, its partial changes reverted, nothing enters the history, and the tool is back in its idle state. Tests: Task 9 (input), Task 10 (undo mid-drag), Task 14 (tool switch mid-drag).
2. **Letter shortcuts while typing** in the VitePress search box, the text overlay, any `contenteditable`, during IME composition, or with Ctrl/Cmd/Alt held (Ctrl+R must still reload): never switch tools. Test: Task 14.
3. **Saved data that can't be used** (bad JSON, wrong schema, a newer version, `localStorage` throwing on read or write, a full quota): the board starts empty and works, the stored value is left untouched until the visitor's first edit, and a write failure is logged once. Tests: Task 5 (parsing), Task 21 (storage).
4. **Extreme zoom (0.25 and 4):** hit tolerance, resize handles, the selection outline and the marquee stay the same size on screen; pen thinning is in screen pixels. Tests: Task 6, Task 11.
5. **A shape lying over the hero's button:** with Hand or Select, pressing the shape never activates the button; pressing the uncovered part does. Tests: Task 9 (hand), Task 11 (select), Task 20 (home page).

---

## File Structure

### Part 1: ue-too

```
packages/board/
  package.json                     + "publishEntries": ["whiteboard"]
  project.json                     build: second entry, @ue-too/board external
  typedoc.json                     + src/whiteboard/index.ts entry
  README.md                        + Whiteboard section
  src/whiteboard/
    index.ts                       public barrel
    document/types.ts              record types, style constants
    document/ids.ts                createId
    document/fractional-index.ts   indexBetween, compareShapes
    document/document.ts           WhiteboardDocument
    document/history.ts            History
    document/snapshot.ts           Snapshot, parseSnapshot, isShape, SnapshotError
    geometry/box.ts                Box helpers
    geometry/text.ts               TextEnv, textFont, textLines
    geometry/bounds.ts             shapeBounds
    geometry/hit-test.ts           hitShape, shapesInBox
    geometry/simplify.ts           simplifyPoints, roundPoints
    render/random.ts               seededRandom
    render/sketch.ts               sketchShape, noteTilt
    render/theme.ts                WhiteboardTheme, DEFAULT_THEME
    render/painter.ts              ShapePainter
    render/overlay.ts              drawSelectionOverlay
    editor/events.ts               ToolEvents, ToolPointer, PointerSample, ToolName
    editor/pointer-input.ts        PointerInput (slop, double click, handover)
    editor/tool-context.ts         ToolContext
    editor/editor-machine.ts       createEditorMachine (DelegatingState per tool)
    editor/selection.ts            selection box, handles, resize math
    editor/tools/hand.ts
    editor/tools/box-tool.ts       rect, ellipse
    editor/tools/segment-tool.ts   arrow, line
    editor/tools/pen.ts
    editor/tools/select.ts
    editor/tools/eraser.ts
    editor/tools/place-tool.ts     text, note
    editor/text-input.ts           TextInput interface, DomTextInput (textarea)
    editor/keyboard.ts             shortcutFor
    editor/editor.ts               Editor
  test/whiteboard/                 one test file per source area (named below)
  bench/whiteboard.bench.ts
scripts/build.ts                   fix every *.js.map, not only index.js.map
scripts/move-package.mjs           publish ./<entry> for each publishEntries item
apps/examples/
  package.json                     + @fontsource/caveat
  vite.config.js                   + whiteboard input
  src/index.html                   + nav link and card
  src/i18n/en.ts, zh-TW.ts         + whiteboard keys
  src/whiteboard/index.html, main.ts
```

### Part 2: ue-too-documentation

```
package.json, bun.lock              @ue-too/board 0.21.0, + @fontsource/caveat
README.md                           Home page section
.vitepress/theme/index.ts           import '@fontsource/caveat/700.css'
.vitepress/theme/canvas-home/
  canvas-home.ts                    editor wiring, limits, bottom inset; no hint, no DragTracker
  CanvasHome.vue                    theme + saving wiring, mounts the dock
  WhiteboardDock.vue                hint, style panel, dock (new)
  dock-icons.ts                     inline SVG paths (new)
  whiteboard-labels.ts              en / ja / zh-TW copy (new)
  whiteboard-theme.ts               light / dark palettes (new)
  whiteboard-storage.ts             load / save (new)
  whiteboard-storage.test.ts        (new)
  drag-tracker.ts, drag-tracker.test.ts   deleted (moved into the editor)
scripts/test-home-page.ts           updated and new checks
```

---

# Part 1: `@ue-too/board/whiteboard` (ue-too)

### Task 1: The whiteboard entry, its build and publish, and the import guard

**Files:**
- Create: `packages/board/src/whiteboard/index.ts`, `packages/board/test/whiteboard/import-guard.test.ts`
- Modify: `packages/board/project.json` (`build` and `build:bun` commands), `packages/board/package.json`, `packages/board/typedoc.json`, `scripts/build.ts:57-100`, `scripts/move-package.mjs:40-47`

**Interfaces:**
- Produces: `@ue-too/board/whiteboard` resolves to `src/whiteboard/index.ts` in the workspace and to `./whiteboard/index.js` / `./whiteboard/index.d.ts` when published. The barrel starts as `export {};`; later tasks add exports.

- [ ] **Step 1: Write the import guard test** in `test/whiteboard/import-guard.test.ts`. It walks `src/` with `readdirSync(..., { recursive: true })`, extracts specifiers with `/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g`, and asserts:

```ts
it('whiteboard files import only board, being, math and each other', () => {
    expect(offendersInside).toEqual([]); // relative specifiers resolving outside src/whiteboard, or bare ones other than '@ue-too/board' | '@ue-too/being' | '@ue-too/math'
});
it('nothing outside the whiteboard imports it or board by name', () => {
    expect(offendersOutside).toEqual([]); // any specifier containing 'whiteboard', or equal to '@ue-too/board'
});
it('the main entry does not re-export the whiteboard', () => {
    expect(readFileSync('src/index.ts', 'utf8')).not.toContain('whiteboard');
});
```

Each offender is reported as `"<file>: <specifier>"`. Add a probe file `src/whiteboard/__probe.ts` importing `'../camera'` and confirm the first test fails, then delete the probe.

- [ ] **Step 2: Run** `cd packages/board && bun test test/whiteboard/import-guard.test.ts`. Expected: FAIL while the probe exists, PASS after it is deleted.

- [ ] **Step 3: Wire the second entry.**
  - `project.json` `build` and `build:bun`: `rm -rf dist && bun run ../../scripts/build.ts --entrypoints ./src/index.ts --entrypoints ./src/whiteboard/index.ts --external @ue-too/math --external @ue-too/being --external @ue-too/board`.
  - `scripts/build.ts`: apply the existing source-map path fix to every `result.outputs` entry whose path ends in `.js` (its `.js.map` sibling), not only `dist/index.js.map`. Single-entry packages behave as before.
  - `package.json`: add `"publishEntries": ["whiteboard"]`.
  - `scripts/move-package.mjs`: after building `data.exports`, for each name in `data.publishEntries ?? []` add `'./<name>': { types: './<name>/index.d.ts', import: './<name>/index.js', default: './<name>/index.js' }`, then `delete data.publishEntries`.
  - `typedoc.json`: `"entryPoints": ["src/index.ts", "src/whiteboard/index.ts"]`.

- [ ] **Step 4: Verify the build.** Run `bunx nx build board --skip-nx-cache`, then `cd packages/board && node ../../scripts/move-package.mjs --dry-run`. Expected: `dist/whiteboard/index.js` and `dist/whiteboard/index.d.ts` exist; `dist/package.json` `exports` has `"./whiteboard"`; `grep -c "@ue-too/board" dist/whiteboard/index.js` prints at least `1` once later tasks import board (0 now is fine). Then `rm -rf dist`.

- [ ] **Step 5: Run** `bunx nx test board`. Expected: all pass.

- [ ] **Step 6: Commit** `feat(board): add the @ue-too/board/whiteboard entry`.

### Task 2: Record types, IDs and fractional indexing

**Files:**
- Create: `src/whiteboard/document/types.ts`, `document/ids.ts`, `document/fractional-index.ts`
- Test: `test/whiteboard/fractional-index.test.ts`, `test/whiteboard/ids.test.ts`

**Interfaces:**
- Produces (`types.ts`):

```ts
export type ShapeType = 'rect' | 'ellipse' | 'arrow' | 'line' | 'pen' | 'text' | 'note';
export type ColorName = 'ink' | 'red' | 'blue' | 'green' | 'orange';
export type ShapeSize = 's' | 'm' | 'l';
export type ShapeFill = 'none' | 'hachure' | 'solid';
export interface ShapeStyle { color: ColorName; size: ShapeSize; fill: ShapeFill }
export interface ShapeBase<T extends ShapeType> {
    id: string; type: T; x: number; y: number; rotation: number; index: string; seed: number; style: ShapeStyle;
}
export interface RectShape extends ShapeBase<'rect'> { w: number; h: number }      // x, y = top-left
export interface EllipseShape extends ShapeBase<'ellipse'> { w: number; h: number } // x, y = top-left of its box
export interface NoteShape extends ShapeBase<'note'> { w: number; h: number; text: string }
export interface ArrowShape extends ShapeBase<'arrow'> { end: [number, number] }   // relative to x, y
export interface LineShape extends ShapeBase<'line'> { end: [number, number] }
export interface PenShape extends ShapeBase<'pen'> { points: [number, number][] }  // relative to x, y
export interface TextShape extends ShapeBase<'text'> { text: string }               // x, y = top-left
export type Shape = RectShape | EllipseShape | NoteShape | ArrowShape | LineShape | PenShape | TextShape;
export type ChangeSource = 'local' | 'remote';
export interface Change { added: Shape[]; updated: [before: Shape, after: Shape][]; removed: Shape[]; source: ChangeSource }
export const COLOR_NAMES: readonly ColorName[];      // in the order above
export const DEFAULT_STYLE: ShapeStyle;              // { color: 'ink', size: 'm', fill: 'none' }
export const STROKE_WIDTH: Record<ShapeSize, number>; // 1.5 / 2.5 / 4.5
export const FONT_SIZE: Record<ShapeSize, number>;    // 20 / 28 / 40
export const NOTE_SIZE = 200;
```
- Produces: `createId(random?: (bytes: Uint8Array) => Uint8Array): string` (16 base-62 characters, `crypto.getRandomValues` by default); `createSeed(): number` (integer in `[0, 2^31)`).
- Produces: `indexBetween(before: string | null, after: string | null): string`; `compareShapes(a: Pick<Shape, 'index' | 'id'>, b: ...): number` (by `index`, then `id`, plain string comparison).

- [ ] **Step 1: Write the failing tests.**

```ts
it('keys sort between their neighbours', () => {
    const pairs: [string | null, string | null][] = [[null, null], ['V', null], [null, 'V'], ['V', 'W'], ['V', 'V1'], ['az', 'b'], ['z', null], ['zz', null]];
    for (const [a, b] of pairs) {
        const k = indexBetween(a, b);
        if (a !== null) expect(k > a).toBe(true);
        if (b !== null) expect(k < b).toBe(true);
        expect(k.endsWith('0')).toBe(false);
    }
});
it('1000 appends stay short', () => {
    let k: string | null = null;
    for (let i = 0; i < 1000; i++) { const n = indexBetween(k, null); if (k) expect(n > k).toBe(true); k = n; }
    expect(k!.length).toBeLessThanOrEqual(30);
});
it('50 inserts at one spot stay short', () => {
    const lo = indexBetween(null, null); let hi = indexBetween(lo, null);
    for (let i = 0; i < 50; i++) hi = indexBetween(lo, hi);
    expect(hi.length).toBeLessThanOrEqual(12);
});
it('ties break by id', () => {
    expect(compareShapes({ index: 'V', id: 'b' }, { index: 'V', id: 'a' })).toBeGreaterThan(0);
});
it('ids are 16 base-62 characters and differ', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createId()));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(id).toMatch(/^[0-9A-Za-z]{16}$/);
});
```

- [ ] **Step 2: Run** `cd packages/board && bun test test/whiteboard/fractional-index.test.ts test/whiteboard/ids.test.ts`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement.** Digits are `0-9A-Za-z` (ASCII order is the sort order). `indexBetween`:
  - `(a, null)`: find the first position `i` where `a[i] !== 'z'`, return `a.slice(0, i) + next(a[i])`; if `a` is all `z` (or `null`, treated as `''`), return `a + 'V'`.
  - otherwise the digit-wise midpoint of `a ?? ''` and `b`:

```ts
function midpoint(a: string, b: string | null): string {
    if (b !== null) {
        let n = 0;
        while ((a[n] ?? '0') === b[n]) n++;
        if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
    }
    const da = a ? DIGITS.indexOf(a[0]) : 0;
    const db = b !== null ? DIGITS.indexOf(b[0]) : DIGITS.length;
    if (db - da > 1) return DIGITS[Math.round((da + db) / 2)];
    if (b !== null && b.length > 1) return b.slice(0, 1);
    return DIGITS[da] + midpoint(a.slice(1), null);
}
```

- [ ] **Step 4: Run** the tests. Expected: PASS.

- [ ] **Step 5: Commit** `feat(board): add whiteboard record types and fractional indexing`.

### Task 3: `WhiteboardDocument`

The spec calls it `Document`; it is `WhiteboardDocument` so it doesn't shadow the DOM's `Document` type.

**Files:**
- Create: `src/whiteboard/document/document.ts`
- Test: `test/whiteboard/document.test.ts`

**Interfaces:**
- Consumes: Task 2 types, `compareShapes`, `indexBetween`.
- Produces:

```ts
export class WhiteboardDocument {
    constructor(shapes?: Shape[]);
    get(id: string): Shape | undefined;
    get size(): number;
    all(): readonly Shape[];                    // sorted by compareShapes; cached until the next change
    put(shapes: Shape | Shape[]): void;         // add or replace whole records
    remove(ids: string | string[]): void;       // unknown ids ignored
    transact<T>(fn: () => T): T;                // nested calls join the outermost
    subscribe(listener: (change: Change) => void): () => void;
    applyRemote(change: Change): void;          // put(added), put(after of updated), remove(ids of removed), emitted with source 'remote'
    nextIndex(): string;                        // indexBetween(top shape's index or null, null)
}
```

- [ ] **Step 1: Write the failing tests** (`rect(id, overrides?)` is a local helper building a valid `RectShape`):

```ts
it('a transaction emits one change', () => {
    const doc = new WhiteboardDocument(); const seen: Change[] = []; doc.subscribe(c => seen.push(c));
    doc.transact(() => { doc.put(rect('a')); doc.put(rect('b')); });
    expect(seen).toHaveLength(1);
    expect(seen[0].added.map(s => s.id)).toEqual(['a', 'b']);
    expect(seen[0].source).toBe('local');
});
it('changes to one record inside a transaction collapse', () => {
    const doc = new WhiteboardDocument([rect('a')]); const seen: Change[] = []; doc.subscribe(c => seen.push(c));
    doc.transact(() => { doc.put(rect('a', { x: 5 })); doc.put(rect('a', { x: 9 })); });
    expect(seen[0].updated).toHaveLength(1);
    expect(seen[0].updated[0][0].x).toBe(0);
    expect(seen[0].updated[0][1].x).toBe(9);
    doc.transact(() => { doc.put(rect('n')); doc.remove('n'); });
    expect(seen).toHaveLength(1); // added then removed: nothing to report
});
it('removing an existing record reports its last state', () => { /* put a, then remove a → removed[0] is the record */ });
it('all() sorts by index then id', () => { /* put records with indexes 'b','a','a' (ids 'y','z','x') → ids ['x','z','y'] */ });
it('applyRemote marks the source', () => {
    const doc = new WhiteboardDocument(); const seen: Change[] = []; doc.subscribe(c => seen.push(c));
    doc.applyRemote({ added: [rect('r')], updated: [], removed: [], source: 'remote' });
    expect(doc.get('r')).toBeDefined();
    expect(seen[0].source).toBe('remote');
});
it('nextIndex is above every shape', () => { /* put two shapes with nextIndex() each; second index > first */ });
it('unsubscribe stops delivery', () => { /* … */ });
```

- [ ] **Step 2: Run** `cd packages/board && bun test test/whiteboard/document.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** A `Map<string, Shape>`; an open transaction tracks `Map<id, { before: Shape | undefined; after: Shape | undefined }>` keeping the first `before` and the last `after`; on close, entries with both undefined are dropped, `before` undefined → `added`, `after` undefined → `removed`, both set and different objects → `updated`. Empty changes are not emitted. `put` / `remove` outside a transaction wrap themselves in one.

- [ ] **Step 4: Run** the tests. Expected: PASS.

- [ ] **Step 5: Commit** `feat(board): add the whiteboard document`.

### Task 4: `History`

**Files:**
- Create: `src/whiteboard/document/history.ts`
- Test: `test/whiteboard/history.test.ts`

**Interfaces:**
- Consumes: `WhiteboardDocument` (Task 3).
- Produces:

```ts
export class History {
    constructor(doc: WhiteboardDocument);
    begin(): void;     // opens a step; nested begin/end pairs join the outer step
    end(): void;       // closes it; an empty step is dropped; a non-empty one clears redo
    cancel(): void;    // reverts the open step's changes (not recorded) and drops it
    undo(): boolean;   // false when there is nothing to undo; cancels an open step first
    redo(): boolean;
    get canUndo(): boolean;
    get canRedo(): boolean;
    get open(): boolean;
    subscribe(listener: () => void): () => void; // canUndo / canRedo / open changed
    dispose(): void;
}
```

Local changes outside `begin`/`end` are each one step. Remote changes are never recorded. A step is a `Map<id, { before?: Shape; after?: Shape }>`; undo puts each `before` (or removes when there is none) in one `doc.transact`, redo puts each `after`. Changes made by undo, redo and cancel are not recorded.

- [ ] **Step 1: Write the failing tests.**

```ts
it('a gesture is one step', () => {
    const doc = new WhiteboardDocument(); const h = new History(doc);
    h.begin(); doc.put(rect('a')); doc.put(rect('a', { x: 5 })); doc.put(rect('a', { x: 10 })); h.end();
    expect(h.undo()).toBe(true);
    expect(doc.get('a')).toBeUndefined();
    expect(h.redo()).toBe(true);
    expect(doc.get('a')!.x).toBe(10);
});
it('cancel reverts and records nothing', () => {
    const doc = new WhiteboardDocument([rect('a')]); const h = new History(doc);
    h.begin(); doc.put(rect('a', { x: 50 })); doc.put(rect('b')); h.cancel();
    expect(doc.get('a')!.x).toBe(0);
    expect(doc.get('b')).toBeUndefined();
    expect(h.canUndo).toBe(false);
});
it('undo during an open step cancels it first', () => { /* begin, put b, undo() → b gone, previous step undone too only if it existed; canRedo false for the cancelled part */ });
it('remote changes are not undone', () => {
    const doc = new WhiteboardDocument(); const h = new History(doc);
    doc.put(rect('mine'));
    doc.applyRemote({ added: [rect('theirs')], updated: [], removed: [], source: 'remote' });
    h.undo();
    expect(doc.get('mine')).toBeUndefined();
    expect(doc.get('theirs')).toBeDefined();
});
it('undo restores my before even after a remote edit (last write wins)', () => {
    const doc = new WhiteboardDocument([rect('a')]); const h = new History(doc);
    doc.put(rect('a', { x: 5 }));
    doc.applyRemote({ added: [], updated: [[rect('a', { x: 5 }), rect('a', { x: 7 })]], removed: [], source: 'remote' });
    h.undo();
    expect(doc.get('a')!.x).toBe(0);
});
it('a new change clears redo', () => { /* put a; undo; put b → canRedo false */ });
it('undo and redo themselves are not new steps', () => { /* put a; undo; redo; undo → a gone, canUndo false */ });
```

- [ ] **Step 2: Run** `cd packages/board && bun test test/whiteboard/history.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** as described in Interfaces.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(board): add whiteboard undo and redo`.

### Task 5: Snapshots

**Files:**
- Create: `src/whiteboard/document/snapshot.ts`; modify `document.ts` (add `toSnapshot`, `static fromSnapshot`)
- Test: `test/whiteboard/snapshot.test.ts`

**Interfaces:**
- Produces:

```ts
export const SNAPSHOT_SCHEMA = 'ue-too-whiteboard';
export const SNAPSHOT_VERSION = 1;
export interface Snapshot { schema: typeof SNAPSHOT_SCHEMA; version: number; records: Shape[] }
export class SnapshotError extends Error {}
export function isShape(value: unknown): value is Shape;   // every field of its type present, finite numbers, known enums, string id/index
export function parseSnapshot(json: unknown): Shape[];      // throws SnapshotError: not an object, wrong schema, version not an integer, version > SNAPSHOT_VERSION; drops records failing isShape and duplicate ids (first wins)
// on WhiteboardDocument:
toSnapshot(): Snapshot;                                      // records in all() order
static fromSnapshot(json: unknown): WhiteboardDocument;
```

A later schema version adds its migration in `parseSnapshot` (one function per version step); version 1 has none.

- [ ] **Step 1: Write the failing tests.**

```ts
it('round-trips through JSON', () => {
    const doc = new WhiteboardDocument([rect('a'), pen('p'), note('n'), text('t'), arrow('r')]);
    const copy = WhiteboardDocument.fromSnapshot(JSON.parse(JSON.stringify(doc.toSnapshot())));
    expect(copy.all()).toEqual(doc.all());
});
it.each([[null], ['x'], [{ schema: 'other', version: 1, records: [] }], [{ schema: SNAPSHOT_SCHEMA, version: 2, records: [] }], [{ schema: SNAPSHOT_SCHEMA, records: [] }]])(
    'rejects %j', bad => { expect(() => parseSnapshot(bad)).toThrow(SnapshotError); }
);
it('drops records it cannot use and keeps the rest', () => {
    const records = [rect('a'), { ...rect('b'), w: 'wide' }, { ...rect('c'), type: 'star' }, { ...rect('d'), style: { color: 'pink', size: 'm', fill: 'none' } }, rect('a')];
    expect(parseSnapshot({ schema: SNAPSHOT_SCHEMA, version: 1, records }).map(s => s.id)).toEqual(['a']);
});
```

- [ ] **Step 2: Run** `cd packages/board && bun test test/whiteboard/snapshot.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(board): save and load whiteboard snapshots`.

### Task 6: Geometry

**Files:**
- Create: `src/whiteboard/geometry/box.ts`, `text.ts`, `bounds.ts`, `hit-test.ts`, `simplify.ts`
- Test: `test/whiteboard/geometry.test.ts`

**Interfaces:**
- Produces:

```ts
export interface Box { x: number; y: number; w: number; h: number }
export function unionBoxes(boxes: Box[]): Box | null;
export function boxContainsBox(outer: Box, inner: Box): boolean;
export function boxesOverlap(a: Box, b: Box): boolean;
export function normalizeBox(x1: number, y1: number, x2: number, y2: number): Box;

export type TextMeasure = (text: string, font: string) => number;
export interface TextEnv { measure: TextMeasure; family: string }
export const LINE_HEIGHT = 1.25;
export const NOTE_PADDING = 14;
export function textFont(size: ShapeSize, family: string): string;          // `700 ${FONT_SIZE[size]}px ${family}`
export function textLines(shape: TextShape | NoteShape, env: TextEnv): string[]; // text: split on '\n'; note: each paragraph word-wrapped to w - 2 * NOTE_PADDING (a word longer than the width gets its own line)

export function shapeBounds(shape: Shape, env: TextEnv): Box;   // world AABB including half the stroke width; text: widest line × lines * size * LINE_HEIGHT (min width size / 2)
export function hitShape(shape: Shape, p: Point, tolerance: number, env: TextEnv): boolean;
export function shapesInBox(shapes: readonly Shape[], box: Box, env: TextEnv): Shape[]; // fully inside
export function simplifyPoints(points: [number, number][], tolerance: number): [number, number][]; // Ramer–Douglas–Peucker, keeps both ends
export function roundPoints(points: [number, number][], decimals?: number): [number, number][];    // default 2
```

Hit rules (spec): strokes within `tolerance` (arrows and lines: distance to the segment; pen: to any segment of the polyline, or to the single point; unfilled rect / ellipse: distance to the outline); filled rect / ellipse, notes and text anywhere inside their box (ellipse: inside the ellipse) or within `tolerance` of the outline. Tolerance is already in world units: callers pass `6 / zoom`.

- [ ] **Step 1: Write the failing tests** (`env` uses `measure: (t, f) => t.length * parseFloat(f.split(' ')[1]) * 0.5`):

```ts
it('unfilled rectangles hit on the outline only', () => {
    const r = rect('a', { x: 0, y: 0, w: 100, h: 50 });
    expect(hitShape(r, { x: 50, y: 25 }, 6, env)).toBe(false);
    expect(hitShape(r, { x: 50, y: 3 }, 6, env)).toBe(true);
    expect(hitShape({ ...r, style: { ...r.style, fill: 'hachure' } }, { x: 50, y: 25 }, 6, env)).toBe(true);
});
it('tolerance follows zoom', () => {
    const l = line('l', { x: 0, y: 0, end: [100, 0] });
    expect(hitShape(l, { x: 50, y: 20 }, 6 / 0.25, env)).toBe(true);  // 24 world units at zoom 0.25
    expect(hitShape(l, { x: 50, y: 2 }, 6 / 4, env)).toBe(false);     // 1.5 world units at zoom 4
});
it('ellipses hit inside only when filled', () => { /* w 100 h 50 at origin: centre (50,25) no; with solid yes; (50, 1) yes */ });
it('a one-point pen stroke hits near the point', () => { /* points [[0,0]] at x 10 y 10: (13,10) yes, (30,10) no */ });
it('notes wrap to their width', () => {
    const n = note('n', { w: 200, text: 'aaaa bbbb cccc dddd eeee' });
    expect(textLines(n, env).length).toBeGreaterThan(1);
    for (const l of textLines(n, env)) expect(env.measure(l, textFont('m', env.family))).toBeLessThanOrEqual(200 - 2 * NOTE_PADDING);
});
it('text bounds grow with lines', () => { /* 'a\nb' is taller than 'a' */ });
it('marquee selects only shapes fully inside', () => { /* box 0..100 contains rect 10..20, not rect 90..120 */ });
it('simplify keeps the ends and drops collinear points', () => {
    const pts = Array.from({ length: 5000 }, (_, i) => [i, Math.sin(i / 400) * 0.1] as [number, number]);
    const out = simplifyPoints(pts, 0.5);
    expect(out[0]).toEqual(pts[0]); expect(out.at(-1)).toEqual(pts.at(-1));
    expect(out.length).toBeLessThan(100);
});
```

- [ ] **Step 2: Run** `cd packages/board && bun test test/whiteboard/geometry.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** RDP iteratively (an explicit stack) so a 50,000-point stroke can't overflow the call stack.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(board): add whiteboard geometry and hit-testing`.

### Task 7: The sketch generator

**Files:**
- Create: `src/whiteboard/render/random.ts`, `render/sketch.ts`
- Test: `test/whiteboard/sketch.test.ts`

**Interfaces:**
- Consumes: Task 2 types, `shapeBounds` (Task 6) in tests only.
- Produces:

```ts
export function seededRandom(seed: number): () => number;   // mulberry32, values in [0, 1)
export type PathOp = ['M', number, number] | ['L', number, number] | ['C', number, number, number, number, number, number] | ['Z'];
export interface SketchPart { kind: 'stroke' | 'fill'; role: 'outline' | 'hachure' | 'solid' | 'paper'; ops: PathOp[] }
export function sketchShape(shape: Shape): SketchPart[];      // [] for text; world coordinates
export function noteTilt(shape: NoteShape): number;           // radians in [-0.035, 0.035], from the seed
```

What each type produces (spec "Sketchy generator"):
- rect: `outline` stroke = four rough lines (each two passes, slightly offset and bowed Béziers); `hachure` stroke when `fill === 'hachure'`; `solid` fill (jittered closed outline) when `'solid'`.
- ellipse: `outline` = jittered closed curve drawn twice with an overlap (18 points, Catmull-Rom to Béziers); hachure / solid as for rect.
- Hachure: parallel lines at −41°, gap `4 + 2 × STROKE_WIDTH[size]` world units, clipped analytically (Liang–Barsky for the rect; the quadratic in the ellipse's unit-circle space for the ellipse), each a one-pass rough line at roughness 0.6.
- arrow: shaft (two passes) plus two head strokes of length `min(20, 0.3 × length)` at ±0.5 rad; line: the shaft only.
- pen: one `outline` stroke, the points smoothed (`[a + 2p + c] / 4`) and joined with quadratic midpoints, no wobble; one point → a tiny `L` so round caps draw a dot.
- note: one `paper` fill: the box with each corner jittered by up to 1.8 units.
- Roughness offsets scale as `min(2.4, length × 0.05 + 0.6)` so short lines stay tidy. All randomness comes from `seededRandom(shape.seed)`.

- [ ] **Step 1: Write the failing tests.**

```ts
it('is a pure function of the record', () => {
    for (const s of sampleShapes()) expect(sketchShape(s)).toEqual(sketchShape(structuredClone(s)));
});
it('the seed changes the wobble', () => {
    const a = rect('a', { seed: 1 }); expect(sketchShape(a)).not.toEqual(sketchShape({ ...a, seed: 2 }));
});
it('stays near the shape', () => {
    for (const s of sampleShapes()) {
        const b = shapeBounds(s, env); const margin = 6;
        for (const part of sketchShape(s)) for (const op of part.ops) for (let i = 1; i < op.length; i += 2) {
            const x = op[i] as number, y = op[i + 1] as number;
            expect(x).toBeGreaterThanOrEqual(b.x - margin); expect(x).toBeLessThanOrEqual(b.x + b.w + margin);
            expect(y).toBeGreaterThanOrEqual(b.y - margin); expect(y).toBeLessThanOrEqual(b.y + b.h + margin);
        }
    }
});
it('fills only when asked', () => {
    const r = rect('a');
    expect(sketchShape(r).map(p => p.role)).toEqual(['outline']);
    expect(sketchShape({ ...r, style: { ...r.style, fill: 'hachure' } }).map(p => p.role).sort()).toEqual(['hachure', 'outline']);
    expect(sketchShape({ ...r, style: { ...r.style, fill: 'solid' } }).map(p => p.role).sort()).toEqual(['outline', 'solid']);
});
it('text has no sketch and notes are paper', () => { /* text → []; note → [{ kind: 'fill', role: 'paper' }] */ });
it('note tilt is small and stable', () => { /* |noteTilt| <= 0.035, same for the same seed */ });
```

`sampleShapes()` returns one of each type, rect and ellipse in all three fills, at non-zero positions.

- [ ] **Step 2: Run** `cd packages/board && bun test test/whiteboard/sketch.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** A rough line from `(x1, y1)` to `(x2, y2)`, per pass: offset both ends by up to `o` (pass 2: `1.4 o`), bow both Bézier control points (at 35% and 70% along) sideways by the same random `bow` of up to `min(0.012 × length, 3)`, and jitter each control point by up to `0.4 o`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(board): add the sketchy shape generator`.

### Task 8: Theme, painter, overlay drawing and the benchmark

**Files:**
- Create: `src/whiteboard/render/theme.ts`, `render/painter.ts`, `render/overlay.ts`, `bench/whiteboard.bench.ts`
- Test: `test/whiteboard/painter.test.ts`

**Interfaces:**
- Consumes: `sketchShape`, `noteTilt` (Task 7); `textLines`, `textFont`, `LINE_HEIGHT`, `NOTE_PADDING`, `Box` (Task 6).
- Produces:

```ts
export interface WhiteboardTheme {
    colors: Record<ColorName, string>; paper: Record<ColorName, string>; paperText: string;
    selection: string; fonts: { hand: string };
}
export const DEFAULT_THEME: WhiteboardTheme; // colors ink #1e1e1e red #e03131 blue #1971c2 green #2f9e44 orange #f08c00;
                                             // paper ink #fff0a3 red #ffc9c9 blue #a5d8ff green #b2f2bb orange #ffd8a8; paperText #3d3300;
                                             // selection #4f7a33; fonts.hand "'Caveat', 'Segoe Print', 'Comic Sans MS', cursive"
export interface PaintOptions { faded?: boolean; hideText?: boolean }
export class ShapePainter {
    constructor(options?: { createPath?: () => Path2D });   // default () => new Path2D()
    paint(ctx: CanvasRenderingContext2D, shape: Shape, theme: WhiteboardTheme, env: TextEnv, options?: PaintOptions): void;
    get cacheSize(): number;                                  // for tests: paths built so far
}
export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'start' | 'end';
export interface Handle { id: HandleId; x: number; y: number }   // world centre
export function drawSelectionOverlay(ctx: CanvasRenderingContext2D, overlay: {
    selection: Box | null; handles: Handle[]; marquee: Box | null; zoom: number;
}, theme: WhiteboardTheme): void;  // 1.5 px outline, 8 px square handles, marquee with 10% fill, all constant on screen (divide by zoom)
```

`paint`: builds each `SketchPart`'s `Path2D` once per record object (`WeakMap<Shape, Path2D[]>`); colours and widths at draw time (`outline` and arrow heads: `colors[color]`, `STROKE_WIDTH[size]`; `hachure`: same colour, width `STROKE_WIDTH[size] / 2`; `solid`: same colour at `globalAlpha 0.25`; `paper`: `paper[color]`); round caps and joins; notes are drawn rotated by `noteTilt` about their centre, with text in `paperText` at `NOTE_PADDING`; text shapes in `colors[color]`, `textBaseline 'top'`, one `fillText` per line; `faded` multiplies alpha by 0.3; `hideText` skips text. `ctx.save()` / `restore()` around each shape.

- [ ] **Step 1: Write the failing tests** with a recording fake context (records method calls and property sets) and `createPath` returning a fake that records ops:

```ts
it('builds paths once per record', () => {
    const p = new ShapePainter({ createPath: fakePath }); const r = rect('a');
    p.paint(ctx, r, DEFAULT_THEME, env); p.paint(ctx, r, DEFAULT_THEME, env);
    expect(p.cacheSize).toBe(1);
    p.paint(ctx, { ...r, x: 5 }, DEFAULT_THEME, env);
    expect(p.cacheSize).toBe(2);
});
it('colours come from the theme at draw time', () => {
    const p = new ShapePainter({ createPath: fakePath }); const r = rect('a', { style: { color: 'red', size: 'm', fill: 'none' } });
    p.paint(ctx, r, { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, red: '#ff0000' } }, env);
    expect(ctx.sets('strokeStyle')).toContain('#ff0000');
});
it('hideText skips text and faded lowers alpha', () => { /* text shape: no fillText with hideText; faded: globalAlpha <= 0.3 */ });
it('overlay sizes stay constant on screen', () => {
    drawSelectionOverlay(ctx, { selection: box, handles, marquee: null, zoom: 4 }, DEFAULT_THEME);
    expect(ctx.sets('lineWidth')).toContain(1.5 / 4);
    // handle rects are 8 / 4 = 2 world units wide
});
```

- [ ] **Step 2: Run** `cd packages/board && bun test test/whiteboard/painter.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Write the benchmark** `bench/whiteboard.bench.ts`: 500 shapes (100 rects and ellipses split across fills, 300 pen strokes of 100 points each = 30,000 points, 50 notes, 50 arrows) plus 200 more pen strokes of 100 points (50,000 points total); time `sketchShape` for all (cold) and one warm `paint` pass of all with the fake context, over 20 runs; print median ms for each and exit 1 if the warm pass median exceeds 4 ms.
- [ ] **Step 6: Run** `cd packages/board && bun run bench/whiteboard.bench.ts`. Expected: prints both medians; warm pass under 4 ms.
- [ ] **Step 7: Commit** `feat(board): paint whiteboard shapes with cached sketch paths`.

### Task 9: The editor core: input, the tool machine host, the hand tool and the `Editor` shell

**Files:**
- Create: `src/whiteboard/editor/events.ts`, `editor/pointer-input.ts`, `editor/tool-context.ts`, `editor/editor-machine.ts`, `editor/selection.ts` (the `Selection` class only), `editor/tools/hand.ts`, `editor/editor.ts`, `editor/text-input.ts` (interface only in this task)
- Modify: `src/whiteboard/index.ts` (export everything public so far)
- Test: `test/whiteboard/pointer-input.test.ts`, `test/whiteboard/editor-hand.test.ts`, `test/whiteboard/helpers.ts` (shared by later tasks: `makeEditor(options?)` → `{ board, editor }`; `mouse(x, y, extra?)` and `touch(id, x, y)` building `PointerSample`s; `click(editor, p, extra?)`, `drag(editor, from, to, extra?)` with 10 intermediate moves, `dragPath(editor, points)`; `only(editor)` returning the single shape; builders `rect`, `ellipse`, `arrow`, `line`, `pen`, `text`, `note` taking `(id, overrides?)`; `env`, the fake `TextEnv`)

**Interfaces:**
- Consumes: Tasks 2–8. From board: `Board`, `board.getCameraRig().panByViewPort`, `board.camera.zoomLevel`, `board.camera.viewPortWidth/Height`, `board.camera.convertFromViewPort2WorldSpace`, `board.convertWindowPoint2WorldCoord`, `board.kmtInputStateMachine?.currentState`, `board.touchInputStateMachine?.context.updateTouchPoints`. From being: `TemplateStateMachine`, `TemplateState`, `DelegatingState`, `BaseContext`, `EventReactions`, `Guard`, `EventGuards`, `NO_OP`.
- Produces (`events.ts`):

```ts
export const TOOL_NAMES = ['hand', 'select', 'rect', 'ellipse', 'arrow', 'line', 'pen', 'text', 'note', 'eraser'] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export interface PointerSample {
    id: number; pointerType: 'mouse' | 'pen' | 'touch'; button: number; client: Point;
    shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; timeStamp: number;
}
export interface ToolPointer {
    world: Point; client: Point; delta: Point;   // client px since the previous dispatched point; the first drag move measures from the press
    pressed: boolean; dragging: boolean;         // dragging: moved past DRAG_SLOP since the press
    button: number; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; pointerType: PointerSample['pointerType'];
}
export type ToolEvents = { pointerDown: ToolPointer; pointerMove: ToolPointer; pointerUp: ToolPointer; doubleClick: ToolPointer; cancel: {}; pickTool: {} };
export const DRAG_SLOP = 5; export const DOUBLE_CLICK_MS = 400; export const DOUBLE_CLICK_SLOP = 6; export const HIT_TOLERANCE_PX = 6;
```

- Produces (`pointer-input.ts`):

```ts
export interface PointerInputDeps {
    toWorld(client: Point): Point;
    boardBusy(): boolean;                  // board's KMT machine is not IDLE
    ownsPointer(client: Point): boolean;   // the app's screen-space controls take this press
    dispatch(event: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'doubleClick' | 'cancel', payload: ToolPointer | {}): void;
    middleClick(pointer: ToolPointer): void;
    setCursor(cursor: string | null): void; // null: let the tool decide
}
export class PointerInput {
    constructor(deps: PointerInputDeps);
    down(s: PointerSample): void; move(s: PointerSample): void; up(s: PointerSample): void;
    cancel(): void;                         // pointercancel, lostpointercapture, blur
    get pressed(): boolean;
}
```

Rules: a primary-button (or touch / pen contact) press starts a gesture unless `boardBusy()` or `ownsPointer()`; a second pointer while a gesture is open dispatches `cancel` and swallows every event until all pointers are up; a middle press is tracked only to report `middleClick` when it is released within `DRAG_SLOP`; hover moves (nothing pressed, mouse only) dispatch `pointerMove` with `pressed: false`, except over `ownsPointer` areas, where the cursor is set to `pointer` and nothing is dispatched; two primary clicks within `DOUBLE_CLICK_MS` and `DOUBLE_CLICK_SLOP` dispatch `doubleClick` after the second `pointerUp`.

- Produces (`tool-context.ts`):

```ts
export interface EditorBackground {
    hitTest?(world: Point): boolean;                     // clickable things under the drawing (hand and select only)
    activate?(world: Point, pointer: ToolPointer): void;
    ownsPointer?(client: Point): boolean;                // screen-space controls over the drawing, any tool
}
export interface ToolServices {
    doc: WhiteboardDocument; history: History; env: TextEnv;
    zoom(): number; panByScreen(delta: Point): void;
    shapeAt(world: Point): Shape | null;                 // topmost hit at HIT_TOLERANCE_PX / zoom
    shapesInBox(box: Box): Shape[];
    background: Required<Pick<EditorBackground, 'hitTest' | 'activate'>>;
    selection: Selection;
    style(): ShapeStyle;
    setCursor(cursor: string): void;
    requestTool(tool: ToolName, select?: string[]): void; // applied after the current event
    editText(id: string): void;                          // Task 13
    overlay: { marquee: Box | null; erasing: Set<string> };
}
export type ToolContext = ToolServices & BaseContext;    // one object per tool machine; setup / cleanup no-ops
export function toolContext(services: ToolServices): ToolContext;
```

- Produces (`selection.ts`): `export class Selection { get ids(): readonly string[]; has(id: string): boolean; set(ids: string[]): void; toggle(id: string): void; clear(): void; prune(doc: WhiteboardDocument): void /* drop ids no longer in the document */; subscribe(listener: () => void): () => void }`.

- Produces (`editor-machine.ts`): `interface EditorMachineContext extends BaseContext { requestedTool: ToolName }`; `createEditorMachine(machines: Record<ToolName, HostableStateMachine>, ctx: EditorMachineContext, initial: ToolName)` returning a `TemplateStateMachine<ToolEvents, EditorMachineContext, ToolName>`; each state is a `DelegatingState` hosting that tool's machine, with a `pickTool` reaction whose `eventGuards` route to the tool named by `ctx.requestedTool`. Tools without a machine yet (filled in later tasks) host a machine with a single `IDLE` state that handles nothing.

- Produces (`editor.ts`):

```ts
export interface EditorOptions {
    board: Board;
    canvas?: HTMLCanvasElement;          // DOM pointer and key listeners attach here and on its window; omit to drive editor.input yourself
    document?: WhiteboardDocument;
    textInput?: TextInput;               // default: DomTextInput on overlayParent (Task 13)
    overlayParent?: HTMLElement;         // default canvas.parentElement
    theme?: Partial<WhiteboardTheme>;
    background?: EditorBackground;
    initialTool?: ToolName;              // default 'hand'
}
export interface EditorState {
    tool: ToolName; selection: readonly string[]; style: ShapeStyle; selectionStyle: Partial<ShapeStyle> | null;
    canUndo: boolean; canRedo: boolean; empty: boolean; editingText: boolean;
}
export class Editor {
    constructor(options: EditorOptions);
    readonly document: WhiteboardDocument; readonly history: History; readonly input: PointerInput;
    get tool(): ToolName; setTool(tool: ToolName): void;        // cancels an open gesture first
    getState(): EditorState; subscribe(listener: (state: EditorState) => void): () => void;
    toWorld(client: Point): Point;
    setTheme(theme: Partial<WhiteboardTheme>): void; getTheme(): WhiteboardTheme;
    draw(ctx: CanvasRenderingContext2D): void;                   // culled shapes in index order, then the selection overlay
    destroy(): void;
    // added by later tasks: setStyle, undo, redo, clear, deleteSelection, selectAll
}
```

DOM wiring when `canvas` is given: `pointerdown/move/up/cancel` and `lostpointercapture` on the canvas (capture the pointer on down), `touchmove` (passive) keeping the board's touch record current exactly as `onTouchMove` in the docs' `canvas-home.ts` does, `blur` on its window → `input.cancel()`. `draw` culls with the visible world box from the camera's four viewport corners. Text measuring uses a private offscreen 2D context when a DOM exists, otherwise `text.length × size × 0.5`.

Hand machine (`tools/hand.ts`): `IDLE → PRESSED` on `pointerDown`; `PRESSED → PANNING` on a `dragging` `pointerMove` (pan by `-delta`); `PRESSED → IDLE` on `pointerUp`, where a click with no `shapeAt` and `background.hitTest` calls `background.activate`; `PANNING → IDLE` on `pointerUp`; `cancel` → `IDLE`. Cursor: `grab`, `grabbing` while panning, `pointer` over a background hit with no shape on top. `Editor` also handles `middleClick` the same way while the tool is hand or select.

- [ ] **Step 1: Write the failing tests.** `makeEditor()` builds `new Board()` (with the observer stubs from `test/boardify/input-mode.test.ts`) and an `Editor` without a canvas; `click`/`drag` feed `editor.input` with `PointerSample`s.

```ts
// pointer-input.test.ts, with a recording PointerInputDeps
it('a press within the slop is a click', () => { /* down (0,0), move (3,0), up → events: pointerDown, pointerMove(dragging false), pointerUp */ });
it('the first drag move measures from the press', () => { /* down (0,0), move (8,0) → delta {8,0}, dragging true */ });
it('a second finger cancels and swallows', () => {
    in_.down(touch(1, 0, 0)); in_.move(touch(1, 10, 0)); in_.down(touch(2, 50, 50)); in_.move(touch(1, 20, 0)); in_.up(touch(1, 20, 0)); in_.up(touch(2, 50, 50));
    expect(names()).toEqual(['pointerDown', 'pointerMove', 'cancel']);
});
it('stands aside while the board is busy', () => { /* boardBusy true → nothing dispatched for the whole press */ });
it('screen controls own their presses', () => { /* ownsPointer true → nothing dispatched; hover over it sets cursor 'pointer' */ });
it('lost capture cancels', () => { /* down, move, cancel() → last event 'cancel'; a later up dispatches nothing */ });
it('double click', () => { /* two clicks 100 ms apart, 2 px apart → doubleClick after the second pointerUp; 500 ms apart → none */ });
it('middle click reports, middle drag does not', () => { /* button 1 down/up at same spot → middleClick once; with an 8 px move → none */ });

// editor-hand.test.ts
it('maps client to world at zoom 1', () => { expect(editor.toWorld({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 }); });
it('hand drag pans the camera', () => { drag(editor, { x: 0, y: 0 }, { x: 100, y: 0 }); expect(board.camera.position.x).toBeCloseTo(-100); });
it('hand click activates the background', () => { /* background.hitTest true → activate called once with world point */ });
it('a shape over the background wins', () => { /* put a filled rect over (50,50); click (50,50) → activate not called */ });
it('a drag never activates', () => { /* drag from a background hit → activate not called */ });
it('setTool notifies subscribers', () => { /* subscribe; setTool('pen') → listener sees tool 'pen' */ });
```

- [ ] **Step 2: Run** `cd packages/board && bun test test/whiteboard/pointer-input.test.ts test/whiteboard/editor-hand.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the files listed. Export the public API from `src/whiteboard/index.ts` (document, history, snapshot, geometry, render, `Editor`, `EditorOptions`, `EditorState`, `EditorBackground`, `ToolName`, `TOOL_NAMES`, `PointerInput`, `PointerSample`).
- [ ] **Step 4: Run** `bunx nx test board`. Expected: PASS, including the import guard.
- [ ] **Step 5: Commit** `feat(board): add the whiteboard editor with the hand tool`.

### Task 10: Creation tools: rectangle, ellipse, arrow, line, pen

**Files:**
- Create: `src/whiteboard/editor/tools/box-tool.ts`, `tools/segment-tool.ts`, `tools/pen.ts`
- Modify: `editor/editor.ts` (register the machines; add `undo()`, `redo()`)
- Test: `test/whiteboard/editor-create.test.ts`

**Interfaces:**
- Consumes: `ToolContext`, `ToolEvents` (Task 9), `History.begin/end/cancel` (Task 4), `doc.nextIndex()`, `createId`, `createSeed`, `simplifyPoints`, `roundPoints`.
- Produces: `createBoxTool(ctx: ToolContext, type: 'rect' | 'ellipse')`, `createSegmentTool(ctx, type: 'arrow' | 'line')`, `createPenTool(ctx)`, each a `TemplateStateMachine<ToolEvents, ToolContext, 'IDLE' | 'CREATING'>` (pen: `'IDLE' | 'DRAWING'`). `Editor.undo(): void`, `Editor.redo(): void` (each cancels an open gesture first).

Behaviour (spec table):
- Box: `pointerDown` begins a history step and puts a zero-size record at the press with the current style; drags resize corner to corner (normalized); Shift makes it square / circular (side = max(|dx|, |dy|), keeping the drag's signs); a click without dragging makes a 160 × 100 shape centred on the click; `pointerUp` ends the step and requests Select with the new shape selected.
- Segment: drag from start to end, Shift snaps the angle to 15°; a click makes a 160-unit segment to the right; then Select as above.
- Pen: `pointerDown` begins and puts a one-point record; moves append points at least `0.5 / zoom` world units from the last one; `pointerUp` replaces the points with `roundPoints(simplifyPoints(points, 0.5))` and ends the step; the tool stays Pen.
- `cancel` in any creating state calls `history.cancel()` and returns to `IDLE`.

- [ ] **Step 1: Write the failing tests.**

```ts
it('drags a rectangle corner to corner, either direction', () => {
    editor.setTool('rect'); drag(editor, { x: 100, y: 80 }, { x: 20, y: 10 });
    expect(only(editor)).toMatchObject({ type: 'rect', x: 20, y: 10, w: 80, h: 70 });
    expect(editor.tool).toBe('select'); expect(editor.getState().selection).toEqual([only(editor).id]);
});
it('Shift makes a circle', () => { /* ellipse drag (0,0)→(100,40) with shift → w 100, h 100 */ });
it('a click makes a default shape', () => { /* rect click at (0,0) → x -80, y -50, w 160, h 100 */ });
it('Shift snaps arrows to 15 degrees', () => { /* arrow drag (0,0)→(100,8) shift → end[1] 0 */ });
it('pen keeps drawing and thins points by screen distance', () => {
    editor.setTool('pen'); dragPath(editor, Array.from({ length: 50 }, (_, i) => ({ x: i * 0.2, y: 0 })));
    expect(editor.tool).toBe('pen'); expect((only(editor) as PenShape).points.length).toBeLessThan(25);
});
it('a pen tap leaves a dot', () => { /* click → pen with 1 point */ });
it('one gesture is one undo step', () => { /* draw a rect with 10 moves; undo → empty; redo → 1 shape */ });
it('new shapes stack on top', () => { /* two rects → second index > first */ });
it('drawing tools ignore the background', () => { /* background.hitTest true; rect click there → activate not called, one rect created */ });
it('undo mid-drag cancels the gesture', () => {
    editor.setTool('rect'); editor.input.down(mouse(0, 0)); editor.input.move(mouse(50, 50));
    editor.undo();
    expect(editor.document.size).toBe(0); expect(editor.history.canRedo).toBe(false);
    editor.input.up(mouse(50, 50)); expect(editor.document.size).toBe(0);
});
it('a second finger cancels a stroke', () => { /* pen touch down, move, second touch → document empty, canUndo false */ });
```

- [ ] **Step 2: Run** `cd packages/board && bun test test/whiteboard/editor-create.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `bunx nx test board`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(board): draw rectangles, ellipses, arrows, lines and pen strokes`.

### Task 11: Select: click, Shift, marquee, move, resize, endpoints

**Files:**
- Create: `src/whiteboard/editor/tools/select.ts`
- Modify: `editor/selection.ts` (add the geometry below), `editor/editor.ts` (`deleteSelection()`, `selectAll()`, overlay drawing in `draw`)
- Test: `test/whiteboard/selection.test.ts`, `test/whiteboard/editor-select.test.ts`

**Interfaces:**
- Consumes: Task 6 geometry, Task 8 `drawSelectionOverlay`, Task 9 context.
- Produces (`selection.ts`):

```ts
// Selection (Task 9) stays; HandleId and Handle come from render/overlay.ts (Task 8)
export function selectionBox(shapes: Shape[], env: TextEnv): Box | null;
export function handlesFor(shapes: Shape[], env: TextEnv): Handle[]; // one line/arrow → 'start' and 'end'; one text shape → none; otherwise the 8 box handles
export function handleAt(handles: Handle[], world: Point, zoom: number): HandleId | null; // within 8 screen px
export function resizeBox(start: Box, handle: HandleId, delta: Point, keepAspect: boolean): Box; // never negative: crossing flips
export function resizeShape(shape: Shape, from: Box, to: Box): Shape; // scales x/y/w/h, end, points; text moves only
```

Select machine states: `IDLE`, `POINTING_SHAPE`, `MOVING`, `POINTING_HANDLE`, `RESIZING`, `POINTING_EMPTY`, `MARQUEE`. Rules (spec): a press on a shape selects it (Shift toggles) and a drag moves the whole selection from the press point (applied to the records as they were at the press); a press on a handle and a drag resizes (Shift keeps the aspect; line/arrow `start`/`end` move that endpoint); a press on empty canvas and a drag draws a marquee selecting shapes fully inside (Shift adds); a click on empty canvas clears the selection unless Shift is held, and activates the background when `hitTest` is true; `doubleClick` on a text or note calls `editText`; every move or resize is one history step; `cancel` reverts. Cursors: `default`, `move` over a selected shape, resize cursors over handles, `pointer` over a background hit with nothing on top. The selection is pruned on every document change (undo can remove selected shapes).

- [ ] **Step 1: Write the failing tests.**

```ts
// selection.test.ts
it('resizing past the opposite edge flips instead of going negative', () => {
    expect(resizeBox({ x: 0, y: 0, w: 100, h: 50 }, 'e', { x: -150, y: 0 }, false)).toEqual({ x: -50, y: 0, w: 50, h: 50 });
});
it('keepAspect holds the ratio from a corner', () => { /* 'se' delta (100, 0) on 100×50 → 200×100 */ });
it('resizeShape scales pen points and keeps text size', () => { /* … */ });
it('handles are found within 8 screen px at any zoom', () => {
    const hs = handlesFor([rect('a', { x: 0, y: 0, w: 100, h: 100 })], env);
    expect(handleAt(hs, { x: 100 + 7 / 4, y: 100 }, 4)).toBe('se');
    expect(handleAt(hs, { x: 100 + 9 / 4, y: 100 }, 4)).toBe(null);
    expect(handleAt(hs, { x: 100 + 30, y: 100 }, 0.25)).toBe('se');
});
// editor-select.test.ts
it('click selects, Shift-click adds, empty click clears', () => { /* … */ });
it('dragging moves every selected shape as one step', () => { /* two selected rects moved by (30, 0); undo restores both */ });
it('marquee selects shapes fully inside', () => { /* … */ });
it('dragging an arrow end moves only that end', () => { /* … */ });
it('Delete removes the selection as one step', () => { /* deleteSelection(); undo brings both back */ });
it('a shape over the background is selected, the background is not activated', () => { /* … */ });
it('an empty click on the background activates it', () => { /* … */ });
it('undo prunes the selection', () => { /* create rect (selected); undo → selection [] */ });
```

- [ ] **Step 2: Run** `cd packages/board && bun test test/whiteboard/selection.test.ts test/whiteboard/editor-select.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `bunx nx test board`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(board): select, move and resize whiteboard shapes`.

### Task 12: Eraser

**Files:**
- Create: `src/whiteboard/editor/tools/eraser.ts`
- Modify: `editor/editor.ts` (register; draw `overlay.erasing` shapes with `faded`)
- Test: `test/whiteboard/editor-eraser.test.ts`

**Interfaces:**
- Produces: `Editor.erasing: ReadonlySet<string>` (shapes the eraser has marked, drawn faded). `createEraserTool(ctx: ToolContext)`: `IDLE → ERASING` on `pointerDown` (marks `shapeAt`), each move marks every shape hit along the segment from the previous point (sampled every `HIT_TOLERANCE_PX / zoom`), `pointerUp` removes all marked in one step and clears the marks (a tap removes the topmost hit); `cancel` clears marks without removing. The tool stays Eraser.

- [ ] **Step 1: Write the failing tests.**

```ts
it('a drag across shapes erases them all in one step', () => { /* three lines crossed by a drag → document empty; undo → 3 */ });
it('marked shapes are faded until release', () => { /* mid-drag over two of three: editor.erasing.size === 2, document.size === 3 */ });
it('a fast drag between samples still hits', () => { /* move from (0,50) to (200,50) in one event across a vertical line at x 100 → erased */ });
it('cancel erases nothing', () => { /* down, move over a shape, input.cancel() → shape remains, canUndo false */ });
```

- [ ] **Step 2: Run** `cd packages/board && bun test test/whiteboard/editor-eraser.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `bunx nx test board`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(board): erase whiteboard shapes`.

### Task 13: Text, notes and text editing

**Files:**
- Create: `src/whiteboard/editor/tools/place-tool.ts`; fill in `editor/text-input.ts`
- Modify: `editor/editor.ts` (`editText`, reposition every `draw`, `hideText` for the shape being edited, `editingText` in state)
- Test: `test/whiteboard/editor-text.test.ts`, `test/whiteboard/text-input.test.ts`

**Interfaces:**
- Produces (`text-input.ts`):

```ts
export interface TextInputSession {
    text: string; font: string; color: string; lineHeight: number;
    rect: Box;                    // where the text sits, in client (CSS) pixels relative to overlayParent
    scale: number;                // camera zoom
    wrap: boolean;                // notes wrap; text shapes grow
    onInput(text: string): void; onCommit(text: string): void;
}
export interface TextInput {
    open(session: TextInputSession): void;
    reposition(rect: Box, scale: number): void;
    close(): void;                // commits
    get active(): boolean;
}
export class DomTextInput implements TextInput { constructor(parent: HTMLElement) }
```

`Editor` computes `rect` from the shape's world box with `camera.convertFromWorld2ViewPort` plus half the viewport size (canvas-local CSS pixels), plus `canvas.offsetLeft` / `offsetTop` when a canvas is given. `DomTextInput` creates one `<textarea>` with `parent.ownerDocument`, absolutely positioned (`left`/`top` from `rect`, `transform: scale(scale)` with origin top left, font and line height unscaled), transparent background, no border or resize handle, `spellcheck=false`; Enter inserts a newline; Escape and `blur` commit; `input` events call `onInput` (IME composition included, since the browser composes into the textarea).

- Produces: `createPlaceTool(ctx, type: 'text' | 'note')`: a click (a drag counts as a click at its press point) puts a text record (`text: ''`, top-left at the click) or a `NOTE_SIZE` note centred on the click, with the current style, inside one history step that stays open through editing; then `editText(id)` and `requestTool('select', [id])`. `Editor.editText(id)` opens the session; `onInput` puts the updated text; `onCommit` removes the shape when the trimmed text is empty (a new empty text) or keeps an empty note, then ends the step. Editing an existing shape (double-click from Select) begins its own step.

- [ ] **Step 1: Write the failing tests** (`editor-text.test.ts` passes a fake `TextInput` that records sessions and lets the test call `onInput` / `onCommit`; `text-input.test.ts` uses `new JSDOM()` for a parent element):

```ts
it('placing text opens editing and typing updates the shape', () => {
    editor.setTool('text'); click(editor, { x: 10, y: 20 });
    fake.session.onInput('Hello'); expect((only(editor) as TextShape).text).toBe('Hello');
    fake.session.onCommit('Hello'); expect(editor.tool).toBe('select');
    editor.undo(); expect(editor.document.size).toBe(0);   // placing + typing is one step
});
it('empty text is removed when editing ends, empty notes stay', () => { /* … */ });
it('double-click edits an existing note', () => { /* note exists; select tool; double click → session.text equals the note text */ });
it('the session follows the camera', () => { /* open; board.getCameraRig().panByViewPort({ x: 50, y: 0 }); editor.draw(fakeCtx) → last reposition rect.x is 50 less than the opening rect.x */ });
it('the shape being edited hides its own text', () => { /* draw while editing → no fillText of that text */ });
// text-input.test.ts
it('opens a textarea and commits on Escape', () => { /* parent.querySelector('textarea') exists; dispatch keydown Escape → onCommit called, textarea removed */ });
it('Enter adds a line', () => { /* keydown Enter not prevented */ });
```

- [ ] **Step 2: Run** `cd packages/board && bun test test/whiteboard/editor-text.test.ts test/whiteboard/text-input.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** When text exists or a text/note tool is picked, `Editor` calls `ownerDocument.fonts?.load(textFont('m', theme.fonts.hand))` once (ignoring errors), so apps don't load the handwriting font until it's needed.
- [ ] **Step 4: Run** `bunx nx test board`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(board): add whiteboard text and sticky notes`.

### Task 14: Style, keyboard shortcuts and commands

**Files:**
- Create: `src/whiteboard/editor/keyboard.ts`
- Modify: `editor/editor.ts` (`setStyle`, `clear`, `selectionStyle` in state, window `keydown` listener when `canvas` is given, `handleKey(event)` public for custom sources)
- Test: `test/whiteboard/keyboard.test.ts`, `test/whiteboard/editor-commands.test.ts`

**Interfaces:**
- Produces:

```ts
export type EditorCommand =
    | { type: 'tool'; tool: ToolName } | { type: 'delete' } | { type: 'escape' }
    | { type: 'undo' } | { type: 'redo' } | { type: 'selectAll' };
export interface KeyLike { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean; isComposing?: boolean; target: EventTarget | null }
export function shortcutFor(event: KeyLike): EditorCommand | null;
// Editor:
setStyle(style: Partial<ShapeStyle>): void;   // next-shape style; restyles the selection as one step
clear(): void;                                // removes every shape as one step; no-op when empty
handleKey(event: KeyLike & { preventDefault(): void }): boolean; // true when handled (and default prevented)
```

Shortcut table (spec): `h v r o a l p t n e` → hand, select, rect, ellipse, arrow, line, pen, text, note, eraser (no modifiers, any case); `Delete` / `Backspace` → delete; `Escape` → escape (cancel a gesture, else clear the selection); Ctrl/Cmd+`z` → undo; Ctrl/Cmd+Shift+`z` and Ctrl+`y` → redo; Ctrl/Cmd+`a` → selectAll. Returns `null` when `isComposing`, when the target is an `input`, `textarea`, `select` or `[contenteditable]` element (checked via `target.closest`), for any other key with Ctrl/Cmd/Alt, and for Space. `Editor.handleKey` also ignores keys while text is being edited.

- [ ] **Step 1: Write the failing tests.**

```ts
it.each([['r', 'rect'], ['R', 'rect'], ['p', 'pen'], ['n', 'note']])('%s picks %s', (key, tool) => {
    expect(shortcutFor(k({ key }))).toEqual({ type: 'tool', tool });
});
it('never fires while typing', () => {
    for (const tag of ['input', 'textarea', 'select']) expect(shortcutFor(k({ key: 'r', target: el(tag) }))).toBeNull();
    expect(shortcutFor(k({ key: 'r', target: editable() }))).toBeNull();
    expect(shortcutFor(k({ key: 'r', isComposing: true }))).toBeNull();
});
it('leaves browser shortcuts alone', () => {
    expect(shortcutFor(k({ key: 'r', ctrlKey: true }))).toBeNull();     // reload
    expect(shortcutFor(k({ key: 'l', metaKey: true }))).toBeNull();     // address bar
    expect(shortcutFor(k({ key: ' ' }))).toBeNull();                    // the board's own pan
    expect(shortcutFor(k({ key: 'z', metaKey: true }))).toEqual({ type: 'undo' });
    expect(shortcutFor(k({ key: 'z', ctrlKey: true, shiftKey: true }))).toEqual({ type: 'redo' });
});
// editor-commands.test.ts
it('setStyle restyles the selection in one step and sets the next style', () => { /* … */ });
it('selectionStyle reports shared values only', () => { /* red + blue selected → { size: 'm', fill: 'none' } without color */ });
it('clear is one undoable step', () => { /* 3 shapes; clear → 0; undo → 3 */ });
it('switching tools mid-drag cancels the gesture', () => { /* rect drag in progress; setTool('pen') → document empty, canUndo false */ });
it('keys are ignored while editing text', () => { /* open text session; handleKey('r') → false, tool unchanged */ });
```

- [ ] **Step 2: Run** `cd packages/board && bun test test/whiteboard/keyboard.test.ts test/whiteboard/editor-commands.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `bunx nx test board`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(board): whiteboard styles, shortcuts and clear`.

### Task 15: The example page

**Files:**
- Create: `apps/examples/src/whiteboard/index.html`, `apps/examples/src/whiteboard/main.ts`
- Modify: `apps/examples/package.json` (`@fontsource/caveat`), `apps/examples/vite.config.js` (input `whiteboard`), `apps/examples/src/index.html` (nav link and card, following `camera-animation`), `apps/examples/src/i18n/en.ts`, `zh-TW.ts`

**Interfaces:**
- Consumes: `Board` from `@ue-too/board`; `Editor`, `WhiteboardDocument`, `TOOL_NAMES`, `COLOR_NAMES`, `ShapeSize`, `ShapeFill` from `@ue-too/board/whiteboard`.

The page: a full-window canvas (`fitToPage` is not used; the board is `fullScreen`), `followInputMode` like the other examples, a plain HTML dock along the bottom (the ten tools, undo, redo, clear, with `aria-pressed` and the shortcut in `title`), a style panel (five colours, three sizes, three fills) above it, `import '@fontsource/caveat/700.css'`, the editor drawn each frame after `board.step`, and the snapshot saved to `localStorage['ue-too-examples:whiteboard']` 400 ms after changes (read and write in try/catch). i18n keys: `nav.whiteboard`, `card.whiteboard.title`, `card.whiteboard.desc`, `whiteboard.title`, `whiteboard.desc`, `whiteboard.tool.<name>` for each tool, `whiteboard.undo`, `whiteboard.redo`, `whiteboard.clear`. en title "Whiteboard", desc "Draw shapes, arrows, pen strokes, text and sticky notes on an infinite canvas with @ue-too/board/whiteboard."; zh-TW title "白板", desc "用 @ue-too/board/whiteboard 在無限畫布上畫形狀、箭頭、筆跡、文字和便利貼。".

- [ ] **Step 1: Add the dependency** with `cd apps/examples && bun add @fontsource/caveat`, then build the page.
- [ ] **Step 2: Build** `bunx nx build examples`. Expected: success, `whiteboard/index.html` in the output.
- [ ] **Step 3: Smoke-test in Chromium** with a scratch Playwright script (not committed) against `bunx vite preview` of the build: pick Pen by pressing `p`, drag across the canvas, reload, and check `localStorage['ue-too-examples:whiteboard']` holds one record; pick Rectangle and drag; take one screenshot to look at the sketchy rendering. Expected: one stroke survives the reload; the rectangle looks hand-drawn.
- [ ] **Step 4: Commit** `feat(examples): add a whiteboard example`.

### Task 16: README, TypeDoc and the final Part 1 check

**Files:**
- Modify: `packages/board/README.md` (a "Whiteboard" section after the main usage: what it is, `import { Editor, WhiteboardDocument } from '@ue-too/board/whiteboard'`, a 20-line setup with a frame loop calling `editor.draw(board.context)`, saving with `toSnapshot` / `fromSnapshot`, the `background` option, and a note that it is headed for its own package), JSDoc on anything still missing.

- [ ] **Step 1: Write the README section and fill JSDoc gaps** (every export has a summary and a `@group`).
- [ ] **Step 2: Build the API docs** with `bunx nx run board:docs:build`. Expected: success; the output has a `whiteboard` module next to `index`, and the existing `index` pages keep their paths.
- [ ] **Step 3: Run everything.** `bunx nx test board`, `bunx nx build board --skip-nx-cache`, `cd packages/board && bunx tsc --noEmit -p tsconfig.json` after the build (project references need `math` and `being` built), `bun run format:check`, `cd packages/board && bun run bench/whiteboard.bench.ts`. Expected: all pass; `dist/whiteboard/index.js` imports `@ue-too/board` and doesn't contain board's own classes (`grep -c "class Board" dist/whiteboard/index.js` prints 0).
- [ ] **Step 4: Commit** `docs(board): document the whiteboard` and push the branch. Report to the user: Part 1 is ready for review and merge, then "Publish to NPM" from `main` with `version-type: minor`.

---

# Part 2: the docs home page (ue-too-documentation)

**Gate:** `npm view @ue-too/board@0.21.0 version` prints `0.21.0`, and `npm view @ue-too/board@0.21.0 exports --json` lists `./whiteboard`. Stop and tell the user if not.

### Task 17: Board 0.21.0, wider limits, new hint

**Files:**
- Modify: `package.json` (`"@ue-too/board": "0.21.0"`), `bun.lock`, `.vitepress/theme/canvas-home/canvas-home.ts:52-55` (`MIN_ZOOM = 0.25`, `PAN_LIMIT = 4000`), `.vitepress/theme/canvas-home/CanvasHome.vue` (`HINTS`), `scripts/test-home-page.ts` (`zoom` check)

Hint copy (fine pointer / touch):

| | fine | touch |
| --- | --- | --- |
| en | Drag to pan · Scroll or pinch to zoom · Pick a tool to draw | Drag to pan · Pinch to zoom · Pick a tool to draw |
| ja | ドラッグで移動 · スクロールかピンチでズーム · ツールを選んで描く | ドラッグで移動 · ピンチでズーム · ツールを選んで描く |
| zh-TW | 拖曳平移 · 滾輪或雙指縮放 · 選擇工具開始畫 | 拖曳平移 · 雙指縮放 · 選擇工具開始畫 |

- [ ] **Step 1: Update the `zoom` check**: zooming out stops at `0.25` (`>= 0.25 - 1e-6`), and add `'scroll-zooms'`: a plain `mouse.wheel(0, -200)` at the centre raises the zoom above 1.
- [ ] **Step 2: Bump and adjust.** `bun add @ue-too/board@0.21.0 --exact`, set the constants and the hint copy.
- [ ] **Step 3: Verify.** `bun run test`, `bunx vitepress build`, `bun run test:home:page`. Expected: all pass.
- [ ] **Step 4: Commit** `feat: use @ue-too/board 0.21.0 on the home page, with more room to pan and zoom`.

### Task 18: The editor on the home canvas

**Files:**
- Modify: `.vitepress/theme/canvas-home/canvas-home.ts`, `.vitepress/theme/canvas-home/CanvasHome.vue`, `scripts/test-home-page.ts`
- Create: `.vitepress/theme/canvas-home/whiteboard-theme.ts`
- Delete: `.vitepress/theme/canvas-home/drag-tracker.ts`, `drag-tracker.test.ts`

**Interfaces:**
- Consumes: `Editor`, `WhiteboardDocument`, `EditorBackground`, `WhiteboardTheme`, `DEFAULT_THEME` from `@ue-too/board/whiteboard`.
- Produces:
  - `CanvasHomeOptions` gains `document: WhiteboardDocument` and `theme: Partial<WhiteboardTheme>`; loses `hint`. `setContent(content, backLabel)` loses its `hint` parameter.
  - `CanvasHomeHandle` gains `editor: Editor` and `setBottomInset(px: number): void` (distance from the window's bottom to the top of the HTML stack; the Back to start pill sits `PILL_GAP` above it). `refreshTheme()` also takes the whiteboard theme: `refreshTheme(theme: Partial<WhiteboardTheme>)`.
  - `whiteboard-theme.ts`: `whiteboardTheme(dark: boolean, brand: string, siteFont: string): Partial<WhiteboardTheme>` — light uses `DEFAULT_THEME` colours; dark colours `ink #e8e8e0 red #ff8787 blue #74c0fc green #8ce99a orange #ffc078`, dark paper `ink #e2cb5b red #e8a0a0 blue #8fbfe0 green #9fd4a6 orange #e8bb88`, `paperText #231d00`; `selection` = `brand` (`--vp-c-brand-1`); `fonts.hand` = `'Caveat', ${siteFont}`.

Wiring: create `new Editor({ board, canvas, document: options.document, theme: options.theme, background })` with `background.hitTest = world => hitButton(layout, world) >= 0`, `background.activate = (world, p) => options.onActivate(hitButton(layout, world), p.ctrlKey || p.metaKey || p.shiftKey || p.button === 1)`, `background.ownsPointer = client => !!backRect && inRect(backRect, client)`. Draw order per frame: grid, hero, `editor.draw(ctx)`, Back to start pill. Remove the home page's own pointer pan, click, hover and `onTouchMove` handling (the editor does all of it); keep the pill's own press handling (`pointerdown`/`pointerup` on the pill) and its hover state. Remove `drawHint`. Keep the hero buttons' hover and pressed colours with the home page's own `pointermove` / `pointerdown` / `pointerup` listeners, cosmetic only and only while the tool is Hand or Select. Keep `stepFlight`, focus rings, `setFocused`, `goBack`, `buttonRects`, `backButtonRect`, `camera`.

- [ ] **Step 1: Update the checks first.** Every existing check in `scripts/test-home-page.ts` stays as is (they cover drag-pans, space-drag-pans-once, click-navigates, drag-from-button-stays, hover-cursor, ctrl/middle-click new tab, back to start (all four), phone, second-finger), except that anything reading the canvas hint goes. Add:
  - `'draw-over-hero'`: `window.__canvasHome!.editor.setTool('pen')`, drag across the hero's button → no navigation, `editor.document.size === 1`.
  - `'shape-over-button'`: put a filled rectangle over the button through `editor.document.put(...)`, set Hand, click the covered part → no navigation; click a part of the button the rectangle doesn't cover → navigates.
  - `'pill-beats-pen'`: pan away, set Pen, click the Back to start pill → the camera flies home and the document stays empty.
  - `'whiteboard-theme'`: switch to dark with the appearance toggle → `editor.getTheme().colors.ink === '#e8e8e0'`; back to light → `'#1e1e1e'`.
- [ ] **Step 2: Run** `bunx vitepress build && bun run test:home:page`. Expected: the new checks FAIL (no editor yet); unchanged checks pass.
- [ ] **Step 3: Implement** the wiring above; `CanvasHome.vue` passes a fresh `WhiteboardDocument` for now (saving is Task 19) and `whiteboardTheme(isDark, ...)` on mount and on theme change.
- [ ] **Step 4: Run** `bun run test`, `bunx vitepress build`, `bun run test:home:page`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: draw on the home page canvas`.

### Task 19: Saving the drawing

**Files:**
- Create: `.vitepress/theme/canvas-home/whiteboard-storage.ts`, `whiteboard-storage.test.ts`
- Modify: `.vitepress/theme/canvas-home/CanvasHome.vue`, `scripts/test-home-page.ts`

**Interfaces:**
- Produces:

```ts
export const STORAGE_KEY = 'ue-too:home-whiteboard'
export const SAVE_DELAY = 400
export function loadBoard(storage: Storage | null): WhiteboardDocument   // empty when missing, unreadable or throwing
export interface BoardSaver { flush(): void; dispose(): void }
export function saveBoard(doc: WhiteboardDocument, storage: Storage | null, options?: { delay?: number; warn?: (message: string, error: unknown) => void }): BoardSaver
export function browserStorage(): Storage | null                         // window.localStorage, or null when touching it throws
```

`saveBoard` writes `JSON.stringify(doc.toSnapshot())` `delay` ms after the last local or remote change, on `flush()`, and never before the first change (so an unreadable saved value survives until the visitor edits); a throwing `setItem` calls `warn` once per saver and keeps the board working. `CanvasHome.vue`: `loadBoard(browserStorage())` before mounting, `saveBoard` after, `flush` on `pagehide` and before unmount.

- [ ] **Step 1: Write the failing unit tests** (a `Map`-backed fake `Storage`; `delay: 0` with fake timers or awaiting a tick):

```ts
it('round-trips a drawing', () => { /* doc with a rect → saver; put a shape; flush → loadBoard(storage).size === 2 */ })
it('a bad saved value loads empty and stays until the first edit', () => {
  storage.setItem(STORAGE_KEY, '{not json')
  const doc = loadBoard(storage); const saver = saveBoard(doc, storage)
  saver.flush(); expect(storage.getItem(STORAGE_KEY)).toBe('{not json')
  doc.put(rect('a')); saver.flush(); expect(JSON.parse(storage.getItem(STORAGE_KEY)!).records).toHaveLength(1)
})
it('a newer schema version is left alone', () => { /* version 99 → empty doc; not overwritten until first edit */ })
it('storage that throws on read or write keeps the board working and warns once', () => { /* getItem throws → empty; setItem throws twice → warn called once */ })
it('no storage at all is fine', () => { /* loadBoard(null).size === 0; saveBoard(doc, null).flush() does nothing */ })
it('debounces', () => { /* three puts within the delay → one setItem */ })
```

- [ ] **Step 2: Run** `bun test ./.vitepress/theme/canvas-home/whiteboard-storage.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** and wire into `CanvasHome.vue`.
- [ ] **Step 4: Add the page check** `'drawing-persists'`: set Pen, drag, wait 600 ms, reload, `editor.document.size === 1`; then `editor.clear()`, wait, reload → `0`.
- [ ] **Step 5: Run** `bun run test`, `bunx vitepress build`, `bun run test:home:page`. Expected: all pass.
- [ ] **Step 6: Commit** `feat: keep home page drawings in the browser`.

### Task 20: The dock, the style panel and the handwriting font

**Files:**
- Create: `.vitepress/theme/canvas-home/WhiteboardDock.vue`, `dock-icons.ts`, `whiteboard-labels.ts`
- Modify: `.vitepress/theme/canvas-home/CanvasHome.vue` (render the dock once the canvas is up; pass the hint), `.vitepress/theme/index.ts` (`import '@fontsource/caveat/700.css'`), `package.json` (`@fontsource/caveat`), `scripts/test-home-page.ts`

**Interfaces:**
- Consumes: `canvasHome` (`state.ts`) for `editor` and `setBottomInset`; `EditorState`, `TOOL_NAMES`, `COLOR_NAMES`.
- Produces: `whiteboardLabels(lang: string): WhiteboardLabels` with the copy below; `DOCK_ICONS: Record<ToolName | 'undo' | 'redo' | 'clear' | 'shapes' | 'more', string>` (inner SVG markup, 24 × 24, stroke icons, the set used in the mockup); `<WhiteboardDock :hint="string" />`.

Layout (spec): a fixed bottom-centre column — Back to start stays on the canvas above it — holding (top to bottom) either the hint pill (Hand, Select or Eraser picked, nothing selected) or the style panel (a drawing tool picked, or shapes selected), then the dock, `20px` from the bottom (`16px` under 640 px wide) plus `env(safe-area-inset-bottom)`. A `ResizeObserver` on the column calls `setBottomInset(window.innerHeight - column.top)`. Wide dock: Hand, Select | Rectangle, Ellipse, Arrow, Line, Pen, Text, Note, Eraser | Undo, Redo | Clear. Under 640 px: Hand, Select | Shapes (a popover with Rectangle, Ellipse, Arrow, Line; its button shows the last picked shape), Pen, Text, Note, Eraser | Undo, More (a popover with Redo, Clear). `role="toolbar"` with `aria-label`, roving `tabindex` with Left/Right arrows, `aria-pressed` on tools, `title` = `"<label> (<KEY>)"`, `aria-keyshortcuts`. Undo/Redo disabled from `canUndo`/`canRedo`; Clear disabled when `empty`. The style panel: five colour swatches, three sizes, and fill (none / hatched / solid) only for Rectangle, Ellipse or a selection that has one; it shows `selectionStyle` when shapes are selected, else the next-shape style. Styled from VitePress variables like the mockup.

Copy (`whiteboard-labels.ts`):

| key | en | ja | zh-TW |
| --- | --- | --- | --- |
| toolbar | Drawing tools | 描画ツール | 繪圖工具 |
| hand / select | Hand / Select | 手のひら / 選択 | 抓手 / 選取 |
| rect / ellipse | Rectangle / Ellipse | 四角形 / 楕円 | 矩形 / 橢圓 |
| arrow / line | Arrow / Line | 矢印 / 直線 | 箭頭 / 直線 |
| pen / text | Pen / Text | ペン / テキスト | 畫筆 / 文字 |
| note / eraser | Sticky note / Eraser | 付箋 / 消しゴム | 便利貼 / 橡皮擦 |
| undo / redo | Undo / Redo | 元に戻す / やり直す | 復原 / 重做 |
| clear | Clear the board | ボードを消去 | 清除畫板 |
| shapes / more | Shapes / More | 図形 / その他 | 形狀 / 更多 |
| style | Style | スタイル | 樣式 |
| colours | Ink, Red, Blue, Green, Orange | インク、赤、青、緑、オレンジ | 墨色、紅、藍、綠、橘 |
| sizes | Small, Medium, Large | 小、中、大 | 小、中、大 |
| fills | No fill, Hatched, Solid | 塗りなし、斜線、塗りつぶし | 無填色、斜線、實心 |

- [ ] **Step 1: Write the page checks:**
  - `'dock-tools'`: click the Pen button → `aria-pressed="true"` and `editor.tool === 'pen'`; press `r` → Rectangle pressed; drag on the canvas → one shape; the style panel shows and the hint doesn't.
  - `'dock-undo-clear'`: draw; Undo → empty; Redo → 1; Clear → empty and Clear disabled; Ctrl+Z → 1.
  - `'dock-style'`: pick Rectangle, click Red, draw → the shape's `style.color === 'red'`; select it, click Large → `size === 'l'`.
  - `'dock-keyboard'`: Tab into the toolbar, Right arrow moves focus, Enter picks; typing `r` in the VitePress search box doesn't change the tool.
  - `'dock-phone'` (`PHONE`): no horizontal overflow; the dock fits inside 390 px; Shapes opens and picking Ellipse closes it with Ellipse pressed; a one-finger drag with Ellipse draws one ellipse.
  - `'dock-locales'`: `/ja/` shows `付箋`, `/zh-TW/` shows `便利貼` as button labels.
  - `'text-typing'`: pick Text, click the canvas, type `Hello` → `editor.document.all()[0].text === 'Hello'`; Escape ends editing.
  - `'back-pill-above-dock'`: pan away → `backButtonRect().y + height <= dock top`.
- [ ] **Step 2: Run** `bunx vitepress build && bun run test:home:page`. Expected: the new checks FAIL.
- [ ] **Step 3: Implement** the components, the copy, the icons, and add the font with `bun add @fontsource/caveat`.
- [ ] **Step 4: Run** `bun run test`, `bunx vitepress build`, `bun run test:home:page`. Expected: all pass. Take one desktop and one phone screenshot (deviceScaleFactor 2) of the home page with a few shapes, light and dark, and look at them.
- [ ] **Step 5: Commit** `feat: add the drawing dock to the home page`.

### Task 21: README and the final Part 2 check

**Files:**
- Modify: `README.md` ("Home page" section: the whiteboard, its dock, saving under `ue-too:home-whiteboard`, the code in `canvas-home/`, the font, and that the editor comes from `@ue-too/board/whiteboard` pinned in `package.json`)

- [ ] **Step 1: Update the README.**
- [ ] **Step 2: Run everything:** `bun run test`, `bun run docs:build`, `bunx vitepress build`, `bun run test:home:page`, `bun run test:examples:page`. Expected: all pass.
- [ ] **Step 3: Commit** `docs: describe the home page whiteboard` and push the branch.
