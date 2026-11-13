import { Point } from '@ue-too/math';
import { PointCal } from '@ue-too/math';

import {
    CameraMux,
    createCameraMuxWithAnimationAndLock,
} from '../camera/camera-mux';
import { CameraRig, DefaultCameraRig } from '../camera/camera-rig';
import DefaultBoardCamera from '../camera/default-camera';
import { ObservableBoardCamera } from '../camera/interface';
import {
    CameraEventMap,
    CameraState,
    UnSubscribe,
} from '../camera/update-publisher';
import {
    halfTranslationHeightOf,
    halfTranslationWidthOf,
} from '../camera/utils/position';
import { InputOrchestrator } from '../input-interpretation/input-orchestrator';
import {
    CanvasDimensions,
    CanvasProxy,
    KmtInputMode,
    KmtInputStateMachine,
    ObservableInputTracker,
    TouchContext,
    TouchInputStateMachine,
    TouchInputTracker,
    createKmtInputStateMachine,
    createTouchInputStateMachine,
} from '../input-interpretation/input-state-machine';
import {
    KMTEventParser,
    StateMachine,
    VanillaKMTEventParser,
} from '../input-interpretation/raw-input-parser';
import {
    TouchEventParser,
    VanillaTouchEventParser,
} from '../input-interpretation/raw-input-parser';
import {
    RawUserInputEventMap,
    RawUserInputPublisher,
    UnsubscribeToUserRawInput,
} from '../input-interpretation/raw-input-publisher';
import { reverseYAxis } from '../utils';
import {
    minZoomLevelBaseOnDimensions,
    minZoomLevelBaseOnWidth,
    zoomLevelBoundariesShouldUpdate,
} from '../utils';

/**
 * Structurally checks whether a value has the shape `kmtInputStateMachine`
 * and `touchInputStateMachine` promise (`@ue-too/being`'s `StateMachine`
 * surface), rather than only the minimal parser-level contract their
 * respective `KMTEventParser.stateMachine` / `TouchEventParser.stateMachine`
 * members are typed for.
 *
 * @remarks
 * A custom {@link KMTEventParser} or {@link TouchEventParser} implementation
 * can install a `stateMachine` that satisfies only that parser-level
 * contract without being a real `being` state machine — the setters on
 * {@link Board.kmtParser} and {@link Board.touchParser} are documented
 * extension points, so that is reachable through the public API. Checks
 * `currentState`, `onStateChange`, `states`, and `possibleStates` — the
 * members tooling built on top of these getters actually consumes (see
 * `extractMachineGraph`, which reads both `states` and `possibleStates`).
 * A structural check (rather than `instanceof TemplateStateMachine`) is used
 * deliberately: a consumer that resolves two copies of `@ue-too/being` would
 * fail an `instanceof` check against a perfectly valid machine.
 */
function hasBeingStateMachineShape<T>(value: unknown): value is T {
    return (
        typeof value === 'object' &&
        value !== null &&
        'currentState' in value &&
        'states' in value &&
        'possibleStates' in value &&
        typeof (value as { onStateChange?: unknown }).onStateChange ===
            'function'
    );
}

