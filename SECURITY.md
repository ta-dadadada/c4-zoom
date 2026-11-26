# Security Policy

## アーキテクチャ上のセキュリティ前提

**c4-zoom** は、すべてのモデル解析・レイアウト計算・Canvas 描画・単一 HTML 生成をユーザーのローカル環境またはブラウザ内で完結させる設計であり、読み込んだアーキテクチャモデルを外部サーバーへ送信することはありません。

主な防御対策：

- **単一 HTML 埋め込み時の XSS 防止**: ブートストラップ JSON シリアライズ時に `<`, `>`, `&`, `\u2028`, `\u2029` を Unicode エスケープし、`</script>` インジェクションを防止します。
- **外部 URL リンクの検証**: モデル要素の `url` プロパティは `http:` および `https:` スキームのみリンクとして許可し、`javascript:` や `data:` スキームは無効化します。
- **Prototype Pollution 防御**: JSON 内の任意プロパティ読込時に `__proto__`、`constructor`、`prototype` キーを無視します。
- **CSP（Content Security Policy）**: 出力される単一 HTML では外部ネットワーク通信を遮断する CSP を設定します。

## 脆弱性の報告

セキュリティ上の脆弱性を発見した場合は、公開 Issue には投稿せず、GitHub の **Private Vulnerability Reporting（Security Advisories）** からご報告ください。
再現手順・影響範囲・可能であれば最小の検証用 `workspace.json` を添えていただけると対応がスムーズです。
