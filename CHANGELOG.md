# Changelog

本项目的所有值得注意的变更都会记录在此文件中。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2025-08-15

### 新增
- iOS 26 液态玻璃（Liquid Glass）全局主题：背景插画静态模糊 + 分层半透明玻璃面板。
- 自动适配深浅色（跟随 `body[data-ds-dark-theme]`）。
- 30+ 可调 `--glass-*` CSS 变量（背景模糊/降饱和/亮度、面板不透明度、圆角、磨砂半径、高光、噪点、光斑等）。
- 液态折射（canvas 位移图 + feImage + feDisplacementMap）作用于输入卡片。
- 可视化设置卡片（设置 → 插件 → 液态玻璃主题）：主题开关、背景图片上传、背景模糊、输入框磨砂、用户/AI 气泡透明度、侧边栏透明度、面板圆角、磨砂颗粒、恢复默认。
- 用户气泡与 AI 气泡**分开控制透明度**（`.gdEzaW_userRow .gdEzaW_bubble` vs `.gdEzaW_bubble`）。
- 发图通道：server 端 `/glass-assets` 同源静态路由 + `serve/` 目录，供 AI 向 WebUI 贴图/发文件。
- 一键部署脚本 `scripts/deploy.sh` 与 symlink 自愈脚本 `scripts/ensure-links.sh`。

### 性能
- 背景模糊为 `body::before` 一次性静态合成（无逐帧动画、无滚动监听）。
- `backdrop-filter` 实时模糊仅用于弹层/菜单/气泡/输入卡片等中/小面积；侧边栏/详情栏/主区用纯半透明。
- 气泡不透明度 ≥ 80%（默认 82%）保障正文/代码/表格可读性。

### 兼容
- `@supports` 降级：不支持 `color-mix` / `backdrop-filter` 时回退不透明原色。
- `prefers-reduced-motion: reduce` 关闭全部过渡/动画。

[1.0.0]: https://github.com/czw63/dsh-glass-theme/releases/tag/v1.0.0
