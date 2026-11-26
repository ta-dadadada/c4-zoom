# c4-zoom

**Structurizr DSL で記述した C4 アーキテクチャモデルを、地図アプリのような連続セマンティック・ズームで自由に探索できるブラウザ完結型マップビューア。**

従来の C4 ツール（Structurizr / LikeC4 等）が「個別ビュー（Context図 / Container図 / Component図）間のページ切り替え」を基本とするのに対し、**c4-zoom** は `model` の入れ子構造から **1枚の連続した空間地図** を自動生成します。ホイールやピンチで寄ったり引いたりしながら、システム全体の俯瞰から内部コンテナ・コンポーネントまでをシームレスに旅するように探索できます。

## 主な特徴

- **連続セマンティック・ズーム（空間入れ子 + LOD）**: 1枚のキャンバスに `System ⊃ Container ⊃ Component` が入れ子配置され、ズーム倍率と画面上のサイズに応じて詳細度（枠・中身・ラベル）が滑らかに変化
- **関係線の動的ロールアップ＆トレース**: 詳細レベルのエッジを現在見えている階層へ自動集約。ノード選択時は上流・下流の依存経路をハイライト
- **Structurizr DSL コア構文対応**: `views` 定義を書かなくても `model` ブロックだけで探索地図を自動生成（既存 `.dsl` の `views` ブロック等は安全にスキップ）
- **ハイブリッドレイアウト**: ELK.js による階層自動レイアウトを基本とし、手動ドラッグで微調整した配置差分を `localStorage` に記憶して空間記憶を維持
- **地図アプリらしい探索UI**: スポット検索＆Fly-toアニメーション、ズームレベル計・パンくず、ミニマップ、詳細インスペクタ、`.dsl` ファイルの D&D 読込＆サンプルプリセット切替
- **モダン・カートグラフィー**: Apple Maps / Mapbox に着想を得た、クリーンで視認性の高い地図スタイル（HTML5 Canvas 2D 高DPI・60fps描画）

## ローカルで起動

mise で Node.js 26 と pnpm 10 を使用します。

```sh
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm hooks:install
mise exec -- pnpm dev
```

起動時に表示された URL を開くと、CloudShop の地図を探索できます。手元のモデルは「DSL を開く」か、画面に `.dsl` ファイルをドロップして読み込みます。スポット検索は `⌘K` / `Ctrl+K` / `/`、全体表示は `0`、各 C4 レベルへの移動は `1`〜`3` です。配置調整モード、または Alt / Option キーを押しながらのドラッグで要素を移動できます。

DSL の解析と自動配置はブラウザ内で行います。最後に読み込んだ DSL、テーマ、配置差分は、そのブラウザの `localStorage` に保存されます。読込に失敗すると、診断に行と列を表示し、直前の地図を引き続き操作できます。

### 検証

```sh
mise exec -- pnpm exec playwright install chromium
mise exec -- pnpm lint
mise exec -- pnpm fmt:check
mise exec -- pnpm typecheck
mise exec -- pnpm test
mise exec -- pnpm test:e2e
mise exec -- pnpm build
```

`mise exec -- pnpm preview` でビルド結果を確認できます。

## ドキュメント一覧

| ファイル | 対象 | 言語 | 内容 |
| :--- | :--- | :--- | :--- |
| [docs/design.md](./docs/design.md) | 開発者・人間向け | 日本語 | システム全体のアーキテクチャ、連続セマンティック・ズーム、エッジ集約、レイアウト、UI/ビジュアル詳細設計 |
| [docs/dsl-spec.md](./docs/dsl-spec.md) | 開発者・ユーザー向け | 日本語 | 対応する Structurizr DSL サブセット仕様、エラー処理、サンプルプリセット方針 |
| [docs/architecture/workspace.dsl](./docs/architecture/workspace.dsl) | 開発者・ドッグフーディング | Structurizr DSL | **c4-zoom 自身の C4 アーキテクチャ図**（L1〜L3。本アプリ自身で読み込んで探索可能） |
| [docs/adr/README.md](./docs/adr/README.md) | 開発者・人間向け | 日本語 | Architecture Decision Records（後戻りコストの高い技術・構造決定 `0001`〜`0007`） |
| [docs/test-samples.md](./docs/test-samples.md) | 開発者・人間向け | 日本語 | テスト・動作確認用 DSL サンプル一覧（`fixtures/dsl/`）、出典・ライセンス、検証チェック観点 |
| [AGENTS.md](./AGENTS.md) | AIエージェント向け | English | リポジトリ規約、責務分離ルール、言語ルール、開発・テストガイドライン |

## 技術スタック

- **Package Manager / Toolchain**: `mise`, Node.js 26, `pnpm`, TypeScript 7, Vite, `oxlint`, `oxfmt`, `lefthook`, `lint-staged`
- **Frontend / UI**: React, Tailwind CSS v4 (`@tailwindcss/vite`), React Context + `useReducer` / `Ref`
- **Map Rendering**: Custom HTML5 Canvas 2D (HiDPI / 60fps Semantic Zoom)
- **Layout Engine**: `elkjs` (Compound / Hierarchical Graph Layout)
- **DSL Engine**: Custom Tokenizer & Recursive-Descent Parser (Structurizr DSL Core Subset)
- **Testing**: Vitest (Unit) + Playwright (E2E / Canvas Interaction)
- **Persistence**: `localStorage` (手動レイアウト調整・UI設定・最後に読み込んだDSL) + `.dsl` Drag & Drop / ファイル読込
