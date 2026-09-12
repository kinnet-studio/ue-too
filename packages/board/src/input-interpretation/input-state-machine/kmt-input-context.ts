import { BaseContext, NO_OP } from '@ue-too/being';
import { Point } from '@ue-too/math';

import {
    CanvasPositionDimensionPublisher,
    Observable,
    Observer,
    SubscriptionOptions,
    SvgPositionDimensionPublisher,
    SynchronousObservable,
    getTrueRect,
} from '../../utils';

/**
 * Cursor styles used to provide visual feedback for different input states.
 *
 * @remarks
 * These cursor styles indicate the current interaction mode to users:
 * - **GRAB**: Indicates the canvas is ready to be panned (spacebar pressed, no drag yet)
 * - **GRABBING**: Indicates active panning is in progress
 * - **DEFAULT**: Normal cursor state when no special interaction is active
 *
 * @category Input State Machine
 */
export enum CursorStyle {
    GRAB = 'grab',
    DEFAULT = 'default',
    GRABBING = 'grabbing',
}

/**
 * Canvas dimension and position information.
 *
 * @property width - The canvas width in CSS pixels
 * @property height - The canvas height in CSS pixels
 * @property position - The top-left position of the canvas in window coordinates
 *
 * @category Input State Machine
 */
export type CanvasDimensions = {
    width: number;
    height: number;
    position: Point;
};

/**
 * Abstraction interface for canvas element access and manipulation.
 *
 * @remarks
 * This interface provides a decoupled way to access canvas properties without direct DOM access.
 * Multiple implementations exist to support different use cases:
 * - **CanvasProxy**: Full implementation for HTML canvas elements with dimension tracking
 * - **SvgProxy**: Implementation for SVG elements
 * - **DummyCanvas**: No-op implementation for web worker contexts
 * - **WorkerRelayCanvas**: Relays canvas dimension updates to web workers
 * - **CanvasCacheInWebWorker**: Caches canvas dimensions within a web worker
 *
 * The abstraction enables:
 * - Coordinate system transformations (window → canvas → viewport)
 * - Canvas dimension tracking without repeated DOM queries
 * - Cursor style management
 * - Support for both canvas and SVG rendering contexts
 *
 * @category Input State Machine
 */
export interface Canvas {
    /** The canvas width in CSS pixels */
    width: number;
    /** The canvas height in CSS pixels */
    height: number;
    /** The top-left position of the canvas in window coordinates */
    position: Point;
    /** Sets the CSS cursor style for visual feedback */
    setCursor: (style: CursorStyle) => void;
    /** Combined dimensions and position information */
    dimensions: CanvasDimensions;
    /** Whether the canvas is currently detached from the DOM */
    detached: boolean;
    /** Cleanup method to dispose of resources and event listeners */
    tearDown: () => void;
}

/**
 * No-op implementation of Canvas interface for web worker relay contexts.
 *
 * @remarks
 * This class is used when an input state machine is configured to relay events to a web worker
 * rather than perform actual canvas operations. The state machine requires a Canvas in its context,
 * but in the relay scenario, no actual canvas operations are needed - events are simply forwarded
 * to the worker thread.
 *
 * All properties return default/empty values and all methods are no-ops.
 *
 * @category Input State Machine
 *
 * @see {@link DummyKmtInputContext}
 */
export class DummyCanvas implements Canvas {
    width: number = 0;
    height: number = 0;
    position: Point = { x: 0, y: 0 };
    setCursor: (style: CursorStyle) => void = NO_OP;
    dimensions: { width: number; height: number; position: Point } = {
        width: 0,
        height: 0,
        position: { x: 0, y: 0 },
    };
    detached: boolean = false;
    tearDown: () => void = NO_OP;
}

export class CanvasCacheInWebWorker implements Canvas {
    private _width: number;
    private _height: number;
    private _position: Point;
    private _postMessageFunction: typeof postMessage;

    constructor(postMessageFunction: typeof postMessage) {
        this._width = 0;
        this._height = 0;
        this._position = { x: 0, y: 0 };
        this._postMessageFunction = postMessageFunction;
    }

    get dimensions(): { width: number; height: number; position: Point } {
        return {
            width: this._width,
            height: this._height,
            position: this._position,
        };
    }

    tearDown(): void {}

