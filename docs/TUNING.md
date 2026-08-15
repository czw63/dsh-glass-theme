# 调参手册（TUNING）

本手册汇总所有可调入口：localStorage 键、CSS 变量、设置页参数、控制台 API、深浅色差异。所有键名 / 变量名 / API 名均来自源码（`lib/client.template.js`）。

## 1. localStorage 键

| 键 | 取值 | 说明 |
| --- | --- | --- |
| `dsh-glass-theme:enabled` | `"0"` 关闭；其余或缺省视为开启 | **主题总开关**。只关闭玻璃视觉，手机端布局适配不受影响。 |
| `dsh-glass-theme:input-lens` | `"0"` 关闭；其余或缺省视为开启 | **输入框液态折射开关**：边缘高光、backdrop 磨砂、SVG 位移折射。 |
| `dsh-glass-theme:vars` | JSON 字符串，如 `{"--glass-bg-blur":"24px"}` | 用户对 `--glass-*` 变量的持久化覆盖，优先级高于设置页派生值。 |
| `dsh-glass-theme:settings` | JSON 字符串（键为设置项 id，见第 3 节） | 设置页滑块 / 开关的持久化存储，通常由设置页写入。 |
| `dsh-glass-theme:demo-pos` | JSON 字符串 `{"x":number,"y":number}` | 试玩卡最后拖动位置。 |

取值约定：布尔型键以 `"0"` 表示关，其余值（含缺省、`null`）都算开。写 `null`（或 `removeItem`）等于“开”，因为缺省即开。示例：

```js
localStorage['dsh-glass-theme:enabled'] = '0';   // 关玻璃视觉（手机适配仍在）
localStorage['dsh-glass-theme:input-lens'] = '0'; // 关输入框液态折射
localStorage.setItem('dsh-glass-theme:vars', JSON.stringify({
  '--glass-bg-blur': '24px',
  '--glass-base-alpha': '.52',
}));
location.reload();
```

跨标签页实时同步：`storage` 事件 + 自定义事件 `dsh-glass-theme:change`。

## 2. `--glass-*` CSS 变量表

默认值定义在 `THEME_CSS` 中，浅色作用域为 `body.dsh-glass-on`，深色作用域为 `body.dsh-glass-on[data-ds-dark-theme]`。**浅 / 深两列即两套默认值**；“—” 表示深色未覆盖、沿用浅色值。

### 2.1 色彩基色（RGB 三通道）

| 变量 | 浅色 | 深色 | 说明 |
| --- | --- | --- | --- |
| `--glass-tint-rgb` | 250, 251, 253 | 24, 27, 38 | 面板主玻璃底色。 |
| `--glass-tint-strong-rgb` | 239, 242, 248 | 32, 36, 50 | 更实的玻璃底色（layer2/3、气泡、菜单）。 |
| `--glass-tint-deep-rgb` | 224, 229, 240 | 13, 15, 24 | 最深底色（tooltip）。 |
| `--glass-hover-rgb` | 38, 49, 72 | 150, 170, 230 | 交互 hover / active 底色。 |
| `--glass-code-rgb` | 243, 246, 250 | 17, 19, 29 | 代码块底色。 |

### 2.2 背景

| 变量 | 浅色 | 深色 | 说明 |
| --- | --- | --- | --- |
| `--glass-bg-blur` | 16px | 18px | 背景插画固定层的一次性静态模糊半径。 |
| `--glass-bg-saturate` | .78 | .82 | 背景降饱和（<1 降饱和）。 |
| `--glass-bg-brightness` | 1.04 | .62 | 背景提亮 / 压暗。 |

### 2.3 层级透明度

| 变量 | 浅色 | 深色 | 说明 |
| --- | --- | --- | --- |
| `--glass-base-alpha` | .40 | .46 | 页面底色实色占比。由 `panelAlpha` 派生。 |
| `--glass-layer1-alpha` | .46 | .52 | layer-1 实色占比。由 `panelAlpha` 派生。 |
| `--glass-layer2-alpha` | .54 | .60 | layer-2 实色占比。由 `panelAlpha` 派生。 |
| `--glass-layer3-alpha` | .60 | .66 | layer-3 实色占比。由 `panelAlpha` 派生。 |
| `--glass-sidebar-alpha` | .52 | .58 | 侧边栏实色占比。 |
| `--glass-details-alpha` | .58 | .62 | 详情栏实色占比（仅样式表，无设置项）。 |
| `--glass-input-alpha` | .48 | .34 | 输入卡实色占比，越低越透。 |
| `--glass-bubble-alpha` | .86 | .84 | 消息气泡实色占比（无下限）。 |
| `--glass-popover-alpha` | .93 | .94 | 弹层 / 菜单实色占比。 |
| `--glass-tooltip-alpha` | .96 | .96 | 工具提示实色占比。 |
| `--glass-code-alpha` | .97 | .97 | 代码块实色占比。 |

