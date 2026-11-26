# 0002: Structurizr DSL コア構文サブセットのブラウザ内即時パースと寛容な互換方針

- **Status**: Accepted
- **Date**: 2026-11-26

## Context

c4-zoom が読み込むアーキテクチャ定義フォーマットには、独自 YAML/JSON を設計する選択肢と、既存エコシステム（Structurizr DSL / LikeC4）に合わせる選択肢がある。
すでに C4 モデルのデファクトスタンダードとして Structurizr DSL が広く使われており、公式サンプルや実プロジェクトの `.dsl` ファイル、さらに LLM が生成する C4 図も Structurizr DSL 形式が多い。

一方で、Structurizr DSL の全仕様（`!include`, `!script`, Groovy/Kotlin スクリプト、動的ビュー、デプロイメント環境、`!components` バイトコードスキャン等）をブラウザ単体で 100% 再現するのは非現実的である。

## Decision

1. **Structurizr DSL のコア構文サブセット（`model` ブロック中心）を採用し、ブラウザ内で即時動作する専用 Lexer / 再帰下降 Parser を TypeScript で実装する**。
   - `workspace`, `model`, `person`, `softwareSystem`, `container`, `component`, `group`, `->`（明示・暗黙・`this` 自己参照）, `description`, `technology`, `tag`/`tags`, `url`, `properties`, `!identifiers hierarchical` 等をサポートする。
   - 公式サンプル（`big-bank-plc.dsl` 等）の実態に合わせ、キーワードは大文字・小文字を区別しない（case-insensitive）。
2. **`views` を書かなくても地図を生成でき、未対応ブロックは安全にスキップする（Graceful Ignore）**。
   - `views`, `styles`, `deploymentEnvironment`, `deploymentNode`, `!docs`, `!adrs`, `!components { ... }` 等が出現してもエラーで止めず、情報/警告診断のみ記録して `model` を正常描画する。
3. **Last-Known-Good 原則を採用する**。
   - 構文エラーを含む `.dsl` を読み込んだ場合でもキャンバスを白紙化・クラッシュさせず、直前の正常モデルを維持したまま行・列番号付きの診断を表示する。

## Alternatives Considered

- **Structurizr 公式 CLI / Java バックエンドによる完全パース**:
  - 100% 互換が得られるが、ブラウザ完結の手軽さが失われ、サーバーまたは Java ランタイムが必要になるため不採用。
- **独自 YAML / JSON フォーマット**:
  - パースは単純だが学習コストが発生し、既存の Structurizr `.dsl` 資産（`big-bank-plc.dsl` 等）をそのまま読み込めないため不採用。
- **LikeC4 DSL ベース**:
  - モダンだが Structurizr DSL ほど汎用的な資産・認知度が広くないため、まずは Structurizr DSL を主対象とした。

## Consequences

- **メリット**:
  - 既存の Structurizr `.dsl` ファイルをそのままドラッグ＆ドロップして地図化できる。
  - `views` 定義を省いて `model` だけ書いても即座に探索できるため、新規記述コストも下がる。
- **トレードオフ・制約**:
  - `!include` による複数ファイル分割や `!script` による動的モデル生成はブラウザ単体では実行できない（将来的にローカル CLI 版を作る際に解決可能）。
  - ブラウザ内パーサーの互換性を担保するため、`fixtures/dsl/upstream/` に同梱した公式テストサンプル 8 本に対する回帰テストを必須とする。