    set width(width: number) {
        this._width = width;
    }

    set height(height: number) {
        this._height = height;
    }

    set position(position: Point) {
        this._position = position;
    }

    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }

    get position(): Point {
        return this._position;
    }

    setCursor(style: 'grab' | 'default' | 'grabbing'): void {
        this._postMessageFunction({ type: 'setCursor', style });
    }

    get detached(): boolean {
        return false;
    }
}

/**
 * Whether a measured dimension came from a canvas that layout has actually
 * sized.
 *
 * @remarks
 * A canvas inside a `display: none` subtree — a collapsed panel, a tab that
 * hasn't been shown yet — measures `0`. That zero must never be written back to
 * the element's inline style: the write is unrecoverable, because the canvas's
 * own style is what gets measured on the next frame, so a canvas that took its
 * height from the layout (a flex `stretch`, a percentage) can never get one
 * again. Zero and the `NaN`/`Infinity` that fall out of dividing by it are all
 * "not laid out yet", and the right response to all of them is to wait.
 */
function isLaidOutSize(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}

/**
 * A proxy for the canvas element to prevent constant invoking of the getBoundingClientRect method.
 * @remarks This is mainly used as a proxy to the canvas to prevent invoking the getBoundingClientRect method on the canvas every time a pointer event is triggered or a coordinate conversion is needed. Also to autoscale the canvas buffer depending on the device pixel ratio. It's important to note that in normal circumstances, you would not need to set the size of the canvas manually; you should use the css style width and height to set the size of the canvas.
 * @category Input State Machine
 * @see {@link Canvas} for the interface that this class implements
 * @see {@link Observable} for the observable that this class emits
 * @see {@link Observer} for the observer that can subscribe to the observable
 * @see {@link SubscriptionOptions} for the options that can be passed to the subscribe method
 * @see {@link SynchronousObservable} for the synchronous observable that this class emits
 * @see {@link CanvasPositionDimensionPublisher} for the publisher that is used to publish the canvas dimensions
 */
export class CanvasProxy implements Canvas, Observable<[CanvasDimensions]> {
    private _width: number = 0;
    private _height: number = 0;
    private _position: Point = { x: 0, y: 0 };
    private _canvasPositionDimensionPublisher: CanvasPositionDimensionPublisher;
    private _canvas: HTMLCanvasElement | undefined;
    private _internalSizeUpdateObservable: Observable<[CanvasDimensions]>;

    constructor(canvas?: HTMLCanvasElement) {
        this._internalSizeUpdateObservable = new SynchronousObservable<
            [CanvasDimensions]
        >();

        if (canvas) {
            const boundingRect = canvas.getBoundingClientRect();
            const trueRect = getTrueRect(
                boundingRect,
                window.getComputedStyle(canvas)
            );
            this._width = trueRect.width;
            this._height = trueRect.height;
            this._position = { x: trueRect.left, y: trueRect.top };
            this._canvas = canvas;
        }

        this._canvasPositionDimensionPublisher =
            new CanvasPositionDimensionPublisher(canvas);
        this._canvasPositionDimensionPublisher.onPositionUpdate(rect => {
            // the rect is the canvas dimension in the DOM (the width and height attribute would need to multiply by the device pixel ratio)
            if (this._canvas == undefined) {
                console.error(
                    'is not attached to any canvas should not have getting any updates'
                );
                return;
            }

            this._width = rect.width;
            this._height = rect.height;
            this._position = { x: rect.left, y: rect.top };

            this._internalSizeUpdateObservable.notify({
                width: this._width,
                height: this._height,
                position: this._position,
            });
        });
    }

    subscribe(
        observer: Observer<[CanvasDimensions]>,
        options?: SubscriptionOptions
    ): () => void {
        return this._internalSizeUpdateObservable.subscribe(observer, options);
    }

    notify(...data: [CanvasDimensions]): void {
        this._internalSizeUpdateObservable.notify(...data);
    }

    get detached(): boolean {
        return this._canvas === undefined;
    }

    get dimensions(): { width: number; height: number; position: Point } {
        return {
            width: this._width,
            height: this._height,
            position: this._position,
        };
    }

    get width(): number {
        return this._width;
    }

