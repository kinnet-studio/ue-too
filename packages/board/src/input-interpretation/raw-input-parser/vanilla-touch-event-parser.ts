import { EventArgs } from '@ue-too/being';

import { TouchPoints } from '../../input-interpretation/input-state-machine/touch-input-context';
import {
    TouchEventMapping,
    TouchInputStateMachine,
} from '../../input-interpretation/input-state-machine/touch-input-state-machine';
import type { InputOrchestrator } from '../input-orchestrator';
import type { StateMachine } from './vanilla-kmt-event-parser';

/**
 * Interface for touch event parsers.
 *
 * @remarks
 * Touch event parsers bridge DOM TouchEvents and the touch state machine.
 * They provide granular control over which gesture types are enabled.
 *
 * @category Raw Input Parser
 */
export interface TouchEventParser {
    /** Whether all touch input is disabled */
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
     * remain valid, but note this member is typed to the full
     * `TouchInputStateMachine` — unlike
     * {@link KMTEventParser.stateMachine}'s minimal `{ happens }` contract,
     * an external implementation is more likely to need adjustment to
     * satisfy this member's shape. Intended for tooling/introspection —
     * dispatch through the parser, not through this reference.
     *
     * {@link VanillaTouchEventParser} can drive any machine that takes
     * {@link TouchEventMapping} events, such as the one from
     * {@link createOneFingerPanTouchInputStateMachine}. It still reports that
     * machine through this member's stock type, so keep your own reference
     * when you need its real type.
     */
    readonly stateMachine?: TouchInputStateMachine;
}

/**
 * DOM event parser for touch input.
 *
 * @remarks
 * This parser converts raw DOM TouchEvents into state machine events and coordinates
 * with the orchestrator to process outputs. It serves as the entry point for all touch
 * input in the input interpretation pipeline.
 *
 * **Event Flow**:
 * ```
 * DOM TouchEvents → Parser → State Machine → Parser → Orchestrator → Camera/Observers
 * ```
 *
 * **Responsibilities**:
 * 1. Listen for DOM touch events (touchstart/move/end/cancel)
 * 2. Extract touch point data (identifier, x, y)
 * 3. Convert to state machine event format
 * 4. Send events to the state machine
 * 5. Forward state machine outputs to the orchestrator
 *
 * **Touch Point Extraction**:
 * - touchstart/touchend: Uses `changedTouches` (only new/removed touches)
 * - touchmove: Uses `targetTouches` (all touches on the canvas)
 *
 * **Gesture Control**:
 * Individual gesture types (pan, zoom, rotate) can be disabled independently,
 * though currently the state machine outputs are filtered by the orchestrator
 * rather than the parser.
 *
 * The parser prevents default touch behavior to avoid browser scroll/zoom
 * interfering with canvas gestures.
 *
 * **State Machine**:
 * Any machine that takes {@link TouchEventMapping} events works: the default
 * from {@link createTouchInputStateMachine}, the one-finger-pan one from
 * {@link createOneFingerPanTouchInputStateMachine}, or an expanded machine.
 * The {@link stateMachine} getter keeps its stock type for compatibility, so
 * hold on to your own reference to a non-stock machine.
 *
 * @category Raw Input Parser
 *
 * @example
 * ```typescript
 * const canvasElement = document.getElementById("canvas");
 * const stateMachine = createTouchInputStateMachine(context);
 * const orchestrator = new InputOrchestrator(cameraMux, cameraRig, publisher);
 * const parser = new VanillaTouchEventParser(stateMachine, orchestrator, canvasElement);
 *
 * parser.setUp(); // Starts listening for touch events
 *
 * // Disable zoom gestures temporarily
 * parser.zoomDisabled = true;
 *
 * // Cleanup when done
 * parser.tearDown();
 * ```
 */
export class VanillaTouchEventParser implements TouchEventParser {
    private _canvas?: HTMLCanvasElement | SVGSVGElement;
    private _disabled: boolean;
    private _panDisabled: boolean = false;
    private _zoomDisabled: boolean = false;
    private _rotateDisabled: boolean = false;

    private _stateMachine: StateMachine;
    private _orchestrator: InputOrchestrator;

    private _abortController: AbortController;

