#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FargateDockerStack } from '../lib/fargate-docker-stack';

const app = new cdk.App();
new FargateDockerStack(app, 'FargateDockerStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});