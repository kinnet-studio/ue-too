import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { cwd } from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDryRun =
    process.env.NX_RELEASE_DRY_RUN === 'true' ||
    process.env.NX_DRY_RUN === 'true' ||
    process.argv.some(
        arg =>
            arg === '--dry-run' ||
            arg === '--dryRun' ||
            arg.startsWith('--dryRun=') ||
            arg.startsWith('--dry-run=')
    );

// Read package.json from current working directory instead of root
const packageJsonPath = join(cwd(), 'package.json');
const data = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

// Get the package name from the current directory
const currentDir = basename(cwd());
const packageName = currentDir;

// Define the root build directory and package build directory
const rootPackagesDir = join(__dirname, '..');
const packageBuildDir = join(rootPackagesDir, `packages/${packageName}/dist`);

// Ensure the build directory exists
mkdirSync(packageBuildDir, { recursive: true });

// Use consistent file extensions for all packages
data.main = './index.js';
data.module = './index.js';
data.types = './index.d.ts';
data.scripts = { test: 'echo "Error: no test specified" && exit 1' };
data.exports = {
    '.': {
        types: './index.d.ts',
        import: './index.js',
        default: './index.js',
    },
    './package.json': './package.json',
};

// Extra public entries, built next to the main one (e.g. board's
// `@ue-too/board/whiteboard`): `publishEntries: ["whiteboard"]` publishes
// `./whiteboard` from `whiteboard/index.js`
for (const name of data.publishEntries ?? []) {
    data.exports[`./${name}`] = {
        types: `./${name}/index.d.ts`,
        import: `./${name}/index.js`,
        default: `./${name}/index.js`,
    };
}
delete data.publishEntries;

if (isDryRun) {
    data.version = '0.0.0';
}

writeFileSync(
    join(packageBuildDir, 'package.json'),
    JSON.stringify(data, null, 2)
);

// Copy README.md and LICENSE.txt if they exist
try {
    copyFileSync('./README.md', join(packageBuildDir, 'README.md'));
} catch (error) {
    console.log('README.md not found, skipping...');
}

try {
    copyFileSync('./LICENSE.txt', join(packageBuildDir, 'LICENSE.txt'));
} catch (error) {
    console.log('LICENSE.txt not found, skipping...');
}

try {
    copyFileSync(
        join(rootPackagesDir, '.npmignore'),
        join(packageBuildDir, '.npmignore')
    );
} catch (error) {
    console.log('npmignore not found, skipping...');
}
