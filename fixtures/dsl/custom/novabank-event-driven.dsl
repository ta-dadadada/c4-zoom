workspace "NovaBank Event Mesh" "双方向通信・長い依存チェーン・高密度ロールアップと上流/下流トレースを検証するためのサンプル" {

    !identifiers hierarchical

    model {
        retailUser = person "Retail Customer" "口座照会・即時振込を行う個人顧客" "External"
        complianceOfficer = person "Compliance Officer" "不正検知アラートを審査する担当者" "Internal"

        clearingNetwork = softwareSystem "Interbank Clearing" "他行振込を精算する外部決済ネットワーク" "External"
        kycProvider = softwareSystem "eKYC Provider" "本人確認・反社チェックを提供する外部API" "External"

        channels = softwareSystem "Digital Channels" "顧客向けチャネル群" {
            mobileBanking = container "Mobile Banking App" "生体認証対応バンキングアプリ" "Swift / Kotlin" "Mobile App"
            bff = container "Channel BFF" "画面向け集約APIとセッション管理" "TypeScript / Fastify"
        }

        ledger = softwareSystem "Core Ledger" "勘定系元帳・振込実行システム" {
            transferApi = container "Transfer Engine" "振込オーケストレーション" "Java / Spring Boot" {
                transferEndpoint = component "Transfer Endpoint" "振込API受付・冪等キー管理" "Java"
                balanceGuard = component "Balance Guard" "残高検証と二重引落防止ロック" "Java"
                clearingAdapter = component "Clearing Adapter" "他行決済ネットワーク送受信" "Java"
            }
            ledgerDb = container "Ledger Store" "複式簿記の追記専用トランザクションDB" "CockroachDB" "Database"
            txStream = container "Transaction Stream" "取引イベントストリーム" "Apache Kafka" "Queue"
        }

        risk = softwareSystem "Fraud & Risk System" "リアルタイム不正検知・審査システム" {
            scoringApi = container "Risk Scoring API" "振込実行前の同期リスクスコアリング" "Python / FastAPI" {
                featureFetcher = component "Feature Fetcher" "直近行動特徴量の取得" "Python"
                mlScorer = component "ML Scorer" "不正確率モデル推論" "Python / ONNX"
            }
            alertService = container "Alert Review Service" "高リスク取引のアラート管理・凍結解除" "Go"
            featureStore = container "Feature Store" "低遅延特徴量キャッシュ" "Redis" "Database"
        }

        // チャネル -> 勘定系
        retailUser -> channels.mobileBanking "残高照会・振込操作" "HTTPS"
        channels.mobileBanking -> channels.bff "API通信" "HTTPS / JSON"
        channels.bff -> ledger.transferApi.transferEndpoint "振込依頼・照会" "gRPC"

        // 勘定系内部
        ledger.transferApi.transferEndpoint -> ledger.transferApi.balanceGuard "残高チェック依頼"
        ledger.transferApi.balanceGuard -> ledger.ledgerDb "残高参照・仮引落" "SQL"
        ledger.transferApi.transferEndpoint -> ledger.transferApi.clearingAdapter "他行送金実行"
        ledger.transferApi.clearingAdapter -> clearingNetwork "振込電文送信" "ISO 20022 / TLS"
        clearingNetwork -> ledger.transferApi.clearingAdapter "精算完了コールバック" "Webhook / TLS"
        ledger.transferApi.transferEndpoint -> ledger.txStream "TransactionPosted 発行" "Kafka"

        // 勘定系 <-> リスク（双方向エッジ検証用）
        ledger.transferApi.transferEndpoint -> risk.scoringApi.featureFetcher "同期リスク判定依頼" "gRPC"
        risk.scoringApi.featureFetcher -> risk.featureStore "特徴量取得" "Redis Protocol"
        risk.scoringApi.featureFetcher -> risk.scoringApi.mlScorer "スコア推論"
        risk.scoringApi.mlScorer -> ledger.transferApi.transferEndpoint "スコア結果・拒否判定返却" "gRPC"

        // 非同期イベント -> リスク監視・コンプライアンス
        ledger.txStream -> risk.featureStore "行動特徴量をリアルタイム更新" "Kafka Connect"
        ledger.txStream -> risk.alertService "異常取引パターン検知" "Kafka"
        risk.alertService -> kycProvider "追加KYC照会" "HTTPS"
        risk.alertService -> ledger.transferApi.balanceGuard "不正口座の一時凍結指示" "gRPC"
        complianceOfficer -> risk.alertService "アラート審査・解除操作" "HTTPS"
    }
}
