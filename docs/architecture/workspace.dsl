workspace "c4-zoom" "Structurizr 公式 workspace.json を連続セマンティック・ズームで探索・単一 HTML 配布できる C4 マップビューア自身のアーキテクチャ" {

    !identifiers hierarchical

    model {
        // Level 1: アクター
        architect = person "Developer / Architect" "Structurizr DSL を書き、JSON 変換して c4-zoom で可視化・単一 HTML を配布する作成者" "External"
        reader = person "Architecture Reader" "配布された単一 HTML または GitHub Pages サンプルサイトでアーキテクチャを探索する閲覧者" "External"

        // Level 1: 外部システム
        structurizrCli = softwareSystem "Structurizr CLI" "Structurizr DSL を公式仕様で workspace.json へ変換する外部公式ツール" "External" {
            url "https://docs.structurizr.com/cli"
        }
        githubPages = softwareSystem "GitHub Pages" "サンプルサイト（デモ用静的アセット）を配信する外部ホスティング基盤" "External"
        localFs = softwareSystem "Local File System" "workspace.json や生成済み単一 HTML ファイルを保存するローカル領域" "External"
        browserStorage = softwareSystem "Browser localStorage" "手動レイアウト調整差分・テーマ・直近読込状態を保持するブラウザ領域" "External"

        // Level 1: c4-zoom 本体（pnpm workspace モノレポ）
        c4Zoom = softwareSystem "c4-zoom" "公式 Structurizr JSON を 1 枚の連続地図として探索・単一 HTML 出力できる C4 マッププラットフォーム" "Core" {

            // Level 2: @c4-zoom/core
            core = container "Core Map Engine (@c4-zoom/core)" "React/Node非依存の純粋TypeScript製JSON変換・レイアウト・LOD・Canvas 2D描画・HTML埋込エンジン" "Pure TypeScript / elkjs" {
                group "Input & Graph Pipeline" {
                    jsonAdapter = component "Structurizr JSON Adapter" "公式 workspace.json を C4Workspace へ正規化（group再構築・Prototype Pollution防御・診断生成）" "TypeScript"
                    c4Graph = component "Canonical C4 Graph & Tracer" "親子探索・循環安全な上流/下流トレース（1-hop / Transitive）" "TypeScript"
                }

                group "Spatial Layout Pipeline" {
                    elkAdapter = component "ELK Layout Adapter" "ELK.js による決定的な階層（Compound Graph）自動配置" "TypeScript / elkjs"
                    offsetMerger = component "Manual Offset Merger" "手動ドラッグ差分を非破壊適用し親境界を自動調整" "TypeScript"
                }

                group "Semantic Zoom & Rendering Pipeline" {
                    cameraController = component "Camera & Level-Jump Controller" "座標変換・カーソル基準ズーム・慣性パン・放物線 Fly-to・L1/L2/L3 クイックジャンプ計算" "TypeScript"
                    lodEvaluator = component "Semantic Zoom LOD Evaluator" "画面占有サイズに基づく smoothstep 展開度と支配レベル判定" "TypeScript"
                    edgeRollup = component "Dynamic Edge Rollup Engine" "可視アンカー射影・重複エッジ集約・双方向カーブ分離・メモ化" "TypeScript"
                    hitTester = component "Hit Tester & Frustum Culler" "Zオーダー考慮の要素/エッジ判定とビューポート外カリング" "TypeScript"
                    canvasRenderer = component "Canvas 2D Cartography Renderer" "HiDPI 60fps カートグラフィー描画・ラベル衝突回避・トレースパルス" "TypeScript / Canvas 2D"
                }

                group "Single-HTML Export Pipeline" {
                    htmlExporter = component "Single-HTML Payload Serializer" "XSS安全エスケープ付きブートストラップJSON生成とHTMLテンプレート注入" "TypeScript"
                }
            }

            // Level 2: @c4-zoom/viewer
            viewer = container "Interactive Map Viewer (@c4-zoom/viewer)" "React + Tailwind v4 の探索UIアプリ（通常SPAビルド＋単一HTMLテンプレート出力）" "React 19 / TypeScript / Tailwind CSS v4" "Web Browser" {
                bootstrapLoader = component "Bootstrap Loader" "#c4-zoom-bootstrap を読み取り Standalone / Sample Site モードと precomputedLayout を初期化" "TypeScript"
                stateBridge = component "AppState Context & Ref Bridge" "低頻度UI状態（useReducer）と 60fps 高頻度ランタイム状態（Ref）の二層管理・永続化" "React / TypeScript"
                layoutRunner = component "Layout Execution Bridge" "precomputedLayout 時 0ms スキップ、動的読込時は Worker / file:// 安全フォールバックを実行" "TypeScript / Web Worker"
                mapCanvasHost = component "MapCanvas Host" "Canvas 2D の rAF ループ・ResizeObserver・ポインタ/ホイール/キーボード入力統括" "React"
                searchBar = component "SearchBar" "スポット検索（Cmd+K / /）と候補選択による Fly-to 起動" "React"
                breadcrumbs = component "Breadcrumbs" "現在のビューポート中央の階層パス表示とクリック／Zoom Up 移動" "React"
                zoomControls = component "ZoomControls & Level Jumper" "L1/L2/L3 スマートジャンプ・対象一覧ポップオーバー・兄弟巡回・配置調整/テーマ切替" "React"
                minimapUi = component "Minimap" "全体俯瞰サムネイル描画とドラッグによるカメラ移動" "React / Canvas 2D"
                inspectorUi = component "Inspector" "選択要素/エッジの詳細（http/https検証済みURL含む）と上流・下流トレース一覧" "React"
                sourceControls = component "SourceControls & HTML Exporter" "サンプル切替・workspace.json 読込（D&D/選択）・診断表示・単一HTMLダウンロード" "React"
            }

            // Level 2: @c4-zoom/cli
            cli = container "Standalone HTML CLI (@c4-zoom/cli)" "workspace.json を事前レイアウト済み単一 HTML へ変換する Node.js CLI" "Node.js / TypeScript" {
                cliArgs = component "CLI Argument Parser" "build コマンド引数・オプション（-o, --prelayout, --overrides, --theme, --strict等）解析" "TypeScript"
                workspaceLoader = component "Workspace File/Stdin Loader" "ローカルファイルまたは標準入力から workspace.json と任意オフセットJSONを読み込む" "Node.js fs"
                preLayoutRunner = component "Pre-Layout Runner" "Node.js 上で ELK レイアウトを事前計算し PositionedGraph を生成" "TypeScript"
                templateInjector = component "Template Injector" "viewer-template.html へブートストラップペイロードを注入し単一 HTML を書き出す" "Node.js fs"
            }

            // Level 2: GitHub Pages サンプルサイト
            sampleSite = container "GitHub Pages Sample Site" "c4-zoom 自身を含む複数サンプルを自由に探索・JSON D&D・HTML出力できる公開デモサイト" "Static Web App / Bundled JSON Samples" "Web Browser"
        }

        // --- アクター起点 ---
        architect -> structurizrCli "workspace.dsl を公式 workspace.json へ変換する" "CLI / Docker"
        structurizrCli -> localFs "workspace.json を出力する" "File I/O"
        architect -> c4Zoom.cli.cliArgs "c4-zoom build で単一 HTML を生成する" "CLI"
        architect -> c4Zoom.sampleSite "デモ確認や手元 JSON の試行を行う" "HTTPS"

        reader -> c4Zoom.sampleSite "c4-zoom 自身や各種サンプルをブラウザで探索する" "HTTPS"
        reader -> localFs "配布された単一 HTML をブラウザで直接開く" "file:// / HTTPS"
        reader -> c4Zoom.viewer.mapCanvasHost "パン・連続ズーム・ノード選択・トレースを行う" "Mouse / Trackpad / Keyboard"
        reader -> c4Zoom.viewer.searchBar "要素名・技術・タグでスポット検索する" "Keyboard (Cmd+K)"
        reader -> c4Zoom.viewer.zoomControls "L1/L2/L3 クイックジャンプや兄弟巡回を行う" "Click / 1-3 / [ ]"
        reader -> c4Zoom.viewer.inspectorUi "詳細情報や上流・下流の接続先へジャンプする" "Click"
        reader -> c4Zoom.viewer.minimapUi "俯瞰位置を確認しドラッグで移動する" "Click / Drag"
        reader -> c4Zoom.viewer.breadcrumbs "現在地確認・1階層上へ戻る" "Click / Backspace"
        reader -> c4Zoom.viewer.sourceControls "サンプル切替・workspace.json D&D・単一HTML書き出しを行う" "Click / Drag & Drop"

        // --- ホスティング・外部I/O ---
        githubPages -> c4Zoom.sampleSite "ビルド済みサンプルサイトと viewer-template.html を配信する" "HTTPS"
        c4Zoom.sampleSite -> c4Zoom.viewer.bootstrapLoader "Interactive モード＋内蔵サンプルJSON群でビューアを起動する"
        c4Zoom.viewer.sourceControls -> localFs "workspace.json の読込および単一 HTML のダウンロード保存を行う" "File API / Blob"
        c4Zoom.viewer.stateBridge -> browserStorage "手動オフセット・UI設定を保存/復元する" "Web Storage API"

        // --- CLI パイプライン ---
        c4Zoom.cli.cliArgs -> c4Zoom.cli.workspaceLoader "入力パス・オプションを渡す"
        c4Zoom.cli.workspaceLoader -> localFs "workspace.json と overrides JSON を読み込む" "fs/promises"
        c4Zoom.cli.workspaceLoader -> c4Zoom.core.jsonAdapter "JSON 文字列の正規化と診断検証を依頼する"
        c4Zoom.cli.workspaceLoader -> c4Zoom.cli.preLayoutRunner "正規化済み C4Workspace を渡す"
        c4Zoom.cli.preLayoutRunner -> c4Zoom.core.elkAdapter "事前自動レイアウトを計算する"
        c4Zoom.cli.preLayoutRunner -> c4Zoom.core.offsetMerger "指定された手動オフセットを適用する"
        c4Zoom.cli.preLayoutRunner -> c4Zoom.cli.templateInjector "workspace + precomputedLayout を渡す"
        c4Zoom.cli.templateInjector -> c4Zoom.core.htmlExporter "XSS安全シリアライズとテンプレート注入を実行する"
        c4Zoom.cli.templateInjector -> localFs "完成した単一 HTML ファイルを書き出す" "fs/promises"

        // --- Viewer 内部連携 ---
        c4Zoom.viewer.bootstrapLoader -> c4Zoom.viewer.stateBridge "初期モデル・precomputedLayout・モード・テーマを投入する"
        c4Zoom.viewer.sourceControls -> c4Zoom.core.jsonAdapter "D&D/選択された workspace.json をパースする"
        c4Zoom.viewer.sourceControls -> c4Zoom.core.htmlExporter "現在の地図と手動オフセットを単一 HTML へシリアライズする"
        c4Zoom.viewer.sourceControls -> c4Zoom.viewer.stateBridge "更新モデルと診断結果を通知する"
        c4Zoom.viewer.stateBridge -> c4Zoom.viewer.layoutRunner "レイアウト未計算モデルの配置計算を依頼する"
        c4Zoom.viewer.layoutRunner -> c4Zoom.core.elkAdapter "ELK レイアウト計算を実行する"
        c4Zoom.viewer.layoutRunner -> c4Zoom.core.offsetMerger "手動オフセットを非破壊適用する"
        c4Zoom.viewer.stateBridge -> c4Zoom.core.c4Graph "選択ノードの上流・下流トレースを算出する"

        c4Zoom.viewer.searchBar -> c4Zoom.viewer.stateBridge "検索結果への Fly-to を要求する"
        c4Zoom.viewer.breadcrumbs -> c4Zoom.viewer.stateBridge "親階層への Fly-to / Zoom Up を要求する"
        c4Zoom.viewer.zoomControls -> c4Zoom.viewer.stateBridge "L1/L2/L3 ジャンプ・兄弟巡回・編集モード・テーマ切替を通知する"
        c4Zoom.viewer.minimapUi -> c4Zoom.viewer.stateBridge "カメラ位置の同期とドラッグ移動を行う"
        c4Zoom.viewer.inspectorUi -> c4Zoom.viewer.stateBridge "トレースモード切替と接続先 Fly-to を要求する"
        c4Zoom.viewer.mapCanvasHost -> c4Zoom.viewer.stateBridge "毎フレームのRef読み書き・選択・スロットルHUD同期を行う"

        // --- Viewer <-> Core レンダリングパイプライン ---
        c4Zoom.viewer.mapCanvasHost -> c4Zoom.core.cameraController "パン・ズーム・Fly-to・レベルジャンプ補間を進める"
        c4Zoom.viewer.mapCanvasHost -> c4Zoom.core.hitTester "カーソル座標の要素・エッジ判定を依頼する"
        c4Zoom.viewer.mapCanvasHost -> c4Zoom.core.canvasRenderer "毎フレームの地図シーンを描画する"

        c4Zoom.core.jsonAdapter -> c4Zoom.core.c4Graph "正規化 C4Workspace を生成する"
        c4Zoom.core.canvasRenderer -> c4Zoom.core.cameraController "ワールド↔スクリーン座標変換を参照する"
        c4Zoom.core.canvasRenderer -> c4Zoom.core.lodEvaluator "各要素の detailAlpha と支配レベルを取得する"
        c4Zoom.core.canvasRenderer -> c4Zoom.core.edgeRollup "可視階層へ集約済みの DisplayEdge 群を取得する"
        c4Zoom.core.canvasRenderer -> c4Zoom.core.hitTester "ビューポートカリング済み可視集合を参照する"
        c4Zoom.core.edgeRollup -> c4Zoom.core.lodEvaluator "展開状態を参照して有効アンカーを決定する"
        c4Zoom.core.hitTester -> c4Zoom.core.lodEvaluator "展開状態に応じた最深ヒット要素を判定する"
    }

    views {
        systemContext c4Zoom "SystemContext" {
            include *
            autoLayout
        }

        container c4Zoom "Containers" {
            include *
            autoLayout
        }

        component c4Zoom.core "CoreComponents" {
            include *
            autoLayout
        }

        component c4Zoom.viewer "ViewerComponents" {
            include *
            autoLayout
        }

        component c4Zoom.cli "CliComponents" {
            include *
            autoLayout
        }
    }
}