### 2.4 圆角

| 变量 | 浅色 | 深色 | 说明 |
| --- | --- | --- | --- |
| `--glass-radius-xl` | 24px | — | 输入卡大圆角（移动端降级为 lg）。 |
| `--glass-radius-lg` | 18px | — | 气泡 / 弹层 / 代码块圆角。 |
| `--glass-radius-md` | 14px | — | 侧边栏 / 详情栏小控件圆角。 |
| `--glass-radius-sm` | 10px | — | 备用小圆角。 |

### 2.5 高光 / 描边 / 阴影

| 变量 | 浅色 | 深色 | 说明 |
| --- | --- | --- | --- |
| `--glass-highlight` | rgba(255,255,255,.72) | rgba(255,255,255,.30) | 顶部内高光强度。 |
| `--glass-highlight-soft` | rgba(255,255,255,.30) | rgba(255,255,255,.13) | 柔和边缘内高光。 |
| `--glass-edge` | rgba(255,255,255,.55) | rgba(255,255,255,.24) | 强描边（输入框 / 弹层 / 开关）。 |
| `--glass-edge-soft` | rgba(255,255,255,.26) | rgba(255,255,255,.10) | 柔和描边（气泡 / 面板）。 |
| `--glass-edge-dark` | rgba(98,120,176,.16) | rgba(0,0,0,.48) | 暗侧描边。 |
| `--glass-shadow` | rgba(31,42,70,.20) | rgba(0,0,0,.46) | 常规投影。 |
| `--glass-shadow-strong` | rgba(31,42,70,.32) | rgba(0,0,0,.62) | 强投影（弹层 / 输入框）。 |

### 2.6 模糊与颗粒 / 光斑

| 变量 | 浅色 | 深色 | 说明 |
| --- | --- | --- | --- |
| `--glass-popover-blur` | 18px | — | 弹层 / 菜单 backdrop 模糊。 |
| `--glass-input-blur` | 12px | — | 输入卡 backdrop 模糊。 |
| `--glass-bubble-blur` | 7px | — | 气泡 backdrop 模糊（仅桌面）。 |
| `--glass-noise-opacity` | .05 | .065 | 磨砂颗粒层不透明度。 |
| `--glass-sheen-size` | 280px | — | 指针光斑直径。 |
| `--glass-sheen-opacity` | .48 | .34 | 指针光斑强度。 |

### 2.7 运行时变量（只读，勿手工改）

| 变量 | 写在 | 说明 |
| --- | --- | --- |
| `--glass-shift-x` / `--glass-shift-y` | `<html>` | 指针视差阴影偏移，rAF 节流更新，仅精细指针。 |
| `--dsh-glass-vv` | `<html>` | 视觉视口高度（`visualViewport.height`），软键盘弹出时缩小。 |
| `--dsh-chat-content-width` / `--dsh-composer-card-max-width` | `.wSkVaW_root` | 移动端内容 / 输入卡最大宽度（`min(748px, 100vw - 32px)`）。 |

## 3. 设置页参数（`dsh-glass-theme:settings`）

设置 → 插件 → 液态玻璃主题 的滑块 / 开关即对应这些键。写入 `localStorage['dsh-glass-theme:settings']`（JSON），值会被 `clampSetting` 钳制到 `[min, max]`。

