```
# システムのアップデート
sudo yum update -y

# Gitのインストール
sudo yum install -y git

# インストールの確認
git --version

# Dockerのインストール
sudo yum install -y docker

# Dockerサービスの起動
sudo systemctl start docker

# システム起動時にDockerが自動的に起動するように設定
sudo systemctl enable docker

# 現在のユーザー(ec2-user)をdockerグループに追加
sudo usermod -aG docker ec2-user

# Docker Composeのインストール
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Docker Composeに実行権限を付与
sudo chmod +x /usr/local/bin/docker-compose

# Docker Composeのバージョン確認
docker-compose --version    

exit

# その後、クローンを実行
git clone https://github.com/kurosawa-kuro/typescript-go-dev-container.git

# クローンしたディレクトリに移動
cd typescript-go-dev-container
```


```
docker-compose up
docker-compose up -d
```

```
docker-compose logs -f backend
docker-compose logs -f frontend
```


http://13.113.190.86:3000/dev