/**
 * Main user-facing API class that provides an infinite canvas with pan, zoom, and rotate capabilities.
 *
 * The Board class is the primary entry point for using the board package. It integrates all subsystems
 * including camera management, input handling, and state machines into a simple, unified API for
 * creating interactive 2D canvases with advanced camera controls.
 *
 * @remarks
 * ## Architecture Overview
 *
 * The Board class orchestrates several subsystems:
 *
 * - **Camera System**: Manages viewport transformations (pan/zoom/rotate) through {@link ObservableBoardCamera}.
 *   The camera can be configured with boundaries, zoom limits, and various movement constraints.
 *
 * - **Input System**: Processes user input through state machines for both mouse/keyboard/trackpad (KMT)
 *   and touch events. Input is parsed, interpreted, and translated into camera movements.
 *
 * - **Camera Rig**: Enforces constraints and restrictions on camera movement (boundaries, zoom limits,
 *   clamping behavior). See {@link CameraRig} for details.
 *
 * - **Camera Multiplexer**: Coordinates between different camera control sources (user input, animations,
 *   programmatic control) to ensure smooth transitions. See {@link CameraMux} for details.
 *
 * ## Coordinate Systems
 *
 * The Board supports three coordinate systems:
 *
 * 1. **World Coordinates**: The infinite canvas space where your content lives. When the camera is at
 *    position (0, 0) with no zoom or rotation, world coordinates map directly to viewport coordinates.
 *
 * 2. **Viewport Coordinates**: The visible area of the canvas relative to the camera center. The camera
 *    center is at (0, 0) in viewport space, with coordinates extending in both directions based on the
 *    canvas size.
 *
 * 3. **Window/Canvas Coordinates**: The browser's coordinate system, with (0, 0) at the top-left corner
 *    of the canvas element. Use {@link convertWindowPoint2WorldCoord} to convert from window to world space.
 *
 * By default, {@link alignCoordinateSystem} is `true`, which means the Y-axis points down (standard HTML
 * canvas orientation). Set it to `false` to use a mathematical coordinate system where Y points up.
 *
 * ## Main Features
 *
 * - **Camera Control**: Pan, zoom, and rotate the viewport through user input or programmatic API
 * - **Boundaries**: Define world-space boundaries to constrain camera movement
 * - **Zoom Limits**: Set minimum and maximum zoom levels
 * - **Input Modes**: Support for mouse/keyboard/trackpad and touch input with customizable parsers
 * - **Event System**: Subscribe to camera events (pan, zoom, rotate) and input events
 * - **Coordinate Conversion**: Convert between window and world coordinates
 * - **Flexible Configuration**: Extensive options for restricting/clamping camera movement
 *
 * @example
 * Basic setup with drawing
 * ```typescript
 * const canvasElement = document.querySelector("canvas") as HTMLCanvasElement;
 * const board = new Board(canvasElement);
 *
 * function draw(timestamp: number) {
 *   board.step(timestamp);
 *
 *   // Because board can be initialized without a canvas element,
 *   // the context can be undefined until the canvas is attached
 *   if(board.context == undefined) {
 *     return;
 *   }
 *
 *   // Draw after the board has stepped
 *   // The coordinate system has (0, 0) at the center of the canvas when camera position is at (0, 0)
 *   board.context.beginPath();
 *   board.context.rect(0, 0, 100, 100);
 *   board.context.fill();
 *
 *   requestAnimationFrame(draw);
 * }
 *
 * requestAnimationFrame(draw);
 * ```
 *
 * @example
 * Handling camera and input events
 * ```typescript
 * const board = new Board(canvasElement);
 *
 * // Listen to camera pan events
 * board.on('pan', (event, cameraState) => {
 *   console.log('Camera panned to:', cameraState.position);
 * });
 *
 * // Listen to camera zoom events
 * board.on('zoom', (event, cameraState) => {
 *   console.log('Camera zoom level:', cameraState.zoomLevel);
 * });
 *
 * // Listen to raw input events (before camera movement)
 * board.onInput('pan', (event) => {
 *   console.log('User is panning');
 * });
 * ```
 *
 * @example
 * Configuring boundaries and zoom limits
 * ```typescript
 * const board = new Board(canvasElement);
 *
 * // Set world boundaries
 * board.camera.boundaries = {
 *   min: { x: -1000, y: -1000 },
 *   max: { x: 1000, y: 1000 }
 * };
 *
 * // Set zoom limits
 * board.camera.setMinZoomLevel(0.1);
 * board.camera.setMaxZoomLevel(5.0);
 *
 * // Ensure entire viewport stays within boundaries
 * board.limitEntireViewPort = true;
 *
 * // Clamp camera position to boundaries
 * board.clampTranslation = true;
 * board.clampZoom = true;
 * ```
 *
 * @example
 * Converting window coordinates to world coordinates
 * ```typescript
 * const board = new Board(canvasElement);
 *
 * canvasElement.addEventListener('click', (event) => {
 *   const windowPoint = { x: event.clientX, y: event.clientY };
 *   const worldPoint = board.convertWindowPoint2WorldCoord(windowPoint);
 *   console.log('Clicked at world position:', worldPoint);
 * });
 * ```
 *
 * @example
 * Initialize board without canvas, attach canvas later
 * ```typescript
 * const board = new Board();
 *
 * // Attach canvas later
 * const canvasElement = document.createElement('canvas');
 * document.body.appendChild(canvasElement);
 * board.attach(canvasElement);
 * ```
 *
 * @category Board
 * @see {@link ObservableBoardCamera} for camera API details
 * @see {@link CameraRig} for camera constraint configuration
 * @see {@link CameraMux} for camera control coordination
 */
export default class Board {
    private _context?: CanvasRenderingContext2D;
    private _reversedContext?: CanvasRenderingContext2D;
    private _canvasProxy: CanvasProxy;

    private _kmtParser: KMTEventParser;
    private _touchParser: TouchEventParser;

    private _alignCoordinateSystem: boolean = true;
    private _fullScreen: boolean = false;

    private cameraRig: CameraRig;
    private _cameraMux: CameraMux;
    private boardInputPublisher: RawUserInputPublisher;
    private _observableInputTracker: ObservableInputTracker;
    private _touchInputTracker: TouchInputTracker;
    private _inputOrchestrator: InputOrchestrator;

    private _cachedCanvasWidth: number = 0;
    private _cachedCanvasHeight: number = 0;
    private _cachedCanvasPixelRatio: number = 1;

    private lastUpdateTime: number = 0;

    private _canvasElement: HTMLCanvasElement | undefined;

