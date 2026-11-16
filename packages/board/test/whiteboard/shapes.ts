// Shape builders shared by the whiteboard tests: valid records with sensible
// defaults, overridable field by field.
import type {
    ArrowShape,
    EllipseShape,
    LineShape,
    NoteShape,
    PenShape,
    RectShape,
    ShapeStyle,
    TextShape,
} from '../../src/whiteboard/document/types';

const style = (): ShapeStyle => ({ color: 'ink', size: 'm', fill: 'none' });
const base = (id: string) => ({
    id,
    x: 0,
    y: 0,
    rotation: 0,
    index: 'V',
    seed: 1,
    style: style(),
});

export const rect = (id: string, o: Partial<RectShape> = {}): RectShape => ({
    ...base(id),
    type: 'rect',
    w: 100,
    h: 60,
    ...o,
});

export const ellipse = (
    id: string,
    o: Partial<EllipseShape> = {}
): EllipseShape => ({
    ...base(id),
    type: 'ellipse',
    w: 100,
    h: 60,
    ...o,
});

export const note = (id: string, o: Partial<NoteShape> = {}): NoteShape => ({
    ...base(id),
    type: 'note',
    w: 200,
    h: 200,
    text: 'Hello',
    ...o,
});

export const arrow = (id: string, o: Partial<ArrowShape> = {}): ArrowShape => ({
    ...base(id),
    type: 'arrow',
    end: [100, 0],
    ...o,
});

export const line = (id: string, o: Partial<LineShape> = {}): LineShape => ({
    ...base(id),
    type: 'line',
    end: [100, 0],
    ...o,
});

export const pen = (id: string, o: Partial<PenShape> = {}): PenShape => ({
    ...base(id),
    type: 'pen',
    points: [
        [0, 0],
        [10, 5],
        [20, 0],
    ],
    ...o,
});

export const text = (id: string, o: Partial<TextShape> = {}): TextShape => ({
    ...base(id),
    type: 'text',
    text: 'Hi',
    ...o,
});

// A text measure that needs no canvas: each character is half the font size wide
export const env = {
    measure: (value: string, font: string) =>
        value.length * parseFloat(font.split(' ')[1]!) * 0.5,
    family: 'Hand',
};
