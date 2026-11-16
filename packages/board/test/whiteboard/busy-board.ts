// The benchmark's busy board: 500 shapes holding 50,100 pen points, laid out
// in a grid 25 shapes wide, 120 world units apart.
import type { Shape, ShapeFill } from '../../src/whiteboard/document/types';

export function busyBoard(): Shape[] {
    const shapes: Shape[] = [];
    let n = 0;
    const base = () => ({
        id: `s${n}`,
        x: (n % 25) * 120,
        y: Math.floor(n / 25) * 120,
        rotation: 0,
        index: `a${String(n).padStart(4, '0')}`,
        seed: n++,
    });
    const fills: ShapeFill[] = ['none', 'hachure', 'solid'];
    for (let i = 0; i < 100; i++) {
        shapes.push({
            ...base(),
            type: i % 2 ? 'rect' : 'ellipse',
            w: 100,
            h: 70,
            style: { color: 'ink', size: 'm', fill: fills[i % 3]! },
        });
    }
    for (let i = 0; i < 50; i++) {
        shapes.push({
            ...base(),
            type: 'note',
            w: 200,
            h: 200,
            text: 'Remember to try the eraser on this one',
            style: { color: 'ink', size: 'm', fill: 'none' },
        });
        shapes.push({
            ...base(),
            type: 'arrow',
            end: [90, 40],
            style: { color: 'blue', size: 'm', fill: 'none' },
        });
    }
    for (let i = 0; i < 300; i++) {
        shapes.push({
            ...base(),
            type: 'pen',
            points: Array.from(
                { length: 167 },
                (_, k) =>
                    [k * 0.6, Math.sin(k / 9 + i) * 20] as [number, number]
            ),
            style: { color: 'red', size: 's', fill: 'none' },
        });
    }
    return shapes;
}
