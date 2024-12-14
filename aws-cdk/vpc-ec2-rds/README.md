# AWS CDK インフラ構築手順書

## 1. 事前準備
### 1.1 必要な環境
- AWS CLIのインストールと設定
- AWS認証情報の設定
- Node.jsとnpm
- CDKプロジェクトの初期化

### 1.2 環境変数の設定
```bash
# 必須の環境変数
ENVIRONMENT=       # 環境名（例：training-04）
ENABLE_RDS=       # RDSの有効化（true/false）
ENABLE_EIP=       # Elastic IPの有効化（true/false）
SSH_KEY_NAME=     # SSHキーペア名
DATABASE_NAME=    # データベース名
DATABASE_USERNAME= # DBユーザー名
DATABASE_PASSWORD= # DBパスワード
```

## 2. インフラ構築手順
### 2.1 SSH接続用キーペアの作成
```bash
# キーペアの作成
aws ec2 create-key-pair \
  --key-name training \
  --query 'KeyMaterial' \
  --output text > training.pem

# 権限の設定
chmod 400 training-04-key-web.pem
```

### 2.2 CDKによるデプロイ
```bash
# 通常デプロイ
export ENVIRONMENT=training-01-stg
cdk bootstrap && cdk deploy --require-approval never

# 完全リセット（再デプロイ）
cdk destroy --force && cdk bootstrap && cdk deploy --require-approval never
```

### 2.3 初期設定の確認
```bash
# 基本サービスの確認
node --version
npm --version
psql --version
nginx -v

# サービスの状態確認
systemctl status postgresql
systemctl status nginx
firewall-cmd --list-all
```

## 3. 各種サービスの設定
### 3.1 Nginxの設定
- 基本設定ファイルの作成
- リバースプロキシの設定
- アップロード制限の設定（10MB）
- タイムアウト設定（300秒）

### 3.2 pgAdminの設定
- サービス設定ファイルの作成
- 環境変数の設定
- システムサービスの登録と起動

### 3.3 アクセス情報
```
# pgAdmin
URL: http://[EC2のIP]/pgadmin4/
メール: admin@example.com
パスワード: admin123

# アプリケーション
Express API: http://[EC2のIP]/
```

## 4. インフラ構成仕様
### 4.1 ネットワーク
- VPC: 10.0.0.0/16
- パブリックサブネット: 10.0.10.0/24, 10.0.11.0/24
- プライベートサブネット: 10.0.20.0/24, 10.0.21.0/24

### 4.2 コンピューティング
- EC2: t2.micro, Amazon Linux 2023
- RDS: PostgreSQL 12, t3.micro
- S3: プライベートバケット

### 4.3 セキュリティ
- Webサーバー: SSH(22), HTTP(80)
- データベース: PostgreSQL(5432)からのアクセスのみ許可

このドキュメントは、実行順序に沿って整理し、各セクションの依存関係を考慮した構成としています。