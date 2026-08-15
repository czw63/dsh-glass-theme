// dsh-glass-theme — iOS 26 液态玻璃（Liquid Glass）Web 主题（浏览器端）。
//
// 设计语言对标 iOS 26 Liquid Glass，实现要点：
//  1. 背景插画放 body::before 固定层，一次性静态 filter: blur()+saturate()+brightness()
//     合成（滚动/交互零成本）；body::after 叠加深浅色渐变蒙层 + 彩色光斑；
//     JS 注入的 .dsh-glass-noise 层叠 feTurbulence 磨砂颗粒（iOS 细腻颗粒感）。
//  2. 面板（侧边栏/主区/详情/气泡/输入/弹层）通过覆盖 --dsw-* token 半透明化：
//     用 color-mix(in srgb, <基准色> <alpha>, transparent)，alpha 暴露为 --glass-* 变量，
//     深浅色各一套基准色，随 body[data-ds-dark-theme] 切换。不碰组件类名（升级稳健）。
//  3. backdrop-filter 实时模糊只用于中/小面积：弹层/菜单/提示（portal 到 body）、
//     气泡、输入卡片；侧边栏/详情栏/主区绝不使用 backdrop-filter（会创建 containing
//     block，困住内部 fixed 弹层）。大面积靠「背景图静态模糊 + 面板半透明」。
//  4. 文字 token 保持默认；气泡 ≥ 82% 不透明度、代码块不覆盖（保持默认不透明），
//     保证正文/代码/表格可读性不劣于默认主题。
//  5. 无 JS 动画、无滚动/resize 监听；prefers-reduced-motion 与 @supports 兜底。
//
// 可自定义（设置 → 插件 → 液态玻璃主题）：背景图片、背景模糊、输入框模糊、
// 用户气泡/AI 气泡透明度、侧边栏透明度、大圆角、磨砂颗粒。设置存 localStorage。
//
// 深浅色：body[data-ds-dark-theme]（无该属性 = 浅色）。
// 开关：localStorage['dsh-glass-theme:enabled'] = '0' 关闭（恢复默认外观），跨标签页同步。
window.__ModuleLoader__.load({
	id: "@local/dsh-glass-theme",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");

		const STORAGE_KEY = "dsh-glass-theme:enabled";
		const SETTINGS_KEY = "dsh-glass-theme:settings";
		const STYLE_SELECTOR = 'style[data-plugin="dsh-glass-theme"]';
		const NOISE_SELECTOR = 'div[data-plugin="dsh-glass-theme-noise"]';
		const REFRACT_SELECTOR = 'svg[data-plugin="dsh-glass-theme-refract"]';

		// —— 默认设置（用户可在设置卡片中调整，存 localStorage） ——
		const DEFAULT_SETTINGS = {
			bgImage: null,         // 自定义背景图 data URL（null = 内置 assets/background.jpg）
			bgBlur: 18,            // 背景静态模糊半径 px
			inputBlur: 5,          // 输入框磨砂半径 px
			userBubbleAlpha: 82,   // 用户气泡不透明度 %
			bubbleAlpha: 82,       // AI 气泡不透明度 %
			sidebarAlpha: 50,      // 侧边栏不透明度 %
			radius: 18,            // 大圆角 px
			noiseOpacity: 5,       // 磨砂颗粒强度 %
		};

		function isEnabled() {
			try { return window.localStorage.getItem(STORAGE_KEY) !== "0"; } catch { return true; }
		}

		function clamp(value, min, max) {
			const n = Number(value);
			if (!Number.isFinite(n)) return min;
			return Math.min(max, Math.max(min, n));
		}

		function loadSettings() {
			try {
				const raw = window.localStorage.getItem(SETTINGS_KEY);
				if (!raw) return { ...DEFAULT_SETTINGS };
				const p = JSON.parse(raw);
				const s = { ...DEFAULT_SETTINGS };
				if (typeof p.bgImage === "string" && p.bgImage.length > 0) s.bgImage = p.bgImage;
				if (Number.isFinite(Number(p.bgBlur))) s.bgBlur = clamp(p.bgBlur, 0, 40);
				if (Number.isFinite(Number(p.inputBlur))) s.inputBlur = clamp(p.inputBlur, 0, 20);
				if (Number.isFinite(Number(p.userBubbleAlpha))) s.userBubbleAlpha = clamp(p.userBubbleAlpha, 50, 100);
				if (Number.isFinite(Number(p.bubbleAlpha))) s.bubbleAlpha = clamp(p.bubbleAlpha, 50, 100);
				if (Number.isFinite(Number(p.sidebarAlpha))) s.sidebarAlpha = clamp(p.sidebarAlpha, 20, 90);
				if (Number.isFinite(Number(p.radius))) s.radius = clamp(p.radius, 8, 32);
				if (Number.isFinite(Number(p.noiseOpacity))) s.noiseOpacity = clamp(p.noiseOpacity, 0, 20);
				return s;
			} catch { return { ...DEFAULT_SETTINGS }; }
		}

		function persistSettings(settings) {
			try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
		}

		const CSS = `/* ============ dsh-glass-theme: iOS 26 液态玻璃 ============ */

/* ---------- 0. 调参变量（:root = 浅色默认值；设置卡片通过 inline 覆盖） ---------- */
:root {
	/* 背景处理（body::before 静态层，一次性合成） */
	--glass-bg-blur: 18px;        /* 背景静态模糊半径 */
	--glass-bg-saturate: 0.72;    /* 背景降饱和（<1 降饱和，1 原色） */
	--glass-bg-brightness: 1.06;  /* 背景亮度（浅色轻微提亮） */

	/* 面板不透明度（color-mix 实色占比，越大越实、越不透明） */
	--glass-base-alpha: 40%;      /* 页面底色 bg-base */
	--glass-layer1-alpha: 48%;    /* 层级表面 1 */
	--glass-layer2-alpha: 54%;    /* 层级表面 2 */
	--glass-layer3-alpha: 58%;    /* 层级表面 3 */
	--glass-sidebar-alpha: 50%;   /* 侧边栏 */
	--glass-details-alpha: 54%;   /* 详情栏 */
	--glass-input-alpha: 26%;     /* 输入卡片（很透，靠折射/毛玻璃补） */
	--glass-bubble-alpha: 82%;    /* AI 气泡（可读性红线 ≥ 80%） */
	--glass-user-bubble-alpha: 82%; /* 用户气泡（可读性红线 ≥ 80%） */
	--glass-popover-alpha: 90%;   /* 弹层/菜单 */
	--glass-tooltip-alpha: 95%;   /* 提示 */

	/* 圆角 */
	--glass-radius-lg: 18px;
	--glass-radius-md: 13px;
	--glass-radius-sm: 9px;

	/* 磨砂半径（backdrop-filter，仅中/小面积） */
	--glass-popover-blur: 16px;
	--glass-bubble-blur: 8px;
	--glass-input-blur: 5px;

	/* 高光 / 描边 / 投影强度 */
	--glass-highlight: rgba(255, 255, 255, 0.55);   /* 顶部内高光 */
	--glass-edge: rgba(255, 255, 255, 0.35);        /* 外缘描边（折射感） */
	--glass-shadow: rgba(23, 28, 45, 0.10);         /* 柔和投影 */
	--glass-shadow-strong: rgba(23, 28, 45, 0.16);  /* 较强投影（输入卡片） */

	/* 蒙层 / 噪点 / 光斑透明度 */
	--glass-overlay-top: 0.08;     /* 蒙层顶部透明度（低，保留插画轮廓） */
	--glass-overlay-bottom: 0.20;  /* 蒙层底部透明度（略高，保证底部可读） */
	--glass-noise-opacity: 0.05;   /* 磨砂噪点颗粒 */
	--glass-glow-alpha: 0.30;      /* 彩色光斑 */
}

/* 深色模式覆盖变量（高光/折射更明显，深色玻璃才“看得见”） */
body[data-ds-dark-theme] {
	--glass-bg-saturate: 0.68;
	--glass-bg-brightness: 0.55;   /* 深色压暗背景，突出前景 */
	--glass-highlight: rgba(255, 255, 255, 0.16);
	--glass-edge: rgba(255, 255, 255, 0.10);
	--glass-shadow: rgba(0, 0, 0, 0.45);
	--glass-shadow-strong: rgba(0, 0, 0, 0.50);
	--glass-overlay-top: 0.35;
	--glass-overlay-bottom: 0.50;
	--glass-noise-opacity: 0.06;
	--glass-glow-alpha: 0.40;
}

/* ---------- 1. 画布与背景层 ---------- */
/* html 兜底底色（避免加载中/降级时白闪）；深色用 :has 感知 */
html { background-color: #eef2f9; }
html:has(body[data-ds-dark-theme]) { background-color: #0a0e1a; }

/* body 透明，背景交给负 z-index 伪元素层（在内容之下、html 底色之上） */
body { background-color: transparent; }

/* 背景插画：fixed + 一次性静态模糊/降饱和/亮度；--glass-bg-image 可被设置卡片覆盖 */
body::before {
	content: "";
	position: fixed;
	inset: -48px;                 /* 补偿 blur 边缘扩散 */
	z-index: -3;
	background-image: var(--glass-bg-image, url("__GLASS_BG_DATA_URL__"));
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
	filter: blur(var(--glass-bg-blur)) saturate(var(--glass-bg-saturate)) brightness(var(--glass-bg-brightness));
}

/* 蒙层 + 彩色光斑：不参与 blur，保证前景对比度（WCAG AA 优先） */
body::after {
	content: "";
	position: fixed;
	inset: 0;
	z-index: -2;
	pointer-events: none;
	background-image:
		radial-gradient(ellipse 85% 60% at 12% -10%, rgba(120, 150, 255, var(--glass-glow-alpha)), transparent 60%),
		radial-gradient(ellipse 70% 55% at 105% 5%, rgba(200, 150, 255, var(--glass-glow-alpha)), transparent 58%),
		radial-gradient(ellipse 80% 60% at 50% 112%, rgba(120, 200, 235, var(--glass-glow-alpha)), transparent 62%),
		linear-gradient(180deg,
			rgba(246, 248, 253, var(--glass-overlay-top)) 0%,
			rgba(240, 243, 251, var(--glass-overlay-bottom)) 60%,
			rgba(235, 239, 249, var(--glass-overlay-bottom)) 100%);
	background-size: auto, auto, auto, auto;
	background-repeat: no-repeat, no-repeat, no-repeat, no-repeat;
	background-position: center, center, center, center;
}
body[data-ds-dark-theme]::after {
	background-image:
		radial-gradient(ellipse 85% 60% at 12% -10%, rgba(100, 145, 255, var(--glass-glow-alpha)), transparent 60%),
		radial-gradient(ellipse 70% 55% at 105% 5%, rgba(170, 120, 255, var(--glass-glow-alpha)), transparent 58%),
		radial-gradient(ellipse 80% 60% at 50% 112%, rgba(80, 170, 230, var(--glass-glow-alpha)), transparent 62%),
		linear-gradient(180deg,
			rgba(10, 14, 28, var(--glass-overlay-top)) 0%,
			rgba(13, 18, 34, var(--glass-overlay-bottom)) 60%,
			rgba(16, 22, 42, var(--glass-overlay-bottom)) 100%);
}

/* 磨砂噪点颗粒（JS 注入的静态 div，透明度可调） */
.dsh-glass-noise {
	position: fixed;
	inset: 0;
	z-index: -1;
	pointer-events: none;
	opacity: var(--glass-noise-opacity);
	background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E");
	background-size: 180px 180px;
	background-repeat: repeat;
}

/* ---------- 2. token 覆盖：bg 系半透明化（color-mix + --glass-*-alpha） ---------- */
body {
	/* 浅色基准色（供 color-mix 使用） */
	--glass-base: #f4f6fb;
	--glass-layer1: #ffffff;
	--glass-layer2: #ffffff;
	--glass-layer3: #ffffff;
	--glass-sidebar: #f8fafc;
	--glass-details: #ffffff;
	--glass-input: #ffffff;
	--glass-bubble: #edf3fe;
	--glass-user-bubble: #dbe7ff;   /* 用户气泡（比 AI 气泡稍深，突出用户消息） */
	--glass-popover: #fbfcfe;
	--glass-tooltip: #2c2c2e;

	--dsw-alias-bg-base: color-mix(in srgb, var(--glass-base) var(--glass-base-alpha), transparent);
	--dsw-alias-bg-layer-1: color-mix(in srgb, var(--glass-layer1) var(--glass-layer1-alpha), transparent);
	--dsw-alias-bg-layer-2: color-mix(in srgb, var(--glass-layer2) var(--glass-layer2-alpha), transparent);
	--dsw-alias-bg-layer-3: color-mix(in srgb, var(--glass-layer3) var(--glass-layer3-alpha), transparent);
	--dsw-specific-sidebar-fill: color-mix(in srgb, var(--glass-sidebar) var(--glass-sidebar-alpha), transparent);
	--dsw-specific-input-major: color-mix(in srgb, var(--glass-input) var(--glass-input-alpha), transparent);
	--dsw-specific-bubble: color-mix(in srgb, var(--glass-bubble) var(--glass-bubble-alpha), transparent);
	--dsw-specific-menu: color-mix(in srgb, var(--glass-popover) var(--glass-popover-alpha), transparent);
	--dsw-alias-bg-overlay: color-mix(in srgb, #e9ecf2 92%, transparent);
	--dsw-alias-tooltip-bg: color-mix(in srgb, var(--glass-tooltip) var(--glass-tooltip-alpha), transparent);

	/* 文字对比（浅色加深次要文字，玻璃上更清晰；主文字 token 不动） */
	--dsw-alias-label-secondary: var(--dsw-static-neutral-bluish-750);
	--dsw-alias-label-tertiary: var(--dsw-static-neutral-bluish-700);
	--dsw-alias-label-caption: var(--dsw-static-neutral-bluish-600);
	--dsw-alias-label-dimmed: var(--dsw-static-neutral-bluish-400);
}
body[data-ds-dark-theme] {
	/* 深色基准色 */
	--glass-base: #141418;
	--glass-layer1: #232324;
	--glass-layer2: #2c2c2e;
	--glass-layer3: #353536;
	--glass-sidebar: #1b1b1c;
	--glass-details: #232324;
	--glass-input: #202028;
	--glass-bubble: #2c2c2e;
	--glass-user-bubble: #343b4d;
	--glass-popover: #353536;
	--glass-tooltip: #43454a;

	--dsw-alias-bg-base: color-mix(in srgb, var(--glass-base) var(--glass-base-alpha), transparent);
	--dsw-alias-bg-layer-1: color-mix(in srgb, var(--glass-layer1) var(--glass-layer1-alpha), transparent);
	--dsw-alias-bg-layer-2: color-mix(in srgb, var(--glass-layer2) var(--glass-layer2-alpha), transparent);
	--dsw-alias-bg-layer-3: color-mix(in srgb, var(--glass-layer3) var(--glass-layer3-alpha), transparent);
	--dsw-specific-sidebar-fill: color-mix(in srgb, var(--glass-sidebar) var(--glass-sidebar-alpha), transparent);
	--dsw-specific-input-major: color-mix(in srgb, var(--glass-input) var(--glass-input-alpha), transparent);
	--dsw-specific-bubble: color-mix(in srgb, var(--glass-bubble) var(--glass-bubble-alpha), transparent);
	--dsw-specific-menu: color-mix(in srgb, var(--glass-popover) var(--glass-popover-alpha), transparent);
	--dsw-alias-bg-overlay: color-mix(in srgb, #2c2c2e 92%, transparent);
	--dsw-alias-tooltip-bg: color-mix(in srgb, var(--glass-tooltip) var(--glass-tooltip-alpha), transparent);

	--dsw-alias-label-secondary: var(--dsw-static-neutral-bluish-200);
	--dsw-alias-label-tertiary: var(--dsw-static-neutral-bluish-300);
	--dsw-alias-label-caption: var(--dsw-static-neutral-bluish-400);
	--dsw-alias-label-dimmed: var(--dsw-static-neutral-bluish-500);
}

/* ---------- 3. 玻璃装饰（少量类名，其余全靠 token） ---------- */
.pI_x6G_frame { background-color: transparent !important; }
/* 标签/模式文字可读性：非激活 tab 与模式标签用 label-secondary */
.wSkVaW_tab:not(.wSkVaW_tabActive) {
	color: var(--dsw-alias-label-secondary) !important;
}
.SVAs4q_label {
	color: var(--dsw-alias-label-secondary) !important;
}

/* 输入卡片：小面积液态折射（canvas 位移图 + feDisplacementMap），仅 .uV2eYG_card */
.uV2eYG_card {
	-webkit-backdrop-filter: url(#dsh-glass-refract) blur(var(--glass-input-blur)) saturate(1.6) brightness(1.05);
	backdrop-filter: url(#dsh-glass-refract) blur(var(--glass-input-blur)) saturate(1.6) brightness(1.05);
	background-color: color-mix(in srgb, var(--glass-input) var(--glass-input-alpha), transparent) !important;
	background-image:
		radial-gradient(ellipse 85% 55% at 50% -25%, rgba(255, 255, 255, 0.80), rgba(255, 255, 255, 0.20) 40%, rgba(255, 255, 255, 0) 70%),
		linear-gradient(180deg, rgba(255, 255, 255, 0) 60%, rgba(255, 255, 255, 0.08) 90%, rgba(255, 255, 255, 0.16) 100%) !important;
	border-radius: var(--glass-radius-lg) !important;
	box-shadow:
		inset 0 1px 0 rgba(255, 255, 255, 0.90),
		inset 0 0 0 1px rgba(255, 255, 255, 0.45),
		inset 0 -3px 12px rgba(255, 255, 255, 0.25),
		0 12px 32px var(--glass-shadow-strong),
		0 2px 8px var(--glass-shadow) !important;
}
body[data-ds-dark-theme] .uV2eYG_card {
	-webkit-backdrop-filter: url(#dsh-glass-refract) blur(var(--glass-input-blur)) saturate(1.3) brightness(1.18);
	backdrop-filter: url(#dsh-glass-refract) blur(var(--glass-input-blur)) saturate(1.3) brightness(1.18);
	background-image:
		radial-gradient(ellipse 85% 55% at 50% -25%, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0) 70%),
		linear-gradient(180deg, rgba(255, 255, 255, 0) 60%, rgba(255, 255, 255, 0.05) 100%) !important;
	box-shadow:
		inset 0 1px 0 rgba(255, 255, 255, 0.26),
		inset 0 0 0 1px rgba(255, 255, 255, 0.14),
		0 12px 32px var(--glass-shadow-strong),
		0 2px 8px var(--glass-shadow) !important;
}
/* 非 Chromium 兜底：不支持 backdrop-filter url() 时退回轻毛玻璃 */
@supports not (backdrop-filter: url(#dsh-glass-refract) blur(1px)) {
	.uV2eYG_card {
		-webkit-backdrop-filter: blur(14px) saturate(1.6);
		backdrop-filter: blur(14px) saturate(1.6);
	}
}

/* AI/助手消息气泡：高不透明度（≥ 82%）保证正文/代码/表格可读 */
.gdEzaW_bubble {
	-webkit-backdrop-filter: blur(var(--glass-bubble-blur)) saturate(1.3);
	backdrop-filter: blur(var(--glass-bubble-blur)) saturate(1.3);
	background-color: color-mix(in srgb, var(--glass-bubble) var(--glass-bubble-alpha), transparent) !important;
	border-radius: var(--glass-radius-md) !important;
	box-shadow:
		inset 0 1px 0 var(--glass-highlight),
		inset 0 0 0 1px var(--glass-edge);
}
/* 用户消息气泡：单独透明度（右对齐，基准色更深突出） */
.gdEzaW_userRow .gdEzaW_bubble {
	background-color: color-mix(in srgb, var(--glass-user-bubble) var(--glass-user-bubble-alpha), transparent) !important;
}

/* 侧边栏/详情栏：顶部玻璃高光 + 半透明底（绝不 backdrop-filter，困住 fixed 弹层） */
.pI_x6G_sidebarCol {
	background-color: color-mix(in srgb, var(--glass-sidebar) var(--glass-sidebar-alpha), transparent);
	background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0) 120px);
	box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.50);
}
body[data-ds-dark-theme] .pI_x6G_sidebarCol {
	background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0) 120px);
	box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
}
.pI_x6G_detailsCol {
	background-color: color-mix(in srgb, var(--glass-details) var(--glass-details-alpha), transparent);
	background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0) 100px);
	box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
}
body[data-ds-dark-theme] .pI_x6G_detailsCol {
	background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0) 100px);
	box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

/* ---------- 4. 弹层：小面积真磨砂（portal 到 body，backdrop-filter 安全） ---------- */
[role="dialog"],
[role="menu"],
[role="tooltip"],
[role="listbox"],
[data-radix-popper-content-wrapper] > div {
	-webkit-backdrop-filter: blur(var(--glass-popover-blur)) saturate(1.4);
	backdrop-filter: blur(var(--glass-popover-blur)) saturate(1.4);
	background-color: color-mix(in srgb, var(--glass-popover) var(--glass-popover-alpha), transparent);
	background-image: radial-gradient(ellipse 80% 35% at 50% -10%, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0) 70%);
	border-radius: var(--glass-radius-lg) !important;
	box-shadow:
		var(--dsw-shadow-lv3),
		inset 0 1px 0 var(--glass-highlight),
		inset 0 0 0 1px var(--glass-edge);
}
[role="menu"] [role="menuitem"]:hover,
[role="menu"] [role="menuitem"][data-highlighted],
[role="listbox"] [role="option"][data-highlighted] {
	background-color: color-mix(in srgb, var(--dsw-alias-interactive-bg-hover) 74%, transparent) !important;
}

/* ---------- 5. 细节：过渡 / 焦点 / 选区 ---------- */
button, [role="button"], .hHd-Xa_iconButton {
	transition: background-color 0.18s ease, box-shadow 0.18s ease, opacity 0.15s ease;
}
:focus-visible {
	outline: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 78%, white 22%) !important;
	outline-offset: 2px;
	border-radius: 6px;
}
::selection {
	background: color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent);
}

/* ---------- 6. 降级 ---------- */
/* 不支持 backdrop-filter：弹层回退不透明原色 */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
	[role="dialog"], [role="menu"], [role="tooltip"], [role="listbox"] {
		background-color: var(--dsw-specific-menu) !important;
	}
}
/* 不支持 color-mix：回退不透明原色（color-mix 声明整体失效，显式兜底确保可读） */
@supports not (color: color-mix(in srgb, red 50%, transparent)) {
	body {
		--dsw-alias-bg-base: #f4f6fb;
		--dsw-alias-bg-layer-1: #ffffff;
		--dsw-alias-bg-layer-2: #ffffff;
		--dsw-alias-bg-layer-3: #ffffff;
		--dsw-specific-sidebar-fill: #f8fafc;
		--dsw-specific-input-major: #ffffff;
		--dsw-specific-bubble: #edf3fe;
		--dsw-specific-menu: #fbfcfe;
		--dsw-alias-bg-overlay: #e9ecf2;
		--dsw-alias-tooltip-bg: #2c2c2e;
	}
	body[data-ds-dark-theme] {
		--dsw-alias-bg-base: #141418;
		--dsw-alias-bg-layer-1: #232324;
		--dsw-alias-bg-layer-2: #2c2c2e;
		--dsw-alias-bg-layer-3: #353536;
		--dsw-specific-sidebar-fill: #1b1b1c;
		--dsw-specific-input-major: #202028;
		--dsw-specific-bubble: #2c2c2e;
		--dsw-specific-menu: #353536;
		--dsw-alias-bg-overlay: #2c2c2e;
		--dsw-alias-tooltip-bg: #43454a;
	}
}
/* 减少动效偏好：关闭全部过渡/动画 */
@media (prefers-reduced-motion: reduce) {
	*, *::before, *::after { transition: none !important; animation: none !important; }
}
/* ============ end dsh-glass-theme ============ */`;

		// —— 设置控制器（observable：getSnapshot + subscribe；单一数据源，持久化 localStorage） ——
		class GlassController {
			constructor() {
				this.listeners = new Set();
				this.snapshot = { enabled: isEnabled(), settings: loadSettings() };
			}
			getSnapshot = () => this.snapshot;
			subscribe = (fn) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
			publish = (next) => {
				this.snapshot = next;
				for (const l of [...this.listeners]) l();
			};
			reload = () => {
				this.publish({ enabled: isEnabled(), settings: loadSettings() });
			};
			toggleEnabled = () => {
				const enabled = !this.snapshot.enabled;
				try {
					if (enabled) window.localStorage.removeItem(STORAGE_KEY);
					else window.localStorage.setItem(STORAGE_KEY, "0");
				} catch {}
				this.publish({ ...this.snapshot, enabled });
			};
			update = (patch) => {
				const settings = { ...this.snapshot.settings, ...patch };
				persistSettings(settings);
				this.publish({ ...this.snapshot, settings });
			};
			setBgImage = (dataUrl) => {
				this.update({ bgImage: dataUrl });
			};
			reset = () => {
				persistSettings({ ...DEFAULT_SETTINGS });
				this.publish({ ...this.snapshot, settings: { ...DEFAULT_SETTINGS } });
			};
		}
		const controller = new GlassController();

		// —— 图片压缩（canvas 缩放到 maxW，JPEG 输出，控制 localStorage 体积） ——
		function compressImage(file, maxW, quality) {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => {
					const img = new Image();
					img.onload = () => {
						try {
							const scale = Math.min(1, maxW / Math.max(1, img.width));
							const canvas = document.createElement("canvas");
							canvas.width = Math.max(1, Math.round(img.width * scale));
							canvas.height = Math.max(1, Math.round(img.height * scale));
							canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
							resolve(canvas.toDataURL("image/jpeg", quality));
						} catch (err) { reject(err); }
					};
					img.onerror = reject;
					img.src = reader.result;
				};
				reader.onerror = reject;
				reader.readAsDataURL(file);
			});
		}

		// —— 液态折射（shuding/liquid-glass 方案：canvas 位移图 + feImage + feDisplacementMap）——
		function setupRefraction() {
			if (window.__dshRefractInit) return;
			window.__dshRefractInit = true;
			const NS = "http://www.w3.org/2000/svg";
			const XLINK = "http://www.w3.org/1999/xlink";
			const FILTER_ID = "dsh-glass-refract";

			const svg = document.createElementNS(NS, "svg");
			svg.setAttribute("width", "0");
			svg.setAttribute("height", "0");
			svg.setAttribute("aria-hidden", "true");
			svg.setAttribute("data-plugin", "dsh-glass-theme-refract");
			svg.style.cssText = "position:fixed;top:0;left:0;pointer-events:none";
			const defs = document.createElementNS(NS, "defs");
			const filter = document.createElementNS(NS, "filter");
			filter.setAttribute("id", FILTER_ID);
			filter.setAttribute("filterUnits", "userSpaceOnUse");
			filter.setAttribute("colorInterpolationFilters", "sRGB");
			filter.setAttribute("x", "0");
			filter.setAttribute("y", "0");
			const feImage = document.createElementNS(NS, "feImage");
			feImage.setAttribute("id", FILTER_ID + "_map");
			const feDisp = document.createElementNS(NS, "feDisplacementMap");
			feDisp.setAttribute("in", "SourceGraphic");
			feDisp.setAttribute("in2", FILTER_ID + "_map");
			feDisp.setAttribute("xChannelSelector", "R");
			feDisp.setAttribute("yChannelSelector", "G");
			filter.appendChild(feImage);
			filter.appendChild(feDisp);
			defs.appendChild(filter);
			svg.appendChild(defs);
			(document.body || document.documentElement).appendChild(svg);

			function buildMap(card) {
				const w = Math.round(card.getBoundingClientRect().width);
				const h = Math.round(card.getBoundingClientRect().height);
				if (!(w > 50 && h > 20) || w > 2400 || h > 700) return;
				filter.setAttribute("width", w);
				filter.setAttribute("height", h);
				feImage.setAttribute("width", w);
				feImage.setAttribute("height", h);
				const cv = document.createElement("canvas");
				cv.width = w;
				cv.height = h;
				const cx = cv.getContext("2d");
				const img = cx.createImageData(w, h);
				const d = img.data;
				const raw = new Float32Array(w * h * 2);
				const ss = (a, b, t) => { t = Math.max(0, Math.min(1, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
				const len = (x, y) => Math.sqrt(x * x + y * y);
				const sdf = (x, y, W, H, R) => {
					const qx = Math.abs(x) - W + R, qy = Math.abs(y) - H + R;
					return Math.min(Math.max(qx, qy), 0) + len(Math.max(qx, 0), Math.max(qy, 0)) - R;
				};
				let maxS = 0, idx = 0;
				for (let y = 0; y < h; y++) {
					for (let x = 0; x < w; x++) {
						const ux = x / w, uy = y / h, ix = ux - 0.5, iy = uy - 0.5;
						const dist = sdf(ix, iy, 0.34, 0.38, 0.5);
						const disp = ss(0.85, 0, dist - 0.12);
						const sc = ss(0, 1, disp);
						const tx = ix * sc + 0.5, ty = iy * sc + 0.5;
						const dx = tx * w - x, dy = ty * h - y;
						if (Math.abs(dx) > maxS) maxS = Math.abs(dx);
						if (Math.abs(dy) > maxS) maxS = Math.abs(dy);
						raw[idx++] = dx;
						raw[idx++] = dy;
					}
				}
				maxS *= 0.5;
				if (maxS < 1) maxS = 1;
				idx = 0;
				for (let i = 0; i < d.length; i += 4) {
					d[i] = (raw[idx++] / maxS + 0.5) * 255;
					d[i + 1] = (raw[idx++] / maxS + 0.5) * 255;
					d[i + 2] = 0;
					d[i + 3] = 255;
				}
				cx.putImageData(img, 0, 0);
				feImage.setAttributeNS(XLINK, "href", cv.toDataURL());
				feDisp.setAttribute("scale", String(maxS));
			}

			let card = document.querySelector(".uV2eYG_card");
			const tryBuild = () => {
				card = document.querySelector(".uV2eYG_card");
				if (!card) return false;
				buildMap(card);
				if (window.ResizeObserver && !window.__dshRefractObserved) {
					window.__dshRefractObserved = true;
					new ResizeObserver(() => buildMap(card)).observe(card);
				}
				return true;
			};
			if (!tryBuild() && window.MutationObserver) {
				const mo = new MutationObserver(() => { if (tryBuild()) mo.disconnect(); });
				mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
			}
		}

		// 注入磨砂噪点静态层（无动画、无监听，一次性 DOM）
		function ensureNoise() {
			if (document.querySelector(NOISE_SELECTOR)) return;
			const div = document.createElement("div");
			div.setAttribute("data-plugin", "dsh-glass-theme-noise");
			div.className = "dsh-glass-noise";
			div.setAttribute("aria-hidden", "true");
			(document.body || document.documentElement).appendChild(div);
		}

		// 主题节点（style/noise/refract）随 enabled 幂等注入/移除
		function syncThemeNodes(enabled) {
			if (enabled) {
				if (!document.querySelector(STYLE_SELECTOR)) {
					const style = document.createElement("style");
					style.setAttribute("data-plugin", "dsh-glass-theme");
					style.textContent = CSS;
					(document.head || document.documentElement).appendChild(style);
				}
				ensureNoise();
				setupRefraction();
			} else {
				document.querySelectorAll(STYLE_SELECTOR).forEach((el) => el.remove());
				document.querySelectorAll(NOISE_SELECTOR).forEach((el) => el.remove());
				document.querySelectorAll(REFRACT_SELECTOR).forEach((el) => el.remove());
			}
		}

		// 把设置应用到 CSS 变量（inline 覆盖 :root 默认值）
		function applySettingsToDom(settings) {
			const root = document.documentElement;
			root.style.setProperty("--glass-bg-blur", settings.bgBlur + "px");
			root.style.setProperty("--glass-input-blur", settings.inputBlur + "px");
			root.style.setProperty("--glass-user-bubble-alpha", settings.userBubbleAlpha + "%");
			root.style.setProperty("--glass-bubble-alpha", settings.bubbleAlpha + "%");
			root.style.setProperty("--glass-sidebar-alpha", settings.sidebarAlpha + "%");
			root.style.setProperty("--glass-radius-lg", settings.radius + "px");
			root.style.setProperty("--glass-noise-opacity", String(settings.noiseOpacity / 100));
			if (settings.bgImage) {
				root.style.setProperty("--glass-bg-image", 'url("' + settings.bgImage + '")');
			} else {
				root.style.removeProperty("--glass-bg-image");
			}
		}

		function renderTheme() {
			const { enabled, settings } = controller.getSnapshot();
			syncThemeNodes(enabled);
			if (enabled) applySettingsToDom(settings);
		}

		// —— 设置卡片样式（内联 + --dsw-* token，与宿主主题一致） ——
		const styles = {
			card: { listStyle: "none", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 12, background: "var(--dsw-alias-bg-layer-3)", color: "var(--dsw-alias-label-primary)" },
			header: { width: "100%", appearance: "none", border: 0, background: "none", color: "inherit", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", font: "inherit", borderRadius: 12 },
			headText: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 },
			title: { fontSize: 15, lineHeight: 1.4, fontWeight: 600 },
			description: { fontSize: 13, lineHeight: 1.5, color: "var(--dsw-alias-label-tertiary)" },
			badge: { borderRadius: 999, padding: "1px 8px", fontSize: 11, lineHeight: "17px", background: "var(--dsw-alias-bg-module-platform)", color: "var(--dsw-alias-label-secondary)" },
			chevron: { flex: "none", color: "var(--dsw-alias-label-tertiary)", transition: "transform .16s" },
			body: { borderTop: "1px solid var(--dsw-alias-border-l2)", margin: "0 16px", padding: "14px 0 16px", display: "flex", flexDirection: "column", gap: 14 },
			field: { display: "flex", flexDirection: "column", gap: 6 },
			row: { display: "flex", alignItems: "center", gap: 10 },
			label: { fontSize: 13, lineHeight: "20px", fontWeight: 600, flex: "0 0 auto" },
			value: { flex: "0 0 auto", minWidth: 44, textAlign: "right", fontSize: 12, lineHeight: "20px", color: "var(--dsw-alias-label-secondary)", fontVariantNumeric: "tabular-nums" },
			slider: { flex: 1, minWidth: 0, margin: 0 },
			fileBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8, background: "none", color: "var(--dsw-alias-label-secondary)", cursor: "pointer", font: "inherit", fontSize: 13, lineHeight: 1.5, width: "fit-content" },
			button: { display: "inline-flex", alignItems: "center", padding: "6px 12px", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8, background: "none", color: "var(--dsw-alias-label-secondary)", cursor: "pointer", font: "inherit", fontSize: 13, lineHeight: 1.5, width: "fit-content" },
			primaryBtn: { display: "inline-flex", alignItems: "center", padding: "6px 14px", border: "1px solid transparent", borderRadius: 8, background: "var(--dsw-alias-label-primary)", color: "var(--dsw-alias-bg-layer-3)", cursor: "pointer", font: "inherit", fontSize: 13, lineHeight: 1.5, width: "fit-content" },
			note: { margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-tertiary)" },
			footer: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 },
			hiddenFile: { position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" },
			uploadWrap: { position: "relative", overflow: "hidden", width: "fit-content" },
		};

		// —— 设置卡片组件（注册到 settings.plugin.item slot） ——
		function GlassSettingsCard(props) {
			const [open, setOpen] = React.useState(false);
			const snap = props.useGlassSettings((s) => s);
			const s = snap.settings;
			const h = React.createElement;

			const slider = (label, value, min, max, step, unit, onChange) => h("div", { style: styles.field },
				h("div", { style: styles.row },
					h("span", { style: { ...styles.label, flex: 1 } }, label),
					h("span", { style: styles.value }, value + unit)
				),
				h("input", { type: "range", min, max, step, value, style: styles.slider, onChange: (e) => onChange(Number(e.currentTarget.value)) })
			);

			const onFile = (e) => {
				const file = e.currentTarget.files && e.currentTarget.files[0];
				e.currentTarget.value = "";
				if (!file || !file.type.startsWith("image/")) return;
				compressImage(file, 1920, 0.82).then((dataUrl) => {
					if (dataUrl.length > 4 * 1024 * 1024) { return; } // 超出 localStorage 合理范围，忽略
					props.setBgImage(dataUrl);
				}).catch(() => {});
			};

			return h("li", { style: styles.card, "data-open": open ? "true" : "false" },
				h("button", { type: "button", style: styles.header, "aria-expanded": open, onClick: () => setOpen(!open) },
					h("span", { style: styles.headText },
						h("span", { style: styles.title }, "液态玻璃主题"),
						h("span", { style: styles.description }, "背景图片、磨砂强度与气泡透明度")
					),
					h("span", { style: styles.badge }, snap.enabled ? "已开启" : "已关闭"),
					h("span", { style: { ...styles.chevron, transform: open ? "rotate(180deg)" : "none" } }, "▾")
				),
				open ? h("div", { style: styles.body },
					h("div", { style: styles.row },
						h("span", { style: { ...styles.label, flex: 1 } }, "主题开关"),
						h("input", { type: "checkbox", checked: snap.enabled, onChange: () => props.toggleEnabled() })
					),
					h("div", { style: styles.field },
						h("span", { style: styles.label }, "背景图片"),
						h("div", { style: styles.row },
							h("label", { style: { ...styles.fileBtn, ...styles.uploadWrap } },
								s.bgImage ? "更换图片" : "选择图片",
								h("input", { type: "file", accept: "image/*", style: styles.hiddenFile, onChange: onFile })
							),
							s.bgImage ? h("button", { type: "button", style: styles.button, onClick: () => props.setBgImage(null) }, "恢复默认") : null
						),
						h("p", { style: styles.note }, "选择本地图片作为全局背景（自动压缩，仅存本浏览器）")
					),
					slider("背景模糊", s.bgBlur, 0, 40, 1, "px", (v) => props.update({ bgBlur: v })),
					slider("输入框磨砂", s.inputBlur, 0, 20, 1, "px", (v) => props.update({ inputBlur: v })),
					slider("用户气泡透明度", s.userBubbleAlpha, 50, 100, 1, "%", (v) => props.update({ userBubbleAlpha: v })),
					slider("AI 气泡透明度", s.bubbleAlpha, 50, 100, 1, "%", (v) => props.update({ bubbleAlpha: v })),
					slider("侧边栏透明度", s.sidebarAlpha, 20, 90, 1, "%", (v) => props.update({ sidebarAlpha: v })),
					slider("面板大圆角", s.radius, 8, 32, 1, "px", (v) => props.update({ radius: v })),
					slider("磨砂颗粒", s.noiseOpacity, 0, 20, 1, "%", (v) => props.update({ noiseOpacity: v })),
					h("div", { style: styles.footer },
						h("button", { type: "button", style: styles.button, onClick: () => props.reset() }, "恢复默认")
					)
				) : null
			);
		}

		function apply(ctx) {
			controller.subscribe(renderTheme);
			renderTheme();

			window.addEventListener("storage", (e) => {
				if (e.key === STORAGE_KEY || e.key === SETTINGS_KEY) controller.reload();
			});

			// 设置卡片（设置 → 插件 → 液态玻璃主题）
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				id: "dsh-glass-theme",
				order: 40,
				inject: () => ({
					hooks: { glassSettings: controller },
					toggleEnabled: controller.toggleEnabled,
					update: controller.update,
					setBgImage: controller.setBgImage,
					reset: controller.reset,
				}),
			}, GlassSettingsCard));
		}

		try {
			window.__dshGlassTheme = {
				enabled: isEnabled,
				reapply: renderTheme,
				off: () => { window.localStorage.setItem(STORAGE_KEY, "0"); controller.reload(); },
				on: () => { window.localStorage.removeItem(STORAGE_KEY); controller.reload(); },
			};
		} catch {}

		exports.apply = apply;
		exports.inject = ["slots"];
		return module.exports;
	}
});
