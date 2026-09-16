# @ue-too/board-konva-integration

Drives a [Konva](https://konvajs.org/) stage from a [`@ue-too/board`](https://www.npmjs.com/package/@ue-too/board) camera. Konva owns the scene graph; board owns the pan, zoom and rotate.

[![npm version](https://img.shields.io/npm/v/@ue-too/board-konva-integration.svg)](https://www.npmjs.com/package/@ue-too/board-konva-integration)
[![license](https://img.shields.io/npm/l/@ue-too/board-konva-integration.svg)](https://github.com/kinnet-studio/ue-too/blob/main/LICENSE.txt)

[Live example](https://kinnet-studio.github.io/ue-too/konva-integration/) · [source](https://github.com/kinnet-studio/ue-too/blob/main/apps/examples/src/konva-integration/main.ts)

## Install

```bash
bun add @ue-too/board-konva-integration konva
```

`konva` is a peer dependency, pinned to `10.0.12`.

## Wiring it up

The package is one class, `KonvaInputParser`. Build the board pieces, hand the stage to the parser, and sync the stage from the camera each frame:

```ts
import {
    CanvasProxy,
    DefaultBoardCamera,
    InputOrchestrator,
    ObservableInputTracker,
    RawUserInputPublisher,
    createCameraMuxWithAnimationAndLock,
    createDefaultCameraRig,
    createKmtInputStateMachine,
} from '@ue-too/board';
import { KonvaInputParser } from '@ue-too/board-konva-integration';
import Konva from 'konva';

const camera = new DefaultBoardCamera({
    viewPortWidth: 800,
    viewPortHeight: 600,
});
const canvasProxy = new CanvasProxy(
    document.getElementById('graph') as HTMLCanvasElement
);
const inputOrchestrator = new InputOrchestrator(
    createCameraMuxWithAnimationAndLock(),
    createDefaultCameraRig(camera),
    new RawUserInputPublisher()
);
const kmtInputStateMachine = createKmtInputStateMachine(
    new ObservableInputTracker(canvasProxy)
);

const stage = new Konva.Stage({ container: 'graph', width: 800, height: 600 });

const konvaInputParser = new KonvaInputParser(
    stage,
    kmtInputStateMachine,
    inputOrchestrator
);
konvaInputParser.setUp();

function update() {
    const { scale, rotation, translation } = camera.getTRS(1, true);
    stage.x(translation.x);
    stage.y(translation.y);
    stage.scale({ x: scale.x, y: scale.y });
    stage.rotation((rotation * 180) / Math.PI); // getTRS is radians, Konva wants degrees
    requestAnimationFrame(update);
}
requestAnimationFrame(update);
```

## How it works

Board interprets raw input through a state machine rather than acting on events directly — a drag only pans once the machine is in a panning state, and the machine decides what a scroll means given which modifiers are held. The parser's whole job is to translate Konva's event objects into that machine's vocabulary and forward whatever the machine emits to the `InputOrchestrator`, which applies it to the camera.

| Konva event                    | board event                                                    |
| ------------------------------ | -------------------------------------------------------------- |
| `pointerdown` / `pointerup`    | `leftPointerDown`/`Up`, `middlePointerDown`/`Up` (mouse only)  |
| `pointermove`                  | `leftPointerMove`, `middlePointerMove`, or plain `pointerMove` |
| `wheel`                        | `scroll`, or `scrollWithCtrl` when the ctrl key is held        |
| `keydown` / `keyup` (spacebar) | `spacebarDown` / `spacebarUp`                                  |

The state machine itself lives in `@ue-too/board` — see [the input interpretation README](https://github.com/kinnet-studio/ue-too/tree/main/packages/board/src/input-interpretation) for its state diagrams and how to extend it.

## Notes

- **Pointer and wheel events bind to the stage; key events bind to `window`.** Spacebar-to-pan therefore works whether or not the stage has focus, which also means the parser reacts to spacebar presses anywhere on the page. Tear it down when the stage is not the active surface.
- **`tearDown()` is reversible.** It detaches the stage handlers and aborts the key listeners, then installs a fresh `AbortController`, so the same parser instance can be `setUp()` again.
- **Nothing syncs the stage for you.** The parser moves the camera; copying the camera transform onto the stage is the `update()` loop above. `camera.getTRS()` gives you translation, rotation and scale already decomposed — but its rotation is in **radians** while Konva's `stage.rotation()` takes **degrees**, so convert.
- **Button transitions are mouse only.** `leftPointerDown`/`Up` and the middle-button pair require `pointerType === 'mouse'`, so a touch drag never starts a pan through this parser (it still emits a plain `pointerMove`). Touch gestures go through board's separate touch state machine instead.
