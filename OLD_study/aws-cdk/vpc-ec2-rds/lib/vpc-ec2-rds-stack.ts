import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2_targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';

// 基本設定の型定義
namespace Configs {
  export interface VpcConfig {
    vpcName: string;
    vpcCidr: string;
    publicSubnets: SubnetConfig[];
    privateSubnets: SubnetConfig[];
  }

  export interface SubnetConfig {
    name: string;
    az: string;
    cidr: string;
  }

  export interface SecurityGroupRule {
    port: number;
    source: string;
    description: string;
  }

  export interface SecurityGroupConfig {
    webServer: {
      name: string;
      ingressRules: SecurityGroupRule[];
    };
    database: {
      name: string;
      ingressRules: SecurityGroupRule[];
    };
    alb: {
      name: string;
      ingressRules: SecurityGroupRule[];
    };
  }

  export interface EC2Config {
    name: string;
    instanceType: ec2.InstanceType;
    keyName: string;
  }

  export interface RDSConfig {
    instanceIdentifier: string;
    databaseName: string;
    username: string;
    password: string;
  }

  export interface ALBConfig {
    name: string;
    targetGroupName: string;
    healthCheckPath: string;
  }
}

// 環境固有の設定値を管理
class EnvironmentConfig {
  private static readonly ENV = 'training-02';

  static getResourceName(resourceType: string, suffix?: string): string {
    return `${this.ENV}-${resourceType}${suffix ? `-${suffix}` : ''}`;
  }

  static readonly region = {
    primary: 'ap-northeast-1',
    availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c'],
  };
}

// インフラストラクチャの設定値を管理
class InfrastructureConfig {
  static readonly vpc: Configs.VpcConfig = {
    vpcName: EnvironmentConfig.getResourceName('vpc'),
    vpcCidr: '10.0.0.0/16',
    publicSubnets: [
      {
        name: EnvironmentConfig.getResourceName('subnet-pub', '1a'),
        az: EnvironmentConfig.region.availabilityZones[0],
        cidr: '10.0.10.0/24',
      },
      {
        name: EnvironmentConfig.getResourceName('subnet-pub', '1c'),
        az: EnvironmentConfig.region.availabilityZones[1],
        cidr: '10.0.11.0/24',
      }
    ],
    privateSubnets: [
      {
        name: EnvironmentConfig.getResourceName('subnet-pri', '1a'),
        az: EnvironmentConfig.region.availabilityZones[0],
        cidr: '10.0.20.0/24',
      },
      {
        name: EnvironmentConfig.getResourceName('subnet-pri', '1c'),
        az: EnvironmentConfig.region.availabilityZones[1],
        cidr: '10.0.21.0/24',
      }
    ]
  };

  static readonly securityGroups: Configs.SecurityGroupConfig = {
    webServer: {
      name: EnvironmentConfig.getResourceName('sg-web'),
      ingressRules: [
        { port: 22, source: '0.0.0.0/0', description: 'Allow SSH' },
        { port: 80, source: '0.0.0.0/0', description: 'Allow HTTP' },
      ],
    },
    database: {
      name: EnvironmentConfig.getResourceName('sg-db'),
      ingressRules: [
        { port: 5432, source: 'sg-web', description: 'Allow PostgreSQL from web server' },
      ],
    },
    alb: {
      name: EnvironmentConfig.getResourceName('sg-alb'),
      ingressRules: [
        { port: 80, source: '0.0.0.0/0', description: 'Allow HTTP from anywhere' },
      ],
    },
  };

  static readonly compute = {
    ec2: {
      name: EnvironmentConfig.getResourceName('instance-web'),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      keyName: EnvironmentConfig.getResourceName('key-web'),
    },
    rds: {
      instanceIdentifier: EnvironmentConfig.getResourceName('instance-postgresql'),
      databaseName: 'training',
      username: 'postgres',
      password: 'postgres',
    },
    alb: {
      name: EnvironmentConfig.getResourceName('alb'),
      targetGroupName: EnvironmentConfig.getResourceName('tg'),
      healthCheckPath: '/api/health',
    }
  };
}

