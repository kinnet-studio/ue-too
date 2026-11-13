import type { EventArgs, EventResult } from '@ue-too/being';

import type { KmtInputEventMapping } from '../../input-interpretation/input-state-machine';
import type { InputOrchestrator } from '../input-orchestrator';

/**
 * Interface for KMT (Keyboard/Mouse/Trackpad) event parsers.
 *
 * @remarks
 * Event parsers bridge the gap between DOM events and the state machine.
 * They listen for raw DOM events, convert them to state machine events,
 * and coordinate with the orchestrator for output processing.
 *
 * @category Raw Input Parser
 */
export interface KMTEventParser {
    /** Whether the parser is currently disabled */
    disabled: boolean;
    /** Initializes event listeners */
    setUp(): void;
    /** Removes event listeners and cleans up */
    tearDown(): void;
    /** Attaches to a new canvas element */
    attach(canvas: HTMLCanvasElement): void;
    /** Disables the parser; the event listeners are still attached just not processing any events*/
    disable(): void;
    /** Enables the parser */
    enable(): void;
    /**
     * The state machine this parser dispatches into, when the implementation
     * exposes one. Optional so existing external parser implementations
     * remain valid — typed to the minimal `{ happens }` contract this parser
     * itself needs, so an external implementation satisfies this member
     * without providing a full `being` `StateMachine`. Intended for
     * tooling/introspection — dispatch through the parser, not through this
     * reference.
     */
    readonly stateMachine?: StateMachine;
}

/**
 * Minimal pointer event interface for framework interoperability.
 *
 * @remarks
 * This subset of the DOM PointerEvent interface allows the parser to work with
 * both vanilla JavaScript PointerEvents and framework-wrapped events (e.g., PixiJS).
 *
 * @category Raw Input Parser
 */
export type MinimumPointerEvent = {
    /** Mouse button number (0=left, 1=middle, 2=right) */
    button: number;
    /** Pointer type ("mouse", "pen", "touch") */
    pointerType: string;
    /** X coordinate in window space */
    clientX: number;
    /** Y coordinate in window space */
    clientY: number;
    /** Bitmask of currently pressed buttons */
    buttons: number;
};

/**
 * Minimal wheel event interface for framework interoperability.
 *
 * @remarks
 * This subset of the DOM WheelEvent interface allows the parser to work with
 * both vanilla JavaScript WheelEvents and framework-wrapped events.
 *
 * @category Raw Input Parser
 */
export type MinimumWheelEvent = {
    /** Prevents default scroll behavior */
    preventDefault: () => void;
    /** Horizontal scroll delta */
    deltaX: number;
    /** Vertical scroll delta */
    deltaY: number;
    /** Whether Ctrl key is pressed (for zoom) */
    ctrlKey: boolean;
    /** X coordinate in window space */
    clientX: number;
    /** Y coordinate in window space */
    clientY: number;
};

/**
 * Minimal keyboard event interface for framework interoperability.
 *
 * @remarks
 * This subset of the DOM KeyboardEvent interface allows the parser to work with
 * both vanilla JavaScript KeyboardEvents and framework-wrapped events.
 *
 * @category Raw Input Parser
 */
export type MinimumKeyboardEvent = {
    /** Prevents default keyboard behavior */
    preventDefault: () => void;
    /** The key that was pressed */
    key: string;
};

/**
 * Minimal event target interface for framework interoperability.
 *
 * @remarks
 * This interface allows the parser to attach event listeners to different
 * types of event targets (HTMLElement, Canvas, PixiJS Container, etc.).
 *
 * @category Raw Input Parser
 */
export type EventTargetWithPointerEvents = {
    addEventListener: (
        type: string,
        listener: (event: any) => void,
        options?: { passive: boolean }
    ) => void;
    removeEventListener: (type: string, listener: (event: any) => void) => void;
};

