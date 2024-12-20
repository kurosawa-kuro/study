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
   - TCP (3000番ポート): 0.0.0.0/0
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

## 1. ネットワーク設定

### VPC
| リソース名 | 設定項目 | 値 |
|------------|----------|-----|
| training-01-vpc | IPv4 CIDR | 10.0.0.0/16 |
| | テナンシー | デフォルト |
| | DNSホスト名 | 有効 |
| | DNSリゾルーション | 有効 |

### インターネットゲートウェイ
| リソース名 | 設定項目 | 値 |
|------------|----------|-----|
| training-01-igw | アタッチ先VPC | training-01-vpc |

### サブネット
| リソース名 | 種別 | AZ | CIDR | 自動パブリックIP |
|------------|------|-----|------|------------------|
| training-01-subnet-pub-1a | パブリック | ap-northeast-1a | 10.0.10.0/24 | 有効 |
| training-01-subnet-pri-1a | プライベート | ap-northeast-1a | 10.0.20.0/24 | - |
| training-01-subnet-pri-1c | プライベート | ap-northeast-1c | 10.0.21.0/24 | - |

### ルートテーブル
| リソース名 | 種別 | 関連付けるサブネット | デフォルトルート |
|------------|------|----------------------|------------------|
| training-01-rtb-pub | パブリック | training-01-subnet-pub-1a | 0.0.0.0/0 → training-01-igw |
| training-01-rtb-pri | プライベート | training-01-subnet-pri-1a, training-01-subnet-pri-1c | なし |

## 2. セキュリティ設定

### セキュリティグループ
| リソース名 | 用途 | インバウンドルール | アウトバウンドルール |
|------------|------|-------------------|---------------------|
| training-01-sg-web | Webサーバー | TCP/22: 0.0.0.0/0<br>TCP/80: 0.0.0.0/0<br>TCP/3000: 0.0.0.0/0 | ALL: 0.0.0.0/0 |
| training-01-sg-db | データベース | TCP/5432: training-01-sg-web | ALL: 0.0.0.0/0 |

## 3. コンピューティング設定

### EC2インスタンス
| リソース名 | 設定項目 | 値 |
|------------|----------|-----|
| training-01-instance-web | AMI | Amazon Linux 2023 |
| | インスタンスタイプ | t2.micro |
| | サブネット | training-01-subnet-pub-1a |
| | セキュリティグループ | training-01-sg-web |
| | ストレージ | 10GB (gp3) |
| | キーペア | training-01-key-web |

### Elastic IP
| リソース名 | 設定項目 | 値 |
|------------|----------|-----|
| training-01-eip-web | アタッチ先 | training-01-instance-web |

### ロードバランサー
| リソース名 | 設定項目 | 値 |
|------------|----------|-----|
| training-01-elb | スキーム | インターネット向け |
| | VPC | training-01-vpc |
| | リスナー | HTTP/80 |
| | セキュリティグループ | training-01-sg-web |
| training-01-tg-web | ヘルスチェックパス | /health |

## 4. ストレージ設定

### S3バケット
| リソース名 | 設定項目 | 値 |
|------------|----------|-----|
| training-01-s3 | リージョン | ap-northeast-1 |
| | パブリックアクセス | すべてブロック |

## 5. CDN設定

### CloudFront
| リソース名 | 設定項目 | 値 |
|------------|----------|-----|
| - | オリジンドメイン | training-01-s3.s3.amazonaws.com |
| | アクセス制御 | Origin access control |
| | WAF | 有効 |

## 6. セキュリティ設定

### WAF
| リソース名 | 設定項目 | 値 |
|------------|----------|-----|
| training-01-waf | リソースタイプ | CloudFront |
| | 防御ルール | SQLインジェクション<br>クロスサイトスクリプティング<br>リクエストレート制限 |