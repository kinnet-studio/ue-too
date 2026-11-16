/**
 * A small, fast seeded random generator (mulberry32): the same seed always
 * gives the same sequence of values in `[0, 1)`.
 *
 * @group Whiteboard Rendering
 */
export function seededRandom(seed: number): () => number {
    let state = (Math.imul(seed | 0, 0x9e3779b1) ^ 0x6d2b79f5) >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