/**
 * DOM event parser for Keyboard/Mouse/Trackpad input.
 *
 * @remarks
 * This parser converts raw DOM events into state machine events and coordinates with
 * the orchestrator to process outputs. It serves as the entry point for all KMT input
 * in the input interpretation pipeline.
 *
 * **Event Flow**:
 * ```
 * DOM Events → Parser → State Machine → Parser → Orchestrator → Camera/Observers
 * ```
 *
 * **Responsibilities**:
 * 1. Listen for DOM pointer, wheel, and keyboard events
 * 2. Convert DOM events to state machine event format
 * 3. Send events to the state machine
 * 4. Forward state machine outputs to the orchestrator
 *
 * **Handled DOM Events**:
 * - pointerdown/up/move (canvas-scoped)
 * - wheel (canvas-scoped)
 * - keydown/up (window-scoped for spacebar)
 *
 * **Keyboard Handling**:
 * Keyboard events are only processed when `document.body` is the target,
 * preventing interference with text inputs and other UI elements.
 *
 * The parser can be disabled to temporarily stop input processing (e.g., during
 * modal dialogs or animations).
 *
 * @category Raw Input Parser
 *
 * @example
 * ```typescript
 * const canvasElement = document.getElementById("canvas");
 * const stateMachine = createKmtInputStateMachine(context);
 * const orchestrator = new InputOrchestrator(cameraMux, cameraRig, publisher);
 * const parser = new VanillaKMTEventParser(stateMachine, orchestrator, canvasElement);
 *
 * parser.setUp(); // Starts listening for events
 *
 * // Later, to disable input temporarily
 * parser.disabled = true;
 *
 * // Cleanup when done
 * parser.tearDown();
 * ```
 */

export interface StateMachine {
    happens: (...args: any[]) => EventResult<any>;
}
export class VanillaKMTEventParser implements KMTEventParser {
    private _disabled: boolean = false;
    private _stateMachine: StateMachine;
    private _orchestrator: InputOrchestrator;
    private _keyfirstPressed: Map<string, boolean>;
    private _abortController: AbortController;
    protected _canvas?: HTMLCanvasElement | SVGSVGElement;

    constructor(
        kmtInputStateMachine: StateMachine,
        orchestrator: InputOrchestrator,
        canvas?: HTMLCanvasElement | SVGSVGElement
    ) {
        this._canvas = canvas;
        this.bindFunctions();
        this._abortController = new AbortController();
        this._stateMachine = kmtInputStateMachine;
        this._orchestrator = orchestrator;
        this._keyfirstPressed = new Map();
    }

    get disabled(): boolean {
        return this._disabled;
    }

    disable(): void {
        this._disabled = true;
    }

    enable(): void {
        this._disabled = false;
    }

    addEventListeners(signal: AbortSignal) {
        if (this._canvas == undefined) {
            return;
        }
        this._canvas.addEventListener(
            'pointerdown',
            this.pointerDownHandler as EventListener,
            { signal }
        );
        this._canvas.addEventListener(
            'pointerup',
            this.pointerUpHandler as EventListener,
            { signal }
        );
        this._canvas.addEventListener(
            'pointermove',
            this.pointerMoveHandler as EventListener,
            { signal }
        );
        this._canvas.addEventListener(
            'wheel',
            this.scrollHandler as EventListener,
            { signal }
        );
        window.addEventListener('keydown', this.keypressHandler, { signal });
        window.addEventListener('keyup', this.keyupHandler, { signal });
    }

    setUp(): void {
        if (this._abortController.signal.aborted) {
            this._abortController = new AbortController();
        }
        this.addEventListeners(this._abortController.signal);
    }

    tearDown(): void {
        this._abortController.abort();
        this._abortController = new AbortController();
        this._canvas = undefined;
    }

    bindFunctions(): void {
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
        this.pointerUpHandler = this.pointerUpHandler.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
        this.scrollHandler = this.scrollHandler.bind(this);
        this.keypressHandler = this.keypressHandler.bind(this);
        this.keyupHandler = this.keyupHandler.bind(this);
    }

