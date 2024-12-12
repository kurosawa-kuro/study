# Express API 環境構築手順書（Amazon Linux 2）

## 1. 事前準備
### 1.1 前提条件
- Amazon Linux 2インスタンス
- セキュリティグループで以下のポートが開放されていること
  - SSH(22)
  - HTTP(80)
- rootまたはsudo権限を持つユーザー

## 2. Node.js環境構築
### 2.1 nvmのインストール
```bash
# システムアップデート
sudo dnf update -y

# Node.jsリポジトリの追加
sudo dnf install -y nodejs

# バージョン確認
node --version
npm --version

# npmのアップデート（必要な場合）
sudo npm install -g npm@latest
```

## 3. アプリケーション構築
### 3.1 プロジェクトの作成
```bash
# プロジェクトディレクトリの作成と移動
mkdir express-api
cd express-api

# package.jsonの初期化
npm init -y

cat << EOF > .env
# アプリケーションポート
BACKEND_PORT=8000
FRONTEND_PORT=3000

# データベース接続情報
DATABASE_HOST=
DATABASE_PORT=5432
DATABASE_DB=training
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
EOF

# Expressフレームワークのインストール
npm install express express-async-handler helmet cors pg dotenv
```

### 3.2 APIの実装
```javascript
# アプリケーションコードの作成
cat > app.js << 'EOF'
const express = require('express');
const asyncHandler = require('express-async-handler');
const helmet = require('helmet');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

// データベース設定
const createDbPool = () => {
  return new Pool({
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    database: process.env.DATABASE_DB,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    },
  });
};

// サーバー設定
const configureServer = (app) => {
  app.use(helmet());
  app.use(cors({
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
  }));
};

// ヘルスチェックハンドラー
const healthCheckHandler = asyncHandler(async (req, res) => {
  res.json({ status: 'healthy' });
});

// データベースヘルスチェックハンドラー
const dbHealthCheckHandler = (pool) => asyncHandler(async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy' });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// メインアプリケーション
const startServer = () => {
  const app = express();
  const port = process.env.PORT || 3001;
  const pool = createDbPool();

  // サーバー設定の適用
  configureServer(app);

  // ルートの設定
  app.get('/api/health', healthCheckHandler);
  app.get('/api/health-rds-postgresql', dbHealthCheckHandler(pool));

  // サーバー起動
  app.listen(port, () => {
    console.log(`APIサーバーが起動しました - ポート${port}`);
  });
};

// アプリケーション起動
startServer();
EOF
```

### 3.3 プロセス管理の設定
```bash
# アプリケーションの起動
pm2 start app.js --name "express-api"

# 起動確認
pm2 status

# 自動起動の設定（sudo権限で実行）
sudo pm2 startup systemd
pm2 save
```


```
curl http://localhost:3001/api/health
curl http://localhost:3001/api/health-rds-postgresql
```

## 4. Webサーバー設定

### 4.2 プロキシ設定
```bash
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

## 5. 動作確認
### 5.1 ローカル確認
```bash
# ヘルスチェック
curl http://localhost/api/health
curl http://localhost/api/health-rds-postgresql
```

### 5.2 外部アクセス確認
ブラウザで以下のURLにアクセス:
```
http://<パブリックIP>/api/health
```

## 6. 運用コマンド集
### 6.1 Nginxの管理
```bash
sudo systemctl status nginx   # 状態確認
sudo systemctl start nginx    # 起動
sudo systemctl stop nginx     # 停止
sudo systemctl restart nginx  # 再起動
```

### 6.2 アプリケーションの管理
```bash
pm2 status                    # 状態確認
pm2 start express-api         # 起動
pm2 stop express-api          # 停止
pm2 restart express-api       # 再起動
pm2 logs express-api          # ログ確認
```

### 6.3 ログの確認
```bash
# Nginxログ
sudo tail -f /var/log/nginx/api-access.log  # アクセスログ
sudo tail -f /var/log/nginx/api-error.log   # エラーログ

# アプリケーションログ
pm2 logs express-api
```