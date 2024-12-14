.PHONY: deploy reset destroy-all help

# デフォルトのターゲット
.DEFAULT_GOAL := help

# 変数
ENV_FILE := .env

# コマンド
deploy: ## 通常デプロイ（初回または更新時）
	cdk bootstrap && cdk deploy --require-approval never

reset: ## 完全リセット（既存リソースを削除して再デプロイ）
	cdk destroy --force && cdk bootstrap && cdk deploy --require-approval never

destroy-all: ## すべてのスタックを完全に削除
	cdk destroy --force "*"

help: ## コマンド一覧を表示
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}' 