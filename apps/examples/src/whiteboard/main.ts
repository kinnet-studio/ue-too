import '@fontsource/caveat/700.css';
import { Board } from '@ue-too/board';
import {
    COLOR_NAMES,
    DEFAULT_THEME,
    Editor,
    type EditorState,
    type ShapeFill,
    type ShapeSize,
    TOOL_NAMES,
    type ToolName,
    WhiteboardDocument,
} from '@ue-too/board/whiteboard';

import { t } from '../i18n';
import { followInputMode } from '../input-mode';

const STORAGE_KEY = 'ue-too-examples:whiteboard';
const SAVE_DELAY = 400;

// 24 × 24 stroke icons
const ICONS: Record<ToolName | 'undo' | 'redo' | 'clear', string> = {
    hand: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 11V8.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-4.5-2L4 15.5a1.5 1.5 0 0 1 2.2-2L7 14.5V11"/>',
    select: '<path d="M4 4l16.5 6.6-6.9 1.9-1.9 6.9z"/>',
    rect: '<rect x="3.5" y="5" width="17" height="14" rx="2"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
    arrow: '<path d="M5 19 19 5M9 5h10v10"/>',
    line: '<path d="M5 19 19 5"/>',
    pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    note: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5zM15 3v6h6"/>',
    eraser: '<path d="m7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.6-9.6a2.4 2.4 0 0 1 3.4 0l5.6 5.6a2.4 2.4 0 0 1 0 3.4L13 21M22 21H7M5 11l9 9"/>',
    undo: '<path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    clear: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
};
const SHORTCUTS: Record<ToolName, string> = {
    hand: 'H',
    select: 'V',
    rect: 'R',
    ellipse: 'O',
    arrow: 'A',
    line: 'L',
    pen: 'P',
    text: 'T',
    note: 'N',
    eraser: 'E',
};
const SIZES: ShapeSize[] = ['s', 'm', 'l'];
const FILLS: ShapeFill[] = ['none', 'hachure', 'solid'];
const DRAWING_TOOLS = new Set<ToolName>([
    'rect',
    'ellipse',
    'arrow',
    'line',
    'pen',
    'text',
    'note',
]);
const FILLED_TOOLS = new Set<ToolName>(['rect', 'ellipse']);

type Key = Parameters<typeof t>[0];
const label = (key: string) => t(key as Key);

// --- the board and the editor ---

const canvas = document.getElementById('graph') as HTMLCanvasElement;
const board = new Board(canvas);
board.fullScreen = true;
followInputMode(mode => board.setInputMode(mode));
// The board sizes the canvas to the window once; keep it that way
window.addEventListener('resize', () => (board.fullScreen = true));

function load(): WhiteboardDocument {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return WhiteboardDocument.fromSnapshot(JSON.parse(saved));
    } catch (error) {
        console.warn('Could not read the saved whiteboard', error);
    }
    return new WhiteboardDocument();
}

const editor = new Editor({
    board,
    canvas,
    document: load(),
    initialTool: 'pen',
});

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function save(): void {
    clearTimeout(saveTimer);
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(editor.document.toSnapshot())
        );
    } catch (error) {
        console.warn('Could not save the whiteboard', error);
    }
}
editor.document.subscribe(() => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_DELAY);
});
window.addEventListener('pagehide', save);

// --- the dock and the style panel ---

const svg = (inner: string) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

function button(
    parent: HTMLElement,
    content: string,
    labelKey: string,
    onClick: () => void,
    shortcut?: string
): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = content;
    b.dataset.i18nAriaLabel = labelKey;
    b.setAttribute('aria-label', label(labelKey));
    if (shortcut) b.setAttribute('aria-keyshortcuts', shortcut);
    // The tooltip follows the language switcher, which updates aria-label
    b.addEventListener('mouseenter', () => {
        const name = b.getAttribute('aria-label') ?? '';
        b.title = shortcut ? `${name} (${shortcut})` : name;
    });
    b.addEventListener('click', onClick);
    parent.append(b);
    return b;
}

const separator = (parent: HTMLElement) => {
    const s = document.createElement('span');
    s.className = 'sep';
    parent.append(s);
};

