# Docs Live Examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Live examples" page in the board docs where readers pan and zoom a real `@ue-too/board` canvas and edit and re-run the example code.

**Architecture:** A Vue playground component in the VitePress theme runs each example in a sandboxed `srcdoc` iframe. An import map points `@ue-too/*` at jsDelivr, pinned to the docs line's release. Pure helpers build the iframe document and handle its messages and the console; they are unit tested with `bun test`. Two Playwright scripts check the work: one runs every example file headless, the other drives the built page. CI runs both.

**Tech Stack:** VitePress 2.0.0-alpha.15, Vue 3, CodeMirror 6, Bun 1.3 (`bun test`), Playwright 1.56.0, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-16-docs-live-examples-design.md` (in `kinnet-studio/ue-too`).
**Approved mockup:** https://claude.ai/artifact/U19juWjDTZHqHDJwJeHxAq. Local copy: `/tmp/claude-0/-home-user/aea7da70-6f14-5df7-a340-4c51ec1e05ac/scratchpad/live-examples-mockup.html`. Its example code, captions and copy are the source for this plan's strings.

## Global Constraints

- **Repos and branches:**
  - All docs-site work: `/home/user/ue-too-documentation` on branch `claude/festive-cray-10b1wg`.
  - The README line: `/home/user/ue-too` on branch `claude/festive-cray-10b1wg`.
  - Push with `git push -u origin claude/festive-cray-10b1wg`.
- **Bun only:** `bun add`, `bun test`, `bun run`, `bunx`. Never npm, node or yarn.
- **Code style:** match the docs repo's existing TS. That means 2-space indent, single quotes, no semicolons, and short comments the way `.vitepress/config.ts` writes them.
- **Pinned release:** examples run the release in `versions.json` for the build's line (`docsRelease` in `config.ts`). Today that's `0.19.2`.
- **Module URL:** `${cdn}@ue-too/${pkg}@${release}/index.js`. The default `cdn` is `https://cdn.jsdelivr.net/npm/`, overridable at build or test time with the env var `LIVE_EXAMPLES_CDN`.
- **Import map packages:** `board`, `math`, `being`. Board imports the other two by bare name.
- **Example code:** each example is a plain JavaScript ES module. It imports only public `@ue-too/*` entry points and gets its canvas with `document.getElementById('graph')`. No hidden globals or helpers.
- **Preview iframe:** `sandbox="allow-scripts"` only (never `allow-same-origin`). It is replaced on every run. Messages are accepted only from the current iframe's window with the current run id.
- **Lazy loading:** editor and preview code load in the browser only, and only on pages that render the playground. CodeMirror must not end up in the main app chunk.
- **Scope:**
  - English page only; no zh-TW/ja pages.
  - No live examples page for v0.18.
  - No `being` examples.
  - No loop guards. An infinite loop hanging the tab in some browsers is accepted.
  - No saving or sharing of edits.
- **The check never blocks deploys:** `deploy.yml` is not touched.
- **Commits:**
  - Conventional messages. Docs repo: `feat:`, `test:`, `ci:`, `docs:`. ue-too: `docs(board): …`, which is not a version bump.
  - End every message with:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01HruVEnJRjmZERo6j8ebZMF
    ```
- **Exact copy from the mockup:**
  - Status texts:
    - `Loading @ue-too/board…`
    - `Still loading @ue-too/board from jsDelivr…` (after 6000 ms)
    - `Running`
    - `Error` or `Error (line N)`
    - `Could not load @ue-too/board`
  - Load-failure console line: `Could not download @ue-too/board <release> from jsDelivr. Check your connection, then press Run.`
  - Empty console: `Nothing logged yet. console.log() output and errors from the example show up here.`
  - Hints: `Space + drag to pan · Ctrl + scroll or pinch to zoom` for fine pointers, `Two fingers to pan · pinch to zoom` for `(pointer: coarse)`.
  - Run key label: `⌘↵` on Mac, `Ctrl ↵` elsewhere.
  - Editor aria-label: `Example code. Press Escape, then Tab, to leave the editor.`
  - Chip: `@ue-too/board <release>`.

### Working without jsDelivr

This container's proxy blocks `cdn.jsdelivr.net` and `cdnjs.cloudflare.com`, but `registry.npmjs.org` works. For local runs, start a throwaway mirror in the scratchpad (not committed):

- It is a Bun server on port 8765.
- It answers `/npm/@ue-too/<pkg>@<version>/index.js` with `package/index.js` from `https://registry.npmjs.org/@ue-too/<pkg>/-/<pkg>-<version>.tgz`, sent as `content-type: application/javascript` with `access-control-allow-origin: *`.
- Then set `LIVE_EXAMPLES_CDN=http://localhost:8765/npm/` for the scripts and for `vitepress build`.

