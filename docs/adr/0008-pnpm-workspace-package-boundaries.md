# 0008: pnpm workspace による 3 パッケージ分割（core / viewer / cli）

- **Status**: Accepted
- **Date**: 2026-11-27

## Context

初期 MVP は単一パッケージ（`src/core/`, `src/state/`, `src/ui/`）として実装されたが、次の 3 つの成果物を同時に提供・保守する必要が生じた：

1. フレームワーク非依存の地図・モデル・JSON 変換・レイアウト・描画・エクスポートエンジン
2. React + Tailwind CSS v4 製の探索ビューア（GitHub Pages サンプルサイト用 SPA ビルド ＆ 単一 HTML テンプレートビルド）
3. Node.js 上で `workspace.json` を受け取り、事前レイアウト済みの単一 HTML を生成する CLI（`c4-zoom build`）

単一パッケージのまま CLI と 2 種類のフロントエンドビルドを同居させると、Node.js 専用依存とブラウザ専用依存の混在、ビルド順序の不透明化、型境界の緩みが発生しやすい。

## Decision

**`pnpm workspace`（`pnpm-workspace.yaml` + `catalog:`）を採用し、一方向 DAG 依存を持つ 3 パッケージ構成へ分割する。**

```text
packages/
├── core/      # @c4-zoom/core   — 純粋TS（model, json, layout, camera, lod, renderer, export）
├── viewer/    # @c4-zoom/viewer — React + Tailwind v4 UI（SPAサイト & 単一HTMLテンプレート出力）
└── cli/       # @c4-zoom/cli    — Node.js CLI（bin: c4-zoom）
```

- 依存方向を `@c4-zoom/cli -> @c4-zoom/viewer -> @c4-zoom/core`（および `cli -> core`）の厳格な一方向 DAG に固定する。
- `@c4-zoom/core` は `elkjs` のみに依存し、React・DOM UI・Node `fs` 依存を禁止する（サブパスエクスポートにより必要な機能単位でインポート可能にする）。
- Linter（`oxlint`）、Formatter（`oxfmt`）、Git Hooks（`lefthook` + `lint-staged`）、E2E テスト（Playwright）はリポジトリルートで一元管理する。

## Alternatives Considered

- **単一パッケージのまま `src/cli/` を追加する**:
  - 初期移行の手間は小さいが、ブラウザコードから Node 組み込みモジュールへの誤参照や、単一 HTML テンプレートと CLI のビルド依存管理が曖昧になるため不採用。
- **4〜6 パッケージへの細分化（`model`, `json`, `layout`, `renderer`, `viewer`, `cli`）**:
  - 個人〜少人数規模に対してパッケージ設定・ビルド・型参照のオーバーヘッドが過大になるため不採用。将来必要になれば `@c4-zoom/core` のサブパス境界からそのまま切り出せる。

## Consequences

- **メリット**:
  - パッケージ境界によって [ADR 0003](./0003-custom-canvas-2d-renderer-and-core-separation.md) の「コア／UI 非依存」がツールレベルで強制される。
  - CLI・サンプルサイト・将来の拡張（ローカル監視サーバーや VS Code 拡張）が同一の `@c4-zoom/core` をクリーンに共有できる。
  - `pnpm-workspace.yaml` の `catalog:` により React / TypeScript / Vite / Vitest 等のバージョンずれを防げる。
- **トレードオフ・注意点**:
  - ビルド順序（`core` → `viewer` テンプレート → `cli` / サイト）をルートスクリプトおよび CI で明示的に管理する必要がある。
