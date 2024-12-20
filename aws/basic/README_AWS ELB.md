# Fargate用 ALB セットアップガイド

## 前提条件
- Fargateタスクがプライベートサブネットで稼働中
- VPCにパブリックサブネットとプライベートサブネットが設定済み
- コンテナのポートが設定済み（例：80, 3000など）

## 1. Application Load Balancer (ALB) の作成

1. EC2コンソール > 「Load Balancers」を選択
2. 「Create load balancer」をクリック
   - 「Application Load Balancer」を選択
   - 名前を入力（例：fargate-alb）

3. Scheme and IP address type
   - Scheme: `internet-facing` を選択
   - IP address type: `IPv4`

4. Network mapping
   - VPC: Fargateと同じVPCを選択
   - Mappings: パブリックサブネットを2つ以上選択
   
5. Security Groups
   - 新規作成
   - インバウンドルール：HTTP(80) from anywhere
   - アウトバウンドルール：All traffic

6. Listeners
   - Protocol: HTTP
   - Port: 80

## 2. ターゲットグループの作成

1. Target type
   - IP addresses を選択（Fargate用）
   - ターゲットグループ名を入力（例：fargate-tg）

2. Protocol settings
   - Protocol: HTTP
   - Port: コンテナのポート番号
   - VPC: Fargateと同じVPC

3. Health checks
   - Protocol: HTTP
   - Path: アプリケーションの正常性確認パス（例：/health, /）
   - Advanced health check settings
     - Healthy threshold: 2
     - Unhealthy threshold: 2
     - Timeout: 5 seconds
     - Interval: 30 seconds
     - Success codes: 200

4. Register targets
   - この段階では targets を追加しない
   - Fargateサービスのアップデート時に自動登録される

## 3. Fargateサービスのアップデート

1. ECSコンソール > クラスター > サービス
2. 対象のサービスを選択し「Update」
3. ロードバランサー設定:
   - Application Load Balancer を選択
   - 作成したターゲットグループを指定
4. Service discovery (オプション) を設定
5. 「Update Service」をクリック

## 4. 動作確認

1. ALBのDNS名を確認
   - EC2 > Load Balancers > 作成したALB
   - Description タブの「DNS name」

2. ブラウザでアクセス確認
   - `http://[ALB-DNS-NAME]` にアクセス
   - アプリケーションが表示されることを確認

## トラブルシューティング

- **ヘルスチェック失敗の場合：**
  - Fargateタスクのセキュリティグループで、ALBからのインバウンドトラフィックを許可
  - コンテナのヘルスチェックパスが正しいか確認
  - コンテナが指定ポートでリッスンしているか確認

- **ALBに接続できない場合：**
  - ALBのセキュリティグループで80ポートが開放されているか確認
  - ALBがパブリックサブネットに配置されているか確認

## セキュリティのベストプラクティス

1. Fargateタスクのセキュリティグループ
   - インバウンド: ALBのセキュリティグループからのみ許可
   - アウトバウンド: 必要最小限に制限

2. ALBのセキュリティグループ
   - インバウンド: HTTP(80)のみ許可
   - アウトバウンド: Fargateタスクのポートのみ許可

## 注意点

- ALBは無料利用枠で月750時間まで利用可能
- 最低2つのアベイラビリティゾーンが必要
- 自動生成されるALBのドメイン名で追加設定不要
- プライベートサブネットのFargateタスクはNATゲートウェイ経由でインターネットにアクセス

VPC CIDR: 10.0.0.0/16
（65,536個のIPアドレスを確保）
パブリックサブネット（ALB用）:

AZ-1: 10.0.0.0/24 （256個のIPアドレス）
AZ-2: 10.0.1.0/24 （256個のIPアドレス）

Fargateのプライベートサブネット:

AZ-1: 10.0.2.0/24 （256個のIPアドレス）
AZ-2: 10.0.3.0/24 （256個のIPアドレス）

RDSのプライベートサブネット:

AZ-1: 10.0.4.0/24 （256個のIPアドレス）
AZ-2: 10.0.5.0/24 （256個のIPアドレス）