FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:18

# AWS CLIのインストール
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf aws awscliv2.zip

# AWS CDKのインストール
RUN npm install -g aws-cdk

# 追加のツール類のインストール
RUN apt-get update && apt-get install -y \
    jq \
    && rm -rf /var/lib/apt/lists/* 