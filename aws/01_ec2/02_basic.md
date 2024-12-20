# AWSインフラ構築設計書

## 1. 概要
本設計書は、training-01プレフィックスを使用したAWSインフラの構築手順を定義します。

## 2. ネットワーク構成
### 2.1 VPC作成
1. VPCダッシュボードで「VPCを作成」を選択
2. 設定項目：
   - 名前タグ: training-01-vpc
   - IPv4 CIDR: 10.0.0.0/16
   - テナンシー: デフォルト
   - DNSホスト名: 有効化
   - DNSリゾルーション: 有効化

### 2.2 インターネットゲートウェイ作成
1. IGWダッシュボードで「インターネットゲートウェイを作成」を選択
2. 設定項目：
   - 名前タグ: training-01-igw
3. 作成後、training-01-vpcにアタッチ

### 2.3 サブネット作成
#### パブリックサブネット作成
1. サブネットダッシュボードで「サブネットを作成」を選択
2. 設定項目：
   - VPC: training-01-vpc
   - 名前タグ: training-01-subnet-pub-1a
   - アベイラビリティゾーン: ap-northeast-1a
   - IPv4 CIDR: 10.0.10.0/24
   - 自動パブリックIP割り当て: 有効化

#### プライベートサブネット作成
1. プライベートサブネット1の設定：
   - VPC: training-01-vpc
   - 名前タグ: training-01-subnet-pri-1a
   - アベイラビリティゾーン: ap-northeast-1a
   - IPv4 CIDR: 10.0.20.0/24

2. プライベートサブネット2の設定：
   - VPC: training-01-vpc
   - 名前タグ: training-01-subnet-pri-1c
   - アベイラビリティゾーン: ap-northeast-1c
   - IPv4 CIDR: 10.0.21.0/24

### 2.4 ルートテーブル設定
#### パブリックルートテーブル作成
1. ルートテーブルダッシュボードで「ルートテーブルを作成」を選択
2. 設定項目：
   - 名前タグ: training-01-rtb-pub
   - VPC: training-01-vpc
3. ルート設定：
   - 0.0.0.0/0: training-01-igw
4. サブネット関連付け：
   - training-01-subnet-pub-1a

#### プライベートルートテーブル作成
1. 設定項目：
   - 名前タグ: training-01-rtb-pri
   - VPC: training-01-vpc
2. サブネット関連付け：
   - training-01-subnet-pri-1a
   - training-01-subnet-pri-1c

## 3. セキュリティグループ設定
### 3.1 Webサーバー用セキュリティグループ
1. セキュリティグループダッシュボードで「セキュリティグループを作成」を選択
2. 基本設定：
   - 名前タグ: training-01-sg-web
   - VPC: training-01-vpc
3. インバウンドルール：
   - SSH (22): 0.0.0.0/0
   - HTTP (80): 0.0.0.0/0
   - TCP (3000): 0.0.0.0/0
4. アウトバウンドルール：
   - すべてのトラフィック: 0.0.0.0/0

### 3.2 データベース用セキュリティグループ
1. 基本設定：
   - 名前タグ: training-01-sg-db
   - VPC: training-01-vpc
2. インバウンドルール：
   - PostgreSQL (5432): training-01-sg-web
3. アウトバウンドルール：
   - すべてのトラフィック: 0.0.0.0/0

## 4. コンピューティングリソース設定
### 4.1 EC2インスタンス作成
1. EC2ダッシュボードで「インスタンスを起動」を選択
2. 基本設定：
   - 名前タグ: training-01-instance-web
   - AMI: Amazon Linux 2023
   - インスタンスタイプ: t2.micro
3. ネットワーク設定：
   - VPC: training-01-vpc
   - サブネット: training-01-subnet-pub-1a
   - セキュリティグループ: training-01-sg-web
4. ストレージ設定：
   - ルートボリューム: 10GB
5. キーペア設定：
   - 名前: training-01-key-web

### 4.2 Elastic IP設定
1. Elastic IPダッシュボードで「Elastic IPアドレスの割り当て」を選択
2. 設定項目：
   - 名前タグ: training-01-eip-web
3. 作成後、training-01-instance-webにアタッチ

### 4.3 ロードバランサー設定
1. ELBダッシュボードで「ロードバランサーを作成」を選択
2. 基本設定：
   - 名前: training-01-elb
   - スキーム: インターネット向け
   - VPC: training-01-vpc
3. リスナー設定：
   - HTTP (80)
4. セキュリティ設定：
   - セキュリティグループ: training-01-sg-web
5. ルーティング設定：
   - ターゲットグループ: training-01-tg-web
   - ヘルスチェック: 有効化

## 5. ストレージ設定
### 5.1 S3バケット作成
1. S3ダッシュボードで「バケットを作成」を選択
2. 基本設定：
   - バケット名: training-01-s3
   - リージョン: ap-northeast-1
3. アクセス設定：
   - パブリックアクセス: ブロック
   - バケットポリシー: CloudFront設定時に更新

## 6. CDN設定
### 6.1 CloudFront設定
1. CloudFrontダッシュボードで「ディストリビューションを作成」を選択
2. オリジン設定：
   - オリジンドメイン: training-01-s3.s3.amazonaws.com
3. 設定項目：
   - 価格クラス: すべてのエッジロケーション
   - SSL証明書: デフォルト

## 7. セキュリティ設定
### 7.1 WAF設定
1. WAFダッシュボードで「Webアクセスコントロールリストの作成」を選択
2. 基本設定：
   - 名前: training-01-waf
   - リソースタイプ: CloudFront
3. ルール設定：
   - SQLインジェクション対策
   - クロスサイトスクリプティング対策
   - レートベース制限

## 8. Route53設定
1. Route53ダッシュボードで「ホストゾーンの作成」を選択
2. レコード設定：
   - タイプ: A
   - エイリアス: CloudFrontディストリビューション