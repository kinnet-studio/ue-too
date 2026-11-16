# Whiteboard on the docs home page: design

## Intent

The docs home page (https://ue-too.dev/) is a full-window `@ue-too/board`
canvas with the hero drawn on it: visitors pan and zoom around it. Turn it into
a small whiteboard in the spirit of Excalidraw and tldraw: next to panning and
zooming, visitors draw shapes, arrows, lines, pen strokes, text and sticky
notes, and the drawing is still there when they come back.

The editor is the start of a collaborative whiteboard tool built on ue-too. For
now its code lives in `@ue-too/board`, but it is written so that it can be
lifted out into its own package (say `@ue-too/whiteboard`) that depends on
`@ue-too/board`, with no rewrite. The document model is shaped for real-time
collaboration from day one, even though nothing here is shared yet.

## Rounds

| Round | Repo | What |
| --- | --- | --- |
| 1 | ue-too | The whiteboard in `@ue-too/board`, published as the `@ue-too/board/whiteboard` entry; an example page in `apps/examples` |
| 2 | ue-too-documentation | The home page uses it: bottom dock, style panel, saving to the browser |

The docs site installs `@ue-too/board` from npm (pinned to `0.20.0`), so round
2 waits for a ue-too release that includes round 1, and pins `0.21.0`. That
release also ships the change already on `main` that starts boards in
keyboard-mouse mode (`feat(board)!`), which round 2 has to take into account
(see "Scroll and zoom" below). Because of that breaking change, the "Publish to
NPM" workflow's `auto` bump would publish 1.0.0; the release is triggered with
`version-type: minor` to publish 0.21.0 instead (decided by the user), so the
workflow's major-version handling needs no work here.

## Goals

- Visitors on the docs home page can draw with: select, rectangle, ellipse,
  arrow, line, pen, text, sticky note and eraser, plus hand (pan), undo, redo
  and clear. Selected shapes can be moved, resized, restyled and deleted.
- Drawings look hand-drawn ("sketchy"): wobbly double strokes, hatched fills,
  a handwriting font for text and notes.
- A visitor's drawing is saved in their browser and survives a reload. One
  drawing per browser, shared by every locale and docs version of the site.
- Everything the home page does today keeps working: drag to pan, zoom, the
  hero's button, keyboard focus on the hero links, Back to start, the theme
  switch, the locales, the no-JavaScript fallback.
- The whiteboard code reaches board only through board's public API, so
  moving it to its own package is a folder move plus a `package.json`.
- The document is a set of plain JSON records with IDs and a stream of changes,
  so a later sync layer can send local changes out and apply remote ones in
  without changing the document, the tools or the renderer.

## Non-goals

- A sync server, live cursors, presence, or any sharing. The model is ready for
  them; building them is the whiteboard tool's work.
- Arrows that stay attached to shapes when the shapes move (bindings).
- Rotating shapes by hand. Records carry `rotation` so it can be added later;
  nothing in v1 sets it.
- Text inside shapes (double-click a rectangle to label it), images, groups,
  copy and paste, duplicate, export, bring forward / send back, a minimap,
  zoom to fit.
- A clean (non-sketchy) style, or a per-shape style switch. One renderer only.
- Making the act of drawing keyboard- or screen-reader-accessible. The toolbar
  is accessible; drawing on the canvas is a pointer activity.
- Palm rejection or pressure-sensitive strokes.

## Anti-goals

- **Board users pay for it.** An app that imports `@ue-too/board` and never
  touches the whiteboard must not download, parse or run any of it. It is not
  re-exported from board's main entry.
- **The home page gets slower for people who just want the docs.** The editor
  loads with the canvas (already lazy), the handwriting font loads only when a
  text shape or note is on the board or a text or note tool is picked, and an
  empty board costs nothing per frame beyond today's.
- **The docs feel broken for keyboard and screen-reader users.** The hidden
  HTML hero, its focus rings on the canvas and the Back to start button keep
  working exactly as now.
- **Visitors lose their drawing without doing anything.** A broken or
  unreadable save starts an empty board but never overwrites the saved data
  until the visitor draws something; a schema change migrates old saves.
- **The detached package has to reach into board internals.** Enforced by a
  test (see "Keeping it detachable").

## Constraints

- Bun, Nx, `bun test` in the board package, Prettier (4 spaces, single quotes),
  strict TypeScript, JSDoc on every public API with TypeDoc `@group` tags.
- No new runtime dependencies in `@ue-too/board` (today: `@ue-too/math`,
  `@ue-too/being`). The sketchy renderer, fractional indexing and IDs are
  written here.
- Interaction logic is built on `@ue-too/being` state machines, like board's
  own input.
- 60 FPS on the home page with a busy board (target: 500 shapes, 50,000 pen
  points in total, on a mid-range laptop).
- The published package today only exports `.`: `scripts/move-package.mjs`
  rewrites `exports` to the main entry, and `scripts/build.ts` bundles one
  entry point. A second public entry needs both extended.
- Canvas 2D only, like the home page today. The home page throws on browsers
  without `context.reset()` / `roundRect()` and falls back to the HTML hero;
  the whiteboard inherits that.
- The docs ship in three locales (en, ja, zh-TW). Text and notes must accept
  IME input (Japanese and Chinese), so text editing goes through a real
  `<textarea>`.

## Decided

These were settled with the user:

- The home page canvas becomes a whiteboard in addition to pan and zoom.
- Tools in v1: select (move, resize, delete), rectangle, ellipse, arrow, line,
  pen, text, sticky note, eraser, undo and redo. Arrow bindings wait for the
  whiteboard tool.
- The code lives in `@ue-too/board` for now, ready to be detached into a
  package that depends on board.
- Saving: in the visitor's browser, survives reload, with a Clear button.
  Nothing leaves the browser.
- The later whiteboard tool is collaborative, so the model is built for it:
  records with IDs, a change stream, undo of one's own changes only, sortable
  keys for stacking order, last write wins per record.
- The hero stays fixed underneath the drawing and can't be edited; its button
  works with the hand and select tools; the pan and zoom limits widen.
- The hero keeps its responsive layout. Drawings stay where they were drawn,
  so they may sit slightly off the hero after the window crosses one of its
  width breakpoints (640 and 960 px) or the visitor switches language. That
  drift is accepted.
- Look: sketchy (Excalidraw-like). Toolbar: a bottom dock, with the style
  panel taking the hint's place above it while a drawing tool is picked.
- Approach A below.

## Approaches

**A. Alongside the board's gestures (picked).** The whiteboard listens to
pointer events on the canvas itself and runs each tool as a `@ue-too/being`
state machine. The board's own gestures keep working unchanged (scroll and
Ctrl + scroll to zoom, Space + drag and middle-drag to pan, two-finger pinch);
while the board is in one of them, the tools stand aside. The hand tool's
plain-drag pan is what the home page's `DragTracker` does today, moved into
the module. Uses only public API, so detaching is a move. The cost is one
handover rule to get right (a second finger mid-stroke cancels the stroke and
hands over to the board's pinch).

**B. Inside the board's input machines.** Add tool states to board's
keyboard-mouse and touch machines with `expandKmtInputStateMachine` /
`expandTouchInputStateMachine`, so one machine per input type owns every
pointer. No handover rule, but the whiteboard replaces the board's machines
(apps that customize them must merge), and the detached package would depend on
the internal state names of board's machines, so changes there in board would
break it. Rejected for coupling.

Dropped early:

- **Build it in the docs repo first, upstream later.** Works against "contained
  in board, ready to detach", and the example app couldn't use it.
- **Embed tldraw or Excalidraw.** The page exists to show ue-too; tldraw's SDK
  also needs a license key or shows a watermark.
- **A separate `@ue-too/whiteboard` package now.** The cleanest detachment,
  but the user chose to keep it in board for now. The design makes the later
  move mechanical instead.

## Design

### Where it lives and how it detaches

```
packages/board/src/whiteboard/
  index.ts              public entry: @ue-too/board/whiteboard
  document/             records, changes, transactions, history, snapshot,
                        fractional index, ids. No DOM, no board.
  geometry/             bounds, hit-testing, point simplification. No DOM.
  render/               sketchy generator (seeded), shape painter, cache
  editor/               Editor class, tool state machines, selection,
                        text-editing overlay, keyboard shortcuts
```

- Everything the whiteboard needs from board, it imports from the package
  name: `import { Board, ... } from '@ue-too/board'` (a self-reference, which
  Bun workspaces and TypeScript's `bundler` resolution both support), never
  from relative paths like `../camera`. Detaching it means moving the folder
  into `packages/whiteboard/src`, adding a `package.json` that depends on
  `@ue-too/board`, `@ue-too/being` and `@ue-too/math`, and deleting the entry
  from board. No import changes.
- `document/` and `geometry/` import nothing from board at all, so a future sync
  server can run the document in Node or a worker.
- A guard test in board fails if any file under `src/whiteboard/` imports from a
  relative path outside `src/whiteboard/`, or from anything but
  `@ue-too/board`, `@ue-too/being`, `@ue-too/math` and its own files; and if
  any file outside `src/whiteboard/` imports from it. Mirrors the import-guard
  tests the azabu repo uses.
- Publishing: `scripts/build.ts` builds `src/whiteboard/index.ts` as a second
  entry with `@ue-too/board` external (so the bundle imports board instead of
  copying it, and `instanceof Board` holds across the two). `move-package.mjs`
  adds `./whiteboard` to the published `exports` (types from the
  `tsc --emitDeclarationOnly` output, which already covers all of `src`). Only
  board's build changes; other packages keep the single entry.
- TypeDoc: board's docs gain the whiteboard entry, grouped under
  `@group Whiteboard` (and subgroups such as `Whiteboard Document`,
  `Whiteboard Editor`), so it shows up in the docs site's import.
- Plan-stage spike: confirm the self-reference resolves in `bun test`, `tsc`,
  Bun.build and TypeDoc. If one of them can't, the fallback is to import board
  only through `src/index.ts` (still one public barrel, still guarded) and have
  the build rewrite that import to `@ue-too/board`.

### The document

The document is a flat map of records keyed by ID. A record is immutable plain
JSON; an update replaces the whole record.

```ts
type ShapeType = 'rect' | 'ellipse' | 'arrow' | 'line' | 'pen' | 'text' | 'note';

interface ShapeBase {
    id: string;            // random, 16 base-62 characters
    type: ShapeType;
    x: number; y: number;  // world position of the shape's origin
    rotation: number;      // radians; always 0 in v1
    index: string;         // fractional index: stacking order, sorts as a string
    seed: number;          // fixes the sketchy wobble, so every viewer sees the same shape
    style: { color: ColorName; size: 's' | 'm' | 'l'; fill: 'none' | 'hachure' | 'solid' };
}
// rect, ellipse, note: w, h        arrow, line: end point relative to x, y
// pen: points [x, y][] relative to x, y        text: text (may contain newlines)
// note: text, w, h
```

- `ColorName` is a small named palette (`ink`, `red`, `blue`, `green`,
  `orange`), never a hex value, so the renderer maps it per theme (dark mode)
  and a later palette change doesn't rewrite saved drawings. Notes map the same
  names to paper tints (`ink` is the default yellow paper).
- **Changes.** Every edit produces a change `{ added, updated: [before, after],
  removed, source: 'local' | 'remote' }`. `doc.transact(fn)` batches several
  puts and removes into one change. `doc.subscribe(listener)` delivers every
  change; saving, rendering invalidation and a later sync layer all listen here.
  `doc.applyRemote(change)` applies a change with `source: 'remote'`.
- **Conflicts.** Last write wins per record. A remote update to a record
  replaces it whole. (Good enough for a first collaborative version; a per-field
  merge or a CRDT can come later behind the same change stream.)
- **History.** Undo and redo cover local changes only. A gesture (one drag,
  one stroke, one style change, one clear) is one undo step, however many
  changes it produced; tools mark the start and end. Undo restores the
  `before` of each record the step changed, even if a remote change touched it
  since (last write wins again). Remote changes never enter the history.
- **Stacking order.** `index` is a fractional index (base-62 keys between two
  neighbours), so two people adding or reordering shapes at once never clash.
  New shapes go on top. Ties (same key from two clients) break by `id`.
- **Snapshot.** `doc.toSnapshot()` → `{ schema: 'ue-too-whiteboard', version: 1,
  records }`, `Document.fromSnapshot(json)` validates and migrates; unknown
  shapes or fields are dropped, a wrong schema throws. This is what the docs
  page saves.
- **Size.** Pen strokes drop points closer than half a screen pixel while
  drawing, are simplified (Ramer–Douglas–Peucker, ~0.5 world units) when the
  stroke ends, and coordinates are rounded to two decimals, so a busy board stays
  well inside localStorage's few megabytes.

### Rendering

- The app keeps its frame loop. Each frame it draws its own background (the
  docs: grid and hero), then calls `editor.draw(ctx)`, which draws the shapes
  in index order and then the selection UI (outline, handles, marquee, eraser
  trail), then the app draws its screen-space UI (the docs: hint and Back to
  start). `draw` uses the board's current transform, so shapes are in world
  space like the hero.
- **Sketchy generator.** Pure functions from a record to drawing ops: each line
  is two slightly offset, slightly bowed Bézier strokes; ellipses are a jittered
  closed curve drawn twice with an overlap; `hachure` fills are clipped
  parallel strokes at about -41°; `solid` fills a jittered outline; arrows add
  two short head strokes; pen strokes are smoothed with constant width (no
  wobble added: a hand stroke is already hand-drawn); notes are a slightly
  jittered paper square with a small tilt taken from the seed (drawn only; hit
  testing uses the untilted box). A seeded random generator makes the output a
  pure function of the record, as in the mockup.
- **Cache.** The ops for a record are built once into `Path2D`s and cached in a
  `WeakMap` keyed by the record object (records are immutable, so an update is
  a new key). Colors and stroke widths are applied at draw time, so a theme
  switch doesn't rebuild paths. Text is drawn with `fillText` each frame.
- **Culling.** Each record's world bounds are cached alongside; shapes outside
  the visible world rectangle are skipped.
- **Line widths.** Sizes `s`/`m`/`l` are world units (1.5 / 2.5 / 4.5 for
  strokes; 20 / 28 / 40 px fonts for text), so drawings scale with zoom like the
  hero does. Selection outlines and handles stay a constant size on screen.
- **Theme.** `editor.setTheme({ colors, fonts })` takes resolved CSS colors
  for each `ColorName`, the paper tints, the selection color, and font
  families (`hand`, `fallback`). The package ships no font; the app provides it.

### The editor and tools

`new Editor({ board, document, overlayParent, theme, background? })` wires the
whiteboard to a board. It adds pointer listeners to `board`'s canvas and a
keydown listener on the window, and removes them in `editor.destroy()`.

**Handover with the board (approach A).**

- Mouse: only the primary button reaches tools. A press is ignored by tools when
  the board's keyboard-mouse machine isn't `IDLE` (Space held, middle-drag,
  scroll-wheel pan), exactly as the home page's `boardIdle()` does now. Wheel
  and Ctrl + wheel are the board's.
- Touch: the board keeps its default touch machine, which only handles two
  fingers. One finger goes to the active tool. When a second finger lands
  during a tool gesture, the gesture is cancelled (a half-drawn shape is
  removed, a half-done move snaps back, nothing enters the history) and tools
  ignore the rest of that touch sequence until every finger is up; the board's
  pinch and two-finger pan take over. The home page's fix that keeps the
  board's touch record current during a one-finger drag (`onTouchMove`) moves
  into the editor.
- Pen (stylus) input is treated like a mouse primary button.

**Tool machines.** One `@ue-too/being` machine per tool, fed normalized events
(`pointerDown`, `pointerMove`, `pointerUp`, `cancel`, `keyDown`) in world and
screen coordinates, with a context exposing the document, history, camera rig
and editor state. The editor's top-level machine has one state per tool and
delegates to the active tool's machine (`DelegatingState`). Machines are
testable without a DOM by sending those events directly.

| Tool | Gesture | Notes |
| --- | --- | --- |
| Hand | drag pans (`rig.panByViewPort`) | The default on the home page |
| Select | click selects topmost hit; Shift + click toggles; drag on empty canvas draws a marquee (selects shapes fully inside); drag a selected shape moves the selection; drag a handle resizes; double-click a text or note edits it | Lines and arrows show endpoint handles instead of a box. Pen strokes resize by scaling their points. Text shapes have no resize handles in v1 (size comes from the style panel) |
| Rectangle, Ellipse | drag from corner to corner; Shift keeps it square / circular | A click without dragging creates a default-sized shape |
| Arrow, Line | drag from start to end; Shift snaps to 15° | |
| Pen | drag draws | |
| Text | click places a text box and starts editing | Empty text is removed when editing ends |
| Note | click places a 200 × 200 note and starts editing | |
| Eraser | drag over shapes marks them (drawn faded); release deletes them all, as one undo step; a tap erases the topmost hit | |

- After creating a rectangle, ellipse, arrow, line, text or note, the tool
  returns to Select with the new shape selected (as in Excalidraw and tldraw).
  Hand, Pen and Eraser stay picked.
- Hit-testing: strokes (lines, arrows, pen, outlines of unfilled shapes) hit
  within 6 screen pixels; filled rectangles and ellipses, notes and text hit
  anywhere inside. Unfilled shapes hit on their outline only.
- **Background clicks.** `background.hitTest(world)` / `background.activate(world,
  event)` let the app put clickable things under the drawing. With Hand and
  Select, a press without a drag on a spot where no shape is hit and
  `hitTest` is true calls `activate`, and the cursor there is `pointer`. The
  docs use it for the hero's button. Drawing tools ignore it, so visitors can
  draw over the hero.
- **Style.** `editor.setStyle(partial)` sets the style for the next shape and,
  if shapes are selected, restyles them (one undo step). The editor reports the
  selection's shared style so a panel can show it.
- **Keyboard** (only when focus is not in an input, textarea or contenteditable,
  and no text is being edited): H hand, V select, R rectangle, O ellipse,
  A arrow, L line, P pen, T text, N note, E eraser; Delete / Backspace delete
  the selection; Escape clears the selection or cancels a gesture;
  Ctrl/Cmd + Z undo, Ctrl/Cmd + Shift + Z and Ctrl + Y redo; Ctrl/Cmd + A
  select all. Space stays the board's temporary pan.
- **Text editing.** Editing a text or note puts a `<textarea>` in
  `overlayParent` over the shape, with matching font, size, color and line
  height, scaled and positioned from the camera every frame. The shape's own
  text is hidden while editing. Enter adds a line; Escape or clicking elsewhere
  ends editing (the edit is one undo step). IME composition works because it is
  a real textarea. Notes wrap text to their width; text shapes grow to fit.
- **State for UI.** `editor.subscribe(listener)` reports tool, selection, shared
  style, can-undo / can-redo, and whether the board is empty, so a toolbar can
  stay in sync. `editor.setTool`, `undo`, `redo`, `clear` (removes everything,
  one undo step), `deleteSelection` are the commands a toolbar calls.

### The docs home page (round 2)

- `canvas-home.ts` creates a `Document` (from the saved snapshot, if any) and
  an `Editor` on its board, calls `editor.draw(ctx)` between the hero and the
  hint, and hands the hero's button to `background` instead of its own
  `DragTracker` / `hitButton` press handling. The `DragTracker` and the
  `onTouchMove` fix move into the editor; the home page keeps the hero layout,
  focus rings, Back to start and theming.
- **Saving.** On every document change, save the snapshot to localStorage under
  one key (e.g. `ue-too:home-whiteboard`), debounced (~400 ms) and on
  `pagehide`. Reads and writes are in try/catch; private windows and blocked
  storage just don't save. A save that fails for space keeps the board working
  and logs once. A snapshot that can't be read leaves the stored value alone
  until the visitor's first edit.
- **The dock** (Vue, real HTML buttons, `role="toolbar"`, `aria-pressed` on
  tools, shortcut in each button's tooltip and `aria-keyshortcuts`):
  - Wide screens: Hand, Select | Rectangle, Ellipse, Arrow, Line, Pen, Text,
    Note, Eraser | Undo, Redo | Clear.
  - Narrow screens (phone): Hand, Select | Shapes (opens Rectangle, Ellipse,
    Arrow, Line), Pen, Text, Note, Eraser | Undo, More (Redo, Clear).
  - Centered at the bottom, 20 px up (16 px on phones, plus the safe-area
    inset). The hint sits above it; while a drawing tool is picked, or shapes
    are selected, the style panel (5 colors, 3 sizes, and fill for rectangles
    and ellipses) takes the hint's place. The Back to start pill sits above
    whichever is showing.
  - Clear is undoable, so it asks nothing; it is disabled while the board is
    empty.
  - Every label and tooltip in en, ja and zh-TW, next to the existing `HINTS`
    and `BACK_LABELS`.
- **The hero.** Fixed underneath, not editable. With Hand and Select its
  button works on click as now (Ctrl/Cmd/Shift/middle-click still open a new
  tab); with drawing tools, drawing goes over it. `hero-layout.ts` and
  `frameHero` stay as they are: drawings are not re-anchored when the hero
  lays itself out again (see "Decided").
- **Camera limits.** Pan limit from 1,000 to 4,000 world units from the hero,
  minimum zoom from 0.5 to 0.25 (maximum stays 4).
- **Scroll and zoom.** The new board release starts in keyboard-mouse mode, where
  a plain scroll zooms at the cursor. The hint text changes to match (e.g. "Drag
  to pan · Scroll or pinch to zoom · Pick a tool to draw").
- **Fonts.** The handwriting font (Caveat, SIL Open Font License) is
  self-hosted with the site's other static files, with a `@font-face` that
  declares `font-display: swap`; the editor's `hand` font family is
  `'Caveat', <site font>` so CJK text falls back to the site's font. It is
  loaded on demand as described in the anti-goals; the existing
  `document.fonts` `loadingdone` redraw covers its arrival.
- **Fallback.** If the canvas can't run, the HTML hero shows as now, and no dock
  is shown.

### The example (round 1)

`apps/examples/whiteboard`: a full-window board with the whiteboard, a plain
HTML dock and style panel, and saving to localStorage. It is the reference for
wiring the editor into an app, and the place to try it before the release.

## Testing

Round 1, in `packages/board/test/whiteboard/` (`bun test`):

- Document: transactions produce one change; subscribers see adds, updates,
  removes; `applyRemote` marks the source and skips the history; snapshot round
  trip; bad snapshots are rejected, old versions migrate.
- History: one undo step per gesture; undo after a remote change restores the
  local `before`; redo is cleared by a new local change.
- Fractional index: keys between any two keys sort between them; many
  inserts at one spot stay short enough; ties break by `id`.
- Geometry: hit-testing per shape type and tolerance at several zooms; bounds;
  point simplification.
- Sketchy generator: the same record gives the same ops; a different seed gives
  different ops; output stays within the shape's bounds plus a small margin.
- Tool machines, driven by synthetic events with a stub camera: each tool's
  happy path, Shift constraints, click-without-drag defaults, return to Select,
  cancel mid-gesture leaves no shape and no history, a second touch cancels,
  the board busy (Space held) makes tools stand aside, background activation
  with Hand and Select only.
- The import guard (see "Keeping it detachable").
- A benchmark of drawing 500 cached shapes, via the repo's benchmark script.

Round 2, in ue-too-documentation:

- `bun run test:home:page` keeps passing, and gains: pick Pen, draw a stroke,
  reload, the stroke is still there; Undo removes it; Clear empties the board
  and Undo brings it back; the hero's button still opens its link with Hand
  and Select, and doesn't with a drawing tool; text editing accepts typed text;
  the dock fits at phone width with no horizontal scroll; dark mode redraws.
- Unit tests for the save and load helpers (debounce, broken storage, bad JSON
  left untouched until the first edit).

## Left to the builder

- File names inside `src/whiteboard/`, internal types, the exact API signatures
  beyond what's named above.
- Sketchy constants (offsets, bow, hachure gap and angle), palette values for
  each theme, paper tints, handle sizes, default shape sizes.
- The phone breakpoint for the narrow dock, and whether the hint moves from the
  canvas into HTML next to the dock (whichever keeps the stacking simplest).
- How the editor's top-level machine and tool machines split their states,
  within "one being machine per tool".
- Snapshot validation details and the debounce interval.