    /**
     * set the width of the canvas
     * the width is synonymous with the canvas style width not the canvas width
     */
    setWidth(width: number) {
        if (this._canvas) {
            this._canvas.width = width * window.devicePixelRatio;
            this._canvas.style.width = width + 'px';
        }
    }

    setCanvasWidth(width: number) {
        if (!isLaidOutSize(width)) {
            return;
        }
        if (
            this._canvas &&
            this._canvas.style.width === '' &&
            this._canvas.style.height === ''
        ) {
            const aspectRatio = this._width / this._height;
            if (isLaidOutSize(aspectRatio)) {
                this._canvas.style.aspectRatio = aspectRatio.toString();
            }
        }
        if (this._canvas && this._canvas.style.width !== '') {
            this._canvas.width = width * window.devicePixelRatio;
        } else {
            this.setWidth(width);
        }
    }

    /**
     * set the height of the canvas
     * the height is synonymous with the canvas style height not the canvas height
     */
    setHeight(height: number) {
        if (this._canvas) {
            this._canvas.height = height * window.devicePixelRatio;
            this._canvas.style.height = height + 'px';
        }
    }

    setCanvasHeight(height: number) {
        if (!isLaidOutSize(height)) {
            return;
        }
        if (
            this._canvas &&
            this._canvas.style.width === '' &&
            this._canvas.style.height === ''
        ) {
            const aspectRatio = this._width / this._height;
            if (isLaidOutSize(aspectRatio)) {
                this._canvas.style.aspectRatio = aspectRatio.toString();
            }
        }
        if (this._canvas && this._canvas.style.height !== '') {
            this._canvas.height = height * window.devicePixelRatio;
        } else {
            this.setHeight(height);
        }
    }

    get height(): number {
        return this._height;
    }

    get position(): Point {
        return this._position;
    }

    setCursor(style: 'grab' | 'default' | 'grabbing'): void {
        if (this._canvas) {
            this._canvas.style.cursor = style;
        }
    }

    tearDown(): void {
        this._canvasPositionDimensionPublisher.dispose();
        this._canvas = undefined;
        this._width = 0;
        this._height = 0;
        this._position = { x: 0, y: 0 };
    }

    attach(canvas: HTMLCanvasElement) {
        this._canvas = canvas;
        this._canvasPositionDimensionPublisher.attach(canvas);
    }
}

export class SvgProxy implements Canvas, Observable<[CanvasDimensions]> {
    private _width: number = 0;
    private _height: number = 0;
    private _position: Point = { x: 0, y: 0 };
    private _svgPositionDimensionPublisher: SvgPositionDimensionPublisher;
    private _svg: SVGSVGElement | undefined;
    private _internalSizeUpdateObservable: Observable<[CanvasDimensions]>;

    constructor(svg?: SVGSVGElement) {
        this._internalSizeUpdateObservable = new SynchronousObservable<
            [CanvasDimensions]
        >();

        if (svg) {
            const boundingRect = svg.getBoundingClientRect();
            const trueRect = getTrueRect(
                boundingRect,
                window.getComputedStyle(svg)
            );
            this._width = trueRect.width;
            this._height = trueRect.height;
            this._position = { x: trueRect.left, y: trueRect.top };
            this._svg = svg;
        }

        this._svgPositionDimensionPublisher = new SvgPositionDimensionPublisher(
            svg
        );
        this._svgPositionDimensionPublisher.onPositionUpdate(rect => {
            // the rect is the canvas dimension in the DOM (the width and height attribute would need to multiply by the device pixel ratio)
            if (this._svg == undefined) {
                console.error(
                    'is not attached to any canvas should not have getting any updates'
                );
                return;
            }

            this._width = rect.width;
            this._height = rect.height;
            this._position = { x: rect.left, y: rect.top };

            this._internalSizeUpdateObservable.notify({
                width: this._width,
                height: this._height,
                position: this._position,
            });
        });
    }

    subscribe(
        observer: Observer<[CanvasDimensions]>,
        options?: SubscriptionOptions
    ): () => void {
        return this._internalSizeUpdateObservable.subscribe(observer, options);
    }

    notify(...data: [CanvasDimensions]): void {
        this._internalSizeUpdateObservable.notify(...data);
    }

    get detached(): boolean {
        return this._svg === undefined;
    }

    get dimensions(): { width: number; height: number; position: Point } {
        return {
            width: this._width,
            height: this._height,
            position: this._position,
        };
    }

