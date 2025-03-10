# AWS Fargate デプロイ手順書

## 1. 事前準備
ECRリポジトリ名: fargate-express-03-repository
対象リージョン: ap-northeast-1
アカウントID: 476114153361

### 2.1 VPC作成
1. VPCダッシュボードから「VPCを作成」を選択します
2. 以下の項目を設定：
   - 名前タグ: fargate-express-03-vpc
   - IPv4 CIDR: 10.3.0.0/16


サブネット、ルートテーブル、IGWの設定も結局必要

## 3. セキュリティグループ設定
### 3.1 Webサーバー用セキュリティグループ
1. 基本設定：
   - セキュリティグループ名: fargate-express-03-sg-web
   - VPC選択: fargate-express-03-vpc
2. インバウンドルール設定：
   - TCP (8080番ポート): 0.0.0.0/0
3. アウトバウンドルール設定：
   - すべてのトラフィック: 0.0.0.0/0


## 2. ECRリポジトリ設定

### 2.1 リポジトリ作成
1. AWSコンソール → ECR に移動
2. 「リポジトリの作成」をクリック
3. リポジトリ名を入力: fargate-express-03-repository
4. その他はデフォルト値で作成

### 2.2 イメージのビルドとプッシュ

```bash
# ECRログイン
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 476114153361.dkr.ecr.ap-northeast-1.amazonaws.com

# イメージビルド
docker build -t fargate-express-03-repository .

# タグ付け
docker tag fargate-express-03-repository:latest 476114153361.dkr.ecr.ap-northeast-1.amazonaws.com/fargate-express-03-repository:latest

# プッシュ
docker push 476114153361.dkr.ecr.ap-northeast-1.amazonaws.com/fargate-express-03-repository:latest
```

### 2.3 動作確認用コマンド

```bash
# ECRログイン
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 476114153361.dkr.ecr.ap-northeast-1.amazonaws.com

# イメージプル
docker pull 476114153361.dkr.ecr.ap-northeast-1.amazonaws.com/fargate-express-03-repository:latest

# ローカル実行
docker run -p 8080:8080 476114153361.dkr.ecr.ap-northeast-1.amazonaws.com/fargate-express-03-repository:latest

# ログ確認
docker logs $(docker ps -q --filter ancestor=476114153361.dkr.ecr.ap-northeast-1.amazonaws.com/fargate-express-03-repository:latest)
```

## 3. ECSリソース設定

### 3.1 クラスター作成
1. AWSマネジメントコンソール → ECS → クラスター → 作成
2. 基本設定
   - クラスター名: fargate-express-03-cluster
   - その他設定: デフォルト値を使用

### 3.2 タスク定義作成
1. ECS → タスク定義 → 作成
2. 基本設定
   - ファミリー名: fargate-express-03-task
3. コンテナ設定
   - コンテナ名: fargate-express-03
   - イメージURI: 476114153361.dkr.ecr.ap-northeast-1.amazonaws.com/aws-fargate-express-01-repository
4. ポート設定
   - コンテナポート: 8080
   - プロトコル: None
5. 環境変数
   - APP_ENV: production
   - DATABASE_URL: postgresql://neondb_owslmode=require

### 3.3 サービス作成
1. クラスター → サービス → 作成
2. デプロイ設定
   - ファミリー: fargate-express-03-task
   - サービス名: fargate-express-03-service
3. ネットワーク設定
   - VPC: デフォルトVPC
   - サブネット: パブリックサブネット選択
   - パブリックIP: 有効化
4. セキュリティグループ
   - 新規作成
   - インバウンドルール: TCP/8080/Anywhere

## 4. 動作確認

### 4.1 デプロイ確認
```bash
# ログストリーム確認
aws logs get-log-events --log-group-name /ecs/fargate-express-03-task --log-stream-name $(aws logs describe-log-streams --log-group-name /ecs/fargate-express-03-task --query 'logStreams[0].logStreamName' --output text)
```

### 4.2 アクセス確認
1. ECSコンソール → タスク → パブリックIP確認
2. ブラウザで `http://<パブリックIP>:8080` にアクセス

## 5. トラブルシューティング

### 5.1 チェック項目
- タスク定義の登録状態
- サービスの起動状態
- コンテナの稼働状態
- 環境変数の設定状態
- ネットワーク設定の確認

### 5.2 エラー対応
1. タスク起動エラー
   - CloudWatchログ確認
   - セキュリティグループ確認
2. アプリケーションアクセスエラー
   - パブリックIP割当確認
   - ポート開放確認
3. コンテナ起動エラー
   - イメージプル権限確認
   - リソース設定確認

### 5.3 注意事項
- 環境変数の機密情報はパラメータストア推奨
- セキュリティグループは本番環境で要制限
- ログは定期的な確認が必要