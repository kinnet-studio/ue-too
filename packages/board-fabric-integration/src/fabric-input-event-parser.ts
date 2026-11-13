import { EventArgs } from '@ue-too/being';
import {
    InputOrchestrator,
    KmtInputEventMapping,
    KmtInputStateMachine,
} from '@ue-too/board';
import { StaticCanvas, TPointerEventInfo } from 'fabric';

export class FabricInputEventParser {
    private _fabricCanvas: StaticCanvas;
    private _kmtInputStateMachine: KmtInputStateMachine;
    private _inputOrchestrator: InputOrchestrator;
    private _keyfirstPressed: Map<string, boolean>;
    private _abortController: AbortController;
    private _disabled: boolean = false;

    constructor(
        fabricCanvas: StaticCanvas,
        kmtInputStateMachine: KmtInputStateMachine,
        inputOrchestrator: InputOrchestrator
    ) {
        this._fabricCanvas = fabricCanvas;
        this._kmtInputStateMachine = kmtInputStateMachine;
        this._inputOrchestrator = inputOrchestrator;
        this._keyfirstPressed = new Map();
        this.bindFunctions();
        this._abortController = new AbortController();
    }

    bindFunctions() {
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
        this.pointerUpHandler = this.pointerUpHandler.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
        this.scrollHandler = this.scrollHandler.bind(this);
        this.keydownHandler = this.keydownHandler.bind(this);
        this.keyupHandler = this.keyupHandler.bind(this);
    }

    setUp() {
        this._fabricCanvas.on('mouse:down', this.pointerDownHandler);
        this._fabricCanvas.on('mouse:up', this.pointerUpHandler);
        this._fabricCanvas.on('mouse:move', this.pointerMoveHandler);
        this._fabricCanvas.on('mouse:wheel', this.scrollHandler);
        window.addEventListener('keydown', this.keydownHandler, {
            signal: this._abortController.signal,
        });
        window.addEventListener('keyup', this.keyupHandler, {
            signal: this._abortController.signal,
        });
    }

    tearDown() {
        this._fabricCanvas.off('mouse:down', this.pointerDownHandler);
        this._fabricCanvas.off('mouse:up', this.pointerUpHandler);
        this._fabricCanvas.off('mouse:move', this.pointerMoveHandler);
        this._fabricCanvas.off('mouse:wheel', this.scrollHandler);
        this._abortController.abort();
        this._abortController = new AbortController();
    }

    private processEvent<K extends keyof KmtInputEventMapping>(
        ...args: EventArgs<KmtInputEventMapping, K>
    ): void {
        const result = this._kmtInputStateMachine.happens(...args);
        if (result.handled && 'output' in result) {
            this._inputOrchestrator.processInputEventOutput(result.output);
        }
    }

    pointerDownHandler(
        event: TPointerEventInfo & { alreadySelected: boolean }
    ) {
        console.log('pointerDownHandler', event);
        event.e.preventDefault();
        const nativeEvent = event.e;
        // Only handle mouse events, not touch events
        if (!(nativeEvent instanceof MouseEvent)) {
            return;
        }
        if (nativeEvent.button === 0) {
            this.processEvent('leftPointerDown', {
                x: nativeEvent.clientX,
                y: nativeEvent.clientY,
            });
            return;
        }
        if (nativeEvent.button === 1) {
            this.processEvent('middlePointerDown', {
                x: nativeEvent.clientX,
                y: nativeEvent.clientY,
            });
            return;
        }
    }

    disable() {
        this._disabled = true;
    }

    enable() {
        this._disabled = false;
    }

    get disabled(): boolean {
        return this._disabled;
    }

    pointerUpHandler(event: TPointerEventInfo & { isClick: boolean }) {
        if (this._disabled) {
            return;
        }
        const nativeEvent = event.e;
        // Only handle mouse events, not touch events
        if (!(nativeEvent instanceof MouseEvent)) {
            return;
        }
        if (nativeEvent.button === 0) {
            this.processEvent('leftPointerUp', {
                x: nativeEvent.clientX,
                y: nativeEvent.clientY,
            });
            return;
        }
        if (nativeEvent.button === 1) {
            this.processEvent('middlePointerUp', {
                x: nativeEvent.clientX,
                y: nativeEvent.clientY,
            });
            return;
        }
    }

    pointerMoveHandler(event: TPointerEventInfo) {
        if (this._disabled) {
            return;
        }
        const nativeEvent = event.e;
        // Only handle mouse events, not touch events
        if (!(nativeEvent instanceof MouseEvent)) {
            return;
        }
        if (nativeEvent.buttons === 1) {
            this.processEvent('leftPointerMove', {
                x: nativeEvent.clientX,
                y: nativeEvent.clientY,
            });
            return;
        }
        if (nativeEvent.buttons === 4) {
            this.processEvent('middlePointerMove', {
                x: nativeEvent.clientX,
                y: nativeEvent.clientY,
            });
            return;
        }
        this.processEvent('pointerMove', {
            x: nativeEvent.clientX,
            y: nativeEvent.clientY,
        });
    }

    scrollHandler(event: TPointerEventInfo<WheelEvent>) {
        if (this._disabled) {
            return;
        }
        const nativeEvent = event.e;
        // The wheel drives the camera: don't also scroll the page, and don't
        // let a pinch (Ctrl + wheel) zoom the whole browser page.
        nativeEvent.preventDefault();
        if (nativeEvent.ctrlKey) {
            this.processEvent('scrollWithCtrl', {
                x: nativeEvent.clientX,
                y: nativeEvent.clientY,
                deltaX: nativeEvent.deltaX,
                deltaY: nativeEvent.deltaY,
            });
        } else {
            this.processEvent('scroll', {
                x: nativeEvent.clientX,
                y: nativeEvent.clientY,
                deltaX: nativeEvent.deltaX,
                deltaY: nativeEvent.deltaY,
            });
        }
    }

    /** The element the pointer is over when it is over the canvas: an
     *  interactive Fabric canvas stacks two `<canvas>` layers in a wrapper. */
    private get pointerTarget(): Element {
        const canvas = this._fabricCanvas;
        return 'wrapperEl' in canvas
            ? (canvas.wrapperEl as Element)
            : canvas.getElement();
    }

    keydownHandler(event: KeyboardEvent) {
        if (this._disabled) {
            return;
        }
        // Space aimed at the page with the pointer over the canvas starts
        // Space + drag panning: keep the page from scrolling, on every key
        // repeat too. Elsewhere, or typed into a field, Space is left alone.
        if (
            event.key === ' ' &&
            event.target === document.body &&
            this.pointerTarget.matches(':hover')
        ) {
            event.preventDefault();
        }
        if (this._keyfirstPressed.has(event.key)) {
            return;
        }
        this._keyfirstPressed.set(event.key, true);
        if (event.key === ' ') {
            this.processEvent('spacebarDown');
        }
    }

    keyupHandler(event: KeyboardEvent) {
        if (this._disabled) {
            return;
        }
        if (this._keyfirstPressed.has(event.key)) {
            this._keyfirstPressed.delete(event.key);
        }
        if (event.key === ' ') {
            this.processEvent('spacebarUp');
        }
    }
}
