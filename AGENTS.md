# AGENTS.md — c4-zoom

This document provides architectural context, conventions, and engineering rules for AI agents working on **c4-zoom**.

## 1. Project Overview

**c4-zoom** is a browser-based interactive C4 architecture map viewer powered by a Structurizr DSL core subset. Unlike traditional page-switching C4 viewers, it renders the entire `System ⊃ Container ⊃ Component` hierarchy onto a single continuous 2D canvas with **semantic zoom (LOD)**, **dynamic edge rollup**, **hybrid layout (ELK.js + saved manual offsets)**, and a **modern cartography** visual style.

Key reference documents:
- `AGENTS.local.md` (optional, git-ignored): If present in the repo root, read and follow it for local-only rules and conventions.
- `docs/design.md` (Japanese): Detailed product, spatial zoom, edge rollup, layout, rendering, and UI/UX specification.
- `docs/dsl-spec.md` (Japanese): Supported Structurizr DSL core subset specification and error/fallback policies.
- `docs/architecture/workspace.dsl` (Structurizr DSL): Self-hosted C4 architecture model of c4-zoom itself (L1–L3; used both as living architecture documentation and as a dogfooding verification fixture).
- `docs/adr/` (Japanese, MADR): Architecture Decision Records (`0001`–`0007`) capturing architecturally significant technical/structural decisions only (1 ADR = 1 decision; product scope & Non-Goals live in `docs/design.md`).
- `docs/test-samples.md` (Japanese): Catalog of bundled DSL fixtures (`fixtures/dsl/upstream/` & `fixtures/dsl/custom/`), attribution/licenses, and verification checklists for both automated tests and manual browser checks.

## 2. Language Policy

Follow these language rules strictly:
- **Conversation with user**: Japanese.
- **Source code comments**: Japanese.
- **AI-agent documentation** (`AGENTS.md`, internal specs/plans for LLMs): English.
- **Human-facing documentation** (`README.md`, `docs/design.md`, `docs/dsl-spec.md`): Japanese.

## 3. Architectural Principles

### Strict Core / UI Separation
Keep the core map engine **100% framework-agnostic (no React / DOM UI dependencies)** so it can later be reused in a CLI watcher, VS Code extension, or headless test runner.

```text
src/
├── core/                  # Pure TypeScript (NO React imports)
│   ├── model/             # Canonical C4 graph types, tree helpers, upstream/downstream traversal
│   ├── dsl/               # Structurizr DSL lexer, recursive-descent parser, AST -> Model compiler
│   ├── layout/            # ELK.js compound layout adapter + manual offset merger
│   ├── camera/            # 2D camera math (world <-> screen), inertia pan, parabolic Fly-to animation
│   ├── lod/               # Semantic zoom LOD evaluator + dynamic edge rollup / anchor projection
│   └── renderer/          # HTML5 Canvas 2D cartography renderer, hit testing, label collision avoidance
├── samples/               # Built-in Structurizr DSL sample architectures
├── state/                 # React Context + useReducer + Ref bridge + localStorage persistence
├── ui/                    # Floating map UI overlays (React + Tailwind CSS v4)
│   ├── SearchBar.tsx      # Spot search (Cmd+K / /) + Fly-to trigger
│   ├── Breadcrumbs.tsx    # Current viewport location & hierarchy path
│   ├── ZoomControls.tsx   # Zoom level gauge (Context/Container/Component) + +/-/Fit
│   ├── Minimap.tsx        # Real-time overview canvas + viewport rectangle
│   ├── Inspector.tsx      # Selected node/edge details + upstream/downstream trace list
│   ├── SourceControls.tsx # Sample preset switcher, .dsl file picker / D&D overlay, diagnostics popover
│   └── MapCanvas.tsx      # Thin React wrapper bridging Canvas 2D engine, pointer/wheel/key events, and state
└── main.tsx
```

Note: **In-app DSL editing is explicitly out of scope**; c4-zoom is a pure exploration viewer loading `.dsl` files (via Drag & Drop / file picker) and built-in presets.

### Core Engineering Invariants
1. **Last-Known-Good Stability**: DSL parse errors on file load must NEVER crash or blank the map. Keep rendering the last valid model/layout while surfacing line/column diagnostics in the diagnostics UI.
2. **60fps Render Loop**: The Canvas 2D render loop runs via `requestAnimationFrame` driven by mutable camera/animation state (`ref`), NOT by re-rendering React on every pointermove or wheel tick. Sync throttled UI snapshots (zoom level, active breadcrumb, minimap viewport) to React state.
3. **Screen-Space Consistency**: Stroke widths, typography sizes, corner radii, and hit-test tolerances must be normalized in screen space where appropriate so elements stay crisp and readable across extreme zoom ranges (`0.05x` to `12x`).
4. **Deterministic Layout + Stable Spatial Memory**: ELK.js layout must be deterministic for identical models. Manual user drag offsets are stored separately by canonical element ID (`Record<string, { dx: number; dy: number }>`) and applied non-destructively after layout.
5. **Graceful DSL Compatibility**: Ignore unsupported Structurizr blocks (such as `views`, `styles`, `deploymentEnvironment`, `!include`, `!script`, `!components { ... }`) with non-fatal warnings rather than hard errors, so real-world `.dsl` files work out of the box.

## 4. Toolchain, Coding & Testing Guidelines

- **Toolchain**: `pnpm`, TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`), Vite, Tailwind CSS v4 (`@tailwindcss/vite`), `oxlint`, `oxfmt`, `lefthook`, `lint-staged`.
- **State Management**: React Context + `useReducer` + `Ref` (no external state management libraries). Keep high-frequency canvas state in mutable refs to avoid React re-renders during pan/zoom.
- **TypeScript**: Avoid `any`. Prefer explicit domain types.
- **Unit Tests (Vitest)**: Required for all pure core modules:
  - `core/dsl`: Lexing, nested hierarchy parsing, relationship resolution, comment/unsupported-block skipping, error line reporting (verified against all `fixtures/dsl/` samples).
  - `core/lod`: Effective visible anchor resolution, dynamic edge rollup aggregation, bidirectional edge separation.
  - `core/camera`: World-to-screen / screen-to-world roundtrip, cursor-anchored zoom invariance, Fly-to interpolation endpoints.
  - `core/model`: Upstream/downstream trace calculation and cycle safety.
- **E2E Tests (Playwright)**: Cover map load, zoom/pan/Fly-to interactions, search, inspector selection, `.dsl` file upload/D&D, and invalid DSL Last-Known-Good recovery.
- **Verification before completion**: Run `pnpm lint`, `pnpm fmt:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` as appropriate after changes.
