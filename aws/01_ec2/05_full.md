# AWSインフラ構築設計書 v3.1

## 1. インフラ構成の概要
### 1.1 設計方針
```
- Multi-AZ構成（ap-northeast-1a, 1c）による高可用性
- パブリック/プライベートサブネットの分離による堅牢なセキュリティ
- CloudFront + S3による静的コンテンツの配信最適化
- ALB + Fargateによる動的コンテンツの処理
- NAT Gatewayによるプライベートサブネットのインターネット接続
```

### 1.2 コンポーネント一覧
```
ネットワーク層:
- VPC: 10.0.0.0/16
- パブリックサブネット (ALB, NAT Gateway, Bastion): 10.0.10.0/24, 10.0.11.0/24
- プライベートサブネット アプリケーション層: 10.0.20.0/24, 10.0.21.0/24
- プライベートサブネット データベース層: 10.0.30.0/24, 10.0.31.0/24

コンピューティング層:
- ALB: パブリックサブネット
- Fargate: プライベートサブネット (アプリケーション層)
- RDS: プライベートサブネット (データベース層)

配信/ストレージ層:
- CloudFront: エッジロケーション
- S3: リージョナルサービス
- WAF: CloudFrontと連携
```

## 2. VPCとサブネットの構築
### 2.1 VPC作成
```
1. VPCダッシュボード → 「VPCを作成」
2. 基本設定
   名前: training-01-vpc
   IPv4 CIDR: 10.0.0.0/16
   DNSホスト名: 有効
   DNSリゾルーション: 有効
   ※「VPCのみ」オプションを選択することに注意
```

### 2.2 インターネットゲートウェイ
```
1. IGWダッシュボード → 「IGWを作成」
   名前: training-01-igw

2. VPCへのアタッチ（必須）
   - 作成したIGWを選択
   - アクション → VPCにアタッチ
   - VPC IDで training-01-vpc を選択

3. アタッチ確認
   - IGWのステータスが「アタッチ済み」であることを確認
```

### 2.3 サブネット作成
```
パブリックサブネット:
1. 1a用
   名前: training-01-subnet-pub-1a
   AZ: ap-northeast-1a
   IPv4 CIDR: 10.0.10.0/24
   自動パブリックIP割り当て: 有効化

2. 1c用
   名前: training-01-subnet-pub-1c
   AZ: ap-northeast-1c
   IPv4 CIDR: 10.0.11.0/24
   自動パブリックIP割り当て: 有効化

プライベートサブネット（アプリケーション層）:
1. 1a用
   名前: training-01-subnet-pri-app-1a
   AZ: ap-northeast-1a
   IPv4 CIDR: 10.0.20.0/24
   自動パブリックIP割り当て: 無効

2. 1c用
   名前: training-01-subnet-pri-app-1c
   AZ: ap-northeast-1c
   IPv4 CIDR: 10.0.21.0/24
   自動パブリックIP割り当て: 無効

プライベートサブネット（データベース層）:
1. 1a用
   名前: training-01-subnet-pri-db-1a
   AZ: ap-northeast-1a
   IPv4 CIDR: 10.0.30.0/24
   自動パブリックIP割り当て: 無効

2. 1c用
   名前: training-01-subnet-pri-db-1c
   AZ: ap-northeast-1c
   IPv4 CIDR: 10.0.31.0/24
   自動パブリックIP割り当て: 無効
```

### 2.4 Elastic IP設定
```
1. EIPダッシュボード → 「ElasticIPアドレスの割り当て」
   - NAT Gateway 1a用
     名前: training-01-eip-ngw-1a
     タグ: Name=training-01-eip-ngw-1a

   - NAT Gateway 1c用
     名前: training-01-eip-ngw-1c
     タグ: Name=training-01-eip-ngw-1c

確認事項:
- 各EIPのステータス確認
- 課金回避のため、即時にNAT Gatewayに関連付けること
```

