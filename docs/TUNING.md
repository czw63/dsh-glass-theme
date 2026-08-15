# 调参手册（TUNING）

本手册汇总 v2.1 的所有可调入口：设置页参数、localStorage 键、CSS 变量、SDF 透镜参数。键名 / 变量名均来自源码（`lib/client.template.js`）。

## 1. localStorage 键

| 键 | 取值 | 说明 |
| --- | --- | --- |
| `dsh-glass-theme:enabled` | `"0"` 关闭；其余或缺省视为开启 | **主题总开关**。只关闭玻璃视觉，手机端布局适配不受影响。 |
| `dsh-glass-theme:input-lens` | `"0"` 关闭；其余或缺省视为开启 | **输入框液态折射开关**。 |
| `dsh-glass-theme:settings` | JSON 字符串（键为设置项 id，见第 2 节） | 设置页滑块 / 开关的持久化存储，通常由设置页写入。 |
| `dsh-glass-theme:vars` | JSON 字符串，如 `{"--glass-bg-blur":"24px"}` | 用户对 `--glass-*` 变量的持久化覆盖，优先级高于设置页派生值。 |

取值约定：布尔键以 `"0"` 表示关，其余（含缺省、`null`）算开。

```js
localStorage['dsh-glass-theme:enabled'] = '0';    // 关玻璃视觉（手机适配仍在）
localStorage['dsh-glass-theme:input-lens'] = '0';  // 关输入框液态折射
localStorage.setItem('dsh-glass-theme:vars', JSON.stringify({ '--glass-bg-blur': '24px' }));
location.reload();
```

跨标签页实时同步：`storage` 事件 + 自定义事件 `dsh-glass-theme:change`。

## 2. 设置页（设置 → 插件 → 液态玻璃主题）

| 分组 | 控件 | 范围 | 对应设置键 |
| --- | --- | --- | --- |
| 外观 | 壁纸透明度 | 40% – 100% | `wallpaperOpacity` |
| 外观 | 玻璃圆角 | 8 – 40px | `glassRadius` |
| 外观 | 玻璃模糊半径 | 0 – 40px | `bgBlur` |
| 外观 | 背景折射开关 / 强度 | 0 – 48 | `bgRefract` / `bgRefractScale` |
| 输入框 | 液态折射开关 | on / off | `input-lens`（独立键） |
| 输入框 | 输入折射开关 / 模糊 / 透明度 / 折射强度 | — | `inputRefract` / `inputBlur` / `inputAlpha` / `refractScale` |
| 消息气泡 | 气泡玻璃化 / 折射 / 模糊 / 透明度 | — | `bubbleGlass` / `bubbleRefract` / `bubbleBlur` / `bubbleAlpha` |
| 面板与弹层 | 弹层模糊 / 面板透明度 / 侧边栏透明度 / 玻璃饱和度 | — | `popoverBlur` / `panelAlpha` / `sidebarAlpha` / `bgSaturate` |

参数即时生效并持久化到 `dsh-glass-theme:settings`。

## 3. CSS 变量（`body.dsh-glass-on`，深色在 `[data-ds-dark-theme]`）

### 3.1 玻璃渲染变量

| 变量 | 默认（浅 / 深） | 说明 |
| --- | --- | --- |
| `--glass-wallpaper-opacity` | .92 / .90 | 壁纸层不透明度 |
| `--glass-radius-xl` | 28px | 玻璃岛大圆角（同时驱动 SDF 透镜轮廓） |
| `--glass-radius-lg` | 22px | 小岛 / 卡片圆角 |
| `--glass-bg-blur` | 16px / 18px | 侧栏 / 标题玻璃岛的 backdrop 模糊 |
| `--glass-input-blur` | 12px | 输入卡岛 backdrop 模糊 |
| `--glass-popover-blur` | 18px | 弹层 / 菜单 backdrop 模糊 |
| `--glass-bubble-blur` | 7px | 气泡 backdrop 模糊 |
| `--glass-island-saturate` | 1.5 | 玻璃岛 saturate 系数 |

### 3.2 表面颜色（`--lg-*`，玻璃岛背景）

| 变量 | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--lg-shell-bg` | rgba(255,255,255,.08) | rgba(16,22,36,.16) | 侧栏岛背景 |
| `--lg-pane-bg` | rgba(255,255,255,.12) | rgba(18,24,40,.14) | 标题岛 / 正文岛背景 |
| `--lg-card-bg` | rgba(255,255,255,.46) | rgba(24,32,50,.52) | 设置卡片背景 |
| `--lg-control-bg` | rgba(248,251,255,.80) | rgba(24,32,50,.76) | 输入卡岛背景 |
| `--lg-overlay-bg` | rgba(248,251,255,.92) | rgba(22,26,36,.92) | 弹层 / 菜单背景 |
| `--lg-border` / `--lg-border-strong` | 白 .46 / .62 | 白 .12 / .22 | 岛描边 |
| `--lg-highlight` | 白 .78 | 白 .18 | 顶部内高光 |
| `--lg-text-primary` / `--lg-text-secondary` | #2c3340 / #5b6472 | #eef2f8 / rgba(226,234,255,.70) | 玻璃上文字 |

> 无 `backdrop-filter` 支持时（`@supports not`），`--lg-*` 表面 alpha 自动提高（.72–.94）保证可读性。

## 4. SDF 透镜参数（`ISLAND_LENS`）

`lib/client.template.js` 的 `Liquid Glass 光学核心` 段：

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `strength` | 0.14 | 位移折射强度（由 `refractScale` / `bgRefractScale` 映射） |
| `cornerRadius` | 28 | 透镜轮廓圆角（与 `glassRadius` 同步） |
| `dispersion` | 0.06 | RGB 通道分离色散 |
| `depthPx` | 16 | 边缘折射深度 |
| `curvature` | 0.08 | 中央穹顶曲率 |
| `bend` / `bendPx` | 0.78 / 14 | 边缘弯曲扰动 |
| `mapSize` | 768 | 位移贴图最大边 |

参数变化递增透镜修订号，触发贴图重建（清缓存 → 重建 SVG filter → 重新生成贴图），
同尺寸 + 同参数命中 LRU 缓存（16 项）。

## 5. 控制台 API

```js
window.__dshGlassTheme.enabled();               // 查询玻璃视觉是否开启（boolean）
window.__dshGlassTheme.on();                    // 开
window.__dshGlassTheme.off();                   // 关（仅玻璃）
window.__dshGlassTheme.toggle();                // 切换
window.__dshGlassTheme.lensOn();                // 开输入框折射
window.__dshGlassTheme.lensOff();               // 关输入框折射
window.__dshGlassTheme.setVar('--glass-bg-blur', '20px');
window.__dshGlassTheme.clearVars();
window.__dshGlassTheme.reapply();
```