// 基底ビルダークラス
abstract class ResourceBuilder {
  constructor(protected readonly scope: Construct) {}
  abstract build(): any;
}

// VPCリソースビルダー
class VpcBuilder extends ResourceBuilder {
  private vpc: ec2.Vpc;
  
  constructor(scope: Construct, private readonly config: Configs.VpcConfig) {
    super(scope);
  }

  build(): ec2.Vpc {
    this.createVpc();
    this.tagResources();
    return this.vpc;
  }

  private createVpc() {
    this.vpc = new ec2.Vpc(this.scope, this.config.vpcName, {
      ipAddresses: ec2.IpAddresses.cidr(this.config.vpcCidr),
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

  private tagResources() {
    // VPCタグ
    cdk.Tags.of(this.vpc).add('Name', this.config.vpcName);

    // IGWタグ
    const igw = this.vpc.node.findChild('IGW') as ec2.CfnInternetGateway;
    cdk.Tags.of(igw).add('Name', 'training-01-igw');

    // サブネットタグ
    const [publicSubnet1, publicSubnet2] = this.vpc.publicSubnets;
    cdk.Tags.of(publicSubnet1).add('Name', 'training-01-subnet-pub-1a');
    cdk.Tags.of(publicSubnet2).add('Name', 'training-01-subnet-pub-1c');

    // ルートテーブルタグ
    const publicRouteTable = publicSubnet1.node.findChild('RouteTable') as ec2.CfnRouteTable;
    const privateRouteTable1 = this.vpc.privateSubnets[0].node.findChild('RouteTable') as ec2.CfnRouteTable;
    const privateRouteTable2 = this.vpc.privateSubnets[1].node.findChild('RouteTable') as ec2.CfnRouteTable;

    cdk.Tags.of(publicRouteTable).add('Name', 'training-01-rtb-pub');
    cdk.Tags.of(privateRouteTable1).add('Name', 'training-01-rtb-pri');
    cdk.Tags.of(privateRouteTable2).add('Name', 'training-01-rtb-pri');
  }
}

// セキュリティグループビルダー
class SecurityGroupBuilder extends ResourceBuilder {
  private readonly securityGroups: {
    webServerSg?: ec2.SecurityGroup;
    dbServerSg?: ec2.SecurityGroup;
    albSg?: ec2.SecurityGroup;
  } = {};

  constructor(
    scope: Construct,
    private readonly vpc: ec2.Vpc,
    private readonly config: Configs.SecurityGroupConfig
  ) {
    super(scope);
  }

  build() {
    this.createWebServerSecurityGroup();
    this.createDbServerSecurityGroup();
    this.createAlbSecurityGroup();
    return this.securityGroups;
  }

  private createWebServerSecurityGroup() {
    const sg = new ec2.SecurityGroup(this.scope, 'WebServerSG', {
      vpc: this.vpc,
      securityGroupName: this.config.webServer.name,
      description: 'Security group for web server',
    });
    this.securityGroups.webServerSg = sg;

    this.config.webServer.ingressRules.forEach(rule => {
      sg.addIngressRule(
        ec2.Peer.ipv4(rule.source),
        ec2.Port.tcp(rule.port),
        rule.description
      );
    });
  }

  private createDbServerSecurityGroup() {
    this.securityGroups.dbServerSg = new ec2.SecurityGroup(this.scope, 'DBServerSG', {
      vpc: this.vpc,
      securityGroupName: this.config.database.name,
      description: 'Security group for database',
    });

    this.securityGroups.dbServerSg.addIngressRule(
      ec2.Peer.securityGroupId(this.securityGroups.webServerSg!.securityGroupId),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from web server'
    );
  }

  private createAlbSecurityGroup() {
    const sg = new ec2.SecurityGroup(this.scope, 'AlbSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: this.config.alb.name,
      description: 'Security group for ALB'
    });
    this.securityGroups.albSg = sg;

    this.config.alb.ingressRules.forEach(rule => {
      sg.addIngressRule(
        ec2.Peer.ipv4(rule.source),
        ec2.Port.tcp(rule.port),
        rule.description
      );
    });
  }
}

// EC2インスタンスビルダー
class EC2Builder extends ResourceBuilder {
  constructor(
    scope: Construct,
    private readonly vpc: ec2.Vpc,
    private readonly securityGroup: ec2.SecurityGroup,
    private readonly config: Configs.EC2Config
  ) {
    super(scope);
  }

  private createUserData(): ec2.UserData {
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      
      // 1. システム更新と基本開発ツール
      'sudo dnf update -y',
      'sudo dnf upgrade -y',
      'sudo dnf groupinstall "Development Tools" -y',
      
      // 2. プログラミング言語のインストール
      // Go
      'sudo dnf install -y golang',
      'echo "export GOPATH=$HOME/go" >> /home/ec2-user/.bashrc',
      'echo "export PATH=$PATH:/usr/local/go/bin:$GOPATH/bin" >> /home/ec2-user/.bashrc',
      'mkdir -p /home/ec2-user/go/{bin,src,pkg}',
      'chown -R ec2-user:ec2-user /home/ec2-user/go',
      
      // Node.js
      'sudo dnf install -y nodejs npm',
      'sudo npm install -g pm2 typescript',
      
      // 3. Webサーバー設定
      // Nginxのセットアップ
      'sudo dnf install -y nginx',
      'sudo systemctl enable nginx',
      'sudo systemctl start nginx',
      
      // アプリケーションディレクトリ
      'sudo mkdir -p /var/www/app',
      'sudo chown ec2-user:ec2-user /var/www/app',
      
      // 4. コンテナ環境
      // Docker
      'sudo dnf install -y docker',
      'sudo systemctl enable docker',
      'sudo systemctl start docker',
      'sudo usermod -aG docker ec2-user',
      
      // Docker Compose
      'sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose',
      'sudo chmod +x /usr/local/bin/docker-compose',
      
      // 5. モニタリングツール
      'sudo dnf install -y htop amazon-cloudwatch-agent'
    );
    return userData;
  }

  build(): ec2.Instance {
    const instance = new ec2.Instance(this.scope, 'WebServer', {
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: this.config.instanceType,
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: this.securityGroup,
      keyName: this.config.keyName,
      userData: this.createUserData(),
    });

    new ec2.CfnEIP(this.scope, 'WebServerEIP', {
      instanceId: instance.instanceId,
      tags: [{ key: 'Name', value: 'training-01-eip-web' }],
    });

    return instance;
  }
}

// RDSインスタンスビルダー
class RDSBuilder extends ResourceBuilder {
  constructor(
    scope: Construct,
    private readonly vpc: ec2.Vpc,
    private readonly securityGroup: ec2.SecurityGroup,
    private readonly config: Configs.RDSConfig
  ) {
    super(scope);
  }

