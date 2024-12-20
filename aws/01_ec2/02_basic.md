# AWSインフラ構築設計書

## 1. 概要
本設計書では、training-01をプレフィックスとして使用したAWSインフラの構築手順を定義します。

## 2. ネットワーク構成
### 2.1 VPC作成
1. VPCダッシュボードから「VPCを作成」を選択します
2. 以下の項目を設定：
   - 名前タグ: training-01-vpc
   - IPv4 CIDR: 10.0.0.0/16
   - テナンシー: デフォルト
   - DNSホスト名: 有効化
   - DNSリゾルーション: 有効化

### 2.2 インターネットゲートウェイ作成
1. インターネットゲートウェイダッシュボードから「作成」を選択
2. 設定項目：
   - 名前タグ: training-01-igw
3. 作成後、training-01-vpcにアタッチします

### 2.3 サブネット作成
#### パブリックサブネット作成
1. サブネットダッシュボードから「サブネットを作成」を選択
2. 以下の項目を設定：
   - VPC選択: training-01-vpc
   - 名前タグ: training-01-subnet-pub-1a
   - アベイラビリティゾーン: ap-northeast-1a
   - IPv4 CIDR: 10.0.10.0/24
   - 自動パブリックIPの割り当て: 有効化

#### プライベートサブネット作成
1. プライベートサブネット1の設定：
   - VPC選択: training-01-vpc
   - 名前タグ: training-01-subnet-pri-1a
   - アベイラビリティゾーン: ap-northeast-1a
   - IPv4 CIDR: 10.0.20.0/24

2. プライベートサブネット2の設定：
   - VPC選択: training-01-vpc
   - 名前タグ: training-01-subnet-pri-1c
   - アベイラビリティゾーン: ap-northeast-1c
   - IPv4 CIDR: 10.0.21.0/24

### 2.4 ルートテーブル設定
#### パブリックルートテーブル作成
1. ルートテーブルの基本情報を設定：
   - 名前タグ: training-01-rtb-pub
   - VPC選択: training-01-vpc
   
2. ルートの編集：
   - 送信先: 0.0.0.0/0
   - ターゲット: インターネットゲートウェイ (training-01-igw)

3. サブネットの関連付け：
   - training-01-subnet-pub-1a を選択

4. 確認事項：
   - インターネットゲートウェイの設定確認
   - サブネット関連付けの確認

#### プライベートルートテーブル作成
1. 基本設定：
   - 名前タグ: training-01-rtb-pri
   - VPC選択: training-01-vpc
2. サブネット関連付け：
   - training-01-subnet-pri-1a
   - training-01-subnet-pri-1c

## 3. セキュリティグループ設定
### 3.1 Webサーバー用セキュリティグループ
1. 基本設定：
   - セキュリティグループ名: training-01-sg-web
   - VPC選択: training-01-vpc
2. インバウンドルール設定：
   - SSH (22番ポート): 0.0.0.0/0
   - HTTP (80番ポート): 0.0.0.0/0
   - TCP (8080番ポート): 0.0.0.0/0
3. アウトバウンドルール設定：
   - すべてのトラフィック: 0.0.0.0/0

### 3.2 データベース用セキュリティグループ
1. 基本設定：
   - セキュリティグループ名: training-01-sg-db
   - VPC選択: training-01-vpc
2. インバウンドルール設定：
   - PostgreSQL (5432番ポート): ソース=training-01-sg-web
3. アウトバウンドルール設定：
   - すべてのトラフィック: 0.0.0.0/0

## 4. コンピューティングリソース設定
### 4.1 EC2インスタンス作成
1. 基本設定：
   - 名前タグ: training-01-instance-web
   - AMI: Amazon Linux 2023
   - インスタンスタイプ: t2.micro
2. ネットワーク設定：
   - VPC選択: training-01-vpc
   - サブネット: training-01-subnet-pub-1a
   - セキュリティグループ: training-01-sg-web
3. ストレージ設定：
   - ルートボリューム: 10GB、汎用SSD (gp3)
4. キーペア設定：
   - キーペア名: training-01-key-web

