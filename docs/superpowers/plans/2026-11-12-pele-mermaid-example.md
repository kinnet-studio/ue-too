# Pele Mermaid Example Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an example page in `apps/examples` with editable Mermaid text. Pele renders the text to SVG, and the ue-too board camera pans and zooms it.

**Architecture:**
- The board camera, camera rig, camera mux, and the KMT and touch input parsers are wired by hand onto an `<svg>`, as in `apps/examples/src/svg`.
- Each frame, `camera.getTransform(1, true)` is written as `matrix(...)` onto a `<g id="camera">`.
- Pele's `<svg>` is nested inside that group with its top-left at world (0, 0).
- A "Fit" button flies the camera with `createZoomPanPath`.

**Tech Stack:** TypeScript, Vite (examples app), `@ue-too/board` (workspace), `pele@1.13.0`, Playwright (pre-installed) for verification.

**Spec:** `docs/superpowers/specs/2026-11-12-pele-mermaid-example-design.md`

## Global Constraints

- The change touches `apps/examples` only. No package under `packages/` changes, and nothing in the docs site changes.
- Add `"pele": "1.13.0"` (exact pin) to `apps/examples/package.json`. Use no editor library.
- Use Bun and Nx from the repo root: `bun install`, `bunx nx build examples`, `bun run dev:examples`.
- Prettier: 4-space indent, single quotes, trailing comma `es5`. Run `bun run format` before each commit.
- Commits use type `feat(examples)` / `fix(examples)`. The examples app is not a release project, so these do not bump versions.
- Re-rendering never moves the camera. The diagram's top-left is always world (0, 0).
- Debounce re-renders on `input` by 250 ms.
- On error, keep the last good diagram and show the error under the editor.
- Zoom limits are min 0.05 and max 10. Fit padding is 40 px on each side.
- Fit flight: 1000 ms, eased with `(1 - Math.cos(Math.PI * t)) / 2`. User pan or zoom cancels it.
- Add i18n strings to both `en.ts` and `zh-TW.ts`. `zh-TW` must carry every key `en` has, because `Translations = typeof en`.

## Review Focus

1. **Space + drag over diagram text.** It pans without selecting Pele's text, so `window.getSelection()` stays empty. Tested in Task 1.
2. **Empty or whitespace-only editor.** It shows Pele's error, keeps the old diagram, and doesn't throw. Tested in Task 2.
3. **Non-Mermaid text such as `hello world`.** The `unsupported-diagram` error is shown, and the old diagram is kept. Tested in Task 2.
4. **Wheel during a Fit flight.** The flight stops and the user keeps the camera; it does not snap back to the fit view. Tested in Task 3.
5. **Window resize, then Fit.** The camera viewport follows the SVG's new size, and Fit frames the diagram inside the new bounds. Tested in Task 3.

## Verification harness (shared by all tasks)

There is no e2e setup in the repo, so the browser check is a throwaway script that is not committed:

`/tmp/claude-0/-home-user/f13f7fe4-0720-50f4-b4e7-6e6b0abc9d2b/scratchpad/verify-pele-example.mjs`

- It imports `playwright`, which is pre-installed.
- It takes the page URL as `argv[2]`.
- It runs named checks in order, prints `PASS <name>` or `FAIL <name>: <reason>`, and exits non-zero on any failure.
- Any `pageerror` event during the run fails the run.
- A negative wheel `deltaY` is assumed to zoom in. If the KMT parser does the opposite, flip the sign in every check.
- Each task appends its checks.

Helpers it defines:

- `matrixOf(page)`: parses `#camera`'s `transform` attribute `matrix(a, b, c, d, e, f)` into numbers.
- `diagramRect(page)`: the `getBoundingClientRect()` of `#camera > svg`.
- `stageRect(page)`: the same for `#stage`.

To run it:

1. Start the dev server in the background with `bun run dev:examples` (from the repo root) and read the port from Vite's output.
2. Run: `bun /tmp/claude-0/-home-user/f13f7fe4-0720-50f4-b4e7-6e6b0abc9d2b/scratchpad/verify-pele-example.mjs http://localhost:<port>/ue-too/pele-mermaid/index.html`

---

### Task 1: Page that renders Pele's SVG under a pannable, zoomable camera

