# Structurizr DSL コア構文サポート仕様 (`docs/dsl-spec.md`)

**c4-zoom** は、既存の Structurizr DSL の記述習慣・資産を活かしながら、ブラウザ単体で高速にライブパース＆地図化できるよう、**Structurizr DSL のコア構文サブセット（`model` ブロック中心）** をサポートします。

---

## 1. 基本方針

1. **`views` を書かなくてよい**: `model` に定義された階層構造と関係線だけで、自動的に 1 枚の連続セマンティック・ズーム地図を生成します。
2. **既存 `.dsl` への寛容さ（Graceful Ignore）**: 本家 Structurizr 用の `.dsl` をそのまま貼り付けても壊れないよう、`views`, `styles`, `configuration`, `deploymentEnvironment`, `deploymentNode`, `!docs`, `!adrs`, `!components { ... }` などの未対応ブロックやディレクティブ（`{ ... }` を伴うブロック付きディレクティブを含む）はエラーにせず **安全にスキップ（情報/警告のみ記録）** します。
3. **キーワードの大文字・小文字非区別**: 公式サンプル（例：`big-bank-plc.dsl` の `softwaresystem`）に合わせ、キーワードはすべて **case-insensitive** として扱います。
4. **エラー耐性**: 読み込んだ `.dsl` ファイルに未閉じ波括弧や構文エラーがあってもアプリをクラッシュさせず、行・列番号付きの診断メッセージを返し、キャンバスは最後の正常な状態を維持します。

---

## 2. サポートする構文一覧

### 2.1 ワークスペースとモデル
```structurizr
workspace "CloudShop Platform" "ECおよび決済プラットフォームの全体構成" {
    model {
        // ここに要素と関係線を記述
    }
}
```
- `workspace` の名前・説明は省略可能。
- トップレベルに `workspace { ... }` が無く直接要素が書かれている場合もフォールバックで受け入れる設計とする（任意拡張）。

### 2.2 コメント
- 行コメント: `// ...` および `# ...`
- ブロックコメント: `/* ... */`

### 2.3 要素宣言と階層ネスト
識別子代入（`id = ...`）は任意です。省略した場合は要素名から正規化 ID を自動生成します。

```structurizr
// Level 1: アクター・外部/内部システム
customer = person "Customer" "Webまたはアプリから商品を購入する利用者" "External"

paymentGateway = softwareSystem "Stripe Payment Gateway" "外部決済プロバイダ" "External"

shop = softwareSystem "CloudShop" "ECプラットフォーム本体" {
    tags "Core"

    // 論理グループ（任意・複数ネスト可）
    group "Storefront" {
        webApp = container "Web Storefront" "Next.js 製のフロントエンド" "Next.js / TypeScript"
        mobileApp = container "Mobile App" "iOS / Android アプリ" "Flutter"
    }

    api = container "Commerce API" "注文・商品・認証を提供するAPIサーバー" "Go / Gin" {
        // Level 3: コンポーネント
        authHandler = component "Auth Handler" "JWT検証とセッション管理" "Go"
        orderService = component "Order Service" "注文作成・在庫引当オーケストレーション" "Go"
        paymentClient = component "Payment Client" "外部決済ゲートウェイ連携アダプタ" "Go / HTTPS"
    }

    db = container "Primary Database" "注文・商品・ユーザーデータの永続化" "PostgreSQL" "Database"
    queue = container "Event Bus" "注文確定イベントの非同期配信" "Kafka" "Queue"
}
```

#### 引数シグネチャ（Structurizr DSL 準拠）
| キーワード | 許可される親スコープ | 引数（すべて任意・位置ベース） |
| :--- | :--- | :--- |
| `person` | `model`, `group` | `<name> [description] [tags]` |
| `softwareSystem` | `model`, `group` | `<name> [description] [tags]` |
| `container` | `softwareSystem`, `group` | `<name> [description] [technology] [tags]` |
| `component` | `container`, `group` | `<name> [description] [technology] [tags]` |
| `group` | `model`, `softwareSystem`, `container`, `group` | `<name>` |

