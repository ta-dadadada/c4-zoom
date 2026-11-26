# 0007: DSL パーサーの保守境界と公式 `workspace.json` アダプタ導入の検討

- **Status**: Proposed (Draft)
- **Date**: 2026-11-26
- **Related**: [0002: Structurizr DSL コア構文サブセットのブラウザ内即時パースと寛容な互換方針](./0002-structurizr-dsl-core-subset.md)

## Context

[ADR 0002](./0002-structurizr-dsl-core-subset.md) では、ブラウザ単体で手軽に `.dsl` を開ける体験を優先し、Structurizr DSL のコア構文サブセットを TypeScript で自前実装する方針を採った。

しかし実装を進める過程で、**「DSL パーサーを再実装・保守し続けること自体の妥当性」** に疑念が生じている：

- Structurizr DSL は一見シンプルだが、実運用では `!include`、`!extend`、`!archetypes`、`!impliedRelationships`、`!script`、`!components`、`!ref` などの機能が多く、互換性を追い続けるとパーサー保守が主目的（地図としての探索体験）を圧迫するリスクがある。
- 一方で、調査時点のエコシステムには **公式のブラウザ動作 JS/TS パーサーが存在しない**（公式 `structurizr-dsl` は Java 製のみ）。コミュニティ製の JS パーサーも結局サブセット実装であり、Tree-sitter 文法や Rust 再実装（`StructurizrX` 等）を WASM で組み込む場合もビルド・モデル意味解析の追加コストが発生する。

当面は現行のコアサブセット実装で MVP を完成させつつ、パーサー保守の沼を避けるための出口戦略をあらかじめ設計上の選択肢として明文化しておきたい。

## Decision (Proposed)

現時点では現行の自前サブセットパーサーで実装を継続しつつ、以下を中長期の方針案として提案する：

1. **自前 DSL パーサーの責務上限を明示する**
   - 自前パーサーは「単一 `.dsl` ファイルのコア構文（`docs/dsl-spec.md` 定義範囲）」に責務を限定し、スクリプト評価・複数ファイル `!include`・高度なマクロ展開などのフル仕様再現は目指さない。
2. **入力アダプタ境界を厳格に維持する**
   - 地図エンジン全体は正規化モデル `C4Workspace`（`src/core/model`）のみに依存し、入力パーサーは `(input) => { workspace, diagnostics }` の薄い変換層として差し替え可能・複数並存可能な構造を維持する。
3. **フル互換ニーズへの第一候補として、公式 `workspace.json` 読み込みアダプタを追加する**
   - ユーザーが `structurizr-cli export -f json` 等で生成した公式 `workspace.json` をそのまま D&D / ファイル選択で読み込めるようにする（例：`src/core/json/`）。
   - これにより、パーサー実装コストをほぼゼロに抑えたまま `!include`・`!script`・`!components` 等の全仕様が解決済みの **100% 公式互換モデル** を c4-zoom で探索可能にする。

## Alternatives Considered

- **A. 自前 TypeScript パーサーを Structurizr DSL フル仕様へ拡張し続ける**
  - ブラウザ単体での体験は最高だが、仕様追従・エッジケース対応の保守コストが青天井になりやすく、本命の地図体験開発を圧迫する。
- **B. Tree-sitter（`tree-sitter-structurizr`）や Rust 再実装（`StructurizrX`）の WASM 組み込み**
  - 構文解析の自前実装は減らせるが、WASM バンドルサイズ増・Vite ビルド設定・AST から C4 モデルへの意味解析ブリッジ構築が必要。`workspace.json` アダプタより導入コストが高い（ただし将来的に単体 `.dsl` 互換をさらに高めたい場合の有力な次点候補）。
- **C. バックエンド API（Java `structurizr-dsl` / Structurizr CLI）へパースを委譲する**
  - 完全互換だが、ブラウザ完結 SPA の手軽さ・プライバシー（手元のアーキテクチャ定義を外部送信しない）を損なう。

## Open Questions / Revisit Triggers

以下のいずれかが顕在化したタイミングで、本 Draft ADR を見直し `Accepted`（実装着手）とするか判断する：

- 実プロジェクトの `.dsl`（`!include` や `!extend` を含むもの）を c4-zoom で開きたいニーズが明確になったとき
- 自前 DSL パーサーの修正・例外対応コストが無視できなくなってきたとき
- MVP 完成後、次の機能拡張として `workspace.json`（公式 Structurizr JSON スキーマ）→ `C4Workspace` 変換の工数が十分小さいことを確認できたとき

## Consequences (If Accepted)

- **メリット**:
  - 「手軽な `.dsl` 直接ドロップ（自前コアサブセット）」と「大規模・複雑な構成の 100% 公式互換（`workspace.json`）」を両立できる。
  - パーサーの保守境界が明確になり、不要な複雑化を防げる。
- **トレードオフ**:
  - フル互換機能を使う場合のみ、ユーザー側で事前に `structurizr-cli` による JSON エクスポートが一手間必要になる。