    /**
     * Creates a new Board instance with an optional canvas element.
     *
     * The constructor initializes all subsystems including the camera, input parsers, state machines,
     * and event publishers. The board can be created with or without a canvas element - if no canvas
     * is provided, you can attach one later using {@link attach}.
     *
     * @param canvas - Optional HTMLCanvasElement to attach to the board. If provided, the board will
     *   immediately initialize with this canvas. If omitted, you must call {@link attach} before the
     *   board can be used.
     * @param debug - Optional debug flag that enables `willReadFrequently` hint on the canvas context,
     *   which optimizes the canvas for frequent readback operations. Default is `false`. Only use this
     *   if you need to frequently read pixel data from the canvas.
     *
     * @remarks
     * ## Initialization Sequence
     *
     * When the constructor is called, it performs the following initialization:
     *
     * 1. **Camera Setup**: Creates a {@link DefaultBoardCamera} with default boundaries of ±50,000 units
     *    in both X and Y directions. This provides a large working area for most use cases.
     *
     * 2. **Canvas Proxy**: Initializes a {@link CanvasProxy} that observes canvas dimension changes and
     *    automatically updates the camera's viewport dimensions.
     *
     * 3. **Camera Rig**: Creates a {@link CameraRig} with default configuration:
     *    - `limitEntireViewPort: true` - Entire viewport is constrained within boundaries
     *    - `clampTranslation: true` - Camera position is clamped to boundaries
     *    - `clampZoom: true` - Zoom level is clamped to min/max limits
     *    - All translation restrictions are disabled by default
     *
     * 4. **Input System**: Initializes both keyboard/mouse/trackpad (KMT) and touch input parsers,
     *    state machines, and the input orchestrator that coordinates camera control.
     *
     * 5. **Canvas Attachment** (if canvas provided): If a canvas element is provided, it's immediately
     *    attached and the viewport dimensions are synchronized with the canvas size.
     *
     * ## Default Configuration
     *
     * The board is created with sensible defaults:
     * - World boundaries: (-50000, -50000) to (50000, 50000)
     * - Coordinate system: Aligned with HTML canvas (Y-axis points down)
     * - Camera position: (0, 0)
     * - Zoom level: 1.0
     * - Rotation: 0 radians
     * - Full screen: disabled
     *
     * You can customize these defaults after construction by setting properties on the board or camera.
     *
     * @example
     * Create board with canvas element
     * ```typescript
     * const canvas = document.querySelector('canvas') as HTMLCanvasElement;
     * const board = new Board(canvas);
     * // Board is ready to use immediately
     * ```
     *
     * @example
     * Create board without canvas, attach later
     * ```typescript
     * const board = new Board();
     * // ... later, when canvas is ready
     * const canvas = document.createElement('canvas');
     * document.body.appendChild(canvas);
     * board.attach(canvas);
     * ```
     *
     * @example
     * Enable debug mode for pixel readback
     * ```typescript
     * const board = new Board(canvas, true);
     * // Now getImageData() and similar operations will be optimized
     * ```
     *
     * @group LifeCycle
     * @see {@link attach} for attaching a canvas after construction
     * @see {@link tearDown} for cleanup when done with the board
     */
    constructor(canvas?: HTMLCanvasElement, debug: boolean = false) {
        const camera = new DefaultBoardCamera();
        const bound = 50000;
        camera.boundaries = {
            min: { x: -bound, y: -bound },
            max: { x: bound, y: bound },
        };

        this.bindFunctions();

        this._canvasProxy = new CanvasProxy(canvas);

        this._canvasProxy.subscribe(canvasDimensions => {
            this.syncViewPortDimensions(canvasDimensions);
            this.syncCameraZoomLevel(canvasDimensions);
        });

        this.cameraRig = new DefaultCameraRig(
            {
                limitEntireViewPort: true,
                restrictRelativeXTranslation: false,
                restrictRelativeYTranslation: false,
                restrictXTranslation: false,
                restrictYTranslation: false,
                restrictZoom: false,
                clampTranslation: true,
                clampZoom: true,
            },
            camera
        );

        this._cameraMux = createCameraMuxWithAnimationAndLock();
        this.boardInputPublisher = new RawUserInputPublisher();

        // this._edgeAutoCameraInput = new EdgeAutoCameraInput(this._cameraMux);
        this._observableInputTracker = new ObservableInputTracker(
            this._canvasProxy
        );
        this._touchInputTracker = new TouchInputTracker(this._canvasProxy);

        const kmtInputStateMachine = createKmtInputStateMachine(
            this._observableInputTracker
        );
        const touchInputStateMachine = createTouchInputStateMachine(
            this._touchInputTracker
        );

        // Create single orchestrator as the point of camera control for both KMT and touch inputs
        // Since both state machines output the same event types (pan, zoom), one orchestrator handles both
        // Orchestrator receives CameraRig to execute camera operations when CameraMux allows passthrough
        this._inputOrchestrator = new InputOrchestrator(
            this._cameraMux,
            this.cameraRig,
            this.boardInputPublisher
        );

        // Parsers have direct dependency on state machines, shared orchestrator processes outputs and controls camera
        this._kmtParser = new VanillaKMTEventParser(
            kmtInputStateMachine,
            this._inputOrchestrator,
            canvas
        );
        this._touchParser = new VanillaTouchEventParser(
            touchInputStateMachine,
            this._inputOrchestrator,
            canvas
        );

        if (canvas != undefined) {
            this.attach(canvas, debug);
        }
    }

