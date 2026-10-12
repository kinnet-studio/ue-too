#!/usr/bin/env node

/**
 * Wrapper script for npm publish that respects dry-run mode
 * Checks for:
 * - NX_RELEASE_DRY_RUN environment variable (set to 'true')
 * - NX_DRY_RUN environment variable (set to 'true')
 * - --dry-run command-line argument
 *
 * Also picks the dist-tag (see dist-tag.mjs), so a patch on an older release
 * line doesn't try to take `latest`.
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

import { chooseDistTag } from './dist-tag.mjs';

// Check for dry-run via environment variables or command-line arguments
// Nx passes --dryRun=true (camelCase) when using --dry-run flag
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

const { name, version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = await chooseDistTag(name, version);

const baseCommand =
    'npm publish --access public --registry https://registry.npmjs.org --no-git-checks' +
    (tag ? ` --tag ${tag}` : '');
const command = isDryRun ? `${baseCommand} --dry-run` : baseCommand;

console.log(`Executing: ${command}`);
if (isDryRun) {
    console.log('(DRY RUN MODE - no packages will be published)');
}

try {
    execSync(command, {
        stdio: 'inherit',
        cwd: process.cwd(),
        shell: process.env.SHELL || '/bin/sh',
    });
} catch (error) {
    process.exit(error.status || 1);
}
