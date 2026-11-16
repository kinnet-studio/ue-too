/**
 * Fractional indexing: stacking-order keys that sort as plain strings, so a
 * key can always be made between any two others. Two clients adding or
 * reordering shapes at once never have to renumber anything.
 *
 * Keys are base-62 fractions (`0.<digits>`) written without the leading
 * `0.`, never ending in `0`, so every key has exactly one spelling.
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;
const MIDDLE = DIGITS[Math.floor(BASE / 2)]!;
const TOP = DIGITS[BASE - 1]!;

function digit(char: string | undefined): number {
    return char === undefined ? 0 : DIGITS.indexOf(char);
}

// The key halfway between fractions a and b (b null meaning 1)
function midpoint(a: string, b: string | null): string {
    if (b !== null) {
        let shared = 0;
        while ((a[shared] ?? '0') === b[shared]) shared++;
        if (shared > 0) {
            return (
                b.slice(0, shared) + midpoint(a.slice(shared), b.slice(shared))
            );
        }
    }
    const low = digit(a[0]);
    const high = b !== null ? digit(b[0]) : BASE;
    if (high - low > 1) return DIGITS[Math.round((low + high) / 2)]!;
    if (b !== null && b.length > 1) return b.slice(0, 1);
    return DIGITS[low] + midpoint(a.slice(1), null);
}

/**
 * A key that sorts after `before` and before `after`.
 *
 * @remarks
 * `null` means "no neighbour on that side". Appending (`after` null) takes
 * the shortest key above `before`, so a long run of appends grows by one
 * character about every 60 keys.
 *
 * @group Whiteboard Document
 */
export function indexBetween(
    before: string | null,
    after: string | null
): string {
    if (after === null) {
        const key = before ?? '';
        for (let i = 0; i < key.length; i++) {
            if (key[i] !== TOP) {
                return key.slice(0, i) + DIGITS[digit(key[i]) + 1];
            }
        }
        // The first key sits in the middle, leaving room below it; after a
        // run of top digits, start again from the lowest so appends stay short
        return key === '' ? MIDDLE : key + DIGITS[1];
    }
    return midpoint(before ?? '', after);
}

/**
 * Stacking order: by `index`, then by `id` for the rare tie two clients can
 * make.
 *
 * @group Whiteboard Document
 */
export function compareShapes(
    a: { index: string; id: string },
    b: { index: string; id: string }
): number {
    if (a.index !== b.index) return a.index < b.index ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
}
