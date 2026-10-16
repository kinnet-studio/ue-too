# Live examples on the docs site: design

Date: 2026-10-16
Repos: `kinnet-studio/ue-too-documentation` (all of the build), `kinnet-studio/ue-too` (one README line)
Approved mockup: https://claude.ai/artifact/U19juWjDTZHqHDJwJeHxAq

## Intent

People reading the `@ue-too/board` docs should be able to:

1. pan and zoom a real board canvas to get a feel for how it behaves, and
2. edit real example code and re-run it in place.

All of this happens on the docs site. Today the docs only link out to the separate examples app (kinnet-studio.github.io/ue-too/) and to a StackBlitz project.

"Real code" means the snippet a reader would paste into their own project. It is not a panel of sliders over a fixed demo.

## What was decided with the owner

- Readers edit and re-run real code. Changing settings on a fixed demo was not what they wanted.
- `board` comes first. `being` is a "maybe, later".
- The owner approved the mockup as it stands ("lgtm"). It includes:
  - a **Live examples** page in the board section of the sidebar, right after Overview;
  - a controls table (pan and zoom for mouse and keyboard, trackpad and touch), taken from the board README;
  - one playground with three tabbed examples: **Pan and zoom**, **Zoom limits** and **Click to place**;
  - a toolbar with a version chip (`@ue-too/board <version>`), **Reset** and **Run** (also Ctrl/⌘ + Enter);
  - an editor with line numbers, and a preview with a status badge (Loading, Running, Error with its line number, Could not load) and a hint about the controls;
  - a console under both that shows `console.log` output and errors, with repeats collapsed to "×N" and a Clear button. The line with an error is highlighted in the editor and scrolled into view;
  - a "Where to go next" section linking to the Board and Camera API pages and the Extending Input State Machines guide;
  - editor and canvas side by side on wide screens, and the canvas on top of the editor on narrow screens.
- The examples run the actual published package, not a copy bundled into the site.

## Goals

- A board **Live examples** page on the latest docs line that works like the mockup.
- Examples run against the exact release that docs line is for (`versions.json`). The latest line uses `0.19.2` today.
- When a new minor release archives the current line, its live examples keep working against that line's release. They need no extra work to do so.
- If a release import breaks an example (for example, an API was renamed), a pull request check catches it before it reaches the site.
- The editor and preview load only on pages that use them. Other docs pages get no heavier.

## Non-goals (for this round)

- `being` examples. The playground should not rule them out: a being example can ignore the canvas and log transitions to the console. No being content is written now.
- zh-TW and ja versions of the page. The existing hand-written board guide is English-only too.
- Live examples on lines released before this work (v0.18).
- TypeScript in the editor, type checking or autocomplete. Examples are plain JavaScript modules.
- Saving edits, sharing edited code by URL, or opening an example in StackBlitz.
- Replacing the separate examples app.

## Anti-goals

These would count as failures even if everything technically works:

- An example silently running a different version from the one the docs describe.
- Example code a reader cannot copy into their own project. Each example must be a self-contained ES module that imports only public `@ue-too/*` entry points and gets its canvas with `document.getElementById('graph')`. No hidden globals and no injected helpers.
- A broken example on the live site that nobody notices.
- The page's own JavaScript breaking when a reader's code throws, logs heavily, or leaves animation loops and listeners running. A reader's code must only ever affect the preview.

An infinite loop that never yields, such as `while (true) {}`, is different. A sandboxed iframe gets its own process only in some browsers (usually Chrome on desktop). Elsewhere, such a loop freezes the whole docs tab until reload. That is accepted. Don't add loop guards: they would mean running code that differs from the code shown. Don't move the preview to a separate site either.

## Constraints from the existing projects

- The docs site is VitePress 2 (alpha) with Bun tooling. Each release line is a separate build, selected by `DOCS_VERSION` in `.vitepress/config.ts`. The source directory is `docs/` for the latest line and `versions/v<line>/` for archived lines. The base path differs per line (`/ue-too-documentation/`, `/ue-too-documentation/v0.18/`).
- `.vitepress/theme` is shared by every line's build.
- `config.ts` already knows `docsRelease`, the exact release a build is for.
- Release imports (`scripts/import-docs.ts`) copy TypeDoc output over `docs/` and never delete anything, so hand-written files survive. A new minor copies all of `docs/` to `versions/v<previous line>/`. A page and its example files under `docs/board/` are therefore archived with their line automatically.
- The sidebar comes from `buildSidebar()` in `config.ts`. Hand-written pages are added through `customGuides`, which allows one guide per package and only adds it if the file exists in that line's source directory.
- VitePress renders pages on the server at build time, so the playground must only touch browser APIs on the client.
- Packages are published in lockstep, one version for every `@ue-too/*` package. Each package exports only `./index.js`, which imports its sibling packages by bare name. For example, board 0.19.0 and 0.19.2 import `@ue-too/math` and `@ue-too/being`, and neither of those imports anything. The browser has to resolve those names, so the import map must cover them.
- The site deploys to GitHub Pages from `main` (`.github/workflows/deploy.yml`).

## How it works

### Page and sidebar