### 4.2 Elastic IP設定
1. 基本設定：
   - 名前タグ: training-01-eip-web
2. EC2インスタンスにアタッチ：
   - training-01-instance-web に割り当て

### 4.3 ロードバランサー設定
1. 基本設定：
   - 名前: training-01-elb
   - スキーム: インターネット向け
   - VPC選択: training-01-vpc
2. リスナー設定：
   - HTTP (80番ポート)
3. セキュリティ設定：
   - セキュリティグループ: training-01-sg-web
4. ルーティング設定：
   - ターゲットグループ名: training-01-tg-web
   - ヘルスチェックパス: /health

## 5. ストレージ設定
### 5.1 S3バケット作成
1. 基本設定：
   - バケット名: training-01-s3
   - リージョン: アジアパシフィック（東京）ap-northeast-1
2. アクセス設定：
   - パブリックアクセス: すべてブロック

### 5.2 S3バケットポリシー設定
#### CloudFront連携用ポリシー
```json
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
            "Resource": "arn:aws:s3:::training-01-s3/*",
            "Condition": {
                "StringEquals": {
                    "AWS:SourceArn": "arn:aws:cloudfront::216989128190:distribution/E12PCJF8HWKJSU"
                }
            }
        },
        {
            "Sid": "AllowIAMUserAccess",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::216989128190:root"
            },
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::training-01-s3/*"
        }
    ]
}
```

### 5.3 S3 CORS設定
```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "PUT",
            "POST",
            "GET",
            "DELETE"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": []
    }
]
```

## 6. CDN設定
### 6.1 CloudFront設定
1. 基本設定：
   - オリジンドメイン: training-01-s3.s3.amazonaws.com
2. オリジンアクセス設定：
   - Origin access control settings (推奨)
   - Origin access control: 新規作成
3. セキュリティ設定：
   - WAF: セキュリティ保護を有効化

## 7. セキュリティ設定
### 7.1 WAF設定
1. 基本設定：
   - 名前: training-01-waf
   - リソースタイプ: CloudFront
2. ルール設定：
   - SQLインジェクション防御ルール
   - クロスサイトスクリプティング防御ルール
   - リクエストレート制限ルール

## 8. Route53設定
1. ホストゾーン作成
2. レコード設定：
   - レコードタイプ: Aレコード
   - エイリアス: CloudFrontディストリビューションを選択


# AWS設定値一覧

マークダウン形式で横長のスプレッドシートとして表示します。



