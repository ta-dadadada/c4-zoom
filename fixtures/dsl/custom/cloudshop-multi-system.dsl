workspace "CloudShop Platform" "複数システムがL1〜L3階層を持ち、システム横断で連携するc4-zoom動作確認用の主力サンプル" {

    !identifiers hierarchical

    model {
        // Level 1: アクター
        customer = person "Customer" "Webまたはモバイルアプリから商品を購入する利用者" "External"
        merchant = person "Merchant Staff" "商品登録・在庫管理・出荷対応を行う店舗スタッフ" "Internal"

        // Level 1: 外部システム
        stripe = softwareSystem "Stripe Payment" "クレジットカード決済・返金処理を担う外部決済基盤" "External" {
            url "https://stripe.com"
        }
        sendgrid = softwareSystem "SendGrid Mail" "注文確認・発送通知メールを送信する外部メール基盤" "External"
        carrierApi = softwareSystem "Logistics Carrier" "配送伝票発行と荷物追跡を提供する外部配送API" "External"

        // Level 1: 内部システム 1（ストアフロント & コマース）
        commerce = softwareSystem "Commerce Platform" "商品閲覧・カート・注文受付・決済オーケストレーションを担う中核システム" "Core" {
            group "Client Channels" {
                webApp = container "Web Storefront" "顧客向けECサイト" "Next.js / TypeScript" "Web Browser"
                mobileApp = container "Mobile App" "iOS / Android 向けショッピングアプリ" "Flutter" "Mobile App"
                merchantPortal = container "Merchant Portal" "店舗向け管理画面" "React / TypeScript" "Web Browser"
            }

            gateway = container "API Gateway" "認証・レート制限・ルーティングを担うエッジゲートウェイ" "Envoy / Go"

            orderApi = container "Order API" "注文作成・決済連携・キャンセルを処理するAPIサーバー" "Go / Gin" {
                authMiddleware = component "Auth Middleware" "JWT検証と権限チェック" "Go"
                orderController = component "Order Controller" "RESTエンドポイントとリクエスト検証" "Go"
                checkoutService = component "Checkout Service" "在庫仮押さえ〜決済確定のワークフロー制御" "Go"
                paymentAdapter = component "Payment Adapter" "外部決済ゲートウェイ向けHTTPクライアント" "Go / HTTPS"
                orderRepo = component "Order Repository" "注文集約の永続化" "Go / pgx"
            }

            catalogApi = container "Catalog API" "商品検索・価格・カテゴリ管理を提供するAPIサーバー" "Go / gRPC" {
                catalogHandler = component "Catalog Handler" "商品照会・更新ハンドラ" "Go"
                searchIndexer = component "Search Indexer" "商品更新を全文検索インデックスへ同期" "Go"
                catalogRepo = component "Catalog Repository" "商品マスタ永続化" "Go / pgx"
            }

            commerceDb = container "Commerce DB" "注文・商品・顧客データを永続化" "PostgreSQL" "Database"
            searchEngine = container "Search Index" "高速な商品全文検索・ファセット検索" "OpenSearch" "Database"
            eventBus = container "Domain Event Bus" "注文・在庫・配送イベントを非同期連携" "Apache Kafka" "Queue"
        }

        // Level 1: 内部システム 2（フルフィルメント & 在庫）
        fulfillment = softwareSystem "Fulfillment System" "倉庫在庫管理・ピッキング・配送手配を担うシステム" "Core" {
            inventoryApi = container "Inventory Service" "在庫引当・入出庫管理を行うマイクロサービス" "Rust / Axum" {
                reservationHandler = component "Reservation Handler" "仮押さえ・確定・解放API" "Rust"
                stockLedger = component "Stock Ledger" "在庫移動履歴の整合性管理" "Rust"
            }

            shippingWorker = container "Shipping Worker" "注文確定イベントを購読して配送伝票を発行するワーカー" "Go" {
                orderConsumer = component "Order Event Consumer" "Kafkaからのイベント購読・リトライ制御" "Go"
                labelGenerator = component "Label Generator" "配送業者APIを呼び出し伝票PDFを生成" "Go"
                notificationSender = component "Notification Sender" "発送完了メールの送信依頼" "Go"
            }

            fulfillmentDb = container "Fulfillment DB" "在庫数・倉庫ロケーション・配送状態" "PostgreSQL" "Database"
        }

        // Level 1: 内部システム 3（データ分析基盤）
        analytics = softwareSystem "Analytics Platform" "売上集計・レコメンド・異常検知を行う分析システム" "Analytics" {
            ingestPipeline = container "Stream Ingestor" "業務イベントをリアルタイム取り込み・変換" "Apache Flink" {
                eventParser = component "Event Normalizer" "スキーマ検証と正規化" "Java"
                warehouseSink = component "Warehouse Sink" "DWHへのマイクロバッチ書き込み" "Java"
            }
            dwh = container "Data Warehouse" "分析用カラムナストレージ" "BigQuery" "Database"
            biDashboard = container "BI Dashboard" "経営・店舗向け売上レポート可視化" "Looker" "Web Browser"
        }

        // --- ユーザー起点の関係線 ---
        customer -> commerce.webApp "商品検索・購入" "HTTPS"
        customer -> commerce.mobileApp "商品検索・購入" "HTTPS"
        merchant -> commerce.merchantPortal "商品・在庫・売上を管理" "HTTPS"
        merchant -> analytics.biDashboard "売上・転換率を分析" "HTTPS"

        // --- Commerce 内部 ---
        commerce.webApp -> commerce.gateway "API呼び出し" "HTTPS / JSON"
        commerce.mobileApp -> commerce.gateway "API呼び出し" "HTTPS / JSON"
        commerce.merchantPortal -> commerce.gateway "管理API呼び出し" "HTTPS / JSON"

        commerce.gateway -> commerce.orderApi.authMiddleware "注文系リクエスト転送" "HTTPS"
        commerce.gateway -> commerce.catalogApi.catalogHandler "商品系リクエスト転送" "gRPC"

        commerce.orderApi.authMiddleware -> commerce.orderApi.orderController "認証済みリクエスト委譲"
        commerce.orderApi.orderController -> commerce.orderApi.checkoutService "チェックアウト実行"
        commerce.orderApi.checkoutService -> commerce.orderApi.paymentAdapter "決済オーソリ依頼"
        commerce.orderApi.checkoutService -> commerce.orderApi.orderRepo "注文ステータス保存"
        commerce.orderApi.orderRepo -> commerce.commerceDb "注文データ読み書き" "SQL / TCP"
        commerce.orderApi.checkoutService -> commerce.eventBus "OrderConfirmed イベント発行" "Kafka"

        commerce.catalogApi.catalogHandler -> commerce.catalogApi.catalogRepo "商品マスタ取得・更新"
        commerce.catalogApi.catalogHandler -> commerce.searchEngine "全文検索クエリ" "HTTPS"
        commerce.catalogApi.catalogHandler -> commerce.catalogApi.searchIndexer "インデックス更新通知"
        commerce.catalogApi.searchIndexer -> commerce.searchEngine "ドキュメント登録" "HTTPS"
        commerce.catalogApi.catalogRepo -> commerce.commerceDb "商品マスタ読み書き" "SQL / TCP"

        // --- システム横断・外部連携 ---
        commerce.orderApi.paymentAdapter -> stripe "決済オーソリ・売上確定" "HTTPS / REST"
        commerce.orderApi.checkoutService -> fulfillment.inventoryApi.reservationHandler "在庫仮押さえ・確定" "gRPC"

        fulfillment.inventoryApi.reservationHandler -> fulfillment.inventoryApi.stockLedger "在庫台帳更新"
        fulfillment.inventoryApi.stockLedger -> fulfillment.fulfillmentDb "在庫レコード更新" "SQL / TCP"

        commerce.eventBus -> fulfillment.shippingWorker.orderConsumer "OrderConfirmed 購読" "Kafka"
        fulfillment.shippingWorker.orderConsumer -> fulfillment.shippingWorker.labelGenerator "出荷指示生成"
        fulfillment.shippingWorker.labelGenerator -> carrierApi "配送伝票発行" "HTTPS / REST"
        fulfillment.shippingWorker.labelGenerator -> fulfillment.fulfillmentDb "配送ステータス更新" "SQL / TCP"
        fulfillment.shippingWorker.orderConsumer -> fulfillment.shippingWorker.notificationSender "発送通知トリガー"
        fulfillment.shippingWorker.notificationSender -> sendgrid "発送完了メール送信" "HTTPS / API"
        sendgrid -> customer "注文・発送通知メール配信" "SMTP"

        // --- 分析連携 ---
        commerce.eventBus -> analytics.ingestPipeline.eventParser "全ドメインイベント購読" "Kafka"
        analytics.ingestPipeline.eventParser -> analytics.ingestPipeline.warehouseSink "変換済みレコード転送"
        analytics.ingestPipeline.warehouseSink -> analytics.dwh "分析テーブル追記" "gRPC / Storage Write"
        analytics.biDashboard -> analytics.dwh "集計クエリ実行" "SQL"
    }
}
