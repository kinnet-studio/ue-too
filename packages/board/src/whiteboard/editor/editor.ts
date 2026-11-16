import type { HostableStateMachine } from '@ue-too/being';
import type { Board } from '@ue-too/board';
import type { Point } from '@ue-too/math';

import { WhiteboardDocument } from '../document/document';
import { History } from '../document/history';
import {
    DEFAULT_STYLE,
    FONT_SIZE,
    type Shape,
    type ShapeStyle,
} from '../document/types';
import { shapeBounds } from '../geometry/bounds';
import { type Box, boxesOverlap } from '../geometry/box';
import { hitShape, shapesInBox } from '../geometry/hit-test';
import type { TextEnv } from '../geometry/text';
import { drawSelectionOverlay } from '../render/overlay';
import { ShapePainter } from '../render/painter';
import { DEFAULT_THEME, type WhiteboardTheme } from '../render/theme';
import {
    type EditorMachineContext,
    createEditorMachine,
} from './editor-machine';
import {
    HIT_TOLERANCE_PX,
    type PointerSample,
    TOOL_NAMES,
    type ToolEvents,
    type ToolName,
} from './events';
import { PointerInput } from './pointer-input';
import { Selection } from './selection';
import type { TextInput } from './text-input';
import {
    type EditorBackground,
    type ToolContext,
    type ToolOverlay,
    type ToolServices,
    createToolMachine,
    toolContext,
} from './tool-context';
import { createBoxTool } from './tools/box-tool';
import { activateBackground, createHandTool } from './tools/hand';
import { createPenTool } from './tools/pen';
import { createSegmentTool } from './tools/segment-tool';

/**
 * How to set up an {@link Editor}.
 *
 * @group Whiteboard Editor
 */
export interface EditorOptions {
    /** The board whose camera the editor draws through */
    board: Board;
    /**
     * The board's canvas. Pointer and key listeners attach to it and its
     * window; leave it out to feed {@link Editor.input} yourself.
     */
    canvas?: HTMLCanvasElement;
    /** The document to edit; a new empty one by default */
    document?: WhiteboardDocument;
    /** Where typing happens while text is edited (see `DomTextInput`) */
    textInput?: TextInput;
    /** Holds the text-editing overlay; the canvas's parent by default */
    overlayParent?: HTMLElement;
    theme?: Partial<WhiteboardTheme>;
    background?: EditorBackground;
    /** The tool picked at the start; `'hand'` by default */
    initialTool?: ToolName;
    /** Makes an empty path; `new Path2D()` by default (for hosts without Path2D) */
    createPath?: () => Path2D;
}

/**
 * What a toolbar needs to show.
 *
 * @group Whiteboard Editor
 */
export interface EditorState {
    tool: ToolName;
    selection: readonly string[];
    /** The style the next shape gets */
    style: ShapeStyle;
    /** The style values every selected shape shares, or null with nothing selected */
    selectionStyle: Partial<ShapeStyle> | null;
    canUndo: boolean;
    canRedo: boolean;
    empty: boolean;
    editingText: boolean;
}

// Shapes are drawn when they come within this many screen pixels of the
// view, so sketchy wobble at the edge isn't cut off
const CULL_MARGIN_PX = 16;

function sameState(a: EditorState, b: EditorState): boolean {
    return (
        a.tool === b.tool &&
        a.canUndo === b.canUndo &&
        a.canRedo === b.canRedo &&
        a.empty === b.empty &&
        a.editingText === b.editingText &&
        a.selection.length === b.selection.length &&
        a.selection.every((id, i) => id === b.selection[i]) &&
        JSON.stringify(a.style) === JSON.stringify(b.style) &&
        JSON.stringify(a.selectionStyle) === JSON.stringify(b.selectionStyle)
    );
}

/**
 * A whiteboard editor on a `@ue-too/board` board: tools, selection, undo,
 * and drawing the document each frame.
 *
 * @remarks
 * Each tool is a `@ue-too/being` state machine, hosted by an editor machine
 * with one state per tool. The editor works beside the board's own gestures:
 * scroll and Ctrl + scroll zoom, Space + drag and middle-drag pan, two
 * fingers pinch and pan; while the board is in one of them, tools stand
 * aside. The app keeps its frame loop and calls {@link Editor.draw} after
 * drawing its own background.
 *
 * @example
 * ```ts
 * const board = new Board(canvas);
 * const editor = new Editor({ board, canvas });
 * editor.setTool('pen');
 * function frame(timestamp: number) {
 *     board.step(timestamp);
 *     if (board.context) editor.draw(board.context);
 *     requestAnimationFrame(frame);
 * }
 * requestAnimationFrame(frame);
 * ```
 *
 * @group Whiteboard Editor
 */
