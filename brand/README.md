# uē-tôo logo

A camera viewfinder (the board's view) with a handwritten "ue" whose line keeps going past the frame: uē-tôo is Taiwanese for 畫圖, "to draw", on a canvas bigger than the view.

## Files

| File                                      | Use                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `logo-lockup.svg`, `logo-lockup-dark.svg` | Mark and name together: README headers, slides, banners                              |
| `logo-mark.svg`, `logo-mark-dark.svg`     | Mark alone, above 32 px: nav bars, avatars                                           |
| `favicon.svg`                             | Bold "ue" for 32 px and below; switches to the dark-mode green by itself             |
| `favicon.ico`, `favicon-{16,32,48}.png`   | Favicon fallbacks for browsers without SVG favicons                                  |
| `apple-touch-icon.png`                    | 180 px home-screen icon                                                              |
| `logo-mark-512.png`, `logo-mark-256.png`  | The mark as transparent images, on light backgrounds only (its frame is dark)        |
| `social-preview.png`                      | 1280×640 link preview; set it by hand in the GitHub repo's Settings → Social preview |

## Rules

- At 32 px and below, use `favicon.*`: the full mark blurs at that size. Above 32 px, use the mark.
- On dark backgrounds, use the `-dark` files.
- The name is outlined in the SVGs (Nunito ExtraBold). When you need it as live text, set it in Nunito 800.

## Colors

|                | Light background | Dark background |
| -------------- | ---------------- | --------------- |
| Brackets, name | `#1F2A1C`        | `#EEF2EA`       |
| Pen line       | `#5D8C3E`        | `#8BC563`       |

## Editing

The SVGs are the source; the PNG and ICO files are exports of them. After editing an SVG, re-export at the sizes above with any SVG renderer, rendering each favicon size directly rather than shrinking a larger one.
