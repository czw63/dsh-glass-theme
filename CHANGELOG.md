# Changelog

本项目所有显著变更均记录在此文件。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本 SemVer](https://semver.org/lang/zh-CN/)。

## [2.1.0]

> 对比 v2.0，本版本在 v2 整体框架（手机端适配、设置 UI、控制逻辑、背景图内联）之上，
> **把玻璃渲染方式替换为 [`xingyingyuzhui/dsh-liquid-glass`](https://github.com/xingyingyuzhui/dsh-liquid-glass) 的实现**。

### 新增（Added）

- **壁纸层保持清晰**：背景图不再整图 `blur + saturate + brightness` 合成，改为静态壁纸层（不透明可调 `--glass-wallpaper-opacity`）。
- **玻璃岛渲染**：侧栏 / 标题 / 输入卡 / 弹层各画 `::before` 玻璃岛，局部 `backdrop-filter` 只糊岛背后，不糊壁纸 / body / 滚动容器。
- **SDF 位移折射**：按岛实际尺寸生成圆角盒 SDF 位移贴图（canvas → PNG data URL），经 `feImage + feDisplacementMap` 注入 SVG 滤镜，RGB 通道分离产生真色散；折射强度 / 岛圆角由设置滑杆驱动，同尺寸 + 同参数命中缓存。
- **设置整理**：新增「壁纸透明度」「玻璃圆角」；去掉与 SDF 渲染无关的旧滑块（折射频率、试玩卡整组、指针光斑、磨砂颗粒），参数按 外观 / 输入框 / 气泡 / 面板 分组，折叠展示避免堆滑块。
- **安装模型**：仓库自带 `cordis.patch.yml`（`dsh.bundle.patch`），`dsh plugin add file:...` 自动挂载到 bundle layer，无需手动改 profile 的 cordis.patch.yml。

### 变更（Changed）

- 渲染方式：`feTurbulence` 随机噪点折射 → SDF 圆角盒位移透镜。
- 背景层：整图合成 → 清晰壁纸层 + 玻璃岛局部模糊。
- 玻璃圆角统一由 `--glass-radius-xl`（设置「玻璃圆角」）驱动。

### 移除（Removed）

- 背景固定层的静态 blur / 降饱和 / 压暗合成、磨砂噪点层、指针光斑（sheen）、试玩卡（demo）及其滤镜。
- 设置页中 `bgRefractFrequency` / `refractFrequency` / `noiseOpacity` / `sheen*` / `demo*` 滑块（字段保留以兼容旧 localStorage）。

### 修复（Fixed）

- **设置面板无法点击**：玻璃岛渲染给 `.pI_x6G_sidebarCol` 加 `isolation: isolate` 时未提升 z-index，
  把侧栏内的设置面板（`z-index: 1000` 固定层）困在侧栏层叠上下文里，被对话内容盖住无法点击；
  已为侧栏岛宿主加 `z-index: 2`（对齐 dsh-liquid-glass 的做法）。

### 性能（Performance）

- 壁纸层静态；`backdrop-filter` 仅用于各玻璃岛。
- SDF 贴图按需生成（尺寸或参数变化），同参数缓存；无逐帧动画、无滚动轮询。

## [2.0.0]

> 对比 v1.0，本版本是一次面向渲染实现与手机端适配的彻底重写：
> 液态玻璃渲染全新编写，手机端 UI 适配改为常驻，二者通过独立开关解耦。

### 新增（Added）

- **全新液态玻璃渲染**：浏览器端渲染实现完全重写（`lib/client.template.js`），不复用旧版存档主题的渲染代码。
- **手机端 UI 适配常驻**：`<= 768px` 下的单栏聊天、抽屉侧边栏、详情底部 Sheet、安全区（`env(safe-area-inset-*)`）、44px 触控目标、动态视口 / 软键盘修正始终生效，不再依赖主题开关。
- **玻璃视觉与手机适配解耦开关**：`localStorage['dsh-glass-theme:enabled'] = '0'` 只关闭玻璃视觉，移动端布局适配不受影响；`localStorage['dsh-glass-theme:input-lens'] = '0'` 独立关闭输入框液态折射。
- **输入框液态折射**：输入卡边缘内高光 + 小面积 backdrop 磨砂 + SVG `feTurbulence` / `feDisplacementMap` 位移折射（只作用 backdrop，不位移输入文字）；桌面端另有 rAF 节流的指针视差阴影与光斑。
- **背景图构建时内联**：`scripts/build.mjs` 在构建期把 `assets/background.jpg`（1920×1080 JPEG）转成 base64 data URL 内联进 `lib/client.js`，避免 host 端静态路由与请求。
- **零运行时第三方依赖**：浏览器端仅使用 DSH 注入的 `react`，不引入任何第三方运行时库。
- **设置页集成**：设置 → 插件 → 液态玻璃主题，提供主题总开关、输入框液态折射开关，以及背景 / 输入框 / 气泡 / 面板与弹层 / 指针光斑 / 试玩卡等分组调参（滑块 + 开关），参数即时生效并持久化到本浏览器。
- **可拖拽液态玻璃试玩卡**：页面上可按住拖动、观察背景折射的玻璃卡片，位置持久化（`dsh-glass-theme:demo-pos`）。
- **控制台调试 API**：`window.__dshGlassTheme`，含 `enabled` / `on` / `off` / `toggle` / `lensOn` / `lensOff` / `setVar` / `clearVars` / `reapply`。
- **深浅色双套变量**：依据 `body[data-ds-dark-theme]` 自动切换浅色 / 深色两套 `--glass-*` 默认值。
- **中英双语设置文案**：`dsh-glass-theme` locale 命名空间下的 `zh` / `en`。

### 变更（Changed）

- **渲染架构**：从“host 端逻辑 + 静态样式”改为“浏览器端 `window.__ModuleLoader__.load` 注入 + host 侧纯骨架”。`lib/index.js` 仅保留 DSH 插件骨架（`name` / `inject` / `apply`），便于 cordis 安装与卸载。
- **面板透明化方式**：通过覆盖 DSH 的 `--dsw-*` 设计 token 实现半透明玻璃层级，而非逐选择器重写背景。
- **调参持久化**：可调参数统一存 `localStorage['dsh-glass-theme:settings']`；用户 `--glass-*` 覆盖存 `localStorage['dsh-glass-theme:vars']`。跨标签页通过 `storage` 事件与 `dsh-glass-theme:change` 自定义事件实时同步。
- **注入方式**：只注入 3 个 `<style>` 节点（`dsh-glass-theme-mobile` / `dsh-glass-theme-controls` / `dsh-glass-theme`），不修改 DSH 源码。

### 移除（Removed）

- **旧版渲染实现**：v1.0 的渲染代码被上述全新实现取代。

### 性能（Performance）

- 背景插画放固定层做一次性 `blur + saturate + brightness` 合成，滚动 / 交互零成本。
- `backdrop-filter` 仅用于输入卡、弹层 / 菜单、气泡（桌面端）、试玩卡等中小面积；聊天主区 / 侧边栏 / 详情栏不做大面积实时 backdrop-filter。
- 指针视差与动态视口同步均用 rAF 节流；`prefers-reduced-motion: reduce` 时关闭全部动效与滤镜交互。

[2.0.0]: https://github.com/czw63/dsh-glassmorphism/releases/tag/v2.0.0
