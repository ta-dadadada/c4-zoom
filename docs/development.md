# 開発者ガイド (`docs/development.md`)

**c4-zoom** のローカル開発・テスト・ビルド・GitHub Pages 公開手順およびパッケージ構成をまとめています。

---

## 1. 前提環境

- Node.js 26 以上
- pnpm 10 以上（`packageManager` に準拠）
- 任意: `gitleaks`（PATH に存在する場合、`pre-commit` フックでステージ済み差分のシークレット検査を自動実行）
- 任意（サンプル JSON 再生成時のみ）: 公式 [Structurizr](https://docs.structurizr.com/export)（Docker イメージ `structurizr/structurizr`、またはローカル実行環境）

---

## 2. セットアップと開発サーバー起動

```sh
pnpm install --frozen-lockfile
pnpm hooks:install
pnpm dev
```

起動時に表示された URL を開くと、サンプルサイトモード（既定サンプルは `CloudShop Multi-System`、c4-zoom 自身の C4 モデル等へ切替可能）で動作します。

### Git フック（Lefthook）

`pnpm hooks:install` で `pre-commit` と `pre-push` フックを登録します（設定: [lefthook.yml](../lefthook.yml)）：

- **`pre-commit`**:
  1. `scripts/check-staged-safety.mjs`: ステージ済み差分に対するローカル絶対パス・非公開ファイル参照の混入検査
  2. `lint-staged`: `oxfmt` による整形と `oxlint --deny-warnings`
  3. `gitleaks`: PATH に導入済みの場合、`gitleaks protect --staged --redact --no-banner`
- **`pre-push`**:
  - `pnpm typecheck` → `pnpm test` → `pnpm build`
- 依存監査（`pnpm audit`）と Playwright E2E は CI（[ci.yml](../.github/workflows/ci.yml)）で実行します。

---

## 3. 検証コマンド

```sh
# 初回のみ Playwright Chromium を導入
pnpm exec playwright install chromium

pnpm lint
pnpm fmt:check
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm audit --audit-level=high
```

Playwright E2E はビルド済みサイトを `/c4-zoom/` サブパスで配信し、あわせて CLI およびブラウザ Export で生成した単一 HTML を `file://` で直接開いて検証します。

---

## 4. サンプルサイトのビルド・公開とサンプル JSON 再生成

### ビルドとプレビュー

```sh
pnpm --filter @c4-zoom/viewer build
pnpm preview
```

- `packages/viewer/dist/site/`: GitHub Pages 向けサンプルサイト一式
- `packages/viewer/dist/template/viewer-template.html`: 単一 HTML テンプレート

### GitHub Pages 公開設定

GitHub リポジトリの **Settings → Pages → Build and deployment** で **GitHub Actions** を選択すると、`main` への push または手動実行で [GitHub Pages ワークフロー](../.github/workflows/pages.yml) から自動デプロイされます。

### 同梱サンプル JSON の再生成

公式 Structurizr（Docker `structurizr/structurizr` またはローカルコマンド）を用意して以下を実行します：

```sh
pnpm samples:export
```

ローカル実行ファイルが PATH にない場合は `STRUCTURIZR_CLI` 環境変数で実行ファイルパスを指定でき、Docker イメージは `STRUCTURIZR_CLI_IMAGE`（既定 `structurizr/structurizr:latest`）で上書きできます。変換対象と出典は [docs/test-samples.md](./test-samples.md) を参照してください。

---

## 5. パッケージ構成（pnpm workspace）

| パッケージ | 役割 |
| :--- | :--- |
| `packages/core` (`@c4-zoom/core`) | React/Node 非依存のコアエンジン（公式 JSON アダプタ、ELK レイアウト、カメラ＆レベルジャンプ、LOD・動的エッジロールアップ、Canvas 2D レンダラー、単一 HTML シリアライザ） |
| `packages/viewer` (`@c4-zoom/viewer`) | React + Tailwind CSS v4 の探索ビューア（GitHub Pages サンプルサイト用 SPA ビルド ＆ 単一 HTML テンプレートビルド） |
| `packages/cli` (`@c4-zoom/cli`) | `workspace.json` から事前レイアウト済み単一 HTML を生成する Node.js CLI（`c4-zoom build`） |

## 6. 技術スタック

- **Monorepo / Toolchain**: Node.js 26, `pnpm` workspace (`catalog:`), TypeScript 7, Vite 8, `oxlint`, `oxfmt`, `lefthook`, `lint-staged`
- **Frontend / UI**: React 19, Tailwind CSS v4 (`@tailwindcss/vite`), React Context + `useReducer` / `Ref`
- **Map Rendering**: Custom HTML5 Canvas 2D (HiDPI / 60fps Semantic Zoom)
- **Layout Engine**: `elkjs` (Compound / Hierarchical Graph Layout)
- **Input Format**: Official Structurizr `workspace.json` (converted via official Structurizr `export`)
- **Single-HTML Bundling**: `vite-plugin-singlefile` template + pre-laid-out JSON payload injection
- **Testing & CI**: Vitest (Unit) + Playwright (E2E / `file://` single-HTML verification) + GitHub Actions / GitHub Pages / Dependabot

## 7. 関連ドキュメント

- [docs/design.md](./design.md): 詳細設計書
- [docs/input-spec.md](./input-spec.md): 公式 `workspace.json` 入力仕様
- [docs/test-samples.md](./test-samples.md): テスト・サンプルデータ一覧と検証観点
- [docs/adr/README.md](./adr/README.md): Architecture Decision Records（`0001`〜`0009`）
- [AGENTS.md](../AGENTS.md): AI エージェント向けリポジトリ規約（English）
