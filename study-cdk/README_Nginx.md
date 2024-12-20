# EPELリポジトリを有効化
sudo amazon-linux-extras install epel -y

# Nginxをインストール
sudo yum install nginx -y

# Nginxを起動
sudo systemctl start nginx

# システム起動時にNginxを自動的に起動する設定
sudo systemctl enable nginx

# Nginxのステータス確認
sudo systemctl status nginx


http://3.113.26.124/index.html