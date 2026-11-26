workspace "c4-zoom" "Structurizr DSL を連続セマンティック・ズームで探索するブラウザ完結型 C4 マップビューア自身のアーキテクチャ" {

    !identifiers hierarchical

    model {
        // Level 1: アクター・外部システム
        architect = person "Developer / Architect" "システム構成を地図のように俯瞰・ズーム探索して理解する利用者" "External"

        localFs = softwareSystem "Local File System" "ユーザーが管理する .dsl ファイル群（D&D / ファイル選択で読込）" "External"
        browserStorage = softwareSystem "Browser localStorage" "手動レイアウト調整差分・テーマ・最後に読み込んだDSLを保存するブラウザ領域" "External"

        // Level 1: c4-zoom 本体
        c4Zoom = softwareSystem "c4-zoom" "ブラウザ完結型の連続セマンティック・ズーム C4 マップビューア" "Core" {

            // Level 2: フローティング UI オーバーレイ層
            webUi = container "Floating Map UI" "画面四隅のガラス調フローティング操作UIとCanvasホスト" "React / TypeScript / Tailwind CSS v4" "Web Browser" {
                mapCanvasHost = component "MapCanvas Host" "Canvas 2D の rAF ループ・ResizeObserver・ポインタ/ホイール/キー入力を統括" "React"
                searchBar = component "SearchBar" "スポット検索（Cmd+K / /）と候補選択による Fly-to 起動" "React"
                breadcrumbs = component "Breadcrumbs" "現在のビューポート中央の階層パス表示とクリック移動" "React"
                zoomControls = component "ZoomControls" "L1/L2/L3 ズームレベル計・Fit・配置調整モード・テーマ切替" "React"
                minimapUi = component "Minimap" "全体俯瞰サムネイル描画とドラッグによるカメラ移動" "React / Canvas 2D"
                inspectorUi = component "Inspector" "選択要素/エッジの詳細メタデータと上流・下流トレース一覧" "React"
                sourceControls = component "SourceControls" "サンプル切替・.dsl ファイル読込（D&D / ファイル選択）・診断ポップオーバー" "React"
            }

            // Level 2: アプリケーション状態管理層
            stateLayer = container "Application State & Persistence" "UI状態管理・高頻度Canvas状態のRef隔離・Last-Known-Good保持" "React Context / useReducer / Ref" {
                appReducer = component "AppState Reducer & Context" "選択状態・トレースモード・診断・レイアウト編集モード・テーマの管理" "TypeScript / React"
                runtimeBridge = component "Canvas Runtime Ref Bridge" "60fps カメラ・アニメーション・ホバー状態をReact再描画なしで共有" "TypeScript"
                storageAdapter = component "Persistence Adapter" "localStorage へのレイアウトオフセットとUI設定の保存・復元" "TypeScript"
            }

            // Level 2: フレームワーク非依存コアエンジン層
            coreEngine = container "Core Map Engine" "React非依存の純粋TypeScript製DSLパース・レイアウト・LOD・Canvas描画エンジン" "Pure TypeScript" {
                group "DSL & Model Pipeline" {
                    dslLexer = component "DSL Lexer" "コメント・文字列・階層識別子・演算子をトークン化" "TypeScript"
                    dslParser = component "Structurizr DSL Parser" "コア構文の再帰下降パース・未対応ブロック安全スキップ・診断生成" "TypeScript"
                    c4Graph = component "Canonical C4 Graph & Tracer" "親子探索・循環安全な上流/下流トレース（1-hop / Transitive）" "TypeScript"
                }

                group "Spatial Layout Pipeline" {
                    elkAdapter = component "ELK Layout Adapter" "ELK.js による決定的な階層（Compound Graph）自動配置" "TypeScript / elkjs"
                    offsetMerger = component "Manual Offset Merger" "手動ドラッグ差分を非破壊適用し親境界を自動調整" "TypeScript"
                }

                group "Semantic Zoom & Rendering Pipeline" {
                    cameraController = component "Camera & Fly-to Controller" "座標変換・カーソル基準ズーム・慣性パン・放物線 Fly-to 補間" "TypeScript"
                    lodEvaluator = component "Semantic Zoom LOD Evaluator" "画面占有サイズに基づく smoothstep 展開度と支配レベル判定" "TypeScript"
                    edgeRollup = component "Dynamic Edge Rollup Engine" "可視アンカー射影・重複エッジ集約・双方向カーブ分離・メモ化" "TypeScript"
                    hitTester = component "Hit Tester & Frustum Culler" "Zオーダー考慮の要素/エッジ判定とビューポート外カリング" "TypeScript"
                    canvasRenderer = component "Canvas 2D Cartography Renderer" "HiDPI 60fps カートグラフィー描画・ラベル衝突回避・トレースパルス" "TypeScript / Canvas 2D"
                }
            }

            // Level 2: 内蔵サンプルプリセット
            sampleRegistry = container "Built-in Sample Registry" "CloudShop / Big Bank plc / NovaBank 等の初期探索サンプル集" "Structurizr DSL Assets"
        }

        // --- ユーザー起点 ---
        architect -> c4Zoom.webUi.mapCanvasHost "パン・連続ズーム・ノード選択・配置微調整を行う" "Mouse / Trackpad / Keyboard"
        architect -> c4Zoom.webUi.searchBar "要素名・技術・タグでスポット検索する" "Keyboard (Cmd+K)"
        architect -> c4Zoom.webUi.sourceControls "サンプル切替や .dsl ファイルのD&D読込を行う" "Click / Drag & Drop"
        architect -> c4Zoom.webUi.inspectorUi "詳細情報や上流・下流の依存先を確認・ジャンプする" "Click"
        architect -> c4Zoom.webUi.minimapUi "俯瞰位置を確認しドラッグで移動する" "Click / Drag"
        architect -> c4Zoom.webUi.zoomControls "L1/L2/L3切替・Fit・テーマ切替を行う" "Click"
        architect -> c4Zoom.webUi.breadcrumbs "現在地を確認し親階層へ戻る" "Click"

        // --- 外部I/O ---
        c4Zoom.webUi.sourceControls -> localFs ".dsl ファイルを読み込む" "File API"
        c4Zoom.webUi.sourceControls -> c4Zoom.sampleRegistry "内蔵サンプルDSLを取得する"
        c4Zoom.stateLayer.storageAdapter -> browserStorage "手動オフセット・UI設定・直近DSLを保存/復元する" "Web Storage API"

        // --- UI <-> State ---
        c4Zoom.webUi.sourceControls -> c4Zoom.stateLayer.appReducer "読み込んだDSLテキストと診断結果を更新する"
        c4Zoom.webUi.searchBar -> c4Zoom.stateLayer.runtimeBridge "対象ノードへの Fly-to を要求する"
        c4Zoom.webUi.breadcrumbs -> c4Zoom.stateLayer.runtimeBridge "選択階層への Fly-to を要求する"
        c4Zoom.webUi.zoomControls -> c4Zoom.stateLayer.runtimeBridge "ズーム操作・Fit を要求する"
        c4Zoom.webUi.zoomControls -> c4Zoom.stateLayer.appReducer "レイアウト編集モード・テーマを切り替える"
        c4Zoom.webUi.minimapUi -> c4Zoom.stateLayer.runtimeBridge "カメラ位置の同期と移動を行う"
        c4Zoom.webUi.inspectorUi -> c4Zoom.stateLayer.appReducer "選択状態・トレースモード（1-hop/Transitive）を参照・切替する"
        c4Zoom.webUi.inspectorUi -> c4Zoom.stateLayer.runtimeBridge "接続先ノードへの Fly-to を要求する"
        c4Zoom.webUi.mapCanvasHost -> c4Zoom.stateLayer.appReducer "クリック選択・オフセット確定・スロットルHUD更新を通知する"
        c4Zoom.webUi.mapCanvasHost -> c4Zoom.stateLayer.runtimeBridge "毎フレームのカメラ・ホバー状態を読み書きする"

        // --- State <-> Core Engine ---
        c4Zoom.stateLayer.appReducer -> c4Zoom.coreEngine.dslParser "DSLテキストのパースを実行する"
        c4Zoom.stateLayer.appReducer -> c4Zoom.coreEngine.elkAdapter "正常パース後のモデルから自動レイアウトを算出する"
        c4Zoom.stateLayer.appReducer -> c4Zoom.coreEngine.offsetMerger "自動レイアウト結果へ手動オフセットを適用する"
        c4Zoom.stateLayer.appReducer -> c4Zoom.coreEngine.c4Graph "選択ノードの上流・下流トレースを計算する"
        c4Zoom.stateLayer.appReducer -> c4Zoom.stateLayer.storageAdapter "設定・オフセット変更を永続化する"

        // --- Core Engine 内部パイプライン ---
        c4Zoom.coreEngine.dslParser -> c4Zoom.coreEngine.dslLexer "トークン列を生成する"
        c4Zoom.coreEngine.dslParser -> c4Zoom.coreEngine.c4Graph "正規化 C4Workspace モデルを構築する"
        c4Zoom.coreEngine.elkAdapter -> c4Zoom.coreEngine.offsetMerger "初期配置済みグラフを受け渡す"

        c4Zoom.webUi.mapCanvasHost -> c4Zoom.coreEngine.cameraController "入力イベントからカメラ更新・Fly-to補間を進める"
        c4Zoom.webUi.mapCanvasHost -> c4Zoom.coreEngine.hitTester "カーソル座標の要素・エッジ判定を依頼する"
        c4Zoom.webUi.mapCanvasHost -> c4Zoom.coreEngine.canvasRenderer "毎フレームのシーン描画を実行する"

        c4Zoom.coreEngine.canvasRenderer -> c4Zoom.coreEngine.cameraController "ワールド↔スクリーン座標変換を参照する"
        c4Zoom.coreEngine.canvasRenderer -> c4Zoom.coreEngine.lodEvaluator "各要素の detailAlpha と支配レベルを取得する"
        c4Zoom.coreEngine.canvasRenderer -> c4Zoom.coreEngine.edgeRollup "可視階層へ集約済みの DisplayEdge 群を取得する"
        c4Zoom.coreEngine.canvasRenderer -> c4Zoom.coreEngine.hitTester "ビューポートカリング済み可視集合を参照する"
        c4Zoom.coreEngine.edgeRollup -> c4Zoom.coreEngine.lodEvaluator "要素ごとの展開状態を参照してアンカーを決定する"
        c4Zoom.coreEngine.hitTester -> c4Zoom.coreEngine.lodEvaluator "展開状態に応じた最深ヒット要素を判定する"
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

        component c4Zoom.coreEngine "CoreEngineComponents" {
            include *
            autoLayout
        }

        component c4Zoom.webUi "WebUiComponents" {
            include *
            autoLayout
        }
    }
}