### 2.5 NAT Gateway作成
```
1. NAT Gatewayダッシュボード → 「NATゲートウェイを作成」

2. 1a用設定:
   名前: training-01-ngw-1a
   サブネット: training-01-subnet-pub-1a
   接続タイプ: パブリック
   Elastic IP: training-01-eip-ngw-1a
   タグ: Name=training-01-ngw-1a

3. 1c用設定:
   名前: training-01-ngw-1c
   サブネット: training-01-subnet-pub-1c
   接続タイプ: パブリック
   Elastic IP: training-01-eip-ngw-1c
   タグ: Name=training-01-ngw-1c

重要確認事項:
- ステータスが「利用可能」になるまで待機（約5分）
- EIPが正しく関連付けられていること
```
[続き]

### 2.6 ルートテーブル設定
```
1. パブリックルートテーブル
名前: training-01-rtb-pub
VPC: training-01-vpc

ルート設定:
- 10.0.0.0/16 → local （自動作成）
- 0.0.0.0/0 → IGW （手動追加必須）

サブネット関連付け（必須）:
- training-01-subnet-pub-1a
- training-01-subnet-pub-1c

2. プライベートルートテーブル 1a
名前: training-01-rtb-pri-1a
VPC: training-01-vpc

ルート設定:
- 10.0.0.0/16 → local （自動作成）
- 0.0.0.0/0 → NAT Gateway 1a （手動追加必須）

サブネット関連付け（必須）:
- training-01-subnet-pri-app-1a
- training-01-subnet-pri-db-1a

3. プライベートルートテーブル 1c
名前: training-01-rtb-pri-1c
VPC: training-01-vpc

ルート設定:
- 10.0.0.0/16 → local （自動作成）
- 0.0.0.0/0 → NAT Gateway 1c （手動追加必須）

サブネット関連付け（必須）:
- training-01-subnet-pri-app-1c
- training-01-subnet-pri-db-1c

確認事項:
- 各ルートテーブルのステータスが「アクティブ」
- サブネットの関連付けが正しいこと
- IGW/NAT Gatewayへのルートが正しく設定されていること
```

### 2.7 セキュリティグループ設定
```
1. ALB用セキュリティグループ
名前: training-01-sg-alb
説明: ALB Security Group
VPC: training-01-vpc

インバウンドルール:
- タイプ: HTTP (80)
  ソース: 0.0.0.0/0
  説明: Allow HTTP from Internet
- タイプ: HTTPS (443)
  ソース: 0.0.0.0/0
  説明: Allow HTTPS from Internet

アウトバウンドルール:
- タイプ: すべてのトラフィック
  送信先: 0.0.0.0/0
  説明: Allow all outbound traffic

2. アプリケーション用セキュリティグループ
名前: training-01-sg-app
説明: Application Security Group
VPC: training-01-vpc

インバウンドルール:
- タイプ: カスタムTCP (8080)
  ソース: sg-alb
  説明: Allow traffic from ALB
- タイプ: HTTP (80)
  ソース: sg-alb
  説明: Allow HTTP from ALB

アウトバウンドルール:
- タイプ: すべてのトラフィック
  送信先: 0.0.0.0/0
  説明: Allow all outbound traffic

3. データベース用セキュリティグループ
名前: training-01-sg-db
説明: Database Security Group
VPC: training-01-vpc

インバウンドルール:
- タイプ: PostgreSQL (5432)
  ソース: sg-app
  説明: Allow PostgreSQL from Application

アウトバウンドルール:
- タイプ: すべてのトラフィック
  送信先: 0.0.0.0/0
  説明: Allow all outbound traffic

確認事項:
- セキュリティグループ間の参照が正しいこと
- 必要最小限の権限のみ許可されていること
- 各ポート番号が正しいこと
```

