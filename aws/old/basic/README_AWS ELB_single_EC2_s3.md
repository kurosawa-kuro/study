以下が修正を反映した手順です：

AWSコンソールでALB（Application Load Balancer）とEC2を構築する手順を説明します。

1. VPCの作成
- AWSコンソールで「VPC」を選択
- 「VPCを作成」をクリック
- 名前タグ: alb-single-ec2-02-vpc
- IPv4 CIDR: 10.0.0.0/16
- パブリックサブネットを2つ作成
  - 1つ目:
    - 名前タグ: alb-single-ec2-02-public-subnet-1a
    - CIDR: 10.0.1.0/24
    - AZ: ap-northeast-1a
  - 2つ目:
    - 名前タグ: alb-single-ec2-02-public-subnet-1c
    - CIDR: 10.0.2.0/24
    - AZ: ap-northeast-1c

2. インターネットゲートウェイの作成とアタッチ
- VPCダッシュボードで「インターネットゲートウェイ」を選択
- 「インターネットゲートウェイを作成」をクリック
  - 名前タグ: alb-single-ec2-02-igw
- 作成後、作成したVPC(alb-single-ec2-02-vpc)にアタッチ

3. ルートテーブルの設定
- VPCダッシュボードで「ルートテーブル」を選択
- 「ルートテーブルを作成」をクリック
  - 名前タグ: alb-single-ec2-02-public-rt
  - VPC: 作成したVPC
- ルートの編集
  - 0.0.0.0/0 → 作成したインターネットゲートウェイ(alb-single-ec2-02-igw)
- サブネットの関連付け
  - 作成した2つのパブリックサブネットを関連付け

4. セキュリティグループの作成
- VPCダッシュボードで「セキュリティグループ」を選択
- 「セキュリティグループを作成」をクリック

ALB用SG:
- 名前: alb-single-ec2-02-alb-sg
- インバウンドルール:
  - タイプ: HTTP
  - ポート: 80 （重要: 標準的なHTTPポートを使用）
  - ソース: 0.0.0.0/0

EC2用SG:
- 名前: alb-single-ec2-02-ec2-sg
- インバウンドルール:
  - タイプ: SSH
  - ポート: 22
  - ソース: 0.0.0.0/0
- インバウンドルール:
  - タイプ: カスタムTCP
  - ポート: 8080
  - ソース: ALBのSG （重要: ALBのセキュリティグループIDを指定,alb-single-ec2-02-alb-sg）

5. EC2インスタンスの作成
- EC2ダッシュボードで「インスタンスを起動」をクリック
- 名前: alb-single-ec2-02-instance
- AMI: Amazon Linux 2023
- インスタンスタイプ: t2.micro
- ネットワーク設定:
  - VPC: 作成したVPC
  - サブネット: public-subnet-1a
  - パブリックIPの自動割り当て: 有効
  - セキュリティグループ: EC2用SG(alb-single-ec2-02-ec2-sg)

6. ターゲットグループの作成
- EC2ダッシュボードで「ターゲットグループ」を選択
- 「ターゲットグループの作成」をクリック
  - 名前: alb-single-ec2-02-tg
  - ターゲットタイプ: インスタンス
  - プロトコル: HTTP
  - ポート: 8080
  - VPC: 作成したVPC
  - ヘルスチェック設定:
    - パス: /health （重要: アプリケーションのヘルスチェックエンドポイントを使用）
    - ポート: 8080
    - 正常しきい値: 5
    - 非正常しきい値: 2
    - タイムアウト: 5秒
    - 間隔: 30秒
  - ターゲットの登録: （重要: この時点でEC2インスタンスを登録）
    - 作成したEC2インスタンスを選択して「保留中として登録」をクリック
    - 「ターゲットの登録」をクリック

7. ALBの作成
- EC2ダッシュボードで「ロードバランサー」を選択
- 「ロードバランサーの作成」→「Application Load Balancer」を選択
- 基本設定:
  - 名前: alb-single-ec2-02-alb
  - スキーム: インターネット向け
  - IPアドレスタイプ: IPv4

- ネットワークマッピング:
  - VPC: 作成したVPC
  - サブネット: 1aと1cの両方のパブリックサブネットを選択

- セキュリティグループ:
  - ALB用SGを選択（重要: ポート80を許可しているSGを選択,alb-single-ec2-02-alb-sg）

- リスナーとルーティング:
  - プロトコル: HTTP
  - ポート: 80 （重要: 標準的なHTTPポートを使用）
  - ターゲットグループ: 作成済みのターゲットグループを選択(alb-single-ec2-02-tg)


これで、ALBのDNS名にアクセスすると、EC2上で動作するExpressアプリケーション（ポート8080）にトラフィックが転送される設定が完了します。



8. S3バケットの作成と設定
- バケット名: alb-single-ec2-02-s3
- リージョン: ap-northeast-1（東京）
- パブリックアクセス設定：
  - **重要**: 「パブリックアクセスをすべてブロック」の4つのチェックボックスをすべてオフにする
  - これをオフにしないとバケットポリシーが設定できない
  - 警告が表示されるが、この設定で進める

9. S3バケットポリシーの設定
- バケットを選択 → 「アクセス許可」タブ → 「バケットポリシー」
- **注意**: バケットポリシーエディタに貼り付ける際、余分な空白や改行がないように注意
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

10. CORSの設定
- バケットを選択 → 「アクセス許可」タブ → 「クロスオリジンリソース共有（CORS）」
- **重要**: すべての設定を削除してから新しい設定を貼り付ける
```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "ETag"
        ]
    }
]
```

11. IAMロールの作成
1. IAMコンソールで「ロール」を選択
2. 「ロールを作成」をクリック
3. **信頼されたエンティティの種類**: AWS サービス
4. **ユースケース**: EC2 を選択
5. **次へ** をクリック
6. **「許可を追加」で新しいポリシーを作成**:
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
7. ポリシー名を入力: `alb-single-ec2-02-policy`
8. ポリシーを作成
9. ロールに戻り、作成したポリシーを選択
10. ロール名を入力: `alb-single-ec2-02-role`
11. ロールを作成

12. EC2インスタンスにIAMロールを割り当て
1. EC2インスタンスを選択
2. 「アクション」→「セキュリティ」→「IAMロールを変更」
3. ドロップダウンから `alb-single-ec2-02-role` を選択
4. 「保存」をクリック
5. **重要**: 反映まで数分待つ

13. 動作確認
```bash
# EC2インスタンスにSSH接続
ssh -i key.pem ec2-user@[パブリックIP]

# S3バケットの一覧を表示（アクセス権限の確認）
aws s3 ls s3://alb-single-ec2-02-s3

# テスト用ファイルを作成してアップロード
echo "test" > test.txt
aws s3 cp test.txt s3://alb-single-ec2-02-s3/

# アップロードされたことを確認
aws s3 ls s3://alb-single-ec2-02-s3/test.txt
```

よくあるエラーと対処：
1. バケットポリシーが設定できない
   → パブリックアクセスブロックをすべてオフにする

2. Permission denied エラー
   → IAMロールの反映を待つ（数分）
   → バケット名が正しいか確認

3. CORS エラー
   → CORSの設定を確認
   → 設定後、ブラウザのキャッシュをクリア