// 構文エラー・診断・Last-Known-Good維持の検証用フィクスチャ
// 期待挙動:
// - 未定義識別子参照に対して warning を出しつつ他要素を保持（構文修正時）
// - 末尾の未閉じ波括弧に対して error（行・列番号付き）を返し、キャンバスは直前の正常モデルを維持
workspace "Broken Syntax Sample" {
    model {
        u = person "User"
        s = softwareSystem "Broken System" {
            api = container "API" "説明テキスト" "Go"
            // 意図的に閉じ括弧が不足している状態
            u -> api "Calls"
            u -> missingTarget "Unresolved reference"
        }
    // model と workspace の閉じ括弧が欠落
