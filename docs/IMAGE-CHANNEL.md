# dsh-glass-theme 发图通道（AI → WebUI 贴图）

## 一句话
把图片/文件放进 `serve/` 目录，用 markdown `![](https://你的域名/glass-assets/文件名)`
即可在聊天里展示给用户（同源、自动带认证）。**请用用户实际访问的域名，绝不能用 127.0.0.1**。

## 关键事实
- **图片 URL 格式**: `https://<你的域名>/glass-assets/<文件名>`
- **图片目录**: `<项目目录>/serve/`
- **路由**: server 端插件 `lib/index.js` 注册 `/glass-assets`（prefix，同源）
- **把 127.0.0.1 当图片 URL 发给用户 = 用户打不开**（127 在用户浏览器里是用户自己的机器）

## 发图步骤
1. 生成/复制图片到 `serve/` 目录（如 `cp shot.png serve/shot.png`）
2. 回复里写 markdown：`![描述](https://<你的域名>/glass-assets/shot.png)`
3. 验证：`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3080/glass-assets/shot.png`（本机测 3080，发给用户用域名）

## 依赖（重启/重装后需自愈）
- `scripts/ensure-links.sh` 幂等重建两个 symlink：
  1. `<dsh 安装目录>/node_modules/@local/dsh-glass-theme` → profile 插件目录（cordis server 端解析必需）
  2. `profiles/web/node_modules/@local/dsh-glass-theme/serve` → 项目 `serve/`（静态资源）
- 若 `/glass-assets` 404：先跑 `bash scripts/ensure-links.sh` 再重启
- 一键部署：`bash scripts/deploy.sh`（ensure-links + build + 重启 + 验证）

## 发文件
同源路由支持任意文件（MIME 映射在 index.js），URL 格式相同；聊天里用
`[文件名](https://<你的域名>/glass-assets/xxx.pdf)` 给下载链接。

## 技术要点（为什么这样设计）
- cordis 插件加载用 `createRequire(import.meta.url)` 从 **dsh 安装目录**解析包名，
  `@local/dsh-glass-theme` 在 profile node_modules → 必须 symlink 到 dsh 安装树（否则 MODULE_NOT_FOUND，server 端不加载）
- `ctx.webServer.register({kind:"prefix", path:"/glass-assets", handler})` 注册同源路由
- 插件 server 端入口 `lib/index.js`（export apply + inject:["webServer"]）；client 端 `lib/client.js`
