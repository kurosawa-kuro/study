以下のように設定順序を整理してまとめました：

# AWSインフラ構築設計書

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

## 2. ネットワーク構成
はい、その設定順序は論理的に正しいですが、もう少し詳細に分解して、依存関係を明確にした順序を提案させていただきます：

# AWSネットワーク構成手順

## 1. VPC作成（基盤）
```
名前: training-01-vpc
CIDR: 10.0.0.0/16
DNS設定: 
- DNS解決: 有効
- DNS hostname: 有効
```

## 2. インターネットゲートウェイ
```
名前: training-01-igw
↓
VPCにアタッチ: training-01-vpc
```

## 3. サブネット作成
### 3.1 パブリックサブネット
```
名前: training-01-subnet-pub-1a
AZ: ap-northeast-1a
CIDR: 10.0.10.0/24
```

### 3.2 プライベートサブネット
```
名前: training-01-subnet-pri-1a
AZ: ap-northeast-1a
CIDR: 10.0.20.0/24

名前: training-01-subnet-pri-1c
AZ: ap-northeast-1c
CIDR: 10.0.21.0/24
```

## 4. ルートテーブル設定
### 4.1 パブリック用
```
名前: training-01-rtb-pub
ルート:
- 10.0.0.0/16 → local
- 0.0.0.0/0 → training-01-igw
↓
サブネット関連付け: training-01-subnet-pub-1a
```

### 4.2 プライベート用
```
名前: training-01-rtb-pri
ルート:
- 10.0.0.0/16 → local
↓
サブネット関連付け: 
- training-01-subnet-pri-1a
- training-01-subnet-pri-1c
```


この順序で作成すると：
1. まずネットワークの基盤（VPC）を作成
2. インターネット接続の準備（IGW）
3. ネットワークのセグメント化（サブネット）
4. 通信経路の設定（ルートテーブル）


## 3. セキュリティグループ設定
### 3.1 Webサーバー用
- 名前タグ: training-01-sg-web
- インバウンドルール:
  - SSH(22): 0.0.0.0/0
  - HTTP(80): 0.0.0.0/0

### 3.2 データベース用
- 名前タグ: training-01-sg-db
- インバウンドルール:
  - PostgreSQL(5432): training-01-sg-web

## 4. コンピューティングリソース設定
### 4.1 EC2設定
- 名前タグ: training-01-instance-web
- タイプ: t2.micro
- AMI: Amazon Linux 2023
- セキュリティグループ: training-01-sg-web
- キーペア: training-01-key-web
- Elastic IP: training-01-eip-web

### 4.2 RDS設定
#### パラメータグループ設定
- 名前タグ: training-01-rds-param-postgresql
- パラメータグループファミリー: postgresql12
- 標準作成

#### サブネットグループ設定
- 名前: training-01-rds-subnet-group
- アベイラビリティーゾーン:
  - ap-northeast-1a
  - ap-northeast-1c
- サブネット:
  - training-01-subnet-pri-1a
  - training-01-subnet-pri-1c

#### データベース設定
- エンジン: PostgreSQL
- 料金プラン: 無料利用枠
- DBインスタンス識別子: training-01-instance-postgresql
- マスターユーザー: postgres
- マスターパスワード: postgres
- データベース名: training
- VPCセキュリティグループ: training-01-sg-db
- DBパラメータグループ: training-01-rds-param-postgresql
