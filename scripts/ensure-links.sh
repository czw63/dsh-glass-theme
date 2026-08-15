#!/bin/bash
# dsh-glass-theme 发图通道 symlink 自愈（幂等，可重复执行）
# 用途：cordis 从 dsh 安装目录解析插件 + /glass-assets 静态资源路由
set -e
SRC=/root/DeepSeek_harness/Workspace/dsh-glass-theme
PROFILE=/root/DeepSeek_harness/profiles/web
DSH_NM=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules

# 1) cordis server 端插件解析（@local/dsh-glass-theme 需在 dsh 安装树可见）
mkdir -p "$DSH_NM/@local"
ln -sfn "$PROFILE/node_modules/@local/dsh-glass-theme" "$DSH_NM/@local/dsh-glass-theme"

# 2) /glass-assets 静态资源目录（serve/ 挂进插件包）
mkdir -p "$SRC/serve"
ln -sfn "$SRC/serve" "$PROFILE/node_modules/@local/dsh-glass-theme/serve"

echo "✓ symlink 就绪:"
ls -la "$DSH_NM/@local/" | grep glass
ls -la "$PROFILE/node_modules/@local/dsh-glass-theme/" | grep serve