  build(): rds.DatabaseInstance {
    const parameterGroup = this.createParameterGroup();
    const subnetGroup = this.createSubnetGroup();

    return new rds.DatabaseInstance(this.scope, 'PostgresqlInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_12 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c']
      },
      multiAz: true,
      securityGroups: [this.securityGroup],
      parameterGroup,
      subnetGroup,
      instanceIdentifier: this.config.instanceIdentifier,
      credentials: {
        username: this.config.username,
        password: cdk.SecretValue.unsafePlainText(this.config.password),
      },
      databaseName: this.config.databaseName,
      allocatedStorage: 20,
      maxAllocatedStorage: 20,
      allowMajorVersionUpgrade: false,
      autoMinorVersionUpgrade: false,
      backupRetention: cdk.Duration.days(1),
      deleteAutomatedBackups: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      publiclyAccessible: false,
    });
  }

  private createParameterGroup(): rds.ParameterGroup {
    const group = new rds.ParameterGroup(this.scope, 'PostgresqlParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_12 }),
      description: 'Parameter group for postgresql12',
      parameters: {},
    });
    cdk.Tags.of(group).add('Name', 'training-01-rds-param-postgresql');
    return group;
  }

  private createSubnetGroup(): rds.SubnetGroup {
    return new rds.SubnetGroup(this.scope, 'PostgresqlSubnetGroup', {
      description: 'Subnet group for postgresql',
      vpc: this.vpc,
      subnetGroupName: 'training-01-rds-subnet-group',
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c']
      }
    });
  }
}

