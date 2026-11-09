# Smooth zoom-and-pan camera path: design

## Intent

Banana flies its camera to a train with a smooth zoom-and-pan path (Van Wijk &
Nuij, "Smooth and efficient zooming and panning", 2003): on a long trip it
zooms out, glides across, and zooms back in, so the viewer never loses track of
where they're going. The math lives in banana's `src/utils/init-app.ts`. Move it
into `@ue-too/board` so every ue-too app can use it, and show it off with a
"back to start" animation in four places.

## The four places

| Where | What | Round |
| --- | --- | --- |
| `@ue-too/board` | Public `createZoomPanPath()` | 1 |
| ue-too `apps/examples/camera-animation` | Click flies there along the path; a "Back to start" button flies home | 1 |
| banana | Drop its own copy of the math and use the board function | 2 |
| docs site | A "Fly back to start" live example tab, and a "Back to start" button on the canvas home page | 2 |

Banana and the docs site use the published packages (pinned to 0.19.2), so
round 2 waits for a ue-too release that includes round 1 (a `feat`, so 0.20.0).

## Goals

- One copy of the math, in `@ue-too/board`, with tests and full JSDoc.
- The function is pure: views in, views out. Each caller keeps its own frame
  loop (banana's Pixi ticker, the example's `requestAnimationFrame`, and so on).
- The camera-animation example reads as the reference for driving it: start a
  flight, apply it through the camera mux, stop when the user grabs the camera.

## Non-goals

- A camera "driver" or `board.flyTo()` that owns timing. Callers drive it.
- Animating rotation. The path covers position and zoom only.
- Easing inside the path. The path is spaced by perceived distance; callers
  layer their own easing on top, as banana does.

## Anti-goals

- New dependencies for `@ue-too/board`. The function uses plain math only.
- A user who grabs the camera mid-flight and gets fought: the examples stop the
  flight as soon as the user pans or zooms.

## Approaches

- **A. Package first, then everyone uses it (picked).** One copy of the math;
  banana and the docs wait on a release.
- **B. All four now, with copies.** Faster to see, but the math lives in three
  places for a while and every repo needs two rounds of changes.

Package home: `@ue-too/board` rather than `@ue-too/animate`. The math is about
camera views, `board` needs no new dependency for it, and `board` is what the
docs pages already load.

## API

```ts
type CameraView = { position: Point; zoomLevel: number };
type ZoomPanPathOptions = { rho?: number };
type ZoomPanPath = {
    /** The trip's length in the paper's metric; bigger trips are longer. */
    readonly length: number;
    /** The view at progress t in [0, 1], clamped. */
    at(t: number): CameraView;
};

function createZoomPanPath(
    from: CameraView,
    to: CameraView,
    viewPortWidth: number,
    options?: ZoomPanPathOptions
): ZoomPanPath;
```

- `t` is a fraction of the path's length, so equal steps look like equal
  amounts of motion. `at(0)` is exactly `from` and `at(1)` exactly `to`.
- `rho` defaults to 1.42, the paper's user-study value and banana's. Higher
  zooms out further.
- `length` lets callers scale a duration to the trip if they want to.
- Throws a `RangeError` for a non-positive or non-finite viewport width or zoom
  level, since the path is undefined there.

## Builder's calls

- File: `packages/board/src/camera/utils/zoom-pan-path.ts`, exported through
  `camera/utils`, so it is part of `@ue-too/board` and `@ue-too/board/camera`.
- Use `Math.asinh` for the paper's `r = ln(-b + sqrt(b^2 + 1))` to avoid
  cancellation on long trips, and treat a pan shorter than a billionth of the
  view width as a pure zoom (the general formula divides by the pan distance).
- Camera limits still apply: if the path zooms out past the camera's minimum
  zoom, the camera rig clamps it. The flight still lands on the target.
- Example: drive the path with `@ue-too/animate`'s `Animation` (0 → 1, cosine
  ease, 1 s), like banana. Each frame, stop if the pan or zoom state machine has
  left `TRANSITION` (the user took over), otherwise notify the mux and apply the
  view through the camera rig. "Back to start" flies to the view the page
  opened with. Strings in English and Traditional Chinese, like the other
  examples.

## Round 2 notes (after the release)

- Banana: replace `computeOptimalPath` and the hand-rolled sampling in
  `startFocusAnimation` with `createZoomPanPath`. The train panel's focus should
  look the same.
- Docs: bump `@ue-too/board` and the live examples' release pin; the live
  example uses the board function in about 15 lines; the home canvas gets a
  "Back to start" button drawn on the canvas with an accessible HTML copy,
  following the home page's existing pattern.
