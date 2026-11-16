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

/**
 * A new random record id: 16 base-62 characters (about 95 bits).
 *
 * @param random - The random source; `crypto.getRandomValues` by default
 *
 * @group Whiteboard Document
 */
export function createId(random: RandomBytes = cryptoBytes): string {
    const bytes = random(new Uint8Array(ID_LENGTH));
    let id = '';
    for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
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