CI uses the real jsDelivr.

## Review Focus

1. **An example that throws or logs on every animation frame:** the console shows one row with a growing `×N` count, never more than 200 rows. Long messages are truncated, and the page stays responsive. Pinned by the `addEntry` unit tests (Task 1) and page check `frame-error` (Task 4).
2. **The site's light/dark toggle flipped while the playground is open:** the editor and preview colours follow at once, without a re-run. Pinned by page check `theme-toggle` (Task 4).
3. **Leaving the page through the sidebar and coming back:** the old iframe and its loops are gone, and a stale frame's messages are ignored. The playground starts fresh, with "Running" for the first tab. Pinned by the `readPreviewMessage` run-id tests (Task 1) and page check `navigate-away` (Task 4).
4. **jsDelivr unreachable:** status `Could not load @ue-too/board` plus the console line. Pressing Run again tries again. Pinned by page check `cdn-down` (Task 4).
5. **Phone width (390 × 844):** the canvas sits above the editor, and the page never scrolls sideways. Pinned by page check `phone` (Task 4).

---

### Task 1: Preview document, message and console helpers

Pure TypeScript with no DOM. Every later task builds on these.

**Files:**
- Create: `.vitepress/theme/live-playground/preview-doc.ts`
- Create: `.vitepress/theme/live-playground/console-entries.ts`
- Test: `.vitepress/theme/live-playground/preview-doc.test.ts`
- Test: `.vitepress/theme/live-playground/console-entries.test.ts`

**Interfaces:**
- Produces, from `preview-doc.ts`:
  ```ts
  export const DEFAULT_CDN = 'https://cdn.jsdelivr.net/npm/'
  export const PREVIEW_PACKAGES = ['board', 'math', 'being'] as const
  export const MESSAGE_SOURCE = 'ue-too-live-example'
  export function importMap(release: string, cdn?: string): { imports: Record<string, string> }
  export interface PreviewDoc { html: string; codeStartLine: number } // 1-based line of `html` holding the code's first line
  export function buildPreviewDoc(code: string, opts: { release: string; runId: number; cdn?: string }): PreviewDoc
  export function bridgeSource(runId: number): string
  export function toEditorLine(docLine: number, doc: PreviewDoc, code: string): number | null
  export type PreviewMessage =
    | { type: 'ran'; runId: number }
    | { type: 'console'; runId: number; level: 'log' | 'warn' | 'error'; text: string }
    | { type: 'error'; runId: number; text: string; line: number; file: string }
    | { type: 'load-error'; runId: number }
  export function readPreviewMessage(data: unknown, runId: number): PreviewMessage | null
  ```
- Produces, from `console-entries.ts`:
  ```ts
  export interface ConsoleEntry { level: 'log' | 'warn' | 'error'; text: string; count: number }
  export const MAX_CONSOLE_ENTRIES = 200
  export const MAX_ENTRY_LENGTH = 2000
  export function addEntry(entries: readonly ConsoleEntry[], level: ConsoleEntry['level'], text: string): ConsoleEntry[]
  ```

- [ ] **Step 1: Write the failing tests**

`preview-doc.test.ts` (`import { describe, expect, test } from 'bun:test'`):

- `importMap pins every package to the release`: for `importMap('0.19.2')`:
  - `imports['@ue-too/board']` is `'https://cdn.jsdelivr.net/npm/@ue-too/board@0.19.2/index.js'`;
  - the same pattern holds for `math` and `being`;
  - `Object.keys(imports).length` is 3.