### 2.8 S3バケット設定
```
1. バケットの基本設定
名前: training-01-s3-assets
リージョン: ap-northeast-1
タグ: Name=training-01-s3-assets

パブリックアクセス設定:
- すべてのパブリックアクセスをブロック: オン
- ※CloudFrontからのアクセスのみ許可

2. バケットポリシー
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontServicePrincipal",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::training-01-s3-assets/*",
            "Condition": {
                "StringEquals": {
                    "AWS:SourceArn": "arn:aws:cloudfront::[AccountID]:distribution/[DistributionID]"
                }
            }
        }
    ]
}

3. CORS設定（必須）
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": [
            "PUT",
            "POST",
            "GET",
            "DELETE"
        ],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
    }
]

確認事項:
- バケット名が一意であること
- バケットポリシーが正しく適用されていること
- CORS設定が正しく保存されていること
```

[続き]

### 2.9 CloudFront設定
```
1. ディストリビューション作成
基本設定:
- オリジンドメイン: training-01-s3-assets.s3.amazonaws.com
- プロトコルポリシー: Redirect HTTP to HTTPS
- デフォルトルートオブジェクト: index.html

オリジンアクセス:
- OAC（Origin Access Control）を新規作成
- 名前: training-01-s3-assets-oac
- 署名バージョン: シグネチャバージョン4

キャッシュ設定:
- キャッシュポリシー: CachingOptimized
- 圧縮: 自動で圧縮
- ビューワープロトコルポリシー: Redirect HTTP to HTTPS
- TTL設定:
  - 最小: 0秒
  - デフォルト: 86400秒（24時間）
  - 最大: 31536000秒（365日）

セキュリティ設定:
- WAFの関連付け: 有効
- SSL証明書: ACM証明書を使用
- セキュリティポリシー: TLSv1.2_2021

カスタムエラーレスポンス:
- 403: /index.html
- 404: /error.html

2. 追加オリジン設定（ALB用）
名前: training-01-alb-origin
ドメイン: [ALBのDNS名]
プロトコル: HTTPS only
最小オリジンSSLプロトコル: TLSv1.2

確認事項:
- ディストリビューションのデプロイ完了を待つ（15-20分）
- オリジンへの接続性確認
- SSL/TLS設定の確認
```

### 2.10 IAMロール設定
```
1. アプリケーションロール
名前: training-01-role-app

信頼ポリシー:
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ecs-tasks.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}

アクセスポリシー:
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:ListBucket",
                "s3:DeleteObject"
            ],
            "Resource": [
                "arn:aws:s3:::training-01-s3-assets",
                "arn:aws:s3:::training-01-s3-assets/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        }
    ]
}

2. 実行ロール設定
名前: training-01-task-execution-role

信頼ポリシー:
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ecs-tasks.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}

マネージドポリシー:
- AmazonECSTaskExecutionRolePolicy
- AWSXRayDaemonWriteAccess

確認事項:
- ロールの作成完了確認
- ポリシーの正しい適用確認
- 信頼関係の設定確認
```

### 2.11 ALBとターゲットグループ設定
```
1. ターゲットグループ作成
基本設定:
- 名前: training-01-tg
- ターゲットタイプ: IP
- プロトコル: HTTP
- ポート: 8080
- VPC: training-01-vpc

ヘルスチェック設定:
- プロトコル: HTTP
- パス: /health
- ポート: traffic-port
- 正常しきい値: 3
- 非正常しきい値: 2
- タイムアウト: 5秒
- 間隔: 30秒
- 成功コード: 200-299

2. ALB作成
基本設定:
- 名前: training-01-alb
- スキーム: インターネット向け
- IPアドレスタイプ: IPv4

ネットワークマッピング:
- VPC: training-01-vpc
- AZ: ap-northeast-1a, 1c
- サブネット: pub-1a, pub-1c

セキュリティグループ:
- training-01-sg-alb

リスナー設定:
- HTTP(80): HTTPSにリダイレクト
- HTTPS(443):
  - デフォルトアクション: training-01-tg
  - SSL証明書: ACM証明書

確認事項:
- ALBのプロビジョニング完了確認
- ヘルスチェック成功確認
- SSL証明書の正しい適用確認
```

