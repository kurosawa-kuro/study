# study-cdk

```
aws configure

ap-northeast-1
json

cdk bootstrap

cdk deploy

cdk destroy
```


```
cdk bootstrap && cdk deploy --require-approval never

cdk destroy --force && cdk bootstrap && cdk deploy --require-approval never
```



``` 
aws ssm get-parameter --name /ec2/keypair/key-0eeba2c81c2a8a8ae --region ap-northeast-1 --with-decryption --query Parameter.Value --output text > cdk-ec2.pem
```

```
chmod 400 cdk-ec2.pem
```


```
ssh -i cdk-ec2.pem ec2-user@3.113.26.124
```



# 新しいディレクトリを作成して移動
mkdir ec2-docker-compose
cd ec2-docker-compose

# CDKプロジェクトを初期化（TypeScript使用）
cdk init app --language typescript