- `importMap uses a custom cdn and adds a missing trailing slash`: `importMap('0.19.2', 'http://localhost:8765/npm')`. Then `imports['@ue-too/math']` is `'http://localhost:8765/npm/@ue-too/math@0.19.2/index.js'`.
- `buildPreviewDoc puts the code where codeStartLine says`: build with `code = "import { Board } from '@ue-too/board'\nconsole.log(1)"`. Then:
  - `html.split('\n')[codeStartLine - 1]` is `"import { Board } from '@ue-too/board'"`;
  - `html` contains `<canvas id="graph"></canvas>`;
  - `html` contains `<script type="importmap">` followed by `JSON.stringify(importMap('0.19.2'))`.
- `buildPreviewDoc reports success only after the code`: the index of `window.__liveExampleRan()` in `html` is greater than the index of `console.log(1)`.
- `buildPreviewDoc escapes a closing script tag inside the code`: build with `code = "const s = '</script>'"`. Then:
  - `html` contains `'<\/script>'`;
  - the text between the module's opening tag (`<script type="module">`) and the next `</script>` contains `window.__liveExampleRan()`.
- `bridgeSource is valid JavaScript with the run id`: `new Function(bridgeSource(7))` does not throw, and `bridgeSource(7)` contains `7`.
- `toEditorLine maps document lines back to editor lines`: take a 10-line `code` with `doc = buildPreviewDoc(code, …)`. Then:
  - `toEditorLine(doc.codeStartLine, doc, code)` is `1`;
  - `toEditorLine(doc.codeStartLine + 9, doc, code)` is `10`;
  - `toEditorLine(doc.codeStartLine + 10, doc, code)` is `null`;
  - `toEditorLine(doc.codeStartLine - 1, doc, code)` is `null`.
- `readPreviewMessage accepts only well-formed messages for the current run`:
  - `{ source: MESSAGE_SOURCE, runId: 3, type: 'ran' }` with run 3 gives `{ type: 'ran', runId: 3 }`.
  - The same message read with run 4 gives `null`.
  - A wrong `source`, `null`, a string, `type: 'nope'`, a console message with `level: 'debug'`, and an error message without a numeric `line` all give `null`.
  - A valid console message comes back with `level` and `text`, and a valid error message with `text`, `line` and `file`.

`console-entries.test.ts`:

