import type { ToolName } from './events';

/**
 * Something a key press asks the editor to do.
 *
 * @group Whiteboard Editor
 */
export type EditorCommand =
    | { type: 'tool'; tool: ToolName }
    | { type: 'delete' }
    | { type: 'escape' }
    | { type: 'undo' }
    | { type: 'redo' }
    | { type: 'selectAll' };

/**
 * The parts of a `KeyboardEvent` shortcuts look at.
 *
 * @group Whiteboard Editor
 */
export interface KeyLike {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    isComposing?: boolean;
    target: EventTarget | null;
}

const TOOL_KEYS: Record<string, ToolName> = {
    h: 'hand',
    v: 'select',
    r: 'rect',
    o: 'ellipse',
    a: 'arrow',
    l: 'line',
    p: 'pen',
    t: 'text',
    n: 'note',
    e: 'eraser',
};

const TYPING =
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function isTyping(target: EventTarget | null): boolean {
    const element = target as {
        closest?: (selector: string) => unknown;
    } | null;
    return (
        typeof element?.closest === 'function' &&
        element.closest(TYPING) !== null
    );
}

/**
 * The command a key press stands for, or null.
 *
 * @remarks
 * Tool letters (H V R O A L P T N E), Delete or Backspace, Escape, and
 * Ctrl/Cmd + Z, Ctrl/Cmd + Shift + Z, Ctrl + Y, Ctrl/Cmd + A. Nothing fires
 * while the person is typing (in a field, a `contenteditable`, or mid IME
 * composition), and any other key with Ctrl, Cmd or Alt is left to the
 * browser. Space is the board's own temporary pan.
 *
 * @group Whiteboard Editor
 */
export function shortcutFor(event: KeyLike): EditorCommand | null {
    if (event.isComposing || isTyping(event.target)) return null;
    const key = event.key.toLowerCase();
    const command = event.ctrlKey || event.metaKey;
    if (command && !event.altKey) {
        if (key === 'z') return { type: event.shiftKey ? 'redo' : 'undo' };
        if (key === 'y' && event.ctrlKey) return { type: 'redo' };
        if (key === 'a') return { type: 'selectAll' };
        return null;
    }
    if (command || event.altKey) return null;
    if (event.key === 'Delete' || event.key === 'Backspace')
        return { type: 'delete' };
    if (event.key === 'Escape') return { type: 'escape' };
    const tool = TOOL_KEYS[key];
    return tool ? { type: 'tool', tool } : null;
}
