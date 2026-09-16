# @ue-too/board-pixi-react-integration

React bindings for [`@ue-too/board-pixi-integration`](https://www.npmjs.com/package/@ue-too/board-pixi-integration). A component that owns the PixiJS app's lifecycle, and hooks that read the board camera without re-rendering the world.

[![npm version](https://img.shields.io/npm/v/@ue-too/board-pixi-react-integration.svg)](https://www.npmjs.com/package/@ue-too/board-pixi-react-integration)
[![license](https://img.shields.io/npm/l/@ue-too/board-pixi-react-integration.svg)](https://github.com/kinnet-studio/ue-too/blob/main/LICENSE.txt)

## Install

```bash
bun add @ue-too/board-pixi-react-integration pixi.js react
```

`pixi.js` (pinned to `8.20.1`) and `react` (`^19`) are peer dependencies. `@ue-too/board-pixi-integration` comes with it.

## Mounting a canvas

`PixiCanvasApp` is the whole setup: provider, canvas, and an overlay layer for HTML drawn on top of the Pixi scene.

```tsx
import { baseInitApp } from '@ue-too/board-pixi-integration';
import { PixiCanvasApp } from '@ue-too/board-pixi-react-integration';

export const Editor = () => (
    <PixiCanvasApp
        option={{ fullScreen: true }}
        initFunction={baseInitApp}
        canvasClassName="h-full w-full"
    >
        <CameraReadout />
    </PixiCanvasApp>
);
```

`initFunction` is your own init when you have one — anything returning a superset of `BaseAppComponents`. Children render inside `OverlayContainer`, absolutely positioned over the canvas and sized to it, with `pointer-events: none` so they never steal input from the board.

For a custom layout, compose the pieces yourself: `PixiCanvasProvider` → `PixiCanvas` → `OverlayContainer`.

## Reading the camera

Camera hooks are built on `useSyncExternalStore` and subscribe to the camera's own events, so a pan re-renders only the components that asked for the position:

```tsx
import {
    useAllBoardCameraState,
    useBoardCameraState,
} from '@ue-too/board-pixi-react-integration';

const zoom = useBoardCameraState('zoomLevel'); // 'position' | 'rotation' | 'zoomLevel'
const { position, rotation, zoomLevel } = useAllBoardCameraState();
```

Snapshots are cached by value, so `position` keeps referential equality between frames where it did not actually move — safe to use in a dependency array.

Everything else hangs off `usePixiCanvas()`, which returns `result`, a discriminated union of uninitialized / failed / `{ success: true, components }`:

| Hook                        | What it gives you                                                  |
| --------------------------- | ------------------------------------------------------------------ |
| `usePixiCanvas()`           | the raw `result`, for reaching into `components` directly          |
| `useAppTicker(cb)`          | a callback on Pixi's ticker, added and removed with the app        |
| `useCanvasSize()`           | renderer width/height, updated on resize (`0 × 0` before init)     |
| `useCoordinateConversion()` | a function turning a `PointerEvent` into world coordinates         |
| `useViewportScrollBar()`    | scrollbar lengths and offsets for the current camera               |
| `useToggleKmtInput()`       | enable/disable mouse-and-keyboard input, e.g. for a selection mode |
| `useCanvasPointerDown(cb)`  | a native `pointerdown` listener on the canvas element              |

`appIsReady(result)` is the guard these hooks use internally, and is exported for your own effects.

## Typing your components

If your `initFunction` returns more than `BaseAppComponents`, augment the registry once and every `usePixiCanvas()` in the app is typed without a generic:

```ts
declare module '@ue-too/board-pixi-react-integration' {
    interface PixiCanvasRegistry {
        components: MyAppComponents;
    }
}
```

In a project with several different canvases, pass the type per call instead: `usePixiCanvas<TrainEditorComponents>()`.

## Notes

- **The hook owns canvas creation.** `useInitializePixiApp` builds a fresh `<canvas>` inside the container on every initialization and detaches it on teardown. Pixi calls `WEBGL_lose_context` when a renderer is destroyed, and a canvas whose context was lost cannot be reinitialized — so reusing the element would break the second mount.
- **Init runs once per mount, not per render.** `option` and `initFunction` are read from refs rather than being effect dependencies, so passing an inline object or closure (the normal thing to do) does not re-initialize Pixi on every render.
- **Init and teardown are serialized** through a promise chain, so two initializations never overlap — StrictMode's mount→unmount→mount in development, or a fast remount, tears the previous context fully down before creating the next. Overlapping GL contexts on one canvas hard-freeze the GPU process on some drivers.
- **The provider detects apps destroyed by HMR.** React Fast Refresh preserves state while the Pixi app may already be gone, so the provider validates the renderer during render and reports uninitialized instead of handing you a destroyed app.
- **`teardownComponents`** runs every registered cleanup, then the base `cleanup` if it was not already among them, then destroys the app with `removeView`. Push your own teardown onto `components.cleanups`.
