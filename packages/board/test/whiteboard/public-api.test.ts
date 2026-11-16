import { describe, expect, it } from 'vitest';

import * as whiteboard from '../../src/whiteboard';

// Everything `@ue-too/board/whiteboard` exports at runtime. Adding to this is
// a feature; removing from it is a breaking change, so internals (tool
// machines, the tool context, the editor machine) stay out.
const PUBLIC = [
    // document
    'COLOR_NAMES',
    'DEFAULT_STYLE',
    'STROKE_WIDTH',
    'FONT_SIZE',
    'NOTE_SIZE',
    'createId',
    'createSeed',
    'indexBetween',
    'compareShapes',
    'WhiteboardDocument',
    'History',
    'SNAPSHOT_SCHEMA',
    'SNAPSHOT_VERSION',
    'SnapshotError',
    'isShape',
    'parseSnapshot',
    // geometry
    'normalizeBox',
    'unionBoxes',
    'boxContainsBox',
    'boxesOverlap',
    'LINE_HEIGHT',
    'NOTE_PADDING',
    'textFont',
    'textLines',
    'shapeBounds',
    'hitShape',
    'shapesInBox',
    'simplifyPoints',
    'roundPoints',
    // rendering
    'seededRandom',
    'sketchShape',
    'noteTilt',
    'DEFAULT_THEME',
    'ShapePainter',
    'drawSelectionOverlay',
    // editor
    'TOOL_NAMES',
    'PointerInput',
    'DomTextInput',
    'shortcutFor',
    'Editor',
];

describe('@ue-too/board/whiteboard', () => {
    it('exports exactly its public API', () => {
        expect(Object.keys(whiteboard).sort()).toEqual([...PUBLIC].sort());
    });
});
