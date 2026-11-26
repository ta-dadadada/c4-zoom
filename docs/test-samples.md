# テスト・動作確認用サンプル一覧 (`docs/test-samples.md`)

本リポジトリでは、**自動テスト（Vitest / Playwright）**・**GitHub Pages サンプルサイト**・**CLI 単一 HTML 出力の動作確認** で一貫して使えるよう、Structurizr 公式サンプルと c4-zoom 固有のサンプルを管理しています。

DSL のパースは公式 `structurizr-cli` に委譲する方針（[ADR 0007](./adr/0007-parser-maintenance-boundary-and-workspace-json-option.md)）に基づき、変換元の `.dsl`（`fixtures/dsl/`, `docs/architecture/workspace.dsl`）から公式 CLI で生成した `workspace.json`（`fixtures/json/`, `docs/architecture/workspace.json`）をテストおよびサンプルサイトの入力データとします。

---

## 1. ディレクトリ構成

```text
docs/architecture/
├── workspace.dsl                      # c4-zoom 自身の C4 モデル（Single Source of Truth）
└── workspace.json                     # 公式 export 出力（サンプルサイト掲載＆ドッグフーディング）

fixtures/
├── dsl/                               # 変換元 DSL（再生成・参照用）
│   ├── upstream/                      # Structurizr 公式リポジトリ由来（Apache-2.0）
│   └── custom/                        # c4-zoom 独自検証用モデル
└── json/                              # 公式 structurizr-cli 変換済み workspace.json（自動テスト＆デモ用）
    ├── upstream/
    │   ├── big-bank-plc.json
    │   ├── financial-risk-system.json
    │   ├── amazon-web-services.json
    │   ├── getting-started.json
    │   ├── groups-nested.json
    │   ├── hierarchical-identifiers.json
    │   └── this.json
    └── custom/
        ├── cloudshop-multi-system.json
        ├── novabank-event-driven.json
        ├── invalid.json               # 構文エラー診断・Last-Known-Good テスト
        └── missing-model.json         # スキーマ欠落診断テスト
```

同梱 JSON は公式の `export -format json`（初回生成は Structurizr CLI v2025.11.09）で生成した。再生成には `pnpm samples:export` を使う。ローカル実行ファイルが PATH にない場合は `STRUCTURIZR_CLI` でパスを指定でき、指定がなければ Docker の `structurizr/structurizr:latest`（`STRUCTURIZR_CLI_IMAGE` で上書き可）を使う（旧 `structurizr/cli` は EOL のため現行の [Structurizr `export`](https://docs.structurizr.com/export) を既定とする）。

変換先のファイル名は変換元と同じベース名になる。DSL にワークスペース名の指定がない場合、公式 CLI は `Name` を出力する。また、DSL 識別子が省略された要素の `structurizr.dsl.identifier` は再生成ごとに変わることがある。c4-zoom は公式 JSON の `id` をレイアウトと関係線の参照に使う。

`spring-petclinic.dsl` の `!components` は Spring PetClinic のソースと特定バージョンのビルド済み JAR を参照するため、同梱 JSON の生成対象外とする。`invalid-syntax.dsl` は旧入力用の異常系サンプルであり、JSON 入力の異常系には `invalid.json` と `missing-model.json` を使う。

---

## 2. サンプルサイト（GitHub Pages）掲載プリセット

| 順序 | サンプル名 | ソース JSON | 主な見どころ・検証観点 |
| :---: | :--- | :--- | :--- |
| 1 | **CloudShop Multi-System**（既定） | `fixtures/json/custom/cloudshop-multi-system.json` | **既定サンプル**。複数内部システムがすべて L1〜L3 を持つモデルでの横パン・混合 LOD・動的ロールアップ |
| 2 | **Big Bank plc (Structurizr Official)** | `fixtures/json/upstream/big-bank-plc.json` | C4 王道リファレンス（Apache-2.0）。親子両レベル定義エッジの統合集約・デプロイメント参照エッジの安全スキップ |
| 3 | **c4-zoom Architecture (Self)** | `docs/architecture/workspace.json` | **ドッグフーディング**。`core` / `viewer` / `cli` / `sampleSite` の L1〜L3、グループ枠、エッジロールアップ、レベル別クイックジャンプ |
| 4 | **NovaBank Event Mesh** | `fixtures/json/custom/novabank-event-driven.json` | 双方向ベジェ分離、循環を含む上流/下流トレース（`1-hop` vs `Transitive`） |
| 5 | **Financial Risk System** | `fixtures/json/upstream/financial-risk-system.json` | L1 コンテキスト中心・複数外部システムの破線表現 |

※ `fixtures/dsl/upstream/` および対応する JSON の出典は [`structurizr/java`](https://github.com/structurizr/java)（Apache License 2.0、[LICENSE-Apache-2.0.txt](../fixtures/dsl/upstream/LICENSE-Apache-2.0.txt)）です。

---

## 3. 自動テスト・セキュリティ検証観点

- **単体テスト（Vitest）**:
  - `packages/core/src/json`: 全 `fixtures/json/**` および `docs/architecture/workspace.json` の正規化、`group` 多段再構築、`location: "External"` 補完、`invalid.json` / `missing-model.json` の診断、`__proto__` / `constructor` / `prototype` の Prototype Pollution 防御。
  - `packages/core/src/camera`: L1（Collapsed 上限クランプ）/ L2 / L3 スマートジャンプ、`[`/`]` 兄弟巡回、Zoom Up。
  - `packages/core/src/export`: `</script><script>alert(1)</script>` や特殊改行を含むペイロードの安全エスケープ、`<title>` エスケープ。
  - `packages/cli`: `build` コマンドの事前レイアウト埋込、`--overrides`、`--strict` 終了コード。
- **E2E テスト（Playwright）**:
  - サンプルサイトで `c4-zoom` 自身を含むプリセット切替、L1→L2→L3 クイックジャンプ、兄弟巡回、検索＆Fly-to、`workspace.json` の D&D 読込、不正 JSON での Last-Known-Good 維持、外部 `url` の `javascript:` 拒否。
  - CLI が生成した単一 HTML を **`file://`（または静的ファイル）で開いて** コンソールエラーゼロ・ELK 計算待ちゼロで操作できること。
