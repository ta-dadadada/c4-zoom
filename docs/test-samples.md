# テスト・動作確認用サンプル一覧 (`docs/test-samples.md`)

本リポジトリでは、**自動テスト（Vitest）** および **ブラウザでの手動・結合動作確認** の両方で一貫して使えるよう、公式の Structurizr DSL サンプルと c4-zoom 固有の検証用サンプルを `fixtures/dsl/` に同梱しています。

---

## 1. ディレクトリ構成

```text
fixtures/dsl/
├── upstream/                          # Structurizr 公式リポジトリ由来（Apache-2.0）
│   ├── LICENSE-Apache-2.0.txt         # 帰属・ライセンス全文
│   ├── big-bank-plc.dsl               # 王道フル階層リファレンス（L1〜L3 + deployment + views）
│   ├── financial-risk-system.dsl      # 複数外部システム・タグ中心のコンテキストモデル
│   ├── amazon-web-services.dsl        # deploymentNode 多用（未対応ブロック耐性テスト）
│   ├── getting-started.dsl            # 最小構成ベースライン
│   ├── spring-petclinic.dsl           # !identifiers hierarchical / !components / tag 単数形
│   ├── groups-nested.dsl              # 多段ネスト group & ブロック無し group 構文
│   ├── hierarchical-identifiers.dsl   # 階層識別子解決テスト
│   └── this.dsl                       # this 自己参照・element キーワード検証
└── custom/                            # c4-zoom 独自検証用フィクスチャ
    ├── cloudshop-multi-system.dsl     # 複数内部システムがすべてL1〜L3を持つ主力動作確認モデル
    ├── novabank-event-driven.dsl      # 双方向エッジ・長い依存チェーン・トレース検証モデル
    └── invalid-syntax.dsl             # 構文エラー診断・Last-Known-Good維持テスト
```

---

## 2. 公式サンプル一覧 (`fixtures/dsl/upstream/`)

