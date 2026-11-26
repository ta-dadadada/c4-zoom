# 0007: Structurizr 公式 `workspace.json` への入力一本化と自前 DSL パーサー廃止

- **Status**: Accepted
- **Date**: 2026-11-27
- **Supersedes**: [0002: Structurizr DSL コア構文サブセットのブラウザ内即時パースと寛容な互換方針](./0002-structurizr-dsl-core-subset.md)

## Context

[ADR 0002](./0002-structurizr-dsl-core-subset.md) に基づき初期 MVP では Structurizr DSL のコア構文サブセットを TypeScript で自前実装したが、以下の構造的リスクが明確になった：

- 実運用の Structurizr DSL では `!include`、`!extend`、`!archetypes`、`!impliedRelationships`、`!script`、`!components`、`!ref` など高度な構文が広く使われており、自前パーサーで互換性を追い続けると保守コストが本命の地図体験開発を圧迫し続ける。
- エコシステム上に公式のブラウザ動作 JS/TS パーサーは存在せず（公式 `structurizr-dsl` は Java 製のみ）、自前実装を続ける限り「公式ツールで通る DSL が c4-zoom では通らない」ギャップが永続する。
- 一方で、公式ツール（`structurizr-cli export -format json`）が出力する `workspace.json` は、`!include` や `!script` 等がすべて解決済みの明快な JSON スキーマであり、単一 HTML 出力 CLI（[ADR 0009](./0009-standalone-single-html-template-injection.md)）や CI パイプラインとも極めて相性が良い。

## Decision

1. **c4-zoom の入力契約を Structurizr 公式 `workspace.json` に一本化する**。
2. **自前の Structurizr DSL パーサー（`core/dsl`）を廃止し、DSL の構文解析は公式ツール（`structurizr-cli` 等）へ完全に委譲する**。
3. **`@c4-zoom/core/json` に公式 `workspace.json` → 正規化 `C4Workspace` アダプタを実装する**。
   - `model.people`, `model.softwareSystems[].containers[].components[]`, `model.customElements`, `relationships[]` をマッピングする。
   - 公式 JSON でフラット文字列として保持される `group`（`model.properties["structurizr.groupSeparator"]` 区切り）を仮想 `group` ノードツリーへ再構築する。
   - `properties` 等の辞書読込時は `__proto__` / `constructor` / `prototype` を除外し、不正 JSON・スキーマ欠落時は Last-Known-Good を維持する。

## Alternatives Considered

- **自前 DSL パーサーを維持しつつ `workspace.json` も併用する**:
  - 2 系統のパーサーとテスト資産・仕様書を並行保守するコストが残り、DSL 側の互換性バグ対応が継続するため不採用。
- **Tree-sitter（`tree-sitter-structurizr`）や Rust 再実装（`StructurizrX`）の WASM 組み込み**:
  - AST から公式モデルへの意味解析・WASM バンドル運用コストが高く、公式 CLI 出力 JSON を直接読む方が単純かつ 100% 互換を得られるため不採用。
- **バックエンド API で Java `structurizr-dsl` を実行する**:
  - サーバー不要・ブラウザ完結・社外秘モデルを外部送信しない設計前提を損なうため不採用。

## Consequences

- **メリット**:
  - `!include`・`!extend`・`!script`・`!components` を含む **100% 公式互換の C4 モデル** をパーサー保守コストほぼゼロで可視化できる。
  - CLI 連携（`structurizr-cli export -format json` → `c4-zoom build workspace.json -o architecture.html`）が CI/CD で安定稼働する。
  - コードベースからパーサー実装・保守負荷を取り除き、地図探索・レイアウト・描画品質へ集中できる。
- **トレードオフ・制約**:
  - ユーザーが手元の `.dsl` を可視化するには、事前に公式 `structurizr-cli`（ローカル導入または Docker `structurizr/cli`）で `workspace.json` へ変換する 1 ステップが必要になる。
  - リポジトリ内のサンプルおよびテストフィクスチャは、公式 CLI で変換済みの `workspace.json` を同梱して Java/Docker なしでテスト完結できるようにする。
