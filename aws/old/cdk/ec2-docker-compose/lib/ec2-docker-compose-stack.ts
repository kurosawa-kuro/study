import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

// インターフェース定義
interface IngressRule {
  port: number;
  description: string;
}

interface EC2Config {
  instanceType: ec2.InstanceType;
  volumeSize: number;
}

// EC2インスタンスの設定を管理するクラス
class EC2ConfigManager {
  static getConfig(): EC2Config {
    return {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      volumeSize: 30
    };
  }

  static getAmazonLinuxImage(): ec2.IMachineImage {
    return new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
    });
  }
}

// セキュリティグループのルールを管理するクラス
class SecurityGroupRuleManager {
  static getIngressRules(): IngressRule[] {
    return [
      { port: 22, description: 'Allow SSH access from anywhere' },
      { port: 3000, description: 'Allow HTTP access from anywhere' },
      { port: 8000, description: 'Allow HTTP access from anywhere' }
    ];
  }

  static applyRules(securityGroup: ec2.SecurityGroup): void {
    this.getIngressRules().forEach(rule => {
      securityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(rule.port),
        rule.description
      );
    });
  }
}

// 出力コマンドを管理するクラス
class OutputCommandManager {
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

  static addOutputs(scope: Construct, keyPairId: string, region: string, publicIp: string): void {
    new cdk.CfnOutput(scope, '1_SaveKeyCommand', {
      value: this.createKeyCommand(keyPairId, region),
      description: '1. Run this command to save the SSH key'
    });

    new cdk.CfnOutput(scope, '2_ChmodCommand', {
      value: 'chmod 400 cdk-ec2.pem',
      description: '2. Run this command to set correct permissions for the SSH key'
    });

    new cdk.CfnOutput(scope, '3_SSHCommand', {
      value: `ssh -i cdk-ec2.pem ec2-user@${publicIp}`,
      description: '3. Command to SSH into the instance'
    });
  }
}

// メインのスタッククラス
export class Ec2DockerComposeStack extends cdk.Stack {
  private readonly vpc: ec2.IVpc;
  private readonly securityGroup: ec2.SecurityGroup;
  private readonly keyPair: ec2.CfnKeyPair;
  private readonly instance: ec2.Instance;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = this.createVpc();
    this.securityGroup = this.createSecurityGroup();
    this.keyPair = this.createKeyPair();
    this.instance = this.createEC2Instance();
    
    this.addOutputs();
  }

  private createVpc(): ec2.IVpc {
    return new ec2.Vpc(this, 'MyVPC', {
      ipAddresses: ec2.IpAddresses.cidr('10.1.0.0/16'),
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        }
      ],
    });
  }

  private createSecurityGroup(): ec2.SecurityGroup {
    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: this.vpc,
      description: 'Allow HTTP and SSH access',
      allowAllOutbound: true,
    });

    SecurityGroupRuleManager.applyRules(securityGroup);
    return securityGroup;
  }

  private createKeyPair(): ec2.CfnKeyPair {
    return new ec2.CfnKeyPair(this, 'KeyPair', {
      keyName: 'cdk-ec2',
    });
  }

  private createEC2Instance(): ec2.Instance {
    const config = EC2ConfigManager.getConfig();

    return new ec2.Instance(this, 'MyEC2Instance', {
      vpc: this.vpc,
      instanceType: config.instanceType,
      machineImage: EC2ConfigManager.getAmazonLinuxImage(),
      securityGroup: this.securityGroup,
      keyName: this.keyPair.keyName,
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(config.volumeSize),
      }],
    });
  }

  private addOutputs(): void {
    OutputCommandManager.addOutputs(
      this,
      this.keyPair.getAtt('KeyPairId').toString(),
      this.region,
      this.instance.instancePublicIp
    );
  }
}