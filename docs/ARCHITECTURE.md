# 实现架构（ARCHITECTURE）

本文档说明 `dsh-glass-theme` 的实现方式，内容全部来自对源码（`lib/client.template.js`、`lib/index.js`、`scripts/build.mjs`）的核对。

## 1. 总体结构

主题分为“宿主端”与“浏览器端”两半：

| 文件 | 角色 |
| --- | --- |
| `lib/index.js` | **宿主端骨架**。仅导出 `name = "glass-theme"`、`inject = []`、`apply() {}`，方便 cordis 安装 / 卸载；不含任何渲染逻辑。 |
| `lib/client.template.js` | **浏览器端源码模板**。真正的主题全部在这里，通过 `window.__ModuleLoader__.load(...)` 注入。 |
| `scripts/build.mjs` | **构建脚本**。把背景图内联进模板，产出 `lib/client.js`。 |
| `lib/client.js` | **构建产物**。`client.template.js` 中的 `__DSH_GLASS_BG_DATA_URL__` 占位符被替换为 base64 data URL。 |
| `assets/background.jpg` | 背景插画（1920×1080 JPEG），仅构建期使用。 |

浏览器端入口：

```js
window.__ModuleLoader__.load({
  id: "@local/dsh-glass-theme",
  factory: (require) => {
    var React = require("react");
    // ... 常量、样式、控制器、apply
    exports.apply = apply;
    exports.inject = ["slots", "layout", "locale"];
    return module.exports;
  }
});
```

`exports.inject` 声明的依赖 `slots` / `layout` / `locale` 由 DSH 客户端运行时提供；除此之外**零第三方运行时依赖**。

## 2. 构建：背景图内联

`scripts/build.mjs` 做的事非常小：

1. 读 `lib/client.template.js` 与 `assets/background.jpg`。
2. 把 JPEG 转成 `data:image/jpeg;base64,...`。
3. 若模板里找不到 `__DSH_GLASS_BG_DATA_URL__` 占位符则报错。
4. 全量替换后写入 `lib/client.js`。

这样背景图作为 data URL 随 client.js 一起下发，避免 host 端静态路由与额外的图片请求。修改模板后必须重新执行 `node scripts/build.mjs`。

## 3. 注入的 3 个 `<style>` 节点

主题**不修改 DSH 源码**，只向 `<head>` 注入 3 个带 `data-plugin` 标记的样式节点。三者职责、常驻性如下：

| `data-plugin` | 常驻 | 内容来源 | 职责 |
| --- | --- | --- | --- |
| `dsh-glass-theme-mobile` | 是（始终安装） | `MOBILE_CSS` | `<= 768px` 的移动端布局：单栏、抽屉侧边栏、详情 Sheet、安全区、44px 触控、动态视口。 |
| `dsh-glass-theme-controls` | 是（始终安装） | `CONTROL_CSS` | 汉堡按钮、遮罩、浮动开关、指针光斑、设置卡片、可拖拽试玩卡。 |
| `dsh-glass-theme` | 否（随主题总开关插入 / 移除） | `THEME_CSS` | 液态玻璃视觉：背景层、DSH token 覆盖、气泡 / 弹层 / 输入框玻璃化、降级与减少动态。 |

对应关系在 `renderTheme()` 中体现：前两个节点在 `apply()` 时无条件 `installStyle`；`THEME_CSS` 只有在 `enabled` 为真时才安装、为假时 `removeStyle`。安装函数 `installStyle(id, css)` 通过 `style.dataset.plugin = id` 与 `style.dataset.pluginCss = id` 打标，重复调用时复用同一节点。

除样式节点外，运行时还会按需创建若干 DOM 节点（见下）。

## 4. 运行时 DOM 节点

| 节点 | 出现条件 | 作用 |
| --- | --- | --- |
| `#dsh-glass-bg` | 主题开启 | 固定层背景插画，`z-index: -3`，`filter: blur/saturate/brightness` 一次性静态合成。 |
| `#dsh-glass-veil` | 主题开启 | 固定层渐变光罩，`z-index: -2`，叠出明暗与顶部高光。 |
| `#dsh-glass-noise` | 主题开启 | 固定层 SVG 噪点（`mix-blend-mode: overlay`），制造磨砂颗粒。 |
| `svg#dsh-glass-defs` | 主题开启 | 隐藏 SVG，承载 3 个 `<filter>` 定义（折射用）。 |
| `.dsh-glass-hamburger` | 常驻（`<= 768px` 显示） | 打开 / 收起抽屉侧边栏。 |
| `.dsh-glass-scrim` | 常驻（`<= 768px` 显示） | 抽屉 / Sheet 的遮罩，点击关闭。 |
| `.dsh-glass-toggle` | 常驻 | 页面右上浮动开关，一键开关玻璃视觉。 |
| `.dsh-glass-sheen` | 常驻（仅精细指针显示） | 跟随指针的高光光斑（`mix-blend-mode: screen`）。 |
| `.dsh-glass-demo-card` | 主题开启且 `demoCard` 开 | 可拖拽液态玻璃试玩卡。 |

