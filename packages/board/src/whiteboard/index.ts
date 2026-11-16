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

export {
    TOOL_NAMES,
    type PointerSample,
    type ToolName,
    type ToolPointer,
} from './editor/events';
export { PointerInput, type PointerInputDeps } from './editor/pointer-input';
export {
    DomTextInput,
    type TextInput,
    type TextInputSession,
} from './editor/text-input';
export {
    type EditorCommand,
    type KeyLike,
    shortcutFor,
} from './editor/keyboard';
export type { EditorBackground } from './editor/tool-context';
export { Editor, type EditorOptions, type EditorState } from './editor/editor';
