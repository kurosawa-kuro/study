# AWSインフラ構築設計書

## 1. 概要
本設計書は、training-01プレフィックスを使用したAWSインフラの構築手順を定義します。

## 2. ネットワーク構成
### 2.1 VPC作成せずデフォルト

## 3. セキュリティグループ設定
### 3.1 Webサーバー用セキュリティグループ
1. セキュリティグループダッシュボードで「セキュリティグループを作成」を選択
2. 基本設定：
   - 名前タグ: training-01-sg-web
   - VPC: training-01-vpc
3. インバウンドルール：
   - SSH (22): 0.0.0.0/0
   - HTTP (80): 0.0.0.0/0
   - TCP (8080): 0.0.0.0/0
4. アウトバウンドルール：
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
   - ルートボリューム: 8GB
5. キーペア設定：
   - 名前: training-01-key-web

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
オリジンアクセス
Origin access control settings (recommended)

Origin access control
Create new OAC
デフォルトで作成

ウェブアプリケーションファイアウォール (WAF)
セキュリティ保護を有効にする

S3 バケットポリシーを更新する必要があります
ポリシーをコピー

。S3 バケットの権限に移動してポリシーを更新する 
リージョン変更

アクセス許可

バケットポリシー
編集

{
        "Version": "2008-10-17",
        "Id": "PolicyForCloudFrontPrivateContent",
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
            }
        ]
      }