## 5. `--glass-*` 变量体系

所有视觉参数都收敛为 CSS 自定义属性，默认值定义在 `THEME_CSS` 的 `body.dsh-glass-on`（浅色）与 `body.dsh-glass-on[data-ds-dark-theme]`（深色）两个作用域。

运行时存在**三层覆盖**，优先级从低到高：

1. **样式表默认值**：`THEME_CSS` 中写的 `--glass-*`。
2. **设置派生内联变量**：`applySettingsToDom()` 依据 `dsh-glass-theme:settings` 把 22 个变量写到 `<body>` 的内联 style（如 `--glass-bg-blur`、`--glass-base-alpha`、`--glass-sheen-size` 等）。其中 `--glass-base-alpha` / `--glass-layer1-alpha` / `--glass-layer2-alpha` / `--glass-layer3-alpha` 由单一参数 `panelAlpha` 派生：`base = panel - 0.14`、`layer1 = panel - 0.08`、`layer2 = panel`、`layer3 = panel + 0.06`（均带下限 / 上限钳制）。
3. **用户覆盖内联变量**：`applyVarOverrides()` 读取 `localStorage['dsh-glass-theme:vars']`（JSON 对象，键须以 `--glass-` 开头且值为字符串），写到 `<body>` 内联 style，覆盖前两层。

因此调整优先级为：**用户 vars > 设置派生 > 样式表默认**。详细的变量清单与默认值见 `docs/TUNING.md`。

此外，`THEME_CSS` 把 DSH 设计 token 重新映射到玻璃色：

```css
--dsw-alias-bg-base:        rgba(var(--glass-tint-rgb), var(--glass-base-alpha));
--dsw-alias-bg-layer-1:     rgba(var(--glass-tint-rgb), var(--glass-layer1-alpha));
--dsw-specific-sidebar-fill: rgba(var(--glass-tint-rgb), var(--glass-sidebar-alpha));
--dsw-specific-input-major:  rgba(var(--glass-tint-rgb), var(--glass-input-alpha));
--dsw-specific-bubble:       rgba(var(--glass-tint-strong-rgb), var(--glass-bubble-alpha));
--dsw-specific-menu:         rgba(var(--glass-tint-strong-rgb), var(--glass-popover-alpha));
/* ...以及 border / shadow / scrollbar 等 */
```

即：大面积面板通过“把 DSH 面板 token 换成半透明 `rgba`”实现玻璃，而非逐选择器重写。

## 6. 液态玻璃近似原理

参考 liquid-dom 的“折射 / 边缘高光 / 色散 / 位移扰动”思路，但本插件用 **CSS + 轻量 SVG filter** 近似，不使用 WebGPU / SDF 引擎。

### 6.1 位移折射：`feTurbulence` + `feDisplacementMap`

`buildSvgDefs()` 生成 3 个滤镜，全部只含两个原语：

| 滤镜 id | 用途 | 生效范围 | 噪声 seed |
| --- | --- | --- | --- |
| `dsh-glass-refract-bg` | 背景插画位移 | 仅 `min-width: 769px`（桌面） | 26 |
| `dsh-glass-input-backdrop` | 输入框 / 用户气泡背景位移 | 所有宽度（见降级说明） | 17 |
| `dsh-glass-demo-backdrop` | 试玩卡背景位移 | 所有宽度 | 31 |

每个滤镜形如：

```xml
<feTurbulence type="fractalNoise" baseFrequency="F F*1.62" numOctaves="2" seed="..." result="noise"/>
<feDisplacementMap in="SourceGraphic" in2="noise" scale="S" xChannelSelector="R" yChannelSelector="G"/>
```

- `feTurbulence` 生成静态分形噪声；`feDisplacementMap` 用 R/G 通道把像素按噪声位移，`scale` 越大位移越明显。
- 关键点：滤镜挂在元素的 **`backdrop-filter`** 上（`backdrop-filter: url(#dsh-glass-input-backdrop) blur(...) saturate(...)`），因此**只位移元素背后的内容，元素自身的文字 / 控件不被位移**。这正是“输入文字不受影响”的实现依据。
- 输入框折射还叠加了 `blur`（`--glass-input-blur`，默认 12px）与 `saturate` / `brightness`，形成磨砂 + 折射的组合。

### 6.2 镜面高光：用 CSS，而非 `feSpecularLighting`

源码头部注释与 README 简介提到 `feSpecularLighting`，但**实际生成的 SVG 滤镜并未使用该原语**（只用了 `feTurbulence` 与 `feDisplacementMap`）。镜面高光 / 边缘内高光通过 CSS 近似：

