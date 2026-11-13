import { EventArgs } from '@ue-too/being';
import {
    InputOrchestrator,
    KmtInputEventMapping,
    KmtInputStateMachine,
} from '@ue-too/board';
import { KonvaEventObject } from 'konva/lib/Node';
import { Stage } from 'konva/lib/Stage';

export class KonvaInputParser {
    private _stage: Stage;
    private _kmtInputStateMachine: KmtInputStateMachine;
    private _inputOrchestrator: InputOrchestrator;
    private _keyfirstPressed: Map<string, boolean>;
    private _abortController: AbortController;

    constructor(
        stage: Stage,
        kmtInputStateMachine: KmtInputStateMachine,
        inputOrchestrator: InputOrchestrator
    ) {
        this._stage = stage;
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
        this._stage.on('pointerdown', this.pointerDownHandler);
        this._stage.on('pointerup', this.pointerUpHandler);
        this._stage.on('pointermove', this.pointerMoveHandler);
        this._stage.on('wheel', this.scrollHandler);
        window.addEventListener('keydown', this.keydownHandler, {
            signal: this._abortController.signal,
        });
        window.addEventListener('keyup', this.keyupHandler, {
            signal: this._abortController.signal,
        });
    }

    tearDown() {
        this._stage.off('pointerdown', this.pointerDownHandler);
        this._stage.off('pointerup', this.pointerUpHandler);
        this._stage.off('pointermove', this.pointerMoveHandler);
        this._stage.off('wheel', this.scrollHandler);
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

    pointerDownHandler(eventObject: KonvaEventObject<PointerEvent, Stage>) {
        const event = eventObject.evt;
        if (event.button === 0 && event.pointerType === 'mouse') {
            this.processEvent('leftPointerDown', {
                x: event.clientX,
                y: event.clientY,
            });
            return;
        }
        if (event.button === 1 && event.pointerType === 'mouse') {
            this.processEvent('middlePointerDown', {
                x: event.clientX,
                y: event.clientY,
            });
            return;
        }
    }

    pointerUpHandler(eventObject: KonvaEventObject<PointerEvent, Stage>) {
        const e = eventObject.evt;
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

    pointerMoveHandler(eventObject: KonvaEventObject<PointerEvent, Stage>) {
        const e = eventObject.evt;
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

    scrollHandler(eventObject: KonvaEventObject<WheelEvent, Stage>) {
        const e = eventObject.evt;
        // The wheel drives the camera: don't also scroll the page, and don't
        // let a pinch (Ctrl + wheel) zoom the whole browser page.
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

    keydownHandler(event: KeyboardEvent) {
        // Space aimed at the page with the pointer over the stage starts
        // Space + drag panning: keep the page from scrolling, on every key
        // repeat too. Elsewhere, or typed into a field, Space is left alone.
        if (
            event.key === ' ' &&
            event.target === document.body &&
            this._stage.container().matches(':hover')
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
        if (this._keyfirstPressed.has(event.key)) {
            this._keyfirstPressed.delete(event.key);
        }
        if (event.key === ' ') {
            this.processEvent('spacebarUp');
        }
    }
}
