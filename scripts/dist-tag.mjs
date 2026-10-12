#!/usr/bin/env node

/**
 * Picks the npm dist-tag a release is published under.
 *
 * `npm publish` without `--tag` moves `latest`, and refuses to when a higher
 * version is already published. A patch cut from an older `version/*` branch
 * (e.g. 0.18.4 after 0.19.0) is exactly that case, so it is published under
 * `latest-<major>.<minor>` instead and `latest` stays on the newest line.
 *
 * Usage: node scripts/dist-tag.mjs <package-name> <version>
 * Prints the tag, or nothing if the registry couldn't be read.
 */
import { pathToFileURL } from 'url';

const REGISTRY = 'https://registry.npmjs.org';

function parse(version) {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
    if (!match) {
        throw new Error(`Not a semver version: ${version}`);
    }
    return match.slice(1, 4).map(Number);
}

/**
 * Whether `a` is a higher version than `b`, comparing major.minor.patch only
 * (this repo doesn't publish prereleases).
 */
export function isHigherVersion(a, b) {
    const x = parse(a);
    const y = parse(b);
    for (let i = 0; i < 3; i++) {
        if (x[i] !== y[i]) {
            return x[i] > y[i];
        }
    }
    return false;
}

/**
 * The dist-tag for publishing `version` given the registry's current `latest`
 * (`null` if the package has never been published).
 */
export function distTagFor(version, latest) {
    if (latest == null || isHigherVersion(version, latest)) {
        return 'latest';
    }
    const [major, minor] = parse(version);
    return `latest-${major}.${minor}`;
}

/**
 * The package's current `latest` version, `null` if it has never been
 * published, or `undefined` if the registry couldn't be read.
 *
 * Reads the public registry directly rather than via `npm view`: in CI the
 * npmrc written by setup-node carries a placeholder token (OIDC publishing
 * doesn't need one), which npm would send on this read too.
 */
export async function lookupLatest(name) {
    const url = `${REGISTRY}/${name.replace('/', '%2F')}`;
    try {
        const response = await fetch(url, {
            headers: { accept: 'application/vnd.npm.install-v1+json' },
        });
        if (response.status === 404) {
            return null;
        }
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const packument = await response.json();
        return packument['dist-tags']?.latest ?? null;
    } catch (error) {
        console.warn(
            `Could not read the latest version of ${name}: ${error.message}`
        );
        return undefined;
    }
}

/**
 * The dist-tag for publishing `name@version`, or `undefined` if the registry
 * couldn't be read. Callers then publish without `--tag`, so npm's own check
 * still refuses to move `latest` backwards.
 */
export async function chooseDistTag(name, version) {
    const latest = await lookupLatest(name);
    return latest === undefined ? undefined : distTagFor(version, latest);
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    const [name, version] = process.argv.slice(2);
    if (!name || !version) {
        console.error(
            'Usage: node scripts/dist-tag.mjs <package-name> <version>'
        );
        process.exit(1);
    }
    const tag = await chooseDistTag(name, version);
    if (tag) {
        console.log(tag);
    }
}