    get width(): number {
        return this._width;
    }

    /**
     * set the width of the canvas
     * the width is synonymous with the canvas style width not the canvas width
     */
    setWidth(width: number) {
        if (this._svg) {
            this._svg.style.width = width + 'px';
        }
    }

    /**
     * set the height of the canvas
     * the height is synonymous with the canvas style height not the canvas height
     */
    setHeight(height: number) {
        if (this._svg) {
            this._svg.style.height = height + 'px';
        }
    }

    get height(): number {
        return this._height;
    }

    get position(): Point {
        return this._position;
    }

    setCursor(style: 'grab' | 'default' | 'grabbing'): void {
        if (this._svg) {
            this._svg.style.cursor = style;
        }
    }

    tearDown(): void {
        this._svgPositionDimensionPublisher.dispose();
        this._svg = undefined;
        this._width = 0;
        this._height = 0;
        this._position = { x: 0, y: 0 };
    }

    attach(svg: SVGSVGElement) {
        this._svgPositionDimensionPublisher.attach(svg);
        this._svg = svg;
        const boundingRect = svg.getBoundingClientRect();
        const trueRect = getTrueRect(
            boundingRect,
            window.getComputedStyle(svg)
        );
        this._svg.style.width = trueRect.width + 'px';
        this._svg.style.height = trueRect.height + 'px';
        this._width = trueRect.width;
        this._height = trueRect.height;
        this._position = { x: trueRect.left, y: trueRect.top };
        this._internalSizeUpdateObservable.notify({
            width: this._width,
            height: this._height,
            position: this._position,
        });
    }
}

/**
 * @description A proxy for the canvas that is used to communicate with the web worker.
 * The primary purpose of this class is to cache the canvas dimensions and position in the DOM to reduce the calling of the getBoundingClientRect method.
 * This class only serves as a relay of the updated canvas dimensions and position to the web worker.
 *
 */
export class WorkerRelayCanvas implements Canvas {
    private _width: number;
    private _height: number;
    private _position: Point;
    private _webWorker: Worker;
    private _canvas: HTMLCanvasElement;
    private _canvasDiemsionPublisher: CanvasPositionDimensionPublisher;

    constructor(
        canvas: HTMLCanvasElement,
        webWorker: Worker,
        canvasDiemsionPublisher: CanvasPositionDimensionPublisher
    ) {
        const boundingRect = canvas.getBoundingClientRect();
        this._canvas = canvas;
        this._webWorker = webWorker;
        const trueRect = getTrueRect(
            boundingRect,
            window.getComputedStyle(canvas)
        );
        this._width = trueRect.width;
        this._height = trueRect.height;
        this._position = { x: trueRect.left, y: trueRect.top };
        this._webWorker.postMessage({
            type: 'setCanvasDimensions',
            width: boundingRect.width,
            height: boundingRect.height,
            position: { x: boundingRect.left, y: boundingRect.top },
        });
        canvasDiemsionPublisher.onPositionUpdate(rect => {
            this._width = rect.width;
            this._height = rect.height;
            this._position = { x: rect.left, y: rect.top };
            this._webWorker.postMessage({
                type: 'updateCanvasDimensions',
                width: rect.width,
                height: rect.height,
                position: { x: rect.left, y: rect.top },
            });
        });
        this._canvasDiemsionPublisher = canvasDiemsionPublisher;
    }

    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }

    tearDown(): void {
        this._canvasDiemsionPublisher.dispose();
    }

    get position(): Point {
        return this._position;
    }

    get dimensions(): { width: number; height: number; position: Point } {
        return {
            width: this._width,
            height: this._height,
            position: this._position,
        };
    }

    get detached(): boolean {
        return false;
    }

    setCursor(style: 'grab' | 'default' | 'grabbing'): void {
        this._canvas.style.cursor = style;
    }
}