すべてのファイルは [`structurizr/java`](https://github.com/structurizr/java)（`master` ブランチ、`structurizr-dsl/src/test/resources/dsl/` 配下）から取得しています。ライセンスは **Apache License 2.0**（[LICENSE-Apache-2.0.txt](../fixtures/dsl/upstream/LICENSE-Apache-2.0.txt)）です。

| ファイル | 構造・特徴 | 主な検証観点（自動テスト / 動作確認） |
| :--- | :--- | :--- |
| [big-bank-plc.dsl](../fixtures/dsl/upstream/big-bank-plc.dsl) | Person×3, System×5, Container×5, Component×6, `group`, `deploymentEnvironment`, `views`, `styles`, 小文字キーワード `softwaresystem` | **最優先リファレンス**。L1→L2→L3 の連続ズーム、親直接エッジと子ロールアップエッジの重複集約、未対応ブロック（`deploymentEnvironment` / `views`）の安全スキップ |
| [getting-started.dsl](../fixtures/dsl/upstream/getting-started.dsl) | Person×1, System×1, 関係線×1 | 最小構成のパース・初期Fit表示・ベースライン回帰テスト |
| [financial-risk-system.dsl](../fixtures/dsl/upstream/financial-risk-system.dsl) | 複数アクター＋複数外部/内部システムの L1 コンテキスト中心 | L1 ランドマーク配置、外部システム破線スタイル、多数エッジの視認性 |
| [amazon-web-services.dsl](../fixtures/dsl/upstream/amazon-web-services.dsl) | `deploymentEnvironment` / `deploymentNode` / `infrastructureNode` 多用 | インフラ定義が多い実 `.dsl` を貼り付けても壊れず `model` 部分を綺麗に描画できるか |
| [spring-petclinic.dsl](../fixtures/dsl/upstream/spring-petclinic.dsl) | `!identifiers hierarchical`, `tag`（単数）, `url`, `!components { ... }` ブロック | ブロック付き未対応ディレクティブのスキップ、`url` のインスペクタ表示、`tag` 単数形対応 |
| [groups-nested.dsl](../fixtures/dsl/upstream/groups-nested.dsl) | 5段以上の `group` ネスト＋ブロック無し `group "API Layer"` | 入れ子 `group` のパース・ELK 階層レイアウト崩れ防止 |
| [hierarchical-identifiers.dsl](../fixtures/dsl/upstream/hierarchical-identifiers.dsl) | `!identifiers hierarchical` でのドット区切り参照 | `parent.child` 形式の識別子解決ユニットテスト |
| [this.dsl](../fixtures/dsl/upstream/this.dsl) | `custom -> this`、`element` キーワード | `this` 自己参照の解決、カスタム `element` の安全な扱い |

---

## 3. c4-zoom 独自サンプル一覧 (`fixtures/dsl/custom/`)

公開サンプルではカバーしにくい「複数システムの同時展開・横パン・双方向ロールアップ・異常系」を検証するためのサンプルです。

| ファイル | 特徴 | 主な検証観点（自動テスト / 動作確認） |
| :--- | :--- | :--- |
| [cloudshop-multi-system.dsl](../fixtures/dsl/custom/cloudshop-multi-system.dsl) | 内部システム×3（Commerce / Fulfillment / Analytics）がすべて L2・L3 を保持。外部システム×3、グループ・DB・Kafka・gRPC/REST 混在 | **ブラウザ動作確認の主力**。左の Commerce を L3 まで展開しつつ右の Fulfillment が L1/L2 に見えるハイブリッド LOD、隣のシステムへの横パン移動、スポット検索＆放物線 Fly-to、動的エッジロールアップ |
| [novabank-event-driven.dsl](../fixtures/dsl/custom/novabank-event-driven.dsl) | 双方向通信（`Transfer Endpoint <-> ML Scorer`, `Clearing Adapter <-> Clearing Network`）、Kafka 経由の多段依存チェーン | 双方向ベジェ曲線の分離描画、ノード選択時の上流/下流トレース（`1-hop` vs `Transitive` 切替）、循環参照を含むグラフでの無限ループ防止 |
| [invalid-syntax.dsl](../fixtures/dsl/custom/invalid-syntax.dsl) | 未定義識別子参照＋末尾の未閉じ `}` | エラー行・列番号の正確な診断出力、ファイル読込（D&D等）時にキャンバスが真っ白にならず Last-Known-Good を維持することの確認 |
| [workspace.dsl](../docs/architecture/workspace.dsl) | **c4-zoom 自身の C4 モデル**（UI・State・Core Engine の L1〜L3 + `group` + `views`） | **ドッグフーディング検証**。c4-zoom 自身を読み込んで自分の内部モジュール構造をズーム探索できることの確認 |

---

## 4. フェーズ別の活用ルール

- **Phase 1（DSL パーサー）**: `upstream/*.dsl` 全8本がエラー落ちせずパースできること（未対応ブロックは `info` 警告のみ）＋ `invalid-syntax.dsl` で正確なエラー行・列が返ることを Vitest で自動検証。
- **Phase 2（ELK レイアウト）**: `big-bank-plc.dsl`、`groups-nested.dsl`、`cloudshop-multi-system.dsl` で親子包含関係・非重なり・決定性を自動検証。
- **Phase 3（LOD・エッジロールアップ）**: `big-bank-plc.dsl`（親子重複エッジ）と `cloudshop-multi-system.dsl`（混合展開状態）、`novabank-event-driven.dsl`（双方向・循環依存トレース）を自動検証。
- **Phase 4〜6（Canvas 描画・UI 結合動作確認）**:
  - 初期ロードおよびプリセット切替に `cloudshop-multi-system.dsl` / `big-bank-plc.dsl` / `novabank-event-driven.dsl` / `getting-started.dsl` を使用。
  - `.dsl` ドラッグ＆ドロップ読込の動作確認には `fixtures/dsl/upstream/*.dsl` をそのままブラウザへドロップして検証。
  - 60fps パフォーマンス確認用には、テストコード内のジェネレータで 200〜500 ノード規模のストレスモデルを動的生成して計測する。
