import type { KmtInputMode } from '@ue-too/board';

import { t } from '../i18n';
import { createInputModePreference } from './preference';

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
 * and whenever they change it with the picker.
 *
 * @example
 * ```ts
 * followInputMode(mode => board.setInputMode(mode));
 * followInputMode(mode => observableInputTracker.setMode(mode));
 * ```
 */
export const followInputMode = (apply: (mode: KmtInputMode) => void) =>
    inputModePreference.follow(apply);

const MODES: KmtInputMode[] = ['kmt', 'trackpad'];

/**
 * Creates the Keyboard + Mouse / Trackpad picker and appends it to `target`.
 * Its text follows the language picker through `data-i18n` attributes.
 */
export function createInputModeSwitcher(
    target: HTMLElement
): HTMLSelectElement {
    const select = document.createElement('select');
    select.id = 'input-mode-switcher';
    select.setAttribute('data-i18n-aria-label', 'input-mode.label');
    select.setAttribute('aria-label', t('input-mode.label'));
    select.style.cssText =
        'padding: 4px 8px; margin-right: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; cursor: pointer; background: white;';

    for (const mode of MODES) {
        const option = document.createElement('option');
        option.value = mode;
        option.setAttribute('data-i18n', `input-mode.${mode}`);
        option.textContent = t(`input-mode.${mode}`);
        select.appendChild(option);
    }

    inputModePreference.follow(mode => {
        select.value = mode;
    });
    select.addEventListener('change', () => {
        inputModePreference.set(select.value as KmtInputMode);
    });

    target.appendChild(select);
    return select;
}
