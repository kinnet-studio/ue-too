# User Input Interpretation

This module demonstrates how to interpret user input using the state machine pattern.

You can implement your own input interpretation logic. After processing the input, you can either:

1. Set the camera state directly using the `setPosition`, `setZoomLevel`, and `setRotation` methods
2. Use the camera rig as described in the [board camera README](https://github.com/kinnet-studio/ue-too/tree/main/packages/board/src/camera)

The module consists of two main components:

1. Input event handler layer
2. Input state machine

### Input Event Handler Layer

This layer registers event handlers for different input events. Since event systems vary across rendering options (e.g., vanilla canvas API differs from pixi.js's event system), this layer handles the differences in event payloads and event names.

### Input State Machine

The state machine manages different input states and transitions. Below are the state diagrams for different input types:

#### Keyboard, Mouse, and Trackpad Input

![kmt-input-state-machine](https://kinnet-studio.github.io/ue-too/assets/doc-media/kmt-input-state-machine.png)

#### Touch Input

![touch-input-state-machine](https://kinnet-studio.github.io/ue-too/assets/doc-media/touch-input-state-machine.png)

The diagrams above are snapshots; the [state machine visualizer example](https://kinnet-studio.github.io/ue-too/state-machine-visualizer/) charts these machines live — hold spacebar over the chart and watch the KMT input and pan-control machines transition as you pan.

You can customize the state machine's behavior by defining relationships between states. The `@ue-too/being` library is used to implement the state machine. Please refer to the [being README](https://github.com/kinnet-studio/ue-too/tree/main/packages/being) for more details.

### Expanding the built-in state machines

To add events or states to the stock KMT or touch machine, use `expandKmtInputStateMachine` or `expandTouchInputStateMachine`. Name the superset types once; the callback receives every stock state already typed for the expanded machine, plus an `extend` helper for the states you want to change. Anything you leave untouched keeps its stock behaviour.

```ts
type ExpEvents = KmtInputEventMapping & { rightPointerUp: PointerEventPayload };
type ExpStates = KmtInputStates | 'PLACEMENT';
type ExpOut = KmtInputEventOutputMapping & { rightPointerUp: KmtOutputEvent };

const machine = expandKmtInputStateMachine<
    ExpEvents,
    ExpContext,
    ExpStates,
    ExpOut
>(context, (stock, extend) => ({
    ...stock,
    IDLE: extend(stock.IDLE, {
        eventReactions: inherited => ({
            rightPointerUp: {
                action: openMenu,
                defaultTargetState: 'PLACEMENT',
            },
            scroll: {
                ...inherited.scroll!,
                action: scaleZoom(inherited.scroll!.action),
            },
        }),
    }),
    PLACEMENT: new PlacementState(),
}));
```

Feed the machine to a parser that emits the new events (subclass `VanillaKMTEventParser`) and install it with the board's `kmtParser` setter. To switch whole input modes instead, host the stock machine in a `DelegatingState` from `@ue-too/being`.