    private syncViewPortDimensions(canvasDimensions: {
        width: number;
        height: number;
    }) {
        this.camera.viewPortHeight = canvasDimensions.height;
        this.camera.viewPortWidth = canvasDimensions.width;
    }

    /**
     * Attaches a canvas element to the board, enabling rendering and input handling.
     *
     * This method connects a canvas element to the board's rendering and input systems. It must be
     * called before the board can be used if no canvas was provided to the constructor. If a canvas
     * was already attached, this method will replace it with the new canvas.
     *
     * @param canvas - The HTMLCanvasElement to attach to the board. This canvas will be used for
     *   rendering and will receive all input events.
     * @param debug - Optional debug flag that enables `willReadFrequently` hint on the canvas context.
     *   Default is `false`. Set to `true` if you need to frequently read pixel data from the canvas,
     *   which will optimize the context for readback operations.
     *
     * @remarks
     * When a canvas is attached, the following happens:
     *
     * 1. **Context Creation**: A 2D rendering context is obtained from the canvas with the specified
     *    debug settings.
     *
     * 2. **Input Parser Attachment**: Both KMT (keyboard/mouse/trackpad) and touch input parsers are
     *    attached to the canvas to begin receiving input events.
     *
     * 3. **Canvas Proxy Attachment**: The canvas proxy begins observing the canvas for dimension changes,
     *    automatically updating the camera's viewport dimensions when the canvas is resized.
     *
     * 4. **Zoom Level Synchronization**: If {@link limitEntireViewPort} is enabled, the minimum zoom
     *    level is calculated and set to ensure the entire viewport can fit within the camera boundaries.
     *
     * 5. **Coordinate System Setup**: Both standard and Y-reversed rendering contexts are created to
     *    support both coordinate system modes (see {@link alignCoordinateSystem}).
     *
     * @example
     * Attach canvas during construction
     * ```typescript
     * const canvas = document.querySelector('canvas') as HTMLCanvasElement;
     * const board = new Board(canvas);
     * // No need to call attach() - already attached
     * ```
     *
     * @example
     * Attach canvas after construction
     * ```typescript
     * const board = new Board();
     *
     * // Later, when canvas is ready...
     * const canvas = document.createElement('canvas');
     * canvas.width = 800;
     * canvas.height = 600;
     * document.body.appendChild(canvas);
     *
     * board.attach(canvas);
     * // Board is now ready to use
     * ```
     *
     * @example
     * Switch to a different canvas
     * ```typescript
     * const board = new Board(canvas1);
     *
     * // Later, switch to a different canvas
     * const canvas2 = document.querySelector('#other-canvas') as HTMLCanvasElement;
     * board.attach(canvas2);
     * // Board is now rendering to canvas2
     * ```
     *
     * @group LifeCycle
     * @see {@link tearDown} for detaching and cleaning up
     * @see {@link context} for accessing the rendering context
     */
    attach(canvas: HTMLCanvasElement, debug: boolean = false) {
        this._canvasElement = canvas;
        const newContext = canvas.getContext('2d', {
            willReadFrequently: debug,
        });
        if (newContext == null) {
            console.error('new canvas context is null');
            return;
        }
        this._kmtParser.attach(canvas);
        this._touchParser.attach(canvas);
        this._canvasProxy.attach(canvas);

        if (this.limitEntireViewPort) {
            this.syncCameraZoomLevel(this._canvasProxy.dimensions);
        }

        this._context = newContext;
        this._reversedContext = reverseYAxis(this._context);
    }

    disableEventListeners() {
        this._kmtParser.tearDown();
        this._touchParser.tearDown();
    }

    enableEventListeners() {
        this._kmtParser.setUp();
        this._touchParser.setUp();
    }

    get inputOrchestrator(): InputOrchestrator {
        return this._inputOrchestrator;
    }

    /**
     * @group LifeCycle
     * @description This function is used to clean up the board. It removes all the event listeners and disconnects the resize observer and the attribute observer.
     */
    tearDown() {
        this._kmtParser.tearDown();
        this._touchParser.tearDown();
        this._canvasProxy.tearDown();
        this._canvasElement = undefined;
        this._context = undefined;
        this._reversedContext = undefined;
    }

    private bindFunctions() {
        this.step = this.step.bind(this);
    }

    get width(): number {
        return this._canvasProxy.width;
    }

    get height(): number {
        return this._canvasProxy.height;
    }

    /**
     * @description This is an attribute that determines if the coordinate system should be aligned with the one of the HTML canvas element. The default is true.
     * If you set this to true, the coordinate system will be aligned with the one of the HTML canvas element.
     * If you change this value during runtime, you should update the context to be aligned with the new coordinate system. (just call board.context again)
     */
    set alignCoordinateSystem(align: boolean) {
        this._alignCoordinateSystem = align;
        this._observableInputTracker.alignCoordinateSystem = align;
        this._touchInputTracker.alignCoordinateSystem = align;
    }