/**
 * Context interface for the Keyboard/Mouse/Trackpad (KMT) input state machine.
 *
 * @remarks
 * This context provides the state and behavior needed by the KMT state machine to:
 * 1. Track cursor positions for calculating pan deltas
 * 2. Distinguish between mouse and trackpad input modalities
 * 3. Access canvas dimensions for coordinate transformations
 * 4. Manage coordinate system alignment (inverted Y-axis handling)
 *
 * **Input Modality Detection**:
 * The context uses a scoring system (`kmtTrackpadTrackScore`) to differentiate between
 * mouse and trackpad input, which have different zoom behaviors:
 * - Mouse: Ctrl+Scroll = zoom, Scroll = pan
 * - Trackpad: Scroll = zoom (no Ctrl needed), Two-finger gesture = pan
 *
 * **Coordinate System**:
 * The `alignCoordinateSystem` flag determines Y-axis orientation:
 * - `true`: Standard screen coordinates (Y increases downward)
 * - `false`: Inverted coordinates (Y increases upward)
 *
 * This interface extends BaseContext from the \@ue-too/being state machine library,
 * inheriting setup() and cleanup() lifecycle methods.
 *
 * @category Input State Machine
 */
export interface KmtInputContext extends BaseContext {
    /** Whether to use standard screen coordinate system (vs inverted Y-axis) */
    alignCoordinateSystem: boolean;
    /** Canvas accessor for dimensions and cursor control */
    canvas: Canvas;
    /** Sets the initial cursor position when starting a pan gesture */
    setInitialCursorPosition: (position: Point) => void;
    /** Cancels the current action and resets cursor position */
    cancelCurrentAction: () => void;
    /** The cursor position when a pan gesture started */
    initialCursorPosition: Point;
    /** Score tracking input modality: >0 for mouse, <0 for trackpad, 0 for undetermined */
    kmtTrackpadTrackScore: number;
    /** Decreases the score toward trackpad */
    subtractKmtTrackpadTrackScore: () => void;
    /** Increases the score toward mouse */
    addKmtTrackpadTrackScore: () => void;
    /** Sets the determined input modality */
    setMode: (mode: 'kmt' | 'trackpad' | 'TBD') => void;
    /** The current input modality: 'kmt' (mouse), 'trackpad', or 'TBD' (to be determined) */
    mode: 'kmt' | 'trackpad' | 'TBD';
}

/**
 * No-op implementation of KmtInputContext for web worker relay scenarios.
 *
 * @remarks
 * Used when the input state machine is configured to relay events to a web worker
 * rather than process them locally. The state machine requires a context, but in
 * the relay scenario, no actual state tracking is needed - events are simply forwarded.
 *
 * All methods are no-ops and all properties return default values.
 *
 * @category Input State Machine
 *
 * @see {@link DummyCanvas}
 */
export class DummyKmtInputContext implements KmtInputContext {
    public alignCoordinateSystem: boolean = false;
    public canvas: Canvas = new DummyCanvas();
    public initialCursorPosition: Point = { x: 0, y: 0 };

    constructor() {}

    toggleOnEdgeAutoCameraInput: () => void = NO_OP;
    toggleOffEdgeAutoCameraInput: () => void = NO_OP;
    setCursorPosition: (position: Point) => void = NO_OP;

    setInitialCursorPosition(position: Point): void {}

    cleanup(): void {}

    setup(): void {}

    get kmtTrackpadTrackScore(): number {
        return 0;
    }

    subtractKmtTrackpadTrackScore(): void {}

    addKmtTrackpadTrackScore(): void {}

    setMode(mode: 'kmt' | 'trackpad' | 'TBD'): void {}

    get mode(): 'kmt' | 'trackpad' | 'TBD' {
        return 'kmt';
    }

    cancelCurrentAction(): void {}
}

/**
 * Production implementation of KmtInputContext that tracks input state for the state machine.
 *
 * @remarks
 * This class provides the concrete implementation of the KMT input context, maintaining
 * all state required by the state machine to recognize and track gestures:
 *
 * **State Tracking**:
 * - Initial cursor position for calculating pan deltas
 * - Input modality score to distinguish mouse vs trackpad
 * - Determined input mode (kmt/trackpad/TBD)
 * - Coordinate system alignment preference
 *
 * **Input Modality Detection**:
 * The `kmtTrackpadTrackScore` accumulates evidence about the input device:
 * - Positive values indicate mouse behavior (middle-click, no horizontal scroll)
 * - Negative values indicate trackpad behavior (horizontal scroll, two-finger gestures)
 * - Score is used to determine zoom behavior (Ctrl+Scroll for mouse vs Scroll for trackpad)
 *
 * **Design Pattern**:
 * This class follows the Context pattern from the @ue-too/being state machine library,
 * providing stateful data and operations that states can access and modify during transitions.
 *
 * @category Input State Machine
 *
 * @example
 * ```typescript
 * const canvasProxy = new CanvasProxy(canvasElement);
 * const context = new ObservableInputTracker(canvasProxy);
 * const stateMachine = createKmtInputStateMachine(context);
 *
 * // Context tracks state as the state machine processes events
 * stateMachine.happens("leftPointerDown", {x: 100, y: 200});
 * console.log(context.initialCursorPosition); // {x: 100, y: 200}
 * ```
 */
