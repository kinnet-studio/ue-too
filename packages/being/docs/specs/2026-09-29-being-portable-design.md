# `@ue-too/being-portable` — Design

**Date:** 2026-09-29
**Status:** Draft, awaiting review
**Branch:** `feat/being-portable`

## Overview

A `being` machine cannot leave the program that built it. Its states,
reactions, guards and lifecycle hooks are closures, so there is nothing to
write to a file or send to someone else. The one place in the repo that
already moves machines around, blast's `StateMachineBuilder`
(`apps/blast/src/components/StateMachineBuilder.tsx`), stores every action and
guard as a JavaScript source string and rebuilds it with `new Function`. That
works for your own machines. It is arbitrary code execution for anyone else's.

This design adds a portable machine format: a JSON document that fully
describes a machine, including its behavior, in a small interpreted language
that cannot reach anything the document did not declare. A new package,
`@ue-too/being-portable`, validates such documents, compiles them into
ordinary `being` machines, and snapshots and restores their running state.

```ts
import { defineHost, loadMachine } from '@ue-too/being-portable';

const host = defineHost({
    effects: {
        dispense: {
            args: { item: 'string' },
            run: ({ item }) => ui.dispense(item),
        },
    },
});

const result = loadMachine(JSON.parse(sharedFileText), host);
if (!result.ok) return showErrors(result.errors);

result.machine.happens('insertCoin', { amount: 1 });
const save = JSON.stringify(result.machine.snapshot());
```

The two scenarios it serves:

- **User-authored sharing.** Someone builds a machine in a UI such as blast,
  saves it, and strangers load and run it. Loading a stranger's machine must
  never run the stranger's code.
- **Save files.** A machine's definition and its running state are stored with
  a project or save file and loaded later, possibly by a newer version of the
  app.

## Goals

- A machine definition, including all of its behavior, is a plain JSON
  document with no code in it.
- Loading a document from an untrusted author is safe: it cannot execute
  arbitrary code, reach undeclared data or host capabilities, touch object
  prototypes, run forever inside one event, or exhaust memory past configured
  limits.
- Every problem in a document is reported at load time, all at once, each with
  a JSON path and a stable error code.
- A loaded machine is an ordinary `being` `TemplateStateMachine`:
  `happens`, `onStateChange`, `onHappens`, `onEventResult`,
  `extractMachineGraph`, and `@ue-too/being-devtools` work with no changes.
- A running machine's state can be snapshotted to JSON and restored on another
  machine, including nested children.
- Old documents keep loading after the format evolves.
- No change to `@ue-too/being`.

## Non-goals (v1)

- A text syntax for expressions (`balance >= price`). The stored format is the
  JSON tree; editors build it or compile to it.
- Record/object types and null.
- A machine sending events to itself.
- Author-written migrations between revisions of the same machine.
- Static TypeScript types for a loaded machine (a typed overload for
  definitions written `as const` in code).
- A published JSON Schema file for editors.
- Moving blast's builder off `new Function`. That gets its own spec once this
  package exists.
- Timers and delays. `being` declares `delay` but never schedules it, so there
  is nothing to carry over.

## The definition document

### Top level

```jsonc
{
    "format": "being-machine@1", // language version, owned by this package
    "id": "vending", // name of this machine
    "revision": 1, // author's version of this machine; snapshots pin it
    "context": { ... }, // data the machine owns
    "events": { ... }, // event names and payload shapes
    "outputs": { ... }, // optional: output type per event
    "effects": { ... }, // optional: host capabilities the document needs
    "machines": { ... }, // optional: child machine definitions, by key
    "initialState": "IDLE",
    "states": { ... },
}
```

`format`, `id`, `revision`, `effects` and `machines` appear only at the top
level. A child definition inside `machines` has `context`, `events`,
`outputs`, `initialState` and `states`, and shares the top level's `effects`
and `machines`.

### Names

Every name the author chooses (machine id, machine keys, state names, event
names, context fields, payload fields, effect names, effect argument names,
guard names) must match `^[A-Za-z_][A-Za-z0-9_]*$`. The names `__proto__`,
`constructor` and `prototype` are rejected everywhere. `INITIAL` and
`TERMINAL` are rejected as state names because `being` uses them for its
pseudo-states.

### Types

```
Scalar   = "number" | "string" | "boolean"
TypeSpec = Scalar | { "type": Scalar } | { "type": "list", "of": Scalar }
```

A list holds one scalar type. There are no records and no null. A bare scalar
string and `{ "type": scalar }` mean the same thing.

