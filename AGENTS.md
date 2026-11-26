# AGENTS.md — c4-zoom

This document provides architectural context, conventions, and engineering rules for AI agents working on **c4-zoom**.

## 1. Project Overview

**c4-zoom** is a C4 architecture map viewer and standalone single-HTML exporter powered by **official Structurizr `workspace.json`** (delegating DSL parsing to official Structurizr `export`). It renders the entire `System ⊃ Container ⊃ Component` hierarchy onto a single continuous 2D canvas with **semantic zoom (LOD)**, **C4 level quick-jump**, **dynamic edge rollup**, **hybrid layout (ELK.js + saved manual offsets)**, and a **modern cartography** visual style.

Key reference documents:
- `AGENTS.local.md` (optional, git-ignored): If present in the repo root, read and follow it for local-only rules and conventions.
- `docs/development.md` (Japanese): Developer setup, validation commands, Git hooks, GitHub Pages build/deploy, and workspace package guide.
- `docs/design.md` (Japanese): Detailed product, spatial zoom, level quick-jump, edge rollup, layout, rendering, single-HTML export, and security specification.
- `docs/input-spec.md` (Japanese): Official Structurizr `workspace.json` input specification, group tree reconstruction, diagnostics, and security defenses.
- `docs/architecture/workspace.dsl` (Structurizr DSL): Self-hosted C4 architecture model of c4-zoom itself (L1–L3; exported via official Structurizr `export -format json` to `docs/architecture/workspace.json` and featured on the GitHub Pages sample site).
- `docs/adr/` (Japanese, MADR): Architecture Decision Records (`0001`–`0009`) capturing architecturally significant technical/structural decisions only (1 ADR = 1 decision; product scope & Non-Goals live in `docs/design.md`).
- `docs/test-samples.md` (Japanese): Catalog of bundled fixtures (`fixtures/json/` & `docs/architecture/workspace.json`), attribution/licenses, and verification checklists.
- `SECURITY.md` (Japanese): Security posture and vulnerability disclosure policy.

## 2. Language Policy

Follow these language rules strictly:
- **Conversation with user**: Japanese.
- **Source code comments**: Japanese.
- **AI-agent documentation** (`AGENTS.md`, internal specs/plans for LLMs): English.
- **Human-facing documentation** (`README.md`, `docs/design.md`, `docs/input-spec.md`, `docs/adr/`, `SECURITY.md`): Japanese.

## 3. Architectural Principles

### Strict pnpm Workspace Boundaries (DAG)
Maintain a strict unidirectional dependency graph across three workspace packages (`@c4-zoom/cli -> @c4-zoom/viewer -> @c4-zoom/core` and `@c4-zoom/cli -> @c4-zoom/core`):

```text
packages/
├── core/                  # @c4-zoom/core — Pure TypeScript (NO React / DOM UI / Node fs)
│   └── src/
│       ├── model/         # Canonical C4 graph types, tree helpers, upstream/downstream traversal
│       ├── json/          # Official Structurizr workspace.json adapter (replaces custom DSL parser)
│       ├── layout/        # ELK.js compound layout adapter + manual offset merger
│       ├── camera/        # 2D camera math, inertia pan, parabolic Fly-to, L1/L2/L3 quick-jump
│       ├── lod/           # Semantic zoom LOD evaluator + dynamic edge rollup / anchor projection
│       ├── renderer/      # HTML5 Canvas 2D cartography renderer, hit testing, label collision avoidance
│       └── export/        # XSS-safe bootstrap payload serializer & single-HTML template injector
├── viewer/                # @c4-zoom/viewer — React + Tailwind CSS v4 (SPA sample site + single-HTML template)
│   └── src/
│       ├── bootstrap.ts   # Reads #c4-zoom-bootstrap (standalone vs sample-site mode + precomputedLayout)
│       ├── samples/       # Sample site registry (CloudShop default + official & c4-zoom self models)
│       ├── state/         # React Context + useReducer + Ref bridge + layout runner + persistence
│       └── ui/            # MapCanvas, SearchBar, Breadcrumbs, ZoomControls(+LevelJumper), Minimap, Inspector, SourceControls(+Export HTML)
└── cli/                   # @c4-zoom/cli — Node.js CLI (bin: c4-zoom)
    └── src/               # `c4-zoom build <input.json> -o <output.html>` with precomputed ELK layout
```