    get alignCoordinateSystem(): boolean {
        return this._alignCoordinateSystem;
    }

    /**
     * @description Determines if the board should be full screen. If this is set to true, the width and height of the board will be set to the window's inner width and inner height respectively,
     * and the width and height of the board will resize with the window.
     */
    get fullScreen(): boolean {
        return this._fullScreen;
    }

    set fullScreen(value: boolean) {
        this._fullScreen = value;
        if (this._fullScreen) {
            this._canvasProxy.setWidth(window.innerWidth);
            this._canvasProxy.setHeight(window.innerHeight);
        }
    }

    /**
     * @description The context used to draw on the canvas.
     * If alignCoordinateSystem is false, this returns a proxy that automatically negates y-coordinates for relevant drawing methods.
     */
    get context(): CanvasRenderingContext2D | undefined {
        if (!this._alignCoordinateSystem) {
            return this._reversedContext;
        }
        return this._context;
    }

    /**
     * @description Determines the behavior of the camera when the camera is at the edge of the boundaries. If set to true, the entire view port would not move beyond the boundaries.
     * If set to false, only the center of the camera is bounded by the boundaries.
     */
    set limitEntireViewPort(value: boolean) {
        this.cameraRig.config.limitEntireViewPort = value;
        if (this._canvasProxy.detached) {
            return;
        }
        if (value) {
            this.syncCameraZoomLevel(this._canvasProxy.dimensions);
        }
    }

    get limitEntireViewPort(): boolean {
        return this.cameraRig.config.limitEntireViewPort;
    }

    /**
     * @description The strategy used to handle the keyboard, mouse events. The default strategy is the DefaultBoardKMTStrategy.
     * You can implement your own strategy by implementing the BoardKMTStrategy interface.
     */
    set kmtParser(parser: KMTEventParser) {
        this._kmtParser.tearDown();
        parser.tearDown();
        if (this._canvasElement != undefined) {
            parser.attach(this._canvasElement);
        }
        parser.setUp();
        this._kmtParser = parser;
    }

    get kmtParser(): KMTEventParser {
        return this._kmtParser;
    }

    /**
     * The keyboard/mouse/trackpad input state machine currently driving the
     * board, read from the active parser so it stays correct after a
     * {@link kmtParser} swap.
     *
     * @returns The machine, or `undefined` when a custom parser does not
     * expose one.
     *
     * @remarks
     * Intended for tooling/introspection — a visualizer reading
     * `currentState` and `context`, for instance. Drive the board through
     * real input or through the parser, not by dispatching here, and never
     * call `wrapup()` on it: that parks the machine in `TERMINAL` and the
     * board stops responding to all input.
     *
     * `KMTEventParser.stateMachine` is only typed for the minimal
     * `{ happens }` contract the parser itself needs, so a custom parser can
     * install a `stateMachine` that satisfies that contract without being a
     * real `being` state machine. This getter structurally checks for the
     * `being` `StateMachine` surface and returns `undefined` rather than
     * handing back something that doesn't actually have `currentState` or
     * `onStateChange`.
     */
    get kmtInputStateMachine(): KmtInputStateMachine | undefined {
        const machine = this._kmtParser.stateMachine;
        return hasBeingStateMachineShape<KmtInputStateMachine>(machine)
            ? machine
            : undefined;
    }

    /**
     * @description The parser used to handle touch events. The default parser is the DefaultTouchParser.
     * You can have your own parser by implementing the BoardTouchParser interface.
     */
    set touchParser(parser: TouchEventParser) {
        this._touchParser.tearDown();
        parser.tearDown();
        if (this._canvasElement != undefined) {
            parser.attach(this._canvasElement);
        }
        parser.setUp();
        this._touchParser = parser;
    }

    get touchParser(): TouchEventParser {
        return this._touchParser;
    }

    /**
     * The touch input state machine currently driving the board, read from
     * the active parser so it stays correct after a {@link touchParser} swap.
     *
     * @returns The machine, or `undefined` when a custom parser does not
     * expose one.
     *
     * @remarks
     * Intended for tooling/introspection — a visualizer reading
     * `currentState` and `context`, for instance. Drive the board through
     * real input or through the parser, not by dispatching here, and never
     * call `wrapup()` on it: that parks the machine in `TERMINAL` and the
     * board stops responding to all input.
     *
     * `TouchEventParser.stateMachine` is typed to the full
     * `TouchInputStateMachine`, but a custom parser could still install a
     * value that satisfies that type shape without behaving like a real
     * `being` state machine at runtime (e.g. across a duck-typed adapter).
     * This getter applies the same structural check as
     * {@link kmtInputStateMachine} and returns `undefined` rather than
     * handing back something that doesn't actually have `currentState` or
     * `onStateChange`.
     */
    get touchInputStateMachine(): TouchInputStateMachine | undefined {
        const machine = this._touchParser.stateMachine;
        return hasBeingStateMachineShape<TouchInputStateMachine>(machine)
            ? machine
            : undefined;
    }