### Context, events, outputs, effects

```jsonc
"context": {
    "balance": { "type": "number", "initial": 0 },
    "sold":    { "type": "list", "of": "string", "initial": [] }
},
"events": {
    "insertCoin": { "amount": "number" },    // payload field → TypeSpec
    "select":     { "item": "string", "price": "number" },
    "cancel":     {}                         // no payload
},
"outputs": {
    "select": "number"                       // event → TypeSpec
},
"effects": {
    "dispense": { "args": { "item": "string" } },
    "drawCard": { "args": {}, "returns": "string" }
}
```

- Every context field has a type and an `initial` value of that type.
- Every payload field is required, and a payload may not carry undeclared
  fields.
- `effects` declares the host capabilities the document calls, with exact
  argument and return types. The host must supply each one with a matching
  signature.

### States and reactions

```jsonc
"states": {
    "HAS_MONEY": {
        "guards": { "canAfford": <Expr> },    // named boolean expressions
        "enter":  [ <Stmt>, ... ],
        "exit":   [ <Stmt>, ... ],
        "on": {
            "select": {
                "require":  [ <GuardRef>, ... ],
                "do":       [ <Stmt>, ... ],
                "branches": [ { "if": <GuardRef>, "target": "IDLE" }, ... ],
                "target":   "HAS_MONEY"
            }
        },
        "child":  { "machine": "turn", "with": { "field": <Expr> } },
        "onDone": { "do": [ ... ], "branches": [ ... ], "target": "..." },
        "final":  true
    }
}
```

A `GuardRef` is either the name of an entry in this state's `guards`, or an
inline boolean expression.

Each part compiles to what `being` already has, and runs in `being`'s order:

