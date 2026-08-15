#!/bin/bash
# dsh-glass-theme 一键部署：ensure-links → build → 重启 → 验证
set -e
SRC=/root/DeepSeek_harness/Workspace/dsh-glass-theme
bash "$SRC/scripts/ensure-links.sh"
node "$SRC/scripts/build.mjs"
systemctl restart dsh.service
echo "等待服务..."
for i in $(seq 1 40); do
  curl -s -o /dev/null http://127.0.0.1:3080/ && { echo "服务就绪(第$i次)"; break; }
  sleep 1
done
echo "--- 验证 ---"
curl -s -o /dev/null -w "路由 /glass-assets/test.png: %{http_code} %{content_type}\n" http://127.0.0.1:3080/glass-assets/test.png
curl -s http://127.0.0.1:3080/ | grep -o '/plugins/@local/dsh-glass-theme/client.js[^"]*'
echo "部署完成"