    /**
     * Swaps the state machine that turns touch input into camera moves.
     *
     * @param createMachine - Builds the machine from the board's own touch
     * context, e.g. {@link createOneFingerPanTouchInputStateMachine},
     * {@link createTouchInputStateMachine}, or your own function wrapping an
     * `expand...` helper
     * @returns The machine `createMachine` built, with its real type
     *
     * @remarks
     * The board installs a new {@link VanillaTouchEventParser} driving the
     * machine, through the {@link touchParser} setter. A disabled touch
     * parser stays disabled. Because the machine shares the board's touch
     * context, {@link alignCoordinateSystem} keeps applying to it.
     *
     * {@link touchParser} and {@link touchInputStateMachine} return the new
     * machine afterwards, but keep their stock type; use the return value
     * when you need the machine's real type.
     *
     * To use a custom parser instead, build it with the machine and assign it
     * to {@link touchParser}.
     *
     * @example
     * One finger pans, two fingers pinch-zoom:
     * ```typescript
     * const board = new Board(canvas);
     * board.setTouchInputStateMachine(createOneFingerPanTouchInputStateMachine);
     * ```
     *
     * @example
     * Back to the default, where only two-finger gestures move the camera:
     * ```typescript
     * board.setTouchInputStateMachine(createTouchInputStateMachine);
     * ```
     */
    setTouchInputStateMachine<Machine extends StateMachine>(
        createMachine: (context: TouchContext) => Machine
    ): Machine {
        const machine = createMachine(this._touchInputTracker);
        const parser = new VanillaTouchEventParser(
            machine,
            this._inputOrchestrator,
            this._canvasElement
        );
        if (this._touchParser.disabled) {
            parser.disable();
        }
        this.touchParser = parser;
        return machine;
    }

    /**
     * @description The underlying camera of the board. The camera of the board can be switched.
     * The boundaries are based on camera meaning you can have cameras with different boundaries, and you can switch between them during runtime.
     */
    get camera(): ObservableBoardCamera {
        return this.cameraRig.camera;
    }

    set camera(camera: ObservableBoardCamera) {
        if (!this._canvasProxy.detached) {
            camera.viewPortHeight =
                this._canvasProxy.height / window.devicePixelRatio;
            camera.viewPortWidth =
                this._canvasProxy.width / window.devicePixelRatio;
        }
        this.cameraRig.camera = camera;
    }

    get cameraMux(): CameraMux {
        return this._cameraMux;
    }

    set cameraMux(cameraMux: CameraMux) {
        this._cameraMux = cameraMux;
        // Update all components that depend on cameraMux
        // Note: TouchInputTracker and Orchestrator would need to be recreated or have setter methods

        // input orchestrator
        this._inputOrchestrator.cameraMux = cameraMux;
    }

    /**
     * @description This is the step function that is called in the animation frame. This function is responsible for updating the canvas context and the camera state.
     * @param timestamp
     */
    public step(timestamp: number) {
        if (this._canvasProxy.detached || this._context == undefined) {
            return;
        }

        this.cameraRig.update();
        let deltaTime = timestamp - this.lastUpdateTime;
        this.lastUpdateTime = timestamp;
        deltaTime = deltaTime / 1000;

        this._context.reset();
        this._context.clearRect(
            0,
            0,
            this._canvasProxy.width * window.devicePixelRatio,
            this._canvasProxy.height * window.devicePixelRatio
        );

        if (this._cachedCanvasPixelRatio !== window.devicePixelRatio) {
            this._cachedCanvasPixelRatio = window.devicePixelRatio;
            this._canvasProxy.setCanvasHeight(this._canvasProxy.height);
            this._canvasProxy.setCanvasWidth(this._canvasProxy.width);
        }

        if (this._cachedCanvasHeight !== this._canvasProxy.height) {
            this._cachedCanvasHeight = this._canvasProxy.height;
            this._canvasProxy.setCanvasHeight(this._canvasProxy.height);
        }
        if (this._cachedCanvasWidth !== this._canvasProxy.width) {
            this._cachedCanvasWidth = this._canvasProxy.width;
            this._canvasProxy.setCanvasWidth(this._canvasProxy.width);
        }

        const transfromMatrix = this.camera.getTransform(
            window.devicePixelRatio,
            this._alignCoordinateSystem
        );
        const currentTransform = this._context.getTransform();
        if (
            currentTransform.a !== transfromMatrix.a ||
            currentTransform.b !== transfromMatrix.b ||
            currentTransform.c !== transfromMatrix.c ||
            currentTransform.d !== transfromMatrix.d ||
            currentTransform.e !== transfromMatrix.e ||
            currentTransform.f !== transfromMatrix.f
        ) {
            this._context.setTransform(
                transfromMatrix.a,
                transfromMatrix.b,
                transfromMatrix.c,
                transfromMatrix.d,
                transfromMatrix.e,
                transfromMatrix.f
            );
        }
    }

