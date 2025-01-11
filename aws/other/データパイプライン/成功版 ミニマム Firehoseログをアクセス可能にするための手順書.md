# Firehoseログをアクセス可能にするための手順書

## 概要
本ドキュメントでは、Amazon Kinesis FirehoseによってS3に保存されたJSONログを、AWS GlueとAmazon Athenaを使用してクエリ可能にする手順を説明します。

## 前提条件
- AWS アカウントへのアクセス権限
- 以下のサービスへのアクセス権限：
  - Amazon Kinesis Firehose
  - Amazon S3
  - AWS Glue
  - Amazon Athena
- Firehoseから出力される以下のようなJSONフォーマットのログ：
```json
{"CHANGE":-0.2,"PRICE":88.9,"TICKER_SYMBOL":"ALY","SECTOR":"ENERGY"}
```

## 1. IAMロールの設定

### 1.1 Glue用IAMロールの作成
1. IAMコンソールで新しいロールを作成
2. 信頼関係の設定：
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "glue.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### 1.2 必要なポリシーのアタッチ
以下のポリシーをロールにアタッチ：
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket/*",
                "arn:aws:s3:::your-bucket"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "glue:*",
                "s3:GetBucketLocation",
                "s3:ListBucket",
                "s3:ListAllMyBuckets",
                "s3:GetBucketAcl"
            ],
            "Resource": "*"
        }
    ]
}
```

## 2. AWS Glueの設定

### 2.1 データベースの作成
1. AWS Glueコンソールにアクセス
2. 左側メニューから「Databases」を選択
3. 「Create database」をクリック
4. データベース名を入力（例：`stock_trading`）

### 2.2 クローラーの作成
1. AWS Glueコンソールで「Crawlers」を選択
2. 「Create crawler」をクリック
3. 以下の設定を行う：
   - クローラー名を入力（例：`stock_data_crawler`）
   - データソースとしてS3バケットのパスを指定
   - 作成したIAMロールを選択
   - ターゲットデータベースとして作成したデータベースを選択
4. クローラーを実行

## 3. Amazon Athenaの設定

### 3.1 クエリ結果の保存場所設定
1. Athenaコンソールにアクセス
2. 「Settings」を選択
3. クエリ結果の保存先S3バケットを指定

### 3.2 クエリの実行
1. 「Query editor」を開く
2. データベースを選択（例：`stock_trading`）
3. テーブルが正しく作成されていることを確認
4. サンプルクエリを実行：
```sql
SELECT *
FROM stock_trading.demo_kinesis_firehose_02
LIMIT 10;
```

## トラブルシューティング

### データが表示されない場合
1. Glueクローラーを再実行
2. パーティション情報の確認：
```sql
SELECT DISTINCT
  partition_0,
  partition_1,
  partition_2,
  partition_3
FROM stock_trading.demo_kinesis_firehose_02;
```

### テーブルが見つからない場合
1. データベース名とテーブル名が正しいか確認
2. Glueクローラーが正常に実行完了しているか確認
3. S3バケットにデータが存在するか確認

## パフォーマンス最適化のヒント
- パーティションの活用を検討
- 必要なカラムのみを選択
- クエリの絞り込み条件を適切に設定

## セキュリティに関する注意事項
- 最小権限の原則に従ってIAMロールを設定
- S3バケットのアクセス権限を適切に設定
- Athenaのクエリ結果の保存先を暗号化することを推奨

```
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as kf from 'aws-cdk-lib/aws-kinesisfirehose';
import { Construct } from 'constructs';

export interface FirehoseGlueStackProps extends cdk.StackProps {
  readonly bucketName: string;
  readonly databaseName: string;
  readonly tableName: string;
}

export class FirehoseGlueStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FirehoseGlueStackProps) {
    super(scope, id, props);

    // S3 bucket for storing Firehose data and Athena query results
    const bucket = new s3.Bucket(this, 'DataBucket', {
      bucketName: props.bucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Create Glue IAM Role
    const glueRole = new iam.Role(this, 'GlueRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
    });

    // Add required policies to Glue role
    glueRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket',
      ],
      resources: [
        bucket.bucketArn,
        `${bucket.bucketArn}/*`,
      ],
    }));

    glueRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole')
    );

    // Create Glue Database
    const database = new glue.CfnDatabase(this, 'GlueDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: props.databaseName,
        description: 'Database for Firehose stock trading data',
      },
    });

    // Create Glue Crawler
    const crawler = new glue.CfnCrawler(this, 'GlueCrawler', {
      name: 'stock-data-crawler',
      role: glueRole.roleArn,
      databaseName: props.databaseName,
      targets: {
        s3Targets: [{
          path: `s3://${props.bucketName}/firehose/`,
        }],
      },
      schedule: {
        scheduleExpression: 'cron(0 * * * ? *)', // Run hourly
      },
      tablePrefix: 'raw_',
    });

    // Create Firehose Role
    const firehoseRole = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
    });

    firehoseRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:AbortMultipartUpload',
        's3:GetBucketLocation',
        's3:GetObject',
        's3:ListBucket',
        's3:ListBucketMultipartUploads',
        's3:PutObject',
      ],
      resources: [
        bucket.bucketArn,
        `${bucket.bucketArn}/*`,
      ],
    }));

    // Create Kinesis Firehose
    const firehose = new kf.CfnDeliveryStream(this, 'StockDataFirehose', {
      deliveryStreamName: 'stock-data-stream',
      deliveryStreamType: 'DirectPut',
      s3DestinationConfiguration: {
        bucketArn: bucket.bucketArn,
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 128,
        },
        compressionFormat: 'UNCOMPRESSED',
        prefix: 'firehose/',
        roleArn: firehoseRole.roleArn,
      },
    });

    // Output values
    new cdk.CfnOutput(this, 'DataBucketName', {
      value: bucket.bucketName,
      description: 'Name of the S3 bucket storing the data',
    });

    new cdk.CfnOutput(this, 'GlueDatabaseName', {
      value: props.databaseName,
      description: 'Name of the Glue database',
    });

    new cdk.CfnOutput(this, 'FirehoseStreamName', {
      value: firehose.ref,
      description: 'Name of the Kinesis Firehose delivery stream',
    });
  }
}
```