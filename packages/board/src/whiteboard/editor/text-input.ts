import type { Box } from '../geometry/box';

/**
 * One text-editing session: where the text sits and what to report back.
 *
 * @group Whiteboard Editor
 */
export interface TextInputSession {
    text: string;
    /** CSS font at zoom 1 */
    font: string;
    color: string;
    /** In CSS pixels at zoom 1 */
    lineHeight: number;
    /** Where the text sits, in CSS pixels relative to the overlay parent */
    rect: Box;
    /** Camera zoom */
    scale: number;
    /** Notes wrap to their width; text shapes grow to fit */
    wrap: boolean;
    onInput(text: string): void;
    onCommit(text: string): void;
}

/**
 * Where typing happens while a text shape or note is edited. The editor
 * ships a `<textarea>` overlay (`DomTextInput`); tests and other hosts can
 * supply their own.
 *
 * @group Whiteboard Editor
 */
export interface TextInput {
    open(session: TextInputSession): void;
    /** Follows the camera while editing */
    reposition(rect: Box, scale: number): void;
    /** Ends editing, committing the text */
    close(): void;
    readonly active: boolean;
}