// ALBビルダー
class ALBBuilder extends ResourceBuilder {
  constructor(
    scope: Construct,
    private readonly vpc: ec2.Vpc,
    private readonly webServerSg: ec2.SecurityGroup,
    private readonly webServer: ec2.Instance,
    private readonly config: Configs.ALBConfig
  ) {
    super(scope);
  }

  build(): elbv2.ApplicationLoadBalancer {
    // ALB の作成
    const alb = new elbv2.ApplicationLoadBalancer(this.scope, 'WebServerALB', {
      vpc: this.vpc,
      internetFacing: true,
      loadBalancerName: this.config.name,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      }
    });

    // ALB のセキュリティグループを作成
    this.webServerSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from anywhere'
    );

    alb.addSecurityGroup(this.webServerSg);

    // リスナーとターゲットグループの作成
    const targetGroup = new elbv2.ApplicationTargetGroup(this.scope, this.config.targetGroupName, {
      vpc: this.vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        path: this.config.healthCheckPath,
        unhealthyThresholdCount: 2,
        healthyThresholdCount: 5,
        interval: cdk.Duration.seconds(30),
      },
    });

    targetGroup.addTarget(new elbv2_targets.InstanceTarget(this.webServer));

    alb.addListener('HttpListener', {
      port: 80,
      defaultTargetGroups: [targetGroup],
    });

    return alb;
  }
}

// インフラストラクチャ出力マネージャー
class InfrastructureOutputManager {
  constructor(private readonly scope: cdk.Stack) {}

  createOutputs(
    ec2Instance: ec2.Instance,
    rdsInstance: rds.DatabaseInstance,
    alb: elbv2.ApplicationLoadBalancer
  ): void {
    new cdk.CfnOutput(this.scope, 'EC2PublicDNS', {
      value: ec2Instance.instancePublicDnsName,
      description: 'EC2 Instance Public DNS',
    });

    new cdk.CfnOutput(this.scope, 'EC2PublicIP', {
      value: ec2Instance.instancePublicIp,
      description: 'EC2 Instance Public IP',
    });

    new cdk.CfnOutput(this.scope, 'RDSEndpoint', {
      value: rdsInstance.instanceEndpoint.hostname,
      description: 'RDS Instance Endpoint',
    });

    new cdk.CfnOutput(this.scope, 'ALBDNSName', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS Name',
    });
  }
}

// メインのスタッククラス
export class VpcEc2RdsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPCの構築
    const vpc = new VpcBuilder(this, InfrastructureConfig.vpc).build();
    
    // セキュリティグループの構築
    const securityGroups = new SecurityGroupBuilder(
      this,
      vpc,
      InfrastructureConfig.securityGroups
    ).build();

    // EC2インスタンスの構築
    const ec2Instance = new EC2Builder(
      this,
      vpc,
      securityGroups.webServerSg!,
      InfrastructureConfig.compute.ec2
    ).build();

    // RDSインスタンスの構築
    const rdsInstance = new RDSBuilder(
      this,
      vpc,
      securityGroups.dbServerSg!,
      InfrastructureConfig.compute.rds
    ).build();

    // ALBの構築
    const alb = new ALBBuilder(
      this,
      vpc,
      securityGroups.albSg!,
      ec2Instance,
      InfrastructureConfig.compute.alb
    ).build();

    // 出力の設定
    new InfrastructureOutputManager(this).createOutputs(ec2Instance, rdsInstance, alb);
  }
}