Fargate で運用する Next.js + Go + RDS の Docker 構成を作成します。



まず、プロジェクトの基本構造を示します：

```text
.
├── frontend/                 # Next.js フロントエンド
│   ├── Dockerfile
│   └── package.json
├── backend/                  # Go バックエンド
│   ├── Dockerfile
│   └── main.go
├── docker-compose.yml       # ローカル開発用
└── .env                     # 環境変数
```

それでは各コンポーネントのコードを作成していきます：

1. **Frontend (Next.js) Dockerfile**:

```dockerfile
# ビルドステージ
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 実行ステージ
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
```

2. **Backend (Go) Dockerfile**:

```dockerfile
# ビルドステージ
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# 実行ステージ
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
COPY --from=builder /app/.env .

EXPOSE 8080
CMD ["./main"]
```

3. **docker-compose.yml**:

```yaml
version: '3.8'
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8080
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - DB_HOST=db
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME}
      - DB_PORT=5432
    depends_on:
      - db

  db:
    image: postgres:14-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

4. **Backend Go コードサンプル** (main.go):

```go
package main

import (
    "database/sql"
    "encoding/json"
    "log"
    "net/http"
    "os"

    "github.com/gorilla/mux"
    _ "github.com/lib/pq"
)

type App struct {
    Router *mux.Router
    DB     *sql.DB
}

func (app *App) Initialize() {
    connectionString :=
        fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
            os.Getenv("DB_HOST"),
            os.Getenv("DB_PORT"),
            os.Getenv("DB_USER"),
            os.Getenv("DB_PASSWORD"),
            os.Getenv("DB_NAME"))

    var err error
    app.DB, err = sql.Open("postgres", connectionString)
    if err != nil {
        log.Fatal(err)
    }

    app.Router = mux.NewRouter()
    app.initializeRoutes()
}

func (app *App) initializeRoutes() {
    app.Router.HandleFunc("/api/health", app.healthCheck).Methods("GET")
    // 他のルートを追加
}

func (app *App) healthCheck(w http.ResponseWriter, r *http.Request) {
    json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}

func main() {
    app := App{}
    app.Initialize()
    
    log.Fatal(http.ListenAndServe(":8080", app.Router))
}
```

5. **Frontend Next.js サンプル** (pages/index.js):

```javascript
import { useEffect, useState } from 'react'

export default function Home() {
  const [healthStatus, setHealthStatus] = useState(null)

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health')
        const data = await response.json()
        setHealthStatus(data.ok)
      } catch (error) {
        console.error('Health check failed:', error)
        setHealthStatus(false)
      }
    }

    checkHealth()
  }, [])

  return (
    <div>
      <h1>Next.js + Go + PostgreSQL Demo</h1>
      <p>API Status: {healthStatus ? '🟢 Healthy' : '🔴 Unhealthy'}</p>
    </div>
  )
}
```

6. **AWS Fargate 用の Task Definition サンプル**:

```json
{
  "family": "app-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "frontend",
      "image": "${ECR_REGISTRY}/frontend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NEXT_PUBLIC_API_URL",
          "value": "http://backend:8080"
        }
      ]
    },
    {
      "name": "backend",
      "image": "${ECR_REGISTRY}/backend:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DB_HOST",
          "value": "${RDS_ENDPOINT}"
        },
        {
          "name": "DB_PORT",
          "value": "5432"
        }
      ],
      "secrets": [
        {
          "name": "DB_USER",
          "valueFrom": "${SECRETS_ARN}:db_user::"
        },
        {
          "name": "DB_PASSWORD",
          "valueFrom": "${SECRETS_ARN}:db_password::"
        },
        {
          "name": "DB_NAME",
          "valueFrom": "${SECRETS_ARN}:db_name::"
        }
      ]
    }
  ]
}
```

このサンプルを使用する際の注意点：

1. **ローカル開発**:
   ```bash
   docker-compose up --build
   ```

2. **Fargate デプロイ前の準備**:
   - ECRリポジトリの作成
   - RDSインスタンスの作成
   - Secrets Managerでの認証情報管理
   - VPCとセキュリティグループの設定

3. **セキュリティ考慮事項**:
   - 本番環境ではSSL/TLS証明書の設定
   - セキュリティグループの適切な設定
   - Secrets Managerの使用
   - CORSの適切な設定

4. **スケーリング**:
   - Application Auto Scalingの設定
   - ALBヘルスチェックの設定
   - CloudWatchメトリクスの設定

このサンプルは基本的な構成を示していますが、実際の運用では要件に応じて適切にカスタマイズする必要があります。