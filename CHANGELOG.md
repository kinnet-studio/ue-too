## 0.18.2 (2026-09-09)

### 🩹 Fixes

- **board-pixi-integration:** cherry-pick #441 + #442 onto the 0.18 line (→ 0.18.2) ([#443](https://github.com/kinnet-studio/ue-too/pull/443), [#441](https://github.com/kinnet-studio/ue-too/issues/441), [#442](https://github.com/kinnet-studio/ue-too/issues/442))

### ❤️ Thank You

- Claude Fable 5.1
- vee @niuee

## 0.18.1 (2026-09-08)

### 🚀 Features

- **being-devtools:** attachable debugger panel for being machines ([#439](https://github.com/kinnet-studio/ue-too/pull/439), [#440](https://github.com/kinnet-studio/ue-too/pull/440))

### ❤️ Thank You

- Claude Fable 5.1
- vee @niuee

## 0.18.0 (2026-09-03)

### 🚀 Features

- state machine visualizer page + extractMachineGraph introspection API ([#428](https://github.com/kinnet-studio/ue-too/pull/428))
- surface eventPreconditions in the state machine visualizer ([#434](https://github.com/kinnet-studio/ue-too/pull/434))
- live affordance dimming + context inspector in state machine visualizer ([#435](https://github.com/kinnet-studio/ue-too/pull/435))
- live board machines in the state machine visualizer ([#436](https://github.com/kinnet-studio/ue-too/pull/436), [#435](https://github.com/kinnet-studio/ue-too/issues/435))
- **banana:** add flip direction and reverse order for formation children ([#386](https://github.com/kinnet-studio/ue-too/pull/386))
- **banana:** add car editor link to landing page ([#389](https://github.com/kinnet-studio/ue-too/pull/389))
- **banana:** duplicate track to the side ([#390](https://github.com/kinnet-studio/ue-too/pull/390))
- **banana:** toggle bogies rendering from debug panel ([#391](https://github.com/kinnet-studio/ue-too/pull/391))
- **banana:** save car definitions to IndexedDB library ([#392](https://github.com/kinnet-studio/ue-too/pull/392))
- **banana:** group toolbar into category rail + flyout panel ([#394](https://github.com/kinnet-studio/ue-too/pull/394))
- **banana:** catenary layout tool for placing overhead wires on existing tracks ([#398](https://github.com/kinnet-studio/ue-too/pull/398))
- **banana:** multi-gauge track support ([#402](https://github.com/kinnet-studio/ue-too/pull/402))
- **banana:** track-aligned station platforms ([#403](https://github.com/kinnet-studio/ue-too/pull/403))
- **banana:** joint direction editing tool ([#405](https://github.com/kinnet-studio/ue-too/pull/405))
- **banana:** train collision prevention system ([#409](https://github.com/kinnet-studio/ue-too/pull/409))
- **being:** add eventPreconditions pre-action vetoes to states ([#432](https://github.com/kinnet-studio/ue-too/pull/432))
- **board:** add input-mode toggle API to Board ([#419](https://github.com/kinnet-studio/ue-too/pull/419))
- **board-pixi-integration:** bump pixi.js to 8.20.1 ([#437](https://github.com/kinnet-studio/ue-too/pull/437))
- **examples:** rectilinear edges in state machine visualizer ([#433](https://github.com/kinnet-studio/ue-too/pull/433))
- **horse-racing:** v2 rebuild — phases 1-3 (attributes, dynamics, observation) ([#399](https://github.com/kinnet-studio/ue-too/pull/399))
- **horse-racing:** BT rebalance + manual tuning harness + physics fixes ([#410](https://github.com/kinnet-studio/ue-too/pull/410))

### 🩹 Fixes

- force production JSX transform in Bun.build output ([#380](https://github.com/kinnet-studio/ue-too/pull/380), [#379](https://github.com/kinnet-studio/ue-too/issues/379))
- **banana:** toolbar UI improvements ([#382](https://github.com/kinnet-studio/ue-too/pull/382))
- **banana:** use bogie-to-bogie angle for gangway on curves ([#384](https://github.com/kinnet-studio/ue-too/pull/384))
- **banana:** use epoch time for simulation clock ([#385](https://github.com/kinnet-studio/ue-too/pull/385))
- **banana:** skip tunnel entrance geometry for fully-underground ramps ([#387](https://github.com/kinnet-studio/ue-too/pull/387))
- **banana:** attach toolbar scroll-overflow observers once app mounts ([#388](https://github.com/kinnet-studio/ue-too/pull/388))
- **banana:** isolate landing CTA hover state per button ([#393](https://github.com/kinnet-studio/ue-too/pull/393))
- **banana:** draw track shadows above same-band drawables ([#395](https://github.com/kinnet-studio/ue-too/pull/395))
- **banana:** separate bogie walk-back from forward JDM ([#396](https://github.com/kinnet-studio/ue-too/pull/396))
- **banana:** account for ballast and bed width in track shadows ([#400](https://github.com/kinnet-studio/ue-too/pull/400))
- **banana:** place catenary poles at track edge instead of fixed offset ([#401](https://github.com/kinnet-studio/ue-too/pull/401))
- **banana:** multi-platform per station + timetable platform selection ([#404](https://github.com/kinnet-studio/ue-too/pull/404))
- **banana:** gangway length on curves, coupler rendering, and car type UI ([#407](https://github.com/kinnet-studio/ue-too/pull/407))
- **banana:** close toolbar flyout when activating a tool or opening a panel ([#408](https://github.com/kinnet-studio/ue-too/pull/408))
- **board:** explicit package exports and root imports for bundlers ([#378](https://github.com/kinnet-studio/ue-too/pull/378))
- **board-pixi-integration:** mark pixi.js and workspace deps as external in build ([#383](https://github.com/kinnet-studio/ue-too/pull/383))
- **board-pixi-react-integration:** prevent Pixi re-init and lost-context reuse ([#422](https://github.com/kinnet-studio/ue-too/pull/422))
- **dynamics:** gate static-friction velocity clamp on frictionEnabled ([#413](https://github.com/kinnet-studio/ue-too/pull/413))

### ❤️ Thank You

- Claude Fable 5
- Claude Fable 5.1
- Claude Opus 4.6
- Claude Opus 4.6 (1M context)
- Claude Opus 4.7
- Claude Opus 4.7 (1M context)
- Claude Opus 4.8
- Claude Opus 5 (1M context)
- Claude Sonnet 4.6
- vee @niuee

## 0.17.1 (2026-04-08)

### 🩹 Fixes

- **board:** explicit package exports and root imports for bundlers ([#379](https://github.com/kinnet-studio/ue-too/pull/379))

### ❤️ Thank You

- vee @niuee

## 0.17.0 (2026-04-08)

### 🩹 Fixes

- support nested subpath exports in package.json ([#377](https://github.com/kinnet-studio/ue-too/pull/377))

### ❤️ Thank You

- Claude Opus 4.6
- vee @niuee

## 0.16.0 (2026-03-25)

This was a version bump only, there were no code changes.

## 0.15.0 (2026-02-24)

### 🩹 Fixes

- add temp file to gitignore ([11f19d8](https://github.com/kinnet-studio/ue-too/commit/11f19d8))

### ❤️ Thank You

- Vincent Chang

## 0.14.0 (2026-01-19)

### 🩹 Fixes

- no longer release individual package's bundled javascript ([#318](https://github.com/kinnet-studio/ue-too/pull/318))

### ❤️ Thank You

- niuee @niuee

## 0.13.0 (2026-01-19)

### 🚀 Features

- add vue integration ([#303](https://github.com/kinnet-studio/ue-too/pull/303))
- auto detect input mode ([#306](https://github.com/kinnet-studio/ue-too/pull/306))
- third party framework integration ([#310](https://github.com/kinnet-studio/ue-too/pull/310))
- board component swappable ([#311](https://github.com/kinnet-studio/ue-too/pull/311))
- add hierarchical state machine poc ([#312](https://github.com/kinnet-studio/ue-too/pull/312))
- ecs serializable ([#314](https://github.com/kinnet-studio/ue-too/pull/314))
- board game engine ([#315](https://github.com/kinnet-studio/ue-too/pull/315))

### 🩹 Fixes

- documentation ([2414e43](https://github.com/kinnet-studio/ue-too/commit/2414e43))
- update when attribute changes ([#304](https://github.com/kinnet-studio/ue-too/pull/304))
- vue library bundle ([#309](https://github.com/kinnet-studio/ue-too/pull/309))
- board-vue dependency update ([3ed998a](https://github.com/kinnet-studio/ue-too/commit/3ed998a))
- state machine ([#313](https://github.com/kinnet-studio/ue-too/pull/313))
- update gitignore ([9c8d424](https://github.com/kinnet-studio/ue-too/commit/9c8d424))
- build workflow ([#316](https://github.com/kinnet-studio/ue-too/pull/316))

### ❤️ Thank You

- niuee @niuee

## 0.12.0 (2025-12-26)

This was a version bump only, there were no code changes.

## 0.11.0 (2025-12-26)

This was a version bump only, there were no code changes.

## 0.10.0 (2025-12-26)

### 🚀 Features

- copy doc media to deploy to github pages ([#289](https://github.com/kinnet-studio/ue-too/pull/289))
- typedoc flow ([#292](https://github.com/kinnet-studio/ue-too/pull/292))
- documentation deployment upon new release ([#293](https://github.com/kinnet-studio/ue-too/pull/293))
- subdirectory import ([#294](https://github.com/kinnet-studio/ue-too/pull/294))
- add a new package for board react adapter ([#297](https://github.com/kinnet-studio/ue-too/pull/297))
- svg support ([#299](https://github.com/kinnet-studio/ue-too/pull/299))

### 🩹 Fixes

- add npmignore in move package step ([#286](https://github.com/kinnet-studio/ue-too/pull/286))
- npmignore path ([#287](https://github.com/kinnet-studio/ue-too/pull/287))
- add tsbuildinfo to git ignore ([f96472c](https://github.com/kinnet-studio/ue-too/commit/f96472c))
- update output directory for built documentation media ([1e82780](https://github.com/kinnet-studio/ue-too/commit/1e82780))
- branch name format in deploy workflow ([2ad0149](https://github.com/kinnet-studio/ue-too/commit/2ad0149))
- deploy static images ([#290](https://github.com/kinnet-studio/ue-too/pull/290))
- package without subdirectory import ([#295](https://github.com/kinnet-studio/ue-too/pull/295))
- deploy documentation branch rule ([229e93c](https://github.com/kinnet-studio/ue-too/commit/229e93c))
- do not differentiate version on documentation ([5b62d18](https://github.com/kinnet-studio/ue-too/commit/5b62d18))
- framework integration examples ([#298](https://github.com/kinnet-studio/ue-too/pull/298))
- package badge link ([9cfe140](https://github.com/kinnet-studio/ue-too/commit/9cfe140))
- package badge link ([3373960](https://github.com/kinnet-studio/ue-too/commit/3373960))

### ❤️ Thank You

- niuee @niuee

## 0.9.0 (2025-12-09)

### 🩹 Fixes

- start with 0.8.1 ([45b9c95](https://github.com/kinnet-studio/ue-too/commit/45b9c95))

### ❤️ Thank You

- niuee

## 0.7.1 (2025-10-15)

### 🩹 Fixes

- manually bump version ([a33588e](https://github.com/kinnet-studio/ue-too/commit/a33588e))

### ❤️ Thank You

- niuee

## 0.7.0 (2025-10-15)

This was a version bump only, there were no code changes.
