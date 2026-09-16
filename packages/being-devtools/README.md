# @ue-too/being-devtools

Attachable devtools for [`@ue-too/being`](https://www.npmjs.com/package/@ue-too/being) state machines. One call straps a live state chart, event log, and context inspector onto any running machine.

[![npm version](https://img.shields.io/npm/v/@ue-too/being-devtools.svg)](https://www.npmjs.com/package/@ue-too/being-devtools)
[![license](https://img.shields.io/npm/l/@ue-too/being-devtools.svg)](https://github.com/kinnet-studio/ue-too/blob/main/LICENSE.txt)

[See it running](https://kinnet-studio.github.io/ue-too/state-machine-visualizer/) — the state machine visualizer example mounts the panel inline over two `being` machines and the live board you pan the chart with.

## Install

```bash
bun add -d @ue-too/being-devtools
```

`@ue-too/being` and `@ue-too/board` are ordinary dependencies and install with it.

## One line

```ts
import { attachMachineDebugger } from '@ue-too/being-devtools';

const machine = new TemplateStateMachine(states, 'IDLE', context);
attachMachineDebugger(machine, { name: 'pan-control' });
```

A collapsed pill appears bottom-right. Press **Ctrl+Shift+M** (Cmd+Shift+M on macOS) or click it to open the panel:

- the machine's state chart, laid out from its states, events, preconditions and routing guards;
- the current state highlighted; transitions whose preconditions currently fail are dimmed;
- an event log of everything the machine handles, whoever fired it, with repeats coalesced into `×N`;
- the context, live;
- a fire button per event with an editable JSON payload, and a reset.

Call `attachMachineDebugger` again to add more machines as tabs. Every call returns a handle whose `dispose()` detaches that machine; when the last one goes, the panel goes too.

Guard it for development builds:

```ts
if (import.meta.env.DEV) {
    attachMachineDebugger(machine, { name: 'pan-control' });
}
```

Browser only: call it after the document is ready (a client-side effect or `onMounted` is the right place), never during server-side rendering.

## Boards

`@ue-too/board` runs five `being` machines. Attach them all at once:

```ts
import { attachBoardDebugger } from '@ue-too/being-devtools';

attachBoardDebugger(board); // tabs: board:kmt-input, board:touch-input, board:pan-control, ...
attachBoardDebugger(minimap, { namePrefix: 'minimap' });
```

## Own the panel

For an inline mount or a custom hotkey, construct the panel yourself:

```ts
import { MachineDebugger } from '@ue-too/being-devtools';

const panel = new MachineDebugger({
    container: document.getElementById('debug')!, // inline instead of overlay
    hotkey: 'ctrl+alt+d', // or false to disable
    openByDefault: true,
});
panel.attach(machine, { name: 'pan-control' });
panel.attachBoard(board);
panel.dispose();
```

Inline, the page is the panel, so the sidebar's × hides the sidebar rather than the whole panel; a button in the chart's corner brings it back. Below 640px wide the sidebar stacks under the chart.

## Console

While any panel is alive, `window.__UE_TOO_BEING__` exposes `machines` (name → machine), `open()`, `close()`, and `attach(machine, options)`.

## What it never does

The panel borrows your machines. It never calls `wrapup()`, which would park a live machine in `TERMINAL` and, for a board, stop it responding to input. Reset is available because `reset()` restarts the machine; it is the recovery for a machine stranded by a hand-fired half-gesture.

Machines that do not implement the optional `onEventResult` subscription still get the chart, current state and context, but no event log. `TemplateStateMachine` implements it.
