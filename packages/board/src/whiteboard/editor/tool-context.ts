import {
    type BaseContext,
    type EventReactions,
    TemplateState,
    TemplateStateMachine,
} from '@ue-too/being';
import type { Point } from '@ue-too/math';

import type { WhiteboardDocument } from '../document/document';
import type { History } from '../document/history';
import type { Shape, ShapeStyle } from '../document/types';
import type { Box } from '../geometry/box';
import type { TextEnv } from '../geometry/text';
import type { ToolEvents, ToolName, ToolPointer } from './events';
import type { Selection } from './selection';

/**
 * Clickable things an app puts under or over the drawing.
 *
 * @group Whiteboard Editor
 */
export interface EditorBackground {
    /**
     * Whether there is something clickable at this world point under the
     * drawing (the hand and select tools only). A shape on top wins.
     */
    hitTest?(world: Point): boolean;
    /** A click (no drag) landed on a spot `hitTest` claimed */
    activate?(world: Point, pointer: ToolPointer): void;
    /**
     * Whether the app's own screen-space controls take presses at this
     * window point, whatever the tool
     */
    ownsPointer?(client: Point): boolean;
}

/**
 * Transient things tools show that aren't shapes.
 *
 * @group Whiteboard Editor
 */
export interface ToolOverlay {
    /** The rubber band being dragged */
    marquee: Box | null;
    /** Shapes the eraser has marked */
    erasing: Set<string>;
}

/**
 * Everything a tool can use: the document, its history, the camera and the
 * editor's state.
 *
 * @group Whiteboard Editor
 */
export interface ToolServices {
    doc: WhiteboardDocument;
    history: History;
    env: TextEnv;
    zoom(): number;
    panByScreen(delta: Point): void;
    /** The topmost shape a world point hits */
    shapeAt(world: Point): Shape | null;
    /** The shapes lying entirely inside a box */
    shapesInBox(box: Box): Shape[];
    /** The shapes whose bounds overlap a box: a cheap first pass before hit-testing */
    shapesNear(box: Box): Shape[];
    background: Required<Pick<EditorBackground, 'hitTest' | 'activate'>>;
    selection: Selection;
    /** The style the next shape gets */
    style(): ShapeStyle;
    setCursor(cursor: string): void;
    /** Switches tools once the current event is handled, optionally selecting shapes */
    requestTool(tool: ToolName, select?: string[]): void;
    /** Starts editing a text shape's or note's text */
    editText(id: string): void;
    overlay: ToolOverlay;
}

/**
 * The context every tool machine runs with.
 *
 * @group Whiteboard Editor
 */
export type ToolContext = ToolServices & BaseContext;

/**
 * Gives a tool machine its own context object over the shared services.
 *
 * @group Whiteboard Editor
 */
export function toolContext(services: ToolServices): ToolContext {
    return Object.assign(Object.create(services) as ToolServices, {
        setup() {},
        cleanup() {},
    });
}

/**
 * How one state of a tool reacts, plus optional routing by guards.
 *
 * @group Whiteboard Editor
 */
export interface ToolStateConfig<S extends string> {
    reactions: Partial<EventReactions<ToolEvents, ToolContext, S>>;
    /** Named checks for {@link ToolStateConfig.routes} */
    guards?: Record<string, (context: ToolContext) => boolean>;
    /** For an event, the first route whose guard passes picks the next state */
    routes?: Partial<Record<keyof ToolEvents, { guard: string; target: S }[]>>;
    enter?(context: ToolContext): void;
    exit?(context: ToolContext): void;
}

/**
 * A tool state built from a {@link ToolStateConfig}.
 *
 * @group Whiteboard Editor
 */
export class ToolState<S extends string> extends TemplateState<
    ToolEvents,
    ToolContext,
    S
> {
    constructor(private readonly _config: ToolStateConfig<S>) {
        super();
        this._eventReactions = _config.reactions as EventReactions<
            ToolEvents,
            ToolContext,
            S
        >;
        if (_config.guards) this._guards = _config.guards;
        if (_config.routes) {
            this._eventGuards = _config.routes as typeof this._eventGuards;
        }
    }

    uponEnter(context: ToolContext): void {
        this._config.enter?.(context);
    }

    beforeExit(context: ToolContext): void {
        this._config.exit?.(context);
    }
}

/**
 * A tool's state machine.
 *
 * @group Whiteboard Editor
 */
export type ToolMachine<S extends string = string> = TemplateStateMachine<
    ToolEvents,
    ToolContext,
    S
>;

/**
 * Builds a tool machine from one config per state, starting in `initial`.
 *
 * @group Whiteboard Editor
 */
export function createToolMachine<S extends string>(
    context: ToolContext,
    states: Record<S, ToolStateConfig<S>>,
    initial: S
): ToolMachine<S> {
    const built = {} as Record<S, ToolState<S>>;
    for (const name of Object.keys(states) as S[]) {
        built[name] = new ToolState(states[name]);
    }
    return new TemplateStateMachine<ToolEvents, ToolContext, S>(
        built,
        initial,
        context
    );
}
