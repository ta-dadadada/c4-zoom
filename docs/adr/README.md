# Architecture Decision Records (ADR)

本ディレクトリには、**c4-zoom** における**後戻りコストの高い技術・構造上の意思決定（Architecturally Significant Decisions）**を **MADR (Markdown Architectural Decision Records)** 形式で記録します。

## 一覧

| ID | タイトル | ステータス | 日付 |
| :--- | :--- | :--- | :--- |
| [0001](./0001-spatial-nesting-and-screen-space-lod.md) | 単一2D空間入れ子モデルと画面占有サイズ基準の連続 LOD | Accepted | 2026-11-26 |
| [0002](./0002-structurizr-dsl-core-subset.md) | Structurizr DSL コア構文サブセットのブラウザ内即時パースと寛容な互換方針 | Accepted | 2026-11-26 |
| [0003](./0003-custom-canvas-2d-renderer-and-core-separation.md) | カスタム HTML5 Canvas 2D レンダラーの採用とコア／UIの厳格な責務分離 | Accepted | 2026-11-26 |
| [0004](./0004-hybrid-elk-layout-with-relative-offsets.md) | ELK.js 階層自動レイアウトと手動相対オフセット永続化のハイブリッド方式 | Accepted | 2026-11-26 |
| [0005](./0005-dynamic-edge-rollup-by-visible-anchor.md) | 画面展開状態に基づく動的アンカー射影とエッジロールアップ | Accepted | 2026-11-26 |
| [0006](./0006-state-isolation-with-react-context-and-refs.md) | React Context + useReducer と高頻度 Canvas 状態の Ref 隔離 | Accepted | 2026-11-26 |
| [0007](./0007-parser-maintenance-boundary-and-workspace-json-option.md) | DSL パーサーの保守境界と公式 `workspace.json` アダプタ導入の検討 | Proposed (Draft) | 2026-11-26 |

## 対象基準と運用ルール

- **ADR に書くもの（How / 構造・技術決定）**:
  - 後戻りコストが高い構造・データモデル・配布形態・描画方式・依存境界・状態隔離などの意思決定。
  - **原則 1 ADR = 1 決定** に保つ。
  - プロダクト要件や前提制約は `Decision` ではなく **`Context`** に記述する。
- **ADR に書かないもの**:
  - プロダクトスコープ・機能一覧・Non-Goals（「エディタは作らない」等）は [docs/design.md](../design.md) に記載する（将来プロダクト方針転換の履歴が独立して必要になった場合のみ `docs/pdr/` の新設を検討する）。
  - 入れ替えコストの低い開発ツール選定（Linter / Formatter 等）は原則 `AGENTS.md` / `README.md` に記載し ADR には含めない。
- **更新ルール**:
  - 新たな決定を行う際は連番ファイル `NNNN-short-kebab-title.md` を追加する。
  - 既存の決定を覆す場合は旧 ADR を削除せずステータスを `Superseded by NNNN` に更新し、新しい ADR で経緯を記録する。
  - 人間向けの設計記録であるため、記述言語は **日本語** とする。

## テンプレート

```markdown
# NNNN: タイトル

- **Status**: Proposed | Accepted | Deprecated | Superseded by NNNN
- **Date**: YYYY-MM-DD

## Context
背景・制約・前提となるプロダクト要件。

## Decision
採用した技術・構造上の決定内容。

## Alternatives Considered
検討した代替案と不採用理由。

## Consequences
この決定によって得られるメリット、トレードオフ、制約・注意点。
```
