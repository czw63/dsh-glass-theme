# 实现架构（ARCHITECTURE）

本文档说明 `dsh-glass-theme` v2.1 的实现方式，内容来自对源码（`lib/client.template.js`、`lib/index.js`、`scripts/build.mjs`）的核对。
v2.1 在 v2.0 整体框架（移动端适配、设置 UI、控制逻辑、背景图内联）之上，把**玻璃渲染方式**对齐到
[`xingyingyuzhui/dsh-liquid-glass`](https://github.com/xingyingyuzhui/dsh-liquid-glass)（壁纸层 + 玻璃岛局部 blur + SDF 位移折射）。

## 1. 总体结构

主题分为“宿主端”与“浏览器端”两半：

| 文件 | 角色 |
| --- | --- |
| `lib/index.js` | **宿主端骨架**。仅导出 `name = "glass-theme"`、`inject = []`、`apply() {}`，方便 cordis 安装 / 卸载；不含任何渲染逻辑。 |
| `lib/client.template.js` | **浏览器端源码模板**。全部主题逻辑（单文件），通过 `window.__ModuleLoader__.load(...)` 注入。 |
| `scripts/build.mjs` | **构建脚本**。把 `assets/background.jpg` 内联进模板的 `__DSH_GLASS_BG_DATA_URL__` 占位符，产出 `lib/client.js`。 |
| `lib/client.js` | **构建产物**。 |
| `cordis.patch.yml` | bundle layer 挂载 `glass-theme`（`dsh.bundle.patch`），`dsh plugin add` 自动应用。 |
| `assets/background.jpg` | 壁纸插画，构建期内联。 |

浏览器端入口：

```js
window.__ModuleLoader__.load({
  id: "@local/dsh-glass-theme",
  factory: (require) => {
    var React = require("react");
    // ... 常量、设置模型、样式、SDF 光学核心、控制器、apply
    exports.apply = apply;
    exports.inject = ["slots", "layout", "locale"];
    return module.exports;
  }
});
```

## 2. 渲染管线（玻璃渲染 = dsh-liquid-glass 方式）

### 壁纸层
`ensureBackdropNodes()` 只创建 `#dsh-glass-bg`：固定层 + `background-image: url("data:image/jpeg;base64,...")`，
`filter: none`（**不整图模糊**），`opacity: var(--glass-wallpaper-opacity)`。

### 玻璃岛
`THEME_CSS` 里每个玻璃岛用宿主元素 `::before` 伪元素画玻璃板：

- 侧栏岛：`.pI_x6G_sidebarCol::before`（宿主 `position: relative; isolation: isolate;`）
- 标题岛：`.wSkVaW_header::before`
- 输入卡岛：`.uV2eYG_card::before`
- 弹层 / 菜单 / 工具提示：`[role="menu"]` 等直接玻璃材质

岛材质 = `background: var(--lg-*)`（半透明）+ `box-shadow` 内高光 + `backdrop-filter: url(#dsh-glass-lens-*) blur() saturate()`。

### SDF 位移折射（`Liquid Glass 光学核心` 段）
`client.template.js` 内置一套轻量 SDF 光学引擎（参考 dsh-liquid-glass 的 `optics-*`）：

| 函数 | 作用 |
| --- | --- |
| `ISLAND_LENS` / `updateIslandLens` | 折射参数（strength / dispersion / cornerRadius 等），修订号驱动重建 |
| `createIslandLensPixels(w, h)` | 按岛尺寸生成圆角盒 SDF 位移贴图（穹顶梯度 + 边缘色散 + 高光，RGB 编码） |
| `requestIslandLensMap(w, h)` | canvas → PNG data URL，LRU 缓存（同尺寸 + 同参数命中） |
| `buildIslandFilterPrimitives(map, scale)` | 生成 SVG filter 原始标记：`feImage` 引用贴图 + `feDisplacementMap`（RGB 通道分离色散） |
| `measureIslandShapes()` | 测量侧栏 / 标题 / 输入卡的盒子 |
| `ensureIslandLenses(svg, keys)` | 向 `#dsh-glass-defs` 注入每岛 `<filter id="dsh-glass-lens-{key}">` |

渲染时机：
1. `renderTheme()`（玻璃开启时）：`applySettingsToDom(settings)` 先同步 `--glass-*` 变量并
   `updateIslandLens({cornerRadius, strength})`，再 `ensureSvgDefs(settings)` 建 `#dsh-glass-defs` + 透镜滤镜。
2. 设置变化：`applySvgParams` / `applySettingsPatchToDom` 里 `updateIslandLens` + 重建透镜（尺寸/参数缓存避免重复生成）。

### 主题开关与浅深色
- `body.dsh-glass-on`（主题总开关）+ `data-dsh-glass-lens` / `data-dsh-glass-refract`（折射开关）。
- 浅 / 深色两套 `--lg-*` 与 `--glass-*` 变量，深色走 `body[data-ds-dark-theme]`。

## 3. 设置模型

- `SETTINGS_SCHEMA`：滑块参数（壁纸透明度 / 玻璃圆角 / 玻璃模糊 / 折射强度 / 各表面透明度等），浅深两套默认值。
- `SETTING_TOGGLES`：开关（背景折射 / 输入折射 / 气泡玻璃化等）。
- 设置卡片（`GlassSettingsCard`）注册在 `settings.plugin.item` slot（设置 → 插件 → 液态玻璃主题），
  参数按 外观 / 输入框 / 气泡 / 面板 分组折叠，避免堆滑块。

## 4. 手机端适配

- `MOBILE_CSS`（`data-plugin="dsh-glass-theme-mobile"`）：`<= 768px` 单栏 + 抽屉侧边栏 + 详情 Sheet + 安全区 + 44px 触控。
- `CONTROL_CSS` + 移动端控制（汉堡 / 遮罩 / 动态视口 / 软键盘）。
- 与玻璃开关解耦，常驻生效。

## 5. 关键约束

- 不移动 React DOM、不修改 DSH 源码；官方滚动 / sticky 所有权不改。
- `backdrop-filter` 只发生在各玻璃岛 `::before`，不糊壁纸、body 或官方滚动容器。
- `backdrop-filter` 不支持时（`@supports not`）自动提高表面实色占比保证可读性。
- `prefers-reduced-motion` 关闭全部动效。