- `adds a first entry`: `addEntry([], 'log', 'a')` gives `[{ level: 'log', text: 'a', count: 1 }]`.
- `merges an exact repeat of the last entry`: adding `('error', 'boom')` twice gives one entry with `count: 2`.
- `keeps different levels apart`: `('log', 'x')` then `('warn', 'x')` gives 2 entries.
- `does not merge with an older entry`: a, b, a gives 3 entries.
- `drops the oldest beyond 200`: add 201 distinct texts `'0'` to `'200'`. That leaves length 200, and `[0].text` is `'1'`.
- `truncates long text`: add a 5000-char string. The stored `text.length` is `MAX_ENTRY_LENGTH + 1` and the text ends with `'…'`.
- `does not mutate its input`: the input array still has the same length after `addEntry`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/user/ue-too-documentation && bun test .vitepress/theme/live-playground`
Expected: FAIL. The modules don't exist.

- [ ] **Step 3: Implement `preview-doc.ts` and `console-entries.ts`**

`buildPreviewDoc` produces this document. Copy the CSS from the mockup's `buildDoc`. It includes:
- the transparent `html,body`;
- `canvas{display:block;width:100%;height:100%;touch-action:none}`;
- the fixed `output` readout used by the Zoom limits example.

```text
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>…</style>
<script type="importmap">{json}</script>
<script>{bridgeSource(runId)}</script>
</head>
<body>
<canvas id="graph"></canvas>
<script type="module">
{code with /<\/script/gi → '<\\/script'}
;window.__liveExampleRan();
</script>
</body>
</html>
```

`bridgeSource(runId)` is the mockup's `BRIDGE`, with these changes:
- it posts `{ source: MESSAGE_SOURCE, runId, … }`;
- console messages carry `level`, with `info` mapped to `log`;
- the success hook is named `window.__liveExampleRan`.

It must keep:
- the capture-phase `document` `error` listener that turns a failed `SCRIPT` load into `load-error`;
- the `unhandledrejection` forwarder;
- the `fmt` argument formatter.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test .vitepress/theme/live-playground`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add .vitepress/theme/live-playground
git commit -m "feat: preview document and console helpers for live examples"
```

---

### Task 2: Example files and the headless example check

**Files:**
- Create: `docs/board/live-examples/pan-and-zoom.js`
- Create: `docs/board/live-examples/zoom-limits.js`
- Create: `docs/board/live-examples/click-to-place.js`
- Create: `scripts/browser.ts`
- Create: `scripts/test-live-examples.ts`
- Modify: `package.json` (devDependency `"playwright": "1.56.0"`, an exact version that matches `/opt/pw-browsers/chromium-1194`; script `"test:examples": "bun run scripts/test-live-examples.ts"`)

**Interfaces:**
- Consumes: `buildPreviewDoc`, `toEditorLine` and `readPreviewMessage` from Task 1; `loadVersions`, `siteLines` and `versionSrcDir` from `scripts/versions.ts`.
- Produces:
  - `launchBrowser(): Promise<Browser>` in `scripts/browser.ts`. It uses `executablePath: process.env.CHROMIUM_EXECUTABLE` when set, and otherwise Playwright's default.
  - CLI: `bun run test:examples [file.js …]`, which exits 0 if every example runs cleanly and 1 otherwise.

- [ ] **Step 1: Add the three example files**

Copy the code from the mockup's `<script type="text/plain">` blocks `ex-pan-zoom`, `ex-limits` and `ex-click`. Don't change any code; do drop the leading blank line. These are the final versions, with the 2400 × 1600 world and 0.6×–3× zoom.

- [ ] **Step 2: Write `scripts/test-live-examples.ts`**

Behaviour:
- **Which files:**
  - With no arguments, it takes every `**/live-examples/*.js` under `versionSrcDir(versions, line)` for each line from `siteLines(loadVersions())`. Each file runs against that line's release.
  - With file arguments, it runs just those files against `versions.latest`.
- **Each file:** open a new page whose content is a plain HTML shell that records `message` events into `window.__messages` *before* anything else. Then insert `<iframe sandbox="allow-scripts">` with `srcdoc = buildPreviewDoc(code, { release, runId: 1, cdn: process.env.LIVE_EXAMPLES_CDN }).html`.
- **Outcome:** poll the messages through `readPreviewMessage(m, 1)`.
  - Fail on the first `error` or `load-error` message, printing the text and the line from `toEditorLine`.
  - Pass if `ran` arrives and no error follows within 1000 ms.
  - Fail if `ran` hasn't arrived within 20000 ms.
- **Output:** print one `✓`/`✗` line per file, then exit with code 1 if any file failed.

- [ ] **Step 3: Verify it fails on a broken example**

Run, with the mirror up:

```bash
printf "import { Board } from '@ue-too/board'\nconst b = new Board(document.getElementById('graph'))\nb.stepp(0)\n" > /tmp/claude-0/-home-user/aea7da70-6f14-5df7-a340-4c51ec1e05ac/scratchpad/broken.js
LIVE_EXAMPLES_CDN=http://localhost:8765/npm/ bun run test:examples /tmp/claude-0/-home-user/aea7da70-6f14-5df7-a340-4c51ec1e05ac/scratchpad/broken.js
```

Expected: exit 1 and `✗ … b.stepp is not a function (line 3)`.

- [ ] **Step 4: Verify the real examples pass**

Run: `LIVE_EXAMPLES_CDN=http://localhost:8765/npm/ bun run test:examples`
Expected: exit 0, with three `✓` lines against `0.19.2`. The v0.18 line has no example files, so it contributes none.

- [ ] **Step 5: Commit**

```bash
git add docs/board/live-examples scripts/browser.ts scripts/test-live-examples.ts package.json bun.lock
git commit -m "test: run every live example headless against its docs release"
```

---

### Task 3: Page, sidebar entry and release in theme config

**Files:**
- Create: `docs/board/live-examples.md`
- Modify: `.vitepress/config.ts`:
  - `ThemeConfig`, around line 7;
  - `customGuides`, around lines 108–120;
  - `addIndexToSidebar`, around lines 124–145;
  - the root `themeConfig`, near the end.

**Interfaces:**
- Consumes: `DEFAULT_CDN` from Task 1. Import it with `import { DEFAULT_CDN } from './theme/live-playground/preview-doc'`.
- Produces:
  - `ThemeConfig.livePlayground?: { release: string; cdn: string }`, set to `{ release: docsRelease, cdn: process.env.LIVE_EXAMPLES_CDN ?? DEFAULT_CDN }`. Task 4 reads it with `useData().theme.value.livePlayground`.
  - The page passes `examples: LiveExample[]` to `<LivePlayground>`, with `{ id, title, caption, code }` per example.

- [ ] **Step 1: Make `customGuides` hold a list of pages per package**

Change the type to `Record<string, Record<Locale, { text: string; file: string }[]>>`.
- `being` keeps its single Usage Guide entry, now in a list.
- `board` becomes, in order:
  - en: `Live examples` → `live-examples`, then `Extending Input State Machines`.
  - zh-TW: `即時範例`, then the existing guide entry.
  - ja: `ライブサンプル`, then the existing guide entry.

`addIndexToSidebar` loops over the list and keeps the `existsSync` check per page. That way v0.18 and the zh-TW/ja locales, which don't have the file, get no entry.

- [ ] **Step 2: Add `livePlayground` to `ThemeConfig` and to the root `themeConfig`**

- [ ] **Step 3: Write `docs/board/live-examples.md`**

Frontmatter: `aside: false` and `pageClass: live-examples-page`.

A `<script setup>` block imports the three files with `?raw` (e.g. `import panAndZoom from './live-examples/pan-and-zoom.js?raw'`). It defines `examples` in tab order, with these ids, titles and captions:

| id | title | caption |
|---|---|---|
| `pan-zoom` | Pan and zoom | the mockup's caption |
| `limits` | Zoom limits | the mockup's caption |
| `click` | Click to place | the mockup's caption |

The `pan-zoom` caption keeps `shapes` as inline code.

The page body, in order:
1. `# Live examples`.
2. The mockup's intro paragraph.
3. The controls table (Pan / Zoom × Mouse and keyboard / Trackpad / Touch).
4. `<LivePlayground :examples="examples" />`.
5. `## Where to go next`, as a list of three links:
   - [Board](./index/classes/Board.md): "Everything the examples use: `step()`, `context`, `convertWindowPoint2WorldCoord()`."
   - [Camera](./index/interfaces/ObservableBoardCamera.md): "Zoom limits, boundaries, and the `pan` / `zoom` / `rotate` events."
   - [Extending Input State Machines](./extending-input-state-machines.md): "Change what Space + drag and the other gestures do."

- [ ] **Step 4: Build the latest line and verify the sidebar, links and release**

Run: `cd /home/user/ue-too-documentation && bunx vitepress build`
Expected:
- the build succeeds. A warning that `LivePlayground` can't be resolved is fine until Task 4;
- `grep -c 'board/live-examples' .vitepress/dist/board/index.html` prints at least 1, which is the sidebar link;
- `grep -rhoE 'livePlayground.{0,80}' .vitepress/dist | head -1` shows release `0.19.2` and the cdn;
- the build reports no dead links.

- [ ] **Step 5: Verify v0.18 is untouched**

Run: `DOCS_VERSION=0.18 bunx vitepress build && grep -rc 'live-examples' .vitepress/dist/v0.18/board/index.html`
Expected: `0`.

- [ ] **Step 6: Commit**

```bash
git add .vitepress/config.ts docs/board/live-examples.md
git commit -m "feat: add the board live examples page and sidebar entry"
```

---

### Task 4: The playground component

**Files:**
- Create: `.vitepress/theme/live-playground/types.ts`, holding `export interface LiveExample { id: string; title: string; caption: string; code: string }`. `caption` is trusted HTML written by the docs authors.
- Create: `.vitepress/theme/live-playground/editor.ts`
- Create: `.vitepress/theme/live-playground/LivePlayground.vue`
- Create: `scripts/test-live-examples-page.ts`
- Modify: `.vitepress/theme/index.ts`. Register the component in `enhanceApp` as `app.component('LivePlayground', defineAsyncComponent(() => import('./live-playground/LivePlayground.vue')))`.
- Modify: `.vitepress/theme/custom.css`. On `.live-examples-page`, set `.VPDoc .content-container` to `max-width: 1040px`, and set `.vp-doc` paragraphs, lists and tables to `max-width: 688px`.
- Modify: `package.json`:
  - add the dependencies with `bun add codemirror @codemirror/lang-javascript @codemirror/language @codemirror/state @codemirror/view @codemirror/commands`;
  - add the script `"test:examples:page": "bun run scripts/test-live-examples-page.ts"`.

**Interfaces:**
- Consumes:
  - from Task 1: `buildPreviewDoc`, `toEditorLine`, `readPreviewMessage`, `addEntry`, `ConsoleEntry`;
  - from Task 3: `useData().theme.value.livePlayground` and the `examples` prop;
  - from Task 2: `launchBrowser()`.
- Produces from `editor.ts`. The component loads it with `await import('./editor')` inside `onMounted`:
  ```ts
  export interface EditorHandle {
    getCode(): string
    setCode(code: string): void
    setErrorLine(line: number | null): void // highlights and scrolls the line into view
    destroy(): void
  }
  export function createEditor(parent: HTMLElement, opts: {
    code: string
    ariaLabel: string
    onChange(code: string): void
    onRun(): void
  }): EditorHandle
  ```

- [ ] **Step 1: Write `scripts/test-live-examples-page.ts`**

**Setup:**
- Without `--url <page>`, the script runs `bunx vitepress preview --port 4173` itself. It waits until `http://localhost:4173/ue-too-documentation/board/live-examples` returns 200, and kills the server at the end.
- Each check runs in a fresh browser context from `launchBrowser()`.
- The script prints `✓`/`✗` per check and exits 1 on any failure. Waits are by condition, with a 20000 ms limit.
- "Status" below means the `[data-testid=status]` text. The component must expose these test ids: `status`, `run`, `reset`, `tab-<id>`, `console-row`, `preview`, `editor`.

**Checks, at 1400 × 1000 unless stated:**
- `runs`: status becomes `Running` for Pan and zoom, and the chip reads `@ue-too/board 0.19.2`.
- `edit-and-error`:
  - put `nope()` as the new line 1 through the editor (focus `.cm-content`, press `Control+Home`, then `keyboard.type('nope()\n')`);
  - press `Control+Enter`;
  - the status is `Error (line 1)`, the first console row contains `nope`, and `.cm-error-line` exists.
- `tabs-keep-edits`:
  - edit Pan and zoom, switch to Zoom limits, then switch back;
  - the edit is still there and the tab shows the edited dot;
  - **Reset** restores the original text.
- `frame-error`:
  - replace the code with an rAF loop that schedules its next frame and then throws `'again'`;
  - after 1500 ms there is exactly 1 console row, with a `×N` count and N > 10;
  - `page.evaluate(() => 1)` still resolves within 500 ms.
- `theme-toggle`:
  - read the computed `background-color` of `.cm-editor`;
  - click `.VPSwitchAppearance`;
  - the colour changes, and status stays `Running` with no new iframe.
- `navigate-away`:
  - click the sidebar `Overview` link, wait for its page, and expect `document.querySelectorAll('iframe').length === 0`;
  - go back with the browser's back button;
  - status is `Running` and exactly one iframe exists.
- `cdn-down`: in a context with `context.route(/@ue-too\//, r => r.abort())`, the status is `Could not load @ue-too/board`, and a console row contains `Check your connection`.
- `phone`, at 390 × 844 with `hasTouch: true` and `isMobile: true`:
  - `scrollWidth - clientWidth` of `document.documentElement` is `0`;
  - the preview's top is above the editor's top;
  - the touch hint `Two fingers to pan · pinch to zoom` is visible.

- [ ] **Step 2: Run it to verify it fails**

Run: `LIVE_EXAMPLES_CDN=http://localhost:8765/npm/ bunx vitepress build && bun run test:examples:page`
Expected: FAIL at `runs`. Nothing renders a status yet.

- [ ] **Step 3: Implement `editor.ts`**

Build the editor from these parts:
- `basicSetup` from `codemirror`, plus `javascript()`;
- `indentUnit.of('    ')`;
- `keymap.of([indentWithTab])`;
- a `Prec.highest` keymap that sends `Mod-Enter` to `onRun`. CodeMirror's default Escape behaviour then lets Tab leave the editor;
- `EditorView.contentAttributes.of({ 'aria-label': ariaLabel })`;
- an update listener that calls `onChange`;
- a `StateField` of line decorations with class `cm-error-line`, driven by a `StateEffect`. `setErrorLine` also dispatches `EditorView.scrollIntoView` for that line.

Styling:
- The theme uses only CSS variables: background `var(--vp-c-bg-alt)`, text `var(--vp-c-text-1)`, gutters `var(--vp-c-text-3)` with a `var(--vp-c-divider)` border, selection `var(--vp-c-brand-soft)`, and error line `var(--vp-c-danger-soft)`.
- Font: `var(--vp-font-family-mono)`, 13px with 20px line height.
- Syntax colours come from a `HighlightStyle` whose colours are `var(--lp-tk-keyword|string|function|number|comment|property|punct)`. With only variables, colours follow the theme toggle without a reload.

- [ ] **Step 4: Implement `LivePlayground.vue`**

Copy the structure and copy from the mockup's playground: header (tabs, chip, Reset, Run), caption, editor, preview with status and hint, and console. Behaviour:

- **State and setup:**
  - Per-tab code lives in a reactive copy of `examples`, and the tab dot shows when `code !== original`.
  - `release` and `cdn` come from `useData().theme.value.livePlayground`.
  - The Run key label comes from `navigator.platform`/`userAgent`, read in `onMounted`.
  - Everything that touches `window` happens in `onMounted`.
- **`run()`:**
  - increment `runId`;
  - clear the error line and the console;
  - remove the old iframe;
  - create `<iframe sandbox="allow-scripts" title="Live example output">` with `srcdoc` from `buildPreviewDoc` and prepend it to the preview;
  - set status `Loading…` and start the 6000 ms "Still loading" timer.
  - A first run happens on mount and on every tab switch.
- **The window `message` listener:**
  - ignore anything where `e.source !== iframe.contentWindow`, or where `readPreviewMessage(e.data, runId)` is `null`;
  - `ran`: Running, unless an error has already been shown;
  - `console`: `addEntry`;
  - `load-error`: the error status and the console line;
  - `error`: `toEditorLine` when `file` starts with `about:srcdoc`, then `Error (line N)` and `editor.setErrorLine(N)`; otherwise just `Error`.
- **`onBeforeUnmount`:** remove the listener, clear the timer, remove the iframe and call `editor.destroy()`.
- **Styles (scoped):**
  - `.live-playground { container-type: inline-size }`;
  - side by side at `@container (min-width: 860px)`, with both panes 480px tall;
  - otherwise stacked: canvas on top at 400px, editor at 360px;
  - below 600px container width, both 340px;
  - the iframe gets `color-scheme: light` and a transparent background, and the preview background is `var(--vp-c-bg-alt)`;
  - the `--lp-tk-*` colours are the mockup's light values on `.live-playground`, with its dark values under `.dark .live-playground`;
  - the hints switch on `@media (pointer: coarse)`.
- **Console:** follow the mockup's console: a header with a count and Clear, `›` for log rows, colours for warn and error, `×N` for repeats, and the empty-state text.

- [ ] **Step 5: Register the component and add the page-width CSS**

Do this as listed under Files.

- [ ] **Step 6: Run the page check to verify it passes**

Run: `LIVE_EXAMPLES_CDN=http://localhost:8765/npm/ bunx vitepress build && bun run test:examples:page`
Expected: all eight checks `✓`, exit 0.

- [ ] **Step 7: Verify CodeMirror is split out of the main bundle**

Run: `grep -l 'cm-content' .vitepress/dist/assets/*.js`
Expected: matches only chunk files whose names don't start with `app.` or `framework.`.

- [ ] **Step 8: Check the spec's two open items and record what you find**

These are the spec's "Things to check while building".

- **Phone scrolling:** in the `phone` context, start a one-finger swipe on the preview with `page.touchscreen` or CDP touch events, and see whether `window.scrollY` changes.
  - If it doesn't, check that 340px plus the page around it leaves room to scroll. It does at 844px tall.
  - Either way, note the result for the final report.
- **Pixel ratio:** in a `deviceScaleFactor: 2` context, compare `canvas.width` with `canvas.clientWidth` inside the iframe.
  - If they are equal, find out whether Board's `step()` or the preview setup causes it.
  - Report a Board cause, but don't work around it.

- [ ] **Step 9: Commit**

```bash
git add .vitepress/theme scripts/test-live-examples-page.ts package.json bun.lock
git commit -m "feat: live playground component for the board live examples"
```

---

### Task 5: CI workflow and docs-repo README

**Files:**
- Create: `.github/workflows/live-examples.yml`
- Modify: `README.md` (add a "Live examples" section)

**Interfaces:**
- Consumes: `bun test`, `bun run test:examples` and `bun run test:examples:page` from Tasks 1, 2 and 4; `.github/actions/setup-bun-env`.

- [ ] **Step 1: Write the workflow**

- **Name:** `Live examples`.
- **Triggers:** `pull_request`, `push` to `main`, a weekly `schedule` (`'17 6 * * 1'`, Mondays 06:17 UTC), and `workflow_dispatch`.
- **One job on `ubuntu-latest`, in order:**
  1. `actions/checkout@v4`;
  2. `./.github/actions/setup-bun-env`, with defaults (no build);
  3. `bunx playwright install --with-deps chromium`;
  4. `bun test`;
  5. `bun run test:examples`;
  6. `bunx vitepress build` (the latest line only);
  7. `bun run test:examples:page`.

Don't touch `deploy.yml`.

- [ ] **Step 2: Verify the workflow parses**

Run: `bun -e "console.log(Object.keys(Bun.YAML.parse(await Bun.file('.github/workflows/live-examples.yml').text()).jobs))"`
Expected: prints the job name.

- [ ] **Step 3: Add a "Live examples" section to the README**

Cover:
- where the example files live (`docs/board/live-examples/*.js`);
- the rules for example code (from Global Constraints);
- that examples run the line's release from `versions.json`;
- how to add an example: a file plus an entry in the page's `examples`;
- the commands `bun run test:examples` and `bun run test:examples:page` (the latter after `bunx vitepress build`);
- `LIVE_EXAMPLES_CDN` and `CHROMIUM_EXECUTABLE`;
- that the check runs on PRs, on `main` and weekly, and doesn't block deploys.

- [ ] **Step 4: Run the whole local suite once more**

Run:

```bash
bun test && LIVE_EXAMPLES_CDN=http://localhost:8765/npm/ bun run test:examples && LIVE_EXAMPLES_CDN=http://localhost:8765/npm/ bun run docs:build && bun run test:examples:page
```

Expected: all pass. `docs:build` builds both lines, which proves v0.18 still builds.

- [ ] **Step 5: Commit and push the docs repo**

```bash
git add .github/workflows/live-examples.yml README.md
git commit -m "ci: check the live examples on PRs, main and weekly"
git push -u origin claude/festive-cray-10b1wg
```

---

### Task 6: Link from the board README (ue-too)

**Files:**
- Modify: `/home/user/ue-too/packages/board/README.md`, in the `## Examples` section, after the line "A live website containing the examples is available [here](…)."

- [ ] **Step 1: Add the line**

`You can also pan, zoom and edit live examples right in the docs: [Live examples](https://kinnet-studio.github.io/ue-too-documentation/board/live-examples).`

- [ ] **Step 2: Verify formatting**

Run: `cd /home/user/ue-too && bunx prettier --check packages/board/README.md`
Expected: passes. If it doesn't, run `bunx prettier --write` on the file and check that only the new line changed.

- [ ] **Step 3: Commit and push**

```bash
git add packages/board/README.md
git commit -m "docs(board): link to the live examples in the docs"
git push -u origin claude/festive-cray-10b1wg
```
