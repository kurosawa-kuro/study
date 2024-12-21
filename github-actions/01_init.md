# ブランチ戦略ガイドライン

## 1. はじめに
本ドキュメントでは、開発プロジェクトにおけるGitブランチの運用ルールとCI/CDフローを定義します。

## 2. 環境構成

### 2.1 インフラ環境
```yaml
開発環境:
  - プラットフォーム: AWS Lightsail
  - 用途: 日常的な開発作業

ステージング環境:
  - プラットフォーム: AWS EC2
  - 用途: テスト・検証
  - 特徴: 必要時のみ起動

本番環境:
  - プラットフォーム: AWS Fargate
  - 用途: 本番サービス提供
```

### 2.2 ブランチ構成
```yaml
主要ブランチ:
  main: 本番リリース用
  develop: 開発コード統合用
  staging: テスト・検証用

開発ブランチ:
  feature/*: 個別機能開発用
```

## 3. CI/CD フロー

### 3.1 機能開発からテスト
```yaml
feature → develop プルリクエスト時:
  CI実行:
    - ビルド検証
    - ユニットテスト
    - コードスタイルチェック
    - セキュリティスキャン

develop マージ後:
  CI/CD実行:
    - 統合テスト
    - EC2起動
    - ステージング環境デプロイ
    - テスト後EC2停止
```

### 3.2 本番リリース
```yaml
staging → main マージ時:
  CI/CD実行:
    - 本番用ビルド
    - E2Eテスト
    - Fargateへの自動デプロイ
```

## 4. 開発ワークフロー

### 4.1 機能開発の手順

1. **機能ブランチ作成**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/機能名
```

2. **ローカル開発（Lightsail上）**
```bash
# 変更をコミット
git add .
git commit -m "feat: 機能の説明"
git push -u origin feature/機能名
```

3. **プルリクエスト＆レビュー**
- 開発完了後、developブランチへのPRを作成
- CIチェック完了とレビュー承認を確認
- Githubでマージを実行

4. **ステージング確認**
- develop へのマージ後、自動でステージング環境へデプロイ
- EC2上で動作確認実施
- 問題なければstagingブランチへマージ

### 4.2 コミットメッセージ規則
```yaml
形式: <種類>: <説明>

種類:
  feat: 新機能
  fix: バグ修正
  docs: ドキュメント
  style: コード整形
  refactor: リファクタリング
  test: テスト
  chore: ビルド関連
```

### 4.3 品質チェック項目
```yaml
プルリクエスト時:
  - テストコードの整備
  - コードスタイル確認
  - レビュー完了
  - コンフリクト解消
  - CI通過確認

ステージング確認時:
  - 機能の動作確認
  - 統合テストの通過
  - パフォーマンス確認
```

## 5. トラブルシューティング

```bash
# 作業リセット
git reset --hard origin/feature/機能名

# developの変更取込
git checkout feature/機能名
git rebase develop

# コンフリクト解消後
git add .
git rebase --continue
git push -f origin feature/機能名
```

このフローにより、開発からデプロイまでの一貫した品質管理と自動化を実現します。

```
feature → develop（プルリクエスト時）:
  CI:
    - コードのビルド
    - ユニットテスト実行
    - コードスタイルチェック
    - セキュリティスキャン

develop へのマージ後:
  CI:
    - コードのビルド
    - 統合テスト実行
  CD:
    - ステージング環境への自動デプロイ
    - EC2インスタンスを起動して最新コードをデプロイ
    - テスト完了後、インスタンスを停止

staging へのマージ時:
  CI:
    - 本番用ビルド
    - E2Eテスト実行
  CD:
    - 本番環境（Fargate）への自動デプロイ
```