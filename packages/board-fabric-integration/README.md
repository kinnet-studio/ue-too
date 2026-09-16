# @ue-too/board-fabric-integration

Drives a [Fabric.js](https://fabricjs.com/) canvas from a [`@ue-too/board`](https://www.npmjs.com/package/@ue-too/board) camera, with a switch for handing the pointer back to Fabric's own selection tools.

[![npm version](https://img.shields.io/npm/v/@ue-too/board-fabric-integration.svg)](https://www.npmjs.com/package/@ue-too/board-fabric-integration)
[![license](https://img.shields.io/npm/l/@ue-too/board-fabric-integration.svg)](https://github.com/kinnet-studio/ue-too/blob/main/LICENSE.txt)

[Live example](https://kinnet-studio.github.io/ue-too/fabric-integration/) · [source](https://github.com/kinnet-studio/ue-too/blob/main/apps/examples/src/fabric-integration/main.ts)

## Install

```bash
bun add @ue-too/board-fabric-integration fabric
```

`fabric` is a peer dependency, pinned to `7.4.0`.

## Wiring it up

The package is one class, `FabricInputEventParser`. Build the board pieces, hand the Fabric canvas to the parser, and push the camera transform into Fabric's viewport each frame:

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
import { FabricInputEventParser } from '@ue-too/board-fabric-integration';
import { Canvas, TMat2D } from 'fabric';

const canvasElement = document.getElementById('graph') as HTMLCanvasElement;
const fabricCanvas = new Canvas('graph', { selection: false });

const camera = new DefaultBoardCamera({
    viewPortWidth: parseInt(canvasElement.style.width),
    viewPortHeight: parseInt(canvasElement.style.height),
});
const canvasProxy = new CanvasProxy(canvasElement);
const inputOrchestrator = new InputOrchestrator(
    createCameraMuxWithAnimationAndLock(),
    createDefaultCameraRig(camera),
    new RawUserInputPublisher()
);
const kmtInputStateMachine = createKmtInputStateMachine(
    new ObservableInputTracker(canvasProxy)
);

const fabricInputEventParser = new FabricInputEventParser(
    fabricCanvas,
    kmtInputStateMachine,
    inputOrchestrator
);
fabricInputEventParser.setUp();

function step() {
    const t = camera.getTransform(1, true);
    fabricCanvas.setViewportTransform([t.a, t.b, t.c, t.d, t.e, t.f] as TMat2D);
    requestAnimationFrame(step);
}
requestAnimationFrame(step);
```

## Movement mode vs. selection mode

Fabric wants the pointer for selecting and dragging objects; board wants it for panning. They cannot both have it, so the parser can stand down:

```ts
if (fabricInputEventParser.disabled) {
    fabricInputEventParser.enable();
    fabricCanvas.selection = false; // board pans
} else {
    fabricInputEventParser.disable();
    fabricCanvas.selection = true; // Fabric selects
}
```

`disable()` keeps every listener attached and drops incoming events instead, so toggling is instant. `disabled` reads the current mode.

> Caveat: the pointer-down handler does not currently honour `disabled`. While disabled, a mouse-down still reaches the state machine (and is still `preventDefault`ed) even though the matching move and up events are dropped, which can leave the machine in a half-started gesture. Tear the parser down rather than disabling it if that matters to you.

## How it works

Board interprets raw input through a state machine rather than acting on events directly — a drag only pans once the machine is in a panning state, and the machine decides what a scroll means given which modifiers are held. The parser translates Fabric's event objects into that machine's vocabulary and forwards whatever the machine emits to the `InputOrchestrator`, which applies it to the camera.

| Fabric event                   | board event                                                    |
| ------------------------------ | -------------------------------------------------------------- |
| `mouse:down` / `mouse:up`      | `leftPointerDown`/`Up`, `middlePointerDown`/`Up`               |
| `mouse:move`                   | `leftPointerMove`, `middlePointerMove`, or plain `pointerMove` |
| `mouse:wheel`                  | `scroll`, or `scrollWithCtrl` when the ctrl key is held        |
| `keydown` / `keyup` (spacebar) | `spacebarDown` / `spacebarUp`                                  |

The state machine itself lives in `@ue-too/board` — see [the input interpretation README](https://github.com/kinnet-studio/ue-too/tree/main/packages/board/src/input-interpretation) for its state diagrams and how to extend it.

## Notes

- **Pointer and wheel events bind to the Fabric canvas; key events bind to `window`.** Spacebar-to-pan works without the canvas having focus, which also means the parser sees spacebar presses anywhere on the page. Tear it down when the canvas is not the active surface.
- **`tearDown()` is reversible.** It detaches the canvas handlers and aborts the key listeners, then installs a fresh `AbortController`, so the same instance can be `setUp()` again.
- **Nothing syncs the canvas for you.** The parser moves the camera; `setViewportTransform` is the `step()` loop above. `camera.getTransform()` returns the six matrix components in the order Fabric's `TMat2D` expects.
- **Mouse only.** Handlers bail out on anything that is not a `MouseEvent`, so touch input is not routed through this parser.
- **It accepts a `StaticCanvas`.** The constructor is typed against Fabric's `StaticCanvas`, so a static canvas works if you only want camera control and no object interaction.
