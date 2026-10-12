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

- [**`@ue-too/being`**](https://www.npmjs.com/package/@ue-too/being) <a href="https://www.npmjs.com/package/@ue-too/being"><img src="https://img.shields.io/npm/v/@ue-too/being.svg" alt="package being's npm version" style="vertical-align: middle"></a> - Finite state machine
- [**`@ue-too/board`**](https://www.npmjs.com/package/@ue-too/board) <a href="https://www.npmjs.com/package/@ue-too/board"><img src="https://img.shields.io/npm/v/@ue-too/board.svg" alt="package board's npm version" style="vertical-align: middle"></a> - Canvas viewport management with pan, zoom, and rotate functionality
- [**`@ue-too/math`**](https://www.npmjs.com/package/@ue-too/math) <a href="https://www.npmjs.com/package/@ue-too/math"><img src="https://img.shields.io/npm/v/@ue-too/math.svg" alt="package math's npm version" style="vertical-align: middle"></a> - Mathematical utilities for 2D point operations, transformations, and calculations
- [**`@ue-too/animate`**](https://www.npmjs.com/package/@ue-too/animate) <a href="https://www.npmjs.com/package/@ue-too/animate"><img src="https://img.shields.io/npm/v/@ue-too/animate.svg" alt="package animate's npm version" style="vertical-align: middle"></a> - Animation system for smooth transitions and keyframe animations
- [**`@ue-too/dynamics`**](https://www.npmjs.com/package/@ue-too/dynamics) <a href="https://www.npmjs.com/package/@ue-too/dynamics"><img src="https://img.shields.io/npm/v/@ue-too/dynamics.svg" alt="package dynamics's npm version" style="vertical-align: middle"></a> - 2D physics engine with collision detection, rigid bodies, and constraints
- [**`@ue-too/curve`**](https://www.npmjs.com/package/@ue-too/curve) <img src="https://img.shields.io/npm/v/@ue-too/curve.svg" alt="package curve's npm version" style="vertical-align: middle"> - Curve and path tools including Bézier curves, lines, and composite paths
- [**`@ue-too/border`**](https://www.npmjs.com/package/@ue-too/border) <a href="https://www.npmjs.com/package/@ue-too/border"><img src="https://img.shields.io/npm/v/@ue-too/border.svg" alt="package border's npm version" style="vertical-align: middle"></a> - Geographic projection utilities (great circle, rhumb line, map projections)
- [**`@ue-too/ecs`**](https://www.npmjs.com/package/@ue-too/ecs) <a href="https://www.npmjs.com/package/@ue-too/ecs"><img src="https://img.shields.io/npm/v/@ue-too/ecs.svg" alt="package ecs's npm version" style="vertical-align: middle"></a> - Entity Component System architecture support

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
- A patch on an older release line (e.g. 0.18.4 after 0.19.0 is out) is published under the npm dist-tag `latest-<major>.<minor>` (`npm i @ue-too/board@latest-0.18`), and its GitHub release isn't marked Latest; `latest` stays on the newest line.

Preview the next version locally with `bun run bump-version:dry-run`.

## License

MIT License - see [LICENSE.txt](LICENSE.txt) for details.

## Support

- [GitHub Issues](https://github.com/kinnet-studio/ue-too/issues) - Bug reports and feature requests

> Currently not accepting contributions yet. If there's any features you want to see, please let me know by creating an issue.
