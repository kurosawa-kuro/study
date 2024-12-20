```
S3（Storage）

静的コンテンツの保存場所
CloudFrontのオリジンとなる
最も基本的なストレージサービス


RDS（Database）

データベースの初期化に時間がかかる
セキュリティグループの設定
パラメータグループの設定


EC2（Compute）

アプリケーションサーバー
セキュリティグループの設定
RDSへの接続確認


ALB（Load Balancer）

EC2インスタンスへのトラフィック分散
ターゲットグループの設定
ヘルスチェックの設定


CloudFront（CDN）

S3やALBをオリジンとして設定
キャッシュ設定
SSL/TLS証明書の設定


WAF（Security）

CloudFrontまたはALBに関連付け
セキュリティルールの設定
アクセス制御の設定


Route53（DNS）

ドメインの設定
CloudFrontやALBへのルーティング
ヘルスチェックの設定
```

## 1. 初期設定
### 1.1 IAM設定
- EC2ロール名: training-01-role-ec2
- RDSロール名: training-01-role-rds

### 1.2 Cloudwatch設定
- ロググループ名: training-01-log-web
- メトリクス名前空間: training-01-metrics-web

### 1.3 CloudTrail設定
- 証跡名: training-01-trail
- S3バケット: training-01-bucket-trail