| カテゴリー | サービス | リソース名 | 設定項目 | 値 |
|-----------|----------|------------|----------|-----|
| ネットワーク | VPC | training-01-vpc | IPv4 CIDR | 10.0.0.0/16 |
| ネットワーク | VPC | training-01-vpc | テナンシー | デフォルト |
| ネットワーク | VPC | training-01-vpc | DNSホスト名 | 有効 |
| ネットワーク | VPC | training-01-vpc | DNSリゾルーション | 有効 |
| ネットワーク | IGW | training-01-igw | アタッチ先VPC | training-01-vpc |
| ネットワーク | サブネット | training-01-subnet-pub-1a | 種別 | パブリック |
| ネットワーク | サブネット | training-01-subnet-pub-1a | アベイラビリティゾーン | ap-northeast-1a |
| ネットワーク | サブネット | training-01-subnet-pub-1a | CIDR | 10.0.10.0/24 |
| ネットワーク | サブネット | training-01-subnet-pub-1a | 自動パブリックIP | 有効 |
| ネットワーク | サブネット | training-01-subnet-pri-1a | 種別 | プライベート |
| ネットワーク | サブネット | training-01-subnet-pri-1a | アベイラビリティゾーン | ap-northeast-1a |
| ネットワーク | サブネット | training-01-subnet-pri-1a | CIDR | 10.0.20.0/24 |
| ネットワーク | サブネット | training-01-subnet-pri-1a | 自動パブリックIP | 無効 |
| ネットワーク | サブネット | training-01-subnet-pri-1c | 種別 | プライベート |
| ネットワーク | サブネット | training-01-subnet-pri-1c | アベイラビリティゾーン | ap-northeast-1c |
| ネットワーク | サブネット | training-01-subnet-pri-1c | CIDR | 10.0.21.0/24 |
| ネットワーク | サブネット | training-01-subnet-pri-1c | 自動パブリックIP | 無効 |
| ネットワーク | ルートテーブル | training-01-rtb-pub | 種別 | パブリック |
| ネットワーク | ルートテーブル | training-01-rtb-pub | 関連付けるサブネット | training-01-subnet-pub-1a |
| ネットワーク | ルートテーブル | training-01-rtb-pub | デフォルトルート | 0.0.0.0/0 → training-01-igw |
| ネットワーク | ルートテーブル | training-01-rtb-pri | 種別 | プライベート |
| ネットワーク | ルートテーブル | training-01-rtb-pri | 関連付けるサブネット | training-01-subnet-pri-1a/1c |
| ネットワーク | ルートテーブル | training-01-rtb-pri | デフォルトルート | なし |
| セキュリティ | セキュリティグループ | training-01-sg-web | 用途 | Webサーバー |
| セキュリティ | セキュリティグループ | training-01-sg-web | インバウンドルール | TCP/22: 0.0.0.0/0 |
| セキュリティ | セキュリティグループ | training-01-sg-web | インバウンドルール | TCP/80: 0.0.0.0/0 |
| セキュリティ | セキュリティグループ | training-01-sg-web | インバウンドルール | TCP/8080: 0.0.0.0/0 |
| セキュリティ | セキュリティグループ | training-01-sg-web | アウトバウンドルール | ALL: 0.0.0.0/0 |
| セキュリティ | セキュリティグループ | training-01-sg-db | 用途 | データベース |
| セキュリティ | セキュリティグループ | training-01-sg-db | インバウンドルール | TCP/5432: training-01-sg-web |
| セキュリティ | セキュリティグループ | training-01-sg-db | アウトバウンドルール | ALL: 0.0.0.0/0 |
| コンピューティング | EC2 | training-01-instance-web | AMI | Amazon Linux 2023 |
| コンピューティング | EC2 | training-01-instance-web | インスタンスタイプ | t2.micro |
| コンピューティング | EC2 | training-01-instance-web | サブネット | training-01-subnet-pub-1a |
| コンピューティング | EC2 | training-01-instance-web | セキュリティグループ | training-01-sg-web |
| コンピューティング | EC2 | training-01-instance-web | ストレージ | 10GB (gp3) |
| コンピューティング | EC2 | training-01-instance-web | キーペア | training-01-key-web |
| コンピューティング | Elastic IP | training-01-eip-web | アタッチ先 | training-01-instance-web |
| コンピューティング | ALB | training-01-elb | スキーム | インターネット向け |
| コンピューティング | ALB | training-01-elb | VPC | training-01-vpc |
| コンピューティング | ALB | training-01-elb | リスナー | HTTP/80 |
| コンピューティング | ALB | training-01-elb | セキュリティグループ | training-01-sg-web |
| コンピューティング | ALB | training-01-tg-web | ヘルスチェックパス | /health |
| ストレージ | S3 | training-01-s3 | リージョン | ap-northeast-1 |
| ストレージ | S3 | training-01-s3 | パブリックアクセス | すべてブロック |
| CDN | CloudFront | - | オリジンドメイン | training-01-s3.s3.amazonaws.com |
| CDN | CloudFront | - | アクセス制御 | Origin access control |
| CDN | CloudFront | - | WAF | 有効 |
| セキュリティ | WAF | training-01-waf | リソースタイプ | CloudFront |
| セキュリティ | WAF | training-01-waf | 防御ルール | SQLインジェクション |
| セキュリティ | WAF | training-01-waf | 防御ルール | クロスサイトスクリプティング |
| セキュリティ | WAF | training-01-waf | 防御ルール | リクエストレート制限 |

イメージ図

![2024-12-21_05h32_19](https://github.com/user-attachments/assets/93c43f23-bf2a-4d0c-83fe-c1926e1380cf)
