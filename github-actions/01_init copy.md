下記の設定を行いたいです

開発からステージングへの移行サイクル

hub
Github

tool
github-actions

開発
AWS Lightsail


ステージング
AWS Lightsail
パブリック IPv4 アドレス 13.231.179.166

github key id_rsa


AWS ACCESS_KEY_ID	SECRET_ACCESS_KEY 確保済み

develop へのマージ後:
  CD:
    - ステージング環境への自動デプロイ


このワークフローを動作させるために、GitHubのリポジトリの Settings > Secrets and variables > Actions で以下のシークレットを設定する必要があります：
AWS_ACCESS_KEY_ID: AWSアクセスキーID
AWS_SECRET_ACCESS_KEY: AWSシークレットアクセスキー
SSH_PRIVATE_KEY: GitHub用のSSH秘密鍵（id_rsa）の内容
これらのシークレットを設定すれば、developブランチへのマージ時に自動的にステージング環境へデプロイされます。