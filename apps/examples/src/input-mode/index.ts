import type { KmtInputMode } from '@ue-too/board';

import { t } from '../i18n';
import {
    type InputModePreference,
    createInputModePreference,
} from './preference';

function localStorageOrUndefined(): Storage | undefined {
    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
}

/** The visitor's input device choice, shared by every example page. */
export const inputModePreference = createInputModePreference(
    localStorageOrUndefined()
);

/**
 * Keeps a board on the visitor's chosen input device: applies the choice now
 * and whenever they change it with the switch.
 *
 * @example
 * ```ts
 * followInputMode(mode => board.setInputMode(mode));
 * followInputMode(mode => observableInputTracker.setMode(mode));
 * ```
 */
export const followInputMode = (apply: (mode: KmtInputMode) => void) =>
    inputModePreference.follow(apply);

const STYLE_ID = 'input-mode-switch-style';
const STYLE = `
.input-mode-switch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-right: 12px;
    padding: 4px 0;
    border: none;
    background: none;
    font: inherit;
    font-size: 13px;
    color: #888;
    cursor: pointer;
    vertical-align: middle;
}
.input-mode-switch__track {
    position: relative;
    flex: none;
    width: 30px;
    height: 18px;
    border-radius: 9px;
    background: #007bff;
}
.input-mode-switch__knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    transition: transform 0.15s ease;
}
.input-mode-switch[aria-checked='true'] .input-mode-switch__knob {
    transform: translateX(12px);
}
.input-mode-switch[aria-checked='false'] .input-mode-switch__kmt,
.input-mode-switch[aria-checked='true'] .input-mode-switch__trackpad {
    color: #222;
}
.input-mode-switch:focus-visible {
    outline: none;
}
.input-mode-switch:focus-visible .input-mode-switch__track {
    outline: 2px solid #007bff;
    outline-offset: 2px;
}
/* Most pages float the top bar over the title's row. With the switch in it,
   the bar is too wide for that on a phone: give it its own line there. */
@media (max-width: 640px) {
    .lang-bar {
        position: static;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: center;
        row-gap: 4px;
        margin-bottom: 8px;
    }
}
@media (prefers-reduced-motion: reduce) {
    .input-mode-switch__knob {
        transition: none;
    }
}
`;

function injectStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
}

function label(mode: KmtInputMode): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = `input-mode-switch__${mode}`;
    span.setAttribute('data-i18n', `input-mode.${mode}`);
    span.textContent = t(`input-mode.${mode}`);
    return span;
}

/**
 * Creates the Keyboard + Mouse ⇄ Trackpad switch and appends it to `target`.
 * The switch is "Trackpad": on for trackpad, off for keyboard + mouse. Its
 * text follows the language picker through `data-i18n` attributes.
 */
export function createInputModeSwitcher(
    target: HTMLElement,
    preference: InputModePreference = inputModePreference
): HTMLButtonElement {
    injectStyle();

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'input-mode-switcher';
    toggle.className = 'input-mode-switch';
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('data-i18n-aria-label', 'input-mode.trackpad');
    toggle.setAttribute('aria-label', t('input-mode.trackpad'));

    const track = document.createElement('span');
    track.className = 'input-mode-switch__track';
    track.appendChild(document.createElement('span')).className =
        'input-mode-switch__knob';

    const kmtLabel = label('kmt');
    const trackpadLabel = label('trackpad');
    kmtLabel.setAttribute('aria-hidden', 'true');
    trackpadLabel.setAttribute('aria-hidden', 'true');
    toggle.append(kmtLabel, track, trackpadLabel);

    preference.follow(mode => {
        toggle.setAttribute('aria-checked', String(mode === 'trackpad'));
    });
    toggle.addEventListener('click', event => {
        preference.set(preference.get() === 'trackpad' ? 'kmt' : 'trackpad');
        // Space + drag pans the board. After a mouse click, give focus back
        // to the page so the next Space pans instead of flipping the switch.
        // (A keyboard press reports detail 0 and keeps focus.)
        if (event.detail > 0) toggle.blur();
    });

    target.appendChild(toggle);
    return toggle;
}