| 键 | 默认（浅/深） | 范围 / 步进 | 对应变量或 SVG |
| --- | --- | --- | --- |
| `bgBlur` | 16 / 18 | 0–40，步 1，px | `--glass-bg-blur` |
| `bgSaturate` | .78 / .82 | .3–1.5，步 .01 | `--glass-bg-saturate` |
| `bgBrightness` | 1.04 / .62 | .3–1.4，步 .01 | `--glass-bg-brightness` |
| `bgRefract` | true | 开关 | `data-dsh-glass-bg-refract`（桌面背景位移） |
| `bgRefractScale` | 22 | 0–48，步 1，px | SVG `dsh-glass-refract-bg` 的 `feDisplacementMap scale` |
| `bgRefractFrequency` | .008 | .004–.04，步 .002 | SVG `dsh-glass-refract-bg` 的 `feTurbulence baseFrequency` |
| `sidebarAlpha` | .52 / .58 | .2–.95，步 .01 | `--glass-sidebar-alpha` |
| `panelAlpha` | .54 / .60 | .25–.95，步 .01 | 派生 `--glass-base/layer1/layer2/layer3-alpha` |
| `popoverBlur` | 18 | 0–36，步 1，px | `--glass-popover-blur` |
| `inputBlur` | 12 | 0–36，步 1，px | `--glass-input-blur` |
| `inputAlpha` | .48 / .34 | .15–.95，步 .01 | `--glass-input-alpha` |
| `inputRefract` | true | 开关 | `data-dsh-glass-refract`（输入框背景位移） |
| `refractScale` | 7 | 0–24，步 1，px | SVG `dsh-glass-input-backdrop` scale |
| `refractFrequency` | .012 | .004–.04，步 .002 | SVG `dsh-glass-input-backdrop` baseFrequency |
| `bubbleGlass` | true | 开关 | `data-dsh-glass-bubble` |
| `bubbleRefract` | true | 开关 | `data-dsh-glass-bubble-refract` |
| `bubbleBlur` | 7 | 0–28，步 1，px | `--glass-bubble-blur` |
| `bubbleAlpha` | .86 / .84 | 0–.98，步 .01 | `--glass-bubble-alpha` |
| `noiseOpacity` | .05 / .065 | 0–.25，步 .005 | `--glass-noise-opacity` |
| `sheenSize` | 280 | 160–440，步 10，px | `--glass-sheen-size` |
| `sheenOpacity` | .48 / .34 | 0–.9，步 .05 | `--glass-sheen-opacity` |
| `demoCard` | true | 开关 | `data-dsh-glass-demo`（是否显示试玩卡） |
| `demoChrome` | false | 开关 | `data-dsh-glass-demo-chrome`（试玩卡文字 / 图标） |
| `demoRefract` | true | 开关 | `data-dsh-glass-demo-refract` |
| `demoBlur` | 16 | 0–44，步 1，px | `--glass-demo-blur` |
| `demoAlpha` | .34 / .40 | 0–.92，步 .01 | `--glass-demo-alpha` |
| `demoWidth` | 252 | 140–560，步 8，px | `--glass-demo-width` |
| `demoHeight` | 164 | 100–440，步 8，px | `--glass-demo-height` |
| `demoRadius` | 26 | 8–52，步 1，px | `--glass-demo-radius` |
| `demoHighlight` | .75 / .32 | 0–1，步 .05 | `--glass-demo-highlight` |
| `demoRefractScale` | 7 | 0–32，步 1，px | SVG `dsh-glass-demo-backdrop` scale |
| `demoRefractFrequency` | .012 | .004–.05，步 .002 | SVG `dsh-glass-demo-backdrop` baseFrequency |

## 4. 控制台 API（`window.__dshGlassTheme`）

```js
window.__dshGlassTheme.enabled();   // → boolean，当前玻璃视觉是否开启
window.__dshGlassTheme.on();        // 开
window.__dshGlassTheme.off();       // 关（仅玻璃视觉，手机适配仍在）
window.__dshGlassTheme.toggle();    // 切换
window.__dshGlassTheme.lensOn();    // 开输入框液态折射
window.__dshGlassTheme.lensOff();   // 关输入框液态折射
window.__dshGlassTheme.setVar('--glass-bg-blur', '20px'); // 设并持久化一个 --glass-* 覆盖
window.__dshGlassTheme.clearVars(); // 清除所有 --glass-* 覆盖
window.__dshGlassTheme.reapply();   // 重新读取状态并重渲染
```

- `enabled` 是函数（返回布尔），不是属性。
- `setVar(name, value)`：仅接受以 `--glass-` 开头且值为字符串的 `name`，否则静默忽略；写入 `dsh-glass-theme:vars` 并触发 `dsh-glass-theme:change`。
- 这些方法只改状态并触发同步，重渲染由 `CHANGE_EVENT` 监听器完成。

## 5. 深浅色差异

深浅色由 `body[data-ds-dark-theme]` 属性判定（设置默认值在属性缺失时回退 `prefers-color-scheme: dark`）。

| 维度 | 浅色 | 深色 | 说明 |
| --- | --- | --- | --- |
| 背景模糊 | 16px | 18px | 深色略强，压制噪点。 |
| 背景亮度 | 1.04 | .62 | 深色压暗背景，保证文字对比度。 |
| 面板实色占比 | base .40 | base .46 | 深色更实，减少透明叠底发灰。 |
| 输入卡实色占比 | .48 | .34 | 深色输入卡更透。 |
| 顶部内高光 | .72 | .30 | 深色高光大幅减弱，避免刺眼。 |
| 阴影 | 蓝灰 `rgba(31,42,70,...)` | 黑 `rgba(0,0,0,...)` | 深色用纯黑投影。 |
| 磨砂颗粒 | .05 | .065 | 深色颗粒略强。 |
| 指针光斑 | .48 | .34 | 深色光斑更克制。 |

小结：深色下“实色更实、高光更弱、背景更暗”，换取可读性；浅色下“更通透、高光更强”。

## 6. 覆盖优先级

调整同一参数存在多种途径时，最终生效顺序（高到低）：

1. `localStorage['dsh-glass-theme:vars']`（用户内联变量）
2. `localStorage['dsh-glass-theme:settings']`（设置页派生内联变量）
3. `THEME_CSS` 样式表默认值

即：**vars > settings > 默认值**。`reapply()` 或刷新页面即可让 vars 生效。
