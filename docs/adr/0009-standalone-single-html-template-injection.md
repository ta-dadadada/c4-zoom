# 0009: ビルド済み単一 HTML テンプレートへの事前レイアウト済み JSON ペイロード注入方式

- **Status**: Accepted
- **Date**: 2026-11-27

## Context

c4-zoom をチーム共有・CI/CD・PR レビューで実用的に使うには、Web サーバーを用意せずに **「1 枚のスタンドアロン HTML ファイル（`architecture.html`）として吐き出し、`file://` でダブルクリックして開くだけで即座に探索できる」** 配布形態が求められる。また、サンプルサイト上からも現在表示中の地図（手動微調整オフセット込み）を単一 HTML として書き出したい。

この際、以下の技術的課題を同時に解決する必要がある：
1. CLI 実行ごとに Vite バンドルを回すと遅く、実行環境に Vite/esbuild 依存を持ち込むことになる。
2. ブラウザの `file://` オリジンでは、通常の外部モジュール Web Worker（`new Worker(new URL(..., import.meta.url))`）がセキュリティ制約で起動失敗する。
3. 任意の `workspace.json` を HTML 内に埋め込むため、`</script>` ブレイクアウトによる XSS リスクを完全に防ぐ必要がある。

## Decision

**`@c4-zoom/viewer` を事前に単一 HTML テンプレート（`viewer-template.html`）としてビルドしておき、CLI およびブラウザ Export から正規化ペイロード JSON を安全に注入する「テンプレート注入方式」を採用する。**

1. **単一 HTML テンプレートの事前ビルド**:
   - `@c4-zoom/viewer` で `vite-plugin-singlefile` を用い、JS・CSS をすべてインライン化した `dist/template/viewer-template.html` をビルド成果物として生成する。
2. **ブートストラップペイロード注入 (`<script id="c4-zoom-bootstrap" type="application/json">`)**:
   - 正規化済み `C4Workspace`、`precomputedLayout`（CLI / ブラウザで事前計算済みの `PositionedGraph`）、`layoutOverrides`、`theme`、`mode: 'standalone'` を埋め込む。
   - シリアライズ時は必ず `<`, `>`, `&`, `\u2028`, `\u2029` を `\uXXXX` へエスケープし、`<title>` も HTML エスケープする。
3. **`file://` での Web Worker 回避と 0ms 初期描画**:
   - 起動時に `precomputedLayout` が存在する場合は ELK / Web Worker を起動せず、そのまま初回フレームを即時描画する。
   - 単一 HTML 上で動的に別 JSON を再読込する場合（`allowFileDrop` 有効時等）は、外部モジュール Worker を使わずメインスレッド非同期またはインラインフォールバックでレイアウトを実行する。
4. **ブラウザ側 Export の 2 経路**:
   - Standalone HTML 自身を開いているときは DOM クローンによる自己複製で再 Export する。
   - サンプルサイト（通常 SPA）からは、静的アセットとして配置した `viewer-template.html` をオンデマンド `fetch` してペイロードを注入しダウンロードする。

## Alternatives Considered

- **CLI 実行時に毎回 Vite をプログラマティック実行してモデルをバンドルする**:
  - 1 回の生成に数秒かかり、CLI パッケージに Vite ビルドツール一式を同梱する必要が出るため不採用。
- **SPA の URL クエリ／ハッシュ（Base64 圧縮）でモデルを共有する**:
  - 大規模モデルで URL 長制限に引っかかりやすく、オフライン配布や PR アーティファクト保存に向かないため不採用。

## Consequences

- **メリット**:
  - CLI の単一 HTML 生成が文字列注入＋ELK 計算のみで極めて高速に完了し、出力 HTML は `file://` でも完全オフライン・0ms 初期表示で動作する。
  - CLI とブラウザ Export が共通の `@c4-zoom/core/export` ロジックを共有できる。
  - 外部ネットワーク通信ゼロの CSP（`default-src 'none'` ベース）を単一 HTML に適用でき、社内モデルの共有安心感が高い。
- **トレードオフ・注意点**:
  - `viewer-template.html` は React + Canvas エンジン +（動的再計算時の）`elkjs` を含むため出力サイズが数百 KB〜数 MB になる（将来的に `precomputedLayout` 専用の `elkjs` 抜き軽量テンプレートを追加する余地あり）。
  - 単一 HTML の `file://` 動作および XSS エスケープは自動テスト（Vitest + Playwright）で継続検証する。
