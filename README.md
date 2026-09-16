<h1 align="center">
    uē-tôo
</h1>
<p align="center">
    A toolkit for interactive HTML canvas applications
</p>

<div align="center">

[![ci tests](https://img.shields.io/github/actions/workflow/status/niuee/board/ci-test.yml?label=test&style=for-the-badge)](https://github.com/niuee/board/actions/workflows/ci-test.yml)
[![License](https://img.shields.io/github/license/niuee/board?style=for-the-badge)](https://github.com/niuee/board/blob/main/LICENSE.txt)

</div>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="https://kinnet-studio.github.io/ue-too-documentation/">Documentation</a> •
  <a href="#packages">Packages</a> •
  <a href="#examples">Examples</a> •
  <a href="#development">Development</a>
</p>

## Packages

ue-too is organized into modular packages:

### Core

- [**`@ue-too/being`**](https://www.npmjs.com/package/@ue-too/being) <a href="https://www.npmjs.com/package/@ue-too/being"><img src="https://img.shields.io/npm/v/@ue-too/being.svg" alt="package being's npm version" style="vertical-align: middle"></a> - Finite state machine — [README](packages/being/README.md)
- [**`@ue-too/board`**](https://www.npmjs.com/package/@ue-too/board) <a href="https://www.npmjs.com/package/@ue-too/board"><img src="https://img.shields.io/npm/v/@ue-too/board.svg" alt="package board's npm version" style="vertical-align: middle"></a> - Canvas viewport management with pan, zoom, and rotate functionality — [README](packages/board/README.md)
- [**`@ue-too/math`**](https://www.npmjs.com/package/@ue-too/math) <a href="https://www.npmjs.com/package/@ue-too/math"><img src="https://img.shields.io/npm/v/@ue-too/math.svg" alt="package math's npm version" style="vertical-align: middle"></a> - Mathematical utilities for 2D point operations, transformations, and calculations — [README](packages/math/README.md)
- [**`@ue-too/animate`**](https://www.npmjs.com/package/@ue-too/animate) <a href="https://www.npmjs.com/package/@ue-too/animate"><img src="https://img.shields.io/npm/v/@ue-too/animate.svg" alt="package animate's npm version" style="vertical-align: middle"></a> - Animation system for smooth transitions and keyframe animations — [README](packages/animate/README.md)
- [**`@ue-too/dynamics`**](https://www.npmjs.com/package/@ue-too/dynamics) <a href="https://www.npmjs.com/package/@ue-too/dynamics"><img src="https://img.shields.io/npm/v/@ue-too/dynamics.svg" alt="package dynamics's npm version" style="vertical-align: middle"></a> - 2D physics engine with collision detection, rigid bodies, and constraints — [README](packages/dynamics/README.md)
- [**`@ue-too/curve`**](https://www.npmjs.com/package/@ue-too/curve) <img src="https://img.shields.io/npm/v/@ue-too/curve.svg" alt="package curve's npm version" style="vertical-align: middle"> - Curve and path tools including Bézier curves, lines, and composite paths — [README](packages/curve/README.md)
- [**`@ue-too/border`**](https://www.npmjs.com/package/@ue-too/border) <a href="https://www.npmjs.com/package/@ue-too/border"><img src="https://img.shields.io/npm/v/@ue-too/border.svg" alt="package border's npm version" style="vertical-align: middle"></a> - Geographic projection utilities (great circle, rhumb line, map projections) — [README](packages/border/README.md)
- [**`@ue-too/ecs`**](https://www.npmjs.com/package/@ue-too/ecs) <a href="https://www.npmjs.com/package/@ue-too/ecs"><img src="https://img.shields.io/npm/v/@ue-too/ecs.svg" alt="package ecs's npm version" style="vertical-align: middle"></a> - Entity Component System architecture support — [README](packages/ecs/README.md)

### Framework Integrations

- [**`@ue-too/board-react-adapter`**](https://www.npmjs.com/package/@ue-too/board-react-adapter) <a href="https://www.npmjs.com/package/@ue-too/board-react-adapter"><img src="https://img.shields.io/npm/v/@ue-too/board-react-adapter.svg" alt="package board-react-adapter's npm version" style="vertical-align: middle"></a> - React components and hooks for embedding the board canvas — [README](packages/board-react-adapter/README.md)
- [**`@ue-too/board-vue-adapter`**](https://www.npmjs.com/package/@ue-too/board-vue-adapter) <a href="https://www.npmjs.com/package/@ue-too/board-vue-adapter"><img src="https://img.shields.io/npm/v/@ue-too/board-vue-adapter.svg" alt="package board-vue-adapter's npm version" style="vertical-align: middle"></a> - Vue components and composables for embedding the board canvas — [README](packages/board-vue-adapter/README.md)
- [**`@ue-too/board-pixi-integration`**](https://www.npmjs.com/package/@ue-too/board-pixi-integration) <a href="https://www.npmjs.com/package/@ue-too/board-pixi-integration"><img src="https://img.shields.io/npm/v/@ue-too/board-pixi-integration.svg" alt="package board-pixi-integration's npm version" style="vertical-align: middle"></a> - PixiJS renderer driven by the board camera — [README](packages/board-pixi-integration/README.md)
- [**`@ue-too/board-pixi-react-integration`**](https://www.npmjs.com/package/@ue-too/board-pixi-react-integration) <a href="https://www.npmjs.com/package/@ue-too/board-pixi-react-integration"><img src="https://img.shields.io/npm/v/@ue-too/board-pixi-react-integration.svg" alt="package board-pixi-react-integration's npm version" style="vertical-align: middle"></a> - PixiJS integration for React applications — [README](packages/board-pixi-react-integration/README.md)
- [**`@ue-too/board-konva-integration`**](https://www.npmjs.com/package/@ue-too/board-konva-integration) <a href="https://www.npmjs.com/package/@ue-too/board-konva-integration"><img src="https://img.shields.io/npm/v/@ue-too/board-konva-integration.svg" alt="package board-konva-integration's npm version" style="vertical-align: middle"></a> - Konva.js stage synchronized with the board camera — [README](packages/board-konva-integration/README.md)
- [**`@ue-too/board-fabric-integration`**](https://www.npmjs.com/package/@ue-too/board-fabric-integration) <a href="https://www.npmjs.com/package/@ue-too/board-fabric-integration"><img src="https://img.shields.io/npm/v/@ue-too/board-fabric-integration.svg" alt="package board-fabric-integration's npm version" style="vertical-align: middle"></a> - Fabric.js canvas synchronized with the board camera — [README](packages/board-fabric-integration/README.md)

### Additional Packages

- [**`@ue-too/being-devtools`**](https://www.npmjs.com/package/@ue-too/being-devtools) <a href="https://www.npmjs.com/package/@ue-too/being-devtools"><img src="https://img.shields.io/npm/v/@ue-too/being-devtools.svg" alt="package being-devtools's npm version" style="vertical-align: middle"></a> - Attachable debugger panel for `@ue-too/being` machines — live state chart, event log, and context inspector — [README](packages/being-devtools/README.md)
- **`@ue-too/board-game-engine`** - Tabletop board game primitives: zones, grids, players, actions, and events (not yet published to npm) — [README](packages/board-game-engine/README.md)

## Install Individual Packages

```bash
# Install specific packages you need
npm install @ue-too/board @ue-too/math @ue-too/animate
```

## Examples

A live website containing the examples is available [here](https://kinnet-studio.github.io/ue-too/).

This monorepo includes comprehensive examples demonstrating various packages and integrations:

### Core Examples

- [**Base Example**](https://kinnet-studio.github.io/ue-too/base/) - Basic canvas viewport with pan, zoom, and rotate
- [**Attach / Detach Example**](https://kinnet-studio.github.io/ue-too/attach-detach/) - Dynamically attach and detach a canvas from the board
- [**Navigation Example**](https://kinnet-studio.github.io/ue-too/navigation/) - Keyboard-driven camera panning via `panByViewPort()`
- [**Ruler Example**](https://kinnet-studio.github.io/ue-too/ruler/) - Measurement ruler overlay that updates with pan and zoom
- [**Camera Animation**](https://kinnet-studio.github.io/ue-too/camera-animation/) - Smooth animated camera transitions on click
- [**Image Example**](https://kinnet-studio.github.io/ue-too/image-example/) - Upload and display an image on the pannable canvas
- [**SVG Example**](https://kinnet-studio.github.io/ue-too/svg/) - Board camera system applied to SVG elements

### Framework Integrations

- [**PixiJS Integration**](https://kinnet-studio.github.io/ue-too/pixi-integration/) - Full-screen PixiJS canvas with board camera controls
- [**Konva Integration**](https://kinnet-studio.github.io/ue-too/konva-integration/) - Konva.js stage synchronized with board camera transforms
- [**Fabric Integration**](https://kinnet-studio.github.io/ue-too/fabric-integration/) - Fabric.js with toggleable movement/selection modes

### Advanced Features

- [**Physics Example**](https://kinnet-studio.github.io/ue-too/physics/) - Four-bar linkage with rigid body physics and constraints
- [**State Machine Visualizer**](https://kinnet-studio.github.io/ue-too/state-machine-visualizer/) - Live state chart, event log, and context inspector for `@ue-too/being` machines

### Running Examples

To run the examples locally:

```bash
# Clone the repository
git clone https://github.com/kinnet-studio/ue-too.git
cd ue-too

# Install dependencies
bun install

# Start the development server
bun dev:examples
```

Then, visit `http://localhost:5173` to explore all examples.

## Development

### Prerequisites

- Bun 1.3.4

### Setup

```bash
# Clone and install
git clone https://github.com/kinnet-studio/ue-too.git
cd ue-too
bun install

# Run tests
bun test

# Build all packages
bun run build

# Start development server
bun dev:examples
```

Refer to the read me of each libary and application for more detail.

### Project Structure

```
ue-too/
├── packages/                         # Individual packages
│   ├── board/                        # Canvas viewport management
│   ├── board-react-adapter/          # React integration for the board package
│   ├── board-vue-adapter/            # Vue integration for the board package
│   ├── board-pixi-integration/       # PixiJS integration for the board package
│   ├── board-pixi-react-integration/ # PixiJS integration for the board package with React
│   ├── board-konva-integration/      # Konva integration for the board package
│   ├── board-fabric-integration/     # Fabric integration for the board package
│   ├── math/                         # Mathematical utilities
│   ├── animate/                      # Animation system
│   ├── dynamics/                     # Physics engine
│   ├── curve/                        # Curve and path tools
│   ├── border/                       # Geographic projections
│   ├── being/                        # Finite state machine
│   └── ecs/                          # Entity Component System
├── apps/                             # Example applications
│   ├── examples/                     # Interactive examples
│   └── blast/                        # A tabletop game prototype maker. (WIP)
└── scripts/                          # Build and deployment scripts
```

### Graduated Apps

Some apps that started in this monorepo have moved to their own repositories once they stabilized:

- **banana** (railway simulator) → [github.com/kinnet-studio/banana](https://github.com/kinnet-studio/banana)
- **knit** (knitting pattern editor) → moved to a private repository
- **horse-racing** (RL environment) → moved to a private repository

## Release Flow

All `@ue-too/*` packages are versioned in lockstep and published with [`nx release`](https://nx.dev/features/manage-releases) through the manually triggered **"Publish to NPM"** GitHub workflow. The version bump is inferred from [conventional commits](https://www.conventionalcommits.org/) since the last tag reachable from the branch the workflow runs on — `fix:` → patch, `feat:` → minor, `BREAKING CHANGE` → major. The workflow input defaults to `auto`; an explicit patch/minor/major can be selected to override the inference.

- **Minor/major releases** are cut from `main`. Each one auto-creates a `version/X.Y.Z` branch for that release line.
- **Patch releases** are cut from a `version/*` branch: fixes are cherry-picked from `main` onto the branch, and the workflow is triggered there — with only `fix:` commits on the branch, inference produces a patch. Patch tags and bump commits stay on the release branch, so `main` releases always diff from the last minor/major tag.

Preview the next version locally with `bun run bump-version:dry-run`.

## License

MIT License - see [LICENSE.txt](LICENSE.txt) for details.

## Support

- [GitHub Issues](https://github.com/kinnet-studio/ue-too/issues) - Bug reports and feature requests

> Currently not accepting contributions yet. If there's any features you want to see, please let me know by creating an issue.
