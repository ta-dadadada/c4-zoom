# c4-zoom

**Structurizr 公式 `workspace.json` を、地図アプリのような連続セマンティック・ズームで自由に探索でき、そのまま 1 枚のスタンドアロン HTML として配布できる C4 アーキテクチャマップビューア。**

従来の C4 ツールが「個別ビュー（Context 図 / Container 図 / Component 図）間のページ切り替え」を基本とするのに対し、**c4-zoom** は `model` の入れ子構造から **1 枚の連続した空間地図** を自動生成します。DSL の構文解析は公式 [Structurizr](https://docs.structurizr.com/export) に委譲して 100% 公式互換の `workspace.json` を入力とし、サーバー不要・完全オフラインで動く単一 HTML として共有できます。

## 主な特徴

- **連続セマンティック・ズーム（空間入れ子 + LOD）**: 1 枚のキャンバスに `System ⊃ Container ⊃ Component` が入れ子配置され、ズーム倍率と画面上のサイズに応じて詳細度（枠・中身・ラベル）が滑らかに変化します
- **C4 レベル単位のクイックジャンプ**: `1` / `2` / `3` やレベル別クイックジャンパーで L1（Context）/ L2（Container）/ L3（Component）の最適視点へ 1 アクションで Fly-to し、`[` / `]` で兄弟要素を巡回できます
- **関係線の動的ロールアップ＆トレース**: 詳細レベルのエッジを現在見えている階層へ自動集約します。ノード選択時は上流・下流の依存経路をハイライトできます
- **公式 Structurizr `workspace.json` 一本化**: 公式の `export -format json` 出力をそのまま読み込み、`!include` / `!extend` / `!script` / `!components` 等を含むフル仕様モデルに対応します
- **単一 HTML 出力（CLI & ブラウザ Export）**: 事前レイアウト済みの 1 枚 HTML を出力し、サーバー不要・`file://` 直開きで PR や Slack・社内ポータルへそのまま共有できます
- **ブラウザ完結・外部送信なし**: モデルの解析・描画・HTML 書き出しはすべてローカル／ブラウザ内で完結し、アーキテクチャ情報を外部サーバーへ送信しません（詳細は [SECURITY.md](./SECURITY.md)）

## サンプルサイト（デモ）

GitHub Pages で公開するサンプルサイトでは、**c4-zoom 自身の C4 アーキテクチャ** をはじめとする複数のサンプルモデルを切り替えてそのまま探索できます。手元の `workspace.json` をブラウザへドラッグ＆ドロップして試し、そのまま単一 HTML として書き出すこともできます。

## 使い方（DSL → 公式 JSON → 単一 HTML）

DSL から `workspace.json` への変換は公式 [Structurizr `export` ドキュメント](https://docs.structurizr.com/export) に従ってください。c4-zoom 側のビルド・CLI 実行には Node.js 26 以上と pnpm 10 以上が必要です。

```sh
# 1. 公式 Structurizr で .dsl を workspace.json へ変換（Docker の例）
docker run --rm -v "$PWD:/usr/local/structurizr" structurizr/structurizr \
  export -workspace workspace.dsl -format json -output ./out

# 2. リポジトリのセットアップとビルド（初回のみ）
pnpm install --frozen-lockfile
pnpm build

# 3. c4-zoom CLI でスタンドアロン単一 HTML を生成
pnpm c4-zoom build ./out/workspace.json -o ./architecture.html
```

生成された `architecture.html` はブラウザで直接開くだけで完全オフライン動作します。オプション一覧は `pnpm c4-zoom build --help` で確認できます。

## 基本操作・ショートカット

| 操作 / キー | 動作 |
| :--- | :--- |
| ドラッグ / ホイール・ピンチ | 地図のパン・カーソル中心の連続ズーム |
| ノードをクリック / ダブルクリック | 詳細インスペクタ表示＆上流・下流トレース / 対象へ Fly-to |
| `⌘K` / `Ctrl+K` / `/` | スポット検索（名前・説明・技術・タグ） |
| `0` | 地図全体へフィット |
| `1` / `2` / `3` | L1（Context）/ L2（Container）/ L3（Component）最適視点へ Fly-to |
| `[` / `]` | 現在のレベル内で前／次の System・Container を巡回 |
| `Backspace` | 1 階層上へ Zoom Up |
| `Alt / Option + ドラッグ` | ノード配置の手動微調整（配置調整モードでも操作可能） |
| `Esc` | ポップオーバー閉じ / 選択解除 |

## ドキュメント

- **開発・検証・公開手順**: [docs/development.md](./docs/development.md)（ローカル開発、テスト、Git フック、GitHub Pages 公開、パッケージ構成）
- **詳細設計**: [docs/design.md](./docs/design.md)
- **入力仕様（Structurizr `workspace.json`）**: [docs/input-spec.md](./docs/input-spec.md)
- **c4-zoom 自身の C4 モデル**: [docs/architecture/workspace.dsl](./docs/architecture/workspace.dsl)
- **Architecture Decision Records**: [docs/adr/README.md](./docs/adr/README.md)
- **セキュリティポリシー**: [SECURITY.md](./SECURITY.md)

## ライセンス

本体は [MIT License](./LICENSE) です。Structurizr 公式フィクスチャとその JSON 変換版は [Apache License 2.0](./fixtures/dsl/upstream/LICENSE-Apache-2.0.txt) です。
