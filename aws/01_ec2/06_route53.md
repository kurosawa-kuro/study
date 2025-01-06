# ドメイン紐づけ・HTTPS設定手順書

## 前提条件
```
1. ドメイン設定
   - ルートドメイン: tk-web-training.link
   - サブドメイン: first-trial.tk-web-training.link

2. インフラ構成
   - EC2インスタンス稼働中
   - ALB設定済み
   - Webアプリケーション（Express）: 8080ポート

3. セキュリティグループ
   EC2 (cdkjavascript01-app-sg):
   - SSH (22) from 0.0.0.0/0
   - カスタムTCP (8080) from cdkjavascript01-alb-sg

   ALB (cdkjavascript01-alb-sg):
   - HTTP (80) from 0.0.0.0/0

4. 動作確認済み
   http://cdkjavascript01alb-1156340651.ap-northeast-1.elb.amazonaws.com/
```

## 1. ドメイン紐づけ設定

### 1.1 Route 53でAレコード設定
```
- レコード名: first-trial.tk-web-training.link
- タイプ: A
- エイリアス: はい
- エイリアス先: ALBのDNS名
- ルーティング先: Application/Network Load Balancer
- リージョン: ap-northeast-1
- ヘルスチェック: いいえ
```

### 1.2 DNS伝播確認
```bash
# Aレコード確認
dig first-trial.tk-web-training.link A +short

# 名前解決確認
nslookup first-trial.tk-web-training.link

# HTTP接続確認
curl -v first-trial.tk-web-training.link
```

## 2. HTTPS設定

### 2.1 ACM証明書リクエスト
```
1. 証明書タイプ選択
   - パブリック証明書

2. ドメイン名設定
   - *.tk-web-training.link（ワイルドカード証明書）
   - first-trial.tk-web-training.link

3. 検証方法
   - DNS検証
   - 「Route 53 でレコードを作成」をクリック

4. 検証状態確認
   dig _<検証値>.tk-web-training.link CNAME
```

### 2.2 ALBリスナー設定
```
1. HTTPSリスナー（443）作成
   - プロトコル: HTTPS
   - ポート: 443
   - デフォルトアクション: 
     - ターゲットグループ転送
   - 証明書: ACM証明書選択
   - セキュリティポリシー: 推奨設定

2. HTTPリスナー（80）設定
   - プロトコル: HTTP
   - ポート: 80
   - デフォルトアクション: 
     - HTTPS（443）にリダイレクト
```

### 2.3 セキュリティグループ更新
```
ALB (cdkjavascript01-alb-sg)に追加:
- HTTPS (443) from 0.0.0.0/0
```

## 3. 動作確認

### 3.1 HTTPSアクセス確認
```bash
curl -vI https://first-trial.tk-web-training.link
```

### 3.2 HTTPリダイレクト確認
```bash
curl -vI http://first-trial.tk-web-training.link
```

### 3.3 証明書確認
```bash
openssl s_client -connect first-trial.tk-web-training.link:443 \
  -servername first-trial.tk-web-training.link
```

## 4. トラブルシューティング

### 4.1 DNS関連
```
- DNSキャッシュクリア
  Mac: sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
  Linux: sudo systemd-resolve --flush-caches

- 伝播待機: 最大48時間
```

### 4.2 セキュリティ確認
```
1. セキュリティグループ
   - ALB: 80, 443ポート許可
   - EC2: 8080ポート（ALBからのみ）

2. リスナールール
   - 443: ターゲットグループ転送
   - 80: HTTPSリダイレクト

3. 証明書
   - 検証ステータス
   - 有効期限
```
