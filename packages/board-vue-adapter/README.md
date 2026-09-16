# @ue-too/board-vue-adapter

Vue 3 composables for [`@ue-too/board`](https://www.npmjs.com/package/@ue-too/board): provide a `Board` down the component tree, read camera state as refs, and drive a render loop.

[![npm version](https://img.shields.io/npm/v/@ue-too/board-vue-adapter.svg)](https://www.npmjs.com/package/@ue-too/board-vue-adapter)
[![license](https://img.shields.io/npm/l/@ue-too/board-vue-adapter.svg)](https://github.com/kinnet-studio/ue-too/blob/main/LICENSE.txt)

> **Status:** the composables below are the usable surface. The package also exports a `Board` component and a `Test` component that are scaffolding left over from setup — see [Not ready yet](#not-ready-yet). For a finished framework adapter, see [`@ue-too/board-react-adapter`](https://www.npmjs.com/package/@ue-too/board-react-adapter).

## Install

```bash
bun add @ue-too/board-vue-adapter vue
```

`vue` is a peer dependency (`^3.5.25`).

## Usage

An ancestor provides the board; descendants inject it, attach it to their own canvas, and draw:

```vue
<!-- App.vue -->
<script setup lang="ts">
import { provideBoard } from '@ue-too/board-vue-adapter';

import Canvas from './Canvas.vue';

provideBoard();
</script>

<template>
    <Canvas />
</template>
```

```vue
<!-- Canvas.vue -->
<script setup lang="ts">
import {
    useAnimationFrameWithBoard,
    useBoard,
    useCameraState,
} from '@ue-too/board-vue-adapter';
import { onMounted, ref } from 'vue';

const canvas = ref<HTMLCanvasElement | null>(null);
const board = useBoard();

const position = useCameraState('position');
const zoomLevel = useCameraState('zoomLevel');

onMounted(() => {
    if (canvas.value) {
        board.attach(canvas.value);
    }
});

// board.step() has already run when this fires; just draw.
useAnimationFrameWithBoard((timestamp, ctx) => {
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 100, 100);
});
</script>

<template>
    <canvas ref="canvas" width="1000" height="300"></canvas>
    <div>position: {{ position.x }}, {{ position.y }}</div>
    <div>zoom: {{ zoomLevel }}</div>
</template>
```

Pan, zoom and rotate come from the board itself once it is attached to a canvas; the composables only expose it to Vue.

## API

| Export                           | What it does                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `provideBoard()`                 | Creates a `Board` and provides it under `BOARD_SYMBOL`. Call it in an ancestor, once per board.                  |
| `useBoard()`                     | Injects the provided board. Throws if no ancestor provided one.                                                  |
| `useCameraState(key)`            | A `ShallowRef` of `'position'`, `'rotation'` or `'zoomLevel'`, updated from the camera's pan/rotate/zoom events. |
| `useCustomCameraMux(mux)`        | Swaps the board's camera mux, immediately and on change.                                                         |
| `useAnimationFrame(cb)`          | A `requestAnimationFrame` loop started on mount and cancelled on unmount.                                        |
| `useAnimationFrameWithBoard(cb)` | The same loop, calling `board.step(timestamp)` first and handing your callback `(timestamp, ctx)`.               |
| `BOARD_SYMBOL`                   | The injection key, if you would rather `provide` a board you constructed yourself.                               |

## Notes

- **Don't call `board.step()` inside a `useAnimationFrameWithBoard` callback** — the composable already stepped the board before invoking you. Stepping twice advances the board's clock at double rate.
- **`useCameraState` never unsubscribes.** It registers a camera listener without tearing it down on unmount, so a component that mounts and unmounts repeatedly accumulates listeners. Fine for a canvas that lives as long as the page; watch out in a list or a route that churns.
- **`useAnimationFrameWithBoard` warns and skips** when `board.context` is undefined — normally because the board has not been attached to a canvas yet.

## Not ready yet

Two exports are scaffolding rather than API, and are documented here only so they are not mistaken for something finished:

- **`Board`** (`board.vue`) constructs its own `new Board()` instead of using the provided one, hardcodes a red rectangle into its render loop, and steps the board twice per frame. Attach a board to your own `<canvas>` as shown above rather than using it.
- **`Test`** (`Test.vue`) renders the text "Test 1".