export class Editor {
    readonly document: WhiteboardDocument;
    readonly history: History;
    readonly input: PointerInput;

    protected readonly _board: Board;
    protected readonly _canvas: HTMLCanvasElement | undefined;
    protected readonly _selection = new Selection();
    protected readonly _overlay: ToolOverlay = {
        marquee: null,
        erasing: new Set(),
    };
    protected readonly _services: ToolServices;
    protected readonly _env: TextEnv;
    protected _style: ShapeStyle = { ...DEFAULT_STYLE };
    protected _theme: WhiteboardTheme;
    protected _editingId: string | null = null;
    protected _textInput: TextInput | undefined;

    private readonly _machine: ReturnType<typeof createEditorMachine>;
    private readonly _machineContext: EditorMachineContext;
    private readonly _painter: ShapePainter;
    private readonly _background: Required<EditorBackground>;
    private readonly _listeners = new Set<(state: EditorState) => void>();
    private readonly _cleanup: (() => void)[] = [];
    private _bounds = new WeakMap<Shape, Box>();
    private _toolCursor = 'default';
    private _cursorOverride: string | null = null;
    private _pendingTool: { tool: ToolName; select?: string[] } | null = null;
    private _lastState: EditorState;
    private _destroyed = false;

    constructor(options: EditorOptions) {
        this._board = options.board;
        this._canvas = options.canvas;
        this.document = options.document ?? new WhiteboardDocument();
        this.history = new History(this.document);
        this._theme = { ...DEFAULT_THEME, ...options.theme };
        this._painter = new ShapePainter({ createPath: options.createPath });
        this._textInput = options.textInput;
        this._background = {
            hitTest:
                options.background?.hitTest?.bind(options.background) ??
                (() => false),
            activate:
                options.background?.activate?.bind(options.background) ??
                (() => {}),
            ownsPointer:
                options.background?.ownsPointer?.bind(options.background) ??
                (() => false),
        };
        this._env = this.createTextEnv();
        this._services = this.createServices();
        this.input = new PointerInput({
            toWorld: client => this.toWorld(client),
            boardBusy: () =>
                (this._board.kmtInputStateMachine?.currentState ?? 'IDLE') !==
                'IDLE',
            ownsPointer: client => this._background.ownsPointer(client),
            dispatch: (event, payload) => this.dispatch(event, payload),
            middleClick: pointer => {
                if (this.tool === 'hand' || this.tool === 'select') {
                    activateBackground(this._services, pointer);
                }
            },
            setCursor: cursor => {
                this._cursorOverride = cursor;
                this.applyCursor();
            },
        });
        const initial = options.initialTool ?? 'hand';
        this._machineContext = {
            requestedTool: initial,
            setup() {},
            cleanup() {},
        };
        this._machine = createEditorMachine(
            this.createToolMachines(),
            this._machineContext,
            initial
        );
        this._lastState = this.computeState();

        this._cleanup.push(
            this.document.subscribe(() => {
                this._selection.prune(this.document);
                this.emit();
            }),
            this.history.subscribe(() => this.emit()),
            this._selection.subscribe(() => this.emit())
        );
        if (this._canvas) this.listen(this._canvas);
    }

    /** The tool in use */
    get tool(): ToolName {
        return this._machine.currentState as ToolName;
    }

    /** Switches tools, abandoning any gesture under way */
    setTool(tool: ToolName): void {
        if (tool === this.tool) return;
        this.cancelGesture();
        this.switchTool(tool);
        this.emit();
    }

    /** Converts a window point (CSS pixels) to world coordinates */
    toWorld(client: Point): Point {
        return this._board.convertWindowPoint2WorldCoord(client);
    }

    /** Replaces parts of the theme (after a light/dark switch, say) */
    setTheme(theme: Partial<WhiteboardTheme>): void {
        this._theme = { ...this._theme, ...theme };
        // Text measures with the theme's font
        this._bounds = new WeakMap();
    }

    getTheme(): WhiteboardTheme {
        return this._theme;
    }

    getState(): EditorState {
        return this._lastState;
    }

