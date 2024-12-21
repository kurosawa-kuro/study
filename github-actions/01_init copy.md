```
GitHubリポジトリの Settings > Secrets and variables > Actions で以下のシークレットを設定してください：
```


```
STAGING_IP: LightsailインスタンスのIPアドレス
SSH_PRIVATE_KEY: SSH秘密鍵
ENV_FILE: 環境変数ファイルの内容
```




```
name: Deploy to Staging

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