export class ObservableInputTracker implements KmtInputContext {
    private _alignCoordinateSystem: boolean;
    private _canvasOperator: Canvas;
    private _initialCursorPosition: Point;
    private _kmtTrackpadTrackScore: number; // > 0 for kmt; < 0 for trackpad; 0 for TBD;
    private _mode: 'kmt' | 'trackpad' | 'TBD';
    private _deciding: boolean = true;

    constructor(canvasOperator: Canvas) {
        this._alignCoordinateSystem = true;
        this._canvasOperator = canvasOperator;
        this._initialCursorPosition = { x: 0, y: 0 };
        this._kmtTrackpadTrackScore = 0;
        this._mode = 'TBD';
    }

    get mode(): 'kmt' | 'trackpad' | 'TBD' {
        return this._mode;
    }

    setMode(mode: 'kmt' | 'trackpad' | 'TBD'): void {
        this._deciding = false;
        this._mode = mode;
    }

    enableInputModeDetection(): void {
        this._deciding = true;
        this._kmtTrackpadTrackScore = 0;
        this._mode = 'TBD';
    }

    get kmtTrackpadTrackScore(): number {
        return this._kmtTrackpadTrackScore;
    }

    subtractKmtTrackpadTrackScore(): void {
        if (!this._deciding) {
            return;
        }
        this._kmtTrackpadTrackScore--;
        if (this._kmtTrackpadTrackScore < -5) {
            this._kmtTrackpadTrackScore = 0;
            // this._mode = 'trackpad';
        }
    }

    addKmtTrackpadTrackScore(): void {
        if (!this._deciding) {
            return;
        }
        this._kmtTrackpadTrackScore++;
        if (this._kmtTrackpadTrackScore > 5) {
            this._kmtTrackpadTrackScore = 0;
            // this._mode = 'kmt';
        }
    }

    get alignCoordinateSystem(): boolean {
        return this._alignCoordinateSystem;
    }

    get canvas(): Canvas {
        return this._canvasOperator;
    }

    get initialCursorPosition(): Point {
        return this._initialCursorPosition;
    }

    set alignCoordinateSystem(value: boolean) {
        this._alignCoordinateSystem = value;
    }

    cancelCurrentAction(): void {
        this._initialCursorPosition = { x: 0, y: 0 };
    }

    setInitialCursorPosition(position: Point): void {
        this._initialCursorPosition = position;
    }

    cleanup(): void {}

    setup(): void {}
}

function withinEdgeOfCanvas(
    position: Point,
    boundingBox: { left: number; top: number; width: number; height: number },
    padding: number
): boolean {
    return (
        position.x <= boundingBox.left + padding ||
        position.x >= boundingBox.left + boundingBox.width - padding ||
        position.y <= boundingBox.top + padding ||
        position.y >= boundingBox.top + boundingBox.height - padding
    );
}

function pointInWhichHorizontalEdgeOfCanvas(
    position: Point,
    boundingBox: { left: number; top: number; width: number; height: number },
    padding: number
): 'left' | 'right' | 'none' {
    if (position.x <= boundingBox.left + padding) {
        return 'left';
    }
    if (position.x >= boundingBox.left + boundingBox.width - padding) {
        return 'right';
    }
    return 'none';
}

function pointInWhichVerticalEdgeOfCanvas(
    position: Point,
    boundingBox: { left: number; top: number; width: number; height: number },
    padding: number
): 'up' | 'down' | 'none' {
    if (position.y <= boundingBox.top + padding) {
        return 'up';
    }
    if (position.y >= boundingBox.top + boundingBox.height - padding) {
        return 'down';
    }
    return 'none';
}