    /**
     * Listens for changes to {@link EditorState}; called only when something
     * in it changed.
     *
     * @returns A function that stops the listener
     */
    subscribe(listener: (state: EditorState) => void): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    /**
     * Draws the document and the selection overlay. Call it each frame with
     * the board's context, after the board's `step` and your own background.
     */
    draw(ctx: CanvasRenderingContext2D): void {
        const zoom = this._board.camera.zoomLevel;
        const view = this.visibleBox(CULL_MARGIN_PX / zoom);
        for (const shape of this.document.all()) {
            if (!boxesOverlap(this.bounds(shape), view)) continue;
            this._painter.paint(ctx, shape, this._theme, this._env, {
                faded: this._overlay.erasing.has(shape.id),
                hideText: shape.id === this._editingId,
            });
        }
        drawSelectionOverlay(
            ctx,
            {
                ...this.selectionOverlay(),
                marquee: this._overlay.marquee,
                zoom,
            },
            this._theme
        );
    }

    /** Takes back your last change, abandoning any gesture under way first */
    undo(): void {
        this.cancelGesture();
        this.history.undo();
    }

    /** Puts back the last change you undid */
    redo(): void {
        this.cancelGesture();
        this.history.redo();
    }

    /** Removes the editor's listeners; the document is left as it is */
    destroy(): void {
        this._destroyed = true;
        this.cancelGesture();
        for (const stop of this._cleanup) stop();
        this._cleanup.length = 0;
        this._listeners.clear();
        this.history.dispose();
    }

    /** The world box a shape covers, cached per record */
    protected bounds(shape: Shape): Box {
        let box = this._bounds.get(shape);
        if (!box) {
            box = shapeBounds(shape, this._env);
            this._bounds.set(shape, box);
        }
        return box;
    }

    /** The selection box and handles to draw (none until shapes can be selected) */
    protected selectionOverlay(): { selection: Box | null; handles: [] } {
        return { selection: null, handles: [] };
    }

    protected computeState(): EditorState {
        return {
            tool: this.tool,
            selection: this._selection.ids,
            style: { ...this._style },
            selectionStyle: null,
            canUndo: this.history.canUndo,
            canRedo: this.history.canRedo,
            empty: this.document.size === 0,
            editingText: this._editingId !== null,
        };
    }

    /** Tells listeners when the state changed */
    protected emit(): void {
        if (this._destroyed) return;
        const state = this.computeState();
        if (sameState(state, this._lastState)) return;
        this._lastState = state;
        for (const listener of [...this._listeners]) listener(state);
    }

    /** Abandons the gesture under way, if any */
    protected cancelGesture(): void {
        if (this.input.pressed) this.input.cancel();
        else this.dispatch('cancel', {});
        if (this.history.open) this.history.cancel();
    }

    /** Starts editing a text shape's or note's text */
    protected editText(_id: string): void {}

    private dispatch(event: keyof ToolEvents, payload: unknown): void {
        (this._machine.happens as (event: string, payload: unknown) => unknown)(
            event,
            payload
        );
        const pending = this._pendingTool;
        if (pending) {
            this._pendingTool = null;
            this.switchTool(pending.tool);
            if (pending.select) this._selection.set(pending.select);
        }
        this.emit();
    }

    private switchTool(tool: ToolName): void {
        this._overlay.marquee = null;
        this._overlay.erasing.clear();
        this._machineContext.requestedTool = tool;
        (this._machine.happens as (event: string, payload: unknown) => unknown)(
            'pickTool',
            {}
        );
    }

    private createServices(): ToolServices {
        return {
            doc: this.document,
            history: this.history,
            env: this._env,
            zoom: () => this._board.camera.zoomLevel,
            panByScreen: delta =>
                this._board.getCameraRig().panByViewPort(delta),
            shapeAt: world => {
                const tolerance =
                    HIT_TOLERANCE_PX / this._board.camera.zoomLevel;
                const shapes = this.document.all();
                for (let i = shapes.length - 1; i >= 0; i--) {
                    if (hitShape(shapes[i]!, world, tolerance, this._env))
                        return shapes[i]!;
                }
                return null;
            },
            shapesInBox: box =>
                shapesInBox(this.document.all(), box, this._env),
            background: this._background,
            selection: this._selection,
            style: () => this._style,
            setCursor: cursor => {
                this._toolCursor = cursor;
                this.applyCursor();
            },
            requestTool: (tool, select) => {
                this._pendingTool = { tool, select };
            },
            editText: id => this.editText(id),
            overlay: this._overlay,
        };
    }

