# 手机端适配（MOBILE）

手机端适配**常驻生效**，与玻璃视觉开关解耦：`localStorage['dsh-glass-theme:enabled'] = '0'` 只关闭玻璃视觉，单栏 / 抽屉 / Sheet / 安全区 / 触控目标仍然生效。

## 1. 断点总览

插件唯一的移动端断点是 `(max-width: 768px)`（常量 `MOBILE_MQ`），移动端布局 CSS 全部写在该媒体查询内。

| 视口宽度 | 插件行为 |
| --- | --- |
| `<= 768px` | 强制单栏 + 抽屉侧边栏 + 详情底部 Sheet + 安全区 + 44px 触控 + 动态视口。 |
| `769–1024px` | 不强制单栏，保持 DSH 原生窄屏布局；仅叠加全局 `viewport-fit=cover`（安全区）、`--dsh-glass-vv` 变量、浮动开关与桌面端玻璃效果。 |
| `>= 1024px` | 桌面端，不受移动布局影响。 |

> 说明：插件代码里**没有**单独的 769–1024 断点；这段宽度不触发 `<= 768px` 的移动 CSS，因此保持 DSH 原生窄屏行为。

## 2. `<= 768px` 详细行为

### 2.1 三栏变单栏

- `body .pI_x6G_frame` 改为 `grid-template-columns: minmax(0, 1fr)`，高度取 `--dsh-glass-vv`。
- `body .pI_x6G_centerCol` 固定到第 1 列第 1 行，占满宽度，禁止横向溢出。
- `html, body, #root` 与聊天内容（`pre` / `table` / `img`）设 `max-width: 100%`，`table` 改为 `display:block; overflow-x:auto`，避免横向滚动。

### 2.2 抽屉侧边栏

- `body .pI_x6G_sidebarCol` 脱离 Grid，改为 `position: fixed`：
  - 收起态 `left: calc(-12px - min(86vw, 360px))`（完全移出视口）；
  - 展开态（`body .pI_x6G_frame:not([data-sidebar-collapsed]) .pI_x6G_sidebarCol`）`left: 0`。
  - 宽度 `min(86vw, 360px)`，最大 `calc(100vw - 28px)`，高度 `--dsh-glass-vv`，`z-index: 1200`。
  - `border-right` + `border-radius: 0 24px 24px 0` + 右侧投影。
  - 过渡 `left .28s cubic-bezier(.22,.8,.36,1)`，收起时用 `visibility` 延迟隐藏。
- 打开方式：`.dsh-glass-hamburger`（汉堡按钮，`<= 768px` 显示，44×44，固定在左上安全区）或 DSH 原生侧边栏开关。
- 关闭方式：点 `.dsh-glass-scrim` 遮罩。`toggleSidebar()` 优先调 `window.__dshGlassThemeCtx.layout.toggleSidebar()`，失败则回退点击原生 `.hHd-Xa_toggle`。

### 2.3 详情栏底部 Sheet

- `body .pI_x6G_detailsCol` 改为 `position: fixed`：
  - 收起态 `top: 100%`（屏幕下方之外）；
  - 展开态（`:not([data-details-collapsed])`）`top: 0`，成为全屏 Sheet。
  - 宽 100%、高 `--dsh-glass-vv`，`z-index: 1300`。
  - `border-radius: 26px 26px 0 0` + 顶部向上投影。
  - 过渡 `top .30s`。
- 收起方式：点遮罩，或原生「关闭详情」按钮（`closeDetails()` 调 `ctx.layout.closeDetails()`，失败则点击 `.ydkMvW_close` / `[aria-label='关闭详情']` / `[aria-label='Close details']`）。
- 拖拽手柄 `body .pI_x6G_handle` 在移动端隐藏（`display: none`）。

### 2.4 安全区（Safe Area）

- `apply()` 里的 `ensureViewportMeta()` 确保 `<meta name="viewport">` 含 `viewport-fit=cover`（缺失时补 `width=device-width, initial-scale=1, viewport-fit=cover`）。
- `env(safe-area-inset-top/right/bottom/left)` 被应用到：会话区头部、输入卡左右内边距、输入底栏、详情栏头部 / 主体、设置页导航 / 选项区、汉堡按钮 / 浮动开关定位等。

### 2.5 动态视口 / 软键盘

