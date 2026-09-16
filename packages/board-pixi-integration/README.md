# @ue-too/board-pixi-integration

Drives a [PixiJS](https://pixijs.com/) application from a [`@ue-too/board`](https://www.npmjs.com/package/@ue-too/board) camera. Ships a one-call app bootstrap and a lower-level input parser.

[![npm version](https://img.shields.io/npm/v/@ue-too/board-pixi-integration.svg)](https://www.npmjs.com/package/@ue-too/board-pixi-integration)
[![license](https://img.shields.io/npm/l/@ue-too/board-pixi-integration.svg)](https://github.com/kinnet-studio/ue-too/blob/main/LICENSE.txt)

[Live example](https://kinnet-studio.github.io/ue-too/pixi-integration/) · [source](https://github.com/kinnet-studio/ue-too/blob/main/apps/examples/src/pixi-integration/main.ts) · React bindings: [`@ue-too/board-pixi-react-integration`](https://www.npmjs.com/package/@ue-too/board-pixi-react-integration)

## Install

```bash
bun add @ue-too/board-pixi-integration pixi.js
```

`pixi.js` is a peer dependency, pinned to `8.20.1`.

## The short way: `baseInitApp`

`baseInitApp` builds the whole graph — Pixi application, camera, camera rig, input orchestrator, keyboard/mouse/trackpad parser, touch parser — wires the stage transform to the camera on the ticker, and returns the pieces:

```ts
import { baseInitApp } from '@ue-too/board-pixi-integration';

const components = await baseInitApp(canvasElement, {
    fullScreen: true,
    limitEntireViewPort: true,
    boundaries: { min: { x: -1000, y: -1000 }, max: { x: 1000, y: 1000 } },
});

const { app, camera, cameraRig, kmtParser, touchParser } = components;
app.stage.addChild(mySprite);

// later
components.cleanup();
```

Every option is optional. `fullScreen` resizes the renderer to the window, and `limitEntireViewPort` keeps the camera's minimum zoom high enough that the boundaries always fill the viewport — recomputed on every resize.

Pan, zoom and rotate are live as soon as this resolves: both parsers are already set up, and a ticker callback copies `camera.getTransform()` onto `app.stage` whenever it changes.

## The long way: `PixiInputParser`

If you own the `Application` yourself, build the board pieces and attach the parser to it:

```ts
import { PixiInputParser } from '@ue-too/board-pixi-integration';

const pixiInputParser = new PixiInputParser(
    app,
    kmtInputStateMachine,
    inputOrchestrator,
    camera
);
pixiInputParser.setUp();
```

Unlike the Konva and Fabric parsers, this one needs the camera: Pixi hit-tests in stage-local space, so the parser maintains `stage.hitArea` as the viewport polygon transformed into world space. **Call `updateHitArea()` whenever the stage transform or the canvas size changes**, or pointer events stop landing once you pan away from the origin. `showHitAreaDebug()` paints the current hit area red if you need to see it.

`disable()`, `enable()` and `disabled` toggle the parser without detaching it — the same movement-vs-selection switch the Fabric integration uses.

| Pixi event                     | board event                                                    |
| ------------------------------ | -------------------------------------------------------------- |
| `pointerdown` / `pointerup`    | `leftPointerDown`/`Up`, `middlePointerDown`/`Up`               |
| `pointermove`                  | `leftPointerMove`, `middlePointerMove`, or plain `pointerMove` |
| `wheel` (on the canvas)        | `scroll`, or `scrollWithCtrl` when the ctrl key is held        |
| `keydown` / `keyup` (spacebar) | `spacebarDown` / `spacebarUp`                                  |

See [the input interpretation README](https://github.com/kinnet-studio/ue-too/tree/main/packages/board/src/input-interpretation) for what the state machine does with these and how to extend it.

## Teardown

`baseInitApp` returns two teardown handles, and the distinction matters:

- **`cleanups`** — an array you push onto. This is the extension point for app-level teardown: window listeners, subscriptions, parsers you swapped in.
- **`cleanup`** — the base teardown (parsers + canvas proxy), which is _also_ registered as the first entry of `cleanups`.

Prefer `cleanups.push(…)` over replacing `cleanup`. The base teardown deliberately reads `kmtParser` and `touchParser` off the components object **at teardown time**, not when it was created, because apps routinely assign extended parsers onto the returned object after `baseInitApp` resolves. A teardown that closed over the original variables would leave the swapped-in parsers — and their window-level key listeners — registered, retaining the whole app graph across remounts.

`attachBaseTeardown(components)` is exported for the same reason: it mutates and returns the object you give it rather than spreading into a new one, so the identity the app mutates and the identity the teardown reads stay the same.

## Notes

- **`baseInitApp` is async.** It awaits `app.init()`, which picks WebGPU with a WebGL fallback.
- **The canvas element is yours to create**, and the renderer is configured with `autoDensity` at `devicePixelRatio` with a transparent background.
- **Key events bind to `window`**, so spacebar-to-pan works without canvas focus — and fires from anywhere on the page until the parser is torn down.
- **Extended app components are supported by type.** `BaseAppComponents` is designed to be spread into a wider object of your own; keep `cleanups` intact when you do.