[続き]

## 3. 動作確認とトラブルシューティング

### 3.1 ネットワーク接続確認
```
1. VPC接続性チェック
   確認コマンド:
   $ aws ec2 describe-vpc-attribute --vpc-id vpc-*** --attribute enableDnsSupport
   $ aws ec2 describe-vpc-attribute --vpc-id vpc-*** --attribute enableDnsHostnames
   
   確認項目:
   - DNS解決が有効
   - DNSホスト名が有効

2. サブネットルーティング確認
   パブリックサブネット:
   - インターネットへのpingが成功すること
   - curl http://checkip.amazonaws.com が成功すること

   プライベートサブネット:
   - NAT Gateway経由でインターネットアクセス可能
   - サブネット間の通信が可能

3. NAT Gateway確認
   確認コマンド:
   $ aws ec2 describe-nat-gateways

   確認項目:
   - ステータスが「available」
   - EIPが正しく割り当てられている
   - 正しいサブネットに配置されている
```

### 3.2 セキュリティ設定確認
```
1. セキュリティグループの疎通確認
   ALB → アプリケーション:
   - ポート80/8080の疎通確認
   - ヘルスチェックの成功確認

   アプリケーション → RDS:
   - ポート5432の疎通確認
   - データベース接続テスト

2. IAMロールの権限確認
   確認コマンド:
   $ aws iam simulate-principal-policy

   確認項目:
   - S3アクセス権限
   - CloudWatchログ権限
   - ECSタスク実行権限
```

### 3.3 アプリケーションアクセス確認
```
1. ALB経由のアクセス確認
   - HTTP→HTTPSリダイレクト確認
   - SSL/TLS接続確認
   - アプリケーションレスポンス確認

2. CloudFront経由のアクセス確認
   静的コンテンツ:
   - S3オブジェクトアクセス確認
   - キャッシュ動作確認

   動的コンテンツ:
   - ALBへの転送確認
   - レスポンスヘッダー確認
```

## 4. 運用管理

### 4.1 監視設定
```
1. CloudWatch Logs設定
   ログ保持期間: 30日
   ログストリーム:
   - /ecs/training-01-app
   - /ecs/training-01-nginx

2. メトリクスアラート設定
   ALB:
   - HTTPステータスコード監視
   - レイテンシー監視
   - リクエスト数監視

   Fargate:
   - CPU使用率
   - メモリ使用率
   - タスク数

3. ヘルスアラーム設定
   閾値:
   - CPU: 80%超過
   - メモリ: 80%超過
   - エラーレート: 10%超過
```

### 4.2 バックアップと復旧
```
1. バックアップ対象
   - RDSスナップショット: 日次
   - S3バージョニング: 有効
   - タスク定義: 履歴保持

2. 障害復旧手順
   データ復旧:
   1. RDSスナップショットから復元
   2. S3バージョニングから復元

   アプリケーション復旧:
   1. 前バージョンのタスク定義にロールバック
   2. サービスの更新
   3. ヘルスチェック確認
```

### 4.3 セキュリティ運用
```
1. 定期レビュー項目
   週次:
   - セキュリティグループルール
   - IAMポリシー
   - CloudFrontアクセスログ

   月次:
   - SSL/TLS証明書有効期限
   - セキュリティパッチ適用状況
   - WAFルール

2. インシデント対応
   手順:
   1. 影響範囲の特定
   2. 一時的な遮断措置
   3. ログ分析と原因特定
   4. 恒久対策の実施
```

## 5. コスト管理

### 5.1 コスト最適化
```
1. 監視項目
   - NAT Gateway利用料
   - CloudFrontトラフィック
   - ECS/Fargateリソース使用量

2. 最適化戦略
   - 未使用EIPの解放
   - Auto Scalingの適切な設定
   - CloudFrontキャッシュ設定の最適化
```

# AWS 構築設定値一覧

