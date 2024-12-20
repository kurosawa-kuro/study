# Amazon Linux 2023 初期設定手順書

## 1. 基本設定
### 1.1. システムアップデート
```bash
# システムパッケージを最新に更新
sudo dnf update -y
```

### 1.2. 基本開発ツールのインストール
```bash
# Git, makeのインストール
sudo dnf install git make -y
```

### 1.3. メモリ状態の確認
```bash
# メモリ使用状況の確認
free -h
```

## 2. メモリ管理設定
### 2.1. スワップ領域の設定
```bash
echo '#!/bin/bash

if [ "$EUID" -ne 0 ]; then echo "Please run as root or with sudo"; exit 1; fi

SWAP_FILE="/swapfile"
SWAP_SIZE="4096"

echo "Starting swap file setup..."
[ -f "$SWAP_FILE" ] && { swapoff "$SWAP_FILE" || echo "Failed to deactivate old swap"; rm "$SWAP_FILE" || echo "Failed to remove old swap file"; }
dd if=/dev/zero of="$SWAP_FILE" bs=1M count="$SWAP_SIZE" status=progress || { echo "Failed to create swap file"; exit 1; }
chmod 600 "$SWAP_FILE" || { echo "Failed to set permissions"; exit 1; }
mkswap "$SWAP_FILE" || { echo "Failed to set up swap space"; exit 1; }
swapon "$SWAP_FILE" || { echo "Failed to enable swap"; exit 1; }
echo "Verifying swap configuration..."; swapon -s
grep -q "$SWAP_FILE" /etc/fstab || echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
echo "Swap setup completed successfully!"' | sudo tee /usr/local/bin/setup-swap.sh > /dev/null && sudo chmod +x /usr/local/bin/setup-swap.sh

sudo setup-swap.sh
```

### 2.2. キャッシュクリアツールの設定
```bash
# キャッシュクリアスクリプト作成
echo 'sync && echo 3 | sudo tee /proc/sys/vm/drop_caches' > ~/clear-cache.sh
chmod +x ~/clear-cache.sh
```

## 3. 開発環境設定
### 3.1. SSH設定
```bash
# SSHディレクトリ作成
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 秘密鍵設置
vi ~/.ssh/id_rsa
chmod 600 ~/.ssh/id_rsa
```

### 3.2. Git設定
```bash
# Git設定
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# GitHub接続確認
ssh -T git@github.com
```

### 3.3. Node.js設定
```bash
# Node.jsリポジトリ追加
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -

# Node.jsインストール
sudo yum install -y nodejs

# バージョン確認
node --version
npm --version
```

### 3.4. Docker設定
```bash
# Dockerインストール
sudo yum install -y docker

# Docker Compose インストール
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## 4. メンテナンス設定
### 4.1. ログ管理
```bash
# ログクリアスクリプト作成
echo 'sudo find /var/log -type f -name "*.log" -exec truncate -s 0 {} \;' > ~/clear-logs.sh
chmod +x ~/clear-logs.sh
```

### 4.2. npm設定（オプション）
```bash
# npmキャッシュクリア用エイリアス
echo 'alias npm-clear-cache="npm cache clean --force"' >> ~/.bashrc

# 低メモリ実行用エイリアス
echo 'alias npm-low-memory="NODE_OPTIONS=\"--max-old-space-size=512\" npm"' >> ~/.bashrc

# 設定の反映
source ~/.bashrc
```

## 5. セットアップ確認
```bash
# 各種バージョン確認
uname -a
git --version
node --version
npm --version
docker --version
docker-compose --version

# メモリ状態確認
free -h
```

## トラブルシューティング
1. メモリ関連
   - メモリ不足: `~/clear-cache.sh` を実行
   - スワップ確認: `swapon -s`

2. npm関連
   - インストールエラー: `npm-clear-cache` を実行
   - メモリエラー: `npm-low-memory` を使用

3. Docker関連
   - 権限エラー: `sudo usermod -aG docker $USER`
   - サービス起動: `sudo systemctl start docker`

## 注意事項
- システム更新は定期的に実行
- SSHキーは安全に管理
- スワップ設定は初回のみ必要
- メモリ使用状況は定期的に確認