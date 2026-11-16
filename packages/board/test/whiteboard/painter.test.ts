import { describe, expect, it } from 'vitest';

import {
    type Handle,
    drawSelectionOverlay,
} from '../../src/whiteboard/render/overlay';
import { ShapePainter } from '../../src/whiteboard/render/painter';
import { DEFAULT_THEME } from '../../src/whiteboard/render/theme';
import { fakeContext, fakePath } from './fake-canvas';
import { env, note, pen, rect, text } from './shapes';

describe('ShapePainter', () => {
    it('builds paths once per record', () => {
        const painter = new ShapePainter({ createPath: fakePath });
        const ctx = fakeContext();
        const r = rect('a');
        painter.paint(ctx, r, DEFAULT_THEME, env);
        painter.paint(ctx, r, DEFAULT_THEME, env);
        expect(painter.cacheSize).toBe(1);
        painter.paint(ctx, { ...r, x: 5 }, DEFAULT_THEME, env);
        expect(painter.cacheSize).toBe(2);
    });

    it('strokes each outline path with the shape colour and width', () => {
        const painter = new ShapePainter({ createPath: fakePath });
        const ctx = fakeContext();
        painter.paint(
            ctx,
            rect('a', { style: { color: 'red', size: 'l', fill: 'none' } }),
            {
                ...DEFAULT_THEME,
                colors: { ...DEFAULT_THEME.colors, red: '#ff0000' },
            },
            env
        );
        expect(ctx.sets('strokeStyle')).toContain('#ff0000');
        expect(ctx.sets('lineWidth')).toContain(4.5);
        expect(ctx.called('stroke').length).toBe(1);
    });

    it('colours come from the theme at draw time, not the cache', () => {
        const painter = new ShapePainter({ createPath: fakePath });
        const r = rect('a');
        painter.paint(fakeContext(), r, DEFAULT_THEME, env);
        const ctx = fakeContext();
        painter.paint(
            ctx,
            r,
            {
                ...DEFAULT_THEME,
                colors: { ...DEFAULT_THEME.colors, ink: '#eeeeee' },
            },
            env
        );
        expect(ctx.sets('strokeStyle')).toContain('#eeeeee');
        expect(painter.cacheSize).toBe(1);
    });

    it('fills solid shapes faintly and hatches thinly', () => {
        const painter = new ShapePainter({ createPath: fakePath });
        const solid = fakeContext();
        painter.paint(
            solid,
            rect('a', { style: { color: 'ink', size: 'm', fill: 'solid' } }),
            DEFAULT_THEME,
            env
        );
        expect(solid.called('fill').length).toBe(1);
        expect(solid.sets('globalAlpha')).toContain(0.25);
        const hatched = fakeContext();
        painter.paint(
            hatched,
            rect('b', { style: { color: 'ink', size: 'm', fill: 'hachure' } }),
            DEFAULT_THEME,
            env
        );
        expect(hatched.sets('lineWidth')).toContain(1.25);
    });

    it('draws text line by line in the handwriting font', () => {
        const painter = new ShapePainter({ createPath: fakePath });
        const ctx = fakeContext();
        painter.paint(
            ctx,
            text('t', { x: 10, y: 20, text: 'one\ntwo' }),
            DEFAULT_THEME,
            env
        );
        expect(ctx.called('fillText').map(c => c.args)).toEqual([
            ['one', 10, 20],
            ['two', 10, 20 + 28 * 1.25],
        ]);
        expect(ctx.sets('font')).toContain('700 28px Hand');
    });

    it('draws notes on paper, tilted, with their text', () => {
        const painter = new ShapePainter({ createPath: fakePath });
        const ctx = fakeContext();
        painter.paint(ctx, note('n', { text: 'Hi' }), DEFAULT_THEME, env);
        expect(ctx.sets('fillStyle')).toContain(DEFAULT_THEME.paper.ink);
        expect(ctx.sets('fillStyle')).toContain(DEFAULT_THEME.paperText);
        expect(ctx.called('rotate').length).toBe(1);
        expect(ctx.called('fillText').length).toBe(1);
    });

    it('hideText skips text and faded lowers alpha', () => {
        const painter = new ShapePainter({ createPath: fakePath });
        const hidden = fakeContext();
        painter.paint(hidden, text('t'), DEFAULT_THEME, env, {
            hideText: true,
        });
        expect(hidden.called('fillText')).toEqual([]);
        const faded = fakeContext();
        painter.paint(faded, pen('p'), DEFAULT_THEME, env, { faded: true });
        expect(faded.sets('globalAlpha').some(a => (a as number) <= 0.3)).toBe(
            true
        );
    });

    it('saves and restores around each shape', () => {
        const painter = new ShapePainter({ createPath: fakePath });
        const ctx = fakeContext();
        painter.paint(ctx, rect('a'), DEFAULT_THEME, env);
        expect(ctx.calls[0]!.name).toBe('save');
        expect(ctx.calls.at(-1)!.name).toBe('restore');
    });
});

describe('drawSelectionOverlay', () => {
    const box = { x: 0, y: 0, w: 100, h: 100 };
    const handles: Handle[] = [
        { id: 'nw', x: 0, y: 0 },
        { id: 'se', x: 100, y: 100 },
    ];

    it('overlay sizes stay constant on screen', () => {
        const ctx = fakeContext();
        drawSelectionOverlay(
            ctx,
            { selection: box, handles, marquee: null, zoom: 4 },
            DEFAULT_THEME
        );
        expect(ctx.sets('lineWidth')).toContain(1.5 / 4);
        const squares = ctx.called('rect').map(c => c.args);
        expect(squares.length).toBe(2);
        for (const [, , w, h] of squares) {
            expect(w).toBe(8 / 4);
            expect(h).toBe(8 / 4);
        }
    });

    it('draws the marquee with a faint fill', () => {
        const ctx = fakeContext();
        drawSelectionOverlay(
            ctx,
            { selection: null, handles: [], marquee: box, zoom: 0.25 },
            DEFAULT_THEME
        );
        expect(ctx.called('fillRect').length).toBe(1);
        expect(ctx.sets('globalAlpha')).toContain(0.1);
        expect(ctx.sets('lineWidth')).toContain(1 / 0.25);
    });

    it('draws nothing with nothing to show', () => {
        const ctx = fakeContext();
        drawSelectionOverlay(
            ctx,
            { selection: null, handles: [], marquee: null, zoom: 1 },
            DEFAULT_THEME
        );
        expect(
            ctx.called('stroke').length + ctx.called('strokeRect').length
        ).toBe(0);
    });
});
