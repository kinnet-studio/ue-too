# `@ue-too/being-portable` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@ue-too/being-portable`, a package that loads `being` state machines from JSON documents (behavior included), safely enough to run documents written by strangers, and snapshots and restores their running state.

**Architecture:** An untrusted document is copied into frozen plain data, migrated to the current format, and validated in four passes (structure, references, types and placement). A valid document compiles into ordinary `being` classes: `PortableState` extends `TemplateState`, `PortableDelegatingState` extends `DelegatingState`, and `PortableStateMachine` extends `TemplateStateMachine`. Their actions and guards call a small interpreter. One transaction per machine tree makes every event atomic and blocks re-entry from host code. Snapshots capture the state and context of the running chain of machines.

**Tech Stack:** TypeScript (strict), Bun (runtime and test runner, with Vitest-style imports), Nx, `Bun.build` plus `tsc --emitDeclarationOnly`, TypeDoc, Prettier.

**Spec:** `packages/being/docs/specs/2026-09-29-being-portable-design.md`. Read it first; this plan implements it exactly.

**Verified:** every code block in this plan was built into a prototype package and applied task by task. After each task the prototype type-checks and passes the test count that task states. The package config was also run for real, once, through `bunx nx build`, `bunx nx test` and `docs:build` in this repo.

## Global Constraints

- Bun only (`bun`, `bunx`); never `npm`, `node`, `yarn` or `pnpm` (CLAUDE.md).
- Run package tasks from the repo root through Nx: `bunx nx test being-portable --skip-nx-cache` and `bunx nx build being-portable --skip-nx-cache`. Do not `cd` into the package to run scripts.
- The only dependency is `@ue-too/being` (`workspace:*`). No external runtime dependencies.
- No changes to `@ue-too/being`.
- TypeScript strict mode in the package; no `any` in public interfaces.
- Prettier: 4-space indent, single quotes, `es5` trailing commas. Format only `packages/being-portable` and the files you touch (`bunx prettier --write <paths>`). Never run `bun run format`: it reformats about 90 unrelated files.
- Tests import `describe`, `it` and `expect` from `'vitest'` (Bun's runner resolves it). The parity test imports `spyOn` from `'bun:test'`.
- Formats: `being-machine@1` for definitions and `being-snapshot@1` for snapshots.
- Names match `^[A-Za-z_][A-Za-z0-9_]*$`. `__proto__`, `constructor` and `prototype` are reserved everywhere; `INITIAL` and `TERMINAL` are also reserved as state names.
- Default limits: `maxNodes` 50,000, `maxMachines` 64, `maxStates` 256, `maxStatements` 256, `maxStatementDepth` 16, `maxExpressionDepth` 32, `maxNestingDepth` 8, `maxMachineInstances` 256, `maxListLength` 10,000, `maxStringLength` 10,000.
- Error codes are a public contract. Use exactly the codes in `src/errors.ts` (Task 1).
- Package version matches `packages/being/package.json` (lockstep; `0.18.0` when this was written).
- Commits: conventional, scoped `being-portable` (`feat(being-portable): …`), on branch `feat/being-portable`. Add any attribution trailer your session requires.

---

### Task 1: Scaffold the package; format types, value checks, limits and errors

**Files:**

- Create (scaffold): `packages/being-portable/` via `bun run scaffold:package being-portable`
- Modify: `packages/being-portable/package.json`, `packages/being-portable/project.json`, `packages/being-portable/tsconfig.json` (replace whole files)
- Delete: `packages/being-portable/test/being-portable.test.ts`
- Modify: `tsconfig.json` (repo root): add a project reference
- Create: `packages/being-portable/src/util.ts`, `packages/being-portable/src/limits.ts`, `packages/being-portable/src/errors.ts`, `packages/being-portable/src/format/types.ts`, `packages/being-portable/src/format/values.ts`
- Test: `packages/being-portable/test/values.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
    - `util.ts`: `hasOwn(object: object, key: string): boolean`, `entriesOf<T>(record: Readonly<Record<string, T>> | undefined): [string, T][]`, `joinPath(base: string, key: string | number): string` (gives `a.b` and `a[0]`), `describeError(error: unknown): string`
    - `limits.ts`: `type Limits`, `DEFAULT_LIMITS`, `resolveLimits(overrides?: Partial<Limits>): Limits` (throws on a non-positive or non-integer limit)
    - `errors.ts`: `LoadErrorCode`, `LoadError { code, message, path }`, `RuntimeErrorCode`, `RuntimeError { code, message, path, event, effectsCalled }`, `loadError(code, path, message)`, `class PortableRuntimeFailure(code, message, path)`, `raise(path, code, message): never`
    - `format/types.ts`: the document and snapshot types (`MachineDefinition`, `MachineBody`, `StateDefinition`, `Reaction`, `DoneReaction`, `Branch`, `ChildDefinition`, `ContextFieldDefinition`, `EffectDeclaration`, `Expr`, `GuardRef`, `Stmt`, `TypeSpec`, `Scalar`, `ScalarValue`, `Value`, `LevelSnapshot`, `MachineSnapshot`)
    - `format/values.ts`: `ValueType`, `scalarType`, `listType`, `NUMBER`, `STRING`, `BOOLEAN`, `isScalarName`, `parseTypeSpec(spec: unknown): ValueType | null`, `sameType`, `describeType`, `ValueCheck`, `checkValue(value, type, limits): 'ok' | 'type' | 'limit'`, `freezeValue(value: Value): Value`

- [ ] **Step 1: Scaffold and configure the package**

From the repo root:

```bash
bun run scaffold:package being-portable
rm packages/being-portable/test/being-portable.test.ts
```

Replace `packages/being-portable/package.json` with the following. Set `version` to the version in `packages/being/package.json` if it is no longer `0.18.0`:

```json
{
    "dependencies": {
        "@ue-too/being": "workspace:*"
    },
    "exports": {
        ".": {
            "default": "./src/index.ts",
            "import": "./src/index.ts",
            "types": "./src/index.ts"
        },
        "./*": {
            "default": "./src/*/index.ts",
            "import": "./src/*/index.ts",
            "types": "./src/*/index.ts"
        },
        "./package.json": "./package.json"
    },
    "homepage": "https://github.com/kinnet-studio/ue-too",
    "license": "MIT",
    "main": "./src/index.ts",
    "module": "./src/index.ts",
    "name": "@ue-too/being-portable",
    "repository": {
        "type": "git",
        "url": "https://github.com/kinnet-studio/ue-too.git"
    },
    "scripts": {
        "build:legacy": "rm -rf dist && rollup -c rollup.config.js",
        "test": "jest"
    },
    "type": "module",
    "types": "./src/index.ts",
    "version": "0.18.0"
}
```

Replace `packages/being-portable/project.json`. This matches `being-devtools`: it builds after `being`, keeps `being` external, and uses the i18n docs build:

```json
{
    "$schema": "../../node_modules/nx/schemas/project-schema.json",
    "name": "being-portable",
    "projectType": "library",
    "sourceRoot": "packages/being-portable/src",
    "tags": [],
    "targets": {
        "build": {
            "dependsOn": [
                {
                    "projects": ["being"],
                    "target": "build"
                }
            ],
            "executor": "nx:run-commands",
            "options": {
                "command": "rm -rf dist && bun run ../../scripts/build.ts --external @ue-too/being",
                "cwd": "packages/being-portable"
            }
        },
        "build:bun": {
            "dependsOn": [
                {
                    "projects": ["being"],
                    "target": "build"
                }
            ],
            "executor": "nx:run-commands",
            "options": {
                "command": "rm -rf dist && bun run ../../scripts/build.ts --external @ue-too/being",
                "cwd": "packages/being-portable"
            }
        },
        "docs:build": {
            "executor": "nx:run-commands",
            "options": {
                "command": "bun run ../../scripts/docs-build-i18n.ts",
                "cwd": "packages/being-portable"
            }
        },
        "move-package": {
            "executor": "nx:run-commands",
            "options": {
                "command": "node ../../scripts/move-package.mjs",
                "cwd": "packages/being-portable"
            }
        },
        "nx-release-publish": {
            "executor": "nx:run-commands",
            "options": {
                "command": "node ../../../scripts/publish-package.mjs",
                "cwd": "packages/being-portable/dist",
                "forwardAllArgs": false
            }
        },
        "test": {
            "executor": "nx:run-commands",
            "options": {
                "command": "bun test",
                "cwd": "packages/being-portable"
            }
        }
    }
}
```

Replace `packages/being-portable/tsconfig.json`. `DOM` is in `lib` because `being`'s sources use `setTimeout` and `console`:

```json
{
    "compilerOptions": {
        "baseUrl": ".",
        "composite": true,
        "declaration": true,
        "lib": ["ES2020", "DOM"],
        "module": "ESNext",
        "moduleResolution": "bundler",
        "outDir": "dist",
        "rootDir": "src",
        "strict": true,
        "tsBuildInfoFile": "dist/being-portable.tsbuildinfo",
        "types": []
    },
    "extends": "../../tsconfig.base.json",
    "include": ["src/**/*"],
    "references": [
        {
            "path": "../being"
        }
    ]
}
```

In the repo-root `tsconfig.json`, add this entry at the end of `references`, after `./packages/being-devtools`:

```json
{
    "path": "./packages/being-portable"
}
```

Then link the workspace and format the scaffolded files:

```bash
bun install
bunx prettier --write packages/being-portable tsconfig.json
```

- [ ] **Step 2: Write the failing test**

`packages/being-portable/test/values.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
    checkValue,
    describeType,
    listType,
    parseTypeSpec,
    sameType,
    scalarType,
} from '../src/format/values';
import { DEFAULT_LIMITS, resolveLimits } from '../src/limits';

describe('parseTypeSpec', () => {
    it('reads bare scalars and the object forms', () => {
        expect(parseTypeSpec('number')).toEqual(scalarType('number'));
        expect(parseTypeSpec({ type: 'string' })).toEqual(scalarType('string'));
        expect(parseTypeSpec({ type: 'list', of: 'boolean' })).toEqual(
            listType('boolean')
        );
    });

    it('rejects anything else', () => {
        expect(parseTypeSpec('object')).toBeNull();
        expect(parseTypeSpec({ type: 'list' })).toBeNull();
        expect(parseTypeSpec({ type: 'number', of: 'number' })).toBeNull();
        expect(parseTypeSpec({ type: 'list', of: 'list' })).toBeNull();
        expect(parseTypeSpec(['number'])).toBeNull();
        expect(parseTypeSpec(null)).toBeNull();
    });
});

describe('sameType and describeType', () => {
    it('compares kinds and element types', () => {
        expect(sameType(scalarType('number'), scalarType('number'))).toBe(true);
        expect(sameType(scalarType('number'), listType('number'))).toBe(false);
        expect(sameType(listType('string'), listType('number'))).toBe(false);
        expect(describeType(listType('string'))).toBe('list of string');
    });
});

describe('checkValue', () => {
    const limits = { maxListLength: 3, maxStringLength: 5 };

    it('accepts values of the type', () => {
        expect(checkValue(1.5, scalarType('number'), limits)).toBe('ok');
        expect(checkValue([true], listType('boolean'), limits)).toBe('ok');
    });

    it('reports type mismatches, including non-finite numbers', () => {
        expect(checkValue('1', scalarType('number'), limits)).toBe('type');
        expect(checkValue(Number.NaN, scalarType('number'), limits)).toBe(
            'type'
        );
        expect(checkValue([1, 'x'], listType('number'), limits)).toBe('type');
    });

    it('reports strings and lists past the limits', () => {
        expect(checkValue('toolong', scalarType('string'), limits)).toBe(
            'limit'
        );
        expect(checkValue([1, 2, 3, 4], listType('number'), limits)).toBe(
            'limit'
        );
        expect(checkValue(['toolong'], listType('string'), limits)).toBe(
            'limit'
        );
    });
});