Note: **Custom Structurizr DSL parsing and in-app DSL editing are explicitly out of scope** (see ADR 0007 and `docs/design.md` Section 1.3).

### Core Engineering & Security Invariants
1. **Last-Known-Good Stability**: Invalid JSON or missing `model` errors on file load must NEVER crash or blank the map. Keep rendering the last valid model/layout while surfacing diagnostics in the UI.
2. **60fps Render Loop**: The Canvas 2D render loop runs via `requestAnimationFrame` driven by mutable camera/animation state (`ref`), NOT by re-rendering React on every pointermove or wheel tick. Sync throttled UI snapshots (zoom level, active breadcrumb, minimap viewport) to React state.
3. **Screen-Space Consistency**: Stroke widths, typography sizes, corner radii, and hit-test tolerances must be normalized in screen space where appropriate so elements stay crisp and readable across extreme zoom ranges (`0.04x` to `12x`).
4. **Deterministic Layout + Stable Spatial Memory**: ELK.js layout must be deterministic for identical models. Manual user drag offsets are stored separately by canonical element ID (`Record<string, { dx: number; dy: number }>`) and applied non-destructively after layout.
5. **`file://` Standalone Compatibility**: When `precomputedLayout` is embedded in `#c4-zoom-bootstrap`, skip ELK/Web Worker execution completely and render immediately (0ms layout wait). For dynamic JSON drops in `file://` / singlefile builds, fall back safely without loading an external module Worker.
6. **Security Defenses (Unit-Tested)**:
   - Escape `<`, `>`, `&`, `\u2028`, `\u2029` to `\uXXXX` when embedding bootstrap JSON into HTML, and HTML-escape `<title>`.
   - Allow only `http:` and `https:` schemes when rendering clickable `element.url` links (`rel="noopener noreferrer" target="_blank"`).
   - Ignore `__proto__`, `constructor`, and `prototype` keys when ingesting untrusted JSON `properties`.
   - Maintain restrictive CSP headers/meta tags (no external network requests from standalone HTML).

## 4. Toolchain, Coding & Testing Guidelines

- **Toolchain**: `pnpm` workspace (`catalog:`), TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`), Vite, Tailwind CSS v4 (`@tailwindcss/vite`), `vite-plugin-singlefile`, `oxlint`, `oxfmt`, `lefthook`, `lint-staged`.
- **State Management**: React Context + `useReducer` + `Ref` (no external state management libraries). Keep high-frequency canvas state in mutable refs to avoid React re-renders during pan/zoom.
- **TypeScript**: Avoid `any`. Prefer explicit domain types.
- **Unit Tests (Vitest)**: Required for all pure core modules & CLI:
  - `core/json`: Official `workspace.json` parsing across all `fixtures/json/` & `docs/architecture/workspace.json`, flat `group` hierarchy reconstruction, Prototype Pollution defense, malformed input diagnostics.
  - `core/export`: XSS / `</script>` breakout escaping, `<title>` escaping, template injection roundtrip.
  - `core/lod`: Effective visible anchor resolution, dynamic edge rollup aggregation, bidirectional edge separation.
  - `core/camera`: Coordinate roundtrip, cursor-anchored zoom invariance, Fly-to endpoints, L1/L2/L3 quick-jump & sibling cycling.
  - `core/model`: Upstream/downstream trace calculation and cycle safety.
  - `cli`: `build` output verification, `--prelayout`, `--overrides`, `--strict`.
- **E2E Tests (Playwright)**: Cover sample site (including c4-zoom self model), L1/L2/L3 quick-jump, search/Fly-to, inspector (`javascript:` URL rejection), `workspace.json` D&D + Last-Known-Good recovery, browser HTML export, and **opening CLI-generated standalone HTML via `file://` with zero console errors**.
- **Verification before completion**: Run `pnpm lint`, `pnpm fmt:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build`, and `pnpm audit --audit-level=high` as appropriate after changes.
