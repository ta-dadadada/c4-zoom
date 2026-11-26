# c4-zoom

**Structurizr 公式 `workspace.json` を、地図アプリのような連続セマンティック・ズームで自由に探索でき、そのまま 1 枚のスタンドアロン HTML として配布できる C4 アーキテクチャマップビューア。**

従来の C4 ツールが「個別ビュー（Context 図 / Container 図 / Component 図）間のページ切り替え」を基本とするのに対し、**c4-zoom** は `model` の入れ子構造から **1 枚の連続した空間地図** を自動生成します。DSL の構文解析は公式 `structurizr-cli` に委譲して 100% 公式互換の `workspace.json` を入力とし、CI や手元からオフライン動作する単一 HTML を吐き出せます。

## 主な特徴

- **連続セマンティック・ズーム（空間入れ子 + LOD）**: 1 枚のキャンバスに `System ⊃ Container ⊃ Component` が入れ子配置され、ズーム倍率と画面上のサイズに応じて詳細度（枠・中身・ラベル）が滑らかに変化
- **C4 レベル単位のクイックジャンプ**: `1` / `2` / `3` やレベル別クイックジャンパーで L1（Context）/ L2（Container）/ L3（Component）の最適視点へ 1 アクションで Fly-to、`[` / `]` で兄弟要素を巡回
- **関係線の動的ロールアップ＆トレース**: 詳細レベルのエッジを現在見えている階層へ自動集約。ノード選択時は上流・下流の依存経路をハイライト
- **公式 Structurizr `workspace.json` 一本化**: 公式 `structurizr-cli` 出力をそのまま読み込み、`!include` / `!extend` / `!script` / `!components` 等を含むフル仕様モデルに対応
- **単一 HTML 出力（CLI & ブラウザ Export）**: 事前レイアウト済みの 1 枚 HTML を出力し、サーバー不要・`file://` 直開きで PR や Slack・社内ポータルへそのまま共有可能
- **GitHub Pages サンプルサイト**: **c4-zoom 自身の C4 アーキテクチャ**を含む複数サンプルをブラウザ上で自由に探索でき、手元の `workspace.json` を D&D して試せるデモサイトを提供

## 使い方（DSL → 公式 JSON → 単一 HTML）

```sh
# 1. 公式 Structurizr CLI で .dsl を workspace.json へ変換
structurizr-cli export -workspace workspace.dsl -format json -output ./out

# 2. c4-zoom CLI でスタンドアロン単一 HTML を生成
pnpm --filter @c4-zoom/cli exec c4-zoom build ./out/workspace.json -o ./architecture.html
```

生成された `architecture.html` はブラウザで直接開くだけで完全オフライン動作します。

## ローカル開発（pnpm workspace）

`mise` で Node.js と pnpm を管理します。

```sh
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm hooks:install
mise exec -- pnpm dev
```

### 検証コマンド

```sh
mise exec -- pnpm exec playwright install chromium
mise exec -- pnpm lint
mise exec -- pnpm fmt:check
mise exec -- pnpm typecheck
mise exec -- pnpm test
mise exec -- pnpm test:e2e
mise exec -- pnpm build
```

## パッケージ構成

| パッケージ | 役割 |
| :--- | :--- |
| `packages/core` (`@c4-zoom/core`) | React/Node 非依存のコアエンジン（公式 JSON アダプタ、ELK レイアウト、カメラ＆レベルジャンプ、LOD・動的エッジロールアップ、Canvas 2D レンダラー、単一 HTML シリアライザ） |
| `packages/viewer` (`@c4-zoom/viewer`) | React + Tailwind CSS v4 の探索ビューア（GitHub Pages サンプルサイト用 SPA ビルド ＆ 単一 HTML テンプレートビルド） |
| `packages/cli` (`@c4-zoom/cli`) | `workspace.json` から事前レイアウト済み単一 HTML を生成する Node.js CLI（`c4-zoom build`） |

## ドキュメント一覧

| ファイル | 対象 | 言語 | 内容 |
| :--- | :--- | :--- | :--- |
| [docs/design.md](./docs/design.md) | 開発者・人間向け | 日本語 | システム全体のアーキテクチャ、連続セマンティック・ズーム、レベルジャンプ、エッジ集約、単一 HTML 出力、セキュリティ設計 |
| [docs/input-spec.md](./docs/input-spec.md) | 開発者・ユーザー向け | 日本語 | Structurizr 公式 `workspace.json` 入力仕様、変換マッピング、エッジケース、エラー診断仕様 |
| [docs/architecture/workspace.dsl](./docs/architecture/workspace.dsl) | 開発者・ドッグフーディング | Structurizr DSL | **c4-zoom 自身の C4 アーキテクチャ図**（L1〜L3。公式 JSON 変換版をサンプルサイトにも掲載） |
| [docs/adr/README.md](./docs/adr/README.md) | 開発者・人間向け | 日本語 | Architecture Decision Records（後戻りコストの高い技術・構造決定 `0001`〜`0009`） |
| [docs/test-samples.md](./docs/test-samples.md) | 開発者・人間向け | 日本語 | テスト・サンプルサイト用データ一覧、出典・ライセンス、自動テスト検証観点 |
| [SECURITY.md](./SECURITY.md) | ユーザー・開発者向け | 日本語 | セキュリティ前提・防御対策・脆弱性報告ポリシー |
| [AGENTS.md](./AGENTS.md) | AIエージェント向け | English | リポジトリ規約、モノレポ責務分離ルール、言語ルール、開発・テストガイドライン |

## 技術スタック

- **Package Manager / Monorepo**: `mise`, Node.js 26, `pnpm` workspace (`catalog:`), TypeScript 7, Vite 8, `oxlint`, `oxfmt`, `lefthook`, `lint-staged`
- **Frontend / UI**: React 19, Tailwind CSS v4 (`@tailwindcss/vite`), React Context + `useReducer` / `Ref`
- **Map Rendering**: Custom HTML5 Canvas 2D (HiDPI / 60fps Semantic Zoom)
- **Layout Engine**: `elkjs` (Compound / Hierarchical Graph Layout)
- **Input Format**: Official Structurizr `workspace.json` (converted via `structurizr-cli`)
- **Single-HTML Bundling**: `vite-plugin-singlefile` template + pre-laid-out JSON payload injection
- **Testing & CI**: Vitest (Unit) + Playwright (E2E / `file://` single-HTML verification) + GitHub Actions / GitHub Pages / Dependabot