- `docs/board/live-examples.md` (English). Its frontmatter turns off the right-hand outline and gives the page a class, so the playground can be wider than the prose column. The mockup's playground is about 1000px wide next to the sidebar.
- The page has an intro paragraph, the controls table, the playground and a "Where to go next" section. The links in that section are real links into the API reference and the guide.
- `customGuides` changes to allow a list of pages per package. Board gets **Live examples** and then **Extending Input State Machines**, in that order, right after Overview. The existing rule that a page only appears if its file exists in that line's source directory stays as it is, so v0.18 is unaffected.

### Example files

- Each example is a real `.js` file beside the page: `docs/board/live-examples/pan-and-zoom.js`, `zoom-limits.js` and `click-to-place.js`. The page imports them as raw text (Vite `?raw`) and passes them to the playground with a title and a one-line caption.
- Start from the mockup's code for all three examples, unchanged. The mockup's numbers for Zoom limits were picked so that zooming all the way out still fits inside the boundaries at every playground size (a 2400 × 1600 world, zoom from 0.6× to 3×). With a minimum zoom too low to fit, the view slides past the world edge.

### Playground component

- A Vue component in `.vitepress/theme/components/`, used from the page.
- **Editor:** CodeMirror 6 with JavaScript language support, coloured from VitePress's CSS variables so it follows the site's light/dark toggle. It loads in the browser only, and only on pages that use the playground. Mod-Enter runs the code. Tab indents, and Escape followed by Tab moves focus out of the editor.
- **Preview:** a sandboxed iframe (`sandbox="allow-scripts"`, no same-origin) built from a `srcdoc` document that contains:
  - an import map pointing every `@ue-too/*` package at `https://cdn.jsdelivr.net/npm/@ue-too/<pkg>@<docsRelease>/index.js`;
  - a small bridge script that forwards console calls, uncaught errors, unhandled rejections and script load failures to the parent with `postMessage`;
  - `<canvas id="graph">` filling the frame;
  - the reader's code as a `<script type="module">`, followed by a line that reports a successful run.
- **Running:** each run replaces the iframe. This stops the old animation loops and listeners. Messages are accepted only from the current iframe's window and tagged with a run id, so a stale frame can't change the status. Error line numbers are mapped back to editor lines by subtracting the number of lines in the document before the reader's code. A literal `</script` in the reader's code is escaped.
- **Theme:** the iframe's background is transparent, so the preview sits on the site's own background. Set `color-scheme: light` on the iframe element. Without it, the site's dark mode gives the frame an opaque white backdrop. The example code draws with colours that read on both backgrounds.
- **Layout:** side by side when the playground is wide enough, the canvas on top otherwise. Use a container query on the playground's own width rather than on the viewport, because the sidebar takes up part of the screen.
- **Edits:** each tab keeps its edits while the reader stays on the page. Reset restores the original code. Nothing is saved.
- **Hint text:** "Space + drag to pan · Ctrl + scroll or pinch to zoom" on mouse devices, and "Two fingers to pan · pinch to zoom" on touch devices.
- **Version:** the release comes from `config.ts` (`docsRelease`), passed to the client through theme config or a Vite `define`. It is used both in the import map and in the version chip.

### Keeping examples working

- `scripts/test-live-examples.ts` runs every example file of every line that has them in headless Chromium, using the same `srcdoc` builder as the component. It fails if any example reports an error or doesn't report a successful run within a timeout.
- Pull out the `srcdoc` builder as a plain TypeScript module so the component and the test share it, and give it a `bun test` unit test for line-number mapping and `</script` escaping.
- Add a new workflow, `.github/workflows/live-examples.yml`, that runs the script:
  - on pull requests. This is mainly for the release-import PR that ue-too opens on every release. If a new minor changes an API, that PR shows the failure and the examples get fixed in the same PR;
  - on pushes to `main`, which sometimes get direct fix commits;
  - once a week, to catch breakage from outside, such as a CDN or browser change.
- The check does not block deploys, so an urgent docs fix never waits on jsDelivr. Making it a required check on PRs is a repo setting for the owner to choose.

### ue-too repo

- Add one line to the "Examples" section of `packages/board/README.md` linking to the docs' Live examples page. The README becomes the board overview page on the docs site, and it also appears on npm and GitHub. The change ships with the next release.

## Things to check while building

- **Phone scrolling:** on a phone, check that the reader can still scroll the page past the preview. Board handles touch input itself, so a finger on the canvas may not scroll the page. If that can't be avoided, keep the preview short enough that there is always page around it to drag.
- **Canvas pixel ratio:** in the mockup at device pixel ratio 2, the canvas's backing size equalled its CSS size, so drawing may look soft on high-density screens. Check whether this comes from Board or from the preview setup. If it comes from Board, report it rather than working around it in the docs.

## Left to the builder

- Component file structure, CodeMirror extensions and styling details, as long as it looks and behaves like the mockup.
- How `docsRelease` reaches the client.
- The exact widths at which the layout switches, and the heights. The mockup uses 480px side by side, and 400px canvas with a 360px editor stacked.
- Whether the smoke test serves the built site or a minimal harness page.
- Wording of captions and the intro, starting from the mockup's text.
