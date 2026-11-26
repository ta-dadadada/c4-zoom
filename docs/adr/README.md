# Architecture Decision Records (ADR)

本ディレクトリには、**c4-zoom** における主要なアーキテクチャおよび技術選定の意思決定を **MADR (Markdown Architectural Decision Records)** 形式で記録します。

## 一覧

| ID | タイトル | ステータス | 日付 |
| :--- | :--- | :--- | :--- |
| [0001](./0001-continuous-semantic-zoom-viewer-scope.md) | 連続セマンティック・ズーム特化＆エディタ非搭載（探索ビューア集中） | Accepted | 2026-11-26 |
| [0002](./0002-structurizr-dsl-core-subset.md) | Structurizr DSL コア構文サブセットのブラウザ内即時パースと寛容な互換方針 | Accepted | 2026-11-26 |
| [0003](./0003-custom-canvas-2d-renderer-and-core-separation.md) | カスタム HTML5 Canvas 2D レンダラーの採用とコア／UIの厳格な責務分離 | Accepted | 2026-11-26 |
| [0004](./0004-hybrid-elk-layout-and-dynamic-edge-rollup.md) | ELK.js＋手動オフセット保存のハイブリッドレイアウトと動的エッジロールアップ | Accepted | 2026-11-26 |
| [0005](./0005-frontend-state-and-toolchain.md) | React標準状態管理（Context + useReducer / Ref）およびフロントエンドツールチェーン選定 | Accepted | 2026-11-26 |

## 運用ルール

- 新たな重要設計判断・方針変更を行う際は、連番ファイル `NNNN-short-kebab-title.md` を追加する。
- 既存の決定を覆す場合は、旧 ADR を削除せずステータスを `Superseded by NNNN` に更新し、新しい ADR で経緯を記録する。
- 人間向けの設計記録であるため、記述言語は **日本語** とする。

## テンプレート

```markdown
# NNNN: タイトル

- **Status**: Proposed | Accepted | Deprecated | Superseded by NNNN
- **Date**: YYYY-MM-DD

## Context
背景・課題・前提条件。

## Decision
採用した決定内容。

## Alternatives Considered
検討した代替案と不採用理由。

## Consequences
この決定によって得られるメリット、トレードオフ、制約・注意点。
```