| 構築順序 | カテゴリ | サービス | コンポーネント | 設定項目 | 設定値 |
|----------|----------|-----------|----------------|-----------|---------|
| 1 | ネットワーク | VPC | VPC | 名前 | training-01-vpc |
| 1 | ネットワーク | VPC | VPC | CIDR | 10.0.0.0/16 |
| 1 | ネットワーク | VPC | VPC | DNSホスト名 | 有効 |
| 1 | ネットワーク | VPC | VPC | DNSリゾルーション | 有効 |
| 2 | ネットワーク | VPC | IGW | 名前 | training-01-igw |
| 3 | ネットワーク | VPC | パブリックサブネット 1a | 名前 | training-01-subnet-pub-1a |
| 3 | ネットワーク | VPC | パブリックサブネット 1a | CIDR | 10.0.10.0/24 |
| 3 | ネットワーク | VPC | パブリックサブネット 1a | AZ | ap-northeast-1a |
| 3 | ネットワーク | VPC | パブリックサブネット 1c | 名前 | training-01-subnet-pub-1c |
| 3 | ネットワーク | VPC | パブリックサブネット 1c | CIDR | 10.0.11.0/24 |
| 3 | ネットワーク | VPC | パブリックサブネット 1c | AZ | ap-northeast-1c |
| 3 | ネットワーク | VPC | プライベートサブネット App 1a | 名前 | training-01-subnet-pri-app-1a |
| 3 | ネットワーク | VPC | プライベートサブネット App 1a | CIDR | 10.0.20.0/24 |
| 3 | ネットワーク | VPC | プライベートサブネット App 1a | AZ | ap-northeast-1a |
| 3 | ネットワーク | VPC | プライベートサブネット App 1c | 名前 | training-01-subnet-pri-app-1c |
| 3 | ネットワーク | VPC | プライベートサブネット App 1c | CIDR | 10.0.21.0/24 |
| 3 | ネットワーク | VPC | プライベートサブネット App 1c | AZ | ap-northeast-1c |
| 3 | ネットワーク | VPC | プライベートサブネット DB 1a | 名前 | training-01-subnet-pri-db-1a |
| 3 | ネットワーク | VPC | プライベートサブネット DB 1a | CIDR | 10.0.30.0/24 |
| 3 | ネットワーク | VPC | プライベートサブネット DB 1a | AZ | ap-northeast-1a |
| 3 | ネットワーク | VPC | プライベートサブネット DB 1c | 名前 | training-01-subnet-pri-db-1c |
| 3 | ネットワーク | VPC | プライベートサブネット DB 1c | CIDR | 10.0.31.0/24 |
| 3 | ネットワーク | VPC | プライベートサブネット DB 1c | AZ | ap-northeast-1c |
| 4 | ネットワーク | VPC | EIP NAT Gateway 1a | 名前 | training-01-eip-ngw-1a |
| 4 | ネットワーク | VPC | EIP NAT Gateway 1c | 名前 | training-01-eip-ngw-1c |
| 5 | ネットワーク | VPC | NAT Gateway 1a | 名前 | training-01-ngw-1a |
| 5 | ネットワーク | VPC | NAT Gateway 1a | サブネット | training-01-subnet-pub-1a |
| 5 | ネットワーク | VPC | NAT Gateway 1c | 名前 | training-01-ngw-1c |
| 5 | ネットワーク | VPC | NAT Gateway 1c | サブネット | training-01-subnet-pub-1c |
| 6 | ネットワーク | VPC | パブリックルートテーブル | 名前 | training-01-rtb-pub |
| 6 | ネットワーク | VPC | パブリックルートテーブル | ルート1 | 10.0.0.0/16 → local |
| 6 | ネットワーク | VPC | パブリックルートテーブル | ルート2 | 0.0.0.0/0 → IGW |
| 6 | ネットワーク | VPC | プライベートルートテーブル 1a | 名前 | training-01-rtb-pri-1a |
| 6 | ネットワーク | VPC | プライベートルートテーブル 1a | ルート1 | 10.0.0.0/16 → local |
| 6 | ネットワーク | VPC | プライベートルートテーブル 1a | ルート2 | 0.0.0.0/0 → NAT Gateway 1a |
| 6 | ネットワーク | VPC | プライベートルートテーブル 1c | 名前 | training-01-rtb-pri-1c |
| 6 | ネットワーク | VPC | プライベートルートテーブル 1c | ルート1 | 10.0.0.0/16 → local |
| 6 | ネットワーク | VPC | プライベートルートテーブル 1c | ルート2 | 0.0.0.0/0 → NAT Gateway 1c |
| 7 | セキュリティ | VPC | ALB用SG | 名前 | training-01-sg-alb |
| 7 | セキュリティ | VPC | ALB用SG | インバウンド1 | HTTP(80) / 0.0.0.0/0 |
| 7 | セキュリティ | VPC | ALB用SG | インバウンド2 | HTTPS(443) / 0.0.0.0/0 |
| 7 | セキュリティ | VPC | App用SG | 名前 | training-01-sg-app |
| 7 | セキュリティ | VPC | App用SG | インバウンド1 | HTTP(80) / sg-alb |
| 7 | セキュリティ | VPC | App用SG | インバウンド2 | TCP(8080) / sg-alb |
| 7 | セキュリティ | VPC | DB用SG | 名前 | training-01-sg-db |
| 7 | セキュリティ | VPC | DB用SG | インバウンド | PostgreSQL(5432) / sg-app |
| 8 | ロードバランサー | EC2 | ターゲットグループ | 名前 | training-01-tg |
| 8 | ロードバランサー | EC2 | ターゲットグループ | ターゲットタイプ | IP |
| 8 | ロードバランサー | EC2 | ターゲットグループ | プロトコル/ポート | HTTP/8080 |
| 8 | ロードバランサー | EC2 | ターゲットグループ | ヘルスチェックパス | /health |
| 9 | ロードバランサー | EC2 | ALB | 名前 | training-01-alb |
| 9 | ロードバランサー | EC2 | ALB | スキーム | インターネット向け |
| 9 | ロードバランサー | EC2 | ALB | サブネット | pub-1a, pub-1c |
| 9 | ロードバランサー | EC2 | ALB | セキュリティグループ | sg-alb |
| 10 | ストレージ | S3 | バケット | 名前 | training-01-s3-assets |
| 10 | ストレージ | S3 | バケット | リージョン | ap-northeast-1 |
| 10 | ストレージ | S3 | バケット | パブリックアクセス | すべてブロック |
| 11 | CDN | CloudFront | ディストリビューション | オリジン | training-01-s3-assets.s3.amazonaws.com |
| 11 | CDN | CloudFront | ディストリビューション | プロトコル | Redirect HTTP to HTTPS |
| 11 | CDN | CloudFront | ディストリビューション | OAC名 | training-01-s3-assets-oac |
| 12 | IAM | IAM | アプリケーションロール | 名前 | training-01-role-app |
| 12 | IAM | IAM | 実行ロール | 名前 | training-01-task-execution-role |
| 13 | モニタリング | CloudWatch | ロググループ | 名前 | /ecs/training-01-app |
| 13 | モニタリング | CloudWatch | メトリクスアラーム-CPU | 閾値 | 80% |
| 13 | モニタリング | CloudWatch | メトリクスアラーム-メモリ | 閾値 | 80% |
| 14 | セキュリティ | WAF | WAF ACL | 名前 | training-01-waf |
| 14 | セキュリティ | WAF | WAF ACL | リソース | CloudFront |

各コンポーネントは依存関係を考慮した構築順序で並べています。特に以下の点に注意が必要です：
- VPC関連リソースの順序（VPC → IGW → サブネット → NAT Gateway）
- セキュリティグループの相互参照
- ALBとターゲットグループの関係
- CloudFrontとS3の連携設定