| Document             | `being`                    | When it runs                                                                                                      |
| -------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `on[event].require`  | `eventPreconditions`       | Before anything else, including the child. A false guard means the event is not handled.                          |
| `child`              | `DelegatingState` child    | After `require`. If the child handles the event, the parent's `on` does not run.                                  |
| `on[event].do`       | the reaction's `action`    | After the child declined the event.                                                                               |
| `on[event].branches` | `eventGuards`              | After `do`, so guards see the updated context. First true branch wins.                                            |
| `on[event].target`   | `defaultTargetState`       | When no branch matched. Omitted means stay.                                                                       |
| `enter` / `exit`     | `uponEnter` / `beforeExit` | On a transition to a different state. A target equal to the current state runs neither (`being`'s existing rule). |

`final`, `child`, `with` and `onDone` are covered under
[Nested machines](#nested-machines).

### Complete example

```json
{
    "context": {
        "balance": { "initial": 0, "type": "number" },
        "sold": { "initial": [], "of": "string", "type": "list" }
    },
    "effects": {
        "dispense": { "args": { "item": "string" } },
        "refund": { "args": { "amount": "number" } }
    },
    "events": {
        "cancel": {},
        "insertCoin": { "amount": "number" },
        "select": { "item": "string", "price": "number" }
    },
    "format": "being-machine@1",
    "id": "vending",
    "initialState": "IDLE",
    "outputs": { "select": "number" },
    "revision": 1,
    "states": {
        "HAS_MONEY": {
            "guards": {
                "canAfford": {
                    "args": [{ "ctx": "balance" }, { "payload": "price" }],
                    "op": ">="
                }
            },
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
                },
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
                    ]
                },
                "select": {
                    "branches": [
                        {
                            "if": {
                                "args": [{ "ctx": "balance" }, 0],
                                "op": ">"
                            },
                            "target": "HAS_MONEY"
                        }
                    ],
                    "do": [
                        {
                            "args": { "item": { "payload": "item" } },
                            "call": "dispense"
                        },
                        {
                            "set": "balance",
                            "to": {
                                "args": [
                                    { "ctx": "balance" },
                                    { "payload": "price" }
                                ],
                                "op": "-"
                            }
                        },
                        { "push": "sold", "value": { "payload": "item" } },
                        { "output": { "ctx": "balance" } }
                    ],
                    "require": ["canAfford"],
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

## The language

### Expressions

Every expression has a static type, checked at load.

| Form                                    | Type                         | Notes                                       |
| --------------------------------------- | ---------------------------- | ------------------------------------------- |
| `3`, `"red"`, `true`                    | the literal's scalar type    | Bare JSON scalars are literals.             |
| `{ "list": [<Expr>, ...] }`             | `list` of the elements' type | Elements must share one scalar type.        |
| `{ "list": [], "of": Scalar }`          | `list` of `Scalar`           | `of` is required when the list is empty.    |
| `{ "ctx": field }`                      | the field's type             | This machine's context.                     |
| `{ "payload": field }`                  | the payload field's type     | Only where an event exists (see placement). |
| `{ "childCtx": field }`                 | the child field's type       | Only in `onDone`.                           |
| `{ "op": name, "args": [<Expr>, ...] }` | from the operator table      |                                             |

Operators:

| Operator                     | Arguments                 | Result    | Notes                                                                                |
| ---------------------------- | ------------------------- | --------- | ------------------------------------------------------------------------------------ |
| `+` `*`                      | 2 or more `number`        | `number`  |                                                                                      |
| `-` `/` `%`                  | 2 `number`                | `number`  |                                                                                      |
| `min` `max`                  | 2 or more `number`        | `number`  |                                                                                      |
| `abs` `floor` `ceil` `round` | 1 `number`                | `number`  | `round` is `Math.round`.                                                             |
| `==` `!=`                    | 2 of the same scalar type | `boolean` | Strict equality. Lists cannot be compared.                                           |
| `<` `<=` `>` `>=`            | 2 `number`                | `boolean` |                                                                                      |
| `and` `or`                   | 2 or more `boolean`       | `boolean` | Short-circuit.                                                                       |
| `not`                        | 1 `boolean`               | `boolean` |                                                                                      |
| `cond`                       | `boolean`, T, T           | T         | Evaluates only the chosen branch.                                                    |
| `concat`                     | 2 or more `string`        | `string`  |                                                                                      |
| `toString`                   | 1 `number` or `boolean`   | `string`  |                                                                                      |
| `length`                     | 1 `string` or `list`      | `number`  |                                                                                      |
| `at`                         | `list` of T, `number`     | T         | Index must be an integer in range.                                                   |
| `contains`                   | `list` of T, T            | `boolean` |                                                                                      |
| `indexOf`                    | `list` of T, T            | `number`  | `-1` when absent.                                                                    |
| `randomInt`                  | 2 `number` (min, max)     | `number`  | Integer in `[min, max]`; both integers, min ≤ max. Uses the host's `random` service. |
| `now`                        | none                      | `number`  | The host's `now` service.                                                            |

Any `number` an operator produces must be finite. `NaN` and `±Infinity` are
runtime errors, because JSON cannot store them and they would corrupt a
snapshot. `toString` uses JavaScript's `String()`. A `random` service value
outside `[0, 1)` or a non-finite `now` value is `service-invalid`.

### Statements

Statement lists run in order.

| Statement                                                     | Rule                                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `{ "set": field, "to": <Expr> }`                              | Expression type equals the field type.                                                                                               |
| `{ "push": field, "value": <Expr> }`                          | Field is a list; value is its element type.                                                                                          |
| `{ "removeAt": field, "index": <Expr> }`                      | Field is a list; index is an integer in range at runtime.                                                                            |
| `{ "if": <Expr>, "then": [<Stmt>...], "else": [<Stmt>...] }`  | Condition is `boolean`; `else` is optional.                                                                                          |
| `{ "call": effect, "args": { name: <Expr> }, "into": field }` | Args match the declared effect exactly. `into` is allowed only when the effect declares `returns`, and the field type must equal it. |
| `{ "output": <Expr> }`                                        | Only in `on[event].do` for an event with a declared output; type must match. The last `output` executed wins.                        |

There are no loops, no user-defined functions, no recursion, no dynamic field
names and no way to raise an event. Every statement list therefore finishes
in a number of steps bounded by the document's size.

### Placement

The checker rejects a construct used where it has no meaning:

| Construct  | `require` | `do` | `branches` | state `guards` | `enter`/`exit` | `onDone.do` | `onDone.branches` | `with` |
| ---------- | --------- | ---- | ---------- | -------------- | -------------- | ----------- | ----------------- | ------ |
| `payload`  | yes       | yes  | yes        | per use        | no             | no          | no                | no     |
| `childCtx` | no        | no   | no         | per use        | no             | yes         | yes               | no     |
| `output`   | —         | yes  | —          | —              | no             | no          | —                 | —      |
| statements | —         | yes  | —          | —              | yes            | yes         | —                 | —      |

A named guard in a state's `guards` is checked at every place it is used. A
guard that reads `payload.price` is valid when used by `select` and a
`misplaced` or `unknown-field` error when used by `cancel` or in `onDone`.

## Nested machines

```jsonc
"machines": {
    "turn": {
        "context": { "points": { "type": "number", "initial": 0 },
                     "playerCount": { "type": "number", "initial": 0 } },
        "events":  { "roll": { "value": "number" }, "quit": {} },
        "initialState": "ROLLING",
        "states": {
            "ROLLING": { "on": { "roll": { "do": [ ... ], "target": "DONE" } } },
            "DONE":    { "final": true }
        }
    }
},
"states": {
    "PLAYING": {
        "child":  { "machine": "turn", "with": { "playerCount": { "ctx": "players" } } },
        "onDone": { "do": [ { "set": "score", "to": { "op": "+", "args": [ { "ctx": "score" }, { "childCtx": "points" } ] } } ],
                    "target": "NEXT_PLAYER" },
        "on":     { "quit": { "target": "MENU" } }
    }
}
```

- **References are local.** `child.machine` names a key in the top-level
  `machines`. The loader never fetches anything, so a document is
  self-contained. Several states may use the same key; each gets its own
  instance.
- **No cycles.** A child that contains, directly or indirectly, a machine that
  contains it is a `machine-cycle` error. Children are built when the document
  loads, so a cycle would never finish building. Nesting depth is capped by
  `maxNestingDepth`.
- **Events.** The parent forwards events to the child unchanged, so every
  event a child declares must exist on its parent with the same payload type,
  and every output a child declares must exist on its parent with the same
  type.
- **Runtime behavior is `DelegatingState`'s.** The child is offered each event
  first; if it handles the event, the parent stays and the child's output is
  returned. Otherwise the parent's `on` gets it. Entering the parent state
  starts the child fresh; leaving wraps it up.
- **Order.** On entry the parent's `enter` runs, then `with` is evaluated in
  the parent's context and written over the child's initial values, then the
  child's initial state's `enter` runs, so the child sees the `with` values.
  On exit the child wraps up (its active state's `exit` runs) before the
  parent's `exit`.
- **`final` and `onDone`.** A state marked `final: true` may not have `on` or
  `child`. When a child transitions into a final state while handling an
  event, the parent's `onDone` runs within the same `happens()` call. Inside
  `onDone`, `childCtx` reads the finished child's context. If `onDone` names a
  target, the parent transitions and the child wraps up. If not, the parent
  stays and the child rests in its final state, where it handles nothing.
- **`onDone` rules.** `onDone` is allowed only on a state with `child`
  (`on-done-without-child`), and only when the child has at least one final
  state (`on-done-unreachable`). A child's `initialState` may not be final
  (`final-initial-state`).
- **Isolation.** Outside `with` and `onDone` the contexts are separate. The
  parent cannot read a running child, and a child cannot read its parent.

`final` and `onDone` exist only in this package. `being` core does not gain
them.

## Safety

### Loading untrusted input

`loadMachine` and `validateDefinition` take `unknown`. Before validation, the
input is copied into fresh, frozen, null-prototype plain data. The copy step
rejects anything that is not JSON-shaped data: functions, symbols, class
instances, getters, cycles, and non-finite numbers. It counts nodes as it goes
and stops at `maxNodes`, and it stops at a fixed nesting depth of 256 so the
walk can never exhaust the call stack. From then on the package only reads its
own copy, so nothing the caller does to the original afterward matters.
Callers that read text should also cap the text length before `JSON.parse`.

Validation then runs four passes:

1. **Structure:** the document has the shape of a definition.
2. **References:** every named state, event, field, effect, guard and machine
   exists; no machine cycles.
3. **Types:** every expression and statement type-checks.
4. **Placement:** every construct is used where it is allowed.

If pass 1 finds errors, validation stops and reports all of them, because the
later passes need a well-shaped document to walk. Otherwise passes 2–4 run and
report every error they find. Passes 3 and 4 run as one walk: placement is a
property of the environment the type checker already carries. A named guard is
checked at every place it is used; a named guard that nothing uses is checked
for structure only.

A load either returns a machine or returns errors. It never returns a
partially built machine.

### Limits

The host can override these defaults:

| Limit                 | Default | Checked                                                                             |
| --------------------- | ------- | ----------------------------------------------------------------------------------- |
| `maxNodes`            | 50,000  | Load: total JSON nodes in the document or snapshot.                                 |
| `maxMachines`         | 64      | Load: machines in `machines` plus the root.                                         |
| `maxStates`           | 256     | Load: states per machine.                                                           |
| `maxStatements`       | 256     | Load: statements per list.                                                          |
| `maxStatementDepth`   | 16      | Load: nested `if` depth.                                                            |
| `maxExpressionDepth`  | 32      | Load: expression nesting depth.                                                     |
| `maxNestingDepth`     | 8       | Load: child-machine nesting depth.                                                  |
| `maxMachineInstances` | 256     | Load: machine instances the tree builds (each state with a `child` builds one).     |
| `maxListLength`       | 10,000  | Load and runtime: initial values, payloads, every write, effect returns, snapshots. |
| `maxStringLength`     | 10,000  | Load and runtime: same places as lists.                                             |

### Prototype safety

Names are restricted as above. Context lives in a null-prototype store. The
interpreter never indexes an ordinary object with an author-supplied key.

### Runtime checks

- Payloads are validated against the declared event on every `happens()`,
  and copied, so the host cannot mutate a list after sending it. An event the
  root does not declare is simply not handled, like `being`.
- Effect arguments are passed to `run` as frozen copies. Effect return values
  are validated against `returns` and copied before they are written.
- Numbers must stay finite. Indexes and `randomInt` bounds must be integers,
  and `randomInt`'s min may not exceed its max (`invalid-range`).
- List and string limits apply to every write. `concat` also checks its
  result against `maxStringLength`, so nested `concat`s cannot build a huge
  string inside one expression.

### Atomic events

Each top-level `happens()` is a transaction over the whole machine tree: every
machine's current state and every context. If the event fails anywhere (a
precondition, the child, `do`, a branch guard, `exit`, `enter`, `onDone`, or an
effect that throws or returns the wrong type), the tree rolls back to where it
was before the event. `happens()` then returns `{ handled: false }` and the
host's `onError` receives the error.

Effects already called are not rolled back, since they have left the machine.
The error lists them in `effectsCalled`.

Rollback is copy-on-write: a field's previous value is saved on its first
write in the event, and a list is copied only when the event changes it.

If a `being` subscriber (`onStateChange`, `onHappens`, `onEventResult`) throws
during the event, the tree also rolls back, and the exception is rethrown
because it is a host bug, not a machine error.

`start()`, `reset()` and `wrapup()` run `enter` and `exit` statements too, so
each is a transaction under the same rules. A failed `start()` leaves the
machine in `INITIAL`; with `autoStart`, `loadMachine` still returns the
machine, and the error goes to `onError`. A failed `reset()` or `wrapup()`
leaves the machine where it was before the call.

### Re-entry

While a transaction is running (`happens()`, `start()`, `reset()`,
`wrapup()`), calling `happens()` on any machine in the tree from anywhere
other than the parent's own delegation (an effect, a subscriber) returns
`{ handled: false }` and reports `reentrant-call` to `onError`; the outer
transaction continues. `start()`, `reset()`, `wrapup()` and `snapshot()`
throw, and `restore()` returns a `reentrant-call` error. Hosts that need to
raise an event from an effect defer it, for example with `queueMicrotask`.

## Host and loading API

### Public API

```ts
export function defineHost(host: HostDefinition): Host;

export function validateDefinition(
    doc: unknown,
    options?: { limits?: Partial<Limits>; host?: Host }
): ValidationResult;

export function loadMachine(
    doc: unknown,
    host: Host,
    options?: {
        snapshot?: unknown;
        restoreMode?: 'strict' | 'structural'; // default 'strict'
        autoStart?: boolean; // default true, like TemplateStateMachine
    }
): LoadResult;

export type HostDefinition = {
    effects?: Record<
        string,
        {
            args: Record<string, TypeSpec>;
            returns?: TypeSpec;
            run: (args: Readonly<Record<string, Value>>) => Value | void;
        }
    >;
    services?: {
        random?: () => number; // [0, 1); default Math.random
        now?: () => number; // default Date.now
    };
    limits?: Partial<Limits>;
    onError?: (error: RuntimeError) => void; // default console.error
};

export type ValidationResult =
    | { ok: true; definition: MachineDefinition }
    | { ok: false; errors: LoadError[] };

export type LoadResult =
    | { ok: true; machine: PortableMachine; restoreReport?: RestoreReport }
    | { ok: false; errors: LoadError[] };

// Events are only known at runtime: happens() takes any event name and an
// optional payload, and outputs are `unknown` statically.
export type PortableEvents = Record<never, never>;
export type PortableOutputs = Record<never, never>;

export interface PortableMachine extends StateMachine<
    PortableEvents,
    PortableContext,
    string,
    PortableOutputs
> {
    /** The normalized document, upgraded to the current format, frozen. */
    readonly definition: MachineDefinition;
    readonly context: PortableContext;
    snapshot(): MachineSnapshot;
    restore(
        snapshot: unknown,
        options?: { mode?: 'strict' | 'structural' }
    ): RestoreResult;
}

export interface PortableContext extends BaseContext {
    get(field: string): Value; // a frozen copy
    fields(): Readonly<Record<string, Value>>; // frozen copies of all fields
}

export type Value =
    | number
    | string
    | boolean
    | readonly (number | string | boolean)[];
```

Exported from the entry point: `defineHost`, `validateDefinition`,
`loadMachine`, `DEFAULT_LIMITS`; the result and option types
(`ValidationResult`, `LoadOptions`, `LoadResult`, `RestoreMode`,
`RestoreReport`, `RestoreResult`); the machine types (`PortableMachine`,
`PortableContext`, `PortableEvents`, `PortableOutputs`); the host types
(`HostDefinition`, `Host`, `EffectImplementation`, `HostEffect`, `Services`,
`ValueType`, `Limits`); the error types (`LoadError`, `LoadErrorCode`, `RuntimeError`,
`RuntimeErrorCode`); and the document types (`MachineDefinition`,
`MachineBody`, `StateDefinition`, `Reaction`, `DoneReaction`, `Branch`,
`ChildDefinition`, `ContextFieldDefinition`, `EffectDeclaration`, `Expr`,
`GuardRef`, `Stmt`, `TypeSpec`, `Scalar`, `ScalarValue`, `Value`,
`MachineSnapshot`, `LevelSnapshot`). Nothing else; the checker, interpreter,
compiler and migrations stay internal.

### Behavior

- `validateDefinition` needs no host. With a host it also checks effects.
  Limits come from the `limits` option if given, else from the host, else the
  defaults.
- `loadMachine` checks that the host supplies every effect the document
  declares with an exactly matching signature (`missing-effect`,
  `effect-signature-mismatch`). Host effects the document does not use are
  ignored.
- The host reads context through `machine.context` and can never write it.
  `setContext()` throws. Calling the inherited `switchTo()` directly is
  unsupported.
- `context.setup()` resets every field to its initial value, so `reset()`
  gives a fresh machine. `context.cleanup()` does nothing.
- `machine.definition` is the upgraded, normalized document, so loading an
  old file and passing `machine.definition` on passes the current format.

### Introspection

Compiled states populate `eventReactions`, `eventGuards` and
`eventPreconditions`, so `extractMachineGraph` and `@ue-too/being-devtools`
see the machine. A named guard keeps its name. An inline guard is named with
its pretty-printed expression (`balance >= price`), truncated to 60
characters and suffixed on collision. `onDone` is registered under the
reaction key `$done`, which no document event can use (it fails the name
rule) and which the root never forwards (it is not a declared event), so it
shows as a `$done` edge without being reachable from `happens()`.

Tools like being-devtools call guards directly with only the context, outside
any event, to dim unavailable transitions. A compiled guard that reads only
`ctx` works there. One that reads `payload` or `childCtx` throws when called
outside an event, which devtools already treats as "keep the edge enabled".

## Snapshots and versioning

### Snapshot document

```jsonc
{
    "format": "being-snapshot@1",
    "machine": { "id": "vending", "revision": 1 },
    "state": "HAS_MONEY", // may also be "INITIAL" or "TERMINAL"
    "context": { "balance": 2, "sold": ["cola"] },
    "child": {
        // present only when `state` has a running child
        "state": "ROLLING",
        "context": { ... },
        "child": { ... },
    },
}
```

Only one state is active at each level, so at most one child is running and
`child` is singular. Children of inactive states restart fresh on entry, so
they are not saved.

### Restore

- `loadMachine(def, host, { snapshot })` or `machine.restore(snapshot)`.
- Snapshots are untrusted and go through the same copy step, limits and
  checks as definitions: the states exist, the context values have the
  declared types and fit the limits, and a `child` is present exactly when the
  state has a running child.
- A restore succeeds completely or changes nothing and returns errors.
- A restore runs no statements and calls no effects. It does not call
  `setup()`, does not notify `onStateChange` subscribers, and does not run
  `enter`. The host rebuilds its own view from `currentState` and
  `machine.context`.
- Host-side state, including a seeded RNG's position, is the host's to save.
  A full save file is host state plus the machine snapshot, plus either the
  definition itself or its `{ id, revision }`.

### Two version axes

1. **`format`** is the language version, owned by this package. The package
   ships migrations (`@1 → @2 → …`) and upgrades older definitions and
   snapshots on load. A newer `format` than the package understands is an
   `unsupported-format` error. v1 ships `being-machine@1` and
   `being-snapshot@1` with no migrations.
2. **`revision`** is the author's version of a machine. A snapshot pins
   `{ id, revision }`. A different `id` is always `machine-mismatch`. A
   different `revision` is `revision-mismatch` in strict mode. In structural
   mode:
    - the state must still exist (`state-missing` otherwise), at every level
    - a field that still exists with the same type keeps its value
    - a new field gets its initial value (reported as defaulted)
    - a removed or retyped field is dropped (reported as dropped)
    - a snapshot `child` for a state that no longer has a child is dropped
    - a state that now has a child but no snapshot `child` is `child-missing`,
      because starting the child would run its `enter`

    The `RestoreReport` lists every dropped and defaulted path.

## Errors

Every `LoadError` and `RuntimeError` has `code`, `message`, and `path` (a JSON
path into the definition or snapshot, e.g.
`states.HAS_MONEY.on.select.do[1].to.args[0]`). A `RuntimeError` also has
`event` and `effectsCalled`.

| Phase   | Codes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copy    | `not-plain-data`, `limit-exceeded`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Format  | `unsupported-format`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Load    | `invalid-structure`, `invalid-name`, `reserved-name`, `unknown-state`, `unknown-event`, `unknown-field`, `unknown-effect`, `unknown-guard`, `unknown-machine`, `unknown-operator`, `machine-cycle`, `type-mismatch`, `arity-mismatch`, `misplaced`, `empty-list-needs-type`, `output-not-declared`, `into-without-returns`, `child-event-mismatch`, `on-done-without-child`, `on-done-unreachable`, `final-initial-state`, `final-state-has-reactions`, `missing-effect`, `effect-signature-mismatch`, `limit-exceeded` |
| Runtime | `payload-mismatch`, `index-out-of-range`, `not-an-integer`, `invalid-range`, `non-finite-number`, `limit-exceeded`, `effect-failed`, `effect-return-mismatch`, `service-invalid`, `reentrant-call`                                                                                                                                                                                                                                                                                                                      |
| Restore | `unsupported-format`, `machine-mismatch`, `revision-mismatch`, `state-missing`, `field-mismatch`, `child-missing`, `child-unexpected`, `limit-exceeded`, `reentrant-call`                                                                                                                                                                                                                                                                                                                                               |

## Architecture

### Package

`packages/being-portable`, published as `@ue-too/being-portable`, in the
mid-level layer. Created with `bun run scaffold:package being-portable`.

- `dependencies`: `@ue-too/being` as `workspace:*`. No external dependencies.
- Build externalizes `@ue-too/being`.
- `docs:build` uses `docs-build-i18n.ts` like every other package.
- `CLAUDE.md` project structure gains a `being-portable/` line.

### Source modules

```
packages/being-portable/src/
  index.ts          public exports
  api.ts            validateDefinition, loadMachine
  api-types.ts      PortableMachine, PortableContext, results and options
  host.ts           defineHost, effect signature matching, services
  limits.ts         Limits and their defaults
  errors.ts         LoadError, RuntimeError, PortableRuntimeFailure
  util.ts           hasOwn, entriesOf, joinPath
  copy.ts           unknown → frozen null-prototype plain data; node counting
  migrate.ts        format upgrades (none yet for @1)
  snapshot.ts       snapshot, strict and structural restore
  format/
    types.ts        the document and snapshot types
    values.ts       ValueType, parseTypeSpec, checkValue
  validate/
    index.ts        checkDefinition: migrate, then passes 1–4
    names.ts        name rules
    structure.ts    pass 1
    references.ts   pass 2, including machine cycles, nesting and instances
    check.ts        passes 3 and 4 in one walk
    operators.ts    operator arity and typing table
  interpret/
    store.ts        context store with copy-on-write rollback
    expr.ts         expression evaluator
    stmt.ts         statement runner
    payload.ts      payload validation
    tx.ts           tree-wide transaction, re-entry guard, effect calls, frames
  compile/
    runtime.ts      MachineRuntime and interpreter environments
    context.ts      PortableContextImpl
    names.ts        guard labels for introspection
    parts.ts        guards, on and onDone → being's reaction and guard maps
    state.ts        PortableState extends TemplateState
    delegating.ts   PortableDelegatingState extends DelegatingState (with/onDone)
    machine.ts      PortableStateMachine extends TemplateStateMachine
    build.ts        builds the machine tree
```

`format/`, `validate/`, `interpret/`, `copy.ts` and `migrate.ts` know
nothing about `being`. Only `compile/`, `api-types.ts` and `snapshot.ts`
touch `being`.

The compiled `being` classes are parameterized on the public
`PortableContext` interface, not on the implementation class: `being`'s
guard type is a function property, so it is contravariant in the context
type, and a machine typed on the implementation would not satisfy
`PortableMachine`.

### How compiled pieces reach the payload

`being` passes guards only the context, but portable guards may read the
payload or a finished child's context. `PortableState` overrides `handles` to
place the current payload in the active transaction's frame before calling
`super.handles`, and `PortableDelegatingState` places the finished child's
context there before running `onDone`. Compiled guard closures read from the
frame. The frame is internal and never visible to hosts.

## Testing

Run with `bunx nx test being-portable`.

- **Operators and statements:** every operator's results, types and runtime
  errors; every statement's effect and errors.
- **Placement:** every row of the placement table, allowed and rejected.
- **Validator corpus:** a set of invalid documents, each asserting the exact
  error `code` and `path`, and one document with several errors asserting all
  are reported.
- **Adversarial:**
    - `__proto__`, `constructor`, `prototype`, `INITIAL` and `TERMINAL` as
      names in every name position
    - input with getters, class instances, functions and cycles
    - expressions and `if` nesting past the depth limits; documents past
      `maxNodes`
    - pushes and payloads past the list and string caps
    - `NaN` and `Infinity` from division and modulo by zero
    - an effect that throws mid-event: the whole tree rolls back, including a
      child that transitioned and a parent that ran `exit`
    - an effect that calls `happens()`: `reentrant-call`, outer event continues
    - a subscriber that throws: rollback, then rethrow
- **Round trip:** load, run a seeded event sequence, snapshot, `JSON.stringify`,
  `JSON.parse`, restore into a fresh load, continue the sequence; states,
  context and outputs match an uninterrupted run. Includes a nested child mid-run.
- **Structural restore:** added, removed and retyped fields; removed state;
  removed and added child.
- **Parity:** `vending-machine-example.ts` rewritten as a portable document
  produces the same states and outputs as the hand-written machine for the
  same event sequence.
- **Integration:** `extractMachineGraph` on a loaded machine lists the
  expected edges, including named and inline guards. Tools that call guards
  directly with only the context, as `@ue-too/being-devtools` does, get a
  working answer from a guard that reads only `ctx` and an exception from
  one that reads `payload`. `PortableMachine` extends `being`'s
  `StateMachine`, which is what devtools' structural `MachineLike` accepts;
  the package takes no test-time dependency on devtools.
- **Benchmark:** `happens()` on the vending document and on a nested document,
  against the 16.67 ms frame budget.

## Release

This is a new package. The release workflow publishes with npm OIDC trusted
publishing, which cannot publish a package that does not exist yet. Before
the first release that includes it:

1. Build it, run `bunx nx run being-portable:move-package` and
   `bun run replace-workspace-deps`, then `npm publish --access public` from
   `packages/being-portable/dist`.
2. Add the GitHub Actions trusted publisher for `@ue-too/being-portable` on
   npmjs.com (repo `kinnet-studio/ue-too`, workflow `release.yml`).

Skipping this makes the release run fail after the other packages have
already published.

## Build order

The implementation plan
([2026-09-29-being-portable.md](../plans/2026-09-29-being-portable.md))
follows this order; every step leaves the package compiling and its tests
green.

1. Scaffold the package; format types, value checks, limits and errors.
2. The copy step and format migrations.
3. Validator pass 1 (structure) and the name rules.
4. Validator passes 2–4.
5. `defineHost`, effect signature checks and `validateDefinition`.
6. Interpreter: context store, expressions, statements, payloads.
7. The transaction: rollback, re-entry, effect calls, event frames.
8. Compile flat machines and `loadMachine`; parity with the vending example;
   introspection names.
9. Nested machines: `with`, `final`, `onDone`.
10. Snapshot, strict and structural restore.
11. Public exports, benchmark, README, TypeDoc (`@category` tags, as in
    `being`), `CLAUDE.md` structure line.
