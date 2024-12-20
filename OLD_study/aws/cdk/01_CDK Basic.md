# AWS CDK セットアップと使用方法ガイド

## 1. 環境構築

### Node.jsのインストール
```bash
# Node.js LTSバージョンのインストール
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# インストール確認
node -v
npm -v
```

### AWS CLIのインストール
```bash
# AWS CLIのダウンロードとインストール
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
sudo apt install unzip
unzip awscliv2.zip
sudo ./aws/install

# インストール確認
aws --version
```

### AWS認証情報の設定
```bash
aws configure
# 以下の情報を順に入力:
# - AWS Access Key ID
# - AWS Secret Access Key
# - デフォルトリージョン（例: ap-northeast-1）
# - 出力形式（json推奨）
```

## 2. プロジェクト管理

### プロジェクトの初期化
```bash
# TypeScriptプロジェクトの作成
cdk init app --language typescript
```

### デプロイ関連コマンド
```bash
# 環境のブートストラップとデプロイ（承認なし）
cdk bootstrap && cdk deploy --require-approval never

# スタックの削除、再ブートストラップ、再デプロイ
cdk destroy --force && cdk bootstrap && cdk deploy --require-approval never
```

## 3. コード構成例

### スタック設定
```typescript
// 環境変数を使用したスタック設定
new VpcEc2RdsStack(app, 'VpcEc2RdsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});
```

### 出力管理
```typescript
class OutputCommandManager {
  // SSH鍵取得コマンドの生成
  static createKeyCommand(keyPairId: string, region: string): string {
    return [
      `aws ssm get-parameter`,
      `--name /ec2/keypair/${keyPairId}`,
      `--region ${region}`,
      '--with-decryption',
      '--query Parameter.Value',
      '--output text > cdk-ec2.pem'
    ].join(' ');
  }

  // デプロイ後の出力設定
  static addOutputs(scope: Construct, keyPairId: string, region: string, publicIp: string): void {
    // SSH鍵保存コマンド
    new cdk.CfnOutput(scope, '1_SaveKeyCommand', {
      value: this.createKeyCommand(keyPairId, region),
      description: '1. SSH鍵保存コマンドを実行'
    });

    // パーミッション設定コマンド
    new cdk.CfnOutput(scope, '2_ChmodCommand', {
      value: 'chmod 400 cdk-ec2.pem',
      description: '2. SSH鍵のパーミッションを設定'
    });

    // SSH接続コマンド
    new cdk.CfnOutput(scope, '3_SSHCommand', {
      value: `ssh -i cdk-ec2.pem ec2-user@${publicIp}`,
      description: '3. インスタンスにSSH接続'
    });
  }
}
```

### SSH鍵の取得
```bash
# SSHキーの取得と保存
aws ssm get-parameter \
  --name /ec2/keypair/key-0eeba2c81c2a8a8ae \
  --region ap-northeast-1 \
  --with-decryption \
  --query Parameter.Value \
  --output text > cdk-ec2.pem
```

```
aws ec2 create-key-pair --key-name training-02-key-web --query 'KeyMaterial' --output text > training-02-key-web.pem
chmod 400 training-02-key-web.pem
```