- CSS 默认：`html { --dsh-glass-vv: 100vh; }`，并在 `@supports (height: 100dvh)` 时用 `100dvh`。
- 运行时：`syncVisualViewport()` 在移动端且存在 `visualViewport` 时，把 `--dsh-glass-vv` 设为 `visualViewport.height`（px），软键盘弹出时高度随之缩小，输入框仍可见。
- `visualViewport` 的 `resize` / `scroll` 与 `window.resize` 用 rAF 节流触发同步。
- `focusin` 时若输入卡 `.uV2eYG_card` 底部超出视口，则 `scrollIntoView({ block: "nearest" })`。

### 2.6 44px 触控目标（Apple HIG）

以下控件最小触控高度 / 尺寸统一到 44px：

| 选择器 | 规则 |
| --- | --- |
| `.hHd-Xa_iconButton` | 44×44，圆角 14px |
| `.hHd-Xa_newSession` | `min-height: 44px` |
| `.VOzbGW_trigger` / `.VOzbGW_navCell` / `.VOzbGW_close` | `min-height: 44px`（`navCell` 另加水平内边距，`close` 44×44） |
| `.uV2eYG_add` / `.uV2eYG_primary` | 44×44 |
| `.uV2eYG_select` | `height: 44px` |
| `.uV2eYG_modes` 及其子项 | `min-width: 44px` |
| `.ydkMvW_close` | 44×44 |
| `.wSkVaW_crumb` / `.wSkVaW_tab` | `min-height: 44px` |

输入卡底栏 `.uV2eYG_row` 在空间不足时 `flex-wrap: wrap`，防止权限 / 模型按钮被压缩重叠。

### 2.7 设置页与弹层

- 设置页 `.VOzbGW_overlay` / `.VOzbGW_panel` 改为手机全屏面板（`100vw` × `--dsh-glass-vv`，无圆角）。
- 左侧导航 `.VOzbGW_nav` 变顶部横向导航（`flex-direction: row` + 横向滚动），`.VOzbGW_navTitle` 隐藏。
- `[role="menu"]` / `[role="listbox"]` / `[role="tooltip"]` / `[role="dialog"]` 限制在 `calc(100vw - 16px)` × `calc(var(--dsh-glass-vv) - 16px)` 内，超出滚动。
- 从抽屉打开设置时，先收起抽屉，避免设置弹层被侧边栏遮挡。

## 3. 降级策略

### 3.1 移动端降级（`<= 768px`）

| 项目 | 行为 |
| --- | --- |
| 壁纸层 | 保持清晰（`filter: none`），不按端降级；透明度由 `--glass-wallpaper-opacity` 控制。 |
| 消息气泡 | 关闭 `backdrop-filter`（`backdrop-filter: none`；气泡磨砂本身也门控在 `min-width: 769px`）。 |
| 输入卡 | 圆角沿用 `--glass-radius-xl`；SDF 位移折射（`dsh-glass-lens-input`）保留。 |
| 指针视差 / 光斑 | 仅精细指针启用；触屏 / 粗指针下 `.dsh-glass-sheen` 隐藏，且不挂 `pointermove` 监听。 |

> 精确说明：输入卡的 SDF 位移折射（`dsh-glass-lens-input`）**未按宽度关闭**，仍由「输入框液态折射」与「输入框背景折射」两个开关控制。真正按端降级的是气泡磨砂与指针跟随两项。

### 3.2 能力与偏好降级

| 条件 | 行为 |
| --- | --- |
| `prefers-reduced-motion: reduce` | 抽屉 / Sheet / 设置卡 / 开关过渡全部 `transition: none`，光斑 `display: none`。 |
| 不支持 `backdrop-filter` | `@supports not (...)` 把 `--glass-base-alpha` 等抬到 `.82` 以上，改以实色保证可读性。 |
| 无 `visualViewport` | `--dsh-glass-vv` 回退 CSS 默认（`100vh` / `100dvh`）。 |

## 4. 相关变量与 API

- 视口高度变量：`--dsh-glass-vv`（`<html>` 上）。
- 内容宽度：`.wSkVaW_root` 上的 `--dsh-chat-content-width` 与 `--dsh-composer-card-max-width`（`min(748px, 100vw - 32px)`）。
- 侧边栏 / 详情开关状态来自 `.pI_x6G_frame` 的 `data-sidebar-collapsed` / `data-details-collapsed` 属性，`MutationObserver` 监听这两个属性以刷新汉堡 / 遮罩。
