# AWS CDK 作業手順書

## 1. 前提条件
- AWS CLIがインストール済み
- AWS認証情報が設定済み
- CDKプロジェクトが初期化済み

## 2. キーペアの作成
```bash
# EC2インスタンス用のキーペア作成
aws ec2 create-key-pair \
  --key-name training-03-key-web \
  --query 'KeyMaterial' \
  --output text > training-03-key-web.pem

# キーペアのパーミッション設定（セキュリティ要件）
chmod 400 training-03-key-web.pem
```

## 3. デプロイコマンド

### 通常デプロイ
```bash
# ブートストラップとデプロイを実行（承認なし）
cdk bootstrap && cdk deploy --require-approval never
```

### 再デプロイ（完全リセット）
```bash
# スタックの削除、再ブートストラップ、再デプロイを一括実行
cdk destroy --force && cdk bootstrap && cdk deploy --require-approval never
```


```
# Nginxの設定

# 設定ファイルの作成
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)

sudo tee /etc/nginx/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /run/nginx.pid;

# Load dynamic modules. See /usr/share/doc/nginx/README.dynamic.
include /usr/share/nginx/modules/*.conf;

events {
   worker_connections 1024;
}

http {
   log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                     '$status $body_bytes_sent "$http_referer" '
                     '"$http_user_agent" "$http_x_forwarded_for"';

   access_log  /var/log/nginx/access.log  main;
   sendfile            on;
   tcp_nopush          on;
   keepalive_timeout   65;
   types_hash_max_size 4096;

   include             /etc/nginx/mime.types;
   default_type        application/octet-stream;

   # Load modular configuration files from the /etc/nginx/conf.d directory.
   include /etc/nginx/conf.d/*.conf;
}
EOF

sudo tee /etc/nginx/conf.d/express-api.conf << 'EOF'
# /etc/nginx/conf.d/express.conf
server {
    listen 80;
    server_name _;

    # クライアントリクエストボディサイズの制限を設定
    client_max_body_size 10M;  # 10MBまで許可

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # アップロードのタイムアウト設定
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
EOF

# 設定の反映
sudo nginx -t            # 構文チェック
sudo systemctl restart nginx  # 再起動

```

```
git clone https://github.com/kurosawa-kuro/enviroment.git
cd enviroment/sample/nodejs/express-uploader
npm install

# .envファイルの作成

# データベースのマイグレーション
npx prisma migrate dev --name init
npx prisma generate

# アプリケーションの起動
node app.js
```

```
aws ec2 create-key-pair --key-name training-03-key-web --query 'KeyMaterial' --output text > training-03-key-web.pem
chmod 400 training-03-key-web.pem
```