# Git/CI/CD運用ガイドライン

## 1. 初期設定手順

### 1.1 リポジトリのクローンと初期ブランチ構成
```bash
# リポジトリのクローン
git clone <repository-url>
cd <repository-name>

# 基本ブランチの作成
git checkout -b main
git push -u origin main

git checkout main
git checkout -b develop
git push -u origin develop

git checkout develop
git checkout -b staging
git push -u origin staging
```

### 1.2 Gitリポジトリの保護設定
GitHubの Settings → Branches で以下を保護:
- main
- develop
- staging

## 2. 環境構成

### 2.1 インフラ環境
```yaml
開発環境（Lightsail）:
  用途: 個人開発作業
  特徴: 常時稼働の開発サーバー

ステージング環境（Lightsail）:
  用途: 開発コードの検証
  特徴: developブランチと連動
  デプロイ: 自動（develop更新時）

本番環境（Fargate）:
  用途: 本番サービス提供
  デプロイ: 自動（main更新時）
```

## 3. CI/CD設定

### 3.1 GitHub Secrets設定
```yaml
必須シークレット:
  STAGING_IP: Lightsailの静的IP
  SSH_PRIVATE_KEY: デプロイ用SSH鍵
  ENV_FILE: 環境変数設定
```

### 3.2 CI/CDフロー
```yaml
feature PR時:
  - ビルド検証
  - ユニットテスト
  - コード品質チェック
  - セキュリティスキャン

develop更新時:
  - イメージビルド・ECRプッシュ
  - 統合テスト
  - Lightsailへの自動デプロイ

main更新時:
  - 本番用ビルド・テスト
  - Fargateへの自動デプロイ
```

## 4. 開発フロー

### 4.1 機能開発サイクル
1. **開発作業**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/機能名

# 開発・コミット
git add .
git commit -m "feat: 機能の説明"
git push -u origin feature/機能名
```

2. **レビュー＆マージ**
- PRを作成（feature → develop）
- CIテスト完了確認
- コードレビュー実施
- developへマージ

### 4.2 コミットメッセージ規則
```yaml
形式: <type>: <description>

type:
  feat: 新機能
  fix: バグ修正
  docs: ドキュメント
  style: コード整形
  refactor: リファクタリング
  test: テスト
  chore: ビルド設定
```

## 5. デプロイ設定

### 5.1 Staging自動デプロイ設定
```yaml
ame: Deploy to Staging

on:
  push:
    branches:
      - develop

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Create .env file
        run: |
          echo "${{ secrets.ENV_FILE }}" > .env

      - name: Deploy to Lightsail
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.STAGING_IP }}
          username: ec2-user
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            # アプリケーションディレクトリに移動
            cd /home/ec2-user/dev/infra-devcontainer-aws-cdk-cicd-nodejs

            # 既存のプロセスを停止
            npm run pm2-stop || true

            # リポジトリの更新
            git pull origin develop

            # 依存関係のインストール
            npm ci

            # 環境変数ファイルの作成
            echo "${{ secrets.ENV_FILE }}" > .env

            # アプリケーションの起動
            npm run staging
```

## 6. トラブルシューティング
```bash
# 作業リセット
git reset --hard origin/feature/機能名

# 最新変更の取込
git checkout feature/機能名
git rebase develop
```

このガイドラインに従うことで、効率的な開発フローと安定したデプロイを実現します。