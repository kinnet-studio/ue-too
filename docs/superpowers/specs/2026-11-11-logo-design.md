# uē-tôo Logo

**Date:** 2026-11-11
**Repos:** `ue-too` (assets, README, examples app), `ue-too-documentation` (docs site)

## Intent

ue-too has no logo; the README and docs show the name as plain text, and the
examples app uses a hand-drawn sketch as its favicon. The name is Taiwanese for
畫圖, "to draw", and the toolkit is built around an infinite canvas. The logo
should say both: something being drawn, and a canvas bigger than the view.

## The logo (decided)

**Mark:** a camera viewfinder (four corner brackets, the board's view) with a
handwritten "ue" inside it, drawn as one pen line that keeps going out through
the right side of the frame. No dot at the start of the line.

**Favicon / small sizes (32 px and below):** the "ue" line alone, bold, no
frame. The full mark blurs below ~32 px; the bold "ue" still reads at 16 px.

**Wordmark:** "uē-tôo" set in Nunito ExtraBold (800), letter spacing −0.01em,
converted to outlines so it never depends on the font being installed.

**Colors**

| | Light background | Dark background |
|---|---|---|
| Brackets, wordmark | `#1F2A1C` | `#EEF2EA` |
| Pen line | `#5D8C3E` | `#8BC563` |

The greens are the docs site's existing brand colors.

**Geometry** (viewBox `0 0 100 100`, round caps and joins on every stroke):

- Brackets, stroke width 6:
  `M12 39V32Q12 26 18 26H25` · `M55 26H62Q68 26 68 32V39` ·
  `M68 69V76Q68 82 62 82H55` · `M25 82H18Q12 82 12 76V69`
- "ue" line, stroke width 6.5:
  `M22 44C22 56 24 64 30 64C36 64 39 56 39 44C39 54 40 64 45 64C51 64 57 56 58 50C59 44 56 41 52 42C48 43 47 50 49 56C51 62 56 64 60 64C66 64 74 54 96 42`
- Favicon "ue" line, stroke width 12, tail deliberately clipped by the right edge:
  `M8 30C8 54 11 70 22 70C33 70 38 54 38 32C38 52 40 70 50 70C61 70 70 58 72 46C74 32 67 26 60 28C53 30 51 44 54 56C57 66 64 70 72 70C82 70 90 60 98 50`

## Files to make

In a new `brand/` folder in `ue-too`:

- `logo-mark.svg`, `logo-mark-dark.svg`: the mark, viewBox cropped to the
  drawing with equal margins, kept square
- `logo-lockup.svg`, `logo-lockup-dark.svg`: mark + wordmark side by side
- `favicon.svg`: bold "ue", switching to the dark green under
  `prefers-color-scheme: dark`
- PNG exports: mark at 512 and 256; favicon at 16, 32, 48; a 180 px
  apple-touch icon (bold "ue" on a light tile); `favicon.ico` (16/32/48)
- `social-preview.png` (1280×640): lockup centred on the light background, for
  the GitHub repo's social preview (set by hand in repo settings)
- `README.md`: one short page with the files, colors, and the small-size rule

## Where it goes

- **ue-too README:** replace the plain-text `uē-tôo` heading with the lockup,
  light/dark via `<picture>` and `prefers-color-scheme`, `alt="uē-tôo"`.
- **Examples app** (`apps/examples`): replace `favicon.png` with the new
  favicon (SVG plus PNG fallback).
- **Docs site:** the mark as the nav logo (light and dark), next to the
  existing "uē-tôo" title text, and the new favicon. Every version is its own
  build from its own source folder, so the assets go in one shared public
  folder that all version builds use, not copied into each version.

## Non-goals

- No change to the docs theme colors or the canvas home page hero.
- Package READMEs (e.g. `packages/board/README.md`) and the other apps keep
  their current headers and icons for now.
- No animated logo.

## Anti-goals

- A favicon that's mush at 16 px.
- A logo that renders differently depending on installed fonts.

## Approaches considered

Four directions were sketched: **A** viewfinder with a pen line leaving the
frame, **B** a spiral unrolling off a tile like a hand scroll (畫卷), **C** the
frame of 圖 brushed in ink with its last stroke sweeping out, **D** a fading dot
grid with a pen line past its edge. A was picked as the base.

Within A, the line was tried as a loop, a plain "u" whose arm leaves the top, a
handwritten "u", and a handwritten "ue"; **the "ue" was picked** because it
spells the start of the name and feels the most hand-drawn. Frames tried:
regular brackets (picked: they match the line's weight), thin brackets, and a
closed frame with the line drawn over it. Small sizes: bold "ue" without frame
(picked) vs. a bold "u" in thick brackets. Fonts: Nunito (picked: its rounded
ends match the pen line), Inter, Space Grotesk, Literata.

## Left to the builder

- The exact crop and margins of each SVG, and the lockup's spacing and the
  mark-to-text size ratio (the concept used a 60 px mark beside 44 px text).
- Tooling for outlining the wordmark and exporting PNG/ICO.
- File names and folder for the docs site's shared public folder.
