import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';

const { values, positionals } = parseArgs({
    args: Bun.argv,
    options: {
        external: {
            type: 'string',
            multiple: true,
        },
        entrypoints: {
            type: 'string',
            multiple: true,
        },
        bundle: {
            type: 'boolean',
            default: false,
        },
    },
    strict: true,
    allowPositionals: true,
});

console.log(values);

// If --bundle flag is set, don't mark dependencies as external
// This creates a standalone browser bundle with all dependencies included
const external = values.bundle ? [] : values.external || [];

const result = await Bun.build({
    entrypoints: values.entrypoints || ['./src/index.ts'],
    outdir: './dist',
    sourcemap: 'external',
    // minify: true,
    external: external,
    // Force production JSX transform (react/jsx-runtime with jsx/jsxs) regardless
    // of NODE_ENV. Without this, Bun.build() defaults to dev JSX
    // (react/jsx-dev-runtime with jsxDEV) when NODE_ENV is unset.
    define: {
        'process.env.NODE_ENV': '"production"',
    },
});

if (!result.success) {
    console.error('Build failed');
    for (const message of result.logs) {
        console.error(message);
    }
} else {
    console.log('Build successful');

    // Fix source map paths to be relative to the map file (not the original source)
    // This ensures source maps work in published packages where source files don't exist
    console.log('Fixing source map paths...');
    const sourceMapPath = join(process.cwd(), 'dist', 'index.js.map');
    const jsFilePath = join(process.cwd(), 'dist', 'index.js');
    const browserBundlePath = join(process.cwd(), 'dist', 'index.browser.js');
    const browserMapPath = join(process.cwd(), 'dist', 'index.browser.js.map');

    try {
        const sourceMapContent = readFileSync(sourceMapPath, 'utf-8');
        const sourceMap = JSON.parse(sourceMapContent);

        // Replace relative paths like "../src/file.ts" with just the filename
        // Since sourcesContent already contains the full source, the paths are just metadata
        if (sourceMap.sources && Array.isArray(sourceMap.sources)) {
            sourceMap.sources = sourceMap.sources.map((source: string) => {
                // Extract just the filename from paths like "../src/file.ts" -> "file.ts"
                return basename(source);
            });
        }

        writeFileSync(sourceMapPath, JSON.stringify(sourceMap, null, 2));

        // Ensure source map reference is in the JS file
        let jsContent = readFileSync(jsFilePath, 'utf-8');
        if (!jsContent.includes('sourceMappingURL')) {
            // Add source map reference at the end of the file
            jsContent += '\n//# sourceMappingURL=index.js.map';
            writeFileSync(jsFilePath, jsContent);
        }

        // If bundled, also create browser-specific files
        if (values.bundle) {
            console.log('Creating browser bundle...');
            // Copy the bundled file as browser bundle
            const bundledContent = readFileSync(jsFilePath, 'utf-8');
            writeFileSync(browserBundlePath, bundledContent);

            // Copy and update source map for browser bundle
            const browserMap = JSON.parse(sourceMapContent);
            if (browserMap.sources && Array.isArray(browserMap.sources)) {
                browserMap.sources = browserMap.sources.map((source: string) =>
                    basename(source)
                );
            }
            writeFileSync(browserMapPath, JSON.stringify(browserMap, null, 2));

            // Update browser bundle to reference its source map
            let browserContent = readFileSync(browserBundlePath, 'utf-8');
            if (!browserContent.includes('sourceMappingURL')) {
                browserContent += '\n//# sourceMappingURL=index.browser.js.map';
                writeFileSync(browserBundlePath, browserContent);
            }

            console.log('Browser bundle created: index.browser.js');
        }

        // Further entry points (e.g. dist/whiteboard/index.js) get the same fix
        for (const output of result.outputs) {
            if (!output.path.endsWith('.js') || output.path === jsFilePath) {
                continue;
            }
            const mapPath = `${output.path}.map`;
            const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
            if (map.sources && Array.isArray(map.sources)) {
                map.sources = map.sources.map((source: string) =>
                    basename(source)
                );
            }
            writeFileSync(mapPath, JSON.stringify(map, null, 2));
            let content = readFileSync(output.path, 'utf-8');
            if (!content.includes('sourceMappingURL')) {
                content += `\n//# sourceMappingURL=${basename(mapPath)}`;
                writeFileSync(output.path, content);
            }
        }

        console.log('Source map paths fixed');
    } catch (error) {
        console.warn('Could not fix source map (file may not exist):', error);
    }

    // Generate declaration files
    console.log('Generating declaration files...');
    const tsc = Bun.spawnSync([
        'bun',
        'x',
        'tsc',
        '--emitDeclarationOnly',
        '--declaration',
    ]);

    if (!tsc.success) {
        console.error('Type generation failed');
        console.error(tsc.stderr.toString());
        console.error(tsc.stdout.toString());
        process.exit(1);
    } else {
        console.log('Types generated successfully');
    }
}
