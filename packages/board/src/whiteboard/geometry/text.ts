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

// Chinese, Japanese and Korean characters (and full-width punctuation) can
// break between any two of them, with no spaces
const CJK = /[\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/u;

interface Token {
    text: string;
    spaceBefore: boolean;
}

// Words split at spaces, with each CJK character a token of its own
function tokenize(paragraph: string): Token[] {
    const tokens: Token[] = [];
    let word = '';
    let wordSpace = false;
    let space = false;
    const flush = () => {
        if (word) tokens.push({ text: word, spaceBefore: wordSpace });
        word = '';
    };
    for (const char of paragraph) {
        if (char === ' ') {
            flush();
            space = true;
        } else if (CJK.test(char)) {
            flush();
            tokens.push({ text: char, spaceBefore: space });
            space = false;
        } else {
            if (!word) {
                wordSpace = space;
                space = false;
            }
            word += char;
        }
    }
    flush();
    return tokens;
}

function wrapParagraph(
    paragraph: string,
    maxWidth: number,
    font: string,
    measure: TextMeasure
): string[] {
    const fits = (text: string) => measure(text, font) <= maxWidth;
    const lines: string[] = [];
    let line = '';
    for (const token of tokenize(paragraph)) {
        const joined = line
            ? line + (token.spaceBefore ? ' ' : '') + token.text
            : token.text;
        if (fits(joined)) {
            line = joined;
            continue;
        }
        if (line) lines.push(line);
        // A word too wide for a line of its own breaks between characters
        let rest = Array.from(token.text);
        while (rest.length > 0 && !fits(rest.join(''))) {
            let count = 1;
            while (
                count < rest.length &&
                fits(rest.slice(0, count + 1).join(''))
            ) {
                count++;
            }
            lines.push(rest.slice(0, count).join(''));
            rest = rest.slice(count);
        }
        line = rest.join('');
    }
    if (line || lines.length === 0) lines.push(line);
    return lines;
}

/**
 * The lines a text shape or note is drawn as.
 *
 * @remarks
 * Text breaks only at newlines. A note also wraps each paragraph to its
 * width less {@link NOTE_PADDING} on each side: at spaces, between Chinese,
 * Japanese and Korean characters, and inside a word too long for a line.
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