    /**
     * TODO add the option to make the camera position to be at the top left corner of the canvas; or better yet any point in the viewport (within the viewport boundaries)
     * @description Converts a point from window coordinates to world coordinates.
     * @param clickPointInWindow The point in window coordinates to convert.
     * @returns The converted point in world coordinates.
     */
    convertWindowPoint2WorldCoord(clickPointInWindow: Point): Point {
        const boundingRect = this._canvasProxy.dimensions;
        const cameraCenterInWindow = {
            x: boundingRect.position.x + boundingRect.width / 2,
            y: boundingRect.position.y + boundingRect.height / 2,
        };
        const pointInViewPort = PointCal.subVector(
            clickPointInWindow,
            cameraCenterInWindow
        );
        if (!this._alignCoordinateSystem) {
            pointInViewPort.y = -pointInViewPort.y;
        }
        return this.camera.convertFromViewPort2WorldSpace(pointInViewPort);
    }

    /**
     * @description Add an camera movement event listener. The events are "pan", "zoom", and "rotate".
     * There's also an "all" event that will be triggered when any of the above events are triggered.
     * @param eventName The event name to listen for. The events are "pan", "zoom", and "rotate".
     * @param callback The callback function to call when the event is triggered. The event provided to the callback is different for the different events.
     * @returns The converted point in world coordinates.
     */
    on<K extends keyof CameraEventMap>(
        eventName: K,
        callback: (event: CameraEventMap[K], cameraState: CameraState) => void
    ): UnSubscribe {
        return this.camera.on(eventName, callback);
    }

    /**
     * @description Add an input event listener. The events are "pan", "zoom", and "rotate". This is different from the camera event listener as this is for input events.
     * There's also an "all" event that will be triggered when any of the above events are triggered.
     * Input event does not necesarily mean that the camera will move. The input events are the events triggered when the user interacts with the board.
     * @param eventName
     * @param callback
     * @returns
     */
    onInput<K extends keyof RawUserInputEventMap>(
        eventName: K,
        callback: (event: RawUserInputEventMap[K]) => void
    ): UnsubscribeToUserRawInput {
        return this.boardInputPublisher.on(eventName, callback);
    }

    /**
     * @description The max translation height of the camera. This is the maximum distance the camera can move in the vertical direction.
     */
    get maxHalfTransHeight(): number | undefined {
        return halfTranslationHeightOf(this.camera.boundaries);
    }

    /**
     * @description The max translation width of the camera. This is the maximum distance the camera can move in the horizontal direction.
     */
    get maxHalfTransWidth(): number | undefined {
        return halfTranslationWidthOf(this.camera.boundaries);
    }

