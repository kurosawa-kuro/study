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
