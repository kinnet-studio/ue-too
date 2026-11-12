# Pele Mermaid example — design

## Intent

A demo page in `apps/examples` that shows what ue-too adds to someone
else's renderer. [Pele](https://pele.run) (npm `pele`, MIT, no runtime
deps) turns Mermaid text into SVG. The ue-too camera makes that SVG
pannable and zoomable, and the Mermaid source is editable live on the
page.

It is an example only. No new package, and nothing in the docs site.

## Goals

- Edit Mermaid text and see the diagram update as you type.
- Pan and zoom the diagram with mouse, trackpad and touch, using the
  board camera and its input state machines.
- The diagram stays sharp at any zoom level, and Pele's theme colours
  and links keep working.

## Non-goals

- A reusable integration package (`@ue-too/board-pele-integration` or
  similar).
- Mermaid rendering on the docs site.
- A code editor library or syntax highlighting. A plain `<textarea>` is
  enough.

## Anti-goals

- The camera jumping while the user types. Re-rendering must not reset
  the view.
- A blurry diagram. Rasterising the SVG would miss the point of the demo.

## Approaches

1. **Pele's SVG under the camera (chosen).** The camera transform goes on
   an SVG `<g>`, which holds Pele's `<svg>`. This is the same pattern as
   `apps/examples/src/svg`. `VanillaKMTEventParser` and
   `VanillaTouchEventParser` both accept an `SVGSVGElement`. The SVG stays
   vector, and Pele's CSS-variable theme and links keep working. The cost
   is wiring the camera pieces by hand instead of using `new Board()`.
2. **Draw on a canvas with `Board`.** Turn the SVG into an image and paint
   it each frame. This uses the simplest API, but the diagram blurs when
   zoomed in and links stop working. Pele's CSS-variable colours also
   don't resolve inside an image. Rejected.
3. **Move an HTML layer to match an invisible `Board` canvas.** The canvas
   catches every pointer event, so links stop working, and two layers have
   to be kept in sync. Dropped.

The user picked 1.

## Decided with the user

- Approach 1.
- The Mermaid source is editable.

## Builder's calls (proposed; the user can override)

- **Layout.** An editor panel on the left with a `<textarea>` and an
  error line below it. The diagram fills the rest of the window. On
  narrow screens the editor stacks above the diagram.
- **Re-rendering.** Render on `input`, debounced by about 250 ms, using
  Pele's synchronous `render()` from the main `pele` entry, which includes
  every diagram type.
- **Errors.** Keep the last good diagram on screen. Show the error message
  under the editor, with the line and column from `PeleError`.
- **Camera.**
  - The diagram's top-left corner sits at world (0, 0). (This changed during
    planning from "centred on (0, 0)": with centring, a diagram that grows
    while you type shifts its existing nodes by half the growth. With the
    top-left fixed, existing nodes stay put.)
  - On first load the camera fits the whole diagram in view.
  - Editing never moves the camera.
  - A "Fit" button flies the camera back to frame the whole diagram with
    `createZoomPanPath`. Pele's own zoom has no flight like this, so the
    button shows off something only ue-too gives you.
  - Zoom limits stay sensible.
- **Starting diagram.** The gitGraph example from the Pele playground
  (https://pele.run/playground), credited on the page with a link to it.
  (Changed after review from the board package's own data-flow flowchart,
  at the user's request.)
- **Dependency.** Add `pele` pinned at `1.13.0` to `apps/examples` only.
- **Registration.**
  - Add the page to the Vite `input` list.
  - Add it to the nav and the card grid in `apps/examples/src/index.html`.
  - Add strings to the `en` and `zh-TW` i18n files, matching the other
    examples.
- **Verification.**
  - Run `bunx nx build examples`.
  - Run Playwright against the dev server:
    - The diagram renders.
    - Scrolling zooms and dragging pans.
    - Editing re-renders without moving the camera.
    - A syntax error shows the message and keeps the old diagram.