    private syncCameraZoomLevel(canvasDimensions: CanvasDimensions) {
        if (this.limitEntireViewPort) {
            const targetMinZoomLevel = minZoomLevelBaseOnDimensions(
                this.camera.boundaries,
                canvasDimensions.width,
                canvasDimensions.height,
                this.camera.rotation
            );
            if (
                targetMinZoomLevel != undefined &&
                zoomLevelBoundariesShouldUpdate(
                    this.camera.zoomBoundaries,
                    targetMinZoomLevel
                )
            ) {
                this.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }

    /**
     * @group Helper Methods
     * @description This function sets the max translation width of the camera while fixing the minimum x boundary.
     */
    setMaxTransWidthWithFixedMinBoundary(value: number) {
        const curBoundaries = this.camera.boundaries;
        const curMin =
            curBoundaries == undefined ? undefined : curBoundaries.min;
        const curHorizontalMin = curMin == undefined ? undefined : curMin.x;
        if (curHorizontalMin == undefined) {
            this.camera.setHorizontalBoundaries(-value, value);
        } else {
            this.camera.setHorizontalBoundaries(
                curHorizontalMin,
                curHorizontalMin + value * 2
            );
        }
        if (this.limitEntireViewPort) {
            const targetMinZoomLevel = minZoomLevelBaseOnWidth(
                this.camera.boundaries,
                this.camera.viewPortWidth,
                this.camera.viewPortHeight,
                this.camera.rotation
            );
            if (
                zoomLevelBoundariesShouldUpdate(
                    this.camera.zoomBoundaries,
                    targetMinZoomLevel
                )
            ) {
                this.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }

    /**
     * @group Helper Methods
     * @description This function sets the max translation width of the camera while fixing the minimum x boundary.
     */
    setMaxTransWidthWithFixedMaxBoundary(value: number) {
        const curBoundaries = this.camera.boundaries;
        const curMax =
            curBoundaries == undefined ? undefined : curBoundaries.max;
        const curHorizontalMax = curMax == undefined ? undefined : curMax.x;
        if (curHorizontalMax == undefined) {
            this.camera.setHorizontalBoundaries(-value, value);
        } else {
            this.camera.setHorizontalBoundaries(
                curHorizontalMax - value * 2,
                curHorizontalMax
            );
        }
        if (this.limitEntireViewPort) {
            const targetMinZoomLevel = minZoomLevelBaseOnWidth(
                this.camera.boundaries,
                this.camera.viewPortWidth,
                this.camera.viewPortHeight,
                this.camera.rotation
            );
            if (
                zoomLevelBoundariesShouldUpdate(
                    this.camera.zoomBoundaries,
                    targetMinZoomLevel
                )
            ) {
                this.camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    }

    get restrictRelativeXTranslation(): boolean {
        return this.cameraRig.config.restrictRelativeXTranslation;
    }

    get restrictRelativeYTranslation(): boolean {
        return this.cameraRig.config.restrictRelativeYTranslation;
    }

    get restrictXTranslation(): boolean {
        return this.cameraRig.config.restrictXTranslation;
    }

    get restrictYTranslation(): boolean {
        return this.cameraRig.config.restrictYTranslation;
    }

    set restrictRelativeXTranslation(value: boolean) {
        this.cameraRig.config.restrictRelativeXTranslation = value;
    }

    set restrictRelativeYTranslation(value: boolean) {
        this.cameraRig.configure({ restrictRelativeYTranslation: value });
    }

    set restrictXTranslation(value: boolean) {
        this.cameraRig.configure({ restrictXTranslation: value });
    }

    set restrictYTranslation(value: boolean) {
        this.cameraRig.configure({ restrictYTranslation: value });
    }

    get restrictZoom(): boolean {
        return this.cameraRig.config.restrictZoom;
    }

    set restrictZoom(value: boolean) {
        this.cameraRig.configure({ restrictZoom: value });
    }

    get restrictRotation(): boolean {
        return this.cameraRig.config.restrictRotation;
    }

    set restrictRotation(value: boolean) {
        this.cameraRig.configure({ restrictRotation: value });
    }

    get clampTranslation(): boolean {
        return this.cameraRig.config.clampTranslation;
    }

    set clampTranslation(value: boolean) {
        this.cameraRig.configure({ clampTranslation: value });
    }

    get clampZoom(): boolean {
        return this.cameraRig.config.clampZoom;
    }

    set clampZoom(value: boolean) {
        this.cameraRig.configure({ clampZoom: value });
    }

    get clampRotation(): boolean {
        return this.cameraRig.config.clampRotation;
    }

    set clampRotation(value: boolean) {
        this.cameraRig.configure({ clampRotation: value });
    }

    getCameraRig(): CameraRig {
        return this.cameraRig;
    }

    /**
     * Sets the input device the board is set up for and turns auto-detection off.
     *
     * @remarks
     * Boards start in `'kmt'` (keyboard + mouse: a plain scroll wheel zooms). In
     * `'trackpad'` a two-finger swipe pans and a pinch zooms. Give users a way to
     * choose (and remember their choice) rather than guessing from their input.
     *
     * @param mode - `'kmt'` or `'trackpad'`
     *
     * @example
     * ```typescript
     * const board = new Board(canvas);
     * board.setInputMode('trackpad');
     * ```
     */
    setInputMode(mode: KmtInputMode): void {
        this._observableInputTracker.setMode(mode);
    }

    /**
     * The current input modality.
     *
     * @returns `'kmt'` (keyboard-mouse, the default), `'trackpad'`, or `'TBD'`
     * when auto-detection was turned on with {@link enableAutoInputMode} and has
     * not yet committed to a mode.
     */
    get inputMode(): 'kmt' | 'trackpad' | 'TBD' {
        return this._observableInputTracker.mode;
    }

    /**
     * Flips the input mode between keyboard-mouse and trackpad and locks it,
     * disabling auto-detection.
     *
     * From `'kmt'` this switches to `'trackpad'`; from `'trackpad'` or `'TBD'`
     * it switches to `'kmt'`. (`'TBD'` already behaves like trackpad, so the
     * natural "other" mode to toggle into is `'kmt'`.)
     *
     * @see {@link setInputMode} to set a specific mode, and
     * {@link enableAutoInputMode} to return to auto-detection.
     */
    toggleInputMode(): void {
        this.setInputMode(this.inputMode === 'kmt' ? 'trackpad' : 'kmt');
    }

    /**
     * Opts into auto-detection of the input modality.
     *
     * The mode becomes `'TBD'`, where a plain scroll pans, until a middle-click
     * settles it on `'kmt'`. Auto-detection is off by default; prefer letting
     * the user choose with {@link setInputMode}.
     */
    enableAutoInputMode(): void {
        this._observableInputTracker.enableInputModeDetection();
    }

    onCanvasDimensionChange(callback: (dimensions: CanvasDimensions) => void) {
        return this._canvasProxy.subscribe(callback);
    }

    get canvasDimensions(): CanvasDimensions {
        return this._canvasProxy.dimensions;
    }
}
