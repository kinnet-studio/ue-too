/**
 * References into the panel's shadow tree, handed to the debugger.
 */
export type PanelDom = {
    host: HTMLElement;
    canvas: HTMLCanvasElement;
    tabStrip: HTMLElement;
    currentState: HTMLElement;
    contextView: HTMLElement;
    panelError: HTMLElement;
    eventRows: HTMLElement;
    resetButton: HTMLButtonElement;
    log: HTMLUListElement;
    pill: HTMLButtonElement;
    closeButton: HTMLButtonElement;
    setOpen(open: boolean): void;
    setCount(count: number): void;
    destroy(): void;
};

const STYLES = `
    :host {
        all: initial;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        color: #0f172a;
    }
    :host(.overlay) {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483000;
    }
    :host(.inline) {
        display: block;
        width: 100%;
        height: 100%;
    }
    .wrap {
        display: contents;
    }
    .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        background: #ffffff;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
        font: inherit;
        cursor: pointer;
    }
    .wrap.open .pill {
        display: none;
    }
    .panel {
        display: flex;
        width: 60vw;
        height: 55vh;
        min-width: 640px;
        min-height: 400px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 32px);
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 8px 30px rgba(15, 23, 42, 0.18);
        overflow: hidden;
        box-sizing: border-box;
    }
    :host(.inline) .panel {
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        /* the overlay's viewport caps would inset an inline panel inside its
           own container; inline mode fills the container it was given */
        max-width: none;
        max-height: none;
        border-radius: 0;
        box-shadow: none;
    }
    .wrap:not(.open) .panel {
        display: none;
    }
    canvas {
        flex: 1;
        min-width: 0;
        display: block;
    }
    .sidebar {
        width: 320px;
        flex-shrink: 0;
        border-left: 1px solid #e2e8f0;
        padding: 12px;
        overflow-y: auto;
        box-sizing: border-box;
        font-size: 14px;
    }
    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
    }
    .header h1 {
        font-size: 16px;
        margin: 0;
    }
    .close {
        border: none;
        background: transparent;
        font: inherit;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        color: #64748b;
    }
    .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 8px;
    }
    .tab {
        font: inherit;
        font-size: 12px;
        padding: 3px 8px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background: #f8fafc;
        cursor: pointer;
    }
    .tab.active {
        background: #dbeafe;
        border-color: #2563eb;
    }
    .hint {
        color: #64748b;
        font-size: 12px;
        margin-bottom: 12px;
    }
    .current-state {
        font-weight: 600;
        margin-bottom: 12px;
    }
    details {
        margin-bottom: 12px;
    }
    summary {
        font-weight: 600;
        cursor: pointer;
    }
    .context-view {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 6px;
        margin: 4px 0 0;
        font-size: 11px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        max-height: 180px;
        overflow: auto;
        white-space: pre-wrap;
    }
    .panel-error {
        color: #dc2626;
        margin-bottom: 8px;
        white-space: pre-wrap;
    }
    .event-row {
        margin-bottom: 6px;
    }
    .event-row button {
        width: 100%;
        text-align: left;
        cursor: pointer;
        font: inherit;
    }
    .event-row textarea {
        width: 100%;
        box-sizing: border-box;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
    }
    .payload-error {
        color: #dc2626;
        font-size: 12px;
        white-space: pre-wrap;
    }
    .reset {
        width: 100%;
        margin: 8px 0 12px;
        font: inherit;
        cursor: pointer;
    }
    .log {
        list-style: none;
        margin: 0;
        padding: 0;
        font-size: 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .log li {
        padding: 2px 0;
        border-bottom: 1px solid #f1f5f9;
        word-break: break-word;
    }
`;

const MARKUP = `
    <style>${STYLES}</style>
    <div class="wrap">
        <button class="pill" type="button" title="Open being devtools">
            ⚙ being <span class="count">0</span>
        </button>
        <div class="panel">
            <canvas></canvas>
            <div class="sidebar">
                <div class="header">
                    <h1>State machines</h1>
                    <button class="close" type="button" title="Close">×</button>
                </div>
                <div class="tabs"></div>
                <div class="hint">
                    Events fired here and real input on the page both drive the
                    chart. Click the chart to hand keyboard focus back to it.
                </div>
                <div class="current-state"></div>
                <details open>
                    <summary>Context</summary>
                    <pre class="context-view"></pre>
                </details>
                <div class="panel-error"></div>
                <div class="event-rows"></div>
                <button class="reset" type="button">Reset machine</button>
                <ul class="log"></ul>
            </div>
        </div>
    </div>
`;

/**
 * Builds the panel's shadow tree. With no `container` the host is a fixed
 * bottom-right overlay appended to `document.body`; with one, the host
 * fills the container.
 */
export function createPanelDom(options: { container?: HTMLElement }): PanelDom {
    const host = document.createElement('div');
    host.className = options.container === undefined ? 'overlay' : 'inline';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = MARKUP;
    (options.container ?? document.body).appendChild(host);

    const query = <T extends Element>(selector: string): T => {
        const element = root.querySelector<T>(selector);
        if (element === null) {
            throw new Error(
                `being-devtools panel markup is missing ${selector}`
            );
        }
        return element;
    };

    const wrap = query<HTMLDivElement>('.wrap');
    const count = query<HTMLSpanElement>('.count');

    return {
        host,
        canvas: query<HTMLCanvasElement>('canvas'),
        tabStrip: query<HTMLDivElement>('.tabs'),
        currentState: query<HTMLDivElement>('.current-state'),
        contextView: query<HTMLPreElement>('.context-view'),
        panelError: query<HTMLDivElement>('.panel-error'),
        eventRows: query<HTMLDivElement>('.event-rows'),
        resetButton: query<HTMLButtonElement>('.reset'),
        log: query<HTMLUListElement>('.log'),
        pill: query<HTMLButtonElement>('.pill'),
        closeButton: query<HTMLButtonElement>('.close'),
        setOpen(open) {
            wrap.classList.toggle('open', open);
        },
        setCount(value) {
            count.textContent = String(value);
        },
        destroy() {
            host.remove();
        },
    };
}