const dock = document.getElementById('dock')!;
const toolButtons = new Map<ToolName, HTMLButtonElement>();
TOOL_NAMES.forEach((tool, i) => {
    if (i === 2) separator(dock);
    const b = button(
        dock,
        svg(ICONS[tool]),
        `whiteboard.tool.${tool}`,
        () => editor.setTool(tool),
        SHORTCUTS[tool]
    );
    toolButtons.set(tool, b);
});
separator(dock);
const undo = button(
    dock,
    svg(ICONS.undo),
    'whiteboard.undo',
    () => editor.undo(),
    'Control+Z'
);
const redo = button(
    dock,
    svg(ICONS.redo),
    'whiteboard.redo',
    () => editor.redo(),
    'Control+Shift+Z'
);
separator(dock);
const clear = button(dock, svg(ICONS.clear), 'whiteboard.clear', () =>
    editor.clear()
);

const panel = document.getElementById('style-panel')!;
const colorButtons = COLOR_NAMES.map(color =>
    button(
        panel,
        `<span class="swatch" style="background:${DEFAULT_THEME.colors[color]}"></span>`,
        `whiteboard.color.${color}`,
        () => editor.setStyle({ color })
    )
);
separator(panel);
const sizeButtons = SIZES.map((size, i) =>
    button(
        panel,
        `<span class="size" style="height:${2 + i * 2}px"></span>`,
        `whiteboard.size.${size}`,
        () => editor.setStyle({ size })
    )
);
const fillSeparator = document.createElement('span');
fillSeparator.className = 'sep';
panel.append(fillSeparator);
const fillButtons = FILLS.map(fill =>
    button(
        panel,
        `<span class="fill ${fill}"></span>`,
        `whiteboard.fill.${fill}`,
        () => editor.setStyle({ fill })
    )
);

function render(state: EditorState): void {
    for (const [tool, b] of toolButtons)
        b.setAttribute('aria-pressed', String(tool === state.tool));
    undo.disabled = !state.canUndo;
    redo.disabled = !state.canRedo;
    clear.disabled = state.empty;
    const editing = state.selection.length > 0 || DRAWING_TOOLS.has(state.tool);
    panel.hidden = !editing;
    // With shapes selected, show what they share; otherwise the next shape's style
    const shared = state.selectionStyle ?? state.style;
    COLOR_NAMES.forEach((color, i) =>
        colorButtons[i]!.setAttribute(
            'aria-pressed',
            String(shared.color === color)
        )
    );
    SIZES.forEach((size, i) =>
        sizeButtons[i]!.setAttribute(
            'aria-pressed',
            String(shared.size === size)
        )
    );
    const fillable = FILLED_TOOLS.has(state.tool) || state.selection.length > 0;
    fillSeparator.hidden = !fillable;
    FILLS.forEach((fill, i) => {
        fillButtons[i]!.hidden = !fillable;
        fillButtons[i]!.setAttribute(
            'aria-pressed',
            String(shared.fill === fill)
        );
    });
}
editor.subscribe(render);
render(editor.getState());

// --- the frame loop ---

const GRID = 40;
function drawGrid(ctx: CanvasRenderingContext2D): void {
    const zoom = board.camera.zoomLevel;
    const a = board.convertWindowPoint2WorldCoord({ x: 0, y: 0 });
    const b = board.convertWindowPoint2WorldCoord({
        x: window.innerWidth,
        y: window.innerHeight,
    });
    let spacing = GRID;
    while (spacing * zoom < 16) spacing *= 2;
    const size = 2 / zoom;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#8e8e93';
    ctx.beginPath();
    for (
        let x = Math.floor(Math.min(a.x, b.x) / spacing) * spacing;
        x <= Math.max(a.x, b.x);
        x += spacing
    ) {
        for (
            let y = Math.floor(Math.min(a.y, b.y) / spacing) * spacing;
            y <= Math.max(a.y, b.y);
            y += spacing
        ) {
            ctx.rect(x - size / 2, y - size / 2, size, size);
        }
    }
    ctx.fill();
    ctx.restore();
}

function frame(timestamp: number): void {
    board.step(timestamp);
    const ctx = board.context;
    if (ctx) {
        drawGrid(ctx);
        editor.draw(ctx);
    }
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
