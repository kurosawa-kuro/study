# aws-ecs-apache


# AWS ECS Apache 環境構築 簡易手順書

## 1. ネットワークリソースの作成

### VPCの作成
1. VPCダッシュボードから「VPCの作成」を選択
2. 以下の設定で作成:
   - VPC名: `ecs-apache-vpc`
   - VPCと追加のリソース: パブリックサブネットを1つ
   - IPv4 CIDR: `10.0.0.0/16`（デフォルト）
   - AZ: 1つのアベイラビリティーゾーン
   - パブリックサブネットCIDR: `10.0.0.0/24`

### セキュリティグループの作成
1. EC2ダッシュボードから「セキュリティグループの作成」を選択
2. 基本情報:
   - セキュリティグループ名: `ecs-apache-sg-web`
   - 説明: Allow HTTP access for Apache container
   - VPC: `ecs-apache-vpc`
3. インバウンドルール:
   - タイプ: HTTP
   - ポート: 80
   - ソース: `0.0.0.0/0`
   - 説明: Allow HTTP inbound

## 2. コンテナイメージの準備

### ECR Publicからイメージの取得
1. [ECR Public Gallery](https://gallery.ecr.aws) にアクセス
2. 検索バーで `httpd` を検索
3. Official Apache HTTP Server イメージを選択
4. イメージURI: `public.ecr.aws/docker/library/httpd:latest`

## 3. ECSリソースの作成

### タスク定義の作成
1. ECSコンソールから「タスク定義」→「新しいタスク定義の作成」を選択
2. 基本設定:
   - ファミリー名: `ecs-apache-task`
   - コンテナ名: `ecs-apache-container`
   - イメージURI: `public.ecr.aws/docker/library/httpd:latest`
   - ポートマッピング: `80`
3. リソース設定:
   - CPU: `.25 vCPU`
   - メモリ: `.5 GB`
   - オペレーティングシステム: `Linux`

### クラスターの作成
1. 「クラスター」→「クラスターの作成」を選択
2. 基本設定:
   - クラスター名: `ecs-apache-cluster`
   - VPC: `ecs-apache-vpc`
   - サブネット: 作成したパブリックサブネットを選択

### サービスの作成
1. クラスター内で「デプロイ」を選択
2. デプロイ設定:
   - サービス名: `ecs-apache-service`
   - コンピューティング方式: `AWS Fargate`
   - プラットフォームバージョン: `LATEST`
   - アプリケーションタイプ: `サービス`
   - タスク定義: `ecs-apache-task`
   - 必要なタスク数: `1`
3. ネットワーク設定:
   - VPC: `ecs-apache-vpc`
   - サブネット: 作成したパブリックサブネットを選択
   - セキュリティグループ: `ecs-apache-sg-web`
   - パブリックIP: 自動割り当てを有効化

## 4. 動作確認手順

1. ECSコンソールでタスクの状態が「RUNNING」になるまで待機（約1-2分）
2. タスクの詳細からパブリックIPアドレスを確認
3. ブラウザで `http://<パブリックIPアドレス>` にアクセス
4. Apache デフォルトページ（"It works!"）の表示を確認

## 作成したリソース一覧

1. ネットワーク:
   - VPC: `ecs-apache-vpc`
   - セキュリティグループ: `ecs-apache-sg-web`

2. ECS:
   - クラスター: `ecs-apache-cluster`
   - タスク定義: `ecs-apache-task`
   - サービス: `ecs-apache-service`
   - コンテナ: `ecs-apache-container`

## トラブルシューティング

よくある問題と解決方法：

1. タスクが起動しない場合:
   - セキュリティグループの設定を確認
   - パブリックサブネットの設定を確認
   - タスク定義の設定を確認

2. Apacheにアクセスできない場合:
   - パブリックIPの割り当てが有効になっているか確認
   - セキュリティグループのポート80が開いているか確認
   - タスクが正常に実行中（RUNNING）か確認