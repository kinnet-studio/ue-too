import type { ColorName } from '../document/types';

/**
 * The colours and font a whiteboard is drawn with.
 *
 * @remarks
 * Shapes store colour names; the theme turns each name into a CSS colour, so
 * an app can swap themes (light and dark) without touching the drawing.
 *
 * @group Whiteboard Rendering
 */
export interface WhiteboardTheme {
    /** Strokes, fills and text for each colour name */
    colors: Record<ColorName, string>;
    /** A sticky note's paper for each colour name */
    paper: Record<ColorName, string>;
    /** Text on sticky notes */
    paperText: string;
    /** Selection outline, handles and marquee */
    selection: string;
    fonts: {
        /** CSS font family for text and notes, with fallbacks */
        hand: string;
    };
}

/**
 * The light theme the editor uses unless told otherwise.
 *
 * @group Whiteboard Rendering
 */
export const DEFAULT_THEME: WhiteboardTheme = {
    colors: {
        ink: '#1e1e1e',
        red: '#e03131',
        blue: '#1971c2',
        green: '#2f9e44',
        orange: '#f08c00',
    },
    paper: {
        ink: '#fff0a3',
        red: '#ffc9c9',
        blue: '#a5d8ff',
        green: '#b2f2bb',
        orange: '#ffd8a8',
    },
    paperText: '#3d3300',
    selection: '#4f7a33',
    fonts: { hand: "'Caveat', 'Segoe Print', 'Comic Sans MS', cursive" },
};