**Files:**
- Modify: `apps/examples/package.json` (add `"pele": "1.13.0"` to `dependencies`), `bun.lock` (via `bun install`)
- Create: `apps/examples/src/pele-mermaid/index.html`
- Create: `apps/examples/src/pele-mermaid/sample.ts`
- Create: `apps/examples/src/pele-mermaid/diagram.ts`
- Create: `apps/examples/src/pele-mermaid/fit.ts`
- Create: `apps/examples/src/pele-mermaid/main.ts`
- Modify: `apps/examples/vite.config.js` (add a `'pele-mermaid'` input next to `svg`)
- Modify: `apps/examples/src/index.html` (nav link after the SVG link at line 132, and a card after the SVG card at around line 218, using the same markup)
- Modify: `apps/examples/src/i18n/en.ts`, `apps/examples/src/i18n/zh-TW.ts`
- Test: the verification harness

**Interfaces:**
- Produces:
  - `sample.ts`: `export const SAMPLE_DIAGRAM: string`. This is the flowchart body from `packages/board/README.md`: the lines between the ```` ```mermaid ```` fence at line 195 and its closing fence, copied verbatim. It already renders in Pele (a flowchart, 872×1733).
  - `diagram.ts`:
    - `export type DiagramResult = { ok: true; element: SVGSVGElement; width: number; height: number } | { ok: false; message: string }`
    - `export function renderDiagram(source: string): DiagramResult`
    - It calls Pele's `render(source, { responsive: false, fontFamily: <same stack as the page's --pele-font> })`.
    - It parses `result.svg` with `DOMParser` (`image/svg+xml`) and returns the root as `element`, with `x="0"` and `y="0"` set.
    - It catches every throw. A `PeleError` gives its `message`, which already includes the line, a caret snippet, and the expected token. Anything else gives `String(error)`.
  - `fit.ts`:
    - `export function fitView(diagram: { width: number; height: number }, viewport: { width: number; height: number }, padding = 40): CameraView`
    - It returns `position` = the diagram centre `{ x: width / 2, y: height / 2 }`.
    - It returns `zoomLevel` = `min((vw - 2p) / w, (vh - 2p) / h)`, clamped to [0.05, 10].
    - `CameraView` is imported from `@ue-too/board`.
  - `main.ts`: these module-level names are used by Tasks 2 and 3: `camera`, `cameraRig`, `cameraMux`, `stage: SVGSVGElement`, `showDiagram(result: Extract<DiagramResult, { ok: true }>): void`, and `current: { width: number; height: number }`.
  - DOM ids used by later tasks: `#stage` (the `<svg>`), `#camera` (the `<g>`), `#source` (the `<textarea>`), `#error` (a `<pre>`), `#fit` (a `<button>`).

- [ ] **Step 1: Add the dependency**

Add `"pele": "1.13.0"`, then run `bun install` from the repo root.
Expected: `bun.lock` gains `pele@1.13.0`, and `ls node_modules/pele/dist/pele.js` succeeds.

- [ ] **Step 2: Write the Task 1 checks in the harness (failing)**

- `loads`: `#camera > svg` exists. Its `class` contains `pele`, and `#error` is empty.
- `fits-on-load`: `diagramRect` lies inside `stageRect`, within 1 px. At least one of its width or height is ≥ 90% of the stage's minus 80 px.
- `wheel-zooms`: move the mouse to the stage centre and run `page.mouse.wheel(0, -300)`. After 200 ms, `matrixOf().a` is greater than before.
- `space-drag-pans`: hold `Space`, then drag from the stage centre 150 px right with the left button, and release. `matrixOf().e` increases by 100–200. `await page.evaluate(() => getSelection().toString())` is `''`.

- [ ] **Step 3: Run the harness and confirm it fails**

Run it as described in the harness section.
Expected: the page 404s or `FAIL loads`.

- [ ] **Step 4: Write `sample.ts`, `diagram.ts`, and `fit.ts` to the interfaces above**

- [ ] **Step 5: Write `index.html` and `main.ts`**

Layout:
- A full-viewport flex row. On the left, an editor panel 360 px wide holding the instructions, the `<textarea id="source">` (monospace, `spellcheck="false"`), `<pre id="error" role="status" aria-live="polite">`, and `<button id="fit">`.
- On the right, `<svg id="stage">` fills the rest, with `<g id="camera">` inside it.
- Below 720 px width, the layout becomes a column with the editor above the diagram.
- The page includes `<div id="lang-switcher-container">` and the i18n setup script, as in `svg/index.html`.
- `#stage` has `user-select: none`, `touch-action: none`, and an explicit background.
- Set Pele's CSS variables (`--pele-bg`, `--pele-fg`, …, `--pele-font`) on `#stage`.

Wiring in `main.ts`:
- Create the camera with `new DefaultBoardCamera({ viewPortWidth, viewPortHeight })` using `#stage`'s client size. Call `setMinZoomLevel(0.05)` and `setMaxZoomLevel(10)`.
- Create the rig with `createDefaultCameraRig(camera)` and the mux with `createCameraMuxWithAnimationAndLock()`.
- Create `const proxy = new SvgProxy(stage)`, and subscribe `proxy` so the camera's `viewPortWidth` and `viewPortHeight` follow the stage size.
- Create `new InputOrchestrator(cameraMux, cameraRig)`.
- Attach the KMT parser: `new VanillaKMTEventParser(createKmtInputStateMachine(new ObservableInputTracker(proxy)), orchestrator, stage)`, then call `.setUp()`.
- Attach the touch parser: `new VanillaTouchEventParser(createTouchInputStateMachine(new TouchInputTracker(proxy)), orchestrator, stage)`, then call `.setUp()`.
- Run a rAF loop that sets `#camera`'s `transform` to `matrix(a, b, c, d, e, f)` from `camera.getTransform(1, true)`.
- `showDiagram` replaces `#camera`'s child with `result.element` and stores the size in `current`.
- On load:
  - Fill `#source` with `SAMPLE_DIAGRAM`.
  - Render it and call `showDiagram`.
  - Get the start view from `fitView(current, stage client size)`. Set it with `camera.setZoomLevel` and `camera.setPosition`, directly with no flight.

i18n keys, added to both locale files:
- `nav.pele-mermaid`: "Mermaid (Pele)"
- `card.pele-mermaid.title`: "Mermaid (Pele)"
- `card.pele-mermaid.desc`: "Editable Mermaid diagrams rendered by Pele, panned and zoomed with the uē-tôo camera."
- `pele-mermaid.title`: "Mermaid with Pele"
- `pele-mermaid.desc`: "Pele renders Mermaid to SVG; the board camera transforms an SVG group around it, so the diagram stays sharp at any zoom."
- `pele-mermaid.editor-label`: "Mermaid source"
- `pele-mermaid.fit`: "Fit"

The page reuses the existing `controls.scroll-and-pan`, `controls.trackpad`, and `controls.touch` keys. In `zh-TW.ts`, write natural Traditional Chinese, matching the tone of the neighbouring entries.

- [ ] **Step 6: Run the harness and confirm the Task 1 checks pass**

Expected: `PASS loads`, `PASS fits-on-load`, `PASS wheel-zooms`, `PASS space-drag-pans`.

- [ ] **Step 7: Build**

Run: `bunx nx build examples`
Expected: the build succeeds and `dist/pele-mermaid/index.html` exists.

- [ ] **Step 8: Commit**

```bash
bun run format
git add apps/examples bun.lock
git commit -m "feat(examples): pan and zoom a Pele-rendered Mermaid diagram"
```

### Task 2: Live editing with errors that keep the last good diagram

**Files:**
- Modify: `apps/examples/src/pele-mermaid/main.ts`
- Test: the verification harness

**Interfaces:**
- Consumes: `renderDiagram`, `showDiagram`, and `camera` from Task 1, and the `#source` and `#error` elements.

- [ ] **Step 1: Add the Task 2 checks to the harness (failing)**

- `edit-rerenders`:
  - Replace `#source`'s value with `flowchart LR\n  A[Hello] --> B[Pele]` and dispatch `input`.
  - After 400 ms, `#camera > svg` contains the text `Pele`, and `#error` is empty.
  - `matrixOf()` deep-equals the matrix captured before the edit.
- `syntax-error-keeps-diagram`:
  - Set the value to `flowchart LR\n A --> ` and dispatch `input`. Wait 400 ms.
  - `#error` contains `line 2`, and `#camera > svg` still contains `Pele`.
- `empty-source`: set the value to `'   '`. `#error` is non-empty, the old diagram is still present, and no `pageerror` event fired.
- `unsupported-text`: set the value to `hello world`. `#error` is non-empty, and the old diagram is still present.
- `recovers`: set the value back to a valid diagram. `#error` is empty, and the new text is shown.

- [ ] **Step 2: Run the harness and confirm the new checks fail**

Expected: `FAIL edit-rerenders` (nothing listens to `input` yet).

- [ ] **Step 3: Implement the debounced `input` handler in `main.ts`**

- Each `input` event clears the pending timer and sets a new 250 ms timer.
- When the timer fires, it calls `renderDiagram(value)`.
- On `ok`, it calls `showDiagram` and clears `#error.textContent`.
- On an error, it sets `#error.textContent = message` and leaves the diagram alone.
- It never touches the camera.

- [ ] **Step 4: Run the harness and confirm all checks so far pass**

- [ ] **Step 5: Commit**

```bash
bun run format
git add apps/examples/src/pele-mermaid
git commit -m "feat(examples): live-edit the Mermaid source in the Pele example"
```

### Task 3: Fit button that flies the camera to the whole diagram

**Files:**
- Modify: `apps/examples/src/pele-mermaid/main.ts`
- Test: the verification harness

**Interfaces:**
- Consumes: `fitView` from Task 1, plus `camera`, `cameraRig`, `cameraMux`, `current`, and the `#fit` element.
- Uses from `@ue-too/board`: `createZoomPanPath(from: CameraView, to: CameraView, viewPortWidth: number): ZoomPanPath`. The flight pattern is in the JSDoc of `packages/board/src/camera/utils/zoom-pan-path.ts` (lines 120–145):
  - `mux.initatePanTransition()` and `mux.initateZoomTransition()` start the flight.
  - Each frame, `path.at(ease(t))` gives the view, which goes through `mux.notifyZoomInputAnimation` + `rig.zoomTo` and `mux.notifyPanToAnimationInput(...).allowPassThrough` + `rig.panToWorld`.
  - The flight stops when either mux state machine leaves `'TRANSITION'`.

- [ ] **Step 1: Add the Task 3 checks to the harness (failing)**

- `fit-flies-back`:
  - Zoom in with `wheel(0, -600)` and pan with Space-drag, then record the matrix.
  - Click `#fit`. After 300 ms, the matrix differs from both the recorded one and the final one, which shows it is mid-flight.
  - After a further 1000 ms, the fits-on-load assertions hold again.
- `wheel-cancels-flight`:
  - Zoom in, then click `#fit`. After 200 ms, run `wheel(0, -300)`.
  - Wait 1200 ms, then capture the matrix twice, 200 ms apart.
  - Both captures are equal, so the camera has stopped. `diagramRect` is **not** fully inside `stageRect`, so the camera did not snap back to the fit view.
- `resize-then-fit`:
  - Run `page.setViewportSize({ width: 900, height: 600 })` and wait 300 ms.
  - Click `#fit` and wait 1300 ms.
  - The fits-on-load assertions hold against the new `stageRect`.

- [ ] **Step 2: Run the harness and confirm the new checks fail**

Expected: `FAIL fit-flies-back` (the button does nothing yet).

- [ ] **Step 3: Implement `flyTo(target: CameraView): void` and wire `#fit` to `flyTo(fitView(current, { width: camera.viewPortWidth, height: camera.viewPortHeight }))`**

Drive the flight from the existing rAF loop, using a start timestamp, not a second loop. Use the duration and easing from Global Constraints. A new click during a flight restarts the flight from the current view.

- [ ] **Step 4: Run the harness and confirm every check passes**

Expected: all 12 checks print `PASS`.

- [ ] **Step 5: Build and check the formatting**

Run: `bunx nx build examples && bun run format:check`
Expected: both succeed.

- [ ] **Step 6: Take a screenshot for the user**

Use `deviceScaleFactor: 2` and the page after load, saved to `/tmp/claude-0/-home-user/f13f7fe4-0720-50f4-b4e7-6e6b0abc9d2b/scratchpad/pele-mermaid.png`.

- [ ] **Step 7: Commit**

```bash
bun run format
git add apps/examples/src/pele-mermaid
git commit -m "feat(examples): fly the camera to fit the diagram in the Pele example"
```
