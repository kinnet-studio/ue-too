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
    /**
     * Where the text sits: `x`, `y` in window (client) CSS pixels, `w`, `h`
     * its size at zoom 1
     */
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

/**
 * The editor's built-in {@link TextInput}: a transparent `<textarea>` laid
 * over the shape, so typing, IME composition (Japanese, Chinese), selection
 * and the clipboard all work as in any text field.
 *
 * @remarks
 * The textarea is `position: fixed` at the session's window coordinates and
 * scaled with the camera. Enter adds a line; Escape or leaving the field
 * ends editing.
 *
 * @group Whiteboard Editor
 */
export class DomTextInput implements TextInput {
    private _textarea: HTMLTextAreaElement | null = null;
    private _session: TextInputSession | null = null;

    /** @param _parent - The element the textarea is added to */
    constructor(private readonly _parent: HTMLElement) {}

    get active(): boolean {
        return this._session !== null;
    }

    open(session: TextInputSession): void {
        this.close();
        const textarea = this._parent.ownerDocument.createElement('textarea');
        this._textarea = textarea;
        this._session = session;
        textarea.value = session.text;
        textarea.spellcheck = false;
        textarea.setAttribute('aria-label', 'Text');
        if (!session.wrap) textarea.setAttribute('wrap', 'off');
        Object.assign(textarea.style, {
            position: 'fixed',
            margin: '0',
            padding: '0',
            border: 'none',
            outline: 'none',
            resize: 'none',
            overflow: 'hidden',
            background: 'transparent',
            color: session.color,
            font: session.font,
            lineHeight: `${session.lineHeight}px`,
            whiteSpace: session.wrap ? 'pre-wrap' : 'pre',
            transformOrigin: '0 0',
            zIndex: '1',
        });
        this.place(session.rect, session.scale);
        textarea.addEventListener('input', () => {
            session.onInput(textarea.value);
            this.fit();
        });
        textarea.addEventListener('keydown', event => {
            // Keys typed here are text, not editor shortcuts
            event.stopPropagation();
            if (event.key === 'Escape') {
                event.preventDefault();
                this.close();
            }
        });
        textarea.addEventListener('blur', () => this.close());
        this._parent.appendChild(textarea);
        textarea.focus();
        textarea.setSelectionRange(
            textarea.value.length,
            textarea.value.length
        );
        this.fit();
    }

    reposition(rect: Box, scale: number): void {
        this.place(rect, scale);
    }

    close(): void {
        const session = this._session;
        const textarea = this._textarea;
        if (!session || !textarea) return;
        this._session = null;
        this._textarea = null;
        textarea.remove();
        session.onCommit(textarea.value);
    }

    private place(rect: Box, scale: number): void {
        const textarea = this._textarea;
        if (!textarea) return;
        textarea.style.left = `${rect.x}px`;
        textarea.style.top = `${rect.y}px`;
        textarea.style.width = `${rect.w}px`;
        textarea.style.height = `${rect.h}px`;
        textarea.style.transform = `scale(${scale})`;
    }

    // Text shapes grow with what's typed
    private fit(): void {
        const textarea = this._textarea;
        if (!textarea || this._session?.wrap) return;
        if (textarea.scrollWidth > textarea.clientWidth) {
            textarea.style.width = `${textarea.scrollWidth}px`;
        }
        if (textarea.scrollHeight > textarea.clientHeight) {
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }
}
