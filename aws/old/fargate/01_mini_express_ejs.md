# AWS Fargate最小構成デプロイ手順（AWS コンソール利用）

## 1. ECRリポジトリ作成
1. AWSコンソール → ECR に移動
2. 「リポジトリの作成」をクリック
3. リポジトリ設定:
   - リポジトリタイプ: プライベート
   - リポジトリ名: aws-fargate-express-01-repository
4. 「リポジトリの作成」をクリック

## 2. Dockerイメージのプッシュ
```bash
# ECRログインコマンドをコンソールからコピー
# リポジトリ → プッシュコマンドの表示 から取得

# イメージのビルドとプッシュ
aws ecr get-login-password --region ap-northeast-1 | \
docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com

docker build -t aws-fargate-express-01-repository -f docker/production.Dockerfile .
docker tag aws-fargate-express-01-repository:latest ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/aws-fargate-express-01-repository:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/aws-fargate-express-01-repository:latest
```

## 3. ECSクラスター作成
1. AWSコンソール → ECS に移動
2. 「クラスターの作成」をクリック
3. クラスター設定:
   - クラスターテンプレート: ネットワーキングのみ
   - クラスター名: aws-fargate-express-01-cluster
4. 「作成」をクリック

## 4. タスク定義作成
1. ECS → タスク定義 → 「新しいタスク定義の作成」
2. 基本設定:
   - タスク定義ファミリー: aws-fargate-express-01-task
   - 起動タイプ: Fargate
   - オペレーティングシステム: Linux
   - タスクロール: ecsTaskExecutionRole
3. タスクサイズ:
   - タスクメモリ: 0.5GB
   - タスクCPU: 0.25 vCPU
4. コンテナ定義:
   - コンテナ名: fargate-express
   - イメージURI: [ECRのイメージURI]
   - ポートマッピング: 8080

## 5. サービス作成
1. クラスター → サービス → 「作成」
2. サービス設定:
   - 起動タイプ: Fargate
   - サービス名: aws-fargate-express-01-service
   - タスクの数: 1
3. ネットワーク設定:
   - VPC: デフォルトVPC
   - サブネット: パブリックサブネットを選択
   - セキュリティグループ: アプリケーションポートを空ける 8080
   - パブリックIP: 自動割り当てを有効化
4. 「サービスの作成」をクリック

## 6. 動作確認
1. ECSクラスター → サービス → タスク
2. 実行中のタスクをクリック
3. パブリックIPを確認
4. ブラウザで `http://<パブリックIP>:8080` にアクセス

## トラブルシューティング
1. タスクが起動しない場合:
   - ECSサービスのイベントタブを確認
   - CloudWatchログを確認
   - セキュリティグループの設定を確認

2. アプリケーションにアクセスできない場合:
   - パブリックIPの割り当てを確認
   - セキュリティグループのインバウンドルール確認
   - コンテナのヘルスチェック確認

ログ確認コマンド

```
aws logs get-log-events --log-group-name /ecs/aws-fargate-express-01-task --log-stream-name $(aws logs describe-log-streams --log-group-name /ecs/aws-fargate-express-01-task --query 'logStreams[0].logStreamName' --output text) | cat
```

```
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 476114153361.dkr.ecr.ap-northeast-1.amazonaws.com

docker pull 476114153361.dkr.ecr.ap-northeast-1.amazonaws.com/aws-fargate-express-01-repository:latest

docker run -p 8080:8080 \
  -e NODE_ENV=development \
  -e APP_PORT=8080 \
  476114153361.dkr.ecr.ap-northeast-1.amazonaws.com/aws-fargate-express-01-repository:latest

docker logs $(docker ps -q --filter ancestor=476114153361.dkr.ecr.ap-northeast-1.amazonaws.com/aws-fargate-express-01-repository:latest)
```
