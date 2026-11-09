# Smooth Zoom-and-Pan Path Implementation Plan (round 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add banana's Van Wijk & Nuij zoom-and-pan path to `@ue-too/board` as `createZoomPanPath()`, and use it in the camera-animation example with a "Back to start" button.

**Architecture:** A pure function in `packages/board/src/camera/utils/zoom-pan-path.ts` returns a sampler from progress `t` to a camera view. The example drives it with an `@ue-too/animate` `Animation` and applies each view through the camera mux and rig.

**Tech Stack:** TypeScript, Bun test runner (board tests use `bun test` globals), Vite examples app.

**Spec:** `docs/superpowers/specs/2026-11-09-zoom-pan-path-design.md`

## Global Constraints

- No new dependencies for `@ue-too/board`; `Point` comes from `@ue-too/math`.
- Default `rho` is `1.42`.
- Public API needs full JSDoc with `@category Camera`, like the other camera utils.
- Formatting: Prettier, 4 spaces, single quotes.
- Commits: conventional, scoped (`feat(board): …`, `feat(examples): …`).

## Review Focus

- Very long trips (pan of 1e7 world units at zoom 1): no `NaN`/`Infinity` anywhere on the path.
- Tiny but nonzero pans (1e-7 world units with a zoom change): no `NaN`, behaves like a pure zoom.
- `t` outside [0, 1] (an eased value overshooting, or a late frame): clamped, never extrapolated.
- A zero-width viewport (board without a sized canvas): a clear `RangeError`, not a silent `NaN` camera.
- User pans or zooms mid-flight in the example: the flight stops and the user keeps control.

---

### Task 1: `createZoomPanPath` in `@ue-too/board`

**Files:**
- Create: `packages/board/src/camera/utils/zoom-pan-path.ts`
- Modify: `packages/board/src/camera/utils/index.ts` (export it)
- Test: `packages/board/test/board-camera/zoom-pan-path.test.ts`

**Interfaces:**
- Produces:
  - `type CameraView = { position: Point; zoomLevel: number }`
  - `type ZoomPanPathOptions = { rho?: number }`
  - `type ZoomPanPath = { readonly length: number; at(t: number): CameraView }`
  - `function createZoomPanPath(from: CameraView, to: CameraView, viewPortWidth: number, options?: ZoomPanPathOptions): ZoomPanPath`
  - `const DEFAULT_ZOOM_PAN_RHO = 1.42`

- [ ] **Step 1: Write the failing tests** — `describe('createZoomPanPath')` with:
  - `at(0)` deep-equals `from` and `at(1)` deep-equals `to` (exact, for a pan of `{0,0}→{3000,-1200}`, zoom `2→0.5`, width 800).
  - `at(-0.5)` equals `at(0)`; `at(1.5)` equals `at(1)`.
  - Same position, zoom `1→4`: every sample's position equals `from.position`; zoom rises monotonically over 21 samples; `length` ≈ `Math.log(4) / 1.42`.
  - Identical views: `length === 0`; `at(0.5)` equals `from`.
  - Long pan at constant zoom (`{0,0}→{10000,0}`, zoom 1, width 800): `at(0.5).zoomLevel < 1`; `at(0.5).position.x` ≈ 5000 (symmetry); x rises monotonically; y stays 0.
  - Positions lie on the line from `from` to `to` (cross product ≈ 0) for a diagonal trip.
  - Higher `rho` zooms out further on the same trip: min zoom with `rho: 2` < min zoom with `rho: 1`.
  - Arc-length check: with finite differences in (u, w) space, `rho²·u'² + w'²/rho²` ≈ `w²·length²` at interior samples (t' scaled by length).
  - Long trip (`1e7` pan at zoom 1) and tiny pan (`1e-7` with zoom `1→2`): all samples finite; tiny pan's `length` ≈ `Math.log(2)/1.42`.
  - Throws `RangeError` for width `0`, `-1`, `NaN`, `Infinity`, and for zoom `0` or `-1` in `from` or `to`.

- [ ] **Step 2: Run to verify they fail** — `bunx nx test board` → fails on the missing module.

- [ ] **Step 3: Implement** in `zoom-pan-path.ts`, porting banana's `computeOptimalPath` with:
  - `w = viewPortWidth / zoomLevel`; `u` is distance along the straight line.
  - `r_i = -Math.asinh(b_i)` (stable form of `ln(-b + sqrt(b²+1))`).
  - Pure-zoom branch when pan distance `<= 1e-9 * max(w0, w1)`.
  - `at(t)`: clamp t; return copies of `from`/`to` at the ends; otherwise `s = t * length`.

- [ ] **Step 4: Run tests** — `bunx nx test board` → all pass. Also `bunx tsc --noEmit -p packages/board` clean.

- [ ] **Step 5: Commit** — `feat(board): add createZoomPanPath for smooth camera flights`

### Task 2: Camera-animation example flies along the path, with "Back to start"

**Files:**
- Modify: `apps/examples/src/camera-animation/main.ts`
- Modify: `apps/examples/src/camera-animation/index.html` (button, updated copy)
- Modify: `apps/examples/src/i18n/en.ts`, `apps/examples/src/i18n/zh-TW.ts`

**Interfaces:**
- Consumes: `createZoomPanPath`, `CameraView` from `@ue-too/board` (Task 1).

- [ ] **Step 1: Rewrite `main.ts`:**
  - Record `home: CameraView` from the camera at load.
  - `flyTo(target: CameraView)`: build the path from the current view with `board.camera.viewPortWidth`, call `cameraMux.initatePanTransition()` and `cameraMux.initateZoomTransition()`, start an `Animation<number>` 0→1 over 1000 ms with ease `(1 - cos(πt)) / 2`.
  - Each frame of the animation: if `cameraMux.panStateMachine.currentState` or `cameraMux.zoomStateMachine.currentState` is not `'TRANSITION'`, stop the animation (the user took over). Otherwise `notifyZoomInputAnimation(zoom)` + `cameraRig.zoomTo(zoom)`, then `notifyPanToAnimationInput(pos)` and `cameraRig.panToWorld(pos)` when `allowPassThrough`.
  - Click on canvas (not a drag): `flyTo({ position: clicked world point, zoomLevel: current zoom })`.
  - "Back to start" button: `flyTo(home)`.
  - Draw a marker at the world origin so "start" is visible, keep the tile image and ruler.
- [ ] **Step 2: Update copy** — new description, a "Back to start" list item and button label, in `en.ts` and `zh-TW.ts` (`camera-animation.desc`, `camera-animation.click`, new `camera-animation.back`, `camera-animation.back-button`; update `card.camera-animation.desc`).
- [ ] **Step 3: Verify in a browser** — `bunx nx build examples` succeeds; run the dev server and, with Playwright, click far away, wait 1.2 s, check the camera is at the click point at the same zoom; zoom in, press "Back to start", check the camera returns to the home view; start a flight then pan with Space + drag mid-flight and check the flight stops.
- [ ] **Step 4: Commit** — `feat(examples): fly the camera-animation example along the zoom-pan path`
