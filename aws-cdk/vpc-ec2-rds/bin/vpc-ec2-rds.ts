#!/usr/bin/env node
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import { VpcEc2RdsStack } from '../lib/vpc-ec2-rds-stack';

const app = new cdk.App();

// 環境変数が設定されていない場合はエラー
if (!process.env.ENVIRONMENT) {
  throw new Error('ENVIRONMENT variable must be set');
}

console.log("process.env.ENVIRONMENT: ", process.env.ENVIRONMENT);

// スタック名に環境名を含める
const stackName = `VpcEc2RdsStack-${process.env.ENVIRONMENT}`;

new VpcEc2RdsStack(app, stackName, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_REGION || 'ap-northeast-1'
  }
});