# AWS インフラ構築手順書

## 1. VPCの作成
1. AWSコンソールで「VPC」を選択
2. 「VPCを作成」をクリック
3. 設定値:
   - 名前タグ: alb-single-ec2-02-vpc
   - IPv4 CIDR: 10.0.0.0/16
4. パブリックサブネットの作成:
   - 1つ目:
     - 名前タグ: alb-single-ec2-02-public-subnet-1a
     - CIDR: 10.0.1.0/24
     - AZ: ap-northeast-1a
   - 2つ目:
     - 名前タグ: alb-single-ec2-02-public-subnet-1c
     - CIDR: 10.0.2.0/24
     - AZ: ap-northeast-1c

## 2. インターネットゲートウェイの設定
1. VPCダッシュボードで「インターネットゲートウェイ」を選択
2. 「インターネットゲートウェイを作成」をクリック
   - 名前タグ: alb-single-ec2-02-igw
3. **重要**: 作成後、必ず作成したVPC(alb-single-ec2-02-vpc)にアタッチする

## 3. ルートテーブルの設定
1. VPCダッシュボードで「ルートテーブル」を選択
2. 「ルートテーブルを作成」をクリック
   - 名前タグ: alb-single-ec2-02-public-rt
   - VPC: 作成したVPC
3. ルートの編集
   - **重要**: 0.0.0.0/0 → 作成したインターネットゲートウェイ(alb-single-ec2-02-igw)を指定
4. サブネットの関連付け
   - **注意**: 作成した2つのパブリックサブネットを必ず関連付ける

## 4. セキュリティグループの作成
1. VPCダッシュボードで「セキュリティグループ」を選択
2. 「セキュリティグループを作成」をクリック

### ALB用セキュリティグループ:
- 名前: alb-single-ec2-02-alb-sg
- インバウンドルール:
  - タイプ: HTTP
  - ポート: 80 （**重要**: 標準的なHTTPポートを使用）
  - ソース: 0.0.0.0/0

### EC2用セキュリティグループ:
- 名前: alb-single-ec2-02-ec2-sg
- インバウンドルール:
  - 1つ目:
    - タイプ: SSH
    - ポート: 22
    - ソース: 0.0.0.0/0
  - 2つ目:
    - タイプ: カスタムTCP
    - ポート: 3000
    - ソース: ALBのSG （**重要**: ALBのセキュリティグループID「alb-single-ec2-02-alb-sg」を指定）

## 5. EC2インスタンスの作成
1. EC2ダッシュボードで「インスタンスを起動」をクリック
2. 基本設定:
   - 名前: alb-single-ec2-02-instance
   - AMI: Amazon Linux 2023
   - インスタンスタイプ: t2.micro
3. ネットワーク設定:
   - VPC: 作成したVPC
   - サブネット: public-subnet-1a
   - パブリックIPの自動割り当て: 有効
   - セキュリティグループ: EC2用SG(alb-single-ec2-02-ec2-sg)

## 6. ターゲットグループの作成
1. EC2ダッシュボードで「ターゲットグループ」を選択
2. 「ターゲットグループの作成」をクリック
3. 基本設定:
   - 名前: alb-single-ec2-02-tg
   - ターゲットタイプ: インスタンス
   - プロトコル: HTTP
   - ポート: 3000
   - VPC: 作成したVPC
4. ヘルスチェック設定:
   - パス: /health （**重要**: アプリケーションのヘルスチェックエンドポイントを使用）
   - ポート: 3000
   - 正常しきい値: 5
   - 非正常しきい値: 2
   - タイムアウト: 5秒
   - 間隔: 30秒
5. ターゲットの登録: （**重要**: この時点でEC2インスタンスを登録）
   - 作成したEC2インスタンスを選択して「保留中として登録」をクリック
   - 「ターゲットの登録」をクリック

## 7. ALBの作成
1. EC2ダッシュボードで「ロードバランサー」を選択
2. 「ロードバランサーの作成」→「Application Load Balancer」を選択
3. 基本設定:
   - 名前: alb-single-ec2-02-alb
   - スキーム: インターネット向け
   - IPアドレスタイプ: IPv4
4. ネットワークマッピング:
   - VPC: 作成したVPC
   - サブネット: **重要**: 1aと1cの両方のパブリックサブネットを選択
5. セキュリティ設定:
   - セキュリティグループ: ALB用SG（**重要**: ポート80を許可しているSGを選択,alb-single-ec2-02-alb-sg）
6. リスナーとルーティング:
   - プロトコル: HTTP
   - ポート: 80 （**重要**: 標準的なHTTPポートを使用）
   - ターゲットグループ: 作成済みのターゲットグループを選択(alb-single-ec2-02-tg)

## 8. S3バケットの作成
1. バケットの基本設定:
   - バケット名: alb-single-ec2-02-s3
   - リージョン: ap-northeast-1（東京）
2. パブリックアクセス設定：
   - **重要**: 「パブリックアクセスをすべてブロック」の4つのチェックボックスをすべてオフにする
   - **注意**: これをオフにしないとバケットポリシーが設定できない
   - **注意**: 警告が表示されるが、この設定で進める

## 9. S3バケットポリシーの設定
1. バケットを選択 → 「アクセス許可」タブ → 「バケットポリシー」
2. **注意**: バケットポリシーエディタに貼り付ける際、余分な空白や改行がないように注意
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": [
                "s3:GetObject",
                "s3:PutObject"
            ],
            "Resource": "arn:aws:s3:::alb-single-ec2-02-s3/*"
        }
    ]
}
```

## 10. CORSの設定
1. バケットを選択 → 「アクセス許可」タブ → 「クロスオリジンリソース共有（CORS）」
2. **重要**: すべての設定を削除してから新しい設定を貼り付ける
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"]
    }
]
```

## 11. IAMロールの作成
1. IAMコンソールで「ロール」を選択
2. 「ロールを作成」をクリック
3. エンティティ設定:
   - **信頼されたエンティティの種類**: AWS サービス
   - **ユースケース**: EC2 を選択
4. **重要**: 「許可を追加」で新しいポリシーを作成
   - 「ポリシーを作成」をクリック
   - JSONタブを選択して以下を貼り付け
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::alb-single-ec2-02-s3",
                "arn:aws:s3:::alb-single-ec2-02-s3/*"
            ]
        }
    ]
}
```
5. ポリシー名を入力: `alb-single-ec2-02-policy`
6. ポリシーを作成
7. ロールに戻り、作成したポリシーを選択
8. ロール名を入力: `alb-single-ec2-02-role`
9. ロールを作成

## 12. EC2インスタンスへのIAMロール割り当て
1. EC2インスタンスを選択
2. 「アクション」→「セキュリティ」→「IAMロールを変更」
3. ドロップダウンから `alb-single-ec2-02-role` を選択
4. 「保存」をクリック