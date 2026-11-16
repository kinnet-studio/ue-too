/**
 * @packageDocumentation
 * The whiteboard editor for `@ue-too/board`: a document of shapes, a
 * sketchy renderer and drawing tools. Import it from
 * `@ue-too/board/whiteboard`.
 *
 * @remarks
 * It reaches board only through the `@ue-too/board` package name, so it can
 * move into its own package later without changing its imports.
 */

export * from './document/types';
export * from './document/ids';
export * from './document/fractional-index';
export * from './document/document';
export * from './document/history';
export * from './document/snapshot';

export * from './geometry/box';
export * from './geometry/text';
export * from './geometry/bounds';
export * from './geometry/hit-test';
export * from './geometry/simplify';

export * from './render/random';
export * from './render/sketch';
export * from './render/theme';
export * from './render/painter';
export * from './render/overlay';

export * from './editor/events';
export * from './editor/pointer-input';
export * from './editor/selection';
export * from './editor/text-input';
export * from './editor/keyboard';
export {
    type EditorBackground,
    type ToolContext,
    type ToolMachine,
    type ToolOverlay,
    type ToolServices,
    type ToolStateConfig,
    ToolState,
    createToolMachine,
    toolContext,
} from './editor/tool-context';
export {
    type EditorMachineContext,
    createEditorMachine,
} from './editor/editor-machine';
export {
    type HandStates,
    activateBackground,
    createHandTool,
} from './editor/tools/hand';
export { type BoxStates, createBoxTool } from './editor/tools/box-tool';
export {
    type SegmentStates,
    createSegmentTool,
} from './editor/tools/segment-tool';
export { type PenStates, createPenTool } from './editor/tools/pen';
export { type SelectStates, createSelectTool } from './editor/tools/select';
export { type EraserStates, createEraserTool } from './editor/tools/eraser';
export { type PlaceStates, createPlaceTool } from './editor/tools/place-tool';
export { Editor, type EditorOptions, type EditorState } from './editor/editor';
