# CloudWatch Logs → Kinesis Firehose → S3 設定手順

## 1. IAMロール設定

### 1.1 `FirehoseLogDeliveryRole` の作成
1. IAMコンソールで新規ロールを作成
2. 信頼されたエンティティ：`Firehose`
3. 以下の管理ポリシーを付与：
   - `AmazonAPIGatewayPushToCloudWatchLogs`
   - `AmazonKinesisFirehoseFullAccess`
   - `AmazonS3FullAccess`

### 1.2 カスタムインラインポリシーの追加
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:PutSubscriptionFilter",
        "logs:DeleteSubscriptionFilter",
        "firehose:PutRecord",
        "firehose:PutRecordBatch"
      ],
      "Resource": [
        "arn:aws:logs:ap-northeast-1:144804983334:log-group:/aws/CdkJavascript01/myapp:*",
        "arn:aws:firehose:ap-northeast-1:144804983334:deliverystream/myapp-logs-stream"
      ]
    }
  ]
}
```

### 1.3 信頼関係の設定
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": ["firehose.amazonaws.com", "logs.amazonaws.com"]
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

## 2. Kinesis Firehose設定

1. Firehoseコンソールで新規ストリームを作成
2. 基本設定：
   - ソース: Direct PUT
   - 送信先: Amazon S3
   - ストリーム名: `myapp-logs-stream`

3. S3設定：
   - バケット: `cdkjavascript01-s3`
   - プレフィックス: `log-raw-data/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/`
   - バッファサイズ: 5 MB
   - バッファ間隔: 60秒
   - 圧縮形式: 有効ではありません

4. IAMロール: `FirehoseLogDeliveryRole` を選択

## 3. CloudWatchサブスクリプションフィルター設定

1. CloudWatchロググループ `/aws/CdkJavascript01/myapp` を選択
2. 「サブスクリプションフィルター」→「作成」を選択
3. 設定項目：
   - フィルター名: `myapp-logs-filter`
   - パターン: 空白（すべてのログを転送）
   - Firehoseストリーム: `myapp-logs-stream` を選択
   - IAMロール: `FirehoseLogDeliveryRole`

## 4. 確認事項

1. ログの流れ：
```
CloudWatch Logs → Kinesis Firehose → S3バケット
```

2. S3の保存パス：
```
s3://cdkjavascript01-s3/log-raw-data/year=YYYY/month=MM/day=DD/
```

3. モニタリング：
- Firehoseのメトリクス確認
- S3バケットのオブジェクト確認
- CloudWatchのサブスクリプションフィルターステータス確認

## 5. トラブルシューティング

1. ログが転送されない場合：
   - IAMロールの権限確認
   - Firehoseのステータス確認
   - サブスクリプションフィルターの設定確認

2. S3にファイルが作成されない場合：
   - バッファ設定（5MB or 300秒）を待つ
   - Firehoseのエラーログを確認

3. テスト方法：
   - サブスクリプションフィルターのテスト機能を使用
   - アプリケーションログの生成
   - S3の.gzファイルの内容確認