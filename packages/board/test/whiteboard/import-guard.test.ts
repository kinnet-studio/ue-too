import { readFileSync, readdirSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { describe, expect, it } from 'vitest';

// The whiteboard lives in board for now but is meant to move into its own
// package that depends on board. These checks keep that move mechanical: the
// whiteboard reaches board only through its package name, and board never
// reaches into the whiteboard.

const SRC = resolve(__dirname, '../../src');
const WHITEBOARD = join(SRC, 'whiteboard');
const ALLOWED_PACKAGES = new Set([
    '@ue-too/board',
    '@ue-too/being',
    '@ue-too/math',
]);
const SPECIFIER = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

function sourceFiles(): string[] {
    return (readdirSync(SRC, { recursive: true }) as string[])
        .filter(file => /\.(ts|tsx|mts)$/.test(file))
        .map(file => join(SRC, file));
}

// JSDoc examples show imports too; only real code counts
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function specifiers(file: string): string[] {
    return [
        ...stripComments(readFileSync(file, 'utf8')).matchAll(SPECIFIER),
    ].map(match => match[1]!);
}

function isInside(path: string, folder: string): boolean {
    const rel = relative(folder, path);
    return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'));
}

const files = sourceFiles();
const insideFiles = files.filter(file => isInside(file, WHITEBOARD));
const outsideFiles = files.filter(file => !isInside(file, WHITEBOARD));

const offendersInside = insideFiles.flatMap(file =>
    specifiers(file)
        .filter(specifier =>
            specifier.startsWith('.')
                ? !isInside(resolve(dirname(file), specifier), WHITEBOARD)
                : !ALLOWED_PACKAGES.has(specifier)
        )
        .map(specifier => `${relative(SRC, file)}: ${specifier}`)
);

const offendersOutside = outsideFiles.flatMap(file =>
    specifiers(file)
        .filter(
            specifier =>
                specifier.includes('whiteboard') ||
                specifier === '@ue-too/board'
        )
        .map(specifier => `${relative(SRC, file)}: ${specifier}`)
);

describe('whiteboard import boundary', () => {
    it('whiteboard files import only board, being, math and each other', () => {
        expect(insideFiles.length).toBeGreaterThan(0);
        expect(offendersInside).toEqual([]);
    });

    it('nothing outside the whiteboard imports it or board by name', () => {
        expect(offendersOutside).toEqual([]);
    });

    it('the main entry does not re-export the whiteboard', () => {
        expect(readFileSync(join(SRC, 'index.ts'), 'utf8')).not.toContain(
            'whiteboard'
        );
    });
});