- 顶部内高光：`box-shadow: inset 0 1px 0 var(--glass-highlight)`（`--glass-highlight` 浅色 `rgba(255,255,255,.72)`）。
- 柔和边缘高光：`inset 1px/-1px 0 0 var(--glass-highlight-soft)`。
- 卡面斜向反光：`linear-gradient(145deg, rgba(255,255,255,.26), ...)`。
- 全局指针光斑：`.dsh-glass-sheen`（`radial-gradient` + `mix-blend-mode: screen`），仅精细指针显示。

因此“高光”与“位移”是两条独立通路：高光走 CSS，折射走 SVG filter。

### 6.3 色散边纹：CSS 径向渐变近似

“色散”（chromatic dispersion）同样不是逐 RGB 通道位移，而是用两个径向渐变在输入卡 / 试玩卡 / 用户气泡边缘叠出红蓝边纹：

```css
background-image:
  radial-gradient(120% 90% at 0% 50%, rgba(255, 72, 112, .13), transparent 24%),
  radial-gradient(120% 90% at 100% 50%, rgba(72, 128, 255, .13), transparent 24%),
  linear-gradient(145deg, rgba(255, 255, 255, .26), rgba(255, 255, 255, .06) 34%, rgba(255, 255, 255, 0) 62%);
```

## 7. 状态同步与生命周期

- **状态读取**：`isEnabled()` / `isInputLensEnabled()` 从 localStorage 读键，值为 `"0"` 视为关，其余（含缺省）视为开。
- **事件源**：
  - `window` 的 `storage` 事件（跨标签页同步，监听 `enabled` / `input-lens` / `vars` / `settings` 键）。
  - 自定义事件 `dsh-glass-theme:change`（本页 `setEnabled` / `setInputLens` / `resetSettings` / `clearVars` / `setVar` 触发）。
  - `visualViewport` 的 `resize` / `scroll` 与 `window.resize`（软键盘 / 动态视口）。
  - `focusin`（软键盘弹出时把输入卡滚回可见）。
  - 对 `.pI_x6G_frame` 的 `MutationObserver`（监听 `data-sidebar-collapsed` / `data-details-collapsed` 属性变化，刷新汉堡 / 遮罩状态）。
- **renderTheme()**：统一把状态落地为 `body.classList.toggle("dsh-glass-on")`、`data-dsh-glass-lens` 与一组 `data-dsh-glass-*` 属性，并按需安装 / 移除 `THEME_CSS`、SVG defs、背景节点。
- **卸载清理**：effect 返回的清理函数会移除事件监听、MutationObserver、所有注入节点与样式，并擦除 inline 变量与 `--glass-shift-*` / `--dsh-glass-vv` 等，做到可逆。

## 8. 性能策略

1. **背景静态合成**：背景插画放 `#dsh-glass-bg` 固定层，`filter` 一次性计算，不随滚动 / 交互重算；聊天主区、侧边栏、详情栏因此无需大面积 `backdrop-filter`。
2. **`backdrop-filter` 只用于中小面积**：输入卡（12px）、弹层 / 菜单 / 对话框（18px）、气泡（7px，仅桌面）、试玩卡、浮动开关 / 汉堡按钮。背景位移滤镜只对固定背景层或小面积 backdrop 生效。
3. **rAF 节流**：指针视差（写 `--glass-shift-x/y`、移动光斑）与 `visualViewport` 同步都用 `requestAnimationFrame` 合并，无逐帧动画、无滚动 / 尺寸轮询。
4. **降级兜底**：`@supports not (backdrop-filter)` 时把各 `--glass-*-alpha` 抬高到近不透明；`prefers-reduced-motion: reduce` 时关闭过渡与光斑。
5. **移动端降级**：`<= 768px` 时背景改用固定 `blur(12px)`（不再叠加背景 SVG 位移），气泡关闭 `backdrop-filter`，输入卡圆角降级为 `--glass-radius-lg`。

## 9. 依赖的 DSH 稳定接口

主题依赖以下 DSH 结构，升级 DSH 后若类名变化应优先排查：

- `body[data-ds-dark-theme]`：深浅色判定。
- `--dsw-*` token：`--dsw-alias-*`、`--dsw-specific-*`、`--dsw-shadow-lv2/lv3` 等。
- `.pI_x6G_frame[data-sidebar-collapsed][data-details-collapsed]` 及 `.pI_x6G_centerCol` / `.pI_x6G_sidebarCol` / `.pI_x6G_detailsCol` / `.pI_x6G_handle`：三栏布局。
- `.wSkVaW_*`（会话区）、`.uV2eYG_*`（输入卡）、`.ydkMvW_*`（详情栏）、`.VOzbGW_*`（设置页）、`.hHd-Xa_*`（侧边栏控件）、`.gdEzaW_*`（消息气泡）、`.Md3f7G_scroll`（滚动区）。