    protected processEvent<K extends keyof KmtInputEventMapping>(
        ...args: EventArgs<KmtInputEventMapping, K>
    ): void {
        const result = this._stateMachine.happens(...args);
        if (
            result.handled &&
            'output' in result &&
            result.output !== undefined
        ) {
            this._orchestrator.processInputEventOutput(result.output);
        }
    }

    pointerDownHandler(e: PointerEvent) {
        if (this._disabled) {
            return;
        }
        if (e.button === 0 && e.pointerType === 'mouse') {
            this.processEvent('leftPointerDown', {
                x: e.clientX,
                y: e.clientY,
            });
            return;
        }
        if (e.button === 1 && e.pointerType === 'mouse') {
            this.processEvent('middlePointerDown', {
                x: e.clientX,
                y: e.clientY,
            });
            return;
        }
    }

    pointerUpHandler(e: PointerEvent) {
        if (this._disabled) {
            return;
        }
        if (e.button === 0 && e.pointerType === 'mouse') {
            this.processEvent('leftPointerUp', { x: e.clientX, y: e.clientY });
            return;
        }
        if (e.button === 1 && e.pointerType === 'mouse') {
            this.processEvent('middlePointerUp', {
                x: e.clientX,
                y: e.clientY,
            });
            return;
        }
    }

    pointerMoveHandler(e: PointerEvent) {
        if (this._disabled) {
            return;
        }
        if (e.buttons === 1 && e.pointerType === 'mouse') {
            this.processEvent('leftPointerMove', {
                x: e.clientX,
                y: e.clientY,
            });
            return;
        }
        if (e.buttons === 4 && e.pointerType === 'mouse') {
            this.processEvent('middlePointerMove', {
                x: e.clientX,
                y: e.clientY,
            });
            return;
        }
        this.processEvent('pointerMove', { x: e.clientX, y: e.clientY });
    }

    scrollHandler(e: WheelEvent) {
        if (this._disabled) return;
        e.preventDefault();
        if (e.ctrlKey) {
            this.processEvent('scrollWithCtrl', {
                x: e.clientX,
                y: e.clientY,
                deltaX: e.deltaX,
                deltaY: e.deltaY,
            });
        } else {
            this.processEvent('scroll', {
                x: e.clientX,
                y: e.clientY,
                deltaX: e.deltaX,
                deltaY: e.deltaY,
            });
        }
    }

    keypressHandler(e: KeyboardEvent) {
        if (e.target !== document.body) {
            return;
        }
        // Space with the pointer over the canvas starts Space + drag panning:
        // keep the page from scrolling, on every key repeat too. Elsewhere,
        // Space still scrolls the page.
        if (
            e.key === ' ' &&
            !this._disabled &&
            this._canvas?.matches(':hover')
        ) {
            e.preventDefault();
        }
        if (this._keyfirstPressed.has(e.key)) {
            return;
        }
        this._keyfirstPressed.set(e.key, true);
        if (e.key === ' ') {
            this.processEvent('spacebarDown');
        }
        if (e.key === 'Escape') {
            this.processEvent('escapeKey');
        }
        if (e.key === 'ArrowUp') {
            this.processEvent('arrowUp');
        }
        if (e.key === 'ArrowDown') {
            this.processEvent('arrowDown');
        }
        if (e.key === 'f') {
            this.processEvent('F');
        }
        if (e.key === 'g') {
            this.processEvent('G');
        }
        if (e.key === 'q') {
            this.processEvent('Q');
        }
    }

    keyupHandler(e: KeyboardEvent) {
        if (this._keyfirstPressed.has(e.key)) {
            this._keyfirstPressed.delete(e.key);
        }
        if (e.key === ' ') {
            this.processEvent('spacebarUp');
        }
    }

    attach(canvas: HTMLCanvasElement) {
        this.tearDown();
        this._canvas = canvas;
        this.setUp();
    }

    get stateMachine(): StateMachine {
        return this._stateMachine;
    }

    set stateMachine(stateMachine: StateMachine) {
        this._stateMachine = stateMachine;
    }
}
