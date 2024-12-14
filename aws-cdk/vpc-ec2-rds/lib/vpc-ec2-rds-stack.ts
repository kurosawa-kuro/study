import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dotenv from 'dotenv';
import 'dotenv/config';

// 環境変数を読み込む
dotenv.config();

// 環境設定
class EnvironmentConfig {
  static readonly ENV = process.env.ENVIRONMENT || 'default';
  
  static {
    if (!this.ENV) {
      throw new Error('ENVIRONMENT variable must be set');
    }
  }

  static readonly FEATURES = {
    enableRds: process.env.ENABLE_RDS ? process.env.ENABLE_RDS === 'true' : false,
    enableEip: process.env.ENABLE_EIP ? process.env.ENABLE_EIP === 'true' : false,
  };

  static readonly REGION = {
    primary: 'ap-northeast-1',
    availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c'],
  };

  static readonly EC2 = {
    keyName: process.env.SSH_KEY_NAME || this.getResourceName('key-web'),
  };

  static readonly RDS = {
    databaseName: process.env.DATABASE_NAME || 'training',
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  };

  static getResourceName(resourceType: string, suffix?: string): string {
    return `${this.ENV}-${resourceType}${suffix ? `-${suffix}` : ''}`;
  }
}

// リソース設定（環境に依存しない定数的な設定）
class ResourceConfig {
  static readonly VPC = {
    cidr: process.env.VPC_CIDR || '10.0.0.0/16',
    subnets: {
      public: [
        { 
          cidr: process.env.VPC_PUBLIC_SUBNET_1_CIDR || '10.0.1.0/24', 
          az: 'ap-northeast-1a' 
        },
        { 
          cidr: process.env.VPC_PUBLIC_SUBNET_2_CIDR || '10.0.2.0/24', 
          az: 'ap-northeast-1c' 
        },
      ],
      private: [
        { 
          cidr: process.env.VPC_PRIVATE_SUBNET_1_CIDR || '10.0.11.0/24', 
          az: 'ap-northeast-1a' 
        },
        { 
          cidr: process.env.VPC_PRIVATE_SUBNET_2_CIDR || '10.0.12.0/24', 
          az: 'ap-northeast-1c' 
        },
      ],
    },
  };

  static readonly SECURITY = {
    webServer: {
      rules: [
        { port: 22, source: '0.0.0.0/0', description: 'Allow SSH' },
        { port: 80, source: '0.0.0.0/0', description: 'Allow HTTP' },
      ],
    },
    database: {
      rules: [
        { port: 5432, description: 'Allow PostgreSQL from web server' },
      ],
    },
  };

  static readonly EC2 = {
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
  };
}

// インフラストラクチャリソースの作成を担当
class InfrastructureBuilder {
  constructor(private readonly scope: Construct) {}

  createVpc(): ec2.Vpc {
    return new ec2.Vpc(this.scope, EnvironmentConfig.getResourceName('vpc'), {
      ipAddresses: ec2.IpAddresses.cidr(ResourceConfig.VPC.cidr),
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });
  }

  createSecurityGroups(vpc: ec2.Vpc): { web: ec2.SecurityGroup; db: ec2.SecurityGroup } {
    const webSg = new ec2.SecurityGroup(this.scope, 'WebServerSG', {
      vpc,
      securityGroupName: EnvironmentConfig.getResourceName('sg-web'),
      description: 'Security group for web server',
    });

    ResourceConfig.SECURITY.webServer.rules.forEach(rule => {
      webSg.addIngressRule(
        ec2.Peer.ipv4(rule.source),
        ec2.Port.tcp(rule.port),
        rule.description
      );
    });

    const dbSg = new ec2.SecurityGroup(this.scope, 'DBServerSG', {
      vpc,
      securityGroupName: EnvironmentConfig.getResourceName('sg-db'),
      description: 'Security group for database',
    });

    dbSg.addIngressRule(
      ec2.Peer.securityGroupId(webSg.securityGroupId),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from web server'
    );

    return { web: webSg, db: dbSg };
  }

  createEc2Instance(vpc: ec2.Vpc, sg: ec2.SecurityGroup): ec2.Instance {
    const role = this.createEc2Role();
    const instance = new ec2.Instance(this.scope, 'WebServer', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ResourceConfig.EC2.instanceType,
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: sg,
      keyName: EnvironmentConfig.EC2.keyName,
      userData: this.createUserData(),
      role,
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(20),
      }],
    });

    cdk.Tags.of(instance).add('Name', EnvironmentConfig.getResourceName('instance-web'));

    if (EnvironmentConfig.FEATURES.enableEip) {
      new ec2.CfnEIP(this.scope, 'WebServerEIP', {
        instanceId: instance.instanceId,
        tags: [{ key: 'Name', value: EnvironmentConfig.getResourceName('eip-web') }],
      });
    }

    return instance;
  }

  createRdsInstance(vpc: ec2.Vpc, sg: ec2.SecurityGroup): rds.DatabaseInstance | undefined {
    if (!EnvironmentConfig.FEATURES.enableRds) return undefined;

    return new rds.DatabaseInstance(this.scope, 'PostgresqlInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_12 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      securityGroups: [sg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instanceIdentifier: EnvironmentConfig.getResourceName('instance-postgresql'),
      databaseName: EnvironmentConfig.RDS.databaseName,
      credentials: {
        username: EnvironmentConfig.RDS.username,
        password: cdk.SecretValue.unsafePlainText(EnvironmentConfig.RDS.password),
      },
      multiAz: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 20,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  createS3Bucket(): s3.Bucket {
    return new s3.Bucket(this.scope, 'UploadBucket', {
      bucketName: EnvironmentConfig.getResourceName('bucket'),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });
  }

  private createEc2Role(): iam.Role {
    const role = new iam.Role(this.scope, 'EC2Role', {
      roleName: EnvironmentConfig.getResourceName('role-ec2'),
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    );

    return role;
  }

  private createUserData(): ec2.UserData {
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      // 'dnf update -y',
      'dnf install -y ansible-core',
      'ansible-galaxy collection install community.general'
    );
    return userData;
  }
}

// メインのスタッククラス
export class VpcEc2RdsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, `${id}-${EnvironmentConfig.ENV}`, props);

    const builder = new InfrastructureBuilder(this);

    const vpc = builder.createVpc();
    const securityGroups = builder.createSecurityGroups(vpc);
    const ec2Instance = builder.createEc2Instance(vpc, securityGroups.web);
    const rdsInstance = builder.createRdsInstance(vpc, securityGroups.db);
    const s3Bucket = builder.createS3Bucket();

    // 出力
    new cdk.CfnOutput(this, 'EC2PublicIP', {
      value: ec2Instance.instancePublicIp,
    });

    if (rdsInstance) {
      new cdk.CfnOutput(this, 'RDSEndpoint', {
        value: rdsInstance.instanceEndpoint.hostname,
      });
    }

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: s3Bucket.bucketName,
    });
  }
}