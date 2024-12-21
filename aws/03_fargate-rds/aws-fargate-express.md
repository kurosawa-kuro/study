# AWS FargateでExpress APIをデプロイする手順書

## 1. セキュリティグループ設定
```yaml
名前: aws-fargate-express-01-sg-web
インバウンドルール:
  - HTTP (80): 0.0.0.0/0
  - アプリポート (8080): 0.0.0.0/0
```

## 2. アプリケーション準備

### 2.1 コンテナレジストリ作成
```yaml
ECR設定:
  可視性: Private
  名前: aws-fargate-express-01-repository
```

### 2.2 イメージビルドとプッシュ
```bash
# 環境変数設定
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# ECRログイン
aws ecr get-login-password --region ap-northeast-1 | \
docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com

# ビルドとプッシュ
docker build -t aws-fargate-express-01-repository .
docker tag aws-fargate-express-01-repository:latest \
${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/aws-fargate-express-01-repository:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/aws-fargate-express-01-repository:latest
```

## 3. ECS/Fargate設定

### 3.1 タスク定義
```yaml
ファミリー: aws-fargate-express-01-task
コンテナ設定:
  名前: fargate-express
  イメージ: ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/aws-fargate-express-01-repository:latest
  ポート: 8080
リソース:
  CPU: 0.25 vCPU
  メモリ: 0.5 GB
  OS: Linux
```

### 3.2 クラスター作成
```yaml
名前: aws-fargate-express-01-cluster
ネットワーク:
  VPC: デフォルトVPCを使用
  サブネット: デフォルトパブリックサブネットを使用
```

### 3.3 サービスデプロイ
```yaml
サービス設定:
  名前: aws-fargate-express-01-service
  起動タイプ: Fargate
  タスク数: 1
ネットワーク:
  VPC: デフォルトVPC
  サブネット: デフォルトパブリックサブネット
  セキュリティグループ: aws-fargate-express-01-sg-web
  パブリックIP: 自動割り当て
```

## 4. 動作確認

### 4.1 ローカル確認
```bash
docker run -p 8080:8080 aws-fargate-express-01-repository
```

### 4.2 デプロイ確認
1. タスクの状態が「RUNNING」であることを確認
2. パブリックIPアドレスを確認
3. `http://<パブリックIP>:8080` にアクセス
4. レスポンス確認: `{"message":"Hello World from Express!"}`

## 5. CI/CD設定

### 5.1 GitHub Secrets設定
```yaml
必要なシークレット:
  AWS_ACCOUNT_ID: AWSアカウントID
  AWS_REGION: ap-northeast-1
  ECR_REPOSITORY: リポジトリ名
```

このドキュメントは、デフォルトVPCを使用した最小構成でのFargateデプロイ手順を示しています。本番環境では、専用VPC、ALB、CloudWatchの設定を検討してください。