    /** One machine per tool; later tasks fill in the ones still idle */
    protected createToolMachines(): Record<ToolName, HostableStateMachine> {
        const machines = {} as Record<ToolName, HostableStateMachine>;
        for (const name of TOOL_NAMES) {
            machines[name] = this.createToolMachine(
                name,
                toolContext(this._services)
            );
        }
        return machines;
    }

    protected createToolMachine(
        name: ToolName,
        context: ToolContext
    ): HostableStateMachine {
        switch (name) {
            case 'hand':
                return createHandTool(context);
            case 'rect':
            case 'ellipse':
                return createBoxTool(context, name);
            case 'arrow':
            case 'line':
                return createSegmentTool(context, name);
            case 'pen':
                return createPenTool(context);
            default:
                return createToolMachine(
                    context,
                    { IDLE: { reactions: {} } },
                    'IDLE'
                );
        }
    }

    private createTextEnv(): TextEnv {
        const theme = () => this._theme;
        const measurer = this._canvas?.ownerDocument
            .createElement('canvas')
            .getContext('2d');
        const measure = measurer
            ? (text: string, font: string) => {
                  measurer.font = font;
                  return measurer.measureText(text).width;
              }
            : (text: string, font: string) =>
                  text.length *
                  parseFloat(font.split(' ')[1] ?? `${FONT_SIZE.m}`) *
                  0.5;
        return {
            measure,
            get family() {
                return theme().fonts.hand;
            },
        };
    }

    private visibleBox(margin: number): Box {
        const camera = this._board.camera;
        const hw = camera.viewPortWidth / 2;
        const hh = camera.viewPortHeight / 2;
        const corners = [
            { x: -hw, y: -hh },
            { x: hw, y: -hh },
            { x: hw, y: hh },
            { x: -hw, y: hh },
        ].map(corner => camera.convertFromViewPort2WorldSpace(corner));
        const xs = corners.map(c => c.x);
        const ys = corners.map(c => c.y);
        const x = Math.min(...xs) - margin;
        const y = Math.min(...ys) - margin;
        return {
            x,
            y,
            w: Math.max(...xs) + margin - x,
            h: Math.max(...ys) + margin - y,
        };
    }

    private applyCursor(): void {
        if (this._canvas)
            this._canvas.style.cursor =
                this._cursorOverride ?? this._toolCursor;
    }

    private listen(canvas: HTMLCanvasElement): void {
        const view = canvas.ownerDocument.defaultView;
        const sample = (e: PointerEvent): PointerSample => ({
            id: e.pointerId,
            pointerType:
                e.pointerType === 'touch' || e.pointerType === 'pen'
                    ? e.pointerType
                    : 'mouse',
            button: e.button,
            client: { x: e.clientX, y: e.clientY },
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            altKey: e.altKey,
            timeStamp: e.timeStamp,
        });
        const down = (e: PointerEvent) => {
            try {
                canvas.setPointerCapture(e.pointerId);
            } catch {
                // Synthetic events can't be captured; the gesture still works
            }
            this.input.down(sample(e));
        };
        const move = (e: PointerEvent) => this.input.move(sample(e));
        const up = (e: PointerEvent) => this.input.up(sample(e));
        const cancel = () => this.input.cancel();
        const lost = (e: PointerEvent) => this.input.lostCapture(e.pointerId);
        // The board only records touches while two fingers are down. Keep its
        // record of a one-finger gesture current, so a second finger landing
        // mid-gesture isn't read as a pinch spanning the whole gesture
        const touchMove = (e: TouchEvent) => {
            const machine = this._board.touchInputStateMachine;
            if (!machine || machine.currentState !== 'IDLE') return;
            machine.context.updateTouchPoints(
                [...e.targetTouches].map(t => ({
                    ident: t.identifier,
                    x: t.clientX,
                    y: t.clientY,
                }))
            );
        };
        canvas.addEventListener('pointerdown', down);
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', cancel);
        canvas.addEventListener('lostpointercapture', lost);
        canvas.addEventListener('touchmove', touchMove, { passive: true });
        view?.addEventListener('blur', cancel);
        this._cleanup.push(() => {
            canvas.removeEventListener('pointerdown', down);
            canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', up);
            canvas.removeEventListener('pointercancel', cancel);
            canvas.removeEventListener('lostpointercapture', lost);
            canvas.removeEventListener('touchmove', touchMove);
            view?.removeEventListener('blur', cancel);
        });
        this.applyCursor();
    }
}