describe('resolveLimits', () => {
    it('applies overrides over the defaults', () => {
        const limits = resolveLimits({ maxStates: 4 });
        expect(limits.maxStates).toBe(4);
        expect(limits.maxNodes).toBe(DEFAULT_LIMITS.maxNodes);
        expect(Object.isFrozen(limits)).toBe(true);
    });

    it('throws on a non-positive or fractional limit', () => {
        expect(() => resolveLimits({ maxStates: 0 })).toThrow('maxStates');
        expect(() => resolveLimits({ maxNodes: 1.5 })).toThrow('maxNodes');
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: FAIL with `Cannot find module '../src/format/values'`.

- [ ] **Step 4: Write the implementation**

`packages/being-portable/src/util.ts`:

```ts
const hasOwnProperty = Object.prototype.hasOwnProperty;

/** Own-property check that works on null-prototype objects. */
export function hasOwn(object: object, key: string): boolean {
    return hasOwnProperty.call(object, key);
}

/** `[key, value]` pairs of a record, or none when the record is absent. */
export function entriesOf<T>(
    record: Readonly<Record<string, T>> | undefined
): [string, T][] {
    if (record === undefined) {
        return [];
    }
    return Object.keys(record).map(key => [key, record[key]]);
}

/** Appends a key or index to a JSON path: `a.b`, `a[0]`. */
export function joinPath(base: string, key: string | number): string {
    if (typeof key === 'number') {
        return `${base}[${key}]`;
    }
    return base === '' ? key : `${base}.${key}`;
}

/** A readable message from anything thrown. */
export function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
```

`packages/being-portable/src/limits.ts`:

```ts
/**
 * Caps that keep a document from a stranger from exhausting memory.
 *
 * @category Types
 */
export type Limits = {
    /** Total JSON values in a document or snapshot. */
    readonly maxNodes: number;
    /** Machines in `machines` plus the root. */
    readonly maxMachines: number;
    /** States per machine. */
    readonly maxStates: number;
    /** Statements per list. */
    readonly maxStatements: number;
    /** Nested `if` depth. */
    readonly maxStatementDepth: number;
    /** Expression nesting depth. */
    readonly maxExpressionDepth: number;
    /** Child-machine nesting depth. */
    readonly maxNestingDepth: number;
    /** Machine instances the tree builds. */
    readonly maxMachineInstances: number;
    /** Items in any list value. */
    readonly maxListLength: number;
    /** Characters in any string value. */
    readonly maxStringLength: number;
};

/**
 * The limits used when a host does not override them.
 *
 * @category Core
 */
export const DEFAULT_LIMITS: Limits = Object.freeze({
    maxNodes: 50_000,
    maxMachines: 64,
    maxStates: 256,
    maxStatements: 256,
    maxStatementDepth: 16,
    maxExpressionDepth: 32,
    maxNestingDepth: 8,
    maxMachineInstances: 256,
    maxListLength: 10_000,
    maxStringLength: 10_000,
});

/** Defaults with overrides applied. Throws on a non-positive or non-integer override. */
export function resolveLimits(overrides: Partial<Limits> = {}): Limits {
    const merged: Limits = { ...DEFAULT_LIMITS, ...overrides };
    for (const [name, value] of Object.entries(merged)) {
        if (!Number.isInteger(value) || value < 1) {
            throw new Error(`limit ${name} must be a positive integer`);
        }
    }
    return Object.freeze(merged);
}
```

`packages/being-portable/src/errors.ts`:

```ts
/**
 * Why a definition or snapshot was rejected.
 *
 * @category Types
 */
export type LoadErrorCode =
    | 'not-plain-data'
    | 'limit-exceeded'
    | 'unsupported-format'
    | 'invalid-structure'
    | 'invalid-name'
    | 'reserved-name'
    | 'unknown-state'
    | 'unknown-event'
    | 'unknown-field'
    | 'unknown-effect'
    | 'unknown-guard'
    | 'unknown-machine'
    | 'unknown-operator'
    | 'machine-cycle'
    | 'type-mismatch'
    | 'arity-mismatch'
    | 'misplaced'
    | 'empty-list-needs-type'
    | 'output-not-declared'
    | 'into-without-returns'
    | 'child-event-mismatch'
    | 'on-done-without-child'
    | 'on-done-unreachable'
    | 'final-initial-state'
    | 'final-state-has-reactions'
    | 'missing-effect'
    | 'effect-signature-mismatch'
    | 'machine-mismatch'
    | 'revision-mismatch'
    | 'state-missing'
    | 'field-mismatch'
    | 'child-missing'
    | 'child-unexpected'
    | 'reentrant-call';

/**
 * One problem found while loading a definition or restoring a snapshot.
 *
 * @category Types
 */
export type LoadError = {
    readonly code: LoadErrorCode;
    readonly message: string;
    /** JSON path into the document, e.g. `states.READY.on.select.do[1]`. */
    readonly path: string;
};

/**
 * Why an event, start, reset or wrapup failed.
 *
 * @category Types
 */
export type RuntimeErrorCode =
    | 'payload-mismatch'
    | 'index-out-of-range'
    | 'not-an-integer'
    | 'invalid-range'
    | 'non-finite-number'
    | 'limit-exceeded'
    | 'effect-failed'
    | 'effect-return-mismatch'
    | 'service-invalid'
    | 'reentrant-call';

/**
 * A failure reported to the host's `onError`. The machine tree has already
 * been rolled back when this is reported.
 *
 * @category Types
 */
export type RuntimeError = {
    readonly code: RuntimeErrorCode;
    readonly message: string;
    /** JSON path of the statement or guard that failed. */
    readonly path: string;
    /** The event being handled, or `null` for start, reset and wrapup. */
    readonly event: string | null;
    /** Effects that ran before the failure. They are not undone. */
    readonly effectsCalled: readonly string[];
};

export function loadError(
    code: LoadErrorCode,
    path: string,
    message: string
): LoadError {
    return { code, path, message };
}

/** Thrown inside the interpreter; the transaction turns it into a {@link RuntimeError}. */
export class PortableRuntimeFailure extends Error {
    readonly code: RuntimeErrorCode;
    readonly path: string;

    constructor(code: RuntimeErrorCode, message: string, path: string) {
        super(message);
        this.name = 'PortableRuntimeFailure';
        this.code = code;
        this.path = path;
    }
}

/** Throws a {@link PortableRuntimeFailure} at `path`. */
export function raise(
    path: string,
    code: RuntimeErrorCode,
    message: string
): never {
    throw new PortableRuntimeFailure(code, message, path);
}
```

`packages/being-portable/src/format/types.ts`:

```ts
/**
 * A scalar type name.
 *
 * @category Types
 */
export type Scalar = 'number' | 'string' | 'boolean';

/**
 * A type written in a document: a bare scalar name, `{ "type": scalar }`, or
 * `{ "type": "list", "of": scalar }`.
 *
 * @category Types
 */
export type TypeSpec =
    | Scalar
    | { readonly type: Scalar }
    | { readonly type: 'list'; readonly of: Scalar };

/**
 * A scalar value.
 *
 * @category Types
 */
export type ScalarValue = number | string | boolean;

/**
 * Any value a portable machine can hold: a scalar or a list of one scalar
 * type. Lists are always frozen.
 *
 * @category Types
 */
export type Value = ScalarValue | readonly ScalarValue[];

/**
 * An expression. Bare scalars are literals.
 *
 * @category Types
 */
export type Expr =
    | ScalarValue
    | { readonly list: readonly Expr[]; readonly of?: Scalar }
    | { readonly ctx: string }
    | { readonly payload: string }
    | { readonly childCtx: string }
    | { readonly op: string; readonly args?: readonly Expr[] };

/**
 * A guard reference: the name of an entry in the state's `guards`, or an
 * inline boolean expression.
 *
 * @category Types
 */
export type GuardRef = string | Expr;

/**
 * A statement.
 *
 * @category Types
 */
export type Stmt =
    | { readonly set: string; readonly to: Expr }
    | { readonly push: string; readonly value: Expr }
    | { readonly removeAt: string; readonly index: Expr }
    | {
          readonly if: Expr;
          readonly then: readonly Stmt[];
          readonly else?: readonly Stmt[];
      }
    | {
          readonly call: string;
          readonly args?: Readonly<Record<string, Expr>>;
          readonly into?: string;
      }
    | { readonly output: Expr };

/**
 * A conditional transition, checked after `do`.
 *
 * @category Types
 */
export type Branch = { readonly if: GuardRef; readonly target: string };

/**
 * What a state does when it receives one event.
 *
 * @category Types
 */
export type Reaction = {
    readonly require?: readonly GuardRef[];
    readonly do?: readonly Stmt[];
    readonly branches?: readonly Branch[];
    readonly target?: string;
};

/**
 * What a state does when its child machine reaches a final state.
 *
 * @category Types
 */
export type DoneReaction = Omit<Reaction, 'require'>;

/**
 * A state hosting a child machine.
 *
 * @category Types
 */
export type ChildDefinition = {
    readonly machine: string;
    readonly with?: Readonly<Record<string, Expr>>;
};

/**
 * One state.
 *
 * @category Types
 */
export type StateDefinition = {
    readonly final?: boolean;
    readonly guards?: Readonly<Record<string, Expr>>;
    readonly enter?: readonly Stmt[];
    readonly exit?: readonly Stmt[];
    readonly on?: Readonly<Record<string, Reaction>>;
    readonly child?: ChildDefinition;
    readonly onDone?: DoneReaction;
};

/**
 * One context field with its type and initial value.
 *
 * @category Types
 */
export type ContextFieldDefinition =
    | { readonly type: Scalar; readonly initial: ScalarValue }
    | {
          readonly type: 'list';
          readonly of: Scalar;
          readonly initial: readonly ScalarValue[];
      };

/**
 * A host capability a document calls.
 *
 * @category Types
 */
export type EffectDeclaration = {
    readonly args: Readonly<Record<string, TypeSpec>>;
    readonly returns?: TypeSpec;
};

/**
 * The parts every machine has, root or child.
 *
 * @category Types
 */
export type MachineBody = {
    readonly context: Readonly<Record<string, ContextFieldDefinition>>;
    readonly events: Readonly<
        Record<string, Readonly<Record<string, TypeSpec>>>
    >;
    readonly outputs?: Readonly<Record<string, TypeSpec>>;
    readonly initialState: string;
    readonly states: Readonly<Record<string, StateDefinition>>;
};

/**
 * A complete portable machine definition document.
 *
 * @category Types
 */
export type MachineDefinition = MachineBody & {
    readonly format: 'being-machine@1';
    readonly id: string;
    readonly revision: number;
    readonly effects?: Readonly<Record<string, EffectDeclaration>>;
    readonly machines?: Readonly<Record<string, MachineBody>>;
};

/**
 * The running state of one machine level inside a snapshot.
 *
 * @category Types
 */
export type LevelSnapshot = {
    readonly state: string;
    readonly context: Readonly<Record<string, Value>>;
    readonly child?: LevelSnapshot;
};

/**
 * A snapshot of a running machine tree.
 *
 * @category Types
 */
export type MachineSnapshot = LevelSnapshot & {
    readonly format: 'being-snapshot@1';
    readonly machine: { readonly id: string; readonly revision: number };
};
```

`packages/being-portable/src/format/values.ts`:

```ts
import { Limits } from '../limits';
import { Scalar, Value } from './types';

/** The canonical form of a {@link TypeSpec}. */
export type ValueType =
    | { readonly kind: 'scalar'; readonly scalar: Scalar }
    | { readonly kind: 'list'; readonly of: Scalar };

export function scalarType(scalar: Scalar): ValueType {
    return { kind: 'scalar', scalar };
}

export function listType(of: Scalar): ValueType {
    return { kind: 'list', of };
}

export const NUMBER = scalarType('number');
export const STRING = scalarType('string');
export const BOOLEAN = scalarType('boolean');

export function isScalarName(value: unknown): value is Scalar {
    return value === 'number' || value === 'string' || value === 'boolean';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses a TypeSpec; `null` when it is not one. */
export function parseTypeSpec(spec: unknown): ValueType | null {
    if (isScalarName(spec)) {
        return scalarType(spec);
    }
    if (!isRecord(spec)) {
        return null;
    }
    const keys = Object.keys(spec).sort().join(',');
    if (keys === 'type' && isScalarName(spec.type)) {
        return scalarType(spec.type);
    }
    if (keys === 'of,type' && spec.type === 'list' && isScalarName(spec.of)) {
        return listType(spec.of);
    }
    return null;
}

export function sameType(a: ValueType, b: ValueType): boolean {
    if (a.kind === 'scalar' && b.kind === 'scalar') {
        return a.scalar === b.scalar;
    }
    if (a.kind === 'list' && b.kind === 'list') {
        return a.of === b.of;
    }
    return false;
}

export function describeType(type: ValueType): string {
    return type.kind === 'scalar' ? type.scalar : `list of ${type.of}`;
}

export type ValueCheck = 'ok' | 'type' | 'limit';

type ValueLimits = Pick<Limits, 'maxListLength' | 'maxStringLength'>;

function checkScalar(
    value: unknown,
    scalar: Scalar,
    limits: ValueLimits
): ValueCheck {
    if (scalar === 'number') {
        return typeof value === 'number' && Number.isFinite(value)
            ? 'ok'
            : 'type';
    }
    if (scalar === 'boolean') {
        return typeof value === 'boolean' ? 'ok' : 'type';
    }
    if (typeof value !== 'string') {
        return 'type';
    }
    return value.length > limits.maxStringLength ? 'limit' : 'ok';
}

/** Whether `value` has `type` and fits the list and string limits. */
export function checkValue(
    value: unknown,
    type: ValueType,
    limits: ValueLimits
): ValueCheck {
    if (type.kind === 'scalar') {
        return checkScalar(value, type.scalar, limits);
    }
    if (!Array.isArray(value)) {
        return 'type';
    }
    if (value.length > limits.maxListLength) {
        return 'limit';
    }
    for (const item of value) {
        const check = checkScalar(item, type.of, limits);
        if (check !== 'ok') {
            return check;
        }
    }
    return 'ok';
}

/** Scalars as they are; lists copied and frozen. */
export function freezeValue(value: Value): Value {
    return typeof value === 'object' ? Object.freeze([...value]) : value;
}
```

- [ ] **Step 5: Run the tests and the build**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: PASS, 8 tests.

Run: `bunx nx build being-portable --skip-nx-cache`
Expected: `Successfully ran target build for project being-portable`. The build also runs `tsc --emitDeclarationOnly`, so a type error fails it.

- [ ] **Step 6: Commit**

```bash
bunx prettier --write packages/being-portable
git add packages/being-portable tsconfig.json bun.lock
git commit -m "feat(being-portable): scaffold package with format types and value checks"
```

---

### Task 2: The copy step and format migrations

**Files:**

- Create: `packages/being-portable/src/copy.ts`
- Create: `packages/being-portable/src/migrate.ts`
- Test: `packages/being-portable/test/copy.test.ts`

**Interfaces:**

- Consumes: `LoadError`, `loadError` (Task 1); `Limits` (Task 1); `joinPath` (Task 1).
- Produces:
    - `copy.ts`: `type PlainData`, `type PlainObject`, `MAX_COPY_DEPTH = 256`, `type CopyResult = { ok: true; value: PlainData } | { ok: false; errors: LoadError[] }`, `isPlainObject(value)`, `copyPlainData(input: unknown, limits: Pick<Limits, 'maxNodes' | 'maxStringLength'>): CopyResult`
    - `migrate.ts`: `MACHINE_FORMAT = 'being-machine@1'`, `SNAPSHOT_FORMAT = 'being-snapshot@1'`, `type MigrateResult`, `migrateDefinition(document: PlainData): MigrateResult`, `migrateSnapshot(document: PlainData): MigrateResult`

- [ ] **Step 1: Write the failing test**

`packages/being-portable/test/copy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { MAX_COPY_DEPTH, copyPlainData } from '../src/copy';
import { DEFAULT_LIMITS } from '../src/limits';
import { migrateDefinition, migrateSnapshot } from '../src/migrate';

const limits = DEFAULT_LIMITS;

function errorOf(input: unknown, override = limits) {
    const result = copyPlainData(input, override);
    if (result.ok) {
        throw new Error('expected the copy to fail');
    }
    return result.errors[0];
}

describe('copyPlainData', () => {
    it('copies JSON data into frozen null-prototype objects', () => {
        const input = { a: [1, 'x', true, null], b: { c: 2 } };
        const result = copyPlainData(input, limits);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const value = result.value as any;
        expect(value).toEqual(input);
        expect(value).not.toBe(input);
        expect(Object.getPrototypeOf(value)).toBeNull();
        expect(Object.isFrozen(value)).toBe(true);
        expect(Object.isFrozen(value.a)).toBe(true);
        input.b.c = 99;
        expect(value.b.c).toBe(2);
    });

    it('keeps __proto__ as an ordinary own key', () => {
        const input = JSON.parse('{"__proto__": {"polluted": true}}');
        const result = copyPlainData(input, limits);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const value = result.value as any;
        expect(Object.keys(value)).toEqual(['__proto__']);
        expect(({} as any).polluted).toBeUndefined();
    });

    it('rejects functions, symbols, undefined and class instances', () => {
        expect(errorOf({ f: () => 1 })).toMatchObject({
            code: 'not-plain-data',
            path: 'f',
        });
        expect(errorOf({ [Symbol('s')]: 1 }).code).toBe('not-plain-data');
        expect(errorOf([undefined]).path).toBe('[0]');
        expect(errorOf({ d: new Date() })).toMatchObject({
            code: 'not-plain-data',
            path: 'd',
        });
    });

    it('rejects accessors, holes and non-finite numbers', () => {
        const withGetter = Object.defineProperty({}, 'x', {
            get: () => 1,
            enumerable: true,
        });
        expect(errorOf(withGetter)).toMatchObject({
            code: 'not-plain-data',
            path: 'x',
        });
        expect(errorOf([1, , 3]).path).toBe('[1]');
        expect(errorOf({ n: Number.POSITIVE_INFINITY }).code).toBe(
            'not-plain-data'
        );
    });

    it('rejects cycles but allows shared references', () => {
        const cyclic: any = { a: {} };
        cyclic.a.back = cyclic;
        expect(errorOf(cyclic)).toMatchObject({
            code: 'not-plain-data',
            path: 'a.back',
        });
        const shared = { x: 1 };
        expect(copyPlainData({ a: shared, b: shared }, limits).ok).toBe(true);
    });

    it('stops at maxNodes, maxStringLength and the depth cap', () => {
        const small = { ...limits, maxNodes: 3 };
        expect(errorOf([1, 2, 3], small).code).toBe('limit-exceeded');
        expect(
            errorOf('x'.repeat(11), { ...limits, maxStringLength: 10 }).code
        ).toBe('limit-exceeded');
        let deep: unknown = 1;
        for (let i = 0; i <= MAX_COPY_DEPTH; i++) {
            deep = [deep];
        }
        expect(errorOf(deep).code).toBe('limit-exceeded');
    });
});

describe('migrate', () => {
    it('accepts the current formats', () => {
        expect(migrateDefinition({ format: 'being-machine@1' }).ok).toBe(true);
        expect(migrateSnapshot({ format: 'being-snapshot@1' }).ok).toBe(true);
    });

    it('rejects unknown or newer formats', () => {
        const result = migrateDefinition({ format: 'being-machine@2' });
        expect(result).toMatchObject({
            ok: false,
            errors: [{ code: 'unsupported-format', path: 'format' }],
        });
    });

    it('rejects a missing format or a non-object', () => {
        expect(migrateDefinition({})).toMatchObject({
            ok: false,
            errors: [{ code: 'invalid-structure', path: 'format' }],
        });
        expect(migrateDefinition([])).toMatchObject({
            ok: false,
            errors: [{ code: 'invalid-structure', path: '' }],
        });
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: FAIL with `Cannot find module '../src/copy'`.

- [ ] **Step 3: Write the implementation**

`packages/being-portable/src/copy.ts`:

```ts
import { LoadError, loadError } from './errors';
import { Limits } from './limits';
import { joinPath } from './util';

/** JSON-shaped data: the only thing the package reads from callers. */
export type PlainData =
    | null
    | boolean
    | number
    | string
    | readonly PlainData[]
    | PlainObject;

export type PlainObject = { readonly [key: string]: PlainData };

/** Nesting cap for the copy walk, so recursion never exhausts the call stack. */
export const MAX_COPY_DEPTH = 256;

export type CopyResult =
    | { readonly ok: true; readonly value: PlainData }
    | { readonly ok: false; readonly errors: LoadError[] };

export function isPlainObject(
    value: PlainData | undefined
): value is PlainObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class Stop {
    constructor(readonly error: LoadError) {}
}

/**
 * Copies `input` into fresh, frozen, null-prototype plain data.
 *
 * Rejects functions, symbols, class instances, accessors, holes, cycles and
 * non-finite numbers, and stops at `maxNodes`, `maxStringLength` or
 * {@link MAX_COPY_DEPTH}.
 */
export function copyPlainData(
    input: unknown,
    limits: Pick<Limits, 'maxNodes' | 'maxStringLength'>
): CopyResult {
    let nodes = 0;
    const ancestors = new Set<object>();

    const stop = (
        code: 'not-plain-data' | 'limit-exceeded',
        path: string,
        message: string
    ): never => {
        throw new Stop(loadError(code, path, message));
    };

    const visit = (value: unknown, path: string, depth: number): PlainData => {
        nodes += 1;
        if (nodes > limits.maxNodes) {
            stop('limit-exceeded', path, `more than ${limits.maxNodes} values`);
        }
        if (depth > MAX_COPY_DEPTH) {
            stop(
                'limit-exceeded',
                path,
                `nested deeper than ${MAX_COPY_DEPTH} levels`
            );
        }
        if (value === null || typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) {
                stop('not-plain-data', path, 'numbers must be finite');
            }
            return value;
        }
        if (typeof value === 'string') {
            if (value.length > limits.maxStringLength) {
                stop(
                    'limit-exceeded',
                    path,
                    `string longer than ${limits.maxStringLength} characters`
                );
            }
            return value;
        }
        if (typeof value !== 'object') {
            return stop(
                'not-plain-data',
                path,
                `${typeof value} is not JSON data`
            );
        }
        if (ancestors.has(value)) {
            stop('not-plain-data', path, 'the data contains a cycle');
        }
        ancestors.add(value);
        try {
            if (Array.isArray(value)) {
                if (Object.getPrototypeOf(value) !== Array.prototype) {
                    stop('not-plain-data', path, 'only plain arrays are data');
                }
                const out: PlainData[] = [];
                for (let index = 0; index < value.length; index++) {
                    const itemPath = joinPath(path, index);
                    const descriptor = Object.getOwnPropertyDescriptor(
                        value,
                        index
                    );
                    if (descriptor === undefined || !('value' in descriptor)) {
                        stop(
                            'not-plain-data',
                            itemPath,
                            'arrays may not have holes or accessors'
                        );
                    }
                    out.push(visit(descriptor!.value, itemPath, depth + 1));
                }
                return Object.freeze(out);
            }
            const prototype = Object.getPrototypeOf(value);
            if (prototype !== Object.prototype && prototype !== null) {
                stop('not-plain-data', path, 'only plain objects are data');
            }
            if (Object.getOwnPropertySymbols(value).length > 0) {
                stop('not-plain-data', path, 'symbol keys are not data');
            }
            const out: Record<string, PlainData> = Object.create(null);
            for (const key of Object.keys(value)) {
                const keyPath = joinPath(path, key);
                if (key.length > limits.maxStringLength) {
                    stop(
                        'limit-exceeded',
                        path,
                        `key longer than ${limits.maxStringLength} characters`
                    );
                }
                const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
                if (!('value' in descriptor)) {
                    stop('not-plain-data', keyPath, 'accessors are not data');
                }
                out[key] = visit(descriptor.value, keyPath, depth + 1);
            }
            return Object.freeze(out);
        } finally {
            ancestors.delete(value);
        }
    };

    try {
        return { ok: true, value: visit(input, '', 0) };
    } catch (error) {
        if (error instanceof Stop) {
            return { ok: false, errors: [error.error] };
        }
        throw error;
    }
}
```

`packages/being-portable/src/migrate.ts`:

```ts
import { PlainData, PlainObject, isPlainObject } from './copy';
import { LoadError, loadError } from './errors';

/** The definition format this version reads and writes. */
export const MACHINE_FORMAT = 'being-machine@1';

/** The snapshot format this version reads and writes. */
export const SNAPSHOT_FORMAT = 'being-snapshot@1';

type Migration = {
    readonly from: string;
    readonly migrate: (document: PlainObject) => PlainObject;
};

// Each entry upgrades one older format to the next. Empty until @2 exists.
const MACHINE_MIGRATIONS: readonly Migration[] = [];
const SNAPSHOT_MIGRATIONS: readonly Migration[] = [];

export type MigrateResult =
    | { readonly ok: true; readonly value: PlainObject }
    | { readonly ok: false; readonly errors: LoadError[] };

function migrate(
    document: PlainData,
    current: string,
    migrations: readonly Migration[]
): MigrateResult {
    if (!isPlainObject(document)) {
        return {
            ok: false,
            errors: [loadError('invalid-structure', '', 'expected an object')],
        };
    }
    let value = document;
    for (let step = 0; step <= migrations.length; step++) {
        const format = value.format;
        if (typeof format !== 'string') {
            return {
                ok: false,
                errors: [
                    loadError(
                        'invalid-structure',
                        'format',
                        'format must be a string'
                    ),
                ],
            };
        }
        if (format === current) {
            return { ok: true, value };
        }
        const next = migrations.find(migration => migration.from === format);
        if (next === undefined) {
            break;
        }
        value = next.migrate(value);
    }
    return {
        ok: false,
        errors: [
            loadError(
                'unsupported-format',
                'format',
                `format "${String(value.format)}" is not supported; this version reads ${current}`
            ),
        ],
    };
}

export function migrateDefinition(document: PlainData): MigrateResult {
    return migrate(document, MACHINE_FORMAT, MACHINE_MIGRATIONS);
}

export function migrateSnapshot(document: PlainData): MigrateResult {
    return migrate(document, SNAPSHOT_FORMAT, SNAPSHOT_MIGRATIONS);
}
```

- [ ] **Step 4: Run the tests and the build**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: PASS, 17 tests.

Run: `bunx nx build being-portable --skip-nx-cache`
Expected: `Successfully ran target build for project being-portable`.

- [ ] **Step 5: Commit**

```bash
bunx prettier --write packages/being-portable
git add packages/being-portable
git commit -m "feat(being-portable): copy untrusted input into frozen plain data; format migrations"
```

---

### Task 3: Validator pass 1: structure and name rules

**Files:**

- Create: `packages/being-portable/src/validate/names.ts`
- Create: `packages/being-portable/src/validate/structure.ts`
- Create (test helper): `packages/being-portable/test/fixtures.ts`
- Test: `packages/being-portable/test/structure.test.ts`

**Interfaces:**

- Consumes: `PlainData`, `PlainObject`, `isPlainObject` (Task 2); `checkValue`, `describeType`, `isScalarName`, `parseTypeSpec` (Task 1); `LoadError`, `loadError` (Task 1); `hasOwn`, `joinPath` (Task 1).
- Produces:
    - `validate/names.ts`: `NAME_PATTERN`, `type NameKind`, `checkName(value: unknown, path: string, kind: NameKind): LoadError | null`
    - `validate/structure.ts`: `checkStructure(document: PlainObject, limits: Limits): LoadError[]`. When it returns `[]`, the document can be read as a `MachineDefinition`.
    - `test/fixtures.ts`: `type Doc`, `vendingDoc()`, `gameDoc()`. Each returns a fresh, editable document; later tasks use them.

- [ ] **Step 1: Write the failing test**

The fixtures file is a test helper; later tasks reuse it.

`packages/being-portable/test/fixtures.ts`:

```ts
/** A loosely typed document tests can edit freely before loading. */
export type Doc = Record<string, any>;

const plus = (field: string, payloadField: string) => ({
    set: field,
    to: { op: '+', args: [{ ctx: field }, { payload: payloadField }] },
});

/** The vending machine from the design spec. Fresh object every call. */
export function vendingDoc(): Doc {
    return {
        format: 'being-machine@1',
        id: 'vending',
        revision: 1,
        context: {
            balance: { type: 'number', initial: 0 },
            sold: { type: 'list', of: 'string', initial: [] },
        },
        events: {
            insertCoin: { amount: 'number' },
            select: { item: 'string', price: 'number' },
            cancel: {},
        },
        outputs: { select: 'number' },
        effects: {
            dispense: { args: { item: 'string' } },
            refund: { args: { amount: 'number' } },
        },
        initialState: 'IDLE',
        states: {
            IDLE: {
                on: {
                    insertCoin: {
                        do: [plus('balance', 'amount')],
                        target: 'HAS_MONEY',
                    },
                },
            },
            HAS_MONEY: {
                guards: {
                    canAfford: {
                        op: '>=',
                        args: [{ ctx: 'balance' }, { payload: 'price' }],
                    },
                },
                on: {
                    insertCoin: { do: [plus('balance', 'amount')] },
                    select: {
                        require: ['canAfford'],
                        do: [
                            {
                                call: 'dispense',
                                args: { item: { payload: 'item' } },
                            },
                            {
                                set: 'balance',
                                to: {
                                    op: '-',
                                    args: [
                                        { ctx: 'balance' },
                                        { payload: 'price' },
                                    ],
                                },
                            },
                            { push: 'sold', value: { payload: 'item' } },
                            { output: { ctx: 'balance' } },
                        ],
                        branches: [
                            {
                                if: { op: '>', args: [{ ctx: 'balance' }, 0] },
                                target: 'HAS_MONEY',
                            },
                        ],
                        target: 'IDLE',
                    },
                    cancel: {
                        do: [
                            {
                                call: 'refund',
                                args: { amount: { ctx: 'balance' } },
                            },
                            { set: 'balance', to: 0 },
                        ],
                        target: 'IDLE',
                    },
                },
            },
        },
    };
}

/** A two-level game: PLAYING hosts a `turn` child that finishes in DONE. */
export function gameDoc(): Doc {
    return {
        format: 'being-machine@1',
        id: 'game',
        revision: 1,
        context: {
            players: { type: 'number', initial: 2 },
            score: { type: 'number', initial: 0 },
            log: { type: 'list', of: 'string', initial: [] },
        },
        events: { begin: {}, roll: { value: 'number' }, quit: {} },
        effects: { note: { args: { text: 'string' } } },
        machines: {
            turn: {
                context: {
                    points: { type: 'number', initial: 0 },
                    playerCount: { type: 'number', initial: 0 },
                },
                events: { roll: { value: 'number' } },
                initialState: 'ROLLING',
                states: {
                    ROLLING: {
                        enter: [
                            {
                                call: 'note',
                                args: { text: 'turn starts' },
                            },
                        ],
                        exit: [{ call: 'note', args: { text: 'turn ends' } }],
                        on: {
                            roll: {
                                do: [
                                    {
                                        set: 'points',
                                        to: {
                                            op: '*',
                                            args: [
                                                { payload: 'value' },
                                                { ctx: 'playerCount' },
                                            ],
                                        },
                                    },
                                ],
                                target: 'DONE',
                            },
                        },
                    },
                    DONE: { final: true },
                },
            },
        },
        initialState: 'LOBBY',
        states: {
            LOBBY: { on: { begin: { target: 'PLAYING' } } },
            PLAYING: {
                enter: [{ push: 'log', value: 'enter PLAYING' }],
                exit: [{ push: 'log', value: 'exit PLAYING' }],
                child: {
                    machine: 'turn',
                    with: { playerCount: { ctx: 'players' } },
                },
                onDone: {
                    do: [
                        {
                            set: 'score',
                            to: {
                                op: '+',
                                args: [
                                    { ctx: 'score' },
                                    { childCtx: 'points' },
                                ],
                            },
                        },
                    ],
                    target: 'LOBBY',
                },
                on: { quit: { target: 'LOBBY' } },
            },
        },
    };
}
```

`packages/being-portable/test/structure.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { PlainObject, copyPlainData } from '../src/copy';
import { DEFAULT_LIMITS, Limits } from '../src/limits';
import { checkStructure } from '../src/validate/structure';
import { Doc, vendingDoc } from './fixtures';

function structureErrors(doc: Doc, limits: Limits = DEFAULT_LIMITS) {
    const copied = copyPlainData(doc, limits);
    if (!copied.ok) {
        throw new Error('fixture is not plain data');
    }
    return checkStructure(copied.value as PlainObject, limits).map(
        ({ code, path }) => ({ code, path })
    );
}

describe('checkStructure', () => {
    it('accepts the vending machine', () => {
        expect(structureErrors(vendingDoc())).toEqual([]);
    });

    it('reports missing and unknown keys', () => {
        const doc = vendingDoc();
        delete doc.initialState;
        doc.extra = true;
        expect(structureErrors(doc)).toEqual([
            { code: 'invalid-structure', path: '' },
            { code: 'invalid-structure', path: 'extra' },
        ]);
    });

    it('checks id and revision', () => {
        const doc = vendingDoc();
        doc.id = 'has space';
        doc.revision = -1;
        expect(structureErrors(doc)).toEqual([
            { code: 'invalid-name', path: 'id' },
            { code: 'invalid-structure', path: 'revision' },
        ]);
    });

    it('rejects reserved names in every name position', () => {
        const doc = vendingDoc();
        doc.context.__proto__x = undefined;
        doc.context = JSON.parse(
            '{"__proto__": {"type": "number", "initial": 0}}'
        );
        doc.states.INITIAL = {};
        doc.events.constructor = {};
        expect(structureErrors(doc)).toEqual([
            { code: 'reserved-name', path: 'context.__proto__' },
            { code: 'reserved-name', path: 'events.constructor' },
            { code: 'reserved-name', path: 'states.INITIAL' },
        ]);
    });

    it('checks context fields and their initial values', () => {
        const doc = vendingDoc();
        doc.context.balance.initial = 'zero';
        doc.context.bad = { type: 'object', initial: 1 };
        doc.context.items = { type: 'list', initial: [] };
        expect(structureErrors(doc)).toEqual([
            { code: 'type-mismatch', path: 'context.balance.initial' },
            { code: 'invalid-structure', path: 'context.bad.type' },
            { code: 'invalid-structure', path: 'context.items' },
            { code: 'invalid-structure', path: 'context.items.type' },
        ]);
    });

    it('checks type specs in events, outputs and effects', () => {
        const doc = vendingDoc();
        doc.events.select.price = 'float';
        doc.outputs.select = { type: 'list' };
        doc.effects.refund.returns = 'void';
        expect(structureErrors(doc)).toEqual([
            { code: 'invalid-structure', path: 'effects.refund.returns' },
            { code: 'invalid-structure', path: 'events.select.price' },
            { code: 'invalid-structure', path: 'outputs.select' },
        ]);
    });

    it('requires exactly one statement kind', () => {
        const doc = vendingDoc();
        doc.states.IDLE.on.insertCoin.do = [
            { set: 'balance', push: 'sold', to: 1 },
            { nope: 1 },
            'set',
        ];
        expect(structureErrors(doc)).toEqual([
            {
                code: 'invalid-structure',
                path: 'states.IDLE.on.insertCoin.do[0]',
            },
            {
                code: 'invalid-structure',
                path: 'states.IDLE.on.insertCoin.do[1]',
            },
            {
                code: 'invalid-structure',
                path: 'states.IDLE.on.insertCoin.do[2]',
            },
        ]);
    });

    it('requires exactly one expression kind', () => {
        const doc = vendingDoc();
        doc.states.IDLE.on.insertCoin.do = [
            { set: 'balance', to: { ctx: 'balance', payload: 'amount' } },
            { set: 'balance', to: null },
            { set: 'balance', to: [1] },
        ];
        expect(structureErrors(doc).map(error => error.path)).toEqual([
            'states.IDLE.on.insertCoin.do[0].to',
            'states.IDLE.on.insertCoin.do[1].to',
            'states.IDLE.on.insertCoin.do[2].to',
        ]);
    });

    it('allows require only in on reactions', () => {
        const doc = vendingDoc();
        doc.states.HAS_MONEY.onDone = { require: ['canAfford'] };
        expect(structureErrors(doc)).toEqual([
            {
                code: 'invalid-structure',
                path: 'states.HAS_MONEY.onDone.require',
            },
        ]);
    });

    it('enforces the structural limits', () => {
        const limits: Limits = {
            ...DEFAULT_LIMITS,
            maxStates: 1,
            maxStatements: 1,
            maxExpressionDepth: 1,
            maxStatementDepth: 1,
        };
        const doc = vendingDoc();
        doc.states.IDLE.on.insertCoin.do.push({ set: 'balance', to: 0 });
        doc.states.HAS_MONEY.enter = [
            { if: true, then: [{ if: true, then: [] }] },
        ];
        const codes = structureErrors(doc, limits);
        expect(codes).toContainEqual({
            code: 'limit-exceeded',
            path: 'states',
        });
        expect(codes).toContainEqual({
            code: 'limit-exceeded',
            path: 'states.IDLE.on.insertCoin.do',
        });
        expect(codes).toContainEqual({
            code: 'limit-exceeded',
            path: 'states.IDLE.on.insertCoin.do[0].to.args[0]',
        });
        expect(codes).toContainEqual({
            code: 'limit-exceeded',
            path: 'states.HAS_MONEY.enter[0].then[0]',
        });
    });

    it('checks child and machines', () => {
        const doc = vendingDoc();
        doc.machines = { inner: { states: {} } };
        doc.states.IDLE.child = { machine: 'inner', extra: 1 };
        expect(structureErrors(doc)).toEqual([
            { code: 'invalid-structure', path: 'machines.inner' },
            { code: 'invalid-structure', path: 'machines.inner' },
            { code: 'invalid-structure', path: 'machines.inner' },
            { code: 'invalid-structure', path: 'states.IDLE.child.extra' },
        ]);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: FAIL with `Cannot find module '../src/validate/structure'`.

- [ ] **Step 3: Write the implementation**

`packages/being-portable/src/validate/names.ts`:

```ts
import { LoadError, loadError } from '../errors';

/** Every author-chosen name must match this. */
export const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const RESERVED_NAMES = new Set(['__proto__', 'constructor', 'prototype']);
const RESERVED_STATE_NAMES = new Set(['INITIAL', 'TERMINAL']);

export type NameKind =
    | 'id'
    | 'machine'
    | 'state'
    | 'event'
    | 'field'
    | 'effect'
    | 'argument'
    | 'guard';

/** `null` when `value` is a usable name of this kind, else the error. */
export function checkName(
    value: unknown,
    path: string,
    kind: NameKind
): LoadError | null {
    if (typeof value !== 'string') {
        return loadError(
            'invalid-structure',
            path,
            `${kind} name must be a string`
        );
    }
    if (!NAME_PATTERN.test(value)) {
        return loadError(
            'invalid-name',
            path,
            `"${value}" is not a valid ${kind} name; names match ${NAME_PATTERN.source}`
        );
    }
    if (
        RESERVED_NAMES.has(value) ||
        (kind === 'state' && RESERVED_STATE_NAMES.has(value))
    ) {
        return loadError(
            'reserved-name',
            path,
            `"${value}" is reserved and cannot be a ${kind} name`
        );
    }
    return null;
}
```

`packages/being-portable/src/validate/structure.ts`:

```ts
import { PlainData, PlainObject, isPlainObject } from '../copy';
import { LoadError, LoadErrorCode, loadError } from '../errors';
import {
    checkValue,
    describeType,
    isScalarName,
    parseTypeSpec,
} from '../format/values';
import { Limits } from '../limits';
import { hasOwn, joinPath } from '../util';
import { NameKind, checkName } from './names';

type Shape = {
    readonly kind: string;
    readonly required: readonly string[];
    readonly optional: readonly string[];
};

const STATEMENT_SHAPES: readonly Shape[] = [
    { kind: 'set', required: ['set', 'to'], optional: [] },
    { kind: 'push', required: ['push', 'value'], optional: [] },
    { kind: 'removeAt', required: ['removeAt', 'index'], optional: [] },
    { kind: 'if', required: ['if', 'then'], optional: ['else'] },
    { kind: 'call', required: ['call'], optional: ['args', 'into'] },
    { kind: 'output', required: ['output'], optional: [] },
];

const EXPRESSION_KINDS = ['list', 'ctx', 'payload', 'childCtx', 'op'];

const BODY_REQUIRED = ['context', 'events', 'initialState', 'states'];
const BODY_OPTIONAL = ['outputs'];
const ROOT_REQUIRED = ['format', 'id', 'revision', ...BODY_REQUIRED];
const ROOT_OPTIONAL = ['effects', 'machines', ...BODY_OPTIONAL];
const STATE_KEYS = [
    'final',
    'guards',
    'enter',
    'exit',
    'on',
    'child',
    'onDone',
];

/**
 * Pass 1: checks that a migrated document has the shape of a definition.
 * When this returns no errors, the document can be read as a
 * `MachineDefinition`.
 */
export function checkStructure(
    document: PlainObject,
    limits: Limits
): LoadError[] {
    const checker = new StructureChecker(limits);
    checker.definition(document);
    return checker.errors;
}

class StructureChecker {
    readonly errors: LoadError[] = [];

    constructor(private readonly limits: Limits) {}

    definition(document: PlainObject): void {
        this.keys(document, '', ROOT_REQUIRED, ROOT_OPTIONAL);
        if (hasOwn(document, 'id')) {
            this.name(document.id, 'id', 'id');
        }
        if (hasOwn(document, 'revision')) {
            const revision = document.revision;
            if (
                typeof revision !== 'number' ||
                !Number.isInteger(revision) ||
                revision < 0
            ) {
                this.fail(
                    'invalid-structure',
                    'revision',
                    'revision must be a non-negative integer'
                );
            }
        }
        if (hasOwn(document, 'effects')) {
            this.record(document.effects, 'effects', 'effect', (value, path) =>
                this.effect(value, path)
            );
        }
        if (hasOwn(document, 'machines')) {
            const machines = this.record(
                document.machines,
                'machines',
                'machine',
                (value, path) => this.body(value, path)
            );
            if (
                machines !== null &&
                Object.keys(machines).length + 1 > this.limits.maxMachines
            ) {
                this.fail(
                    'limit-exceeded',
                    'machines',
                    `at most ${this.limits.maxMachines} machines including the root`
                );
            }
        }
        this.bodyFields(document, '');
    }

    private body(value: PlainData, path: string): void {
        const body = this.object(value, path);
        if (body === null) {
            return;
        }
        this.keys(body, path, BODY_REQUIRED, BODY_OPTIONAL);
        this.bodyFields(body, path);
    }

    private bodyFields(body: PlainObject, path: string): void {
        if (hasOwn(body, 'context')) {
            this.record(
                body.context,
                joinPath(path, 'context'),
                'field',
                (value, fieldPath) => this.contextField(value, fieldPath)
            );
        }
        if (hasOwn(body, 'events')) {
            this.record(
                body.events,
                joinPath(path, 'events'),
                'event',
                (value, eventPath) =>
                    this.record(value, eventPath, 'field', (spec, specPath) =>
                        this.typeSpec(spec, specPath)
                    )
            );
        }
        if (hasOwn(body, 'outputs')) {
            this.record(
                body.outputs,
                joinPath(path, 'outputs'),
                'event',
                (spec, specPath) => this.typeSpec(spec, specPath)
            );
        }
        if (hasOwn(body, 'initialState')) {
            this.name(
                body.initialState,
                joinPath(path, 'initialState'),
                'state'
            );
        }
        if (hasOwn(body, 'states')) {
            const statesPath = joinPath(path, 'states');
            const states = this.record(
                body.states,
                statesPath,
                'state',
                (value, statePath) => this.state(value, statePath)
            );
            if (
                states !== null &&
                Object.keys(states).length > this.limits.maxStates
            ) {
                this.fail(
                    'limit-exceeded',
                    statesPath,
                    `at most ${this.limits.maxStates} states per machine`
                );
            }
        }
    }

    private contextField(value: PlainData, path: string): void {
        const field = this.object(value, path);
        if (field === null) {
            return;
        }
        const isList = field.type === 'list';
        this.keys(
            field,
            path,
            isList ? ['type', 'of', 'initial'] : ['type', 'initial'],
            []
        );
        const type = parseTypeSpec(
            isList ? { type: field.type, of: field.of } : field.type
        );
        if (type === null) {
            this.fail(
                'invalid-structure',
                joinPath(path, 'type'),
                'type must be "number", "string", "boolean", or "list" with "of"'
            );
            return;
        }
        if (!hasOwn(field, 'initial')) {
            return;
        }
        const check = checkValue(field.initial, type, this.limits);
        if (check === 'type') {
            this.fail(
                'type-mismatch',
                joinPath(path, 'initial'),
                `initial value must be ${describeType(type)}`
            );
        } else if (check === 'limit') {
            this.fail(
                'limit-exceeded',
                joinPath(path, 'initial'),
                'initial value is longer than the limits allow'
            );
        }
    }

    private effect(value: PlainData, path: string): void {
        const effect = this.object(value, path);
        if (effect === null) {
            return;
        }
        this.keys(effect, path, ['args'], ['returns']);
        if (hasOwn(effect, 'args')) {
            this.record(
                effect.args,
                joinPath(path, 'args'),
                'argument',
                (spec, specPath) => this.typeSpec(spec, specPath)
            );
        }
        if (hasOwn(effect, 'returns')) {
            this.typeSpec(effect.returns, joinPath(path, 'returns'));
        }
    }

    private state(value: PlainData, path: string): void {
        const state = this.object(value, path);
        if (state === null) {
            return;
        }
        this.keys(state, path, [], STATE_KEYS);
        if (hasOwn(state, 'final') && typeof state.final !== 'boolean') {
            this.fail(
                'invalid-structure',
                joinPath(path, 'final'),
                'final must be true or false'
            );
        }
        if (hasOwn(state, 'guards')) {
            this.record(
                state.guards,
                joinPath(path, 'guards'),
                'guard',
                (expr, exprPath) => this.expr(expr, exprPath, 1)
            );
        }
        for (const block of ['enter', 'exit']) {
            if (hasOwn(state, block)) {
                this.statements(state[block], joinPath(path, block), 0);
            }
        }
        if (hasOwn(state, 'on')) {
            this.record(
                state.on,
                joinPath(path, 'on'),
                'event',
                (reaction, reactionPath) =>
                    this.reaction(reaction, reactionPath, true)
            );
        }
        if (hasOwn(state, 'child')) {
            this.child(state.child, joinPath(path, 'child'));
        }
        if (hasOwn(state, 'onDone')) {
            this.reaction(state.onDone, joinPath(path, 'onDone'), false);
        }
    }

    private child(value: PlainData, path: string): void {
        const child = this.object(value, path);
        if (child === null) {
            return;
        }
        this.keys(child, path, ['machine'], ['with']);
        if (hasOwn(child, 'machine')) {
            this.name(child.machine, joinPath(path, 'machine'), 'machine');
        }
        if (hasOwn(child, 'with')) {
            this.record(
                child.with,
                joinPath(path, 'with'),
                'field',
                (expr, exprPath) => this.expr(expr, exprPath, 1)
            );
        }
    }

    private reaction(
        value: PlainData,
        path: string,
        allowRequire: boolean
    ): void {
        const reaction = this.object(value, path);
        if (reaction === null) {
            return;
        }
        this.keys(
            reaction,
            path,
            [],
            allowRequire
                ? ['require', 'do', 'branches', 'target']
                : ['do', 'branches', 'target']
        );
        if (allowRequire && hasOwn(reaction, 'require')) {
            this.array(
                reaction.require,
                joinPath(path, 'require'),
                (ref, refPath) => this.guardRef(ref, refPath)
            );
        }
        if (hasOwn(reaction, 'do')) {
            this.statements(reaction.do, joinPath(path, 'do'), 0);
        }
        if (hasOwn(reaction, 'branches')) {
            this.array(
                reaction.branches,
                joinPath(path, 'branches'),
                (branch, branchPath) => this.branch(branch, branchPath)
            );
        }
        if (hasOwn(reaction, 'target')) {
            this.name(reaction.target, joinPath(path, 'target'), 'state');
        }
    }

    private branch(value: PlainData, path: string): void {
        const branch = this.object(value, path);
        if (branch === null) {
            return;
        }
        this.keys(branch, path, ['if', 'target'], []);
        if (hasOwn(branch, 'if')) {
            this.guardRef(branch.if, joinPath(path, 'if'));
        }
        if (hasOwn(branch, 'target')) {
            this.name(branch.target, joinPath(path, 'target'), 'state');
        }
    }

    private guardRef(value: PlainData, path: string): void {
        if (typeof value === 'string') {
            this.name(value, path, 'guard');
        } else {
            this.expr(value, path, 1);
        }
    }

    private statements(value: PlainData, path: string, ifDepth: number): void {
        const list = this.list(value, path);
        if (list === null) {
            return;
        }
        if (list.length > this.limits.maxStatements) {
            this.fail(
                'limit-exceeded',
                path,
                `at most ${this.limits.maxStatements} statements per list`
            );
        }
        list.forEach((statement, index) =>
            this.statement(statement, joinPath(path, index), ifDepth)
        );
    }

    private statement(value: PlainData, path: string, ifDepth: number): void {
        const statement = this.object(value, path, 'a statement');
        if (statement === null) {
            return;
        }
        const shapes = STATEMENT_SHAPES.filter(shape =>
            hasOwn(statement, shape.kind)
        );
        if (shapes.length !== 1) {
            this.fail(
                'invalid-structure',
                path,
                'a statement must have exactly one of set, push, removeAt, if, call, output'
            );
            return;
        }
        const shape = shapes[0];
        this.keys(statement, path, shape.required, shape.optional);
        const child = (key: string) => joinPath(path, key);
        switch (shape.kind) {
            case 'set':
                this.name(statement.set, child('set'), 'field');
                this.optionalExpr(statement, 'to', path);
                break;
            case 'push':
                this.name(statement.push, child('push'), 'field');
                this.optionalExpr(statement, 'value', path);
                break;
            case 'removeAt':
                this.name(statement.removeAt, child('removeAt'), 'field');
                this.optionalExpr(statement, 'index', path);
                break;
            case 'if':
                if (ifDepth + 1 > this.limits.maxStatementDepth) {
                    this.fail(
                        'limit-exceeded',
                        path,
                        `if statements may nest at most ${this.limits.maxStatementDepth} deep`
                    );
                    break;
                }
                this.expr(statement.if, child('if'), 1);
                if (hasOwn(statement, 'then')) {
                    this.statements(statement.then, child('then'), ifDepth + 1);
                }
                if (hasOwn(statement, 'else')) {
                    this.statements(statement.else, child('else'), ifDepth + 1);
                }
                break;
            case 'call':
                this.name(statement.call, child('call'), 'effect');
                if (hasOwn(statement, 'args')) {
                    this.record(
                        statement.args,
                        child('args'),
                        'argument',
                        (expr, exprPath) => this.expr(expr, exprPath, 1)
                    );
                }
                if (hasOwn(statement, 'into')) {
                    this.name(statement.into, child('into'), 'field');
                }
                break;
            case 'output':
                this.expr(statement.output, child('output'), 1);
                break;
        }
    }

    private optionalExpr(owner: PlainObject, key: string, path: string): void {
        if (hasOwn(owner, key)) {
            this.expr(owner[key], joinPath(path, key), 1);
        }
    }

    private expr(value: PlainData, path: string, depth: number): void {
        if (depth > this.limits.maxExpressionDepth) {
            this.fail(
                'limit-exceeded',
                path,
                `expressions may nest at most ${this.limits.maxExpressionDepth} deep`
            );
            return;
        }
        if (
            typeof value === 'number' ||
            typeof value === 'string' ||
            typeof value === 'boolean'
        ) {
            return;
        }
        const expr = this.object(value, path, 'an expression');
        if (expr === null) {
            return;
        }
        const kinds = EXPRESSION_KINDS.filter(kind => hasOwn(expr, kind));
        if (kinds.length !== 1) {
            this.fail(
                'invalid-structure',
                path,
                'an expression object must have exactly one of list, ctx, payload, childCtx, op'
            );
            return;
        }
        const kind = kinds[0];
        if (kind === 'list') {
            this.keys(expr, path, ['list'], ['of']);
            const listPath = joinPath(path, 'list');
            this.list(expr.list, listPath)?.forEach((item, index) =>
                this.expr(item, joinPath(listPath, index), depth + 1)
            );
            if (hasOwn(expr, 'of') && !isScalarName(expr.of)) {
                this.fail(
                    'invalid-structure',
                    joinPath(path, 'of'),
                    'of must be "number", "string" or "boolean"'
                );
            }
            return;
        }
        if (kind === 'op') {
            this.keys(expr, path, ['op'], ['args']);
            if (typeof expr.op !== 'string') {
                this.fail(
                    'invalid-structure',
                    joinPath(path, 'op'),
                    'op must be a string'
                );
            }
            if (hasOwn(expr, 'args')) {
                const argsPath = joinPath(path, 'args');
                this.list(expr.args, argsPath)?.forEach((arg, index) =>
                    this.expr(arg, joinPath(argsPath, index), depth + 1)
                );
            }
            return;
        }
        this.keys(expr, path, [kind], []);
        this.name(expr[kind], joinPath(path, kind), 'field');
    }

    private typeSpec(value: PlainData, path: string): void {
        if (parseTypeSpec(value) === null) {
            this.fail(
                'invalid-structure',
                path,
                'expected a type: "number", "string", "boolean", { "type": ... } or { "type": "list", "of": ... }'
            );
        }
    }

    private fail(code: LoadErrorCode, path: string, message: string): void {
        this.errors.push(loadError(code, path, message));
    }

    private object(
        value: PlainData | undefined,
        path: string,
        what = 'an object'
    ): PlainObject | null {
        if (isPlainObject(value)) {
            return value;
        }
        this.fail('invalid-structure', path, `expected ${what}`);
        return null;
    }

    private list(
        value: PlainData | undefined,
        path: string
    ): readonly PlainData[] | null {
        if (Array.isArray(value)) {
            return value;
        }
        this.fail('invalid-structure', path, 'expected a list');
        return null;
    }

    private array(
        value: PlainData,
        path: string,
        each: (item: PlainData, itemPath: string) => void
    ): void {
        this.list(value, path)?.forEach((item, index) =>
            each(item, joinPath(path, index))
        );
    }

    private keys(
        object: PlainObject,
        path: string,
        required: readonly string[],
        optional: readonly string[]
    ): void {
        for (const key of required) {
            if (!hasOwn(object, key)) {
                this.fail('invalid-structure', path, `missing "${key}"`);
            }
        }
        for (const key of Object.keys(object)) {
            if (!required.includes(key) && !optional.includes(key)) {
                this.fail(
                    'invalid-structure',
                    joinPath(path, key),
                    `unknown key "${key}"`
                );
            }
        }
    }

    private name(value: PlainData, path: string, kind: NameKind): void {
        const error = checkName(value, path, kind);
        if (error !== null) {
            this.errors.push(error);
        }
    }

    private record(
        value: PlainData,
        path: string,
        kind: NameKind,
        each: (item: PlainData, itemPath: string) => void
    ): PlainObject | null {
        const record = this.object(value, path);
        if (record === null) {
            return null;
        }
        for (const key of Object.keys(record)) {
            const itemPath = joinPath(path, key);
            this.name(key, itemPath, kind);
            each(record[key], itemPath);
        }
        return record;
    }
}
```

- [ ] **Step 4: Run the tests and the build**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: PASS, 28 tests.

Run: `bunx nx build being-portable --skip-nx-cache`
Expected: `Successfully ran target build for project being-portable`.

- [ ] **Step 5: Commit**

```bash
bunx prettier --write packages/being-portable
git add packages/being-portable
git commit -m "feat(being-portable): structure validation pass and name rules"
```

---

### Task 4: Validator passes 2–4: references, types and placement

**Files:**

- Create: `packages/being-portable/src/validate/references.ts`
- Create: `packages/being-portable/src/validate/operators.ts`
- Create: `packages/being-portable/src/validate/check.ts`
- Create: `packages/being-portable/src/validate/index.ts`
- Test: `packages/being-portable/test/validate.test.ts`

**Interfaces:**

- Consumes: `MachineDefinition` and the other document types (Task 1); `parseTypeSpec`, `sameType`, `describeType`, `scalarType`, `listType`, `NUMBER`, `STRING`, `BOOLEAN` (Task 1); `checkStructure` (Task 3); `migrateDefinition` (Task 2).
- Produces:
    - `validate/references.ts`: `type BodyEntry = { key: string | null; path: string; body: MachineBody }`, `listBodies(definition): BodyEntry[]`, `checkReferences(definition, limits): LoadError[]`
    - `validate/operators.ts`: `type OperatorRule`, `OPERATORS: ReadonlyMap<string, OperatorRule>` (a `Map`, so an operator name can never resolve through a prototype)
    - `validate/check.ts`: `fieldType(body: MachineBody, field: string): ValueType`, `checkTypes(definition): LoadError[]`
    - `validate/index.ts`: `type DefinitionCheck = { ok: true; definition: MachineDefinition } | { ok: false; errors: LoadError[] }`, `checkDefinition(document: PlainData, limits: Limits): DefinitionCheck`. It migrates, runs pass 1, stops if pass 1 reported anything, and otherwise returns the de-duplicated errors of passes 2–4.

- [ ] **Step 1: Write the failing test**

`packages/being-portable/test/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { copyPlainData } from '../src/copy';
import { DEFAULT_LIMITS, Limits, resolveLimits } from '../src/limits';
import { checkDefinition } from '../src/validate';
import { Doc, gameDoc, vendingDoc } from './fixtures';

function check(doc: Doc, limits: Partial<Limits> = {}) {
    const resolved = resolveLimits(limits);
    const copied = copyPlainData(doc, resolved);
    if (!copied.ok) {
        throw new Error('fixture is not plain data');
    }
    return checkDefinition(copied.value, resolved);
}

function errorsOf(doc: Doc, limits: Partial<Limits> = {}) {
    const result = check(doc, limits);
    return result.ok
        ? []
        : result.errors.map(({ code, path }) => ({ code, path }));
}

describe('checkDefinition', () => {
    it('accepts the fixtures', () => {
        expect(errorsOf(vendingDoc())).toEqual([]);
        expect(errorsOf(gameDoc())).toEqual([]);
    });

    it('returns the frozen definition', () => {
        const result = check(vendingDoc());
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.definition.id).toBe('vending');
        expect(Object.isFrozen(result.definition.states)).toBe(true);
    });

    it('stops after the structure pass', () => {
        const doc = vendingDoc();
        doc.revision = 'one';
        doc.initialState = 'NOWHERE';
        expect(errorsOf(doc)).toEqual([
            { code: 'invalid-structure', path: 'revision' },
        ]);
    });

    it('reports several semantic errors at once', () => {
        const doc = vendingDoc();
        doc.initialState = 'NOWHERE';
        doc.states.IDLE.on.insertCoin.target = 'GONE';
        doc.states.IDLE.on.insertCoin.do[0].to.args[0] = { ctx: 'missing' };
        expect(errorsOf(doc)).toEqual([
            { code: 'unknown-state', path: 'initialState' },
            { code: 'unknown-state', path: 'states.IDLE.on.insertCoin.target' },
            {
                code: 'unknown-field',
                path: 'states.IDLE.on.insertCoin.do[0].to.args[0].ctx',
            },
        ]);
    });
});

describe('references', () => {
    it('checks events, guards and branch targets', () => {
        const doc = vendingDoc();
        doc.states.IDLE.on.teleport = {};
        doc.states.HAS_MONEY.on.select.require = ['canFly'];
        doc.states.HAS_MONEY.on.select.branches[0].target = 'MOON';
        expect(errorsOf(doc)).toEqual([
            { code: 'unknown-event', path: 'states.IDLE.on.teleport' },
            {
                code: 'unknown-guard',
                path: 'states.HAS_MONEY.on.select.require[0]',
            },
            {
                code: 'unknown-state',
                path: 'states.HAS_MONEY.on.select.branches[0].target',
            },
        ]);
    });

    it('checks child machines and with fields', () => {
        const doc = gameDoc();
        doc.states.PLAYING.child.with.nope = 1;
        doc.states.LOBBY.child = { machine: 'missing' };
        expect(errorsOf(doc)).toEqual([
            { code: 'unknown-machine', path: 'states.LOBBY.child.machine' },
            { code: 'unknown-field', path: 'states.PLAYING.child.with.nope' },
        ]);
    });

    it('checks final states and onDone', () => {
        const doc = gameDoc();
        doc.machines.turn.states.DONE.on = { roll: {} };
        doc.machines.turn.initialState = 'DONE';
        doc.states.LOBBY.onDone = { target: 'LOBBY' };
        expect(errorsOf(doc)).toEqual([
            { code: 'on-done-without-child', path: 'states.LOBBY.onDone' },
            {
                code: 'final-initial-state',
                path: 'machines.turn.initialState',
            },
            {
                code: 'final-state-has-reactions',
                path: 'machines.turn.states.DONE',
            },
        ]);
    });

    it('reports onDone when the child can never finish', () => {
        const doc = gameDoc();
        delete doc.machines.turn.states.DONE.final;
        expect(errorsOf(doc)).toEqual([
            { code: 'on-done-unreachable', path: 'states.PLAYING.onDone' },
        ]);
    });

    it('requires child events and outputs to match the parent', () => {
        const doc = gameDoc();
        doc.machines.turn.events.roll = { value: 'string' };
        doc.machines.turn.events.extra = {};
        doc.machines.turn.outputs = { roll: 'number' };
        expect(errorsOf(doc).map(error => error.code)).toEqual([
            'child-event-mismatch',
            'child-event-mismatch',
            'child-event-mismatch',
            // the child's own roll reaction now multiplies a string
            'type-mismatch',
        ]);
    });

    it('rejects machine cycles', () => {
        const doc = gameDoc();
        doc.machines.turn.states.ROLLING.child = { machine: 'turn' };
        delete doc.machines.turn.states.ROLLING.on;
        expect(errorsOf(doc)).toContainEqual({
            code: 'machine-cycle',
            path: 'machines.turn',
        });
    });

    it('enforces nesting depth and instance count', () => {
        const chain = gameDoc();
        chain.machines.inner = {
            context: {},
            events: {},
            initialState: 'A',
            states: { A: {} },
        };
        chain.machines.turn.states.ROLLING.child = { machine: 'inner' };
        delete chain.machines.turn.states.ROLLING.on;
        delete chain.machines.turn.states.ROLLING.enter;
        delete chain.machines.turn.states.ROLLING.exit;
        expect(errorsOf(chain, { maxNestingDepth: 1 })).toEqual([
            { code: 'limit-exceeded', path: 'machines' },
        ]);

        const wide = gameDoc();
        wide.states.LOBBY.child = { machine: 'turn' };
        delete wide.states.LOBBY.on;
        expect(errorsOf(wide, { maxMachineInstances: 2 })).toEqual([
            { code: 'limit-exceeded', path: 'machines' },
        ]);
        expect(DEFAULT_LIMITS.maxMachineInstances).toBe(256);
    });
});

describe('types and placement', () => {
    it('type-checks operators and statements', () => {
        const doc = vendingDoc();
        doc.states.IDLE.on.insertCoin.do = [
            { set: 'balance', to: 'lots' },
            { push: 'balance', value: 1 },
            { push: 'sold', value: 1 },
            { set: 'balance', to: { op: 'concat', args: ['a', 'b'] } },
            { set: 'balance', to: { op: '+', args: [1] } },
            { set: 'balance', to: { op: 'pow', args: [1, 2] } },
            { if: 1, then: [] },
        ];
        expect(errorsOf(doc)).toEqual([
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[0].to',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[1].push',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[2].value',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[3].to',
            },
            {
                code: 'arity-mismatch',
                path: 'states.IDLE.on.insertCoin.do[4].to',
            },
            {
                code: 'unknown-operator',
                path: 'states.IDLE.on.insertCoin.do[5].to.op',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[6].if',
            },
        ]);
    });

    it('does not resolve operators through prototypes', () => {
        const doc = vendingDoc();
        doc.states.IDLE.on.insertCoin.do = [
            { set: 'balance', to: { op: 'constructor', args: [] } },
            { set: 'balance', to: { op: 'hasOwnProperty', args: [] } },
        ];
        expect(errorsOf(doc).map(error => error.code)).toEqual([
            'unknown-operator',
            'unknown-operator',
        ]);
    });

    it('types list literals', () => {
        const doc = vendingDoc();
        doc.states.IDLE.on.insertCoin.do = [
            { set: 'sold', to: { list: [] } },
            { set: 'sold', to: { list: [], of: 'string' } },
            { set: 'sold', to: { list: ['a', 1] } },
            { set: 'sold', to: { list: ['a'], of: 'number' } },
        ];
        expect(errorsOf(doc)).toEqual([
            {
                code: 'empty-list-needs-type',
                path: 'states.IDLE.on.insertCoin.do[0].to',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[2].to.list[1]',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[3].to',
            },
        ]);
    });

    it('rejects payload outside on reactions and childCtx outside onDone', () => {
        const doc = gameDoc();
        doc.states.LOBBY.enter = [
            {
                push: 'log',
                value: { op: 'toString', args: [{ payload: 'value' }] },
            },
        ];
        doc.states.LOBBY.on.begin.do = [
            { set: 'score', to: { childCtx: 'points' } },
        ];
        doc.states.PLAYING.child.with.playerCount = { payload: 'value' };
        expect(errorsOf(doc)).toEqual([
            { code: 'misplaced', path: 'states.LOBBY.enter[0].value.args[0]' },
            { code: 'misplaced', path: 'states.LOBBY.on.begin.do[0].to' },
            {
                code: 'misplaced',
                path: 'states.PLAYING.child.with.playerCount',
            },
        ]);
    });

    it('checks named guards at each use', () => {
        const doc = vendingDoc();
        doc.states.HAS_MONEY.on.cancel.require = ['canAfford'];
        const result = check(doc);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors).toEqual([
            {
                code: 'unknown-field',
                path: 'states.HAS_MONEY.guards.canAfford.args[1].payload',
                message:
                    'event "cancel" has no payload field "price" (when used at states.HAS_MONEY.on.cancel.require[0])',
            },
        ]);
    });

    it('checks output placement and type', () => {
        const doc = vendingDoc();
        doc.states.IDLE.on.insertCoin.do.push({ output: 1 });
        doc.states.HAS_MONEY.enter = [{ output: 1 }];
        doc.states.HAS_MONEY.on.select.do[3] = { output: 'x' };
        expect(errorsOf(doc)).toEqual([
            {
                code: 'output-not-declared',
                path: 'states.IDLE.on.insertCoin.do[1]',
            },
            { code: 'misplaced', path: 'states.HAS_MONEY.enter[0]' },
            {
                code: 'type-mismatch',
                path: 'states.HAS_MONEY.on.select.do[3].output',
            },
        ]);
    });

    it('checks effect calls', () => {
        const doc = vendingDoc();
        doc.effects.draw = { args: {}, returns: 'string' };
        doc.states.IDLE.on.insertCoin.do = [
            { call: 'launch', args: {} },
            { call: 'dispense', args: {} },
            { call: 'dispense', args: { item: 1, extra: 2 } },
            { call: 'refund', args: { amount: 1 }, into: 'balance' },
            { call: 'draw', into: 'balance' },
            { call: 'draw', into: 'sold' },
        ];
        expect(errorsOf(doc)).toEqual([
            {
                code: 'unknown-effect',
                path: 'states.IDLE.on.insertCoin.do[0].call',
            },
            {
                code: 'arity-mismatch',
                path: 'states.IDLE.on.insertCoin.do[1].args',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[2].args.item',
            },
            {
                code: 'arity-mismatch',
                path: 'states.IDLE.on.insertCoin.do[2].args.extra',
            },
            {
                code: 'into-without-returns',
                path: 'states.IDLE.on.insertCoin.do[3].into',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[4].into',
            },
            {
                code: 'type-mismatch',
                path: 'states.IDLE.on.insertCoin.do[5].into',
            },
        ]);
    });

    it('type-checks with against the child field', () => {
        const doc = gameDoc();
        doc.states.PLAYING.child.with.playerCount = 'two';
        expect(errorsOf(doc)).toEqual([
            {
                code: 'type-mismatch',
                path: 'states.PLAYING.child.with.playerCount',
            },
        ]);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: FAIL with `Cannot find module '../src/validate'`.

- [ ] **Step 3: Write the implementation**

`packages/being-portable/src/validate/references.ts`:

```ts
import { LoadError, LoadErrorCode, loadError } from '../errors';
import {
    DoneReaction,
    GuardRef,
    MachineBody,
    MachineDefinition,
    Reaction,
    TypeSpec,
} from '../format/types';
import { parseTypeSpec, sameType } from '../format/values';
import { Limits } from '../limits';
import { entriesOf, hasOwn, joinPath } from '../util';

export type BodyEntry = {
    /** `null` for the root, else the key in `machines`. */
    readonly key: string | null;
    readonly path: string;
    readonly body: MachineBody;
};

/** The root and every machine in `machines`, with their JSON paths. */
export function listBodies(definition: MachineDefinition): BodyEntry[] {
    return [
        { key: null, path: '', body: definition },
        ...entriesOf(definition.machines).map(([key, body]) => ({
            key,
            path: joinPath('machines', key),
            body,
        })),
    ];
}

type Fail = (code: LoadErrorCode, path: string, message: string) => void;

/**
 * Pass 2: every named state, event, field, guard and machine exists; child
 * machines agree with their parents; no machine cycles; the tree fits the
 * nesting and instance limits.
 */
export function checkReferences(
    definition: MachineDefinition,
    limits: Limits
): LoadError[] {
    const errors: LoadError[] = [];
    const fail: Fail = (code, path, message) =>
        errors.push(loadError(code, path, message));
    const machines = definition.machines ?? {};

    for (const { key, path, body } of listBodies(definition)) {
        const initialPath = joinPath(path, 'initialState');
        if (!hasOwn(body.states, body.initialState)) {
            fail(
                'unknown-state',
                initialPath,
                `initialState "${body.initialState}" is not a state`
            );
        } else if (key !== null && body.states[body.initialState].final) {
            fail(
                'final-initial-state',
                initialPath,
                'a child machine cannot start in a final state'
            );
        }

        const stateRef = (target: string, targetPath: string) => {
            if (!hasOwn(body.states, target)) {
                fail(
                    'unknown-state',
                    targetPath,
                    `"${target}" is not a state of this machine`
                );
            }
        };

        for (const [stateName, state] of entriesOf(body.states)) {
            const statePath = joinPath(joinPath(path, 'states'), stateName);
            const guards = state.guards ?? {};
            const guardRef = (ref: GuardRef, refPath: string) => {
                if (typeof ref === 'string' && !hasOwn(guards, ref)) {
                    fail(
                        'unknown-guard',
                        refPath,
                        `"${ref}" is not a guard of state ${stateName}`
                    );
                }
            };
            const reaction = (
                value: Reaction | DoneReaction,
                reactionPath: string
            ) => {
                if ('require' in value) {
                    value.require?.forEach((ref, index) =>
                        guardRef(
                            ref,
                            joinPath(joinPath(reactionPath, 'require'), index)
                        )
                    );
                }
                value.branches?.forEach((branch, index) => {
                    const branchPath = joinPath(
                        joinPath(reactionPath, 'branches'),
                        index
                    );
                    guardRef(branch.if, joinPath(branchPath, 'if'));
                    stateRef(branch.target, joinPath(branchPath, 'target'));
                });
                if (value.target !== undefined) {
                    stateRef(value.target, joinPath(reactionPath, 'target'));
                }
            };

            if (
                state.final === true &&
                (state.on !== undefined || state.child !== undefined)
            ) {
                fail(
                    'final-state-has-reactions',
                    statePath,
                    'a final state cannot have on or child'
                );
            }
            for (const [event, value] of entriesOf(state.on)) {
                const eventPath = joinPath(joinPath(statePath, 'on'), event);
                if (!hasOwn(body.events, event)) {
                    fail(
                        'unknown-event',
                        eventPath,
                        `"${event}" is not declared in events`
                    );
                }
                reaction(value, eventPath);
            }
            if (state.onDone !== undefined) {
                reaction(state.onDone, joinPath(statePath, 'onDone'));
            }

            if (state.child === undefined) {
                if (state.onDone !== undefined) {
                    fail(
                        'on-done-without-child',
                        joinPath(statePath, 'onDone'),
                        'onDone is only allowed on a state with a child'
                    );
                }
                continue;
            }
            const childPath = joinPath(statePath, 'child');
            const childKey = state.child.machine;
            if (!hasOwn(machines, childKey)) {
                fail(
                    'unknown-machine',
                    joinPath(childPath, 'machine'),
                    `"${childKey}" is not in machines`
                );
                continue;
            }
            const child = machines[childKey];
            for (const [field] of entriesOf(state.child.with)) {
                if (!hasOwn(child.context, field)) {
                    fail(
                        'unknown-field',
                        joinPath(joinPath(childPath, 'with'), field),
                        `"${field}" is not a context field of machine ${childKey}`
                    );
                }
            }
            if (
                state.onDone !== undefined &&
                !Object.values(child.states).some(s => s.final === true)
            ) {
                fail(
                    'on-done-unreachable',
                    joinPath(statePath, 'onDone'),
                    `machine ${childKey} has no final state, so onDone can never run`
                );
            }
            checkChildEvents(
                body,
                child,
                childKey,
                joinPath(childPath, 'machine'),
                fail
            );
        }
    }

    if (!checkCycles(definition, fail)) {
        checkTreeSize(definition, limits, fail);
    }
    return errors;
}

function typeOf(spec: TypeSpec): ReturnType<typeof parseTypeSpec> {
    return parseTypeSpec(spec);
}

function samePayload(
    a: Readonly<Record<string, TypeSpec>>,
    b: Readonly<Record<string, TypeSpec>>
): boolean {
    const keysA = Object.keys(a);
    if (keysA.length !== Object.keys(b).length) {
        return false;
    }
    return keysA.every(
        key => hasOwn(b, key) && sameType(typeOf(a[key])!, typeOf(b[key])!)
    );
}

function checkChildEvents(
    parent: MachineBody,
    child: MachineBody,
    childKey: string,
    path: string,
    fail: Fail
): void {
    for (const [event, payload] of entriesOf(child.events)) {
        if (!hasOwn(parent.events, event)) {
            fail(
                'child-event-mismatch',
                path,
                `machine ${childKey} declares event "${event}", which this machine does not`
            );
        } else if (!samePayload(parent.events[event], payload)) {
            fail(
                'child-event-mismatch',
                path,
                `event "${event}" has a different payload in machine ${childKey}`
            );
        }
    }
    const parentOutputs = parent.outputs ?? {};
    for (const [event, spec] of entriesOf(child.outputs)) {
        if (!hasOwn(parentOutputs, event)) {
            fail(
                'child-event-mismatch',
                path,
                `machine ${childKey} declares an output for "${event}", which this machine does not`
            );
        } else if (!sameType(typeOf(parentOutputs[event])!, typeOf(spec)!)) {
            fail(
                'child-event-mismatch',
                path,
                `the output of "${event}" has a different type in machine ${childKey}`
            );
        }
    }
}

function childKeys(
    body: MachineBody,
    machines: Readonly<Record<string, MachineBody>>
): string[] {
    const keys: string[] = [];
    for (const [, state] of entriesOf(body.states)) {
        if (
            state.child !== undefined &&
            hasOwn(machines, state.child.machine)
        ) {
            keys.push(state.child.machine);
        }
    }
    return keys;
}

/** Reports machines that contain themselves; returns whether any did. */
function checkCycles(definition: MachineDefinition, fail: Fail): boolean {
    const machines = definition.machines ?? {};
    const marks = new Map<string, 'visiting' | 'done'>();
    let found = false;
    const visit = (key: string): void => {
        const mark = marks.get(key);
        if (mark === 'done') {
            return;
        }
        if (mark === 'visiting') {
            found = true;
            fail(
                'machine-cycle',
                joinPath('machines', key),
                `machine ${key} contains itself through its children`
            );
            return;
        }
        marks.set(key, 'visiting');
        for (const child of childKeys(machines[key], machines)) {
            visit(child);
        }
        marks.set(key, 'done');
    };
    for (const key of Object.keys(machines)) {
        visit(key);
    }
    return found;
}

/** Nesting depth and instance count from the root. Assumes no cycles. */
function checkTreeSize(
    definition: MachineDefinition,
    limits: Limits,
    fail: Fail
): void {
    const machines = definition.machines ?? {};
    const depths = new Map<string, number>();
    const counts = new Map<string, number>();
    const cap = limits.maxMachineInstances + 1;

    const depthOf = (body: MachineBody): number =>
        childKeys(body, machines).reduce(
            (deepest, key) => Math.max(deepest, 1 + memo(depths, key, depthOf)),
            0
        );
    const countOf = (body: MachineBody): number =>
        Math.min(
            cap,
            childKeys(body, machines).reduce(
                (total, key) => total + memo(counts, key, countOf),
                1
            )
        );
    const memo = (
        cache: Map<string, number>,
        key: string,
        compute: (body: MachineBody) => number
    ): number => {
        const cached = cache.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const value = compute(machines[key]);
        cache.set(key, value);
        return value;
    };

    if (depthOf(definition) > limits.maxNestingDepth) {
        fail(
            'limit-exceeded',
            'machines',
            `child machines may nest at most ${limits.maxNestingDepth} deep`
        );
    }
    if (countOf(definition) > limits.maxMachineInstances) {
        fail(
            'limit-exceeded',
            'machines',
            `the machine tree would build more than ${limits.maxMachineInstances} machines`
        );
    }
}
```

`packages/being-portable/src/validate/operators.ts`:

```ts
import {
    BOOLEAN,
    NUMBER,
    STRING,
    ValueType,
    sameType,
    scalarType,
} from '../format/values';

/** Arity and typing of one operator. `type` returns a message on mismatch. */
export type OperatorRule = {
    readonly min: number;
    readonly max: number;
    readonly type: (args: readonly ValueType[]) => ValueType | string;
};

const MANY = Number.POSITIVE_INFINITY;

const isNumber = (type: ValueType) =>
    type.kind === 'scalar' && type.scalar === 'number';
const isString = (type: ValueType) =>
    type.kind === 'scalar' && type.scalar === 'string';
const isBoolean = (type: ValueType) =>
    type.kind === 'scalar' && type.scalar === 'boolean';

const numbers =
    (result: ValueType) =>
    (args: readonly ValueType[]): ValueType | string =>
        args.every(isNumber) ? result : 'expects numbers';

const booleans = (args: readonly ValueType[]): ValueType | string =>
    args.every(isBoolean) ? BOOLEAN : 'expects booleans';

const sameScalars = (args: readonly ValueType[]): ValueType | string =>
    args[0].kind === 'scalar' && sameType(args[0], args[1])
        ? BOOLEAN
        : 'expects two values of the same number, string or boolean type';

const listAndItem =
    (result: ValueType) =>
    (args: readonly ValueType[]): ValueType | string => {
        const [list, item] = args;
        return list.kind === 'list' &&
            item.kind === 'scalar' &&
            item.scalar === list.of
            ? result
            : 'expects a list and a value of its item type';
    };

const rule = (
    min: number,
    max: number,
    type: OperatorRule['type']
): OperatorRule => ({ min, max, type });

/** Every operator the language has. A Map, so no name can reach a prototype. */
export const OPERATORS: ReadonlyMap<string, OperatorRule> = new Map([
    ['+', rule(2, MANY, numbers(NUMBER))],
    ['*', rule(2, MANY, numbers(NUMBER))],
    ['-', rule(2, 2, numbers(NUMBER))],
    ['/', rule(2, 2, numbers(NUMBER))],
    ['%', rule(2, 2, numbers(NUMBER))],
    ['min', rule(2, MANY, numbers(NUMBER))],
    ['max', rule(2, MANY, numbers(NUMBER))],
    ['abs', rule(1, 1, numbers(NUMBER))],
    ['floor', rule(1, 1, numbers(NUMBER))],
    ['ceil', rule(1, 1, numbers(NUMBER))],
    ['round', rule(1, 1, numbers(NUMBER))],
    ['==', rule(2, 2, sameScalars)],
    ['!=', rule(2, 2, sameScalars)],
    ['<', rule(2, 2, numbers(BOOLEAN))],
    ['<=', rule(2, 2, numbers(BOOLEAN))],
    ['>', rule(2, 2, numbers(BOOLEAN))],
    ['>=', rule(2, 2, numbers(BOOLEAN))],
    ['and', rule(2, MANY, booleans)],
    ['or', rule(2, MANY, booleans)],
    ['not', rule(1, 1, booleans)],
    [
        'cond',
        rule(3, 3, ([condition, then, otherwise]) =>
            isBoolean(condition) && sameType(then, otherwise)
                ? then
                : 'expects a boolean and two values of the same type'
        ),
    ],
    [
        'concat',
        rule(2, MANY, args =>
            args.every(isString) ? STRING : 'expects strings'
        ),
    ],
    [
        'toString',
        rule(1, 1, ([value]) =>
            isNumber(value) || isBoolean(value)
                ? STRING
                : 'expects a number or a boolean'
        ),
    ],
    [
        'length',
        rule(1, 1, ([value]) =>
            isString(value) || value.kind === 'list'
                ? NUMBER
                : 'expects a string or a list'
        ),
    ],
    [
        'at',
        rule(2, 2, ([list, index]) =>
            list.kind === 'list' && isNumber(index)
                ? scalarType(list.of)
                : 'expects a list and a number'
        ),
    ],
    ['contains', rule(2, 2, listAndItem(BOOLEAN))],
    ['indexOf', rule(2, 2, listAndItem(NUMBER))],
    ['randomInt', rule(2, 2, numbers(NUMBER))],
    ['now', rule(0, 0, () => NUMBER)],
]);
```

`packages/being-portable/src/validate/check.ts`:

```ts
import { LoadError, LoadErrorCode, loadError } from '../errors';
import {
    EffectDeclaration,
    Expr,
    GuardRef,
    MachineBody,
    MachineDefinition,
    StateDefinition,
    Stmt,
    TypeSpec,
} from '../format/types';
import {
    BOOLEAN,
    NUMBER,
    STRING,
    ValueType,
    describeType,
    listType,
    parseTypeSpec,
    sameType,
    scalarType,
} from '../format/values';
import { entriesOf, hasOwn, joinPath } from '../util';
import { OPERATORS } from './operators';
import { listBodies } from './references';

type OutputRule =
    | { readonly kind: 'forbidden' }
    | { readonly kind: 'undeclared' }
    | { readonly kind: 'allowed'; readonly type: ValueType };

/** What an expression or statement may use where it appears. */
type Env = {
    readonly body: MachineBody;
    /** Payload fields, or `null` where there is no event. */
    readonly payload: Readonly<Record<string, TypeSpec>> | null;
    readonly event: string | null;
    /** The child machine whose context `childCtx` reads, only in onDone. */
    readonly child: MachineBody | null;
    readonly output: OutputRule;
    /** Where a named guard is being used, while checking it. */
    readonly site: string | null;
};

/** Context field type; the field must exist. */
export function fieldType(body: MachineBody, field: string): ValueType {
    const definition = body.context[field];
    return definition.type === 'list'
        ? listType(definition.of)
        : scalarType(definition.type);
}

const isBoolean = (type: ValueType) =>
    type.kind === 'scalar' && type.scalar === 'boolean';

/**
 * Passes 3 and 4 in one walk: every expression and statement type-checks,
 * and every construct is used where it is allowed. Parts with broken
 * references are skipped; pass 2 already reported them. A named guard is
 * checked where it is used; an unused one is not type-checked.
 */
export function checkTypes(definition: MachineDefinition): LoadError[] {
    const checker = new TypeChecker(definition);
    checker.run();
    return checker.errors;
}

class TypeChecker {
    readonly errors: LoadError[] = [];
    private readonly effects: Readonly<Record<string, EffectDeclaration>>;
    private readonly machines: Readonly<Record<string, MachineBody>>;

    constructor(private readonly definition: MachineDefinition) {
        this.effects = definition.effects ?? {};
        this.machines = definition.machines ?? {};
    }

    run(): void {
        for (const { path, body } of listBodies(this.definition)) {
            for (const [stateName, state] of entriesOf(body.states)) {
                this.state(
                    body,
                    state,
                    joinPath(joinPath(path, 'states'), stateName)
                );
            }
        }
    }

    private state(
        body: MachineBody,
        state: StateDefinition,
        statePath: string
    ): void {
        const noEvent: Env = {
            body,
            payload: null,
            event: null,
            child: null,
            output: { kind: 'forbidden' },
            site: null,
        };
        if (state.enter !== undefined) {
            this.statements(state.enter, joinPath(statePath, 'enter'), noEvent);
        }
        if (state.exit !== undefined) {
            this.statements(state.exit, joinPath(statePath, 'exit'), noEvent);
        }

        for (const [event, reaction] of entriesOf(state.on)) {
            if (!hasOwn(body.events, event)) {
                continue;
            }
            const outputs = body.outputs ?? {};
            const env: Env = {
                ...noEvent,
                payload: body.events[event],
                event,
                output: hasOwn(outputs, event)
                    ? { kind: 'allowed', type: parseTypeSpec(outputs[event])! }
                    : { kind: 'undeclared' },
            };
            const eventPath = joinPath(joinPath(statePath, 'on'), event);
            reaction.require?.forEach((ref, index) =>
                this.guardRef(
                    ref,
                    state,
                    statePath,
                    joinPath(joinPath(eventPath, 'require'), index),
                    env
                )
            );
            if (reaction.do !== undefined) {
                this.statements(reaction.do, joinPath(eventPath, 'do'), env);
            }
            reaction.branches?.forEach((branch, index) =>
                this.guardRef(
                    branch.if,
                    state,
                    statePath,
                    joinPath(
                        joinPath(joinPath(eventPath, 'branches'), index),
                        'if'
                    ),
                    env
                )
            );
        }

        if (
            state.child === undefined ||
            !hasOwn(this.machines, state.child.machine)
        ) {
            return;
        }
        const child = this.machines[state.child.machine];
        for (const [field, expr] of entriesOf(state.child.with)) {
            if (!hasOwn(child.context, field)) {
                continue;
            }
            const withPath = joinPath(
                joinPath(joinPath(statePath, 'child'), 'with'),
                field
            );
            const type = this.expr(expr, withPath, noEvent);
            const expected = fieldType(child, field);
            if (type !== null && !sameType(type, expected)) {
                this.fail(
                    'type-mismatch',
                    withPath,
                    `with.${field} must be ${describeType(expected)}, got ${describeType(type)}`
                );
            }
        }
        if (state.onDone !== undefined) {
            const doneEnv: Env = { ...noEvent, child };
            const donePath = joinPath(statePath, 'onDone');
            if (state.onDone.do !== undefined) {
                this.statements(
                    state.onDone.do,
                    joinPath(donePath, 'do'),
                    doneEnv
                );
            }
            state.onDone.branches?.forEach((branch, index) =>
                this.guardRef(
                    branch.if,
                    state,
                    statePath,
                    joinPath(
                        joinPath(joinPath(donePath, 'branches'), index),
                        'if'
                    ),
                    doneEnv
                )
            );
        }
    }

    private guardRef(
        ref: GuardRef,
        state: StateDefinition,
        statePath: string,
        path: string,
        env: Env
    ): void {
        if (typeof ref === 'string') {
            if (state.guards === undefined || !hasOwn(state.guards, ref)) {
                return;
            }
            const guardPath = joinPath(joinPath(statePath, 'guards'), ref);
            const type = this.expr(state.guards[ref], guardPath, {
                ...env,
                site: path,
            });
            if (type !== null && !isBoolean(type)) {
                this.fail(
                    'type-mismatch',
                    guardPath,
                    `guard "${ref}" must be boolean, got ${describeType(type)}`
                );
            }
            return;
        }
        const type = this.expr(ref, path, env);
        if (type !== null && !isBoolean(type)) {
            this.fail(
                'type-mismatch',
                path,
                `a guard must be boolean, got ${describeType(type)}`
            );
        }
    }

    private statements(
        statements: readonly Stmt[],
        path: string,
        env: Env
    ): void {
        statements.forEach((statement, index) =>
            this.statement(statement, joinPath(path, index), env)
        );
    }

    private statement(statement: Stmt, path: string, env: Env): void {
        const at = (key: string) => joinPath(path, key);
        if ('set' in statement) {
            const field = this.field(env, statement.set, at('set'));
            const type = this.expr(statement.to, at('to'), env);
            if (field !== null && type !== null && !sameType(field, type)) {
                this.fail(
                    'type-mismatch',
                    at('to'),
                    `${statement.set} is ${describeType(field)}, got ${describeType(type)}`
                );
            }
            return;
        }
        if ('push' in statement) {
            const field = this.field(env, statement.push, at('push'));
            const type = this.expr(statement.value, at('value'), env);
            if (field !== null && field.kind !== 'list') {
                this.fail(
                    'type-mismatch',
                    at('push'),
                    `push needs a list field; ${statement.push} is ${describeType(field)}`
                );
                return;
            }
            if (
                field !== null &&
                type !== null &&
                field.kind === 'list' &&
                !sameType(type, scalarType(field.of))
            ) {
                this.fail(
                    'type-mismatch',
                    at('value'),
                    `${statement.push} holds ${field.of}, got ${describeType(type)}`
                );
            }
            return;
        }
        if ('removeAt' in statement) {
            const field = this.field(env, statement.removeAt, at('removeAt'));
            const type = this.expr(statement.index, at('index'), env);
            if (field !== null && field.kind !== 'list') {
                this.fail(
                    'type-mismatch',
                    at('removeAt'),
                    `removeAt needs a list field; ${statement.removeAt} is ${describeType(field)}`
                );
            }
            if (type !== null && !sameType(type, NUMBER)) {
                this.fail(
                    'type-mismatch',
                    at('index'),
                    `index must be number, got ${describeType(type)}`
                );
            }
            return;
        }
        if ('if' in statement) {
            const type = this.expr(statement.if, at('if'), env);
            if (type !== null && !isBoolean(type)) {
                this.fail(
                    'type-mismatch',
                    at('if'),
                    `condition must be boolean, got ${describeType(type)}`
                );
            }
            this.statements(statement.then, at('then'), env);
            if (statement.else !== undefined) {
                this.statements(statement.else, at('else'), env);
            }
            return;
        }
        if ('call' in statement) {
            this.call(statement, path, env);
            return;
        }
        const type = this.expr(statement.output, at('output'), env);
        if (env.output.kind === 'forbidden') {
            this.fail(
                'misplaced',
                path,
                'output is only allowed in the do of an on reaction'
            );
        } else if (env.output.kind === 'undeclared') {
            this.fail(
                'output-not-declared',
                path,
                `event "${env.event}" declares no output`
            );
        } else if (type !== null && !sameType(type, env.output.type)) {
            this.fail(
                'type-mismatch',
                at('output'),
                `the output of "${env.event}" is ${describeType(env.output.type)}, got ${describeType(type)}`
            );
        }
    }

    private call(
        statement: Extract<Stmt, { call: string }>,
        path: string,
        env: Env
    ): void {
        if (!hasOwn(this.effects, statement.call)) {
            this.fail(
                'unknown-effect',
                joinPath(path, 'call'),
                `"${statement.call}" is not declared in effects`
            );
            return;
        }
        const effect = this.effects[statement.call];
        const given = statement.args ?? {};
        const argsPath = joinPath(path, 'args');
        for (const [name] of entriesOf(effect.args)) {
            if (!hasOwn(given, name)) {
                this.fail(
                    'arity-mismatch',
                    argsPath,
                    `missing argument "${name}" for effect ${statement.call}`
                );
            }
        }
        for (const [name, expr] of entriesOf(given)) {
            const argPath = joinPath(argsPath, name);
            const type = this.expr(expr, argPath, env);
            if (!hasOwn(effect.args, name)) {
                this.fail(
                    'arity-mismatch',
                    argPath,
                    `effect ${statement.call} has no argument "${name}"`
                );
                continue;
            }
            const expected = parseTypeSpec(effect.args[name])!;
            if (type !== null && !sameType(type, expected)) {
                this.fail(
                    'type-mismatch',
                    argPath,
                    `argument ${name} must be ${describeType(expected)}, got ${describeType(type)}`
                );
            }
        }
        if (statement.into === undefined) {
            return;
        }
        const intoPath = joinPath(path, 'into');
        if (effect.returns === undefined) {
            this.fail(
                'into-without-returns',
                intoPath,
                `effect ${statement.call} does not declare returns`
            );
            return;
        }
        const field = this.field(env, statement.into, intoPath);
        const returns = parseTypeSpec(effect.returns)!;
        if (field !== null && !sameType(field, returns)) {
            this.fail(
                'type-mismatch',
                intoPath,
                `${statement.into} is ${describeType(field)}, but effect ${statement.call} returns ${describeType(returns)}`
            );
        }
    }

    private field(env: Env, name: string, path: string): ValueType | null {
        if (!hasOwn(env.body.context, name)) {
            this.fail(
                'unknown-field',
                path,
                `"${name}" is not a context field`
            );
            return null;
        }
        return fieldType(env.body, name);
    }

    private expr(expr: Expr, path: string, env: Env): ValueType | null {
        if (typeof expr === 'number') {
            return NUMBER;
        }
        if (typeof expr === 'string') {
            return STRING;
        }
        if (typeof expr === 'boolean') {
            return BOOLEAN;
        }
        if ('list' in expr) {
            return this.list(expr, path, env);
        }
        if ('ctx' in expr) {
            return this.field(env, expr.ctx, joinPath(path, 'ctx'));
        }
        if ('payload' in expr) {
            if (env.payload === null) {
                this.fail(
                    'misplaced',
                    path,
                    this.atSite(
                        'payload is only available in on reactions',
                        env
                    )
                );
                return null;
            }
            if (!hasOwn(env.payload, expr.payload)) {
                this.fail(
                    'unknown-field',
                    joinPath(path, 'payload'),
                    this.atSite(
                        `event "${env.event}" has no payload field "${expr.payload}"`,
                        env
                    )
                );
                return null;
            }
            return parseTypeSpec(env.payload[expr.payload]);
        }
        if ('childCtx' in expr) {
            if (env.child === null) {
                this.fail(
                    'misplaced',
                    path,
                    this.atSite('childCtx is only available in onDone', env)
                );
                return null;
            }
            if (!hasOwn(env.child.context, expr.childCtx)) {
                this.fail(
                    'unknown-field',
                    joinPath(path, 'childCtx'),
                    this.atSite(
                        `the child machine has no context field "${expr.childCtx}"`,
                        env
                    )
                );
                return null;
            }
            return fieldType(env.child, expr.childCtx);
        }
        return this.op(expr, path, env);
    }

    private list(
        expr: Extract<Expr, { list: readonly Expr[] }>,
        path: string,
        env: Env
    ): ValueType | null {
        const listPath = joinPath(path, 'list');
        const types = expr.list.map((item, index) =>
            this.expr(item, joinPath(listPath, index), env)
        );
        if (types.some(type => type === null)) {
            return null;
        }
        if (types.length === 0) {
            if (expr.of === undefined) {
                this.fail(
                    'empty-list-needs-type',
                    path,
                    'an empty list needs "of" to say what it holds'
                );
                return null;
            }
            return listType(expr.of);
        }
        const first = types[0]!;
        if (first.kind !== 'scalar') {
            this.fail(
                'type-mismatch',
                joinPath(listPath, 0),
                'list items must be numbers, strings or booleans'
            );
            return null;
        }
        for (let index = 1; index < types.length; index++) {
            if (!sameType(types[index]!, first)) {
                this.fail(
                    'type-mismatch',
                    joinPath(listPath, index),
                    `list items must all be ${first.scalar}`
                );
                return null;
            }
        }
        if (expr.of !== undefined && expr.of !== first.scalar) {
            this.fail(
                'type-mismatch',
                path,
                `the list says it holds ${expr.of} but its items are ${first.scalar}`
            );
            return null;
        }
        return listType(first.scalar);
    }

    private op(
        expr: Extract<Expr, { op: string }>,
        path: string,
        env: Env
    ): ValueType | null {
        const rule = OPERATORS.get(expr.op);
        if (rule === undefined) {
            this.fail(
                'unknown-operator',
                joinPath(path, 'op'),
                `"${expr.op}" is not an operator`
            );
            return null;
        }
        const args = expr.args ?? [];
        if (args.length < rule.min || args.length > rule.max) {
            const expected =
                rule.min === rule.max
                    ? `${rule.min}`
                    : rule.max === Number.POSITIVE_INFINITY
                      ? `at least ${rule.min}`
                      : `${rule.min} to ${rule.max}`;
            this.fail(
                'arity-mismatch',
                path,
                `${expr.op} takes ${expected} arguments, got ${args.length}`
            );
            return null;
        }
        const argsPath = joinPath(path, 'args');
        const types = args.map((arg, index) =>
            this.expr(arg, joinPath(argsPath, index), env)
        );
        if (types.some(type => type === null)) {
            return null;
        }
        const result = rule.type(types as ValueType[]);
        if (typeof result === 'string') {
            this.fail('type-mismatch', path, `${expr.op} ${result}`);
            return null;
        }
        return result;
    }

    private atSite(message: string, env: Env): string {
        return env.site === null
            ? message
            : `${message} (when used at ${env.site})`;
    }

    private fail(code: LoadErrorCode, path: string, message: string): void {
        this.errors.push(loadError(code, path, message));
    }
}
```

`packages/being-portable/src/validate/index.ts`:

```ts
import { PlainData } from '../copy';
import { LoadError } from '../errors';
import { MachineDefinition } from '../format/types';
import { Limits } from '../limits';
import { migrateDefinition } from '../migrate';
import { checkTypes } from './check';
import { checkReferences } from './references';
import { checkStructure } from './structure';

export type DefinitionCheck =
    | { readonly ok: true; readonly definition: MachineDefinition }
    | { readonly ok: false; readonly errors: LoadError[] };

function dedupe(errors: LoadError[]): LoadError[] {
    const seen = new Set<string>();
    return errors.filter(error => {
        const key = `${error.code}\u0000${error.path}\u0000${error.message}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/**
 * Runs migration and the four passes on already-copied data. Stops after the
 * structure pass when it finds errors.
 */
export function checkDefinition(
    document: PlainData,
    limits: Limits
): DefinitionCheck {
    const migrated = migrateDefinition(document);
    if (!migrated.ok) {
        return migrated;
    }
    const structural = checkStructure(migrated.value, limits);
    if (structural.length > 0) {
        return { ok: false, errors: structural };
    }
    const definition = migrated.value as unknown as MachineDefinition;
    const errors = dedupe([
        ...checkReferences(definition, limits),
        ...checkTypes(definition),
    ]);
    return errors.length > 0 ? { ok: false, errors } : { ok: true, definition };
}
```

- [ ] **Step 4: Run the tests and the build**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: PASS, 47 tests.

Run: `bunx nx build being-portable --skip-nx-cache`
Expected: `Successfully ran target build for project being-portable`.

- [ ] **Step 5: Commit**

```bash
bunx prettier --write packages/being-portable
git add packages/being-portable
git commit -m "feat(being-portable): reference, type and placement validation passes"
```

---

### Task 5: `defineHost`, effect signature checks and `validateDefinition`

**Files:**

- Create: `packages/being-portable/src/host.ts`
- Create: `packages/being-portable/src/api-types.ts`
- Create: `packages/being-portable/src/api.ts`
- Test: `packages/being-portable/test/host.test.ts`

**Interfaces:**

- Consumes: `checkName` (Task 3); `parseTypeSpec`, `sameType`, `describeType`, `ValueType` (Task 1); `resolveLimits`, `DEFAULT_LIMITS` (Task 1); `copyPlainData` (Task 2); `checkDefinition` (Task 4).
- Produces:
    - `host.ts`: `type EffectImplementation`, `type Services = { random(): number; now(): number }`, `type HostDefinition`, `type HostEffect = { args: ReadonlyMap<string, ValueType>; returns: ValueType | null; run }`, `interface Host { effects: ReadonlyMap<string, HostEffect>; services: Services; limits: Limits; onError(error: RuntimeError): void }`, `defineHost(definition?: HostDefinition): Host` (throws on a malformed host), `checkHostEffects(definition, host): LoadError[]`
    - `api-types.ts` (first version; Tasks 8 and 10 extend it): `type ValidationResult`
    - `api.ts` (first version; Tasks 8 and 10 extend it): `validateDefinition(document: unknown, options?: { limits?: Partial<Limits>; host?: Host }): ValidationResult`

- [ ] **Step 1: Write the failing test**

`packages/being-portable/test/host.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { validateDefinition } from '../src/api';
import { defineHost } from '../src/host';
import { vendingDoc } from './fixtures';

const noop = () => {};

describe('defineHost', () => {
    it('fills in services, limits and onError', () => {
        const host = defineHost();
        expect(host.effects.size).toBe(0);
        expect(typeof host.services.random()).toBe('number');
        expect(host.limits.maxNodes).toBe(50_000);
        expect(Object.isFrozen(host)).toBe(true);
    });

    it('parses effect signatures', () => {
        const host = defineHost({
            effects: {
                draw: {
                    args: { n: 'number' },
                    returns: { type: 'list', of: 'string' },
                    run: () => [],
                },
            },
        });
        const draw = host.effects.get('draw')!;
        expect(draw.args.get('n')).toEqual({
            kind: 'scalar',
            scalar: 'number',
        });
        expect(draw.returns).toEqual({ kind: 'list', of: 'string' });
    });

    it('throws on a malformed host', () => {
        expect(() =>
            defineHost({ effects: { 'bad name': { args: {}, run: noop } } })
        ).toThrow('defineHost');
        expect(() =>
            defineHost({
                effects: { e: { args: { x: 'float' as any }, run: noop } },
            })
        ).toThrow('argument x of effect e');
        expect(() =>
            defineHost({ effects: { e: { args: {} } as any } })
        ).toThrow('run function');
        expect(() => defineHost({ limits: { maxNodes: -1 } })).toThrow(
            'maxNodes'
        );
    });
});

describe('validateDefinition', () => {
    it('returns the frozen definition', () => {
        const result = validateDefinition(vendingDoc());
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.definition.id).toBe('vending');
        expect(Object.isFrozen(result.definition.states)).toBe(true);
    });

    it('rejects input that is not JSON data before validating it', () => {
        expect(
            validateDefinition({ ...vendingDoc(), id: () => 1 })
        ).toMatchObject({
            ok: false,
            errors: [{ code: 'not-plain-data', path: 'id' }],
        });
    });
});

describe('host effect checks', () => {
    const matching = {
        dispense: { args: { item: 'string' as const }, run: noop },
        refund: { args: { amount: 'number' as const }, run: noop },
    };

    it('accepts a host with exactly matching effects, plus extras', () => {
        const host = defineHost({
            effects: {
                ...matching,
                extra: { args: {}, run: noop },
            },
        });
        expect(validateDefinition(vendingDoc(), { host }).ok).toBe(true);
    });

    it('reports missing effects', () => {
        const host = defineHost({ effects: { dispense: matching.dispense } });
        expect(validateDefinition(vendingDoc(), { host })).toMatchObject({
            ok: false,
            errors: [{ code: 'missing-effect', path: 'effects.refund' }],
        });
    });

    it('reports signature mismatches in args and returns', () => {
        const host = defineHost({
            effects: {
                dispense: { args: { item: 'number' }, run: noop },
                refund: {
                    args: { amount: 'number' },
                    returns: 'number',
                    run: noop,
                },
            },
        });
        const result = validateDefinition(vendingDoc(), { host });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors.map(error => error.path)).toEqual([
            'effects.dispense',
            'effects.refund',
        ]);
        expect(result.errors[0].message).toContain('(item: string)');
    });

    it('uses the host limits unless limits are given', () => {
        const host = defineHost({
            effects: matching,
            limits: { maxNodes: 10 },
        });
        expect(validateDefinition(vendingDoc(), { host })).toMatchObject({
            ok: false,
            errors: [{ code: 'limit-exceeded' }],
        });
        expect(
            validateDefinition(vendingDoc(), {
                host,
                limits: { maxNodes: 1000 },
            }).ok
        ).toBe(true);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: FAIL with `Cannot find module '../src/api'`.

- [ ] **Step 3: Write the implementation**

`packages/being-portable/src/host.ts`:

```ts
import { LoadError, RuntimeError, loadError } from './errors';
import { MachineDefinition, TypeSpec, Value } from './format/types';
import {
    ValueType,
    describeType,
    parseTypeSpec,
    sameType,
} from './format/values';
import { Limits, resolveLimits } from './limits';
import { entriesOf, joinPath } from './util';
import { checkName } from './validate/names';

/**
 * One host capability, as the host writes it.
 *
 * @category Types
 */
export type EffectImplementation = {
    /** Argument names and types; must match the document's declaration exactly. */
    readonly args: Readonly<Record<string, TypeSpec>>;
    /** Return type; must match the document's declaration exactly. */
    readonly returns?: TypeSpec;
    /** Receives validated, frozen arguments. */
    readonly run: (args: Readonly<Record<string, Value>>) => Value | void;
};

/**
 * Sources of randomness and time for `randomInt` and `now`.
 *
 * @category Types
 */
export type Services = {
    /** A number in `[0, 1)`. */
    readonly random: () => number;
    /** A finite number, usually milliseconds. */
    readonly now: () => number;
};

/**
 * What a host passes to {@link defineHost}.
 *
 * @category Types
 */
export type HostDefinition = {
    readonly effects?: Readonly<Record<string, EffectImplementation>>;
    /** Defaults to `Math.random` and `Date.now`. */
    readonly services?: Partial<Services>;
    readonly limits?: Partial<Limits>;
    /** Receives every runtime failure. Defaults to `console.error`. */
    readonly onError?: (error: RuntimeError) => void;
};

/** An effect after {@link defineHost} parsed its types. */
export type HostEffect = {
    readonly args: ReadonlyMap<string, ValueType>;
    readonly returns: ValueType | null;
    readonly run: (args: Readonly<Record<string, Value>>) => Value | void;
};

/**
 * A validated host, made by {@link defineHost}.
 *
 * @category Types
 */
export interface Host {
    readonly effects: ReadonlyMap<string, HostEffect>;
    readonly services: Services;
    readonly limits: Limits;
    readonly onError: (error: RuntimeError) => void;
}

function defaultOnError(error: RuntimeError): void {
    console.error(
        `[being-portable] ${error.code} at ${error.path || '(root)'}: ${error.message}`
    );
}

function hostType(spec: unknown, what: string): ValueType {
    const type = parseTypeSpec(spec);
    if (type === null) {
        throw new Error(`defineHost: ${what} is not a valid type`);
    }
    return type;
}

/**
 * Validates and freezes a host. Host code is trusted, so a malformed host
 * throws instead of returning errors.
 *
 * @category Core
 */
export function defineHost(definition: HostDefinition = {}): Host {
    const effects = new Map<string, HostEffect>();
    for (const [name, implementation] of entriesOf(definition.effects)) {
        const nameError = checkName(name, joinPath('effects', name), 'effect');
        if (nameError !== null) {
            throw new Error(`defineHost: ${nameError.message}`);
        }
        if (typeof implementation.run !== 'function') {
            throw new Error(`defineHost: effect ${name} needs a run function`);
        }
        const args = new Map<string, ValueType>();
        for (const [arg, spec] of entriesOf(implementation.args)) {
            const argError = checkName(arg, arg, 'argument');
            if (argError !== null) {
                throw new Error(`defineHost: ${argError.message}`);
            }
            args.set(arg, hostType(spec, `argument ${arg} of effect ${name}`));
        }
        const returns =
            implementation.returns === undefined
                ? null
                : hostType(implementation.returns, `returns of effect ${name}`);
        effects.set(
            name,
            Object.freeze({ args, returns, run: implementation.run })
        );
    }
    return Object.freeze({
        effects,
        services: Object.freeze({
            random: definition.services?.random ?? Math.random,
            now: definition.services?.now ?? Date.now,
        }),
        limits: resolveLimits(definition.limits),
        onError: definition.onError ?? defaultOnError,
    });
}

/** Every effect the document declares must exist on the host with the same types. */
export function checkHostEffects(
    definition: MachineDefinition,
    host: Host
): LoadError[] {
    const errors: LoadError[] = [];
    for (const [name, declaration] of entriesOf(definition.effects)) {
        const path = joinPath('effects', name);
        const effect = host.effects.get(name);
        if (effect === undefined) {
            errors.push(
                loadError(
                    'missing-effect',
                    path,
                    `the host does not provide effect ${name}`
                )
            );
            continue;
        }
        const declaredArgs = entriesOf(declaration.args);
        const argsMatch =
            declaredArgs.length === effect.args.size &&
            declaredArgs.every(([arg, spec]) => {
                const hostArg = effect.args.get(arg);
                return (
                    hostArg !== undefined &&
                    sameType(hostArg, parseTypeSpec(spec)!)
                );
            });
        const declaredReturns =
            declaration.returns === undefined
                ? null
                : parseTypeSpec(declaration.returns)!;
        const returnsMatch =
            declaredReturns === null || effect.returns === null
                ? declaredReturns === effect.returns
                : sameType(declaredReturns, effect.returns);
        if (!argsMatch || !returnsMatch) {
            errors.push(
                loadError(
                    'effect-signature-mismatch',
                    path,
                    `effect ${name} is declared as ${signature(declaration.args, declaredReturns)} but the host provides ${hostSignature(effect)}`
                )
            );
        }
    }
    return errors;
}

function signature(
    args: Readonly<Record<string, TypeSpec>>,
    returns: ValueType | null
): string {
    const list = entriesOf(args)
        .map(([name, spec]) => `${name}: ${describeType(parseTypeSpec(spec)!)}`)
        .join(', ');
    return `(${list})${returns === null ? '' : ` -> ${describeType(returns)}`}`;
}

function hostSignature(effect: HostEffect): string {
    const list = [...effect.args]
        .map(([name, type]) => `${name}: ${describeType(type)}`)
        .join(', ');
    return `(${list})${effect.returns === null ? '' : ` -> ${describeType(effect.returns)}`}`;
}
```

`packages/being-portable/src/api-types.ts`:

```ts
import { LoadError } from './errors';
import { MachineDefinition } from './format/types';

/**
 * @category Types
 */
export type ValidationResult =
    | { readonly ok: true; readonly definition: MachineDefinition }
    | { readonly ok: false; readonly errors: readonly LoadError[] };
```

`packages/being-portable/src/api.ts`:

```ts
import { ValidationResult } from './api-types';
import { copyPlainData } from './copy';
import { Host, checkHostEffects } from './host';
import { DEFAULT_LIMITS, Limits, resolveLimits } from './limits';
import { checkDefinition } from './validate';

/**
 * Checks an untrusted document without building a machine. With a host, also
 * checks that the host supplies every declared effect with matching types.
 *
 * Limits come from `options.limits` if given, else from the host, else the
 * defaults.
 *
 * @category Core
 */
export function validateDefinition(
    document: unknown,
    options: { readonly limits?: Partial<Limits>; readonly host?: Host } = {}
): ValidationResult {
    const limits =
        options.limits !== undefined
            ? resolveLimits(options.limits)
            : (options.host?.limits ?? DEFAULT_LIMITS);
    const copied = copyPlainData(document, limits);
    if (!copied.ok) {
        return copied;
    }
    const checked = checkDefinition(copied.value, limits);
    if (!checked.ok || options.host === undefined) {
        return checked;
    }
    const hostErrors = checkHostEffects(checked.definition, options.host);
    return hostErrors.length > 0 ? { ok: false, errors: hostErrors } : checked;
}
```

- [ ] **Step 4: Run the tests and the build**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: PASS, 56 tests.

Run: `bunx nx build being-portable --skip-nx-cache`
Expected: `Successfully ran target build for project being-portable`.

- [ ] **Step 5: Commit**

```bash
bunx prettier --write packages/being-portable
git add packages/being-portable
git commit -m "feat(being-portable): host definition, effect signature checks and validateDefinition"
```

---

### Task 6: Interpreter: context store, expressions, statements, payloads

**Files:**

- Create: `packages/being-portable/src/interpret/store.ts`
- Create: `packages/being-portable/src/interpret/expr.ts`
- Create: `packages/being-portable/src/interpret/stmt.ts`
- Create: `packages/being-portable/src/interpret/payload.ts`
- Test: `packages/being-portable/test/interpret.test.ts`

**Interfaces:**

- Consumes: `Expr`, `Stmt`, `Value`, `ScalarValue`, `TypeSpec`, `ContextFieldDefinition` (Task 1); `checkValue`, `describeType`, `freezeValue`, `parseTypeSpec` (Task 1); `raise`, `RuntimeErrorCode` (Task 1); `Services`, `HostEffect` (Task 5); `Limits` (Task 1).
- Produces:
    - `interpret/store.ts`: `interface StoreTransaction { isActive: boolean; markDirty(store): void }`, and `class ContextStore(fields, transaction)` with `has`, `get`, `initialValue`, `fieldNames`, `set` (saves the old value on the first write in a transaction), `resetToInitial`, `commitTransaction`, `rollbackTransaction`, `replaceAll`, `toRecord`
    - `interpret/expr.ts`: `type PayloadRecord`, `type EvalEnv = { ctx; payload; child; services; limits; site }` (`site` is mutable: the JSON path reported on failure), `evaluate(expr: Expr, env: EvalEnv): Value`
    - `interpret/stmt.ts`: `type OutputSink = { value: Value | undefined }`, `interface EffectCaller { callEffect(name, site, run) }`, `type StmtEnv = EvalEnv & { effects; calls; output }`, `checkWrite(value: Value, env: EvalEnv): void`, `runStatements(statements, env, path): void`
    - `interpret/payload.ts`: `type PayloadCheck`, `validatePayload(fields, payload: unknown, limits): PayloadCheck`

- [ ] **Step 1: Write the failing test**

`packages/being-portable/test/interpret.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { PortableRuntimeFailure } from '../src/errors';
import { Expr, Stmt, Value } from '../src/format/types';
import { HostEffect, Services } from '../src/host';
import { EvalEnv, evaluate } from '../src/interpret/expr';
import { validatePayload } from '../src/interpret/payload';
import {
    EffectCaller,
    OutputSink,
    StmtEnv,
    runStatements,
} from '../src/interpret/stmt';
import { ContextStore, StoreTransaction } from '../src/interpret/store';
import { DEFAULT_LIMITS, Limits } from '../src/limits';

const idle: StoreTransaction = { isActive: false, markDirty: () => {} };

function store(): ContextStore {
    return new ContextStore(
        {
            n: { type: 'number', initial: 2 },
            s: { type: 'string', initial: 'hi' },
            items: { type: 'list', of: 'number', initial: [1, 2, 3] },
        },
        idle
    );
}

function env(
    overrides: Partial<EvalEnv> = {},
    services: Partial<Services> = {}
): EvalEnv {
    return {
        ctx: store(),
        payload: Object.freeze({ amount: 5 }),
        child: null,
        services: { random: () => 0.5, now: () => 1000, ...services },
        limits: DEFAULT_LIMITS,
        site: 'here',
        ...overrides,
    };
}

function failure(run: () => unknown): PortableRuntimeFailure {
    try {
        run();
    } catch (error) {
        if (error instanceof PortableRuntimeFailure) return error;
        throw error;
    }
    throw new Error('expected a failure');
}

const op = (name: string, ...args: Expr[]): Expr => ({ op: name, args });

describe('evaluate', () => {
    it('reads literals, context, payload and lists', () => {
        const e = env();
        expect(evaluate(3, e)).toBe(3);
        expect(evaluate({ ctx: 'n' }, e)).toBe(2);
        expect(evaluate({ payload: 'amount' }, e)).toBe(5);
        const list = evaluate({ list: [1, { ctx: 'n' }] }, e);
        expect(list).toEqual([1, 2]);
        expect(Object.isFrozen(list)).toBe(true);
    });

    it('applies arithmetic and comparison', () => {
        const e = env();
        expect(evaluate(op('+', 1, 2, 3), e)).toBe(6);
        expect(evaluate(op('-', 5, 2), e)).toBe(3);
        expect(evaluate(op('%', 7, 4), e)).toBe(3);
        expect(evaluate(op('max', 1, 9, 4), e)).toBe(9);
        expect(evaluate(op('round', 2.5), e)).toBe(3);
        expect(evaluate(op('>=', { ctx: 'n' }, 2), e)).toBe(true);
        expect(evaluate(op('==', 'a', 'a'), e)).toBe(true);
    });

    it('short-circuits and, or and cond', () => {
        const e = env();
        const boom = op('at', { ctx: 'items' }, 99);
        expect(evaluate(op('and', false, op('==', boom, 1)), e)).toBe(false);
        expect(evaluate(op('or', true, op('==', boom, 1)), e)).toBe(true);
        expect(evaluate(op('cond', true, 1, boom), e)).toBe(1);
        expect(evaluate(op('not', false), e)).toBe(true);
    });

    it('handles strings and lists', () => {
        const e = env();
        expect(evaluate(op('concat', 'a', { ctx: 's' }), e)).toBe('ahi');
        expect(evaluate(op('toString', 1.5), e)).toBe('1.5');
        expect(evaluate(op('length', { ctx: 'items' }), e)).toBe(3);
        expect(evaluate(op('at', { ctx: 'items' }, 1), e)).toBe(2);
        expect(evaluate(op('contains', { ctx: 'items' }, 3), e)).toBe(true);
        expect(evaluate(op('indexOf', { ctx: 'items' }, 9), e)).toBe(-1);
    });

    it('uses the services for randomInt and now', () => {
        expect(evaluate(op('randomInt', 1, 6), env())).toBe(4);
        expect(evaluate(op('now'), env())).toBe(1000);
    });

    it('fails on runtime conditions with the current site', () => {
        const e = env();
        expect(failure(() => evaluate(op('/', 1, 0), e))).toMatchObject({
            code: 'non-finite-number',
            path: 'here',
        });
        expect(
            failure(() => evaluate(op('at', { ctx: 'items' }, 3), e)).code
        ).toBe('index-out-of-range');
        expect(
            failure(() => evaluate(op('at', { ctx: 'items' }, 0.5), e)).code
        ).toBe('not-an-integer');
        expect(failure(() => evaluate(op('randomInt', 6, 1), e)).code).toBe(
            'invalid-range'
        );
    });

    it('rejects bad service values and service exceptions', () => {
        const bad = env({}, { random: () => 1 });
        expect(failure(() => evaluate(op('randomInt', 1, 6), bad)).code).toBe(
            'service-invalid'
        );
        const throwing = env(
            {},
            {
                now: () => {
                    throw new Error('clock down');
                },
            }
        );
        expect(failure(() => evaluate(op('now'), throwing)).message).toContain(
            'clock down'
        );
    });

    it('caps concat results', () => {
        const limits: Limits = { ...DEFAULT_LIMITS, maxStringLength: 4 };
        expect(
            failure(() => evaluate(op('concat', 'abc', 'de'), env({ limits })))
                .code
        ).toBe('limit-exceeded');
    });
});

function stmtEnv(
    overrides: Partial<StmtEnv> = {},
    effects: Record<string, Partial<HostEffect>> = {}
): { env: StmtEnv; calls: string[] } {
    const calls: string[] = [];
    const caller: EffectCaller = {
        callEffect: (name, _site, run) => {
            calls.push(name);
            return run();
        },
    };
    const map = new Map<string, HostEffect>();
    for (const [name, effect] of Object.entries(effects)) {
        map.set(name, {
            args: new Map(),
            returns: null,
            run: () => undefined,
            ...effect,
        });
    }
    return {
        env: {
            ...env(),
            effects: map,
            calls: caller,
            output: null,
            ...overrides,
        },
        calls,
    };
}

describe('runStatements', () => {
    it('runs set, push, removeAt and if', () => {
        const { env: e } = stmtEnv();
        const statements: Stmt[] = [
            { set: 'n', to: op('+', { ctx: 'n' }, { payload: 'amount' }) },
            { push: 'items', value: 4 },
            { removeAt: 'items', index: 0 },
            {
                if: op('>', { ctx: 'n' }, 5),
                then: [{ set: 's', to: 'big' }],
                else: [{ set: 's', to: 'small' }],
            },
        ];
        runStatements(statements, e, 'do');
        expect(e.ctx.get('n')).toBe(7);
        expect(e.ctx.get('items')).toEqual([2, 3, 4]);
        expect(e.ctx.get('s')).toBe('big');
        expect(Object.isFrozen(e.ctx.get('items'))).toBe(true);
    });

    it('writes output to the sink', () => {
        const sink: OutputSink = { value: undefined };
        const { env: e } = stmtEnv({ output: sink });
        runStatements([{ output: op('*', { ctx: 'n' }, 10) }], e, 'do');
        expect(sink.value).toBe(20);
    });

    it('calls effects with frozen args and writes into', () => {
        let received: Readonly<Record<string, Value>> | null = null;
        const { env: e, calls } = stmtEnv(
            {},
            {
                draw: {
                    returns: { kind: 'scalar', scalar: 'string' },
                    run: args => {
                        received = args;
                        return 'card';
                    },
                },
            }
        );
        runStatements(
            [{ call: 'draw', args: { n: { ctx: 'n' } }, into: 's' }],
            e,
            'do'
        );
        expect(calls).toEqual(['draw']);
        expect(received).toEqual({ n: 2 });
        expect(Object.isFrozen(received)).toBe(true);
        expect(e.ctx.get('s')).toBe('card');
    });

    it('rejects an effect return of the wrong type', () => {
        const { env: e } = stmtEnv(
            {},
            {
                draw: {
                    returns: { kind: 'scalar', scalar: 'string' },
                    run: () => 7,
                },
            }
        );
        expect(
            failure(() => runStatements([{ call: 'draw', into: 's' }], e, 'do'))
        ).toMatchObject({ code: 'effect-return-mismatch', path: 'do[0]' });
    });

    it('reports the path of the failing nested statement', () => {
        const { env: e } = stmtEnv();
        expect(
            failure(() =>
                runStatements(
                    [
                        {
                            if: true,
                            then: [
                                { set: 'n', to: 1 },
                                { removeAt: 'items', index: 9 },
                            ],
                        },
                    ],
                    e,
                    'on.x.do'
                )
            )
        ).toMatchObject({
            code: 'index-out-of-range',
            path: 'on.x.do[0].then[1]',
        });
    });

    it('enforces list and string limits on writes', () => {
        const limits: Limits = {
            ...DEFAULT_LIMITS,
            maxListLength: 3,
            maxStringLength: 3,
        };
        const { env: e } = stmtEnv({ limits });
        expect(
            failure(() => runStatements([{ push: 'items', value: 4 }], e, 'do'))
                .code
        ).toBe('limit-exceeded');
        expect(
            failure(() => runStatements([{ set: 's', to: 'long' }], e, 'do'))
                .code
        ).toBe('limit-exceeded');
    });
});

describe('ContextStore', () => {
    it('rolls back to the values before the transaction', () => {
        const dirty: ContextStore[] = [];
        const tx = {
            isActive: true,
            markDirty: (s: ContextStore) => dirty.push(s),
        };
        const s = new ContextStore({ n: { type: 'number', initial: 1 } }, tx);
        s.set('n', 2);
        s.set('n', 3);
        expect(dirty).toEqual([s]);
        s.rollbackTransaction();
        expect(s.get('n')).toBe(1);
        s.set('n', 4);
        s.commitTransaction();
        s.set('n', 5);
        s.rollbackTransaction();
        expect(s.get('n')).toBe(4);
    });
});

describe('validatePayload', () => {
    const fields = {
        amount: 'number' as const,
        tags: { type: 'list' as const, of: 'string' as const },
    };

    it('copies a valid payload into a frozen null-prototype record', () => {
        const tags = ['a'];
        const result = validatePayload(
            fields,
            { amount: 1, tags },
            DEFAULT_LIMITS
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(Object.getPrototypeOf(result.value)).toBeNull();
        tags.push('b');
        expect(result.value.tags).toEqual(['a']);
    });

    it('rejects missing, extra and mistyped fields', () => {
        expect(validatePayload(fields, { amount: 1 }, DEFAULT_LIMITS).ok).toBe(
            false
        );
        expect(
            validatePayload(
                fields,
                { amount: 1, tags: [], x: 1 },
                DEFAULT_LIMITS
            ).ok
        ).toBe(false);
        expect(
            validatePayload(fields, { amount: '1', tags: [] }, DEFAULT_LIMITS)
                .ok
        ).toBe(false);
        expect(validatePayload(fields, [1], DEFAULT_LIMITS).ok).toBe(false);
    });

    it('allows no payload for an event without fields', () => {
        expect(validatePayload({}, undefined, DEFAULT_LIMITS).ok).toBe(true);
        expect(validatePayload(fields, undefined, DEFAULT_LIMITS).ok).toBe(
            false
        );
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: FAIL with `Cannot find module '../src/interpret/expr'`.

- [ ] **Step 3: Write the implementation**

`packages/being-portable/src/interpret/store.ts`:

```ts
import { ContextFieldDefinition, Value } from '../format/types';
import { entriesOf } from '../util';

/** The part of a transaction a store needs. */
export interface StoreTransaction {
    readonly isActive: boolean;
    markDirty(store: ContextStore): void;
}

/**
 * One machine's context. Values are immutable (lists are frozen), so saving a
 * field's previous value on its first write in a transaction is enough to
 * roll it back.
 */
export class ContextStore {
    private readonly values = new Map<string, Value>();
    private readonly initial: ReadonlyMap<string, Value>;
    private saved: Map<string, Value> | null = null;

    constructor(
        fields: Readonly<Record<string, ContextFieldDefinition>>,
        private readonly transaction: StoreTransaction
    ) {
        const initial = new Map<string, Value>();
        for (const [name, field] of entriesOf(fields)) {
            initial.set(name, field.initial);
        }
        this.initial = initial;
        for (const [name, value] of initial) {
            this.values.set(name, value);
        }
    }

    has(field: string): boolean {
        return this.values.has(field);
    }

    get(field: string): Value {
        return this.values.get(field) as Value;
    }

    initialValue(field: string): Value {
        return this.initial.get(field) as Value;
    }

    fieldNames(): string[] {
        return [...this.values.keys()];
    }

    set(field: string, value: Value): void {
        if (this.transaction.isActive) {
            if (this.saved === null) {
                this.saved = new Map();
                this.transaction.markDirty(this);
            }
            if (!this.saved.has(field)) {
                this.saved.set(field, this.values.get(field) as Value);
            }
        }
        this.values.set(field, value);
    }

    resetToInitial(): void {
        for (const [name, value] of this.initial) {
            this.set(name, value);
        }
    }

    commitTransaction(): void {
        this.saved = null;
    }

    rollbackTransaction(): void {
        if (this.saved !== null) {
            for (const [name, value] of this.saved) {
                this.values.set(name, value);
            }
        }
        this.saved = null;
    }

    /** Replaces every value outside any transaction (restore). */
    replaceAll(values: ReadonlyMap<string, Value>): void {
        for (const [name, value] of values) {
            this.values.set(name, value);
        }
    }

    toRecord(): Record<string, Value> {
        const record: Record<string, Value> = {};
        for (const [name, value] of this.values) {
            record[name] = value;
        }
        return record;
    }
}
```

`packages/being-portable/src/interpret/expr.ts`:

```ts
import { RuntimeErrorCode, raise } from '../errors';
import { Expr, ScalarValue, Value } from '../format/types';
import { Services } from '../host';
import { Limits } from '../limits';
import { describeError } from '../util';
import { ContextStore } from './store';

/** A validated, frozen, null-prototype payload. */
export type PayloadRecord = Readonly<Record<string, Value>>;

/** What an expression can read while it runs. */
export type EvalEnv = {
    readonly ctx: ContextStore;
    readonly payload: PayloadRecord | null;
    readonly child: ContextStore | null;
    readonly services: Services;
    readonly limits: Limits;
    /** JSON path reported if evaluation fails. The caller keeps it current. */
    site: string;
};

function fail(env: EvalEnv, code: RuntimeErrorCode, message: string): never {
    return raise(env.site, code, message);
}

function finite(value: number, op: string, env: EvalEnv): number {
    if (!Number.isFinite(value)) {
        fail(env, 'non-finite-number', `${op} produced ${value}`);
    }
    return value;
}

function integer(value: number, what: string, env: EvalEnv): number {
    if (!Number.isInteger(value)) {
        fail(env, 'not-an-integer', `${what} must be an integer, got ${value}`);
    }
    return value;
}

function service(env: EvalEnv, name: 'random' | 'now'): number {
    let value: unknown;
    try {
        value = env.services[name]();
    } catch (error) {
        fail(
            env,
            'service-invalid',
            `${name}() threw: ${describeError(error)}`
        );
    }
    const valid =
        typeof value === 'number' &&
        Number.isFinite(value) &&
        (name === 'now' || (value >= 0 && value < 1));
    if (!valid) {
        fail(
            env,
            'service-invalid',
            name === 'random'
                ? `random() returned ${String(value)}; it must return a number in [0, 1)`
                : `now() returned ${String(value)}; it must return a finite number`
        );
    }
    return value as number;
}

/**
 * Evaluates a validated expression. Types are already guaranteed by the
 * checker; only runtime conditions (ranges, finiteness, limits) can fail.
 */
export function evaluate(expr: Expr, env: EvalEnv): Value {
    if (typeof expr !== 'object') {
        return expr;
    }
    if ('list' in expr) {
        return Object.freeze(
            expr.list.map(item => evaluate(item, env) as ScalarValue)
        );
    }
    if ('ctx' in expr) {
        return env.ctx.get(expr.ctx);
    }
    if ('payload' in expr) {
        if (env.payload === null) {
            throw new Error('payload is not available outside an event');
        }
        return env.payload[expr.payload];
    }
    if ('childCtx' in expr) {
        if (env.child === null) {
            throw new Error('childCtx is only available in onDone');
        }
        return env.child.get(expr.childCtx);
    }
    return applyOperator(expr.op, expr.args ?? [], env);
}

function applyOperator(op: string, args: readonly Expr[], env: EvalEnv): Value {
    const number = (index: number) => evaluate(args[index], env) as number;
    const numbers = () => args.map(arg => evaluate(arg, env) as number);
    const list = (index: number) =>
        evaluate(args[index], env) as readonly ScalarValue[];
    switch (op) {
        case '+':
            return finite(
                numbers().reduce((sum, value) => sum + value),
                op,
                env
            );
        case '*':
            return finite(
                numbers().reduce((product, value) => product * value),
                op,
                env
            );
        case '-':
            return finite(number(0) - number(1), op, env);
        case '/':
            return finite(number(0) / number(1), op, env);
        case '%':
            return finite(number(0) % number(1), op, env);
        case 'min':
            return Math.min(...numbers());
        case 'max':
            return Math.max(...numbers());
        case 'abs':
            return Math.abs(number(0));
        case 'floor':
            return Math.floor(number(0));
        case 'ceil':
            return Math.ceil(number(0));
        case 'round':
            return Math.round(number(0));
        case '==':
            return evaluate(args[0], env) === evaluate(args[1], env);
        case '!=':
            return evaluate(args[0], env) !== evaluate(args[1], env);
        case '<':
            return number(0) < number(1);
        case '<=':
            return number(0) <= number(1);
        case '>':
            return number(0) > number(1);
        case '>=':
            return number(0) >= number(1);
        case 'and':
            return args.every(arg => evaluate(arg, env) === true);
        case 'or':
            return args.some(arg => evaluate(arg, env) === true);
        case 'not':
            return evaluate(args[0], env) !== true;
        case 'cond':
            return evaluate(args[0], env) === true
                ? evaluate(args[1], env)
                : evaluate(args[2], env);
        case 'concat': {
            let text = '';
            for (const arg of args) {
                text += evaluate(arg, env) as string;
                if (text.length > env.limits.maxStringLength) {
                    fail(
                        env,
                        'limit-exceeded',
                        `concat produced more than ${env.limits.maxStringLength} characters`
                    );
                }
            }
            return text;
        }
        case 'toString':
            return String(evaluate(args[0], env));
        case 'length':
            return (evaluate(args[0], env) as string | readonly ScalarValue[])
                .length;
        case 'at': {
            const items = list(0);
            const index = integer(number(1), 'at index', env);
            if (index < 0 || index >= items.length) {
                fail(
                    env,
                    'index-out-of-range',
                    `index ${index} is outside a list of ${items.length}`
                );
            }
            return items[index];
        }
        case 'contains':
            return list(0).includes(evaluate(args[1], env) as ScalarValue);
        case 'indexOf':
            return list(0).indexOf(evaluate(args[1], env) as ScalarValue);
        case 'randomInt': {
            const min = integer(number(0), 'randomInt min', env);
            const max = integer(number(1), 'randomInt max', env);
            if (min > max) {
                fail(
                    env,
                    'invalid-range',
                    `randomInt min ${min} is greater than max ${max}`
                );
            }
            return min + Math.floor(service(env, 'random') * (max - min + 1));
        }
        case 'now':
            return service(env, 'now');
        default:
            throw new Error(`unknown operator ${op}`);
    }
}
```

`packages/being-portable/src/interpret/stmt.ts`:

```ts
import { RuntimeErrorCode, raise } from '../errors';
import { ScalarValue, Stmt, Value } from '../format/types';
import { checkValue, describeType, freezeValue } from '../format/values';
import { HostEffect } from '../host';
import { EvalEnv, evaluate } from './expr';

/** Where an `output` statement writes. */
export type OutputSink = { value: Value | undefined };

/** Runs an effect on behalf of a statement; the transaction implements it. */
export interface EffectCaller {
    callEffect(
        name: string,
        site: string,
        run: () => Value | void
    ): Value | void;
}

export type StmtEnv = EvalEnv & {
    readonly effects: ReadonlyMap<string, HostEffect>;
    readonly calls: EffectCaller;
    /** `null` where `output` is not allowed (the checker guarantees it is unused). */
    readonly output: OutputSink | null;
};

function fail(env: EvalEnv, code: RuntimeErrorCode, message: string): never {
    return raise(env.site, code, message);
}

function checkString(value: string, env: EvalEnv): void {
    if (value.length > env.limits.maxStringLength) {
        fail(
            env,
            'limit-exceeded',
            `string longer than ${env.limits.maxStringLength} characters`
        );
    }
}

/** Fails when a value about to be written exceeds the list or string limits. */
export function checkWrite(value: Value, env: EvalEnv): void {
    if (typeof value === 'string') {
        checkString(value, env);
        return;
    }
    if (typeof value !== 'object') {
        return;
    }
    if (value.length > env.limits.maxListLength) {
        fail(
            env,
            'limit-exceeded',
            `list longer than ${env.limits.maxListLength} items`
        );
    }
    for (const item of value) {
        if (typeof item === 'string') {
            checkString(item, env);
        }
    }
}

/** Runs validated statements in order. Throws `PortableRuntimeFailure` on failure. */
export function runStatements(
    statements: readonly Stmt[],
    env: StmtEnv,
    path: string
): void {
    for (let index = 0; index < statements.length; index++) {
        const statement = statements[index];
        const site = `${path}[${index}]`;
        env.site = site;
        if ('set' in statement) {
            const value = evaluate(statement.to, env);
            checkWrite(value, env);
            env.ctx.set(statement.set, value);
        } else if ('push' in statement) {
            const item = evaluate(statement.value, env) as ScalarValue;
            const items = env.ctx.get(statement.push) as readonly ScalarValue[];
            if (items.length + 1 > env.limits.maxListLength) {
                fail(
                    env,
                    'limit-exceeded',
                    `list longer than ${env.limits.maxListLength} items`
                );
            }
            if (typeof item === 'string') {
                checkString(item, env);
            }
            env.ctx.set(statement.push, Object.freeze([...items, item]));
        } else if ('removeAt' in statement) {
            const index = evaluate(statement.index, env) as number;
            const items = env.ctx.get(
                statement.removeAt
            ) as readonly ScalarValue[];
            if (!Number.isInteger(index)) {
                fail(
                    env,
                    'not-an-integer',
                    `removeAt index must be an integer, got ${index}`
                );
            }
            if (index < 0 || index >= items.length) {
                fail(
                    env,
                    'index-out-of-range',
                    `index ${index} is outside a list of ${items.length}`
                );
            }
            env.ctx.set(
                statement.removeAt,
                Object.freeze([
                    ...items.slice(0, index),
                    ...items.slice(index + 1),
                ])
            );
        } else if ('if' in statement) {
            const taken = evaluate(statement.if, env) === true;
            const branch = taken ? statement.then : statement.else;
            if (branch !== undefined) {
                runStatements(
                    branch,
                    env,
                    `${site}.${taken ? 'then' : 'else'}`
                );
            }
        } else if ('call' in statement) {
            runCall(statement, env, site);
        } else {
            const value = evaluate(statement.output, env);
            checkWrite(value, env);
            if (env.output !== null) {
                env.output.value = value;
            }
        }
    }
}

function runCall(
    statement: Extract<Stmt, { call: string }>,
    env: StmtEnv,
    site: string
): void {
    const effect = env.effects.get(statement.call);
    if (effect === undefined) {
        throw new Error(`effect ${statement.call} is not available`);
    }
    const args: Record<string, Value> = Object.create(null);
    const given = statement.args ?? {};
    for (const name of Object.keys(given)) {
        args[name] = evaluate(given[name], env);
    }
    env.site = site;
    Object.freeze(args);
    const returned = env.calls.callEffect(statement.call, site, () =>
        effect.run(args)
    );
    if (statement.into === undefined) {
        return;
    }
    const returns = effect.returns!;
    const check = checkValue(returned, returns, env.limits);
    if (check !== 'ok') {
        fail(
            env,
            check === 'limit' ? 'limit-exceeded' : 'effect-return-mismatch',
            `effect ${statement.call} returned ${Array.isArray(returned) ? 'a list' : typeof returned}, expected ${describeType(returns)}`
        );
    }
    env.ctx.set(statement.into, freezeValue(returned as Value));
}
```

`packages/being-portable/src/interpret/payload.ts`:

```ts
import { TypeSpec, Value } from '../format/types';
import {
    checkValue,
    describeType,
    freezeValue,
    parseTypeSpec,
} from '../format/values';
import { Limits } from '../limits';
import { hasOwn } from '../util';
import { PayloadRecord } from './expr';

export type PayloadCheck =
    | { readonly ok: true; readonly value: PayloadRecord }
    | { readonly ok: false; readonly message: string };

const EMPTY_PAYLOAD: PayloadRecord = Object.freeze(Object.create(null));

/**
 * Checks a host-supplied payload against an event's declared fields and
 * copies it into a frozen, null-prototype record.
 */
export function validatePayload(
    fields: Readonly<Record<string, TypeSpec>>,
    payload: unknown,
    limits: Pick<Limits, 'maxListLength' | 'maxStringLength'>
): PayloadCheck {
    const declared = Object.keys(fields);
    if (payload === undefined || payload === null) {
        return declared.length === 0
            ? { ok: true, value: EMPTY_PAYLOAD }
            : {
                  ok: false,
                  message: `missing payload; expected ${declared.join(', ')}`,
              };
    }
    if (typeof payload !== 'object' || Array.isArray(payload)) {
        return { ok: false, message: 'payload must be an object' };
    }
    const prototype = Object.getPrototypeOf(payload);
    if (prototype !== Object.prototype && prototype !== null) {
        return { ok: false, message: 'payload must be a plain object' };
    }
    for (const key of Object.keys(payload)) {
        if (!hasOwn(fields, key)) {
            return { ok: false, message: `unexpected payload field "${key}"` };
        }
    }
    const record: Record<string, Value> = Object.create(null);
    for (const name of declared) {
        const descriptor = Object.getOwnPropertyDescriptor(payload, name);
        if (descriptor === undefined || !('value' in descriptor)) {
            return { ok: false, message: `missing payload field "${name}"` };
        }
        const type = parseTypeSpec(fields[name])!;
        const check = checkValue(descriptor.value, type, limits);
        if (check === 'type') {
            return {
                ok: false,
                message: `payload field "${name}" must be ${describeType(type)}`,
            };
        }
        if (check === 'limit') {
            return {
                ok: false,
                message: `payload field "${name}" is longer than the limits allow`,
            };
        }
        record[name] = freezeValue(descriptor.value as Value);
    }
    return { ok: true, value: Object.freeze(record) };
}
```

- [ ] **Step 4: Run the tests and the build**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: PASS, 74 tests.

Run: `bunx nx build being-portable --skip-nx-cache`
Expected: `Successfully ran target build for project being-portable`.

- [ ] **Step 5: Commit**

```bash
bunx prettier --write packages/being-portable
git add packages/being-portable
git commit -m "feat(being-portable): expression and statement interpreter with context store"
```

---

### Task 7: The transaction: rollback, re-entry, effect calls, event frames

**Files:**

- Create: `packages/being-portable/src/interpret/tx.ts`
- Test: `packages/being-portable/test/tx.test.ts`

**Interfaces:**

- Consumes: `ContextStore`, `StoreTransaction` (Task 6); `EffectCaller` (Task 6); `PayloadRecord` (Task 6); `PortableRuntimeFailure`, `RuntimeError` (Task 1).
- Produces: `interpret/tx.ts`:
    - `type EventFrame = { payload: PayloadRecord | null; child: ContextStore | null }`
    - `interface TxMachine { rawSetState(state: string): void }`
    - `type TxEntry = 'new' | 'nested' | 'reentrant'`, `type TxOutcome<T>`
    - `class Transaction(onError)`, which implements `StoreTransaction` and `EffectCaller`:
        - `isActive`, `entry()`
        - `run(event, body)`: rolls back on any exception; reports a `PortableRuntimeFailure` to `onError` and rethrows anything else
        - `reportReentrant(event, call)`, `markDirty(store)`, `recordState(machine, state)`
        - `delegate(body)`, `hostCode(body)`, `callEffect(name, site, run)`, `withFrame(frame, body)`, `currentFrame()`

- [ ] **Step 1: Write the failing test**

`packages/being-portable/test/tx.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { PortableRuntimeFailure, RuntimeError } from '../src/errors';
import { ContextStore } from '../src/interpret/store';
import { Transaction, TxMachine } from '../src/interpret/tx';

function setup() {
    const errors: RuntimeError[] = [];
    const tx = new Transaction(error => errors.push(error));
    const store = new ContextStore({ n: { type: 'number', initial: 0 } }, tx);
    let state = 'A';
    const machine: TxMachine = { rawSetState: next => (state = next) };
    const moveTo = (next: string) => {
        tx.recordState(machine, state);
        state = next;
    };
    return { tx, store, errors, moveTo, state: () => state };
}

const failWith = () => {
    throw new PortableRuntimeFailure('index-out-of-range', 'boom', 'do[0]');
};

describe('Transaction', () => {
    it('commits on success', () => {
        const { tx, store, moveTo, state } = setup();
        const outcome = tx.run('go', () => {
            store.set('n', 1);
            moveTo('B');
            return 'done';
        });
        expect(outcome).toEqual({ ok: true, value: 'done' });
        expect(store.get('n')).toBe(1);
        expect(state()).toBe('B');
        expect(tx.isActive).toBe(false);
    });

    it('rolls back stores and states and reports a machine failure', () => {
        const { tx, store, errors, moveTo, state } = setup();
        const outcome = tx.run('go', () => {
            store.set('n', 1);
            moveTo('B');
            tx.callEffect('ping', 'do[0]', () => undefined);
            failWith();
        });
        expect(outcome).toEqual({ ok: false });
        expect(store.get('n')).toBe(0);
        expect(state()).toBe('A');
        expect(errors).toEqual([
            {
                code: 'index-out-of-range',
                message: 'boom',
                path: 'do[0]',
                event: 'go',
                effectsCalled: ['ping'],
            },
        ]);
    });

    it('rolls back and rethrows anything else', () => {
        const { tx, store, errors } = setup();
        expect(() =>
            tx.run(null, () => {
                store.set('n', 1);
                throw new TypeError('host bug');
            })
        ).toThrow('host bug');
        expect(store.get('n')).toBe(0);
        expect(errors).toEqual([]);
        expect(tx.isActive).toBe(false);
    });

    it('turns an effect exception into effect-failed', () => {
        const { tx, errors } = setup();
        tx.run('go', () =>
            tx.callEffect('launch', 'do[2]', () => {
                throw new Error('no fuel');
            })
        );
        expect(errors[0]).toMatchObject({
            code: 'effect-failed',
            path: 'do[2]',
            effectsCalled: ['launch'],
        });
        expect(errors[0].message).toContain('no fuel');
    });

    it('classifies entry by delegation and host code', () => {
        const { tx } = setup();
        expect(tx.entry()).toBe('new');
        tx.run('go', () => {
            expect(tx.entry()).toBe('reentrant');
            tx.delegate(() => {
                expect(tx.entry()).toBe('nested');
                tx.hostCode(() => expect(tx.entry()).toBe('reentrant'));
                tx.callEffect('e', '', () => {
                    expect(tx.entry()).toBe('reentrant');
                });
            });
        });
    });

    it('does not recurse when onError calls back during a re-entrant report', () => {
        const reports: RuntimeError[] = [];
        const tx: Transaction = new Transaction(error => {
            reports.push(error);
            tx.reportReentrant('again', 'happens()');
        });
        tx.run('go', () => tx.reportReentrant('x', 'happens()'));
        expect(reports.map(report => report.code)).toEqual(['reentrant-call']);
    });

    it('stacks event frames', () => {
        const { tx } = setup();
        expect(tx.currentFrame()).toBeNull();
        const outer = { payload: null, child: null };
        const inner = { payload: Object.freeze({ a: 1 }), child: null };
        tx.withFrame(outer, () => {
            tx.withFrame(inner, () => expect(tx.currentFrame()).toBe(inner));
            expect(tx.currentFrame()).toBe(outer);
        });
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: FAIL with `Cannot find module '../src/interpret/tx'`.

- [ ] **Step 3: Write the implementation**

`packages/being-portable/src/interpret/tx.ts`:

```ts
import { PortableRuntimeFailure, RuntimeError } from '../errors';
import { Value } from '../format/types';
import { describeError } from '../util';
import { PayloadRecord } from './expr';
import { EffectCaller } from './stmt';
import { ContextStore, StoreTransaction } from './store';

/** What guards and actions can read about the event being handled. */
export type EventFrame = {
    readonly payload: PayloadRecord | null;
    /** The finished child's context, only while `onDone` runs. */
    readonly child: ContextStore | null;
};

/** A machine whose current state the transaction can put back. */
export interface TxMachine {
    rawSetState(state: string): void;
}

/**
 * How a call on a machine relates to a running transaction:
 * - `new`: nothing is running; start a transaction.
 * - `nested`: a parent is delegating to its child; join the running one.
 * - `reentrant`: host code (an effect, a service, a subscriber) called back in.
 */
export type TxEntry = 'new' | 'nested' | 'reentrant';

export type TxOutcome<T> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false };

/**
 * One transaction shared by a whole machine tree. It saves each touched
 * store's and machine's previous values, rolls them back on failure, and
 * reports machine failures to the host.
 */
export class Transaction implements StoreTransaction, EffectCaller {
    private active = false;
    private hostDepth = 0;
    private delegationDepth = 0;
    private reporting = false;
    private event: string | null = null;
    private effectsCalled: string[] = [];
    private readonly frames: EventFrame[] = [];
    private readonly dirty: ContextStore[] = [];
    private readonly savedStates = new Map<TxMachine, string>();

    constructor(private readonly onError: (error: RuntimeError) => void) {}

    get isActive(): boolean {
        return this.active;
    }

    entry(): TxEntry {
        if (!this.active) {
            return 'new';
        }
        return this.hostDepth === 0 && this.delegationDepth > 0
            ? 'nested'
            : 'reentrant';
    }

    /**
     * Runs `body` as one transaction. A `PortableRuntimeFailure` rolls back and
     * is reported to `onError`; any other exception rolls back and is rethrown.
     */
    run<T>(event: string | null, body: () => T): TxOutcome<T> {
        this.active = true;
        this.event = event;
        this.effectsCalled = [];
        try {
            const value = body();
            for (const store of this.dirty) {
                store.commitTransaction();
            }
            return { ok: true, value };
        } catch (error) {
            for (const store of this.dirty) {
                store.rollbackTransaction();
            }
            this.savedStates.forEach((state, machine) =>
                machine.rawSetState(state)
            );
            if (!(error instanceof PortableRuntimeFailure)) {
                throw error;
            }
            const report: RuntimeError = {
                code: error.code,
                message: error.message,
                path: error.path,
                event,
                effectsCalled: [...this.effectsCalled],
            };
            this.end();
            this.report(report);
            return { ok: false };
        } finally {
            this.end();
        }
    }

    private end(): void {
        this.active = false;
        this.event = null;
        this.hostDepth = 0;
        this.delegationDepth = 0;
        this.frames.length = 0;
        this.dirty.length = 0;
        this.savedStates.clear();
    }

    reportReentrant(event: string | null, call: string): void {
        const during =
            this.event === null
                ? 'a start, reset or wrapup'
                : `event "${this.event}"`;
        this.report({
            code: 'reentrant-call',
            message: `${call} was called during ${during}; defer it, for example with queueMicrotask`,
            path: '',
            event,
            effectsCalled: [],
        });
    }

    private report(error: RuntimeError): void {
        if (this.reporting) {
            return;
        }
        this.reporting = true;
        try {
            this.onError(error);
        } finally {
            this.reporting = false;
        }
    }

    markDirty(store: ContextStore): void {
        this.dirty.push(store);
    }

    /** Saves a machine's state before its first change in this transaction. */
    recordState(machine: TxMachine, state: string): void {
        if (this.active && !this.savedStates.has(machine)) {
            this.savedStates.set(machine, state);
        }
    }

    /** Runs a parent's call into its child. */
    delegate<T>(body: () => T): T {
        this.delegationDepth += 1;
        try {
            return body();
        } finally {
            this.delegationDepth -= 1;
        }
    }

    /** Runs host code: anything it calls back into the tree is re-entrant. */
    hostCode<T>(body: () => T): T {
        this.hostDepth += 1;
        try {
            return body();
        } finally {
            this.hostDepth -= 1;
        }
    }

    callEffect(
        name: string,
        site: string,
        run: () => Value | void
    ): Value | void {
        this.effectsCalled.push(name);
        this.hostDepth += 1;
        try {
            return run();
        } catch (error) {
            throw new PortableRuntimeFailure(
                'effect-failed',
                `effect ${name} threw: ${describeError(error)}`,
                site
            );
        } finally {
            this.hostDepth -= 1;
        }
    }

    withFrame<T>(frame: EventFrame, body: () => T): T {
        this.frames.push(frame);
        try {
            return body();
        } finally {
            this.frames.pop();
        }
    }

    currentFrame(): EventFrame | null {
        return this.frames.length === 0
            ? null
            : this.frames[this.frames.length - 1];
    }
}
```

- [ ] **Step 4: Run the tests and the build**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: PASS, 81 tests.

Run: `bunx nx build being-portable --skip-nx-cache`
Expected: `Successfully ran target build for project being-portable`.

- [ ] **Step 5: Commit**

```bash
bunx prettier --write packages/being-portable
git add packages/being-portable
git commit -m "feat(being-portable): tree-wide transaction with rollback and re-entry guard"
```

---

### Task 8: Compile flat machines and `loadMachine`

This task compiles machines without children; Task 9 adds child machines. `build.ts` here gives every state a plain `PortableState`, and Task 9 replaces that loop.

**Files:**

- Modify: `packages/being-portable/src/api-types.ts` (replace the whole file)
- Modify: `packages/being-portable/src/api.ts` (replace the whole file)
- Create: `packages/being-portable/src/compile/names.ts`
- Create: `packages/being-portable/src/compile/context.ts`
- Create: `packages/being-portable/src/compile/runtime.ts`
- Create: `packages/being-portable/src/compile/parts.ts`
- Create: `packages/being-portable/src/compile/state.ts`
- Create: `packages/being-portable/src/compile/machine.ts`
- Create: `packages/being-portable/src/compile/build.ts`
- Create (test helper): `packages/being-portable/test/recording-host.ts`
- Test: `packages/being-portable/test/machine.test.ts`, `packages/being-portable/test/parity.test.ts`

**Interfaces:**

- Consumes: everything from Tasks 1–7; from `@ue-too/being`: `TemplateState`, `TemplateStateMachine`, `State`, `EventResult`, `EventReactions`, `EventGuards`, `EventPreconditions`, `Guard`, `StateMachine`, `BaseContext`, `extractMachineGraph` (in tests), `createVendingMachine` (in the parity test).
- Produces:
    - `api-types.ts`: `PortableEvents` and `PortableOutputs` (both `Record<never, never>`, so `happens` takes any event name and an optional payload); `interface PortableContext extends BaseContext { get(field); fields() }`; `interface PortableMachine extends StateMachine<PortableEvents, PortableContext, string, PortableOutputs> { definition; context }`; `ValidationResult`; `LoadOptions = { autoStart? }`; `LoadResult`
    - `compile/names.ts`: `printExpr(expr)`, `guardLabel(expr)` (truncated to `MAX_GUARD_LABEL = 60`), `uniqueName(base, taken)`
    - `compile/context.ts`: `class PortableContextImpl(store)` with `get`, `fields`, `setup` (resets to initial values, then applies any pending `with`), `cleanup`, `prepareWith(values | null)`
    - `compile/runtime.ts`: `type PortableStateBase`, `type HandlesArgs`, `type MachineRuntime`, `evalEnv(runtime, frame)`, `stmtEnv(runtime, frame, output)`, `runBlock(runtime, statements, path)`
    - `compile/parts.ts`: `DONE_EVENT = '$done'`, `type CompiledGuard`, `type CompiledReaction`, `type CompiledParts`, `compileStateParts(runtime, state, statePath): CompiledParts`
    - `compile/state.ts`: `type BeingParts`, `asBeingParts(parts)`, `payloadOf(params)`, `class PortableState(runtime, state, path)`
    - `compile/machine.ts`: `type PortableStateInstance`, and `class PortableStateMachine(states, initialState, runtime)`, which implements `PortableMachine` and `TxMachine` and has public `runtime`, `rawSetState`, `isInFinalState()` and `childFor(state)`
    - `compile/build.ts`: `buildMachineTree(definition, host): PortableStateMachine`
    - `api.ts`: `loadMachine(document: unknown, host: Host, options?: LoadOptions): LoadResult`
    - `test/recording-host.ts`: `type Recorder = { host; calls; errors }`, `recordingHost(overrides?, run?)`: a host whose `dispense`, `refund` and `note` effects record their calls

Design notes (the spec explains each):

- The compiled `being` classes are parameterized on the public `PortableContext`, not on `PortableContextImpl`. `being`'s `GuardEvaluation` is a function property, so it is contravariant in the context type, and a machine typed on the implementation class fails `implements PortableMachine`.
- `being` passes guards only the context. `PortableState.handles` pushes an event frame holding the payload, and compiled guards read it through `runtime.transaction.currentFrame()`. A guard called outside an event (as devtools does) has no frame: a `ctx`-only guard still works, and a `payload` guard throws.
- The machine is built with `autoStart = false` because `TemplateStateMachine`'s constructor would otherwise call the overridden `start()` before `this.runtime` is assigned. `loadMachine` starts it.
- `reset()` calls `super.wrapup()`, `this.switchTo('INITIAL')` and `super.start()` directly, so its inner steps don't re-enter the transaction check.

- [ ] **Step 1: Write the failing tests**

`packages/being-portable/test/recording-host.ts`:

```ts
import { RuntimeError } from '../src/errors';
import { Value } from '../src/format/types';
import { Host, HostDefinition, defineHost } from '../src/host';

export type Recorder = {
    readonly host: Host;
    readonly calls: { name: string; args: Record<string, Value> }[];
    readonly errors: RuntimeError[];
};

/**
 * A host whose effects record their calls. `overrides` replaces parts of the
 * host definition; `run` overrides replace individual effect bodies.
 */
export function recordingHost(
    overrides: HostDefinition = {},
    run: Record<string, (args: Record<string, Value>) => Value | void> = {}
): Recorder {
    const calls: Recorder['calls'] = [];
    const errors: RuntimeError[] = [];
    const record =
        (name: string) =>
        (args: Readonly<Record<string, Value>>): Value | void => {
            calls.push({ name, args: { ...args } });
            return run[name]?.({ ...args });
        };
    const host = defineHost({
        effects: {
            dispense: { args: { item: 'string' }, run: record('dispense') },
            refund: { args: { amount: 'number' }, run: record('refund') },
            note: { args: { text: 'string' }, run: record('note') },
        },
        onError: error => errors.push(error),
        ...overrides,
    });
    return { host, calls, errors };
}
```

`packages/being-portable/test/machine.test.ts`:

```ts
import { extractMachineGraph } from '@ue-too/being';
import { describe, expect, it } from 'vitest';

import { loadMachine } from '../src/api';
import { PortableMachine } from '../src/api-types';
import { Host } from '../src/host';
import { Doc, vendingDoc } from './fixtures';
import { recordingHost } from './recording-host';

function load(doc: Doc, host: Host, autoStart = true): PortableMachine {
    const result = loadMachine(doc, host, { autoStart });
    if (!result.ok) {
        throw new Error(JSON.stringify(result.errors));
    }
    return result.machine;
}

describe('loadMachine', () => {
    it('returns errors instead of a machine for an invalid document', () => {
        const doc = vendingDoc();
        doc.initialState = 'NOWHERE';
        expect(loadMachine(doc, recordingHost().host)).toMatchObject({
            ok: false,
            errors: [{ code: 'unknown-state' }],
        });
    });

    it('starts unless autoStart is false', () => {
        const { host } = recordingHost();
        expect(load(vendingDoc(), host).currentState).toBe('IDLE');
        const idle = load(vendingDoc(), host, false);
        expect(idle.currentState).toBe('INITIAL');
        idle.start();
        expect(idle.currentState).toBe('IDLE');
    });

    it('exposes the normalized definition', () => {
        const machine = load(vendingDoc(), recordingHost().host);
        expect(machine.definition.id).toBe('vending');
        expect(JSON.parse(JSON.stringify(machine.definition))).toEqual(
            vendingDoc()
        );
    });
});

describe('a flat machine', () => {
    it('runs the vending machine', () => {
        const { host, calls } = recordingHost();
        const machine = load(vendingDoc(), host);
        expect(machine.happens('insertCoin', { amount: 3 })).toEqual({
            handled: true,
            nextState: 'HAS_MONEY',
        });
        expect(machine.currentState).toBe('HAS_MONEY');

        const result = machine.happens('select', { item: 'cola', price: 2 });
        expect(result).toEqual({
            handled: true,
            nextState: 'HAS_MONEY',
            output: 1,
        });
        expect(calls).toEqual([{ name: 'dispense', args: { item: 'cola' } }]);
        expect(machine.context.get('sold')).toEqual(['cola']);

        machine.happens('select', { item: 'gum', price: 1 });
        expect(machine.currentState).toBe('IDLE');
        expect(machine.context.fields()).toEqual({
            balance: 0,
            sold: ['cola', 'gum'],
        });
    });

    it('does not handle an event whose precondition fails', () => {
        const { host, calls } = recordingHost();
        const machine = load(vendingDoc(), host);
        machine.happens('insertCoin', { amount: 1 });
        expect(machine.happens('select', { item: 'cola', price: 2 })).toEqual({
            handled: false,
        });
        expect(machine.currentState).toBe('HAS_MONEY');
        expect(calls).toEqual([]);
    });

    it('ignores undeclared events quietly', () => {
        const { host, errors } = recordingHost();
        const machine = load(vendingDoc(), host);
        expect(machine.happens('teleport')).toEqual({ handled: false });
        expect(machine.happens('toString')).toEqual({ handled: false });
        expect(errors).toEqual([]);
    });

    it('reports a payload that does not match the event', () => {
        const { host, errors } = recordingHost();
        const machine = load(vendingDoc(), host);
        expect(machine.happens('insertCoin', { amount: '3' })).toEqual({
            handled: false,
        });
        expect(errors).toMatchObject([
            {
                code: 'payload-mismatch',
                path: 'events.insertCoin',
                event: 'insertCoin',
            },
        ]);
    });

    it('keeps the context read-only for the host', () => {
        const machine = load(vendingDoc(), recordingHost().host);
        expect(() => machine.context.get('missing')).toThrow('missing');
        expect(Object.isFrozen(machine.context.fields())).toBe(true);
        expect(() => machine.setContext(machine.context)).toThrow('setContext');
    });

    it('resets to the initial values', () => {
        const machine = load(vendingDoc(), recordingHost().host);
        machine.happens('insertCoin', { amount: 3 });
        machine.reset();
        expect(machine.currentState).toBe('IDLE');
        expect(machine.context.get('balance')).toBe(0);
    });
});

describe('atomic events', () => {
    it('rolls back when an effect throws mid-event', () => {
        const { host, errors } = recordingHost(
            {},
            {
                refund: () => {
                    throw new Error('jammed');
                },
            }
        );
        const machine = load(vendingDoc(), host);
        machine.happens('insertCoin', { amount: 3 });
        expect(machine.happens('cancel')).toEqual({ handled: false });
        expect(machine.currentState).toBe('HAS_MONEY');
        expect(machine.context.get('balance')).toBe(3);
        expect(errors).toMatchObject([
            {
                code: 'effect-failed',
                path: 'states.HAS_MONEY.on.cancel.do[0]',
                event: 'cancel',
                effectsCalled: ['refund'],
            },
        ]);
    });

    it('rolls back a transition when enter fails', () => {
        const doc = vendingDoc();
        doc.states.HAS_MONEY.enter = [
            { set: 'balance', to: { op: '/', args: [1, 0] } },
        ];
        const { host, errors } = recordingHost();
        const machine = load(doc, host);
        expect(machine.happens('insertCoin', { amount: 3 })).toEqual({
            handled: false,
        });
        expect(machine.currentState).toBe('IDLE');
        expect(machine.context.get('balance')).toBe(0);
        expect(errors[0]).toMatchObject({
            code: 'non-finite-number',
            path: 'states.HAS_MONEY.enter[0]',
        });
    });

    it('leaves the machine in INITIAL when start fails', () => {
        const doc = vendingDoc();
        doc.states.IDLE.enter = [{ removeAt: 'sold', index: 0 }];
        const { host, errors } = recordingHost();
        const result = loadMachine(doc, host);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.machine.currentState).toBe('INITIAL');
        expect(errors[0]).toMatchObject({
            code: 'index-out-of-range',
            event: null,
        });
    });

    it('rolls back and rethrows when a subscriber throws', () => {
        const { host, errors } = recordingHost();
        const machine = load(vendingDoc(), host);
        machine.onStateChange(() => {
            throw new Error('subscriber bug');
        });
        expect(() => machine.happens('insertCoin', { amount: 3 })).toThrow(
            'subscriber bug'
        );
        expect(machine.currentState).toBe('IDLE');
        expect(machine.context.get('balance')).toBe(0);
        expect(errors).toEqual([]);
    });
});

describe('re-entry', () => {
    it('rejects happens() from inside an effect and keeps the outer event', () => {
        let machine: PortableMachine | null = null;
        let inner: unknown = null;
        const { host, errors } = recordingHost(
            {},
            {
                refund: () => {
                    inner = machine!.happens('insertCoin', { amount: 9 });
                },
            }
        );
        machine = load(vendingDoc(), host);
        machine.happens('insertCoin', { amount: 3 });
        expect(machine.happens('cancel')).toEqual({
            handled: true,
            nextState: 'IDLE',
        });
        expect(inner).toEqual({ handled: false });
        expect(machine.context.get('balance')).toBe(0);
        expect(errors).toMatchObject([
            { code: 'reentrant-call', event: 'insertCoin' },
        ]);
    });

    it('rejects happens() from a subscriber, and reset throws', () => {
        const { host, errors } = recordingHost();
        const machine = load(vendingDoc(), host);
        let thrown = '';
        machine.onHappens(() => {
            machine.happens('cancel');
            try {
                machine.reset();
            } catch (error) {
                thrown = (error as Error).message;
            }
        });
        machine.happens('insertCoin', { amount: 1 });
        expect(machine.currentState).toBe('HAS_MONEY');
        expect(errors.map(error => error.code)).toEqual(['reentrant-call']);
        expect(thrown).toMatch(/^reentrant-call/);
    });

    it('lets onError start a new event after a failure', () => {
        let machine: PortableMachine | null = null;
        const { host } = recordingHost({
            onError: () => {
                machine!.happens('insertCoin', { amount: 1 });
            },
        });
        machine = load(vendingDoc(), host);
        machine.happens('insertCoin', { amount: 'bad' as unknown as number });
        expect(machine.context.get('balance')).toBe(1);
    });
});

describe('introspection', () => {
    it('shows named and inline guards in the graph', () => {
        const machine = load(vendingDoc(), recordingHost().host);
        const edges = extractMachineGraph(machine).edges.filter(
            edge => edge.event === 'select'
        );
        expect(edges).toEqual([
            {
                from: 'HAS_MONEY',
                to: 'IDLE',
                event: 'select',
                preconditions: ['canAfford'],
            },
            {
                from: 'HAS_MONEY',
                to: 'HAS_MONEY',
                event: 'select',
                guard: 'balance > 0',
                preconditions: ['canAfford'],
            },
        ]);
    });

    it('lets tools call ctx-only guards outside an event', () => {
        const doc = vendingDoc();
        doc.states.HAS_MONEY.guards.hasMoney = {
            op: '>',
            args: [{ ctx: 'balance' }, 0],
        };
        const machine = load(doc, recordingHost().host);
        machine.happens('insertCoin', { amount: 1 });
        const guards = machine.states.HAS_MONEY.guards;
        expect(guards.hasMoney(machine.context)).toBe(true);
        expect(() => guards.canAfford(machine.context)).toThrow('payload');
    });
});
```

`packages/being-portable/test/parity.test.ts`:

```ts
import { createVendingMachine } from '@ue-too/being';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { loadMachine } from '../src/api';
import { defineHost } from '../src/host';
import { Doc } from './fixtures';

const say = (text: string) => ({ call: 'say', args: { text } });

/** being's `vending-machine-example.ts`, written as a portable document. */
function vendingExampleDoc(): Doc {
    const events = {
        insertBills: {},
        selectCoke: {},
        selectRedBull: {},
        selectWater: {},
        cancelTransaction: {},
    };
    return {
        format: 'being-machine@1',
        id: 'vendingExample',
        revision: 1,
        context: {},
        events,
        effects: { say: { args: { text: 'string' } } },
        initialState: 'IDLE',
        states: {
            IDLE: {
                on: {
                    insertBills: {
                        do: [say('inserted bills')],
                        target: 'ONE_DOLLAR_INSERTED',
                    },
                },
            },
            ONE_DOLLAR_INSERTED: {
                on: {
                    insertBills: {
                        do: [say('inserted bills')],
                        target: 'TWO_DOLLARS_INSERTED',
                    },
                    selectCoke: {
                        do: [say('selected coke; thank you for your purchase')],
                        target: 'IDLE',
                    },
                    selectRedBull: {
                        do: [
                            say(
                                'selected red bull; not enough money, 1 dollar short, please insert more money'
                            ),
                        ],
                    },
                    selectWater: {
                        do: [
                            say(
                                'selected water; not enough money, 2 dollars short, please insert more money'
                            ),
                        ],
                    },
                    cancelTransaction: {
                        do: [
                            say(
                                'cancelled transaction; refunding 1 dollar; please take your money'
                            ),
                        ],
                        target: 'IDLE',
                    },
                },
            },
            TWO_DOLLARS_INSERTED: {
                on: {
                    insertBills: {
                        do: [say('inserted bills')],
                        target: 'THREE_DOLLARS_INSERTED',
                    },
                    selectCoke: {
                        do: [say('selected coke; thank you for your purchase')],
                        target: 'IDLE',
                    },
                    selectRedBull: {
                        do: [
                            say(
                                'selected red bull; thank you for your purchase'
                            ),
                        ],
                        target: 'IDLE',
                    },
                    selectWater: {
                        do: [
                            say(
                                'selected water; not enough money, 1 dollars short, please insert more money'
                            ),
                        ],
                    },
                    cancelTransaction: {
                        do: [
                            say(
                                'cancelled transaction; refunding 2 dollars; please take your money'
                            ),
                        ],
                        target: 'IDLE',
                    },
                },
            },
            THREE_DOLLARS_INSERTED: {
                on: {
                    insertBills: {
                        do: [
                            say(
                                'not taking more bills; returning the inserted bills'
                            ),
                        ],
                    },
                    selectCoke: {
                        do: [say('selected coke; change: 1 dollar')],
                        target: 'IDLE',
                    },
                    selectRedBull: {
                        do: [say('selected red bull; change: 2 dollars')],
                        target: 'IDLE',
                    },
                    selectWater: { do: [say('selected water; no change')] },
                    cancelTransaction: {
                        do: [
                            say(
                                'cancelled transaction; refunding 3 dollars; please take your money'
                            ),
                        ],
                        target: 'IDLE',
                    },
                },
            },
        },
    };
}

const SEQUENCE = [
    'insertBills',
    'selectWater',
    'insertBills',
    'selectRedBull',
    'insertBills',
    'insertBills',
    'insertBills',
    'insertBills',
    'selectWater',
    'selectCoke',
    'selectCoke',
    'insertBills',
    'cancelTransaction',
];

describe('parity with the hand-written vending example', () => {
    let logSpy: ReturnType<typeof spyOn>;
    beforeEach(() => {
        logSpy = spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => logSpy.mockRestore());

    it('visits the same states and says the same things', () => {
        const original = createVendingMachine();
        const originalStates: string[] = [];
        for (const event of SEQUENCE) {
            original.happens(event as 'insertBills');
            originalStates.push(original.currentState);
        }
        const originalLines = logSpy.mock.calls.map(call => String(call[0]));

        const lines: string[] = [];
        const host = defineHost({
            effects: {
                say: {
                    args: { text: 'string' },
                    run: ({ text }) => {
                        lines.push(text as string);
                    },
                },
            },
        });
        const result = loadMachine(vendingExampleDoc(), host);
        if (!result.ok) throw new Error(JSON.stringify(result.errors));
        const states: string[] = [];
        for (const event of SEQUENCE) {
            result.machine.happens(event);
            states.push(result.machine.currentState);
        }

        expect(states).toEqual(originalStates);
        // every event but the second selectCoke (unhandled in IDLE) says something
        expect(lines).toHaveLength(SEQUENCE.length - 1);
        expect(lines).toEqual(originalLines);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: FAIL with `SyntaxError: Export named 'loadMachine' not found in module '…/src/api.ts'`.

- [ ] **Step 3: Replace `api-types.ts` and `api.ts`**

`packages/being-portable/src/api-types.ts`:

```ts
import { BaseContext, StateMachine } from '@ue-too/being';

import { LoadError } from './errors';
import { MachineDefinition, Value } from './format/types';

/**
 * Event mapping of a portable machine. Events are only known at runtime, so
 * `happens` accepts any event name and an optional payload.
 *
 * @category Types
 */
export type PortableEvents = Record<never, never>;

/**
 * Output mapping of a portable machine; outputs are `unknown` statically.
 *
 * @category Types
 */
export type PortableOutputs = Record<never, never>;

/**
 * A read-only view of a portable machine's context. Only events change it.
 *
 * @category Types
 */
export interface PortableContext extends BaseContext {
    /** The field's current value. Lists are frozen. Throws for an unknown field. */
    get(field: string): Value;
    /** Every field's current value, frozen. */
    fields(): Readonly<Record<string, Value>>;
}

/**
 * A loaded machine: an ordinary `being` state machine plus its definition.
 *
 * @category Types
 */
export interface PortableMachine extends StateMachine<
    PortableEvents,
    PortableContext,
    string,
    PortableOutputs
> {
    /** The upgraded, normalized document, frozen. */
    readonly definition: MachineDefinition;
    readonly context: PortableContext;
}

/**
 * @category Types
 */
export type ValidationResult =
    | { readonly ok: true; readonly definition: MachineDefinition }
    | { readonly ok: false; readonly errors: readonly LoadError[] };

/**
 * @category Types
 */
export type LoadOptions = {
    /** Defaults to `true`. */
    readonly autoStart?: boolean;
};

/**
 * @category Types
 */
export type LoadResult =
    | { readonly ok: true; readonly machine: PortableMachine }
    | { readonly ok: false; readonly errors: readonly LoadError[] };
```

`packages/being-portable/src/api.ts`:

````ts
import { LoadOptions, LoadResult, ValidationResult } from './api-types';
import { buildMachineTree } from './compile/build';
import { copyPlainData } from './copy';
import { Host, checkHostEffects } from './host';
import { DEFAULT_LIMITS, Limits, resolveLimits } from './limits';
import { checkDefinition } from './validate';

/**
 * Checks an untrusted document without building a machine. With a host, also
 * checks that the host supplies every declared effect with matching types.
 *
 * Limits come from `options.limits` if given, else from the host, else the
 * defaults.
 *
 * @category Core
 */
export function validateDefinition(
    document: unknown,
    options: { readonly limits?: Partial<Limits>; readonly host?: Host } = {}
): ValidationResult {
    const limits =
        options.limits !== undefined
            ? resolveLimits(options.limits)
            : (options.host?.limits ?? DEFAULT_LIMITS);
    const copied = copyPlainData(document, limits);
    if (!copied.ok) {
        return copied;
    }
    const checked = checkDefinition(copied.value, limits);
    if (!checked.ok || options.host === undefined) {
        return checked;
    }
    const hostErrors = checkHostEffects(checked.definition, options.host);
    return hostErrors.length > 0 ? { ok: false, errors: hostErrors } : checked;
}

/**
 * Validates an untrusted document and builds its machine. Returns every error
 * instead of a machine when the document is invalid.
 *
 * @example
 * ```ts
 * const result = loadMachine(JSON.parse(text), host);
 * if (!result.ok) return showErrors(result.errors);
 * result.machine.happens('insertCoin', { amount: 1 });
 * ```
 *
 * @category Core
 */
export function loadMachine(
    document: unknown,
    host: Host,
    options: LoadOptions = {}
): LoadResult {
    const validated = validateDefinition(document, { host });
    if (!validated.ok) {
        return validated;
    }
    const machine = buildMachineTree(validated.definition, host);
    if (options.autoStart ?? true) {
        machine.start();
    }
    return { ok: true, machine };
}
````

- [ ] **Step 4: Write the compile layer**

`packages/being-portable/src/compile/names.ts`:

```ts
import { Expr } from '../format/types';

const INFIX = new Set([
    '+',
    '-',
    '*',
    '/',
    '%',
    '==',
    '!=',
    '<',
    '<=',
    '>',
    '>=',
    'and',
    'or',
]);

/** Longest guard label shown in graphs and devtools. */
export const MAX_GUARD_LABEL = 60;

function needsParentheses(expr: Expr): boolean {
    return (
        typeof expr === 'object' &&
        'op' in expr &&
        (INFIX.has(expr.op) || expr.op === 'not')
    );
}

function operand(expr: Expr): string {
    const text = printExpr(expr);
    return needsParentheses(expr) ? `(${text})` : text;
}

/** A readable one-line form of an expression, e.g. `balance >= payload.price`. */
export function printExpr(expr: Expr): string {
    if (typeof expr === 'string') {
        return JSON.stringify(expr);
    }
    if (typeof expr !== 'object') {
        return String(expr);
    }
    if ('list' in expr) {
        return `[${expr.list.map(printExpr).join(', ')}]`;
    }
    if ('ctx' in expr) {
        return expr.ctx;
    }
    if ('payload' in expr) {
        return `payload.${expr.payload}`;
    }
    if ('childCtx' in expr) {
        return `child.${expr.childCtx}`;
    }
    const args = expr.args ?? [];
    if (INFIX.has(expr.op)) {
        return args.map(operand).join(` ${expr.op} `);
    }
    if (expr.op === 'not') {
        return `not ${operand(args[0])}`;
    }
    return `${expr.op}(${args.map(printExpr).join(', ')})`;
}

/** The name an inline guard gets: its printed expression, truncated. */
export function guardLabel(expr: Expr): string {
    const text = printExpr(expr);
    return text.length > MAX_GUARD_LABEL
        ? `${text.slice(0, MAX_GUARD_LABEL - 1)}…`
        : text;
}

/** `base`, or `base #2`, `base #3`… when taken. */
export function uniqueName(base: string, taken: ReadonlySet<string>): string {
    if (!taken.has(base)) {
        return base;
    }
    let suffix = 2;
    while (taken.has(`${base} #${suffix}`)) {
        suffix += 1;
    }
    return `${base} #${suffix}`;
}
```

`packages/being-portable/src/compile/context.ts`:

```ts
import { PortableContext } from '../api-types';
import { Value } from '../format/types';
import { ContextStore } from '../interpret/store';

/** The `context` of a portable machine: a read-only view over its store. */
export class PortableContextImpl implements PortableContext {
    private pendingWith: ReadonlyMap<string, Value> | null = null;

    constructor(readonly store: ContextStore) {}

    get(field: string): Value {
        if (!this.store.has(field)) {
            throw new Error(`unknown context field "${field}"`);
        }
        return this.store.get(field);
    }

    fields(): Readonly<Record<string, Value>> {
        return Object.freeze(this.store.toRecord());
    }

    /** Called by `start()`: back to initial values, then any pending `with`. */
    setup(): void {
        this.store.resetToInitial();
        const pending = this.pendingWith;
        this.pendingWith = null;
        if (pending !== null) {
            for (const [field, value] of pending) {
                this.store.set(field, value);
            }
        }
    }

    cleanup(): void {}

    /** Values a parent's `with` writes over the initial values on the next setup. */
    prepareWith(values: ReadonlyMap<string, Value> | null): void {
        this.pendingWith = values;
    }
}
```

`packages/being-portable/src/compile/runtime.ts`:

```ts
import { TemplateState } from '@ue-too/being';

import { PortableContext, PortableEvents, PortableOutputs } from '../api-types';
import { MachineBody, MachineDefinition, Stmt } from '../format/types';
import { Host, Services } from '../host';
import { EvalEnv } from '../interpret/expr';
import { OutputSink, StmtEnv, runStatements } from '../interpret/stmt';
import { ContextStore } from '../interpret/store';
import { EventFrame, Transaction } from '../interpret/tx';
import { PortableContextImpl } from './context';
import type { PortableStateMachine } from './machine';

/** The being state base every compiled state extends. */
export type PortableStateBase = TemplateState<
    PortableEvents,
    PortableContext,
    string,
    PortableOutputs
>;

export type HandlesArgs = Parameters<PortableStateBase['handles']>;

/** Everything a compiled machine and its states share. */
export type MachineRuntime = {
    readonly definition: MachineDefinition;
    readonly body: MachineBody;
    /** JSON path of the body: `''` for the root, `machines.<key>` for a child. */
    readonly path: string;
    readonly isRoot: boolean;
    readonly transaction: Transaction;
    readonly host: Host;
    /** Host services wrapped so any call back into the tree is re-entrant. */
    readonly services: Services;
    readonly store: ContextStore;
    readonly context: PortableContextImpl;
    /** Child machine per state name, for states with a `child`. */
    readonly children: Map<string, PortableStateMachine>;
    readonly finalStates: ReadonlySet<string>;
};

export function evalEnv(
    runtime: MachineRuntime,
    frame: EventFrame | null
): EvalEnv {
    return {
        ctx: runtime.store,
        payload: frame?.payload ?? null,
        child: frame?.child ?? null,
        services: runtime.services,
        limits: runtime.host.limits,
        site: '',
    };
}

export function stmtEnv(
    runtime: MachineRuntime,
    frame: EventFrame | null,
    output: OutputSink | null
): StmtEnv {
    return {
        ...evalEnv(runtime, frame),
        effects: runtime.host.effects,
        calls: runtime.transaction,
        output,
    };
}

/** Runs `enter` or `exit` statements: no event, no output. */
export function runBlock(
    runtime: MachineRuntime,
    statements: readonly Stmt[] | undefined,
    path: string
): void {
    if (statements !== undefined && statements.length > 0) {
        runStatements(statements, stmtEnv(runtime, null, null), path);
    }
}
```

`packages/being-portable/src/compile/parts.ts`:

```ts
import { Expr, GuardRef, StateDefinition, Stmt, Value } from '../format/types';
import { evaluate } from '../interpret/expr';
import { OutputSink, runStatements } from '../interpret/stmt';
import { entriesOf, joinPath } from '../util';
import { guardLabel, uniqueName } from './names';
import { MachineRuntime, evalEnv, stmtEnv } from './runtime';

/** Reaction key `onDone` is registered under, for introspection only. */
export const DONE_EVENT = '$done';

export type CompiledGuard = (context: unknown) => boolean;

export type CompiledReaction = {
    readonly action: () => Value | undefined;
    readonly defaultTargetState?: string;
};

/** The four maps a being `TemplateState` reads. All null-prototype. */
export type CompiledParts = {
    readonly eventReactions: Record<string, CompiledReaction>;
    readonly guards: Record<string, CompiledGuard>;
    readonly eventGuards: Record<
        string,
        readonly { readonly guard: string; readonly target: string }[]
    >;
    readonly eventPreconditions: Record<string, readonly string[]>;
};

function compileGuard(
    runtime: MachineRuntime,
    expr: Expr,
    site: string
): CompiledGuard {
    return () => {
        const env = evalEnv(runtime, runtime.transaction.currentFrame());
        env.site = site;
        return evaluate(expr, env) === true;
    };
}

function compileAction(
    runtime: MachineRuntime,
    statements: readonly Stmt[],
    path: string
): () => Value | undefined {
    return () => {
        const sink: OutputSink = { value: undefined };
        runStatements(
            statements,
            stmtEnv(runtime, runtime.transaction.currentFrame(), sink),
            path
        );
        return sink.value;
    };
}

/**
 * Turns one state's `guards`, `on` and `onDone` into the maps being reads.
 * Named guards keep their names; inline guards are named by their printed
 * expression.
 */
export function compileStateParts(
    runtime: MachineRuntime,
    state: StateDefinition,
    statePath: string
): CompiledParts {
    const guards: Record<string, CompiledGuard> = Object.create(null);
    const eventReactions: Record<string, CompiledReaction> =
        Object.create(null);
    const eventGuards: Record<string, { guard: string; target: string }[]> =
        Object.create(null);
    const eventPreconditions: Record<string, string[]> = Object.create(null);
    const taken = new Set<string>();

    for (const [name, expr] of entriesOf(state.guards)) {
        taken.add(name);
        guards[name] = compileGuard(
            runtime,
            expr,
            joinPath(joinPath(statePath, 'guards'), name)
        );
    }
    const guardName = (ref: GuardRef, site: string): string => {
        if (typeof ref === 'string') {
            return ref;
        }
        const name = uniqueName(guardLabel(ref), taken);
        taken.add(name);
        guards[name] = compileGuard(runtime, ref, site);
        return name;
    };
    const branchGuards = (
        branches: NonNullable<StateDefinition['onDone']>['branches'],
        path: string
    ) =>
        (branches ?? []).map((branch, index) => ({
            guard: guardName(
                branch.if,
                joinPath(joinPath(joinPath(path, 'branches'), index), 'if')
            ),
            target: branch.target,
        }));

    for (const [event, reaction] of entriesOf(state.on)) {
        const eventPath = joinPath(joinPath(statePath, 'on'), event);
        eventReactions[event] = {
            action: compileAction(
                runtime,
                reaction.do ?? [],
                joinPath(eventPath, 'do')
            ),
            defaultTargetState: reaction.target,
        };
        if (reaction.require !== undefined && reaction.require.length > 0) {
            eventPreconditions[event] = reaction.require.map((ref, index) =>
                guardName(ref, joinPath(joinPath(eventPath, 'require'), index))
            );
        }
        if (reaction.branches !== undefined && reaction.branches.length > 0) {
            eventGuards[event] = branchGuards(reaction.branches, eventPath);
        }
    }
    if (state.onDone !== undefined) {
        const donePath = joinPath(statePath, 'onDone');
        eventReactions[DONE_EVENT] = {
            action: () => undefined,
            defaultTargetState: state.onDone.target,
        };
        eventGuards[DONE_EVENT] = branchGuards(state.onDone.branches, donePath);
    }
    return { eventReactions, guards, eventGuards, eventPreconditions };
}
```

`packages/being-portable/src/compile/state.ts`:

```ts
import {
    EventGuards,
    EventPreconditions,
    EventReactions,
    Guard,
    TemplateState,
} from '@ue-too/being';

import { PortableContext, PortableEvents, PortableOutputs } from '../api-types';
import { StateDefinition } from '../format/types';
import { PayloadRecord } from '../interpret/expr';
import { joinPath } from '../util';
import { CompiledParts, compileStateParts } from './parts';
import { HandlesArgs, MachineRuntime, runBlock } from './runtime';

type Guards = Guard<PortableContext>;

/** The compiled maps, typed the way `TemplateState` stores them. */
export type BeingParts = {
    readonly eventReactions: EventReactions<
        PortableEvents,
        PortableContext,
        string,
        PortableOutputs
    >;
    readonly guards: Guards;
    readonly eventGuards: Partial<
        EventGuards<PortableEvents, string, PortableContext, Guards>
    >;
    readonly eventPreconditions: Partial<
        EventPreconditions<PortableEvents, PortableContext, Guards>
    >;
};

/**
 * The compiled maps are keyed by runtime event names, which being's types
 * cannot see (`PortableEvents` has no static keys), hence the casts.
 */
export function asBeingParts(parts: CompiledParts): BeingParts {
    return parts as unknown as BeingParts;
}

/** The payload a being `handles` call carries. */
export function payloadOf(params: HandlesArgs): PayloadRecord | null {
    return (params[0][1] ?? null) as PayloadRecord | null;
}

/** A state from a document, without a child machine. */
export class PortableState extends TemplateState<
    PortableEvents,
    PortableContext,
    string,
    PortableOutputs
> {
    constructor(
        private readonly runtime: MachineRuntime,
        private readonly state: StateDefinition,
        private readonly path: string
    ) {
        super();
        const parts = asBeingParts(compileStateParts(runtime, state, path));
        this._eventReactions = parts.eventReactions;
        this._guards = parts.guards;
        this._eventGuards = parts.eventGuards;
        this._eventPreconditions = parts.eventPreconditions;
    }

    handles(...params: HandlesArgs) {
        return this.runtime.transaction.withFrame(
            { payload: payloadOf(params), child: null },
            () => super.handles(...params)
        );
    }

    uponEnter(): void {
        runBlock(this.runtime, this.state.enter, joinPath(this.path, 'enter'));
    }

    beforeExit(): void {
        runBlock(this.runtime, this.state.exit, joinPath(this.path, 'exit'));
    }
}
```

`packages/being-portable/src/compile/machine.ts`:

```ts
import { EventResult, State, TemplateStateMachine } from '@ue-too/being';

import {
    PortableContext,
    PortableEvents,
    PortableMachine,
    PortableOutputs,
} from '../api-types';
import { MachineDefinition } from '../format/types';
import { validatePayload } from '../interpret/payload';
import { TxMachine } from '../interpret/tx';
import { hasOwn, joinPath } from '../util';
import { MachineRuntime } from './runtime';

type Base = TemplateStateMachine<
    PortableEvents,
    PortableContext,
    string,
    PortableOutputs
>;

export type PortableStateInstance = State<
    PortableEvents,
    PortableContext,
    string,
    PortableOutputs
>;

/**
 * A compiled machine. Every public entry point runs inside the tree's
 * transaction: a new one from host code, the running one when a parent
 * delegates to this child, and never from inside an effect or subscriber.
 */
export class PortableStateMachine
    extends TemplateStateMachine<
        PortableEvents,
        PortableContext,
        string,
        PortableOutputs
    >
    implements PortableMachine, TxMachine
{
    readonly runtime: MachineRuntime;

    constructor(
        states: Record<string, PortableStateInstance>,
        initialState: string,
        runtime: MachineRuntime
    ) {
        super(states, initialState, runtime.context, false);
        this.runtime = runtime;
    }

    get definition(): MachineDefinition {
        return this.runtime.definition;
    }

    happens(
        ...args: [event: string, payload?: unknown]
    ): EventResult<string, unknown> {
        const [event, payload] = args;
        const transaction = this.runtime.transaction;
        const entry = transaction.entry();
        if (entry === 'nested') {
            return super.happens(event, payload);
        }
        if (entry === 'reentrant') {
            transaction.reportReentrant(
                typeof event === 'string' ? event : null,
                'happens()'
            );
            return { handled: false };
        }
        const events = this.runtime.body.events;
        if (typeof event !== 'string' || !hasOwn(events, event)) {
            return { handled: false };
        }
        const checked = validatePayload(
            events[event],
            payload,
            this.runtime.host.limits
        );
        if (!checked.ok) {
            this.runtime.host.onError({
                code: 'payload-mismatch',
                message: checked.message,
                path: joinPath(joinPath(this.runtime.path, 'events'), event),
                event,
                effectsCalled: [],
            });
            return { handled: false };
        }
        const outcome = transaction.run(event, () =>
            super.happens(event, checked.value)
        );
        return outcome.ok ? outcome.value : { handled: false };
    }

    start(): void {
        this.lifecycle('start()', () => super.start());
    }

    reset(): void {
        this.lifecycle('reset()', () => {
            super.wrapup();
            this.switchTo('INITIAL');
            super.start();
        });
    }

    wrapup(): void {
        this.lifecycle('wrapup()', () => super.wrapup());
    }

    private lifecycle(call: string, body: () => void): void {
        const transaction = this.runtime.transaction;
        const entry = transaction.entry();
        if (entry === 'nested') {
            body();
            return;
        }
        if (entry === 'reentrant') {
            throw new Error(
                `reentrant-call: ${call} was called while the machine was busy; defer it, for example with queueMicrotask`
            );
        }
        transaction.run(null, body);
    }

    switchTo(state: string): void {
        this.runtime.transaction.recordState(this, this.currentState);
        super.switchTo(state);
    }

    /** Sets the state without hooks or recording; for rollback and restore. */
    rawSetState(state: string): void {
        this._currentState = state;
    }

    setContext(): void {
        throw new Error(
            'a portable machine owns its context; setContext() is not supported'
        );
    }

    onStateChange(callback: Parameters<Base['onStateChange']>[0]): () => void {
        return super.onStateChange((from, to) =>
            this.runtime.transaction.hostCode(() => callback(from, to))
        );
    }

    onHappens(callback: Parameters<Base['onHappens']>[0]): () => void {
        return super.onHappens((args, context) =>
            this.runtime.transaction.hostCode(() => callback(args, context))
        );
    }

    onEventResult(callback: Parameters<Base['onEventResult']>[0]): () => void {
        return super.onEventResult((args, result, context) =>
            this.runtime.transaction.hostCode(() =>
                callback(args, result, context)
            )
        );
    }

    isInFinalState(): boolean {
        return this.runtime.finalStates.has(this.currentState);
    }

    /** The child machine the given state hosts, if any. */
    childFor(state: string): PortableStateMachine | null {
        return this.runtime.children.get(state) ?? null;
    }
}
```

`packages/being-portable/src/compile/build.ts`:

```ts
import { MachineDefinition } from '../format/types';
import { Host, Services } from '../host';
import { ContextStore } from '../interpret/store';
import { Transaction } from '../interpret/tx';
import { entriesOf, joinPath } from '../util';
import { PortableContextImpl } from './context';
import { PortableStateInstance, PortableStateMachine } from './machine';
import { MachineRuntime } from './runtime';
import { PortableState } from './state';

/**
 * Builds the machine tree for a validated definition. The root and every
 * child share one transaction. Each state with a `child` gets its own
 * instance of that child machine.
 */
export function buildMachineTree(
    definition: MachineDefinition,
    host: Host
): PortableStateMachine {
    const transaction = new Transaction(host.onError);
    const services: Services = Object.freeze({
        random: () => transaction.hostCode(() => host.services.random()),
        now: () => transaction.hostCode(() => host.services.now()),
    });

    const build = (key: string | null): PortableStateMachine => {
        const body = key === null ? definition : definition.machines![key];
        const path = key === null ? '' : joinPath('machines', key);
        const store = new ContextStore(body.context, transaction);
        const runtime: MachineRuntime = {
            definition,
            body,
            path,
            isRoot: key === null,
            transaction,
            host,
            services,
            store,
            context: new PortableContextImpl(store),
            children: new Map(),
            finalStates: new Set(
                entriesOf(body.states)
                    .filter(([, state]) => state.final === true)
                    .map(([name]) => name)
            ),
        };
        const states: Record<string, PortableStateInstance> =
            Object.create(null);
        for (const [name, state] of entriesOf(body.states)) {
            const statePath = joinPath(joinPath(path, 'states'), name);
            states[name] = new PortableState(runtime, state, statePath);
        }
        return new PortableStateMachine(states, body.initialState, runtime);
    };

    return build(null);
}
```

- [ ] **Step 5: Run the tests and the build**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: PASS, 100 tests.

Run: `bunx nx build being-portable --skip-nx-cache`
Expected: `Successfully ran target build for project being-portable`.

- [ ] **Step 6: Commit**

```bash
bunx prettier --write packages/being-portable
git add packages/being-portable
git commit -m "feat(being-portable): compile documents into being machines and loadMachine"
```

---

### Task 9: Nested machines: `with`, `final`, `onDone`

**Files:**

- Create: `packages/being-portable/src/compile/delegating.ts`
- Modify: `packages/being-portable/src/compile/build.ts` (two edits)
- Test: `packages/being-portable/test/nested.test.ts`

**Interfaces:**

- Consumes: `PortableStateMachine` (`runtime`, `isInFinalState`, `childFor`), `compileStateParts`, `DONE_EVENT`, `asBeingParts`, `payloadOf`, `evalEnv`, `stmtEnv`, `runBlock` (Task 8); `evaluate`, `checkWrite`, `runStatements` (Task 6); `DelegatingState`, `Defer`, `EventResult` from `@ue-too/being`.
- Produces: `compile/delegating.ts`: `class PortableDelegatingState(child, runtime, state, path)`. On entry it runs the parent's `enter`, then `with`, then starts the child. On exit the child wraps up before the parent's `exit`. When a child's event puts it in a final state, the parent's `onDone` runs in the same `happens()` call. `build.ts` builds one child instance per state that has a `child`.

- [ ] **Step 1: Write the failing test**

`packages/being-portable/test/nested.test.ts`:

```ts
import { extractMachineGraph } from '@ue-too/being';
import { describe, expect, it } from 'vitest';

import { loadMachine } from '../src/api';
import { PortableMachine } from '../src/api-types';
import { defineHost } from '../src/host';
import { Doc, gameDoc } from './fixtures';
import { Recorder, recordingHost } from './recording-host';

function load(doc: Doc, recorder: Recorder): PortableMachine {
    const result = loadMachine(doc, recorder.host);
    if (!result.ok) {
        throw new Error(JSON.stringify(result.errors));
    }
    return result.machine;
}

const note = (text: string) => ({ call: 'note', args: { text } });

function child(machine: PortableMachine, state = 'PLAYING'): PortableMachine {
    return (machine.states[state] as unknown as { child: PortableMachine })
        .child;
}

describe('nested machines', () => {
    it('starts the child with values from with', () => {
        const recorder = recordingHost();
        const machine = load(gameDoc(), recorder);
        machine.happens('begin');
        const turn = child(machine);
        expect(turn.currentState).toBe('ROLLING');
        expect(turn.context.get('playerCount')).toBe(2);
        expect(machine.context.get('log')).toEqual(['enter PLAYING']);
    });

    it('runs onDone in the same event when the child finishes', () => {
        const recorder = recordingHost();
        const machine = load(gameDoc(), recorder);
        machine.happens('begin');
        expect(machine.happens('roll', { value: 3 })).toEqual({
            handled: true,
            nextState: 'LOBBY',
        });
        expect(machine.currentState).toBe('LOBBY');
        expect(machine.context.get('score')).toBe(6);
        expect(machine.context.get('log')).toEqual([
            'enter PLAYING',
            'exit PLAYING',
        ]);
    });

    it('enters parent first and exits child first', () => {
        const doc = gameDoc();
        doc.states.PLAYING.enter = [note('parent enter')];
        doc.states.PLAYING.exit = [note('parent exit')];
        const recorder = recordingHost();
        const machine = load(doc, recorder);
        machine.happens('begin');
        machine.happens('quit');
        expect(recorder.calls.map(call => call.args.text)).toEqual([
            'parent enter',
            'turn starts',
            'turn ends',
            'parent exit',
        ]);
        expect(machine.currentState).toBe('LOBBY');
    });

    it('restarts the child fresh on every entry', () => {
        const doc = gameDoc();
        doc.states.LOBBY.on.begin.do = [{ set: 'players', to: 3 }];
        const machine = load(doc, recordingHost());
        machine.happens('begin');
        machine.happens('roll', { value: 1 });
        machine.happens('begin');
        const turn = child(machine);
        expect(turn.currentState).toBe('ROLLING');
        expect(turn.context.get('points')).toBe(0);
        expect(turn.context.get('playerCount')).toBe(3);
    });

    it('stays when onDone has no target, and the child rests', () => {
        const doc = gameDoc();
        delete doc.states.PLAYING.onDone.target;
        const machine = load(doc, recordingHost());
        machine.happens('begin');
        machine.happens('roll', { value: 2 });
        expect(machine.currentState).toBe('PLAYING');
        expect(child(machine).currentState).toBe('DONE');
        expect(machine.happens('roll', { value: 2 })).toEqual({
            handled: false,
        });
    });

    it('passes the child output through', () => {
        const doc = gameDoc();
        doc.outputs = { roll: 'number' };
        doc.machines.turn.outputs = { roll: 'number' };
        doc.machines.turn.states.ROLLING.on.roll.do.push({
            output: { ctx: 'points' },
        });
        const machine = load(doc, recordingHost());
        machine.happens('begin');
        expect(machine.happens('roll', { value: 4 })).toEqual({
            handled: true,
            nextState: 'LOBBY',
            output: 8,
        });
    });

    it('rolls back the whole tree when onDone fails', () => {
        const doc = gameDoc();
        doc.states.PLAYING.onDone.do.push({
            removeAt: 'log',
            index: 99,
        });
        const recorder = recordingHost();
        const machine = load(doc, recorder);
        machine.happens('begin');
        expect(machine.happens('roll', { value: 3 })).toEqual({
            handled: false,
        });
        expect(machine.currentState).toBe('PLAYING');
        expect(child(machine).currentState).toBe('ROLLING');
        expect(child(machine).context.get('points')).toBe(0);
        expect(machine.context.get('score')).toBe(0);
        expect(recorder.errors[0]).toMatchObject({
            code: 'index-out-of-range',
            path: 'states.PLAYING.onDone.do[1]',
            effectsCalled: ['note'],
        });
    });

    it('shows onDone as a $done edge that events cannot trigger', () => {
        const machine = load(gameDoc(), recordingHost());
        expect(extractMachineGraph(machine).edges).toContainEqual({
            from: 'PLAYING',
            to: 'LOBBY',
            event: '$done',
        });
        machine.happens('begin');
        expect(machine.happens('$done')).toEqual({ handled: false });
        expect(machine.currentState).toBe('PLAYING');
    });

    it('chains onDone through three levels in one event', () => {
        const leaf = {
            context: {},
            events: { go: {} },
            initialState: 'A',
            states: {
                A: { on: { go: { target: 'END' } } },
                END: { final: true },
            },
        };
        const mid = {
            context: {},
            events: { go: {} },
            initialState: 'M',
            states: {
                M: { child: { machine: 'leaf' }, onDone: { target: 'MEND' } },
                MEND: { final: true },
            },
        };
        const doc = {
            format: 'being-machine@1',
            id: 'deep',
            revision: 1,
            context: {},
            events: { go: {} },
            machines: { leaf, mid },
            initialState: 'R',
            states: {
                R: {
                    child: { machine: 'mid' },
                    onDone: { target: 'FINISHED' },
                },
                FINISHED: {},
            },
        };
        const result = loadMachine(doc, defineHost());
        if (!result.ok) throw new Error(JSON.stringify(result.errors));
        expect(result.machine.happens('go')).toEqual({
            handled: true,
            nextState: 'FINISHED',
        });
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: FAIL: 8 of the 9 tests in `nested.test.ts` fail, starting with `TypeError: undefined is not an object (evaluating 'turn.currentState')`, because no state hosts a child yet. (The `$done` edge test already passes, since Task 8 registers `onDone` for introspection.)

- [ ] **Step 3: Write `delegating.ts`**

`packages/being-portable/src/compile/delegating.ts`:

```ts
import { Defer, DelegatingState, EventResult } from '@ue-too/being';

import { PortableContext, PortableEvents, PortableOutputs } from '../api-types';
import { StateDefinition, Value } from '../format/types';
import { evaluate } from '../interpret/expr';
import { checkWrite, runStatements } from '../interpret/stmt';
import { entriesOf, joinPath } from '../util';
import type { PortableStateMachine } from './machine';
import { CompiledParts, DONE_EVENT, compileStateParts } from './parts';
import {
    HandlesArgs,
    MachineRuntime,
    evalEnv,
    runBlock,
    stmtEnv,
} from './runtime';
import { asBeingParts, payloadOf } from './state';

type DelegatingBase = DelegatingState<
    PortableEvents,
    PortableContext,
    string,
    PortableStateMachine,
    PortableOutputs
>;

/**
 * A state that hosts a child machine. Adds `with` (parent → child on entry)
 * and `final`/`onDone` (child → parent) to `DelegatingState`.
 */
export class PortableDelegatingState extends DelegatingState<
    PortableEvents,
    PortableContext,
    string,
    PortableStateMachine,
    PortableOutputs
> {
    private readonly parts: CompiledParts;

    protected _defer: Defer<
        PortableContext,
        PortableEvents,
        string,
        PortableOutputs
    > = {
        action: (_context, event, eventKey) =>
            this.forward(eventKey as string, event),
    };

    constructor(
        child: PortableStateMachine,
        private readonly runtime: MachineRuntime,
        private readonly state: StateDefinition,
        private readonly path: string
    ) {
        super(child);
        this.parts = compileStateParts(runtime, state, path);
        const parts = asBeingParts(this.parts);
        this._eventReactions = parts.eventReactions;
        this._guards = parts.guards;
        this._eventGuards = parts.eventGuards;
        this._eventPreconditions = parts.eventPreconditions;
    }

    handles(...params: HandlesArgs) {
        return this.runtime.transaction.withFrame(
            { payload: payloadOf(params), child: null },
            () => super.handles(...params)
        );
    }

    /** Parent `enter`, then `with`, then the child starts. */
    uponEnter(...params: Parameters<DelegatingBase['uponEnter']>): void {
        runBlock(this.runtime, this.state.enter, joinPath(this.path, 'enter'));
        this.child.runtime.context.prepareWith(this.withValues());
        try {
            this.runtime.transaction.delegate(() => super.uponEnter(...params));
        } finally {
            this.child.runtime.context.prepareWith(null);
        }
    }

    /** The child wraps up, then parent `exit`. */
    beforeExit(...params: Parameters<DelegatingBase['beforeExit']>): void {
        this.runtime.transaction.delegate(() => super.beforeExit(...params));
        runBlock(this.runtime, this.state.exit, joinPath(this.path, 'exit'));
    }

    private withValues(): ReadonlyMap<string, Value> | null {
        const entries = entriesOf(this.state.child?.with);
        if (entries.length === 0) {
            return null;
        }
        const env = evalEnv(this.runtime, null);
        const withPath = joinPath(joinPath(this.path, 'child'), 'with');
        const values = new Map<string, Value>();
        for (const [field, expr] of entries) {
            env.site = joinPath(withPath, field);
            const value = evaluate(expr, env);
            checkWrite(value, env);
            values.set(field, value);
        }
        return values;
    }

    private forward(
        event: string,
        payload: unknown
    ): EventResult<string, unknown> {
        const result = this.runtime.transaction.delegate(() =>
            this.child.happens(event, payload)
        );
        if (!result.handled) {
            return { handled: false };
        }
        const output =
            'output' in result && result.output !== undefined
                ? { output: result.output }
                : {};
        if (this.state.onDone !== undefined && this.child.isInFinalState()) {
            const target = this.runDone();
            return target === undefined
                ? { handled: true, ...output }
                : { handled: true, nextState: target, ...output };
        }
        return { handled: true, ...output };
    }

    /** Runs `onDone` with the finished child's context readable; returns the target. */
    private runDone(): string | undefined {
        const done = this.state.onDone!;
        const frame = { payload: null, child: this.child.runtime.store };
        return this.runtime.transaction.withFrame(frame, () => {
            if (done.do !== undefined) {
                runStatements(
                    done.do,
                    stmtEnv(this.runtime, frame, null),
                    joinPath(joinPath(this.path, 'onDone'), 'do')
                );
            }
            for (const mapping of this.parts.eventGuards[DONE_EVENT] ?? []) {
                if (this.parts.guards[mapping.guard](this.runtime.context)) {
                    return mapping.target;
                }
            }
            return done.target;
        });
    }
}
```

- [ ] **Step 4: Build child machines in `build.ts`**

Edit 1 in `packages/being-portable/src/compile/build.ts`. Replace:

```ts
import { PortableContextImpl } from './context';
import { PortableStateInstance, PortableStateMachine } from './machine';
```

with:

```ts
import { PortableContextImpl } from './context';
import { PortableDelegatingState } from './delegating';
import { PortableStateInstance, PortableStateMachine } from './machine';
```

Edit 2 in `packages/being-portable/src/compile/build.ts`. Replace:

```ts
            const statePath = joinPath(joinPath(path, 'states'), name);
            states[name] = new PortableState(runtime, state, statePath);
        }
```

with:

```ts
            const statePath = joinPath(joinPath(path, 'states'), name);
            if (state.child !== undefined) {
                const child = build(state.child.machine);
                runtime.children.set(name, child);
                states[name] = new PortableDelegatingState(
                    child,
                    runtime,
                    state,
                    statePath
                );
            } else {
                states[name] = new PortableState(runtime, state, statePath);
            }
        }
```

- [ ] **Step 5: Run the tests and the build**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: PASS, 109 tests.

Run: `bunx nx build being-portable --skip-nx-cache`
Expected: `Successfully ran target build for project being-portable`.

- [ ] **Step 6: Commit**

```bash
bunx prettier --write packages/being-portable
git add packages/being-portable
git commit -m "feat(being-portable): nested machines with with, final states and onDone"
```

---

### Task 10: Snapshot, strict and structural restore

**Files:**

- Create: `packages/being-portable/src/snapshot.ts`
- Modify: `packages/being-portable/src/api-types.ts` (five edits), `packages/being-portable/src/compile/machine.ts` (two edits), `packages/being-portable/src/api.ts` (one edit)
- Test: `packages/being-portable/test/snapshot.test.ts`

**Interfaces:**

- Consumes: `PortableStateMachine` (`runtime`, `rawSetState`, `childFor`, `currentState`) (Task 8); `copyPlainData`, `isPlainObject` (Task 2); `migrateSnapshot`, `SNAPSHOT_FORMAT` (Task 2); `checkValue`, `describeType`, `freezeValue` (Task 1); `fieldType` (Task 4).
- Produces:
    - `snapshot.ts`: `captureSnapshot(machine): MachineSnapshot` (root only, never during an event), `restoreSnapshot(machine, snapshot: unknown, mode: RestoreMode): RestoreResult` (checks everything first, then applies it all or nothing)
    - `api-types.ts`: `RestoreMode = 'strict' | 'structural'`, `RestoreReport = { dropped; defaulted }`, `RestoreResult`; `PortableMachine` gains `snapshot()` and `restore(snapshot, options?)`; `LoadOptions` gains `snapshot` and `restoreMode`; `LoadResult` gains `restoreReport`
    - `machine.ts`: `snapshot()` and `restore()`, which delegate to `snapshot.ts`
    - `api.ts`: `loadMachine` restores `options.snapshot` instead of starting when it is given

- [ ] **Step 1: Write the failing test**

`packages/being-portable/test/snapshot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { loadMachine } from '../src/api';
import { PortableMachine } from '../src/api-types';
import { Doc, gameDoc, vendingDoc } from './fixtures';
import { recordingHost } from './recording-host';

function load(doc: Doc, options = {}): PortableMachine {
    const result = loadMachine(doc, recordingHost().host, options);
    if (!result.ok) {
        throw new Error(JSON.stringify(result.errors));
    }
    return result.machine;
}

const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('snapshot', () => {
    it('captures state and context as JSON', () => {
        const machine = load(vendingDoc());
        machine.happens('insertCoin', { amount: 3 });
        const snapshot = machine.snapshot();
        expect(snapshot).toEqual({
            format: 'being-snapshot@1',
            machine: { id: 'vending', revision: 1 },
            state: 'HAS_MONEY',
            context: { balance: 3, sold: [] },
        });
        expect(roundTrip(snapshot)).toEqual(snapshot);
    });

    it('includes the running child only', () => {
        const machine = load(gameDoc());
        expect(machine.snapshot().child).toBeUndefined();
        machine.happens('begin');
        expect(machine.snapshot().child).toEqual({
            state: 'ROLLING',
            context: { points: 0, playerCount: 2 },
        });
    });

    it('refuses to snapshot or restore during an event', () => {
        const machine = load(vendingDoc());
        let thrown = '';
        let restored: unknown = null;
        machine.onHappens(() => {
            try {
                machine.snapshot();
            } catch (error) {
                thrown = (error as Error).message;
            }
            restored = machine.restore({});
        });
        machine.happens('insertCoin', { amount: 1 });
        expect(thrown).toMatch(/^reentrant-call/);
        expect(restored).toMatchObject({
            ok: false,
            errors: [{ code: 'reentrant-call' }],
        });
    });

    it('captures an unstarted machine', () => {
        const machine = load(vendingDoc(), { autoStart: false });
        expect(machine.snapshot().state).toBe('INITIAL');
    });
});

describe('restore', () => {
    it('continues exactly like an uninterrupted run', () => {
        const events: [string, unknown?][] = [
            ['begin'],
            ['roll', { value: 3 }],
            ['begin'],
        ];
        const later: [string, unknown?][] = [['roll', { value: 5 }], ['begin']];

        const uninterrupted = load(gameDoc());
        for (const [event, payload] of [...events, ...later]) {
            uninterrupted.happens(event, payload);
        }

        const first = load(gameDoc());
        for (const [event, payload] of events) {
            first.happens(event, payload);
        }
        const text = JSON.stringify(first.snapshot());
        const resumed = loadMachine(gameDoc(), recordingHost().host, {
            snapshot: JSON.parse(text),
        });
        if (!resumed.ok) throw new Error(JSON.stringify(resumed.errors));
        for (const [event, payload] of later) {
            resumed.machine.happens(event, payload);
        }
        expect(resumed.machine.snapshot()).toEqual(uninterrupted.snapshot());
        expect(resumed.restoreReport).toEqual({ dropped: [], defaulted: [] });
    });

    it('runs no statements, calls no effects and notifies no one', () => {
        const source = load(gameDoc());
        source.happens('begin');
        const recorder = recordingHost();
        const result = loadMachine(gameDoc(), recorder.host, {
            autoStart: false,
        });
        if (!result.ok) throw new Error('load failed');
        let notified = false;
        result.machine.onStateChange(() => (notified = true));
        expect(result.machine.restore(source.snapshot()).ok).toBe(true);
        expect(result.machine.currentState).toBe('PLAYING');
        expect(recorder.calls).toEqual([]);
        expect(notified).toBe(false);
        expect(result.machine.context.get('log')).toEqual(['enter PLAYING']);
    });

    it('rejects a snapshot of another machine or revision in strict mode', () => {
        const machine = load(vendingDoc());
        const snapshot = roundTrip(machine.snapshot()) as any;
        expect(
            machine.restore({
                ...snapshot,
                machine: { id: 'other', revision: 1 },
            })
        ).toMatchObject({ ok: false, errors: [{ code: 'machine-mismatch' }] });
        expect(
            machine.restore({
                ...snapshot,
                machine: { id: 'vending', revision: 2 },
            })
        ).toMatchObject({ ok: false, errors: [{ code: 'revision-mismatch' }] });
        expect(
            machine.restore({ ...snapshot, format: 'being-snapshot@9' })
        ).toMatchObject({
            ok: false,
            errors: [{ code: 'unsupported-format' }],
        });
    });

    it('checks states, fields and children', () => {
        const machine = load(gameDoc());
        machine.happens('begin');
        const snapshot = roundTrip(machine.snapshot()) as any;

        const cases: [any, string, string][] = [
            [{ ...snapshot, state: 'MOON' }, 'state-missing', 'state'],
            [
                { ...snapshot, context: { ...snapshot.context, score: 'x' } },
                'field-mismatch',
                'context.score',
            ],
            [
                { ...snapshot, context: { ...snapshot.context, extra: 1 } },
                'field-mismatch',
                'context.extra',
            ],
            [{ ...snapshot, child: undefined }, 'child-missing', 'child'],
            [{ ...snapshot, state: 'LOBBY' }, 'child-unexpected', 'child'],
            [
                { ...snapshot, child: { ...snapshot.child, state: 'INITIAL' } },
                'state-missing',
                'child.state',
            ],
        ];
        for (const [input, code, path] of cases) {
            const clean = roundTrip(input);
            expect(machine.restore(clean)).toMatchObject({
                ok: false,
                errors: [{ code, path }],
            });
        }
    });

    it('changes nothing when it fails', () => {
        const machine = load(vendingDoc());
        machine.happens('insertCoin', { amount: 3 });
        const before = machine.snapshot();
        const bad = {
            ...roundTrip(before),
            state: 'IDLE',
            context: { balance: 'x', sold: [] },
        };
        expect(machine.restore(bad).ok).toBe(false);
        expect(machine.snapshot()).toEqual(before);
    });

    it('rejects values past the limits', () => {
        const result = loadMachine(
            vendingDoc(),
            recordingHost({ limits: { maxListLength: 2 } }).host,
            {
                snapshot: {
                    format: 'being-snapshot@1',
                    machine: { id: 'vending', revision: 1 },
                    state: 'IDLE',
                    context: { balance: 0, sold: ['a', 'b', 'c'] },
                },
            }
        );
        expect(result).toMatchObject({
            ok: false,
            errors: [{ code: 'limit-exceeded', path: 'context.sold' }],
        });
    });
});

describe('structural restore', () => {
    function revisionTwo(): Doc {
        const doc = gameDoc();
        doc.revision = 2;
        delete doc.context.log;
        doc.states.PLAYING.enter = [];
        doc.states.PLAYING.exit = [];
        doc.context.score = { type: 'string', initial: 'none' };
        doc.states.PLAYING.onDone.do = [{ set: 'score', to: 'finished' }];
        doc.context.round = { type: 'number', initial: 1 };
        return doc;
    }

    it('keeps what fits, defaults what is new and drops the rest', () => {
        const machine = load(gameDoc());
        machine.happens('begin');
        const snapshot = machine.snapshot();

        expect(
            loadMachine(revisionTwo(), recordingHost().host, { snapshot })
        ).toMatchObject({ ok: false, errors: [{ code: 'revision-mismatch' }] });

        const result = loadMachine(revisionTwo(), recordingHost().host, {
            snapshot,
            restoreMode: 'structural',
        });
        if (!result.ok) throw new Error(JSON.stringify(result.errors));
        expect(result.restoreReport).toEqual({
            dropped: ['context.score', 'context.log'],
            defaulted: ['context.score', 'context.round'],
        });
        expect(result.machine.context.fields()).toEqual({
            players: 2,
            score: 'none',
            round: 1,
        });
        expect(result.machine.currentState).toBe('PLAYING');
    });

    it('drops a child the state no longer has', () => {
        const machine = load(gameDoc());
        machine.happens('begin');
        const doc = gameDoc();
        doc.revision = 2;
        delete doc.states.PLAYING.child;
        delete doc.states.PLAYING.onDone;
        const result = loadMachine(doc, recordingHost().host, {
            snapshot: machine.snapshot(),
            restoreMode: 'structural',
        });
        if (!result.ok) throw new Error(JSON.stringify(result.errors));
        expect(result.restoreReport?.dropped).toEqual(['child']);
    });

    it('still fails when the state is gone or a child would have to start', () => {
        const machine = load(gameDoc());
        machine.happens('begin');
        const snapshot = roundTrip(machine.snapshot()) as any;

        const gone = gameDoc();
        gone.revision = 2;
        gone.states.PLAYING2 = gone.states.PLAYING;
        delete gone.states.PLAYING;
        gone.states.LOBBY.on.begin.target = 'PLAYING2';
        expect(
            loadMachine(gone, recordingHost().host, {
                snapshot,
                restoreMode: 'structural',
            })
        ).toMatchObject({ ok: false, errors: [{ code: 'state-missing' }] });

        const lobby = { ...snapshot, state: 'LOBBY' };
        delete lobby.child;
        const withChild = gameDoc();
        withChild.revision = 2;
        withChild.states.LOBBY = {
            child: { machine: 'turn' },
            on: { begin: { target: 'PLAYING' } },
        };
        expect(
            loadMachine(withChild, recordingHost().host, {
                snapshot: lobby,
                restoreMode: 'structural',
            })
        ).toMatchObject({ ok: false, errors: [{ code: 'child-missing' }] });
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: FAIL in `snapshot.test.ts` with `TypeError: machine.snapshot is not a function`.

- [ ] **Step 3: Write `snapshot.ts`**

`packages/being-portable/src/snapshot.ts`:

```ts
import { RestoreMode, RestoreResult } from './api-types';
import type { PortableStateMachine } from './compile/machine';
import { PlainData, PlainObject, copyPlainData, isPlainObject } from './copy';
import { LoadError, loadError } from './errors';
import {
    LevelSnapshot,
    MachineDefinition,
    MachineSnapshot,
    Value,
} from './format/types';
import { checkValue, describeType, freezeValue } from './format/values';
import { SNAPSHOT_FORMAT, migrateSnapshot } from './migrate';
import { entriesOf, hasOwn, joinPath } from './util';
import { fieldType } from './validate/check';

/** Snapshot of the whole tree. Only the root can snapshot, and never mid-event. */
export function captureSnapshot(
    machine: PortableStateMachine
): MachineSnapshot {
    const runtime = machine.runtime;
    if (!runtime.isRoot) {
        throw new Error('snapshot() is only available on the root machine');
    }
    if (runtime.transaction.isActive) {
        throw new Error(
            'reentrant-call: snapshot() was called while the machine was busy; defer it, for example with queueMicrotask'
        );
    }
    return {
        format: SNAPSHOT_FORMAT,
        machine: {
            id: runtime.definition.id,
            revision: runtime.definition.revision,
        },
        ...captureLevel(machine),
    };
}

function captureLevel(machine: PortableStateMachine): LevelSnapshot {
    const state = machine.currentState;
    const context = machine.runtime.store.toRecord();
    const child = machine.childFor(state);
    return child === null
        ? { state, context }
        : { state, context, child: captureLevel(child) };
}

type PlannedLevel = {
    readonly machine: PortableStateMachine;
    readonly state: string;
    readonly values: ReadonlyMap<string, Value>;
};

type Report = { dropped: string[]; defaulted: string[] };

/**
 * Restores a snapshot into the tree. Every check runs before anything
 * changes; a failed restore leaves the machine as it was. Runs no
 * statements, calls no effects and notifies no subscribers.
 */
export function restoreSnapshot(
    machine: PortableStateMachine,
    snapshot: unknown,
    mode: RestoreMode
): RestoreResult {
    const runtime = machine.runtime;
    if (!runtime.isRoot) {
        throw new Error('restore() is only available on the root machine');
    }
    if (runtime.transaction.isActive) {
        return {
            ok: false,
            errors: [
                loadError(
                    'reentrant-call',
                    '',
                    'restore() was called while the machine was busy; defer it, for example with queueMicrotask'
                ),
            ],
        };
    }
    const copied = copyPlainData(snapshot, runtime.host.limits);
    if (!copied.ok) {
        return copied;
    }
    const migrated = migrateSnapshot(copied.value);
    if (!migrated.ok) {
        return migrated;
    }
    const errors: LoadError[] = [];
    checkHeader(migrated.value, runtime.definition, mode, errors);
    if (errors.length > 0) {
        return { ok: false, errors };
    }
    const report: Report = { dropped: [], defaulted: [] };
    const plan: PlannedLevel[] = [];
    planLevel(machine, migrated.value, '', true, mode, plan, report, errors);
    if (errors.length > 0) {
        return { ok: false, errors };
    }
    resetTree(machine);
    for (const level of plan) {
        level.machine.runtime.store.replaceAll(level.values);
        level.machine.rawSetState(level.state);
    }
    return { ok: true, report };
}

function checkHeader(
    document: PlainObject,
    definition: MachineDefinition,
    mode: RestoreMode,
    errors: LoadError[]
): void {
    const header = document.machine;
    if (
        !isPlainObject(header) ||
        Object.keys(header).sort().join(',') !== 'id,revision' ||
        typeof header.id !== 'string' ||
        typeof header.revision !== 'number'
    ) {
        errors.push(
            loadError(
                'invalid-structure',
                'machine',
                'machine must be { "id": string, "revision": number }'
            )
        );
        return;
    }
    if (header.id !== definition.id) {
        errors.push(
            loadError(
                'machine-mismatch',
                'machine.id',
                `the snapshot is of machine "${header.id}", not "${definition.id}"`
            )
        );
        return;
    }
    if (header.revision !== definition.revision && mode === 'strict') {
        errors.push(
            loadError(
                'revision-mismatch',
                'machine.revision',
                `the snapshot is of revision ${header.revision}; the definition is revision ${definition.revision}`
            )
        );
    }
}

function planLevel(
    machine: PortableStateMachine,
    level: PlainData | undefined,
    path: string,
    isRoot: boolean,
    mode: RestoreMode,
    plan: PlannedLevel[],
    report: Report,
    errors: LoadError[]
): void {
    if (!isPlainObject(level)) {
        errors.push(loadError('invalid-structure', path, 'expected an object'));
        return;
    }
    const allowed = isRoot
        ? ['format', 'machine', 'state', 'context', 'child']
        : ['state', 'context', 'child'];
    for (const key of Object.keys(level)) {
        if (!allowed.includes(key)) {
            errors.push(
                loadError(
                    'invalid-structure',
                    joinPath(path, key),
                    `unknown key "${key}"`
                )
            );
        }
    }
    const statePath = joinPath(path, 'state');
    const state = level.state;
    if (typeof state !== 'string') {
        errors.push(
            loadError('invalid-structure', statePath, 'state must be a string')
        );
        return;
    }
    const pseudo = state === 'INITIAL' || state === 'TERMINAL';
    if (pseudo && !isRoot) {
        errors.push(
            loadError(
                'state-missing',
                statePath,
                'a running child machine must be in one of its states'
            )
        );
        return;
    }
    if (!pseudo && !hasOwn(machine.runtime.body.states, state)) {
        errors.push(
            loadError(
                'state-missing',
                statePath,
                `"${state}" is not a state of this machine`
            )
        );
        return;
    }
    const values = planContext(
        machine,
        level.context,
        joinPath(path, 'context'),
        mode,
        report,
        errors
    );
    const child = pseudo ? null : machine.childFor(state);
    const childPath = joinPath(path, 'child');
    if (child !== null) {
        if (hasOwn(level, 'child')) {
            planLevel(
                child,
                level.child,
                childPath,
                false,
                mode,
                plan,
                report,
                errors
            );
        } else {
            errors.push(
                loadError(
                    'child-missing',
                    childPath,
                    `state ${state} runs a child machine, but the snapshot has no child`
                )
            );
        }
    } else if (hasOwn(level, 'child')) {
        if (mode === 'strict') {
            errors.push(
                loadError(
                    'child-unexpected',
                    childPath,
                    `state ${state} has no child machine`
                )
            );
        } else {
            report.dropped.push(childPath);
        }
    }
    if (values !== null) {
        plan.push({ machine, state, values });
    }
}

function planContext(
    machine: PortableStateMachine,
    context: PlainData | undefined,
    path: string,
    mode: RestoreMode,
    report: Report,
    errors: LoadError[]
): Map<string, Value> | null {
    if (!isPlainObject(context)) {
        errors.push(
            loadError('invalid-structure', path, 'context must be an object')
        );
        return null;
    }
    const { body, store, host } = machine.runtime;
    const values = new Map<string, Value>();
    for (const [field] of entriesOf(body.context)) {
        const fieldPath = joinPath(path, field);
        if (!hasOwn(context, field)) {
            if (mode === 'strict') {
                errors.push(
                    loadError(
                        'field-mismatch',
                        fieldPath,
                        `the snapshot has no value for ${field}`
                    )
                );
            } else {
                report.defaulted.push(fieldPath);
                values.set(field, store.initialValue(field));
            }
            continue;
        }
        const type = fieldType(body, field);
        const check = checkValue(context[field], type, host.limits);
        if (check === 'ok') {
            values.set(field, freezeValue(context[field] as Value));
        } else if (check === 'limit') {
            errors.push(
                loadError(
                    'limit-exceeded',
                    fieldPath,
                    `${field} is longer than the limits allow`
                )
            );
        } else if (mode === 'strict') {
            errors.push(
                loadError(
                    'field-mismatch',
                    fieldPath,
                    `${field} must be ${describeType(type)}`
                )
            );
        } else {
            report.dropped.push(fieldPath);
            report.defaulted.push(fieldPath);
            values.set(field, store.initialValue(field));
        }
    }
    for (const key of Object.keys(context)) {
        if (hasOwn(body.context, key)) {
            continue;
        }
        const keyPath = joinPath(path, key);
        if (mode === 'strict') {
            errors.push(
                loadError(
                    'field-mismatch',
                    keyPath,
                    `${key} is not a context field`
                )
            );
        } else {
            report.dropped.push(keyPath);
        }
    }
    return values;
}

/** Every machine back to `INITIAL` with initial values, outside any transaction. */
function resetTree(machine: PortableStateMachine): void {
    const store = machine.runtime.store;
    store.replaceAll(
        new Map(
            store.fieldNames().map(field => [field, store.initialValue(field)])
        )
    );
    machine.rawSetState('INITIAL');
    for (const child of machine.runtime.children.values()) {
        resetTree(child);
    }
}
```

- [ ] **Step 4: Extend `api-types.ts`**

Edit 1 in `packages/being-portable/src/api-types.ts`. Replace:

```ts
import { MachineDefinition, Value } from './format/types';
```

with:

```ts
import { MachineDefinition, MachineSnapshot, Value } from './format/types';
```

Edit 2 in `packages/being-portable/src/api-types.ts`. Replace:

```ts
/**
 * A loaded machine: an ordinary `being` state machine plus its definition.
 *
 * @category Types
 */
```

with:

```ts
/**
 * How {@link PortableMachine.restore} treats a snapshot from another revision.
 *
 * @category Types
 */
export type RestoreMode = 'strict' | 'structural';

/**
 * What a structural restore changed. Paths are JSON paths into the snapshot.
 *
 * @category Types
 */
export type RestoreReport = {
    readonly dropped: readonly string[];
    readonly defaulted: readonly string[];
};

/**
 * @category Types
 */
export type RestoreResult =
    | { readonly ok: true; readonly report: RestoreReport }
    | { readonly ok: false; readonly errors: readonly LoadError[] };

/**
 * A loaded machine: an ordinary `being` state machine plus its definition,
 * snapshot and restore.
 *
 * @category Types
 */
```

Edit 3 in `packages/being-portable/src/api-types.ts`. Replace:

```ts
    readonly context: PortableContext;
}
```

with:

```ts
    readonly context: PortableContext;
    /** Throws while the machine is handling an event. */
    snapshot(): MachineSnapshot;
    restore(
        snapshot: unknown,
        options?: { readonly mode?: RestoreMode }
    ): RestoreResult;
}
```

Edit 4 in `packages/being-portable/src/api-types.ts`. Replace:

```ts
export type LoadOptions = {
    /** Defaults to `true`. */
    readonly autoStart?: boolean;
};
```

with:

```ts
export type LoadOptions = {
    /** Restore this snapshot instead of starting. */
    readonly snapshot?: unknown;
    /** Defaults to `'strict'`. */
    readonly restoreMode?: RestoreMode;
    /** Defaults to `true`. Ignored when `snapshot` is given. */
    readonly autoStart?: boolean;
};
```

Edit 5 in `packages/being-portable/src/api-types.ts`. Replace:

```ts
    | { readonly ok: true; readonly machine: PortableMachine }
```

with:

```ts
    | {
          readonly ok: true;
          readonly machine: PortableMachine;
          /** Present when a snapshot was restored. */
          readonly restoreReport?: RestoreReport;
      }
```

- [ ] **Step 5: Add `snapshot()` and `restore()` to the machine**

Edit 1 in `packages/being-portable/src/compile/machine.ts`. Replace:

```ts
    PortableOutputs,
} from '../api-types';
import { MachineDefinition } from '../format/types';
import { validatePayload } from '../interpret/payload';
import { TxMachine } from '../interpret/tx';
import { hasOwn, joinPath } from '../util';
```

with:

```ts
    PortableOutputs,
    RestoreMode,
    RestoreResult,
} from '../api-types';
import { MachineDefinition, MachineSnapshot } from '../format/types';
import { validatePayload } from '../interpret/payload';
import { TxMachine } from '../interpret/tx';
import { captureSnapshot, restoreSnapshot } from '../snapshot';
import { hasOwn, joinPath } from '../util';
```

Edit 2 in `packages/being-portable/src/compile/machine.ts`. Replace:

```ts
    isInFinalState(): boolean {
```

with:

```ts
    snapshot(): MachineSnapshot {
        return captureSnapshot(this);
    }

    restore(
        snapshot: unknown,
        options: { readonly mode?: RestoreMode } = {}
    ): RestoreResult {
        return restoreSnapshot(this, snapshot, options.mode ?? 'strict');
    }

    isInFinalState(): boolean {
```

- [ ] **Step 6: Let `loadMachine` restore a snapshot**

Edit 1 in `packages/being-portable/src/api.ts`. Replace:

```ts
    const machine = buildMachineTree(validated.definition, host);
    if (options.autoStart ?? true) {
```

with:

```ts
    const machine = buildMachineTree(validated.definition, host);
    if (options.snapshot !== undefined) {
        const restored = machine.restore(options.snapshot, {
            mode: options.restoreMode ?? 'strict',
        });
        return restored.ok
            ? { ok: true, machine, restoreReport: restored.report }
            : { ok: false, errors: restored.errors };
    }
    if (options.autoStart ?? true) {
```

- [ ] **Step 7: Run the tests and the build**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: PASS, 122 tests.

Run: `bunx nx build being-portable --skip-nx-cache`
Expected: `Successfully ran target build for project being-portable`.

- [ ] **Step 8: Commit**

```bash
bunx prettier --write packages/being-portable
git add packages/being-portable
git commit -m "feat(being-portable): snapshot and strict or structural restore"
```

---

### Task 11: Public exports, benchmark, README, docs and repo wiring

**Files:**

- Modify: `packages/being-portable/src/index.ts` (replace the whole file)
- Create: `packages/being-portable/bench/happens.ts`
- Modify: `packages/being-portable/README.md` (replace the whole file)
- Modify: `CLAUDE.md` (project structure)

**Interfaces:**

- Consumes: everything above.
- Produces: the package entry point. The exports are exactly the spec's list: the functions `loadMachine`, `validateDefinition` and `defineHost`, the constant `DEFAULT_LIMITS`, and the types. Nothing internal is exported.

- [ ] **Step 1: Write the entry point**

`packages/being-portable/src/index.ts`:

```ts
/**
 * @packageDocumentation
 * Portable, serializable definitions for `@ue-too/being` state machines.
 *
 * A machine is a JSON document whose behavior is a small, statically checked
 * language. Documents from untrusted authors can be loaded safely, compiled
 * into ordinary being machines, and snapshotted and restored elsewhere.
 */

export { loadMachine, validateDefinition } from './api';
export { defineHost } from './host';
export { DEFAULT_LIMITS } from './limits';

export type {
    LoadOptions,
    LoadResult,
    PortableContext,
    PortableEvents,
    PortableMachine,
    PortableOutputs,
    RestoreMode,
    RestoreReport,
    RestoreResult,
    ValidationResult,
} from './api-types';
export type {
    LoadError,
    LoadErrorCode,
    RuntimeError,
    RuntimeErrorCode,
} from './errors';
export type {
    Branch,
    ChildDefinition,
    ContextFieldDefinition,
    DoneReaction,
    EffectDeclaration,
    Expr,
    GuardRef,
    LevelSnapshot,
    MachineBody,
    MachineDefinition,
    MachineSnapshot,
    Reaction,
    Scalar,
    ScalarValue,
    StateDefinition,
    Stmt,
    TypeSpec,
    Value,
} from './format/types';
export type {
    EffectImplementation,
    Host,
    HostDefinition,
    HostEffect,
    Services,
} from './host';
export type { ValueType } from './format/values';
export type { Limits } from './limits';
```

- [ ] **Step 2: Write the benchmark**

`packages/being-portable/bench/happens.ts`:

```ts
/**
 * Measures `happens()` on a flat and a nested portable machine.
 * Run from the repo root: `bun packages/being-portable/bench/happens.ts`
 */
import { loadMachine } from '../src/api';
import { PortableMachine } from '../src/api-types';
import { defineHost } from '../src/host';
import { gameDoc, vendingDoc } from '../test/fixtures';

const FRAME_MS = 1000 / 60;
const noop = () => {};

const host = defineHost({
    effects: {
        dispense: { args: { item: 'string' }, run: noop },
        refund: { args: { amount: 'number' }, run: noop },
        note: { args: { text: 'string' }, run: noop },
    },
    onError: error => {
        throw new Error(
            `benchmark machine failed: ${error.code} ${error.message}`
        );
    },
});

function load(doc: Record<string, any>): PortableMachine {
    const result = loadMachine(doc, host);
    if (!result.ok) {
        throw new Error(JSON.stringify(result.errors));
    }
    return result.machine;
}

function bench(
    name: string,
    events: [string, unknown?][],
    machine: PortableMachine
) {
    const cycles = 20_000;
    const run = () => {
        for (const [event, payload] of events) {
            machine.happens(event, payload);
        }
    };
    for (let i = 0; i < 1_000; i++) run();
    const start = performance.now();
    for (let i = 0; i < cycles; i++) run();
    const perEvent = (performance.now() - start) / (cycles * events.length);
    console.log(
        `${name}: ${(perEvent * 1000).toFixed(2)} µs per event, ` +
            `${Math.floor(FRAME_MS / perEvent)} events fit in one 60 FPS frame`
    );
}

bench(
    'vending (flat, guards, effects)',
    [['insertCoin', { amount: 2 }], ['insertCoin', { amount: 1 }], ['cancel']],
    load(vendingDoc())
);

const game = gameDoc();
game.states.PLAYING.enter = [];
game.states.PLAYING.exit = [];
bench(
    'game (nested child, with, onDone)',
    [['begin'], ['roll', { value: 3 }]],
    load(game)
);
```

Run: `bun packages/being-portable/bench/happens.ts`
Expected: two lines, each a few microseconds per event or less, with thousands of events fitting in one 60 FPS frame. The prototype measured 0.63 µs (flat) and 1.40 µs (nested). The script throws if a benchmark machine reports an error.

- [ ] **Step 3: Write the README**

`packages/being-portable/README.md`:

````markdown
# @ue-too/being-portable

Portable, serializable definitions for [`@ue-too/being`](https://www.npmjs.com/package/@ue-too/being) state machines. A machine, behavior included, is a plain JSON document. Documents from strangers load safely, compile into ordinary `being` machines, and snapshot and restore on another computer.

[![npm version](https://img.shields.io/npm/v/@ue-too/being-portable.svg)](https://www.npmjs.com/package/@ue-too/being-portable)
[![license](https://img.shields.io/npm/l/@ue-too/being-portable.svg)](https://github.com/kinnet-studio/ue-too/blob/main/LICENSE.txt)

## Install

```bash
bun add @ue-too/being-portable
```

`@ue-too/being` is an ordinary dependency and installs with it.

## Quick start

```ts
import { defineHost, loadMachine } from '@ue-too/being-portable';

// What the machine may do outside itself. The document must declare the
// same effects with the same types, or it will not load.
const host = defineHost({
    effects: {
        dispense: {
            args: { item: 'string' },
            run: ({ item }) => ui.dispense(item as string),
        },
    },
    onError: error => console.warn(error.code, error.path, error.message),
});

const result = loadMachine(JSON.parse(sharedFileText), host);
if (!result.ok) {
    showErrors(result.errors); // every problem, each with a JSON path
} else {
    result.machine.happens('insertCoin', { amount: 1 });
    save(JSON.stringify(result.machine.snapshot()));
}
```

Continue on another computer:

```ts
const resumed = loadMachine(definition, host, { snapshot: JSON.parse(saved) });
```

## The document

```json
{
    "context": { "balance": { "initial": 0, "type": "number" } },
    "effects": { "refund": { "args": { "amount": "number" } } },
    "events": { "cancel": {}, "insertCoin": { "amount": "number" } },
    "format": "being-machine@1",
    "id": "vending",
    "initialState": "IDLE",
    "revision": 1,
    "states": {
        "HAS_MONEY": {
            "on": {
                "cancel": {
                    "do": [
                        {
                            "args": { "amount": { "ctx": "balance" } },
                            "call": "refund"
                        },
                        { "set": "balance", "to": 0 }
                    ],
                    "target": "IDLE"
                }
            }
        },
        "IDLE": {
            "on": {
                "insertCoin": {
                    "do": [
                        {
                            "set": "balance",
                            "to": {
                                "args": [
                                    { "ctx": "balance" },
                                    { "payload": "amount" }
                                ],
                                "op": "+"
                            }
                        }
                    ],
                    "target": "HAS_MONEY"
                }
            }
        }
    }
}
```

A reaction runs in `being`'s order: `require` guards first (a false one means
the event is not handled), then `do`, then `branches` (first true one wins,
and it sees the updated context), then `target`.

**Values:** `number`, `string`, `boolean`, and lists of one of those.

**Expressions:** literals, `{ "ctx": field }`, `{ "payload": field }`,
`{ "list": [...] }`, and `{ "op": name, "args": [...] }` with
`+ - * / % min max abs floor ceil round`, `== != < <= > >=`,
`and or not cond`, `concat toString length`, `at contains indexOf`,
`randomInt now`.

**Statements:** `set`, `push`, `removeAt`, `if`/`then`/`else`, `call` (a host
effect, optionally writing its result `into` a field) and `output` (the value
`happens()` returns).

**Nesting:** a state can host a child machine from the document's `machines`.
`with` passes values in when the child starts; when the child enters a state
marked `final`, the parent's `onDone` runs in the same event and can read the
child's context with `{ "childCtx": field }`.

The full format is in the
[design spec](https://github.com/kinnet-studio/ue-too/blob/main/packages/being/docs/specs/2026-09-29-being-portable-design.md).

## Safety

- No code in documents: no `eval`, no `new Function`. Behavior is data the
  interpreter walks.
- Everything is checked before anything runs: structure, names, references,
  types, and where each construct may appear.
- A document can only reach what it declared: its own context, the event
  payload and the host's declared effects. Names like `__proto__` are
  rejected, and nothing is looked up through a prototype.
- No loops or recursion, so every event finishes. Limits cap document size,
  nesting, list and string lengths, and machine instances; override them with
  `defineHost({ limits })`.
- Each `happens()`, `start()`, `reset()` and `wrapup()` is atomic: if anything
  fails, the whole machine tree rolls back and `onError` gets the error.
  Effects that already ran are listed but not undone.
- An effect or subscriber that calls back into the machine gets a
  `reentrant-call` error; defer such calls with `queueMicrotask`.

## Snapshots

`machine.snapshot()` returns plain JSON: the current state and context of the
machine and of its running child, pinned to the definition's `id` and
`revision`. `restore()` checks a snapshot like any untrusted input and either
applies it completely or changes nothing. It runs no statements and calls no
effects; rebuild your view from `currentState` and `machine.context`.

A snapshot from another revision is rejected unless you pass
`{ mode: 'structural' }` (or `restoreMode: 'structural'` to `loadMachine`),
which keeps the fields that still fit, gives new fields their initial values,
and reports everything it dropped or defaulted.

## Works with being tools

A loaded machine is a `being` `TemplateStateMachine`, so
`extractMachineGraph` and `@ue-too/being-devtools` work on it unchanged.
Inline guards show up under their printed expression, such as
`balance >= payload.price`.

## Performance

In the package benchmark a flat machine handles an event in well under a
microsecond and a nested one in under two, so thousands of events fit in one
60 FPS frame. Run `bun packages/being-portable/bench/happens.ts` to measure
on your machine.

## API Reference

For complete API documentation with detailed type information, see the [TypeDoc-generated documentation](/being-portable/).

## License

MIT

## Repository

[https://github.com/kinnet-studio/ue-too](https://github.com/kinnet-studio/ue-too)
````

- [ ] **Step 4: Add the package to `CLAUDE.md`**

In `CLAUDE.md`, under `Mid-level (depend on foundational):` in the project structure, add after the `border/` line:

```
    being-portable/ — Portable, serializable being machine definitions (JSON; safe to load from strangers)
```

- [ ] **Step 5: Verify everything**

Run: `bunx nx test being-portable --skip-nx-cache`
Expected: PASS, 122 tests.

Run: `bunx nx build being-portable --skip-nx-cache`
Expected: `Successfully ran target build for project being-portable`.

Run: `bunx nx docs:build being-portable --skip-nx-cache`
Expected: `Found 0 errors` for each locale. The only warnings come from comments inherited from `@ue-too/being` (`@remarks` and `@returns` duplicates, and links to `TemplateStateMachine` and `EventResultCallback`). There is no warning about `ValueType`, which `index.ts` exports. The output under `docs/` is git-ignored.

Run: `bunx prettier --check packages/being-portable CLAUDE.md`
Expected: `All matched files use Prettier code style!`

- [ ] **Step 6: Commit**

```bash
git add packages/being-portable CLAUDE.md
git commit -m "feat(being-portable): public exports, benchmark and README"
```

---

## After the plan

- Open the PR from `feat/being-portable`, with the spec and this plan linked.
- **Before the first release that includes this package**, publish it once by hand and add its npm trusted publisher (spec, "Release"). The OIDC release workflow cannot create a new package, and a run that tries fails after the other packages have already published. This is a release step, not part of implementation.
- A follow-up spec moves blast's `StateMachineBuilder` off `new Function` and onto this format.