    /**
     * @param touchInputStateMachine - Any machine that takes
     * {@link TouchEventMapping} events, e.g. from
     * {@link createTouchInputStateMachine} or
     * {@link createOneFingerPanTouchInputStateMachine}
     * @param orchestrator - Receives the machine's outputs
     * @param canvas - The element to listen on; can be attached later
     */
    constructor(
        touchInputStateMachine: StateMachine,
        orchestrator: InputOrchestrator,
        canvas?: HTMLCanvasElement | SVGSVGElement
    ) {
        this._canvas = canvas;
        this._disabled = false;
        this._stateMachine = touchInputStateMachine;
        this._orchestrator = orchestrator;
        this._abortController = new AbortController();

        this.bindListeners();
    }

    get orchestrator(): InputOrchestrator {
        return this._orchestrator;
    }

    /**
     * The machine this parser dispatches into.
     *
     * @remarks
     * Typed as the stock {@link TouchInputStateMachine} for compatibility,
     * even when the parser was built with a different machine (such as one
     * from {@link createOneFingerPanTouchInputStateMachine}). Keep your own
     * reference when you need that machine's real type.
     */
    get stateMachine(): TouchInputStateMachine {
        return this._stateMachine as TouchInputStateMachine;
    }

    bindListeners(): void {
        this.touchstartHandler = this.touchstartHandler.bind(this);
        this.touchendHandler = this.touchendHandler.bind(this);
        this.touchcancelHandler = this.touchcancelHandler.bind(this);
        this.touchmoveHandler = this.touchmoveHandler.bind(this);
    }

    enableStrategy(): void {
        this._disabled = false;
    }

    disableStrategy(): void {
        this._disabled = true;
    }

    setUp(): void {
        if (this._canvas == undefined) {
            return;
        }
        if (this._abortController.signal.aborted) {
            this._abortController = new AbortController();
        }
        this._canvas.addEventListener(
            'touchstart',
            this.touchstartHandler as EventListener,
            { signal: this._abortController.signal }
        );
        this._canvas.addEventListener(
            'touchend',
            this.touchendHandler as EventListener,
            { signal: this._abortController.signal }
        );
        this._canvas.addEventListener(
            'touchcancel',
            this.touchcancelHandler as EventListener,
            { signal: this._abortController.signal }
        );
        this._canvas.addEventListener(
            'touchmove',
            this.touchmoveHandler as EventListener,
            { signal: this._abortController.signal }
        );
    }

    tearDown(): void {
        this._abortController.abort();
        this._abortController = new AbortController();
        this._canvas = undefined;
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

    private processEvent<K extends keyof TouchEventMapping>(
        ...args: EventArgs<TouchEventMapping, K>
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

    touchstartHandler(e: TouchEvent) {
        if (this._disabled) {
            return;
        }

        const pointsAdded: TouchPoints[] = [];
        for (let i = 0; i < e.changedTouches.length; i++) {
            pointsAdded.push({
                ident: e.changedTouches[i].identifier,
                x: e.changedTouches[i].clientX,
                y: e.changedTouches[i].clientY,
            });
        }
        this.processEvent('touchstart', { points: pointsAdded });
        e.preventDefault();
    }

    touchcancelHandler(e: TouchEvent) {
        if (this._disabled) {
            return;
        }
        const pointsRemoved: TouchPoints[] = [];
        for (let i = 0; i < e.changedTouches.length; i++) {
            pointsRemoved.push({
                ident: e.changedTouches[i].identifier,
                x: e.changedTouches[i].clientX,
                y: e.changedTouches[i].clientY,
            });
        }
        this.processEvent('touchend', { points: pointsRemoved });
    }

    touchendHandler(e: TouchEvent) {
        if (this._disabled) {
            return;
        }
        const pointsRemoved: TouchPoints[] = [];
        for (let i = 0; i < e.changedTouches.length; i++) {
            pointsRemoved.push({
                ident: e.changedTouches[i].identifier,
                x: e.changedTouches[i].clientX,
                y: e.changedTouches[i].clientY,
            });
        }
        this.processEvent('touchend', { points: pointsRemoved });
    }

    touchmoveHandler(e: TouchEvent) {
        if (this._disabled) {
            return;
        }
        e.preventDefault();
        const pointsMoved: TouchPoints[] = [];
        for (let i = 0; i < e.targetTouches.length; i++) {
            pointsMoved.push({
                ident: e.targetTouches[i].identifier,
                x: e.targetTouches[i].clientX,
                y: e.targetTouches[i].clientY,
            });
        }
        this.processEvent('touchmove', { points: pointsMoved });
    }

    attach(canvas: HTMLCanvasElement) {
        this.tearDown();
        this._canvas = canvas;
        this.setUp();
    }
}
