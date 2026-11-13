import { describe, expect, it } from 'bun:test';

import {
    INPUT_MODE_STORAGE_KEY,
    createInputModePreference,
} from '../src/input-mode/preference';

function memoryStorage(initial: Record<string, string> = {}) {
    const items = new Map(Object.entries(initial));
    return {
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => {
            items.set(key, value);
        },
        items,
    };
}

const throwingStorage = {
    getItem(): string | null {
        throw new Error('storage disabled');
    },
    setItem(): void {
        throw new Error('storage disabled');
    },
};

describe('input mode preference', () => {
    it('defaults to keyboard + mouse', () => {
        expect(createInputModePreference(memoryStorage()).get()).toBe('kmt');
    });

    it('reads a stored trackpad choice', () => {
        const storage = memoryStorage({ [INPUT_MODE_STORAGE_KEY]: 'trackpad' });
        expect(createInputModePreference(storage).get()).toBe('trackpad');
    });

    it('ignores a stored value that is not a mode', () => {
        for (const value of ['TBD', 'mouse', '']) {
            const storage = memoryStorage({ [INPUT_MODE_STORAGE_KEY]: value });
            expect(createInputModePreference(storage).get()).toBe('kmt');
        }
    });

    it('remembers a choice', () => {
        const storage = memoryStorage();
        createInputModePreference(storage).set('trackpad');
        expect(storage.items.get(INPUT_MODE_STORAGE_KEY)).toBe('trackpad');
        expect(createInputModePreference(storage).get()).toBe('trackpad');
    });

    it('follow applies the current mode now and on every change', () => {
        const preference = createInputModePreference(memoryStorage());
        const applied: string[] = [];
        preference.follow(mode => applied.push(mode));
        preference.set('trackpad');
        preference.set('kmt');
        expect(applied).toEqual(['kmt', 'trackpad', 'kmt']);
    });

    it('stops following once unsubscribed', () => {
        const preference = createInputModePreference(memoryStorage());
        const applied: string[] = [];
        const unfollow = preference.follow(mode => applied.push(mode));
        unfollow();
        preference.set('trackpad');
        expect(applied).toEqual(['kmt']);
    });

    it('still works when storage is unavailable', () => {
        const preference = createInputModePreference(throwingStorage);
        expect(preference.get()).toBe('kmt');
        preference.set('trackpad');
        expect(preference.get()).toBe('trackpad');
    });
});
