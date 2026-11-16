## 0.21.0 (2026-11-16)

### 🚀 Features

- **board:** one-finger-pan, two-finger-pinch touch state machine ([#469](https://github.com/kinnet-studio/ue-too/pull/469))
- ⚠️  **board:** start boards in keyboard-mouse mode, with a toggle switch in the examples ([#473](https://github.com/kinnet-studio/ue-too/pull/473))
- **board:** add a whiteboard editor (@ue-too/board/whiteboard) ([#476](https://github.com/kinnet-studio/ue-too/pull/476))
- **examples:** editable Mermaid diagrams rendered by Pele, panned and zoomed with the board camera ([#467](https://github.com/kinnet-studio/ue-too/pull/467))
- **examples:** start the Pele example on the Pele playground's gitGraph ([#468](https://github.com/kinnet-studio/ue-too/pull/468))
- **examples:** one-finger drag pans the Pele example on touch ([#471](https://github.com/kinnet-studio/ue-too/pull/471), [#469](https://github.com/kinnet-studio/ue-too/issues/469))
- **examples:** match the docs site's theme ([#475](https://github.com/kinnet-studio/ue-too/pull/475), [#13200](https://github.com/kinnet-studio/ue-too/issues/13200))

### 🩹 Fixes

- **examples:** full-width Pele diagram on first load on phones ([#470](https://github.com/kinnet-studio/ue-too/pull/470))

### ⚠️  Breaking Changes

- **board:** start boards in keyboard-mouse mode, with a toggle switch in the examples  ([#473](https://github.com/kinnet-studio/ue-too/pull/473))
  a board's input mode now starts as 'kmt' instead of 'TBD',
  so a plain scroll wheel zooms at the cursor instead of panning, and wheel
  events are no longer scored. To keep the old behavior, call
  board.enableAutoInputMode() (or tracker.enableInputModeDetection()); to make
  the wheel pan, call board.setInputMode('trackpad').
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YVuuAZ3JKu72PHqYgnsUMH
  * feat(board-pixi-integration): add an inputMode option to baseInitApp
  baseInitApp({ inputMode: 'trackpad' }) starts the board's input tracker in
  that mode; it defaults to 'kmt' like the board itself. Switch later with
  components.observableInputTracker.setMode.
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YVuuAZ3JKu72PHqYgnsUMH
  * feat(examples): add a keyboard + mouse / trackpad picker
  A picker next to the language picker lets visitors choose their input
  device. The choice is saved in localStorage (ue-too-examples-input-mode),
  defaults to keyboard + mouse, and every example's board follows it live.
  Add a bun test target for the examples app covering the saved preference,
  and a data-i18n-aria-label attribute so the picker's label follows the
  language picker.
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YVuuAZ3JKu72PHqYgnsUMH
  * feat(examples): make the input device picker a toggle switch
  Replace the Keyboard + Mouse / Trackpad dropdown with a switch: the two
  labels sit either side of it and the active one is highlighted. It is a
  role="switch" button named "Trackpad" (on = trackpad). After a mouse click
  it hands focus back to the page so the next Space + drag pans instead of
  flipping the switch; keyboard users keep focus.
  The wider top bar no longer fits beside the title on a phone, so below
  640px it takes its own line, and on the Pele page (a narrow side panel at
  every size) it always does. Point the Pele help at the shared "Scroll to
  zoom" text now that a plain scroll zooms there, and drop the unused label
  and Ctrl + Scroll strings.
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YVuuAZ3JKu72PHqYgnsUMH
  * fix(examples): fit fixed-width canvases to the page on phones
  Seven examples drew an 800 × 600 (Navigation: 600 × 500) canvas, wider than
  a phone, so the page scrolled sideways and the canvas was cut off. Each
  canvas is now its design size or the page width less a 16px gutter each
  side, whichever is smaller, keeping its aspect ratio:
  - Ruler, Navigation, Camera Animation, Image: a CSS size
    (width: min(800px, 100vw - 32px); aspect-ratio), which Board follows.
  - Konva, Fabric, SVG: their libraries need pixel sizes, so a small
    fitToPage helper sizes the stage / canvas / SVG and the camera viewport
    at load and again on window resize.
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YVuuAZ3JKu72PHqYgnsUMH
  * fix(examples): fit canvases to short windows and keep the SVG unsqueezed
  The example pages are a fixed-height, non-scrolling column. On a short
  window (a 1366 × 768 laptop) the instructions, canvas and controls didn't
  fit: the SVG example's drawing was squeezed by flex shrinking, and five
  canvas pages ran off the top and bottom instead, hiding the input switch
  and language picker out of reach.
  fitToPage now fits each canvas into the room the window has left after the
  instructions and controls, as well as to its width, and re-fits when the
  window or those blocks change size (switching language, or the top bar
  moving onto its own line). The four Board pages use it too, setting the
  canvas's CSS size for the board to follow, instead of the width-only CSS
  rule. The SVG no longer flex-shrinks, so it always draws at the size the
  camera expects.
  Collision and collision-legacy draw a full-window canvas with a 1px border
  that stuck out 2px past the window; box-sizing: border-box keeps the
  border inside.
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YVuuAZ3JKu72PHqYgnsUMH
  * fix(board-konva-integration): keep the wheel from scrolling or zooming the page
  KonvaInputParser's wheel handler drove the camera but let the browser act
  on the event too: on a page that scrolls, a wheel over the stage also
  scrolled the page, and a trackpad pinch (Ctrl + wheel) zoomed the whole
  browser page. Call preventDefault on the wheel event.
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YVuuAZ3JKu72PHqYgnsUMH
  * fix(board-fabric-integration): keep the wheel from scrolling or zooming the page
  FabricInputEventParser's wheel handler drove the camera but let the browser
  act on the event too: on a page that scrolls, a wheel over the canvas also
  scrolled the page, and a trackpad pinch (Ctrl + wheel) zoomed the whole
  browser page. Call preventDefault on the wheel event while the parser is
  enabled; a disabled parser still leaves the wheel to the page.
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YVuuAZ3JKu72PHqYgnsUMH
  * fix(examples): scroll the example pages on windows too short to fit
  A phone held sideways (844 × 390) is shorter than the instructions alone,
  and the example pages were a fixed-height column with overflow hidden, so
  the top bar, title and canvas ran off-screen out of reach. Let the nine
  pages with that layout grow past the window and scroll: the column is now
  at least the window's height (with a 16px margin top and bottom) instead
  of exactly it, and the body no longer hides overflow. Pages that fit look
  the same and don't scroll. Base and Attach/Detach size their canvas at
  50vh instead of 50% of a column that no longer has a fixed height.
  A wheel over a canvas still zooms without scrolling the page (the Konva
  and Fabric parsers now prevent the default too); off the canvas it
  scrolls the page.
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YVuuAZ3JKu72PHqYgnsUMH
  * fix(board): keep Space over the canvas from scrolling the page
  Space aimed at the page starts Space + drag panning, but the board never
  prevented its default, so on a page that scrolls, Space (and every key
  repeat while it is held) also scrolled the page under the pan. When the
  pointer is over the canvas and the parser is enabled, prevent the default.
  With the pointer elsewhere Space still scrolls the page, so a board
  embedded in a long page doesn't take Space over, and a space typed into a
  field is never touched.
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YVuuAZ3JKu72PHqYgnsUMH
  * fix(board-konva-integration): keep Space over the stage from scrolling the page
  Space starts Space + drag panning, but on a page that scrolls it (and every
  key repeat while held) also scrolled the page. When Space is aimed at the
  page and the pointer is over the stage, prevent the default. Elsewhere, or
  typed into a field, Space is left alone.
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YVuuAZ3JKu72PHqYgnsUMH
  * fix(board-fabric-integration): keep Space over the canvas from scrolling the page
  Space starts Space + drag panning, but on a page that scrolls it (and every
  key repeat while held) also scrolled the page. When the parser is enabled,
  Space is aimed at the page and the pointer is over the canvas (its wrapper,
  for an interactive canvas's two stacked layers), prevent the default.
  Elsewhere, typed into a field, or while disabled, Space is left alone.
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YVuuAZ3JKu72PHqYgnsUMH

### ❤️ Thank You

- Claude
- Claude Opus 5.5
- vee @niuee

## 0.20.0 (2026-11-09)

### 🚀 Features

- **board:** smooth zoom-and-pan camera flights with createZoomPanPath ([#465](https://github.com/kinnet-studio/ue-too/pull/465))

### 🩹 Fixes

- **board:** one Windows wheel notch no longer zooms out to the floor ([#458](https://github.com/kinnet-studio/ue-too/pull/458))
- **board-pixi-react-integration:** scrollbar drag direction, Home/End and resize ([#452](https://github.com/kinnet-studio/ue-too/pull/452))

### ❤️ Thank You

- Claude
- Claude Opus 5.5
- vee @niuee

## 0.19.0 (2026-09-30)

### 🚀 Features

- ⚠️  DelegatingState and state expansion helpers replace the hierarchical POC ([#446](https://github.com/kinnet-studio/ue-too/pull/446))
- **being-devtools:** attachable debugger panel for being machines ([#439](https://github.com/kinnet-studio/ue-too/pull/439))
- **being-portable:** portable, serializable being machine definitions ([#451](https://github.com/kinnet-studio/ue-too/pull/451))

### 🩹 Fixes

- camera owns copies of its limit objects ([#449](https://github.com/kinnet-studio/ue-too/pull/449))
- **being-devtools:** inline × hides the sidebar, and the panel stacks on phones ([#445](https://github.com/kinnet-studio/ue-too/pull/445))
- **board:** ignore a zero canvas measurement instead of latching it ([#444](https://github.com/kinnet-studio/ue-too/pull/444))
- **board-pixi-integration:** base teardown reads live parsers and survives a replaced cleanup ([#441](https://github.com/kinnet-studio/ue-too/pull/441))

### ⚠️  Breaking Changes

- DelegatingState and state expansion helpers replace the hierarchical POC  ([#446](https://github.com/kinnet-studio/ue-too/pull/446))
  CompositeState, HierarchicalStateMachine and the related
  hierarchical types are no longer exported. Use DelegatingState instead.
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  * feat(board): add expandKmtInputStateMachine and expandTouchInputStateMachine
  Build the stock KMT or touch machine with more events, states, context or
  outputs without re-listing every built-in state. The factory hands the
  callback the stock states already typed for the expanded machine plus an
  extend helper bound to the same generics; untouched stock states keep their
  behaviour and ignore events they do not know. The generic constraints and a
  conditional on the callback type reject a non-superset expansion at compile
  time.
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

### ❤️ Thank You

- Claude Fable 5.1
- Claude Haiku 4.5
- Claude Opus 5 (1M context)
- Claude Opus 5.5 (1M context)
- vee @niuee

## 0.18.0 (2026-09-03)

### 🚀 Features

- state machine visualizer page + extractMachineGraph introspection API ([#428](https://github.com/kinnet-studio/ue-too/pull/428))
- surface eventPreconditions in the state machine visualizer ([#434](https://github.com/kinnet-studio/ue-too/pull/434))
- live affordance dimming + context inspector in state machine visualizer ([#435](https://github.com/kinnet-studio/ue-too/pull/435))
- live board machines in the state machine visualizer ([#436](https://github.com/kinnet-studio/ue-too/pull/436), [#435](https://github.com/kinnet-studio/ue-too/issues/435))
- **banana:** add flip direction and reverse order for formation children ([#386](https://github.com/kinnet-studio/ue-too/pull/386))
- **banana:** add car editor link to landing page ([#389](https://github.com/kinnet-studio/ue-too/pull/389))
- **banana:** duplicate track to the side ([#390](https://github.com/kinnet-studio/ue-too/pull/390))
- **banana:** toggle bogies rendering from debug panel ([#391](https://github.com/kinnet-studio/ue-too/pull/391))
- **banana:** save car definitions to IndexedDB library ([#392](https://github.com/kinnet-studio/ue-too/pull/392))
- **banana:** group toolbar into category rail + flyout panel ([#394](https://github.com/kinnet-studio/ue-too/pull/394))
- **banana:** catenary layout tool for placing overhead wires on existing tracks ([#398](https://github.com/kinnet-studio/ue-too/pull/398))
- **banana:** multi-gauge track support ([#402](https://github.com/kinnet-studio/ue-too/pull/402))
- **banana:** track-aligned station platforms ([#403](https://github.com/kinnet-studio/ue-too/pull/403))
- **banana:** joint direction editing tool ([#405](https://github.com/kinnet-studio/ue-too/pull/405))
- **banana:** train collision prevention system ([#409](https://github.com/kinnet-studio/ue-too/pull/409))
- **being:** add eventPreconditions pre-action vetoes to states ([#432](https://github.com/kinnet-studio/ue-too/pull/432))
- **board:** add input-mode toggle API to Board ([#419](https://github.com/kinnet-studio/ue-too/pull/419))
- **board-pixi-integration:** bump pixi.js to 8.20.1 ([#437](https://github.com/kinnet-studio/ue-too/pull/437))
- **examples:** rectilinear edges in state machine visualizer ([#433](https://github.com/kinnet-studio/ue-too/pull/433))
- **horse-racing:** v2 rebuild — phases 1-3 (attributes, dynamics, observation) ([#399](https://github.com/kinnet-studio/ue-too/pull/399))
- **horse-racing:** BT rebalance + manual tuning harness + physics fixes ([#410](https://github.com/kinnet-studio/ue-too/pull/410))

### 🩹 Fixes

- force production JSX transform in Bun.build output ([#380](https://github.com/kinnet-studio/ue-too/pull/380), [#379](https://github.com/kinnet-studio/ue-too/issues/379))
- **banana:** toolbar UI improvements ([#382](https://github.com/kinnet-studio/ue-too/pull/382))
- **banana:** use bogie-to-bogie angle for gangway on curves ([#384](https://github.com/kinnet-studio/ue-too/pull/384))
- **banana:** use epoch time for simulation clock ([#385](https://github.com/kinnet-studio/ue-too/pull/385))
- **banana:** skip tunnel entrance geometry for fully-underground ramps ([#387](https://github.com/kinnet-studio/ue-too/pull/387))
- **banana:** attach toolbar scroll-overflow observers once app mounts ([#388](https://github.com/kinnet-studio/ue-too/pull/388))
- **banana:** isolate landing CTA hover state per button ([#393](https://github.com/kinnet-studio/ue-too/pull/393))
- **banana:** draw track shadows above same-band drawables ([#395](https://github.com/kinnet-studio/ue-too/pull/395))
- **banana:** separate bogie walk-back from forward JDM ([#396](https://github.com/kinnet-studio/ue-too/pull/396))
- **banana:** account for ballast and bed width in track shadows ([#400](https://github.com/kinnet-studio/ue-too/pull/400))
- **banana:** place catenary poles at track edge instead of fixed offset ([#401](https://github.com/kinnet-studio/ue-too/pull/401))
- **banana:** multi-platform per station + timetable platform selection ([#404](https://github.com/kinnet-studio/ue-too/pull/404))
- **banana:** gangway length on curves, coupler rendering, and car type UI ([#407](https://github.com/kinnet-studio/ue-too/pull/407))
- **banana:** close toolbar flyout when activating a tool or opening a panel ([#408](https://github.com/kinnet-studio/ue-too/pull/408))
- **board:** explicit package exports and root imports for bundlers ([#378](https://github.com/kinnet-studio/ue-too/pull/378))
- **board-pixi-integration:** mark pixi.js and workspace deps as external in build ([#383](https://github.com/kinnet-studio/ue-too/pull/383))
- **board-pixi-react-integration:** prevent Pixi re-init and lost-context reuse ([#422](https://github.com/kinnet-studio/ue-too/pull/422))
- **dynamics:** gate static-friction velocity clamp on frictionEnabled ([#413](https://github.com/kinnet-studio/ue-too/pull/413))

### ❤️ Thank You

- Claude Fable 5
- Claude Fable 5.1
- Claude Opus 4.6
- Claude Opus 4.6 (1M context)
- Claude Opus 4.7
- Claude Opus 4.7 (1M context)
- Claude Opus 4.8
- Claude Opus 5 (1M context)
- Claude Sonnet 4.6
- vee @niuee

## 0.17.1 (2026-04-08)

### 🩹 Fixes

- **board:** explicit package exports and root imports for bundlers ([#379](https://github.com/kinnet-studio/ue-too/pull/379))

### ❤️ Thank You

- vee @niuee

## 0.17.0 (2026-04-08)

### 🩹 Fixes

- support nested subpath exports in package.json ([#377](https://github.com/kinnet-studio/ue-too/pull/377))

### ❤️ Thank You

- Claude Opus 4.6
- vee @niuee

## 0.16.0 (2026-03-25)

This was a version bump only, there were no code changes.

## 0.15.0 (2026-02-24)

### 🩹 Fixes

- add temp file to gitignore ([11f19d8](https://github.com/kinnet-studio/ue-too/commit/11f19d8))

### ❤️ Thank You

- Vincent Chang

## 0.14.0 (2026-01-19)

### 🩹 Fixes

- no longer release individual package's bundled javascript ([#318](https://github.com/kinnet-studio/ue-too/pull/318))

### ❤️ Thank You

- niuee @niuee

## 0.13.0 (2026-01-19)

### 🚀 Features

- add vue integration ([#303](https://github.com/kinnet-studio/ue-too/pull/303))
- auto detect input mode ([#306](https://github.com/kinnet-studio/ue-too/pull/306))
- third party framework integration ([#310](https://github.com/kinnet-studio/ue-too/pull/310))
- board component swappable ([#311](https://github.com/kinnet-studio/ue-too/pull/311))
- add hierarchical state machine poc ([#312](https://github.com/kinnet-studio/ue-too/pull/312))
- ecs serializable ([#314](https://github.com/kinnet-studio/ue-too/pull/314))
- board game engine ([#315](https://github.com/kinnet-studio/ue-too/pull/315))

### 🩹 Fixes

- documentation ([2414e43](https://github.com/kinnet-studio/ue-too/commit/2414e43))
- update when attribute changes ([#304](https://github.com/kinnet-studio/ue-too/pull/304))
- vue library bundle ([#309](https://github.com/kinnet-studio/ue-too/pull/309))
- board-vue dependency update ([3ed998a](https://github.com/kinnet-studio/ue-too/commit/3ed998a))
- state machine ([#313](https://github.com/kinnet-studio/ue-too/pull/313))
- update gitignore ([9c8d424](https://github.com/kinnet-studio/ue-too/commit/9c8d424))
- build workflow ([#316](https://github.com/kinnet-studio/ue-too/pull/316))

### ❤️ Thank You

- niuee @niuee

## 0.12.0 (2025-12-26)

This was a version bump only, there were no code changes.

## 0.11.0 (2025-12-26)

This was a version bump only, there were no code changes.

## 0.10.0 (2025-12-26)

### 🚀 Features

- copy doc media to deploy to github pages ([#289](https://github.com/kinnet-studio/ue-too/pull/289))
- typedoc flow ([#292](https://github.com/kinnet-studio/ue-too/pull/292))
- documentation deployment upon new release ([#293](https://github.com/kinnet-studio/ue-too/pull/293))
- subdirectory import ([#294](https://github.com/kinnet-studio/ue-too/pull/294))
- add a new package for board react adapter ([#297](https://github.com/kinnet-studio/ue-too/pull/297))
- svg support ([#299](https://github.com/kinnet-studio/ue-too/pull/299))

### 🩹 Fixes

- add npmignore in move package step ([#286](https://github.com/kinnet-studio/ue-too/pull/286))
- npmignore path ([#287](https://github.com/kinnet-studio/ue-too/pull/287))
- add tsbuildinfo to git ignore ([f96472c](https://github.com/kinnet-studio/ue-too/commit/f96472c))
- update output directory for built documentation media ([1e82780](https://github.com/kinnet-studio/ue-too/commit/1e82780))
- branch name format in deploy workflow ([2ad0149](https://github.com/kinnet-studio/ue-too/commit/2ad0149))
- deploy static images ([#290](https://github.com/kinnet-studio/ue-too/pull/290))
- package without subdirectory import ([#295](https://github.com/kinnet-studio/ue-too/pull/295))
- deploy documentation branch rule ([229e93c](https://github.com/kinnet-studio/ue-too/commit/229e93c))
- do not differentiate version on documentation ([5b62d18](https://github.com/kinnet-studio/ue-too/commit/5b62d18))
- framework integration examples ([#298](https://github.com/kinnet-studio/ue-too/pull/298))
- package badge link ([9cfe140](https://github.com/kinnet-studio/ue-too/commit/9cfe140))
- package badge link ([3373960](https://github.com/kinnet-studio/ue-too/commit/3373960))

### ❤️ Thank You

- niuee @niuee

## 0.9.0 (2025-12-09)

### 🩹 Fixes

- start with 0.8.1 ([45b9c95](https://github.com/kinnet-studio/ue-too/commit/45b9c95))

### ❤️ Thank You

- niuee

## 0.7.1 (2025-10-15)

### 🩹 Fixes

- manually bump version ([a33588e](https://github.com/kinnet-studio/ue-too/commit/a33588e))

### ❤️ Thank You

- niuee

## 0.7.0 (2025-10-15)

This was a version bump only, there were no code changes.
