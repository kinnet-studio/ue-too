import {
    FONT_SIZE,
    type NoteShape,
    type ShapeSize,
    type TextShape,
} from '../document/types';

/**
 * Measures the width of a line of text drawn in a CSS `font`.
 *
 * @group Whiteboard Geometry
 */
export type TextMeasure = (text: string, font: string) => number;

/**
 * What laying out text needs: a way to measure it and the font family that
 * text and notes are drawn in.
 *
 * @group Whiteboard Geometry
 */
export interface TextEnv {
    measure: TextMeasure;
    family: string;
}

/**
 * Line height, as a multiple of the font size.
 *
 * @group Whiteboard Geometry
 */
export const LINE_HEIGHT = 1.25;

/**
 * Space between a note's edge and its text, in world units.
 *
 * @group Whiteboard Geometry
 */
export const NOTE_PADDING = 14;

/**
 * The CSS font for text of a given size.
 *
 * @group Whiteboard Geometry
 */
export function textFont(size: ShapeSize, family: string): string {
    return `700 ${FONT_SIZE[size]}px ${family}`;
}

function wrapParagraph(
    paragraph: string,
    maxWidth: number,
    font: string,
    measure: TextMeasure
): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of paragraph.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (line && measure(next, font) > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    lines.push(line);
    return lines;
}

/**
 * The lines a text shape or note is drawn as.
 *
 * @remarks
 * Text breaks only at newlines. A note also wraps each paragraph to its
 * width less {@link NOTE_PADDING} on each side; a word too long for the
 * width gets a line of its own.
 *
 * @group Whiteboard Geometry
 */
export function textLines(
    shape: TextShape | NoteShape,
    env: TextEnv
): string[] {
    const paragraphs = shape.text.split('\n');
    if (shape.type === 'text') return paragraphs;
    const font = textFont(shape.style.size, env.family);
    const maxWidth = shape.w - 2 * NOTE_PADDING;
    return paragraphs.flatMap(paragraph =>
        wrapParagraph(paragraph, maxWidth, font, env.measure)
    );
}
