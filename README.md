# dsh-glass-theme

DeepSeek Harness（DSH）WebUI 的 **iOS 26 液态玻璃（Liquid Glass）主题**，并包含**常驻手机端 UI 适配**。

- 手机端适配与玻璃主题解耦：`localStorage['dsh-glass-theme:enabled'] = '0'` 只关闭玻璃视觉，单栏聊天、抽屉侧边栏、详情 Sheet、安全区、44px 触控目标仍然生效。
- 液态玻璃渲染全部重新编写，零运行时第三方依赖。
- 输入框是玻璃重点：边缘内高光、小面积 backdrop 磨砂、SVG `feTurbulence + feDisplacementMap` 位移折射；镜面高光与色散边纹用 CSS 渐变/box-shadow 近似，并有 rAF 节流的指针视差阴影；移动端自动降级（背景位移与气泡磨砂关闭，输入框折射保留）。
- 背景插画（`assets/background.jpg`）在构建时内联为 data URL，放固定层做一次性 `blur + saturate + brightness` 合成，滚动/交互零成本。

## 一、安装（web profile）

```bash
git clone https://github.com/czw63/dsh-glass-theme.git
cd dsh-glass-theme
node scripts/build.mjs   # 把 assets/background.jpg 内联进 lib/client.js

dsh plugin --profile web add "file:$(pwd)"
```

然后在 `~/.dsh/profiles/web/cordis.patch.yml` 追加：

```yaml
- insert:
    - id: glass-theme
      name: '@local/dsh-glass-theme'
```

重启并强刷：

```bash
systemctl restart dsh.service
# 浏览器打开 http://127.0.0.1:3080/ 后 Ctrl+F5
```

验证注入：

```bash
curl -s http://127.0.0.1:3080/ | grep -o '/plugins/@local/dsh-glass-theme/client.js[^"]*'
```

> 注意：pnpm `file:` 安装会把文件硬链接到 profile 的 `node_modules`。**改完源码后必须重新执行
> `node scripts/build.mjs`，并把 `lib/client.js` 复制到 profile 的 `node_modules/@local/dsh-glass-theme/lib/client.js`**，
> 然后重启服务。直接覆盖写模板可能让硬链接失效。

## 二、卸载

```bash
dsh plugin --profile web remove @local/dsh-glass-theme
```

并从 `cordis.patch.yml` 删除 `glass-theme` 的 `insert` 块，然后：

```bash
systemctl restart dsh.service
```

浏览器强刷后恢复 DSH 默认外观与桌面/手机默认布局。

## 三、开关与调参

### 1. 设置页开关

打开 DSH 设置 → 插件 → **液态玻璃主题**：

- **主题总开关**：关闭后恢复 DSH 默认视觉；手机端布局适配不受影响。
- **输入框液态折射**：控制输入卡的边缘高光、backdrop 磨砂、SVG 位移折射/高光/色散。移动端此开关仍保留基础玻璃卡片，但自动去除 SVG filter 与指针跟随。

### 2. localStorage

```js
localStorage['dsh-glass-theme:enabled'] = '0'   // 关闭玻璃视觉（手机适配仍在）
localStorage['dsh-glass-theme:input-lens'] = '0' // 关闭输入框液态折射
```

跨标签页实时同步。

### 3. `--glass-*` CSS 变量

所有视觉参数都暴露为 CSS 变量，可在 DevTools 或 `localStorage['dsh-glass-theme:vars']` 中覆盖，例如：

```js
// 持久化覆盖
localStorage.setItem('dsh-glass-theme:vars', JSON.stringify({
  '--glass-bg-blur': '24px',
  '--glass-base-alpha': '.52',
  '--glass-input-alpha': '.40',
  '--glass-radius-xl': '28px'
}));
location.reload();
```

常用变量：

| 变量 | 默认（浅/深） | 说明 |
| --- | --- | --- |
| `--glass-bg-blur` | 16px / 18px | 背景静态模糊半径 |
| `--glass-bg-saturate` | .78 / .82 | 背景降饱和 |
| `--glass-bg-brightness` | 1.04 / .62 | 背景压暗/提亮 |
| `--glass-base-alpha` | .40 / .46 | 页面底色实色占比 |
| `--glass-sidebar-alpha` | .52 / .58 | 侧边栏透明度 |
| `--glass-input-alpha` | .48 / .34 | 输入卡透明度 |
| `--glass-bubble-alpha` | .86 / .84 | 消息气泡透明度（无下限，可在设置页滑到 0） |
| `--glass-popover-alpha` | .93 / .94 | 弹层/菜单透明度 |
| `--glass-popover-blur` | 18px | 弹层 backdrop 模糊 |
| `--glass-input-blur` | 12px | 输入框 backdrop 模糊 |
| `--glass-radius-xl` | 24px | 输入卡大圆角 |
| `--glass-highlight` | 白 .72 / 白 .30 | 顶部内高光强度 |
| `--glass-noise-opacity` | .05 / .065 | 磨砂颗粒强度 |

