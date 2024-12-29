# AWS Fargate デプロイ手順書

## 目次
2. [ECRリポジトリ設定](#2-ecrリポジトリ設定)
3. [ECSリソース設定](#3-ecsリソース設定)
4. [動作確認とモニタリング](#4-動作確認とモニタリング)
5. [トラブルシューティング](#5-トラブルシューティング)

```

## 2. ECRリポジトリ設定

### 2.1 リポジトリ作成（コンソール）
1. **移動**: AWSコンソール → ECR


### 2.2 Dockerイメージのビルドとプッシュ
```bash
# ECRログインコマンドをコンソールからコピー
# リポジトリ → プッシュコマンドの表示 から取得

# イメージのビルドとプッシュ
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 476114153361.dkr.ecr.ap-northeast-1.amazonaws.com

docker build -t aws-fargate-express-01-repository .

docker tag aws-fargate-express-01-repository:latest 476114153361.dkr.ecr.ap-northeast-1.amazonaws.com/aws-fargate-express-01-repository:latest

docker push 476114153361.dkr.ecr.ap-northeast-1.amazonaws.com/aws-fargate-express-01-repository:latest
```

```
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 476114153361.dkr.ecr.ap-northeast-1.amazonaws.com

docker pull 476114153361.dkr.ecr.ap-northeast-1.amazonaws.com/aws-fargate-express-01-repository:latest

docker run -p 8080:8080 476114153361.dkr.ecr.ap-northeast-1.amazonaws.com/aws-fargate-express-01-repository:latest

docker logs $(docker ps -q --filter ancestor=476114153361.dkr.ecr.ap-northeast-1.amazonaws.com/aws-fargate-express-01-repository:latest)
```

# ECS設定手順書

## 1. クラスター作成

### 作業手順
1. **コンソール移動**
   - AWSマネジメントコンソール → ECS → クラスター → 作成

2. **基本設定**
   | 項目 | 設定値 |
   |------|--------|
   | クラスター名 | `aws-fargate-express-02-cluster` |
   | その他設定 | デフォルト値を使用 |

## 2. タスク定義作成

### 作業手順
1. **コンソール移動**
   - ECS → タスク定義 → 作成

2. **基本設定**
   | 項目 | 設定値 |
   |------|--------|
   | ファミリー名 | `aws-fargate-express-02-task` |

3. **コンテナ設定**
   | 項目 | 設定値 |
   |------|--------|
   | コンテナ名 | `fargate-express-02` |
   | イメージURI | `476114153361.dkr.ecr.ap-northeast-1.amazonaws.com/aws-fargate-express-01-repository` |

4. **ポート設定**
   | 項目 | 設定値 |
   |------|--------|
   | コンテナポート | `8080` |
   | プロトコル | `None` |

5. **環境変数設定**
   | 変数名 | 値 |
   |--------|-----|
   | `APP_ENV` | `production` |
   | `DATABASE_URL` | `postgresql://neondb_owslmode=require` |

## 3. サービス作成

### 作業手順
1. **コンソール移動**
   - クラスター → サービス → 作成

2. **デプロイ設定**
   | 項目 | 設定値 |
   |------|--------|
   | ファミリー | `aws-fargate-express-02-task` |
   | サービス名 | `aws-fargate-express-02-service` |

3. **ネットワーク設定**
   | 項目 | 設定値 |
   |------|--------|
   | VPC | デフォルトVPC |
   | サブネット | パブリックサブネット |
   | パブリックIP | 有効化 |

4. **セキュリティグループ設定**
   - 新規セキュリティグループ作成
   
   インバウンドルール:
   | タイプ | ポート範囲 | ソース |
   |--------|------------|--------|
   | カスタムTCP | `8080` | `Anywhere` |

### 注意事項
- 環境変数に機密情報が含まれる場合は、AWS Systems Manager パラメータストアの使用を推奨
- セキュリティグループのソースは本番環境では必要に応じて制限することを推奨

### 確認事項
- [ ] タスク定義が正常に登録されているか
- [ ] サービスが正常に作成されているか
- [ ] コンテナが正常に起動しているか
- [ ] 環境変数が正しく設定されているか
- [ ] ポートマッピングが正しく設定されているか


### 4.2 CloudWatchログ確認
```bash
# 最新のログストリーム取得
aws logs get-log-events \
  --log-group-name /ecs/${APP_NAME}-task \
  --log-stream-name $(aws logs describe-log-streams \
    --log-group-name /ecs/${APP_NAME}-task \
    --query 'logStreams[0].logStreamName' \
    --output text)
```

### 4.3 アクセス確認
1. ECSコンソール → タスク → パブリックIP確認
2. ブラウザで確認: `http://<パブリックIP>:8080`

