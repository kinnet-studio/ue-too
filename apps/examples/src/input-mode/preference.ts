import type { KmtInputMode } from '@ue-too/board';

/** localStorage key holding the visitor's input device choice. */
export const INPUT_MODE_STORAGE_KEY = 'ue-too-examples-input-mode';

const MODES: readonly KmtInputMode[] = ['kmt', 'trackpad'];

type PreferenceStorage = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
};

export type InputModePreference = {
    /** The chosen input device; `'kmt'` until the visitor picks one. */
    get(): KmtInputMode;
    /** Remembers a choice and applies it to everything following it. */
    set(mode: KmtInputMode): void;
    /** Calls `apply` with the current mode now and after every change.
     *  Returns a function that stops following. */
    follow(apply: (mode: KmtInputMode) => void): () => void;
};

function isMode(value: unknown): value is KmtInputMode {
    return MODES.includes(value as KmtInputMode);
}

/**
 * The visitor's keyboard + mouse / trackpad choice, remembered across pages.
 * Storage may be missing or throw (private windows, blocked site data): the
 * choice then lasts for the page only.
 */
export function createInputModePreference(
    storage: PreferenceStorage | undefined
): InputModePreference {
    let current: KmtInputMode = 'kmt';
    try {
        const stored = storage?.getItem(INPUT_MODE_STORAGE_KEY);
        if (isMode(stored)) current = stored;
    } catch {
        // keep the default
    }

    const followers = new Set<(mode: KmtInputMode) => void>();

    return {
        get: () => current,
        set(mode) {
            current = mode;
            try {
                storage?.setItem(INPUT_MODE_STORAGE_KEY, mode);
            } catch {
                // remembered for this page only
            }
            followers.forEach(apply => apply(mode));
        },
        follow(apply) {
            followers.add(apply);
            apply(current);
            return () => {
                followers.delete(apply);
            };
        },
    };
}