※ `tags` はカンマ区切り文字列（例: `"External,Legacy"`）をサポートします。

### 2.4 要素ブロック内プロパティ
各要素の `{ ... }` ブロック内で以下を記述できます。
- `description "<text>"`
- `technology "<text>"`
- `tags "<tag1,tag2>"` / `tag "<tag1>"`（単数形 `tag`・複数形 `tags`、およびスペース区切り複数引数に対応）
- `url "<https://...>"`
- `properties { <key> <value> ... }`
- `group "<name>"`（ブロック無しで要素の所属グループを指定する形式、例：`groups-nested.dsl`）

### 2.5 関係線（エッジ）宣言
```structurizr
// 明示的な source -> target
customer -> webApp "商品を閲覧・購入する" "HTTPS"
webApp -> authHandler "ログイン・認証リクエスト" "HTTPS / JSON"
orderService -> db "注文レコードを読み書き" "SQL / TCP"
orderService -> queue "OrderCreated イベント発行" "Kafka Protocol"
paymentClient -> paymentGateway "決済オーソリ・売上確定" "HTTPS / REST" {
    tags "Sync,Critical"
}
```

#### 引数シグネチャ
- `<source> -> <target> [description] [technology] [tags]`
- 関係線ブロック `{ tags ...; properties { ... } }` の記述もサポート。
- **ネスト内での暗黙的参照・自己参照（Implicit / `this` Relationship）**:
  - 要素ブロック内部で `-> target "desc" "tech"` と書かれた場合、`source` はその包含要素自身とみなします。
  - `source -> this` / `this -> target` のように `this` キーワードが使われた場合も、現在の包含要素へ解決します（例：`fixtures/dsl/upstream/this.dsl`）。
- **階層識別子の参照**:
  - フラットな識別子（`webApp`）に加え、`!identifiers hierarchical` 形式（`shop.api.orderService`）の両方を解決できるようシンボルテーブルを構築します。
- **カスタム要素 (`element`)**:
  - `custom = element "Name"` が記述された場合は、汎用要素（L1 ノード相当）またはフォールバック要素として扱い、参照先エッジが壊れないようにします。

---

## 3. 診断・警告仕様

パーサーは以下の `Diagnostic` 配列を返却します。

```ts
export interface DslDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line: number;   // 1-indexed
  column: number; // 1-indexed
}
```

| ケース | 重大度 | 挙動 |
| :--- | :--- | :--- |
| 構文エラー（未閉じ `}`、不正トークン等） | `error` | パース失敗として扱い、Last-Known-Good モデルを維持 |
| 未定義の識別子参照（`unknown -> api`） | `warning` | 該当エッジをスキップし、他の要素・エッジは正常描画 |
| 未対応ブロック（`views { ... }`, `styles { ... }` 等） | `info` | ブロックを安全に読み飛ばし、`model` のみ地図化 |
| 重複識別子 | `warning` | 警告を出しつつ後勝ちまたは自動サフィックスで処理 |

---

## 4. 内蔵サンプルプリセットおよび検証用フィクスチャ

テストおよびブラウザ動作確認に使用する具体的な `.dsl` ファイルは `fixtures/dsl/` に配置しています。一覧・出典・チェック観点は [docs/test-samples.md](./test-samples.md) を参照してください。

アプリ内の標準サンプルプリセットは以下の 4 本です。
1. **CloudShop Multi-System（デフォルト）**: `fixtures/dsl/custom/cloudshop-multi-system.dsl`（3つの内部システムすべてが L1〜L3 を持つ主力デモ）
2. **Big Bank plc（Structurizr 公式王道）**: `fixtures/dsl/upstream/big-bank-plc.dsl`（Apache-2.0 帰属表示付き）
3. **NovaBank Event Mesh**: `fixtures/dsl/custom/novabank-event-driven.dsl`（双方向エッジ・トレース検証向け）
4. **Getting Started（最小テンプレート）**: `fixtures/dsl/upstream/getting-started.dsl`
