# Structurizr 公式 `workspace.json` 入力仕様 (`docs/input-spec.md`)

**c4-zoom** は、DSL の構文解析を公式ツール（`structurizr-cli` 等）に委譲し、公式ツールが出力する **Structurizr `workspace.json`** を唯一の入力契約とします（[ADR 0007](./adr/0007-parser-maintenance-boundary-and-workspace-json-option.md)）。

---

## 1. 標準ワークフロー（DSL → JSON → 地図 / 単一 HTML）

```sh
# 1. 公式 Structurizr CLI で .dsl を workspace.json へ変換
structurizr-cli export -workspace workspace.dsl -format json -output ./out

# Docker を使う場合
docker run --rm -v "$PWD:/usr/local/structurizr" structurizr/cli \
  export -workspace workspace.dsl -format json -output ./out

# 2. c4-zoom CLI でスタンドアロン単一 HTML を生成
c4-zoom build ./out/workspace.json -o ./architecture.html
```

※ サンプルサイト（GitHub Pages）やローカル開発サーバー上では、生成した `workspace.json` をそのままブラウザへドラッグ＆ドロップ（またはファイル選択）して探索できます。

---

## 2. 公式 JSON → 正規化 `C4Workspace` マッピング仕様

`@c4-zoom/core/json` の `parseStructurizrWorkspaceJson(input)` は、Structurizr JSON スキーマを以下の通り `C4Workspace` へ変換します。

| 公式 JSON フィールド | 正規化 `C4Workspace` マッピング | 備考 |
| :--- | :--- | :--- |
| `name`, `description` | `workspace.name`, `workspace.description` | 省略時は `"Untitled Workspace"` 等へフォールバック |
| `model.properties["structurizr.groupSeparator"]` | グループ階層の区切り文字 | 既定値は `"/"` |
| `model.people[]` | `kind: 'person', level: 1` | `id`, `name`, `description`, `tags`, `url`, `properties`, `group` |
| `model.softwareSystems[]` | `kind: 'softwareSystem', level: 1` | `location === "External"` の場合は `"External"` タグを補完 |
| `...softwareSystems[].containers[]` | `kind: 'container', level: 2` | `technology` をマッピング |
| `...containers[].components[]` | `kind: 'component', level: 3` | `technology` をマッピング |
| `model.customElements[]` | `kind: 'element', level: 1` | 存在する場合にサポート |
| 各要素内の `relationships[]` | `C4Relationship[]` | `id`, `sourceId`, `destinationId` (`targetId`), `description`, `technology`, `tags`, `properties` |
| `model.deploymentNodes`, `views`, `documentation` | 無視（非エラー） | 描画対象外のため安全にスキップ |

---

## 3. エッジケースと変換ルール

1. **`tags` の正規化**:
   - 公式 JSON の `tags` はカンマ区切り文字列（例: `"Element,Software System,Existing System"`）。分割・前後トリム・空文字除去・重複排除を行って `string[]` 化する。
2. **フラット `group` 文字列からの階層ツリー再構築**:
   - 公式 JSON では `group` はネストオブジェクトではなく、各要素の `"group": "Organisation/Department A"` のような文字列プロパティとして格納される。
   - 同一親スコープ内で `groupSeparator` 分割して仮想 `group` ノード（`kind: 'group'`）を合成し、ELK 複合グラフの入れ子枠として正しく描画できるようにする。
3. **対象外 ID を参照する関係線の安全スキップ**:
   - `deploymentNode` や `containerInstance` 等を参照する関係線は、モデル要素集合に存在しないためエラーにせずスキップし、`info` 診断を記録する。
4. **関係線の重複排除**:
   - 公式 JSON で各要素配下に格納された `relationships[]` は `id` 基準で重複排除する。
5. **外部リンク（`url`）の安全性**:
   - モデル上は文字列として保持し、UI でリンク描画する際に **`http:` / `https:` プロトコルのみ許可** する（`javascript:` / `data:` 等は無効化）。
6. **Prototype Pollution / 異常入力防御**:
   - `properties` の展開時に `__proto__` / `constructor` / `prototype` キーを無視する（`Object.hasOwn` / `Object.create(null)` ベース）。
   - 異常に巨大なファイルや循環親子参照に対して安全なガードを設ける。

---

## 4. 診断仕様と Last-Known-Good 原則

```ts
export interface WorkspaceDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  path?: string;   // JSON パス（例: "model.softwareSystems[0]"）
  line?: number;   // 取得可能な場合の 1-indexed 行番号
  column?: number; // 取得可能な場合の 1-indexed 列番号
}
```

| ケース | 重大度 | 挙動 |
| :--- | :--- | :--- |
| JSON 構文エラー（`JSON.parse` 失敗） | `error` | 読み込み失敗とし、キャンバスは直前の正常モデル（Last-Known-Good）を維持 |
| ルートがオブジェクトでない / `model` 欠落 | `error` | 読み込み失敗とし、Last-Known-Good を維持 |
| モデル外 ID（デプロイメント要素等）への関係線 | `info` | 該当エッジをスキップして他要素を正常描画 |
| 重複要素 ID / 欠落した必須名 | `warning` | フォールバックしつつ警告診断を記録 |
