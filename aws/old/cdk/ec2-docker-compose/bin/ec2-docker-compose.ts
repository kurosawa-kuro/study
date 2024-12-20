#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Ec2DockerComposeStack } from '../lib/ec2-docker-compose-stack';

const app = new cdk.App();
new Ec2DockerComposeStack(app, 'Ec2DockerComposeStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});