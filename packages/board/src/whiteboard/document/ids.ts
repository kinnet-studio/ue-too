const ALPHABET =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 16;

/**
 * Fills a byte array with random values.
 *
 * @group Whiteboard Document
 */
export type RandomBytes = (bytes: Uint8Array) => Uint8Array;

const cryptoBytes: RandomBytes = bytes => crypto.getRandomValues(bytes);

// Bytes 0–247 map four to a character (byte >> 2 is 0–61); 248–255 would
// make some characters likelier, so they are drawn again
const UNBIASED_LIMIT = ALPHABET.length * 4;

/**
 * A new random record id: 16 base-62 characters (about 95 bits).
 *
 * @param random - The random source; `crypto.getRandomValues` by default
 *
 * @group Whiteboard Document
 */
export function createId(random: RandomBytes = cryptoBytes): string {
    let id = '';
    while (id.length < ID_LENGTH) {
        for (const byte of random(new Uint8Array(ID_LENGTH))) {
            if (byte >= UNBIASED_LIMIT || id.length === ID_LENGTH) continue;
            id += ALPHABET[byte >> 2];
        }
    }
    return id;
}

/**
 * A new random seed for a shape's sketchy wobble: an integer in `[0, 2^31)`.
 *
 * @group Whiteboard Document
 */
export function createSeed(): number {
    return crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;
}
