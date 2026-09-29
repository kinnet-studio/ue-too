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
    showErrors(result.errors); // every problem (up to 1,000), with JSON paths
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
- Each `happens()`, `start()`, `reset()` and `wrapup()` is also capped by
  `maxEventWork` (1,000,000 work units by default: one per expression and
  statement, plus the length of any list or string it copies or scans).
  Checking a document has a work budget too, in which a named guard counts at
  every place it is used.
- Each `happens()`, `start()`, `reset()` and `wrapup()` is atomic: if anything
  fails, the whole machine tree rolls back and `onError` gets the error.
  Effects that already ran are listed but not undone.
- `onEventResult` and `onStateChange` subscribers are notified while the event
  is still running, so they can see a result or a state change for an event
  that then fails and rolls back. What `happens()` returns and what `onError`
  receives are final.
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

In the package benchmark, typical machines handle an event in about a
microsecond (a flat one in under one, a nested one in under two), so
thousands of events fit in one 60 FPS frame. Run
`bun packages/being-portable/bench/happens.ts` to measure on your machine.
That measures ordinary documents; a hostile document is held in check by the
limits, not by speed, and `maxEventWork` caps what any one event can cost.

## API Reference

For complete API documentation with detailed type information, see the [TypeDoc-generated documentation](/being-portable/).

## License

MIT

## Repository

[https://github.com/kinnet-studio/ue-too](https://github.com/kinnet-studio/ue-too)