也可用控制台 API：

```js
window.__dshGlassTheme.enabled();               // 查询玻璃视觉是否开启（返回 boolean）
window.__dshGlassTheme.on();                    // 开
window.__dshGlassTheme.off();                   // 关（仅玻璃）
window.__dshGlassTheme.toggle();                // 切换
window.__dshGlassTheme.lensOn();                // 开输入框折射
window.__dshGlassTheme.lensOff();               // 关输入框折射
window.__dshGlassTheme.setVar('--glass-bg-blur', '20px');
window.__dshGlassTheme.clearVars();
window.__dshGlassTheme.reapply();
```

## 四、手机端适配（始终生效）

`<= 768px` 时：

- `.pI_x6G_frame` 强制单栏；侧边栏成为左侧抽屉（86vw / 360px 封顶），通过汉堡按钮或 DSH 原生侧边栏开关打开，点遮罩关闭。
- 详情栏成为全屏底部 Sheet，点遮罩或原生「关闭详情」按钮收起。
- 拖拽手柄 `.pI_x6G_handle` 隐藏。
- 顶部/底部使用 `env(safe-area-inset-*)`；高度使用 `100dvh` 并在运行时跟随 `visualViewport`，软键盘弹出时输入框仍可见。
- 常用按钮、菜单项最小触控高度 44px；聊天消息、设置页、菜单不产生横向滚动。
- 设置页改为手机全屏面板，左侧导航变顶部横向导航。
- 桌面 `>= 1024px` 不受影响；`768–1024px` 保持 DSH 原生窄屏行为，仅补充安全区与通用触控修正。

## 五、实现说明（升级维护）

- 主题不修改 DSH 源码，只注入 3 个 `<style>` 节点：
  - `data-plugin="dsh-glass-theme-mobile"`：移动端布局，常驻。
  - `data-plugin="dsh-glass-theme-controls"`：汉堡/开关/遮罩/设置卡片。
  - `data-plugin="dsh-glass-theme"`：玻璃视觉，随开关插入/移除。
- 依赖的稳定接口：`body[data-ds-dark-theme]`、`--dsw-*` token、`.pI_x6G_frame[data-sidebar-collapsed][data-details-collapsed]`、`.wSkVaW_*`、`.uV2eYG_*`、`.ydkMvW_*`、`.VOzbGW_*`。DSH 升级后若类名变化，优先检查这些选择器。
- 液体效果思路来自 AndrewPrifer/liquid-dom（SDF 折射、specular highlights、边缘色散、位移扰动），本插件用 CSS + SVG filter 做轻量近似，不使用 WebGPU/SDF 引擎；移动端与 `prefers-reduced-motion` 自动降级。

## 六、性能

- 背景模糊在固定层一次性合成；聊天主区/侧边栏/详情栏不做大面积 `backdrop-filter`。
- `backdrop-filter` 仅用于输入卡、弹层/菜单、气泡（桌面端）等中小面积。
- 无逐帧动画、无滚动/尺寸轮询；指针视差用 rAF 节流，`prefers-reduced-motion` 全部关闭。

## 七、贡献

欢迎提交 issue 与 PR。约定：

- 渲染逻辑集中在 `lib/client.template.js`；改动后必须执行 `node scripts/build.mjs` 重新生成 `lib/client.js`，并按上文说明同步到 profile 的 `node_modules`。
- 新增或调整手机端布局、玻璃视觉、设置页参数时，请同步更新 `CHANGELOG.md` 与 `docs/`（`ARCHITECTURE.md`、`TUNING.md`、`MOBILE.md`）。
- 保持零第三方运行时依赖；确认 `prefers-reduced-motion` 与移动端降级仍然生效。
- 文档统一使用简体中文。

更多实现细节见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)，调参见 [`docs/TUNING.md`](docs/TUNING.md)，手机端适配见 [`docs/MOBILE.md`](docs/MOBILE.md)。
