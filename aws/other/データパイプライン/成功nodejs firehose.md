# js-fs-s3-01: Node.jsアプリケーションからAthenaクエリまでのログ分析パイプライン構築手順

## 1. 必要なAWSリソースの作成

### 1.1 S3バケットの作成
```
バケット名: js-fs-s3-01-s3
リージョン: ap-northeast-1
その他: デフォルト設定
```

### 1.2 Kinesis Firehoseの作成
```
配信ストリーム名: js-fs-s3-01-fs
ソース: Direct PUT
送信先: Amazon S3
バッファサイズ: 1 MB
バッファ間隔: 60 seconds
S3バケット: js-fs-s3-01-s3
プレフィックス: logs/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/
圧縮: 無効（検証用）
```

### 1.3 EC2のIAMロール設定
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "firehose:PutRecord",
                "firehose:PutRecordBatch"
            ],
            "Resource": [
                "arn:aws:firehose:ap-northeast-1:YOUR_ACCOUNT_ID:deliverystream/js-fs-s3-01-fs"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:AbortMultipartUpload",
                "s3:GetBucketLocation",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:ListBucketMultipartUploads",
                "s3:PutObject"
            ],
            "Resource": [
                "arn:aws:s3:::js-fs-s3-01-s3",
                "arn:aws:s3:::js-fs-s3-01-s3/*"
            ]
        }
    ]
}
```

## 2. Node.jsアプリケーションの実装

### 2.1 プロジェクト初期化
```bash
mkdir js-fs-s3-01
cd js-fs-s3-01
npm init -y
npm install @aws-sdk/client-firehose
```

### 2.2 ログ送信スクリプト作成（sendlog.js）
```javascript
const { Firehose } = require('@aws-sdk/client-firehose');

const firehose = new Firehose({ 
    region: 'ap-northeast-1'
});

async function sendLog() {
    const logData = {
        timestamp: new Date().toISOString(),
        result: "ok",
        value: 123,
        source: "test-app"
    };

    const params = {
        DeliveryStreamName: 'js-fs-s3-01-fs',
        Record: {
            Data: JSON.stringify(logData)
        }
    };

    try {
        const response = await firehose.putRecord(params);
        console.log('Success:', response);
    } catch (error) {
        console.error('Error:', error);
    }
}

sendLog();
```

## 3. AWS Glueテーブルの作成

### 3.1 データベース作成
```sql
-- Athenaコンソールで実行
CREATE DATABASE js_fs_s3_01_db;
```

### 3.2 テーブル作成
```sql
CREATE EXTERNAL TABLE js_fs_s3_01_db.test_logs (
    timestamp STRING,
    result STRING,
    value INT,
    source STRING
)
ROW FORMAT SERDE 
  'org.openx.data.jsonserde.JsonSerDe'
LOCATION
  's3://js-fs-s3-01-s3/';
```

## 4. Athenaでのクエリ実行

### 4.1 基本的なクエリ
```sql
-- データ確認
SELECT *
FROM js_fs_s3_01_db.test_logs
LIMIT 10;

-- タイムスタンプでフィルタリング
SELECT *
FROM js_fs_s3_01_db.test_logs
WHERE timestamp >= '2025-01-09'
  AND timestamp < '2025-01-10'
ORDER BY timestamp;

-- 集計クエリ
SELECT 
    source,
    COUNT(*) as count,
    AVG(value) as avg_value
FROM js_fs_s3_01_db.test_logs
GROUP BY source;
```

## 5. 確認ポイント

1. **Firehoseの設定**
- バッファリング設定が適切か
- S3への書き込み権限があるか

2. **IAMロールの設定**
- EC2からFirehoseへのアクセス権限
- FirehoseからS3への書き込み権限

3. **Athenaのクエリ**
- データ形式が正しく認識されているか
- タイムスタンプが適切にパースされるか

## 6. トラブルシューティング

1. **Firehoseエラー**
- IAMロールの権限を確認
- リージョンの設定を確認

2. **S3エラー**
- バケット名が正しいか確認
- パーミッションを確認

3. **Athenaエラー**
- テーブルスキーマがログ形式と一致しているか確認
- JSONSerDeが正しく設定されているか確認

これで基本的なログ分析パイプラインの構築は完了です。