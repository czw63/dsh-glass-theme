// dsh-glass-theme-ios26 — iOS 26 液态玻璃 Web 主题（浏览器端）。
//
// 设计原则（全新渲染实现，未复制存档主题的渲染代码）：
//  1. 手机端适配常驻：单栏聊天、抽屉侧边栏、详情 Sheet、安全区、44px 触控、
//     动态视口/软键盘修正，全部与 localStorage['dsh-glass-theme:enabled'] 解耦。
//  2. 液态玻璃重点落在输入框（参考 liquid-dom 的折射/边缘高光/色散/位移扰动思路，
//     用 SVG feTurbulence + feDisplacementMap 做位移折射；镜面高光与色散边纹由
//     CSS 渐变/box-shadow 近似，未使用 feSpecularLighting）：
//     输入框有边缘内高光、静态 backdrop blur、焦点时的位移折射 + 高光 + 色散边纹，
//     桌面端另有 rAF 节流的指针视差阴影。移动端仅按宽度关闭背景位移与气泡磨砂
//     （min-width:769px 门控），输入框折射保留。
//  3. 背景插画放固定层做一次性 blur/降饱和/压暗，不做大面积实时 backdrop-filter；
//     面板通过覆盖 --dsw-* token 半透明化。代码块/正文保持近不透明以保证可读性。
//  4. 设置 → 插件 → 液态玻璃主题：主题总开关 + 输入框液态折射开关。
//  5. 零第三方运行时依赖；无逐帧动画；prefers-reduced-motion 时关闭全部动效。
window.__ModuleLoader__.load({
  id: "@local/dsh-glass-theme",
  factory: (require) => {
    "use strict";
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    var h = React.createElement;

    // ============ 常量 ============
    var STORAGE_KEY = "dsh-glass-theme:enabled";
    var INPUT_LENS_KEY = "dsh-glass-theme:input-lens";
    var VARS_KEY = "dsh-glass-theme:vars";
    var CHANGE_EVENT = "dsh-glass-theme:change";
    var THEME_STYLE_ID = "dsh-glass-theme";
    var MOBILE_STYLE_ID = "dsh-glass-theme-mobile";
    var CONTROL_STYLE_ID = "dsh-glass-theme-controls";
    var BG_URL = "__DSH_GLASS_BG_DATA_URL__";
    var MOBILE_MQ = "(max-width: 768px)";
    var FINE_POINTER_MQ = "(hover: hover) and (pointer: fine)";
    var REDUCED_MOTION_MQ = "(prefers-reduced-motion: reduce)";
    var DEMO_POS_KEY = "dsh-glass-theme:demo-pos";

    // ============ localStorage 读写 ============
    function readStorage(key) {
      try { return window.localStorage.getItem(key); } catch { return null; }
    }
    function writeStorage(key, value) {
      try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } catch {}
    }
    function isEnabled() {
      return readStorage(STORAGE_KEY) !== "0";
    }
    function isInputLensEnabled() {
      return readStorage(INPUT_LENS_KEY) !== "0";
    }
    function setEnabled(enabled) {
      writeStorage(STORAGE_KEY, enabled ? null : "0");
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
    function setInputLens(enabled) {
      writeStorage(INPUT_LENS_KEY, enabled ? null : "0");
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }

    // ---- 可调参数模型（设置页滑块/开关持久化到 localStorage） ----
    var SETTINGS_KEY = "dsh-glass-theme:settings";
    var SETTING_TOGGLES = {
      bgRefract: true,
      inputRefract: true,
      bubbleGlass: true,
      bubbleRefract: true,
      demoCard: false,
      demoChrome: false,
      demoRefract: true,
    };
    var SETTINGS_SCHEMA = {
      bgBlur:            { light: 16,   dark: 18,   min: 0,   max: 40,  step: 1,     unit: "px" },
      bgSaturate:        { light: .78,  dark: .82,  min: .3,  max: 1.5, step: .01,   unit: "" },
      bgBrightness:      { light: 1.04, dark: .62,  min: .3,  max: 1.4, step: .01,   unit: "" },
      bgRefractScale:    { light: 22,   dark: 22,   min: 0,   max: 48,  step: 1,     unit: "px" },
      bgRefractFrequency:{ light: .008, dark: .008, min: .004, max: .04, step: .002, unit: "" },
      sidebarAlpha:      { light: .52,  dark: .58,  min: .2,  max: .95, step: .01,   unit: "" },
      panelAlpha:        { light: .54,  dark: .60,  min: .25, max: .95, step: .01,   unit: "" },
      popoverBlur:       { light: 18,   dark: 18,   min: 0,   max: 36,  step: 1,     unit: "px" },
      inputBlur:         { light: 12,   dark: 12,   min: 0,   max: 36,  step: 1,     unit: "px" },
      inputAlpha:        { light: .48,  dark: .34,  min: .15, max: .95, step: .01,   unit: "" },
      refractScale:      { light: 7,    dark: 7,    min: 0,   max: 24,  step: 1,     unit: "px" },
      refractFrequency:  { light: .012, dark: .012, min: .004, max: .04, step: .002, unit: "" },
      bubbleBlur:        { light: 7,    dark: 7,    min: 0,   max: 28,  step: 1,     unit: "px" },
      bubbleAlpha:       { light: .86,  dark: .84,  min: 0,    max: .98, step: .01,   unit: "" },
      noiseOpacity:      { light: .05,  dark: .065, min: 0,   max: .25, step: .005,  unit: "" },
      sheenSize:         { light: 280,  dark: 280,  min: 160, max: 440, step: 10,    unit: "px" },
      sheenOpacity:      { light: .48,  dark: .34,  min: 0,   max: .9,  step: .05,   unit: "" },
      glassRadius:       { light: 28,   dark: 28,   min: 8,   max: 40,  step: 1,     unit: "px" },
      wallpaperOpacity:  { light: .92,  dark: .90,  min: .4,  max: 1,   step: .01,   unit: "" },
      demoBlur:          { light: 16,   dark: 16,   min: 0,   max: 44,  step: 1,     unit: "px" },
      demoAlpha:         { light: .34,  dark: .40,  min: 0,   max: .92, step: .01,   unit: "" },
      demoWidth:         { light: 252,  dark: 252,  min: 140, max: 560, step: 8,     unit: "px" },
      demoHeight:        { light: 164,  dark: 164,  min: 100, max: 440, step: 8,     unit: "px" },
      demoRadius:        { light: 26,   dark: 26,   min: 8,   max: 52,  step: 1,     unit: "px" },
      demoHighlight:     { light: .75,  dark: .32,  min: 0,   max: 1,   step: .05,   unit: "" },
      demoRefractScale:  { light: 7,    dark: 7,    min: 0,   max: 32,  step: 1,     unit: "px" },
      demoRefractFrequency: { light: .012, dark: .012, min: .004, max: .05, step: .002, unit: "" },
    };
    function isDarkTheme() {
      try {
        if (document.body && document.body.hasAttribute("data-ds-dark-theme")) return true;
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
      } catch { return false; }
    }
    function settingDefault(key) {
      var spec = SETTINGS_SCHEMA[key];
      if (!spec) return SETTING_TOGGLES[key] === true;
      return isDarkTheme() ? spec.dark : spec.light;
    }
    function clampNumber(value, min, max) {
      var n = Number(value);
      if (!Number.isFinite(n)) return min;
      return Math.min(max, Math.max(min, n));
    }
    function clampSetting(key, value) {
      if (key in SETTING_TOGGLES) return Boolean(value);
      var spec = SETTINGS_SCHEMA[key];
      if (!spec) return void 0;
      return clampNumber(value, spec.min, spec.max);
    }
    function loadSettingOverrides() {
      try {
        var raw = readStorage(SETTINGS_KEY);
        if (!raw) return {};
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        var out = {};
        for (var key of Object.keys(parsed)) {
          var value = clampSetting(key, parsed[key]);
          if (value !== void 0) out[key] = value;
        }
        return out;
      } catch { return {}; }
    }
    function saveSettingOverrides(overrides) {
      writeStorage(SETTINGS_KEY, JSON.stringify(overrides));
    }
    function getSettings() {
      var overrides = loadSettingOverrides();
      var out = {};
      for (var key of Object.keys(SETTINGS_SCHEMA)) {
        out[key] = key in overrides ? clampSetting(key, overrides[key]) : settingDefault(key);
      }
      for (var toggle of Object.keys(SETTING_TOGGLES)) {
        out[toggle] = toggle in overrides ? Boolean(overrides[toggle]) : SETTING_TOGGLES[toggle];
      }
      return out;
    }
    function updateSetting(patch) {
      var overrides = loadSettingOverrides();
      var dirty = false;
      for (var key of Object.keys(patch)) {
        if (!(key in SETTINGS_SCHEMA) && !(key in SETTING_TOGGLES)) continue;
        var value = clampSetting(key, patch[key]);
        if (value === void 0) continue;
        if (overrides[key] !== value) {
          overrides[key] = value;
          dirty = true;
        }
      }
      if (!dirty) return;
      saveSettingOverrides(overrides);
      var settings = getSettings();
      // 实时更新只碰受影响的 CSS 变量 / SVG 属性，不重写整份主题样式。
      if (document.body && document.body.classList.contains("dsh-glass-on")) {
        applySettingsPatchToDom(settings, patch);
        applySvgParams(settings, patch);
        syncBodyAttrs(settings);
        syncDemoCard();
        var demoSizeKeys = ["demoWidth", "demoHeight"];
        for (var demoKey of demoSizeKeys) {
          if (demoKey in patch) { clampDemoCardPosition(); break; }
        }
      }
      controller.reloadWith(settings);
    }
    function resetSettings() {
      writeStorage(SETTINGS_KEY, null);
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }

    // 把设置值写成 inline --glass-* 变量；用户 vars 层在其后覆盖，优先级更高。
    var appliedSettingsProps = [];
    function applySettingsToDom(settings) {
      var body = document.body;
      if (!body) return;
      for (var prop of appliedSettingsProps) body.style.removeProperty(prop);
      appliedSettingsProps = [];
      var panel = settings.panelAlpha;
      var map = {
        "--glass-bg-blur": settings.bgBlur + "px",
        "--glass-bg-saturate": String(settings.bgSaturate),
        "--glass-bg-brightness": String(settings.bgBrightness),
        "--glass-sidebar-alpha": String(settings.sidebarAlpha),
        "--glass-popover-blur": settings.popoverBlur + "px",
        "--glass-input-blur": settings.inputBlur + "px",
        "--glass-input-alpha": String(settings.inputAlpha),
        "--glass-bubble-blur": settings.bubbleBlur + "px",
        "--glass-bubble-alpha": String(settings.bubbleAlpha),
        "--glass-noise-opacity": String(settings.noiseOpacity),
        "--glass-sheen-size": settings.sheenSize + "px",
        "--glass-sheen-opacity": String(settings.sheenOpacity),
        "--glass-radius-xl": settings.glassRadius + "px",
        "--glass-radius-lg": Math.max(8, settings.glassRadius - 6) + "px",
        "--glass-wallpaper-opacity": String(settings.wallpaperOpacity),
        "--glass-demo-blur": settings.demoBlur + "px",
        "--glass-demo-alpha": String(settings.demoAlpha),
        "--glass-demo-width": settings.demoWidth + "px",
        "--glass-demo-height": settings.demoHeight + "px",
        "--glass-demo-radius": settings.demoRadius + "px",
        "--glass-demo-highlight": String(settings.demoHighlight),
        "--glass-base-alpha": String(Math.max(.20, +(panel - .14).toFixed(3))),
        "--glass-layer1-alpha": String(Math.max(.22, +(panel - .08).toFixed(3))),
        "--glass-layer2-alpha": String(panel),
        "--glass-layer3-alpha": String(Math.min(.96, +(panel + .06).toFixed(3))),
      };
      for (var name of Object.keys(map)) {
        body.style.setProperty(name, map[name]);
        appliedSettingsProps.push(name);
      }
      // SDF 透镜参数与设置同步（圆角 / 折射强度），变化时重建贴图。
      updateIslandLens({
        cornerRadius: settings.glassRadius,
        strength: Math.max(0.02, Math.max(Number(settings.refractScale) || 0, Number(settings.bgRefractScale) || 0) / 50),
      });
      var lensSvg = document.getElementById("dsh-glass-defs");
      if (lensSvg) {
        resetIslandLensState();
        ensureIslandLenses(lensSvg, ["sidebar", "title", "input"]);
      }
    }

    function setTrackedSettingProp(prop, value) {
      document.body.style.setProperty(prop, value);
      if (appliedSettingsProps.indexOf(prop) === -1) appliedSettingsProps.push(prop);
    }
    function applySettingsPatchToDom(settings, patch) {
      var body = document.body;
      if (!body) return;
      var panel = settings.panelAlpha;
      for (var key of Object.keys(patch)) {
        if (key === "bgBlur") setTrackedSettingProp("--glass-bg-blur", settings.bgBlur + "px");
        else if (key === "bgSaturate") setTrackedSettingProp("--glass-bg-saturate", String(settings.bgSaturate));
        else if (key === "bgBrightness") setTrackedSettingProp("--glass-bg-brightness", String(settings.bgBrightness));
        else if (key === "sidebarAlpha") setTrackedSettingProp("--glass-sidebar-alpha", String(settings.sidebarAlpha));
        else if (key === "popoverBlur") setTrackedSettingProp("--glass-popover-blur", settings.popoverBlur + "px");
        else if (key === "inputBlur") setTrackedSettingProp("--glass-input-blur", settings.inputBlur + "px");
        else if (key === "inputAlpha") setTrackedSettingProp("--glass-input-alpha", String(settings.inputAlpha));
        else if (key === "bubbleBlur") setTrackedSettingProp("--glass-bubble-blur", settings.bubbleBlur + "px");
        else if (key === "bubbleAlpha") setTrackedSettingProp("--glass-bubble-alpha", String(settings.bubbleAlpha));
        else if (key === "noiseOpacity") setTrackedSettingProp("--glass-noise-opacity", String(settings.noiseOpacity));
        else if (key === "sheenSize") setTrackedSettingProp("--glass-sheen-size", settings.sheenSize + "px");
        else if (key === "sheenOpacity") setTrackedSettingProp("--glass-sheen-opacity", String(settings.sheenOpacity));
        else if (key === "demoBlur") setTrackedSettingProp("--glass-demo-blur", settings.demoBlur + "px");
        else if (key === "demoAlpha") setTrackedSettingProp("--glass-demo-alpha", String(settings.demoAlpha));
        else if (key === "demoWidth") setTrackedSettingProp("--glass-demo-width", settings.demoWidth + "px");
        else if (key === "demoHeight") setTrackedSettingProp("--glass-demo-height", settings.demoHeight + "px");
        else if (key === "demoRadius") setTrackedSettingProp("--glass-demo-radius", settings.demoRadius + "px");
        else if (key === "demoHighlight") setTrackedSettingProp("--glass-demo-highlight", String(settings.demoHighlight));
        else if (key === "glassRadius") {
          setTrackedSettingProp("--glass-radius-xl", settings.glassRadius + "px");
          setTrackedSettingProp("--glass-radius-lg", Math.max(8, settings.glassRadius - 6) + "px");
          updateIslandLens({ cornerRadius: settings.glassRadius });
          var svg = document.getElementById("dsh-glass-defs");
          if (svg) {
            resetIslandLensState();
            ensureIslandLenses(svg, ["sidebar", "title", "input"]);
          }
        }
        else if (key === "wallpaperOpacity") setTrackedSettingProp("--glass-wallpaper-opacity", String(settings.wallpaperOpacity));
        else if (key === "panelAlpha") {
          setTrackedSettingProp("--glass-base-alpha", String(Math.max(.20, +(panel - .14).toFixed(3))));
          setTrackedSettingProp("--glass-layer1-alpha", String(Math.max(.22, +(panel - .08).toFixed(3))));
          setTrackedSettingProp("--glass-layer2-alpha", String(panel));
          setTrackedSettingProp("--glass-layer3-alpha", String(Math.min(.96, +(panel + .06).toFixed(3))));
        }
      }
    }

    function syncBodyAttrs(settings) {
      var body = document.body;
      if (!body) return;
      var enabled = body.classList.contains("dsh-glass-on");
      var lens = body.getAttribute("data-dsh-glass-lens") === "on";
      body.setAttribute("data-dsh-glass-bg-refract", enabled && settings.bgRefract ? "on" : "off");
      body.setAttribute("data-dsh-glass-refract", enabled && lens && settings.inputRefract ? "on" : "off");
      body.setAttribute("data-dsh-glass-bubble", enabled && settings.bubbleGlass ? "on" : "off");
      body.setAttribute("data-dsh-glass-bubble-refract", enabled && settings.bubbleGlass && settings.bubbleRefract ? "on" : "off");
      body.setAttribute("data-dsh-glass-demo", enabled && settings.demoCard ? "on" : "off");
      body.setAttribute("data-dsh-glass-demo-refract", enabled && settings.demoCard && settings.demoRefract ? "on" : "off");
      body.setAttribute("data-dsh-glass-demo-chrome", enabled && settings.demoCard && settings.demoChrome ? "on" : "off");
    }

    function applySvgParams(settings, patch) {
      var patchKeys = patch ? Object.keys(patch) : null;
      function relevant(keys) {
        if (patchKeys === null) return true;
        for (var key of keys) if (patchKeys.indexOf(key) !== -1) return true;
        return false;
      }
      // 折射参数 → SDF 透镜强度；变化时重建透镜滤镜（贴图带尺寸+修订缓存）。
      if (relevant(["refractScale", "bgRefractScale", "refractFrequency", "bgRefractFrequency"])) {
        var strength = Math.max(0, Number(settings.refractScale) || 0) / 50;
        var bgStrength = Math.max(0, Number(settings.bgRefractScale) || 0) / 50;
        if (updateIslandLens({ strength: Math.max(strength, bgStrength, 0.02) })) {
          var svg = document.getElementById("dsh-glass-defs");
          if (svg) {
            resetIslandLensState();
            ensureIslandLenses(svg, ["sidebar", "title", "input"]);
          }
        }
      }
    }

    // ---- --glass-* 变量覆盖（可持久化，便于调参） ----
    var appliedVarProps = [];
    function loadVarOverrides() {
      try {
        var raw = readStorage(VARS_KEY);
        if (!raw) return {};
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        var out = {};
        for (var key of Object.keys(parsed)) {
          if (typeof key === "string" && key.startsWith("--glass-") && typeof parsed[key] === "string") {
            out[key] = parsed[key];
          }
        }
        return out;
      } catch { return {}; }
    }
    function applyVarOverrides() {
      for (var prop of appliedVarProps) document.body.style.removeProperty(prop);
      appliedVarProps = [];
      var vars = loadVarOverrides();
      for (var name of Object.keys(vars)) {
        document.body.style.setProperty(name, vars[name]);
        appliedVarProps.push(name);
      }
    }
    function clearVarOverrides() {
      writeStorage(VARS_KEY, null);
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
    function setGlassVar(name, value) {
      if (typeof name !== "string" || !name.startsWith("--glass-") || typeof value !== "string") return;
      var vars = loadVarOverrides();
      vars[name] = value;
      try { window.localStorage.setItem(VARS_KEY, JSON.stringify(vars)); } catch {}
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }

    // ============ 样式节点工具 ============
    function getStyle(id) {
      return document.querySelector('style[data-plugin="' + id + '"]');
    }
    function installStyle(id, css) {
      var style = getStyle(id);
      if (!style) {
        style = document.createElement("style");
        style.dataset.plugin = id;
        style.dataset.pluginCss = id;
        (document.head || document.documentElement).appendChild(style);
      }
      style.textContent = css;
      return style;
    }
    function removeStyle(id) {
      var style = getStyle(id);
      if (style) style.remove();
    }

    // ============ 手机端适配 CSS（常驻，与玻璃开关无关） ============
    var MOBILE_CSS = String.raw`
/* dsh-glass-theme-ios26: mobile adaptation — always on, independent of the glass toggle */
html { --dsh-glass-vv: 100vh; }
@supports (height: 100dvh) { html { --dsh-glass-vv: 100dvh; } }

@media (max-width: 768px) {
  html, body, #root {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }

  /* 三栏变单栏：侧边栏/详情栏脱离 Grid，改为固定浮层 */
  body .pI_x6G_frame {
    grid-template-columns: minmax(0, 1fr) !important;
    height: var(--dsh-glass-vv) !important;
    min-height: 0;
  }
  body .pI_x6G_centerCol {
    grid-column: 1 !important;
    grid-row: 1 !important;
    min-width: 0 !important;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }

  /* 侧边栏：抽屉 */
  body .pI_x6G_sidebarCol {
    position: fixed !important;
    top: 0;
    left: calc(-12px - min(86vw, 360px));
    bottom: 0;
    z-index: 1200;
    width: min(86vw, 360px) !important;
    max-width: calc(100vw - 28px);
    height: var(--dsh-glass-vv) !important;
    box-sizing: border-box;
    border-right: 1px solid var(--dsw-alias-border-l2);
    border-radius: 0 24px 24px 0;
    box-shadow: 24px 0 60px rgba(10, 14, 26, .30);
    transform: none !important;
    visibility: hidden;
    overflow: hidden;
    transition: left .28s cubic-bezier(.22, .8, .36, 1), visibility 0s linear .28s;
  }
  body .pI_x6G_frame:not([data-sidebar-collapsed]) .pI_x6G_sidebarCol {
    left: 0;
    visibility: visible;
    transition: left .28s cubic-bezier(.22, .8, .36, 1), visibility 0s;
  }
  body .pI_x6G_sidebarCol .hHd-Xa_root { width: 100% !important; }

  /* 详情栏：底部/全屏 Sheet */
  body .pI_x6G_detailsCol {
    position: fixed !important;
    top: 100%;
    left: 0;
    right: 0;
    bottom: auto;
    z-index: 1300;
    width: 100% !important;
    height: var(--dsh-glass-vv) !important;
    border: 1px solid var(--dsw-alias-border-l2);
    border-radius: 26px 26px 0 0;
    box-shadow: 0 -18px 60px rgba(10, 14, 26, .30);
    transform: none !important;
    visibility: hidden;
    overflow: hidden;
    transition: top .30s cubic-bezier(.22, .8, .36, 1), visibility 0s linear .30s;
  }
  body .pI_x6G_frame:not([data-details-collapsed]) .pI_x6G_detailsCol {
    top: 0;
    visibility: visible;
    transition: top .30s cubic-bezier(.22, .8, .36, 1), visibility 0s;
  }
  body .pI_x6G_frame[data-details-collapsed] .pI_x6G_detailsCol { pointer-events: none; }
  body .pI_x6G_handle { display: none !important; }

  /* 会话区 */
  body .wSkVaW_root {
    --dsh-chat-content-width: min(748px, calc(100vw - 32px));
    --dsh-composer-card-max-width: min(748px, calc(100vw - 32px));
    height: 100%;
    min-width: 0;
  }
  body .wSkVaW_header {
    padding: calc(env(safe-area-inset-top, 0px) + 8px) calc(env(safe-area-inset-right, 0px) + 10px) 0 calc(env(safe-area-inset-left, 0px) + 56px) !important;
  }
  body .wSkVaW_titleRow { min-height: 44px; }
  body .wSkVaW_headerUtilities { margin-left: 8px; }
  body .wSkVaW_tabs {
    gap: 18px;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }
  body .wSkVaW_tabs::-webkit-scrollbar { display: none; }
  body .wSkVaW_scrollBody,
  body .Md3f7G_scroll { max-width: 100%; }
  body .wSkVaW_composerSeat { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 4px); }
  body .wSkVaW_composerSeat .uV2eYG_root {
    padding-left: calc(env(safe-area-inset-left, 0px) + 8px);
    padding-right: calc(env(safe-area-inset-right, 0px) + 8px);
  }
  body .uV2eYG_root { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 6px); }
  body .uV2eYG_input, body .uV2eYG_mirror, body .uV2eYG_backdrop { font-size: 16px; }
  body .gdEzaW_userStack { max-width: 88%; }

  /* 输入卡底栏：空间不足时换行，禁止把权限/模型按钮压缩到重叠 */
  body .uV2eYG_row {
    flex-wrap: wrap;
    row-gap: 8px;
    height: auto;
    min-height: 44px;
    padding-bottom: 10px;
  }
  body .uV2eYG_tools,
  body .uV2eYG_trailing { flex: 0 0 auto !important; }
  body .uV2eYG_trailing { margin-left: auto; }
  body .uV2eYG_modes,
  body .uV2eYG_modes > * { flex: 0 0 auto !important; min-width: 44px; }

  /* 详情 Sheet 内部 */
  body .ydkMvW_root { border-left: none !important; border-radius: inherit; }
  body .ydkMvW_header { padding: calc(env(safe-area-inset-top, 0px) + 10px) 12px 10px; }
  body .ydkMvW_body { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 16px); }

  /* 触控目标 >= 44px（Apple HIG） */
  body .hHd-Xa_iconButton,
  body .hHd-Xa_newSession,
  body .VOzbGW_trigger,
  body .VOzbGW_navCell,
  body .VOzbGW_close,
  body .uV2eYG_add,
  body .uV2eYG_primary,
  body .ydkMvW_close {
    min-height: 44px;
  }
  body .uV2eYG_add,
  body .uV2eYG_primary { width: 44px; height: 44px; }
  body .hHd-Xa_iconButton { width: 44px; height: 44px; border-radius: 14px; }
  body .uV2eYG_select { height: 44px; padding-top: 10px; padding-bottom: 10px; }
  body .wSkVaW_crumb,
  body .wSkVaW_tab { min-height: 44px; padding: 10px 8px; }
  body .ydkMvW_close { width: 44px; height: 44px; }
  body .VOzbGW_trigger { min-height: 44px; }

  /* 弹层/菜单不超出视口 */
  body [role="menu"],
  body [role="listbox"],
  body [role="tooltip"],
  body [data-radix-popper-content-wrapper] {
    max-width: calc(100vw - 16px) !important;
    max-height: calc(var(--dsh-glass-vv) - 16px) !important;
    overflow: auto !important;
    -webkit-overflow-scrolling: touch;
  }
  body [role="dialog"] {
    max-width: calc(100vw - 16px) !important;
    max-height: calc(var(--dsh-glass-vv) - 16px) !important;
  }

  /* 设置页：手机全屏 + 顶部横向导航 */
  body .VOzbGW_overlay {
    padding: 0;
    left: 0 !important;
    top: 0 !important;
    width: 100vw !important;
    height: var(--dsh-glass-vv) !important;
    z-index: 1500 !important;
  }
  body .VOzbGW_panel {
    width: 100vw;
    max-width: 100vw !important;
    height: var(--dsh-glass-vv);
    max-height: none !important;
    border-radius: 0;
  }
  body .VOzbGW_nav {
    width: 100%;
    height: auto;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px;
    border-bottom: 1px solid var(--dsw-alias-border-l2);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  body .VOzbGW_navTitle { display: none; }
  body .VOzbGW_navList { flex-direction: row; gap: 8px; }
  body .VOzbGW_navCell { flex: 0 0 auto; min-height: 44px; width: auto; padding: 10px 14px; }
  body .VOzbGW_header { height: auto; min-height: 54px; padding: 12px 10px 8px; }
  body .VOzbGW_close { width: 44px; height: 44px; }
  body .VOzbGW_options { padding: 8px 12px calc(env(safe-area-inset-bottom, 0px) + 24px); }

  /* 平滑滚动与移动端惯性 */
  body .wSkVaW_scrollBody,
  body .Md3f7G_scroll,
  body .VOzbGW_options,
  body [role="menu"],
  body [role="listbox"] {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
  }
  body .wSkVaW_scrollBody,
  body .Md3f7G_scroll,
  body .VOzbGW_options { scroll-behavior: smooth; }

  /* 聊天内容无横向滚动 */
  body .wSkVaW_scrollBody pre,
  body .wSkVaW_scrollBody table,
  body .wSkVaW_scrollBody img,
  body .Md3f7G_scroll img { max-width: 100%; }
  body .wSkVaW_scrollBody table { display: block; overflow-x: auto; }
}

@media (max-width: 768px) and (prefers-reduced-motion: reduce) {
  body .pI_x6G_sidebarCol,
  body .pI_x6G_detailsCol { transition: none !important; }
}
`;

    // ============ 控制与设置卡片 CSS（常驻） ============
    var CONTROL_CSS = String.raw`
/* dsh-glass-theme-ios26: controls + settings card */
.dsh-glass-scrim {
  position: fixed;
  inset: 0;
  z-index: 1150;
  background: rgba(8, 12, 24, .44);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  opacity: 0;
  pointer-events: none;
  transition: opacity .22s ease;
}
.dsh-glass-scrim.is-open { opacity: 1; pointer-events: auto; }
@media (min-width: 769px) { .dsh-glass-scrim { display: none; } }

.dsh-glass-hamburger {
  display: none;
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 10px);
  left: calc(env(safe-area-inset-left, 0px) + 10px);
  z-index: 1400;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 15px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  box-shadow: var(--dsw-shadow-lv2);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease, background-color .18s ease;
}
.dsh-glass-hamburger:active { transform: scale(.96); }
.dsh-glass-hamburger svg { width: 20px; height: 20px; pointer-events: none; }
.dsh-glass-hamburger .dsh-glass-bar {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform .22s cubic-bezier(.22, .8, .36, 1), opacity .18s ease;
}
.dsh-glass-hamburger[data-open="true"] .dsh-glass-bar-top { transform: translateY(6px) rotate(45deg); }
.dsh-glass-hamburger[data-open="true"] .dsh-glass-bar-mid { opacity: 0; }
.dsh-glass-hamburger[data-open="true"] .dsh-glass-bar-bot { transform: translateY(-6px) rotate(-45deg); }
@media (max-width: 768px) { .dsh-glass-hamburger { display: inline-flex; } }

.dsh-glass-toggle {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 66px);
  right: calc(env(safe-area-inset-right, 0px) + 14px);
  z-index: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 44px;
  padding: 0 13px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  box-shadow: var(--dsw-shadow-lv2);
  font: 600 12px/1 var(--dsw-font-family, system-ui);
  cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease, background-color .18s ease, opacity .18s ease;
}
.dsh-glass-toggle:hover { transform: translateY(-1px); }
.dsh-glass-toggle:active { transform: scale(.97); }
.dsh-glass-toggle svg { width: 17px; height: 17px; pointer-events: none; flex: none; }
.dsh-glass-toggle[data-enabled="false"] { opacity: .78; }
@media (max-width: 768px) {
  .dsh-glass-toggle { width: 44px; padding: 0; }
  .dsh-glass-toggle-label { display: none; }
}

.dsh-glass-sheen {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 50;
  width: var(--glass-sheen-size, 280px);
  height: var(--glass-sheen-size, 280px);
  margin: 0;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,.52) 0%, rgba(186,211,255,.16) 38%, rgba(186,211,255,0) 70%);
  mix-blend-mode: screen;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(-600px, -600px, 0);
  transition: opacity .28s ease;
}
.dsh-glass-sheen.is-active { opacity: var(--glass-sheen-opacity, .48); }
@media (hover: none), (pointer: coarse), (prefers-reduced-motion: reduce) {
  .dsh-glass-sheen { display: none; }
}

/* 设置 → 插件 → 液态玻璃主题 */
.dsh-glass-settings-card {
  list-style: none;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-3);
  border-radius: 16px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dsh-glass-settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.dsh-glass-settings-title {
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}
.dsh-glass-settings-badge {
  flex: none;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}
.dsh-glass-settings-desc {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 19px;
}
.dsh-glass-settings-row {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
}
.dsh-glass-settings-row + .dsh-glass-settings-row { border-top: 1px solid var(--dsw-alias-border-l2); }
.dsh-glass-settings-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dsh-glass-settings-label { color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 500; line-height: 20px; }
.dsh-glass-settings-hint { color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 17px; }
.dsh-glass-switch { position: relative; flex: none; width: 52px; height: 32px; }
.dsh-glass-switch-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.dsh-glass-switch-track {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover-solid);
  transition: background-color .18s ease, box-shadow .18s ease;
}
.dsh-glass-switch-thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 8px rgba(10, 14, 26, .28);
  transition: transform .18s cubic-bezier(.22, .8, .36, 1);
}
.dsh-glass-switch-input:checked + .dsh-glass-switch-track {
  background: var(--dsw-alias-state-business-primary);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.35);
}
.dsh-glass-switch-input:checked + .dsh-glass-switch-track + .dsh-glass-switch-thumb {
  transform: translateX(20px);
}
.dsh-glass-switch-input:focus-visible + .dsh-glass-switch-track {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}
.dsh-glass-settings-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 6px;
  border-top: 1px solid var(--dsw-alias-border-l2);
}
.dsh-glass-settings-section-title {
  padding: 6px 0 2px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .04em;
  line-height: 17px;
}
.dsh-glass-settings-range {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 0 6px;
}
.dsh-glass-settings-range + .dsh-glass-settings-range { border-top: 1px solid var(--dsw-alias-border-l2); }
.dsh-glass-settings-range-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.dsh-glass-settings-range-label {
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}
.dsh-glass-settings-range-value {
  flex: none;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 17px;
}
.dsh-glass-settings-range input[type="range"] {
  width: 100%;
  height: 24px;
  margin: 0;
  accent-color: var(--dsw-alias-state-business-primary);
  cursor: pointer;
}
.dsh-glass-settings-range-hint {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
}
.dsh-glass-settings-actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.dsh-glass-settings-clear {
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: 500 12px/1 var(--dsw-font-family, system-ui);
  cursor: pointer;
}
.dsh-glass-settings-clear:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-label-dimmed); }
.dsh-glass-settings-fold {
  min-height: 44px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-state-business-primary);
  font: 600 12px/1 var(--dsw-font-family, system-ui);
  cursor: pointer;
}
.dsh-glass-settings-fold-chevron {
  font-size: 10px;
  transform: rotate(0deg);
  transition: transform .18s ease;
}
.dsh-glass-settings-fold[data-open="true"] .dsh-glass-settings-fold-chevron { transform: rotate(180deg); }

/* 可拖拽液态玻璃试玩卡（仅主题开启且设置开关打开时显示；参数来自设置页） */
.dsh-glass-demo-card {
  display: none;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 960;
  width: min(var(--glass-demo-width, 252px), calc(100vw - 24px));
  height: var(--glass-demo-height, 164px);
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, .42);
  border-radius: var(--glass-demo-radius, 26px);
  background-color: rgba(255, 255, 255, var(--glass-demo-alpha, .34));
  background-image:
    radial-gradient(120% 90% at 0% 50%, rgba(255, 72, 112, .10), transparent 28%),
    radial-gradient(120% 90% at 100% 50%, rgba(72, 128, 255, .10), transparent 28%),
    linear-gradient(145deg, rgba(255, 255, 255, .26), rgba(255, 255, 255, .05) 52%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, var(--glass-demo-highlight, .75)),
    inset 0 -1px 0 rgba(255, 255, 255, .16),
    0 30px 80px -28px rgba(31, 42, 70, .55);
  -webkit-backdrop-filter: blur(var(--glass-demo-blur, 16px)) saturate(1.5) brightness(1.04);
  backdrop-filter: blur(var(--glass-demo-blur, 16px)) saturate(1.5) brightness(1.04);
  color: #1c2430;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  touch-action: none;
  user-select: none;
  cursor: grab;
  will-change: transform;
}
body.dsh-glass-on[data-dsh-glass-demo="on"] .dsh-glass-demo-card { display: flex; }
body.dsh-glass-on[data-dsh-glass-demo="on"][data-dsh-glass-demo-refract="on"] .dsh-glass-demo-card {
  -webkit-backdrop-filter: url(#dsh-glass-demo-backdrop) blur(var(--glass-demo-blur, 16px)) saturate(1.5) brightness(1.04);
  backdrop-filter: url(#dsh-glass-demo-backdrop) blur(var(--glass-demo-blur, 16px)) saturate(1.5) brightness(1.04);
}
body[data-ds-dark-theme] .dsh-glass-demo-card {
  border-color: rgba(255, 255, 255, .20);
  background-color: rgba(24, 27, 38, var(--glass-demo-alpha, .40));
  background-image:
    radial-gradient(120% 90% at 0% 50%, rgba(255, 82, 120, .14), transparent 30%),
    radial-gradient(120% 90% at 100% 50%, rgba(88, 142, 255, .14), transparent 30%),
    linear-gradient(145deg, rgba(255, 255, 255, .10), rgba(255, 255, 255, .02) 52%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, var(--glass-demo-highlight, .32)),
    inset 0 -1px 0 rgba(255, 255, 255, .08),
    0 30px 80px -28px rgba(0, 0, 0, .7);
  -webkit-backdrop-filter: blur(var(--glass-demo-blur, 16px)) saturate(1.35) brightness(.94);
  backdrop-filter: blur(var(--glass-demo-blur, 16px)) saturate(1.35) brightness(.94);
  color: #eef1f7;
}
body[data-ds-dark-theme].dsh-glass-on[data-dsh-glass-demo="on"][data-dsh-glass-demo-refract="on"] .dsh-glass-demo-card {
  -webkit-backdrop-filter: url(#dsh-glass-demo-backdrop) blur(var(--glass-demo-blur, 16px)) saturate(1.35) brightness(.94);
  backdrop-filter: url(#dsh-glass-demo-backdrop) blur(var(--glass-demo-blur, 16px)) saturate(1.35) brightness(.94);
}
.dsh-glass-demo-card.dragging { cursor: grabbing; }
.dsh-glass-demo-handle {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.dsh-glass-demo-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .02em;
  opacity: .92;
}
.dsh-glass-demo-close {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, .28);
  color: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity .18s ease, background-color .18s ease;
}
.dsh-glass-demo-card:hover .dsh-glass-demo-close,
.dsh-glass-demo-card:focus-within .dsh-glass-demo-close,
.dsh-glass-demo-card.dragging .dsh-glass-demo-close { opacity: 1; }
@media (hover: none), (pointer: coarse) {
  .dsh-glass-demo-close { opacity: .55; }
}
body[data-ds-dark-theme] .dsh-glass-demo-close { background: rgba(255, 255, 255, .10); }
body.dsh-glass-on[data-dsh-glass-demo-chrome="off"] .dsh-glass-demo-title,
body.dsh-glass-on[data-dsh-glass-demo-chrome="off"] .dsh-glass-demo-orb,
body.dsh-glass-on[data-dsh-glass-demo-chrome="off"] .dsh-glass-demo-hint { display: none; }
body.dsh-glass-on[data-dsh-glass-demo-chrome="off"] .dsh-glass-demo-handle { justify-content: flex-end; }
body.dsh-glass-on[data-dsh-glass-demo-chrome="off"] .dsh-glass-demo-card { padding: 8px; gap: 0; }
.dsh-glass-demo-body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  pointer-events: none;
}
`;

    // ============ 玻璃主题 CSS（受 enabled 开关控制） ============
    var THEME_CSS = String.raw`
/* dsh-glass-theme-ios26: Liquid Glass visual layer
   渲染方式参考 dsh-liquid-glass：壁纸层保持清晰，玻璃岛做局部 backdrop blur，
   折射用 SDF 位移透镜（feImage + feDisplacementMap，RGB 分离产生色散）。 */
body.dsh-glass-on {
  /* 壁纸与岛参数（滑块驱动，--glass-* 沿用 v2 语义） */
  --glass-wallpaper-opacity: .92;
  --glass-island-saturate: 1.5;
  --glass-radius-xl: 28px;
  --glass-radius-lg: 22px;

  /* L0 玻璃表面（岛背景，由 base/input 透明度驱动） */
  --lg-shell-bg: rgba(255, 255, 255, .08);
  --lg-pane-bg: rgba(255, 255, 255, .12);
  --lg-card-bg: rgba(255, 255, 255, .46);
  --lg-control-bg: rgba(248, 251, 255, .80);
  --lg-overlay-bg: rgba(248, 251, 255, .92);
  --lg-border: rgba(255, 255, 255, .46);
  --lg-border-strong: rgba(255, 255, 255, .62);
  --lg-highlight: rgba(255, 255, 255, .78);
  --lg-text-primary: #2c3340;
  --lg-text-secondary: #5b6472;

  background: transparent !important;
}
body.dsh-glass-on[data-ds-dark-theme] {
  --glass-wallpaper-opacity: .90;
  --lg-shell-bg: rgba(16, 22, 36, .16);
  --lg-pane-bg: rgba(18, 24, 40, .14);
  --lg-card-bg: rgba(24, 32, 50, .52);
  --lg-control-bg: rgba(24, 32, 50, .76);
  --lg-overlay-bg: rgba(22, 26, 36, .92);
  --lg-border: rgba(255, 255, 255, .12);
  --lg-border-strong: rgba(255, 255, 255, .22);
  --lg-highlight: rgba(255, 255, 255, .18);
  --lg-text-primary: #eef2f8;
  --lg-text-secondary: rgba(226, 234, 255, .70);
}

/* ---- 壁纸层：清晰，不整图模糊（玻璃岛只糊自己背后） ---- */
#dsh-glass-bg {
  position: fixed;
  inset: -20px;
  z-index: -3;
  pointer-events: none;
  background-image: url("${BG_URL}");
  background-size: cover;
  background-position: center;
  opacity: var(--glass-wallpaper-opacity);
  transform: scale(1.01);
  filter: none;
}

/* ---- 覆盖 DSH token：面板透明化，材质由玻璃岛提供 ---- */
body.dsh-glass-on {
  --dsw-alias-bg-base: transparent;
  --dsw-alias-bg-layer-1: transparent;
  --dsw-alias-bg-layer-2: transparent;
  --dsw-alias-bg-layer-3: transparent;
  --dsw-specific-sidebar-fill: transparent;
  --dsw-specific-input-major: transparent;
  --dsw-specific-menu: rgba(248, 251, 255, .92);
  --dsw-alias-markdown-code-block: rgba(243, 246, 250, .92);
  --dsw-alias-markdown-inline-code: rgba(243, 246, 250, .94);
  --dsw-alias-border-l1: rgba(255, 255, 255, .20);
  --dsw-alias-border-l2: rgba(255, 255, 255, .30);
  --dsw-alias-border-l3: rgba(255, 255, 255, .38);
  --dsw-alias-border-l4: rgba(255, 255, 255, .46);
}
body.dsh-glass-on[data-ds-dark-theme] {
  --dsw-specific-menu: rgba(22, 26, 36, .92);
  --dsw-alias-markdown-code-block: rgba(17, 19, 29, .92);
  --dsw-alias-markdown-inline-code: rgba(17, 19, 29, .94);
  --dsw-alias-border-l1: rgba(255, 255, 255, .10);
  --dsw-alias-border-l2: rgba(255, 255, 255, .14);
  --dsw-alias-border-l3: rgba(255, 255, 255, .18);
  --dsw-alias-border-l4: rgba(255, 255, 255, .24);
}

/* ================= 玻璃岛（局部 backdrop blur + SDF 折射） ================= */

/* 侧栏岛（z-index 2 让侧栏层叠上下文盖过对话内容：
   设置面板是侧栏内的 z-index:1000 固定层，若无提升会被对话内容盖住而无法点击） */
body.dsh-glass-on .pI_x6G_sidebarCol {
  position: relative;
  isolation: isolate;
  z-index: 2;
  background: transparent;
}
body.dsh-glass-on .pI_x6G_sidebarCol::before {
  content: '';
  position: absolute;
  top: 6px;
  right: 4px;
  bottom: 8px;
  left: 8px;
  z-index: -1;
  pointer-events: none;
  background: var(--lg-shell-bg);
  background-clip: padding-box;
  border-radius: var(--glass-radius-xl);
  box-shadow: inset 0 1px 0 var(--lg-highlight), inset 0 0 0 1px var(--lg-border);
  -webkit-backdrop-filter: url(#dsh-glass-lens-sidebar) blur(var(--glass-bg-blur)) saturate(var(--glass-island-saturate));
  backdrop-filter: url(#dsh-glass-lens-sidebar) blur(var(--glass-bg-blur)) saturate(var(--glass-island-saturate));
}
body.dsh-glass-on .pI_x6G_sidebarCol > * { position: relative; z-index: 1; }

/* 折叠（rail）态侧栏岛 */
body.dsh-glass-on[data-dsh-sidebar-collapsed] .pI_x6G_sidebarCol::before {
  top: 6px;
  right: 3px;
  bottom: 4px;
  left: 3px;
}

/* 标题岛 */
body.dsh-glass-on .wSkVaW_header {
  position: relative;
  isolation: isolate;
  background: transparent;
}
body.dsh-glass-on .wSkVaW_header::before {
  content: '';
  position: absolute;
  top: 6px;
  right: 8px;
  bottom: 8px;
  left: 8px;
  z-index: -1;
  pointer-events: none;
  background: var(--lg-pane-bg);
  background-clip: padding-box;
  border-radius: var(--glass-radius-xl);
  box-shadow: inset 0 1px 0 var(--lg-highlight), inset 0 0 0 1px var(--lg-border);
  -webkit-backdrop-filter: url(#dsh-glass-lens-title) blur(var(--glass-bg-blur)) saturate(var(--glass-island-saturate));
  backdrop-filter: url(#dsh-glass-lens-title) blur(var(--glass-bg-blur)) saturate(var(--glass-island-saturate));
}
body.dsh-glass-on .wSkVaW_header > * { position: relative; z-index: 1; }

/* 正文：透明 + 可读性（保持 DSH 滚动所有权，不做整块岛） */
body.dsh-glass-on .wSkVaW_root { background: transparent; }
body.dsh-glass-on .wSkVaW_scrollBody,
body.dsh-glass-on .Md3f7G_scroll { background: transparent; }

/* 消息气泡：轻磨砂，可读性优先 */
body.dsh-glass-on[data-dsh-glass-bubble="on"] .gdEzaW_bubble {
  border: 1px solid var(--lg-border);
  border-radius: var(--glass-radius-lg);
  box-shadow: inset 0 1px 0 var(--lg-highlight), 0 12px 32px -22px rgba(31, 42, 70, .20);
}
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  body.dsh-glass-on[data-dsh-glass-bubble="on"] .gdEzaW_bubble {
    -webkit-backdrop-filter: blur(var(--glass-bubble-blur)) saturate(1.25);
    backdrop-filter: blur(var(--glass-bubble-blur)) saturate(1.25);
  }
}

/* 输入卡玻璃岛（SDF 透镜折射） */
body.dsh-glass-on .uV2eYG_card {
  position: relative;
  isolation: isolate;
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  border-radius: var(--glass-radius-xl);
}
body.dsh-glass-on .uV2eYG_card::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: var(--lg-control-bg);
  background-clip: padding-box;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px var(--lg-border-strong), inset 0 1px 0 var(--lg-highlight);
  -webkit-backdrop-filter: blur(var(--glass-input-blur)) saturate(1.5) brightness(1.03);
  backdrop-filter: blur(var(--glass-input-blur)) saturate(1.5) brightness(1.03);
}
body.dsh-glass-on[data-ds-dark-theme] .uV2eYG_card::before {
  -webkit-backdrop-filter: blur(var(--glass-input-blur)) saturate(1.4) brightness(.92);
  backdrop-filter: blur(var(--glass-input-blur)) saturate(1.4) brightness(.92);
}
/* 折射开关：把 SDF 透镜挂在 backdrop-filter 上 */
body.dsh-glass-on[data-dsh-glass-lens="on"][data-dsh-glass-refract="on"] .uV2eYG_card::before {
  -webkit-backdrop-filter: url(#dsh-glass-lens-input) blur(var(--glass-input-blur)) saturate(1.5) brightness(1.03);
  backdrop-filter: url(#dsh-glass-lens-input) blur(var(--glass-input-blur)) saturate(1.5) brightness(1.03);
}
body.dsh-glass-on[data-ds-dark-theme][data-dsh-glass-lens="on"][data-dsh-glass-refract="on"] .uV2eYG_card::before {
  -webkit-backdrop-filter: url(#dsh-glass-lens-input) blur(var(--glass-input-blur)) saturate(1.4) brightness(.92);
  backdrop-filter: url(#dsh-glass-lens-input) blur(var(--glass-input-blur)) saturate(1.4) brightness(.92);
}
/* 焦点/触屏只加强光与描边 */
@media (hover: hover) and (pointer: fine) {
  body.dsh-glass-on[data-dsh-glass-lens="on"] .uV2eYG_card:focus-within,
  body.dsh-glass-on[data-dsh-glass-lens="on"] .uV2eYG_card:hover:not(:focus-within) {
    border-color: var(--lg-border-strong);
    box-shadow: inset 0 0 0 1px var(--lg-border-strong), 0 0 0 1px rgba(255, 255, 255, .16);
  }
}

/* ---- 弹层/菜单/工具提示：玻璃材质 ---- */
body.dsh-glass-on [role="menu"],
body.dsh-glass-on [role="listbox"],
body.dsh-glass-on [role="tooltip"],
body.dsh-glass-on [role="dialog"] {
  border: 1px solid var(--lg-border-strong);
  border-radius: 18px;
  background: var(--lg-overlay-bg);
  box-shadow: inset 0 1px 0 var(--lg-highlight), 0 26px 70px -32px rgba(31, 42, 70, .32);
  -webkit-backdrop-filter: blur(var(--glass-popover-blur)) saturate(1.5);
  backdrop-filter: blur(var(--glass-popover-blur)) saturate(1.5);
}

/* ---- 侧栏控件 / 玻璃开关 / 汉堡 ---- */
body.dsh-glass-on .hHd-Xa_newSession {
  border: 1px solid var(--lg-border);
  border-radius: 999px;
  background: var(--lg-control-bg);
  box-shadow: inset 0 1px 0 var(--lg-highlight);
}
body.dsh-glass-on .dsh-glass-toggle,
body.dsh-glass-on .dsh-glass-hamburger {
  border-color: var(--lg-border);
  background: var(--lg-control-bg);
  box-shadow: inset 0 1px 0 var(--lg-highlight), 0 22px 44px -20px rgba(31, 42, 70, .28);
  -webkit-backdrop-filter: blur(var(--glass-popover-blur)) saturate(1.5);
  backdrop-filter: blur(var(--glass-popover-blur)) saturate(1.5);
}

/* ---- 设置卡片玻璃化 ---- */
body.dsh-glass-on .dsh-glass-settings-card {
  border-color: var(--lg-border);
  background: var(--lg-card-bg);
  box-shadow: inset 0 1px 0 var(--lg-highlight), 0 18px 44px -28px rgba(31, 42, 70, .24);
}
body.dsh-glass-on .dsh-glass-settings-label,
body.dsh-glass-on .dsh-glass-settings-title { color: var(--lg-text-primary); }

/* ---- 代码卡片/行内代码：可读性 ---- */
body.dsh-glass-on .md-code-block {
  border: 1px solid var(--lg-border);
  border-radius: var(--glass-radius-lg);
  background: var(--dsw-alias-markdown-code-block);
  box-shadow: inset 0 1px 0 var(--lg-highlight-soft, rgba(255,255,255,.30));
}
body.dsh-glass-on .md-code-block :where(pre),
body.dsh-glass-on .md-code-block :where(pre._shiki_178r4_84) { background: transparent !important; }
body.dsh-glass-on ._markdown_1nba0_5 :not(pre)>code {
  background-color: var(--dsw-alias-markdown-inline-code);
  border: 1px solid var(--lg-border);
  border-radius: 7px;
}

/* ---- 滚动条 / 选区 / 焦点 ---- */
body.dsh-glass-on ::selection { background: rgba(65, 118, 230, .28); }
body.dsh-glass-on :focus-visible { outline-color: rgba(65, 118, 230, .9); outline-offset: 2px; }
body.dsh-glass-on *::-webkit-scrollbar-thumb {
  background: rgba(110, 130, 175, .42);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
body.dsh-glass-on[data-ds-dark-theme] *::-webkit-scrollbar-thumb { background: rgba(150, 170, 230, .30); }
body.dsh-glass-on * { scrollbar-color: rgba(110, 130, 175, .42) transparent; }

/* ---- 移动端降级：气泡磨砂关闭，输入卡折射保留 ---- */
@media (max-width: 768px) {
  body.dsh-glass-on .gdEzaW_bubble { -webkit-backdrop-filter: none; backdrop-filter: none; }
}

/* ---- 无 backdrop-filter 兜底：提高面板实色 ---- */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  body.dsh-glass-on {
    --lg-shell-bg: rgba(255, 255, 255, .72);
    --lg-pane-bg: rgba(255, 255, 255, .78);
    --lg-card-bg: rgba(255, 255, 255, .86);
    --lg-control-bg: rgba(248, 251, 255, .92);
  }
  body.dsh-glass-on[data-ds-dark-theme] {
    --lg-shell-bg: rgba(16, 22, 36, .78);
    --lg-pane-bg: rgba(18, 24, 40, .84);
    --lg-card-bg: rgba(24, 32, 50, .90);
    --lg-control-bg: rgba(24, 32, 50, .94);
  }
}

/* ---- 减少动态：关闭过渡动画 ---- */
@media (prefers-reduced-motion: reduce) {
  body.dsh-glass-on .pI_x6G_sidebarCol,
  body.dsh-glass-on .pI_x6G_detailsCol,
  body.dsh-glass-on .dsh-glass-toggle,
  body.dsh-glass-on .dsh-glass-hamburger { transition: none !important; }
}
`;

    // ============ Liquid Glass 光学核心（SDF 位移透镜） ============
    // 渲染方式参考 github.com/xingyingyuzhui/dsh-liquid-glass：
    // 每个玻璃岛按实际尺寸生成圆角盒 SDF 位移贴图，经 feImage + feDisplacementMap
    // 注入 SVG 滤镜做真折射（RGB 通道分离产生色散）。参数可由设置滑杆调整。
    var ISLAND_LENS = {
      mapSize: 768,
      cornerRadius: 28,
      strength: 0.14,
      depthPx: 16,
      curvature: 0.08,
      bend: 0.78,
      bendPx: 14,
      rimFadePx: 5,
      dispersion: 0.06,
      sheen: 0,
      sheenWidth: 3.5,
      sheenFalloff: 1.7,
      sheenAngle: 45,
      specular: 0,
      glow: 0,
      glowSpread: 1,
      glowFalloff: 0.6,
      fallbackDisplacement: 28,
      filterMargin: 18,
    };
    var ISLAND_LENS_DEFAULTS = Object.assign({}, ISLAND_LENS);
    var lensRevision = 0;
    function currentLensRevision() { return lensRevision; }
    function updateIslandLens(patch) {
      if (!patch || typeof patch !== "object") return false;
      var changed = false;
      for (var key in patch) {
        if (!(key in ISLAND_LENS)) continue;
        var value = patch[key];
        if (value === ISLAND_LENS[key]) continue;
        ISLAND_LENS[key] = Math.max(0, Number(value) || 0);
        changed = true;
      }
      if (changed) lensRevision += 1;
      return changed;
    }

    function sdRoundBox(px, py, hx, hy, radius) {
      var ax = Math.abs(px) - hx + radius;
      var ay = Math.abs(py) - hy + radius;
      var ox = Math.max(ax, 0);
      var oy = Math.max(ay, 0);
      return Math.min(Math.max(ax, ay), 0) + Math.sqrt(ox * ox + oy * oy) - radius;
    }
    function erfApprox(x) { return Math.tanh(Math.sqrt(Math.PI) * x); }
    function encodeAxis(signed) { return Math.max(0, Math.min(255, ((0.5 + signed) * 255 + 0.5) | 0)); }
    function encodeSpec(spec) { return Math.max(0, Math.min(255, (127 * spec + 128 + 0.5) | 0)); }
    function domeGradient(distance, radius, scale) {
      var inside = Math.min(distance, radius * (1 - 1e-3));
      return (inside / Math.sqrt(radius * radius - inside * inside)) * scale;
    }
    var DISPERSION_SPREAD = 0.22;
    function islandLensStateKey(boxW, boxH) { return Math.round(boxW) + "x" + Math.round(boxH); }
    function islandLensCacheKey(boxW, boxH) {
      return islandLensStateKey(boxW, boxH) + ":r" + ISLAND_LENS.cornerRadius + ":rev" + currentLensRevision();
    }
    function islandLensMapSize(boxW, boxH) {
      var maxSide = ISLAND_LENS.mapSize;
      var w = Math.max(8, boxW);
      var h = Math.max(8, boxH);
      var mapW, mapH;
      if (w >= h) {
        mapW = maxSide;
        mapH = Math.max(64, Math.round(maxSide * h / w));
      } else {
        mapH = maxSide;
        mapW = Math.max(64, Math.round(maxSide * w / h));
      }
      return { w: mapW & ~1, h: mapH & ~1 };
    }
    function createIslandLensPixels(boxW, boxH) {
      var dim = islandLensMapSize(boxW, boxH);
      var mapW = dim.w, mapH = dim.h;
      var data = new Uint8ClampedArray(mapW * mapH * 4);
      var inset = 2;
      var halfW = Math.max(4, Math.max(8, boxW) / 2 - inset);
      var halfH = Math.max(4, Math.max(8, boxH) / 2 - inset);
      var radius = Math.max(1, Math.min(ISLAND_LENS.cornerRadius, halfW, halfH));
      var minHalf = Math.min(halfW, halfH);
      var depthPx = Math.min(ISLAND_LENS.depthPx, minHalf - 1);
      var innerHalfW = Math.max(0, halfW - depthPx);
      var innerHalfH = Math.max(0, halfH - depthPx);
      var innerRadius = Math.max(0, Math.min(radius, Math.min(innerHalfW, innerHalfH)));
      var falloff = depthPx > 0 ? Math.SQRT1_2 / depthPx : 1e6;
      var cap = Math.max(0.01, Math.min(ISLAND_LENS.curvature * minHalf, minHalf - 1));
      var Rx = (halfW * halfW + cap * cap) / (2 * cap);
      var Ry = (halfH * halfH + cap * cap) / (2 * cap);
      var meanX = (Rx - Math.sqrt(Math.max(0, Rx * Rx - halfW * halfW))) / halfW;
      var meanY = (Ry - Math.sqrt(Math.max(0, Ry * Ry - halfH * halfH))) / halfH;
      var scaleX = meanX > 0 ? 0.5 / meanX : 1;
      var scaleY = meanY > 0 ? 0.5 / meanY : 1;
      var rMaxX = Rx * (1 - 1e-3), rMaxY = Ry * (1 - 1e-3);
      var cosA = Math.cos((ISLAND_LENS.sheenAngle * Math.PI) / 180);
      var sinA = Math.sin((ISLAND_LENS.sheenAngle * Math.PI) / 180);
      var erInv = 1 / Math.max(2, ISLAND_LENS.bendPx);
      var x, y;
      for (y = 0; y < mapH; y++) {
        var fy = ((y + 0.5) / mapH - 0.5) * 2 * halfH;
        var i = y * mapW * 4;
        for (x = 0; x < mapW; x++) {
          var fx = ((x + 0.5) / mapW - 0.5) * 2 * halfW;
          var sdf = sdRoundBox(fx, fy, halfW, halfH, radius);
          if (sdf >= 0) {
            data[i] = 128; data[i + 1] = 128; data[i + 2] = 128; data[i + 3] = 255;
            i += 4;
            continue;
          }
          var ax = Math.min(Math.abs(fx), rMaxX);
          var ay = Math.min(Math.abs(fy), rMaxY);
          var dirX = domeGradient(ax, Rx, scaleX);
          var dirY = domeGradient(ay, Ry, scaleY);
          if (fx < 0) dirX = -dirX;
          if (fy < 0) dirY = -dirY;
          var innerSdf = sdRoundBox(fx, fy, innerHalfW, innerHalfH, innerRadius);
          var edgeOpacity = 0.5 * (1 + erfApprox(innerSdf * falloff));
          var rimFade = Math.max(0, Math.min(1, -sdf / ISLAND_LENS.rimFadePx));
          rimFade = rimFade * rimFade * (3 - 2 * rimFade);
          var dx = 0.5 * dirX * edgeOpacity * rimFade;
          var dy = 0.5 * dirY * edgeOpacity * rimFade;
          if (ISLAND_LENS.bend > 0 && rimFade > 0) {
            var s = Math.max(0, 1 + sdf * erInv);
            if (s > 0) {
              var nx = (sdRoundBox(fx + 1, fy, halfW, halfH, radius) - sdRoundBox(fx - 1, fy, halfW, halfH, radius)) * 0.5;
              var ny = (sdRoundBox(fx, fy + 1, halfW, halfH, radius) - sdRoundBox(fx, fy - 1, halfW, halfH, radius)) * 0.5;
              var nlen = Math.sqrt(nx * nx + ny * ny) || 1;
              var m = s * s * rimFade;
              var a = (0.5 * ISLAND_LENS.bend * m) / nlen;
              dx += nx * a;
              dy += ny * a;
            }
          }
          var spec = 0;
          if (ISLAND_LENS.sheen > 0 || ISLAND_LENS.glow > 0) {
            var normX = Math.max(-1, Math.min(1, fx / halfW));
            var normY = Math.max(-1, Math.min(1, fy / halfH));
            var axis = Math.min(1, Math.abs(normX * cosA + normY * sinA) * Math.SQRT1_2);
            if (ISLAND_LENS.sheen > 0) {
              var band = Math.max(0, 1 + sdf * (1 / Math.max(2, ISLAND_LENS.sheenWidth)));
              spec += ISLAND_LENS.sheen * Math.pow(band, ISLAND_LENS.sheenFalloff) * (0.16 + 0.84 * Math.pow(axis, 1.6));
            }
            if (ISLAND_LENS.glow > 0) {
              var reach = Math.min(1, -sdf / Math.max(2, ISLAND_LENS.glowSpread * minHalf));
              var t = 1 - reach;
              spec += ISLAND_LENS.glow * Math.pow(t * t * (3 - 2 * t), ISLAND_LENS.glowFalloff) * edgeOpacity * (0.6 + 0.4 * axis);
            }
            if (spec > 1) spec = 1;
          }
          data[i] = encodeAxis(-dx);
          data[i + 1] = encodeAxis(-dy);
          data[i + 2] = encodeSpec(spec);
          data[i + 3] = 255;
          i += 4;
        }
      }
      return { width: mapW, height: mapH, data: data };
    }
    var islandMapCache = new Map();
    var ISLAND_MAP_CACHE_LIMIT = 16;
    function peekIslandLensMap(boxW, boxH) {
      var key = islandLensCacheKey(boxW, boxH);
      if (!islandMapCache.has(key)) return null;
      var map = islandMapCache.get(key);
      islandMapCache.delete(key);
      islandMapCache.set(key, map);
      return map;
    }
    function rememberIslandMap(boxW, boxH, map) {
      var key = islandLensCacheKey(boxW, boxH);
      if (islandMapCache.has(key)) islandMapCache.delete(key);
      islandMapCache.set(key, map);
      if (islandMapCache.size > ISLAND_MAP_CACHE_LIMIT) {
        islandMapCache.delete(islandMapCache.keys().next().value);
      }
    }
    function encodeIslandMap(pixels) {
      try {
        var canvas = document.createElement("canvas");
        canvas.width = pixels.width;
        canvas.height = pixels.height;
        var ctx = canvas.getContext("2d");
        if (!ctx || typeof ctx.createImageData !== "function") return "";
        var img = ctx.createImageData(pixels.width, pixels.height);
        img.data.set(pixels.data);
        ctx.putImageData(img, 0, 0);
        var url = canvas.toDataURL("image/png");
        canvas.width = 0;
        canvas.height = 0;
        return url;
      } catch (_error) {
        return "";
      }
    }
    function requestIslandLensMap(boxW, boxH) {
      var cached = peekIslandLensMap(boxW, boxH);
      if (cached !== null) return cached;
      var pixels = createIslandLensPixels(boxW, boxH);
      var map = encodeIslandMap(pixels);
      if (!map) return "";
      rememberIslandMap(boxW, boxH, map);
      return map;
    }
    function buildIslandFilterPrimitives(map, scale) {
      if (!map) {
        return '<feTurbulence type="fractalNoise" baseFrequency="0.01 0.014" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="0.08" xChannelSelector="R" yChannelSelector="G"/>';
      }
      var d = ISLAND_LENS.dispersion;
      var spread = DISPERSION_SPREAD;
      var parts = [
        '<feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="mapBg"/>',
        '<feImage href="' + map + '" xlink:href="' + map + '" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="rawMap"/>',
        '<feComposite in="rawMap" in2="mapBg" operator="over" result="map"/>',
      ];
      if (d > 0) {
        parts.push(
          '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + (scale * (1 + spread * d)) + '" xChannelSelector="R" yChannelSelector="G"/>',
          '<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="refractR"/>',
          '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + (scale * (1 + spread * 0.5 * d)) + '" xChannelSelector="R" yChannelSelector="G"/>',
          '<feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="refractG"/>',
          '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + scale + '" xChannelSelector="R" yChannelSelector="G"/>',
          '<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="refractB"/>',
          '<feComposite in="refractR" in2="refractG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="refractRG"/>',
          '<feComposite in="refractRG" in2="refractB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lensOut"/>'
        );
      } else {
        parts.push('<feDisplacementMap in="SourceGraphic" in2="map" scale="' + scale + '" xChannelSelector="R" yChannelSelector="G" result="lensOut"/>');
      }
      return parts.join("");
    }
    // 岛盒子测量：侧栏 / 标题 / 正文 / 输入卡
    function measureIslandShapes() {
      var shapes = { sidebar: null, title: null, pane: null, input: null };
      var side = document.querySelector("[data-slot='sidebar'] > :first-child");
      var header = document.querySelector("[data-slot='conversation.session.header'] > header");
      var pane = document.querySelector("[data-slot='conversation'] > [data-phase='active']")
        || document.querySelector("[data-slot='conversation'] > [data-phase]");
      var card = document.querySelector("[data-composer-card]");
      var gutter = 8, split = 4, titleTop = 6, titleFoot = 8;
      var collapsed = document.querySelector("[data-sidebar-collapsed]") !== null;
      var sidePadL = collapsed ? 3 : gutter, sidePadR = collapsed ? 3 : split, sidePadB = collapsed ? 4 : gutter;
      if (side) {
        shapes.sidebar = {
          w: Math.max(16, (side.clientWidth || 260) - sidePadL - sidePadR),
          h: Math.max(16, (side.clientHeight || 600) - titleTop - sidePadB),
        };
      }
      if (header) {
        shapes.title = {
          w: Math.max(16, (header.clientWidth || 800) - split - gutter),
          h: Math.max(16, (header.clientHeight || 56) - titleTop - titleFoot),
        };
      }
      if (pane) {
        var hero = pane.getAttribute("data-phase") === "hero";
        var paneCut = hero ? titleTop : (header ? header.offsetHeight || 84 : 84) + 3;
        shapes.pane = {
          w: Math.max(16, (pane.clientWidth || 800) - split - gutter),
          h: Math.max(16, (pane.clientHeight || 600) - paneCut - 8),
        };
      }
      if (card) {
        var rect = card.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          shapes.input = { w: Math.max(16, rect.width), h: Math.max(16, rect.height) };
        }
      }
      return shapes;
    }
    // 每岛 SVG 透镜：id → filter 元素
    var islandLensState = {};
    function ensureIslandLenses(svg, keys) {
      keys.forEach(function (key) {
        var id = "dsh-glass-lens-" + key;
        var shape = measureIslandShapes()[key];
        var boxW = shape ? shape.w : fallbackIslandShape(key).w;
        var boxH = shape ? shape.h : fallbackIslandShape(key).h;
        var stateKey = islandLensStateKey(boxW, boxH);
        if (islandLensState[key] && islandLensState[key].key === stateKey && islandLensState[key].rev === currentLensRevision()) return;
        var map = requestIslandLensMap(boxW, boxH);
        islandLensState[key] = { key: stateKey, map: map, rev: currentLensRevision() };
        var filter = svg.querySelector("#" + id);
        if (filter) filter.remove();
        filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
        filter.setAttribute("id", id);
        filter.setAttribute("filterUnits", "objectBoundingBox");
        filter.setAttribute("primitiveUnits", "objectBoundingBox");
        filter.setAttribute("x", "-0.2");
        filter.setAttribute("y", "-0.2");
        filter.setAttribute("width", "1.4");
        filter.setAttribute("height", "1.4");
        filter.setAttribute("color-interpolation-filters", "sRGB");
        filter.innerHTML = buildIslandFilterPrimitives(map, ISLAND_LENS.strength);
        svg.appendChild(filter);
      });
    }
    function fallbackIslandShape(key) {
      var map = { sidebar: { w: 244, h: 640 }, title: { w: 720, h: 52 }, pane: { w: 720, h: 560 }, input: { w: 700, h: 120 } };
      return map[key] || map.pane;
    }
    function resetIslandLensState() { islandLensState = {}; }

    // ============ SVG 滤镜定义（参数来自设置页） ============
    function buildSvgDefs(settings) {
      return '<defs>'
        + '</defs>';
    }

    function ensureSvgDefs(settings) {
      var svg = document.getElementById("dsh-glass-defs");
      if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.id = "dsh-glass-defs";
        svg.setAttribute("aria-hidden", "true");
        svg.style.cssText = "position:fixed;width:0;height:0;overflow:hidden;";
        (document.body || document.documentElement).appendChild(svg);
      }
      svg.innerHTML = buildSvgDefs(settings || getSettings());
      ensureIslandLenses(svg, ["sidebar", "title", "input"]);
      return svg;
    }
    function removeSvgDefs() {
      var svg = document.getElementById("dsh-glass-defs");
      if (svg) svg.remove();
      resetIslandLensState();
    }

    // ============ 主题节点（壁纸层，不整图模糊） ============
    function ensureBackdropNodes() {
      var bg = document.getElementById("dsh-glass-bg");
      if (!bg) {
        bg = document.createElement("div");
        bg.id = "dsh-glass-bg";
        bg.setAttribute("aria-hidden", "true");
        document.body.appendChild(bg);
      }
    }
    function removeBackdropNodes() {
      var node;
      while ((node = document.getElementById("dsh-glass-bg"))) node.remove();
      while ((node = document.getElementById("dsh-glass-veil"))) node.remove();
      while ((node = document.getElementById("dsh-glass-noise"))) node.remove();
    }

    // ============ 可观察控制器（设置卡片 hooks） ============
    var controller = (function () {
      var listeners = new Set();
      var snapshot = {
        enabled: true,
        inputLens: true,
        varCount: 0,
        settings: {},
      };
      function notify() {
        listeners.forEach(function (fn) {
          try { fn(); } catch {}
        });
      }
      function publish() {
        snapshot = {
          enabled: isEnabled(),
          inputLens: isInputLensEnabled(),
          varCount: Object.keys(loadVarOverrides()).length,
          settings: getSettings(),
        };
        notify();
      }
      function publishSettings(settings) {
        snapshot = {
          enabled: isEnabled(),
          inputLens: isInputLensEnabled(),
          varCount: snapshot.varCount,
          settings: settings,
        };
        notify();
      }
      return {
        getSnapshot: function () { return snapshot; },
        subscribe: function (fn) {
          listeners.add(fn);
          return function () { listeners.delete(fn); };
        },
        reload: publish,
        reloadWith: publishSettings,
        toggleEnabled: function () { setEnabled(!isEnabled()); },
        toggleInputLens: function () { setInputLens(!isInputLensEnabled()); },
        updateSetting: updateSetting,
        resetSettings: resetSettings,
        clearVars: clearVarOverrides,
        setVar: setGlassVar,
      };
    })();

    // ============ 设置卡片组件 ============
    function SwitchRow(props) {
      return h("label", { className: "dsh-glass-settings-row" },
        h("span", { className: "dsh-glass-settings-text" },
          h("span", { className: "dsh-glass-settings-label" }, props.label),
          h("span", { className: "dsh-glass-settings-hint" }, props.hint)
        ),
        h("span", { className: "dsh-glass-switch" },
          h("input", {
            type: "checkbox",
            role: "switch",
            className: "dsh-glass-switch-input",
            checked: props.checked,
            "aria-checked": props.checked ? "true" : "false",
            onChange: props.onChange,
          }),
          h("span", { className: "dsh-glass-switch-track", "aria-hidden": "true" }),
          h("span", { className: "dsh-glass-switch-thumb", "aria-hidden": "true" })
        )
      );
    }

    function SettingsSection(props) {
      return h("div", { className: "dsh-glass-settings-section" },
        h("div", { className: "dsh-glass-settings-section-title" }, props.title),
        props.children
      );
    }

    function RangeRow(props) {
      var value = Number(props.value) || 0;
      var text = props.display;
      if (text === void 0) {
        text = Math.abs(value) < .1 ? value.toFixed(3) : Number.isInteger(value) ? String(value) : value.toFixed(2);
      }
      return h("label", { className: "dsh-glass-settings-range" },
        h("span", { className: "dsh-glass-settings-range-head" },
          h("span", { className: "dsh-glass-settings-range-label" }, props.label),
          h("span", { className: "dsh-glass-settings-range-value" }, text + (props.unit || ""))
        ),
        h("input", {
          type: "range",
          min: props.min,
          max: props.max,
          step: props.step,
          value: value,
          onChange: function (event) { props.onChange(Number(event.currentTarget.value)); },
        }),
        props.hint ? h("span", { className: "dsh-glass-settings-range-hint" }, props.hint) : null
      );
    }

    function GlassSettingsCard(props) {
      var snap = props.useGlassTheme(function (s) { return s; });
      var t = props.t || function (key) { return key; };
      var s = snap.settings || {};
      var update = props.updateSetting || function () {};
      var paramsState = React.useState(false);
      var paramsOpen = paramsState[0];
      var setParamsOpen = paramsState[1];
      var params = h("div", null,
        h(SettingsSection, { title: t("sectionAppearance") },
          h(RangeRow, { label: t("wallpaperOpacity"), hint: t("wallpaperOpacityHint"), min: 40, max: 100, step: 1, unit: "%", value: Math.round((s.wallpaperOpacity || .92) * 100), onChange: function (v) { update({ wallpaperOpacity: v / 100 }); } }),
          h(RangeRow, { label: t("glassRadius"), hint: t("glassRadiusHint"), min: 8, max: 40, step: 1, unit: "px", value: s.glassRadius, onChange: function (v) { update({ glassRadius: v }); } }),
          h(RangeRow, { label: t("bgBlur"), hint: t("bgBlurHint"), min: 0, max: 40, step: 1, unit: "px", value: s.bgBlur, onChange: function (v) { update({ bgBlur: v }); } }),
          h(SwitchRow, { label: t("bgRefract"), hint: t("bgRefractHint"), checked: s.bgRefract, onChange: function () { update({ bgRefract: !s.bgRefract }); } }),
          h(RangeRow, { label: t("bgRefractScale"), hint: t("bgRefractScaleHint"), min: 0, max: 48, step: 1, unit: "px", value: s.bgRefractScale, onChange: function (v) { update({ bgRefractScale: v }); } })
        ),
        h(SettingsSection, { title: t("sectionInput") },
          h(SwitchRow, { label: t("inputLens"), hint: t("inputLensHint"), checked: snap.inputLens, onChange: function () { props.toggleInputLens(); } }),
          h(SwitchRow, { label: t("inputRefract"), hint: t("inputRefractHint"), checked: s.inputRefract, onChange: function () { update({ inputRefract: !s.inputRefract }); } }),
          h(RangeRow, { label: t("inputBlur"), hint: t("inputBlurHint"), min: 0, max: 36, step: 1, unit: "px", value: s.inputBlur, onChange: function (v) { update({ inputBlur: v }); } }),
          h(RangeRow, { label: t("inputAlpha"), hint: t("inputAlphaHint"), min: .15, max: .95, step: .01, unit: "", value: s.inputAlpha, onChange: function (v) { update({ inputAlpha: v }); } }),
          h(RangeRow, { label: t("refractScale"), hint: t("refractScaleHint"), min: 0, max: 24, step: 1, unit: "px", value: s.refractScale, onChange: function (v) { update({ refractScale: v }); } })
        ),
        h(SettingsSection, { title: t("sectionBubble") },
          h(SwitchRow, { label: t("bubbleGlass"), hint: t("bubbleGlassHint"), checked: s.bubbleGlass, onChange: function () { update({ bubbleGlass: !s.bubbleGlass }); } }),
          h(SwitchRow, { label: t("bubbleRefract"), hint: t("bubbleRefractHint"), checked: s.bubbleRefract, onChange: function () { update({ bubbleRefract: !s.bubbleRefract }); } }),
          h(RangeRow, { label: t("bubbleBlur"), hint: t("bubbleBlurHint"), min: 0, max: 28, step: 1, unit: "px", value: s.bubbleBlur, onChange: function (v) { update({ bubbleBlur: v }); } }),
          h(RangeRow, { label: t("bubbleAlpha"), hint: t("bubbleAlphaHint"), min: 0, max: .98, step: .01, unit: "", value: s.bubbleAlpha, onChange: function (v) { update({ bubbleAlpha: v }); } })
        ),
        h(SettingsSection, { title: t("sectionSurface") },
          h(RangeRow, { label: t("popoverBlur"), hint: t("popoverBlurHint"), min: 0, max: 36, step: 1, unit: "px", value: s.popoverBlur, onChange: function (v) { update({ popoverBlur: v }); } }),
          h(RangeRow, { label: t("panelAlpha"), hint: t("panelAlphaHint"), min: .25, max: .95, step: .01, unit: "", value: s.panelAlpha, onChange: function (v) { update({ panelAlpha: v }); } }),
          h(RangeRow, { label: t("sidebarAlpha"), hint: t("sidebarAlphaHint"), min: .2, max: .95, step: .01, unit: "", value: s.sidebarAlpha, onChange: function (v) { update({ sidebarAlpha: v }); } }),
          h(RangeRow, { label: t("bgSaturate"), hint: t("bgSaturateHint"), min: .3, max: 1.5, step: .01, unit: "", value: s.bgSaturate, onChange: function (v) { update({ bgSaturate: v }); } })
        )
      );
      return h("li", { className: "dsh-glass-settings-card" },
        h("div", { className: "dsh-glass-settings-head" },
          h("div", { className: "dsh-glass-settings-title" }, t("title")),
          h("span", { className: "dsh-glass-settings-badge" }, snap.enabled ? t("on") : t("off"))
        ),
        h("p", { className: "dsh-glass-settings-desc" }, t("description")),
        h(SwitchRow, {
          label: t("enabled"),
          hint: t("enabledHint"),
          checked: snap.enabled,
          onChange: function () { props.toggleEnabled(); },
        }),
        h("button", {
          type: "button",
          className: "dsh-glass-settings-fold",
          "data-open": paramsOpen ? "true" : "false",
          "aria-expanded": paramsOpen ? "true" : "false",
          onClick: function () { setParamsOpen(!paramsOpen); },
        },
          h("span", null, paramsOpen ? t("hideParams") : t("showParams")),
          h("span", { className: "dsh-glass-settings-fold-chevron" }, "▼")
        ),
        paramsOpen ? params : null,
        h("div", { className: "dsh-glass-settings-actions" },
          snap.varCount > 0 ? h("button", { type: "button", className: "dsh-glass-settings-clear", onClick: function () { props.clearVars(); } }, t("clearVars")) : null,
          h("button", { type: "button", className: "dsh-glass-settings-clear", onClick: function () { props.resetSettings(); } }, t("resetSettings"))
        )
      );
    }

    var LOCALE_NS = "dsh-glass-theme";
    var LOCALES = {
      zh: {
        title: "液态玻璃主题",
        description: "iOS 26 Liquid Glass 全局主题：手机端适配常驻；关闭主题只恢复 DSH 默认视觉。以下参数即时生效并保存在本浏览器。",
        enabled: "主题总开关",
        enabledHint: "localStorage['dsh-glass-theme:enabled'] = '0' 时关闭玻璃视觉，移动端适配仍生效。",
        inputLens: "输入框液态玻璃",
        inputLensHint: "输入卡边缘高光 + 背景磨砂。下方折射只作用于输入框背后的聊天内容，不会位移输入文字。",
        inputRefract: "输入框背景折射",
        inputRefractHint: "SVG feTurbulence + feDisplacementMap，只作用 backdrop，输入文字不受影响。",
        inputBlur: "输入框模糊半径",
        inputBlurHint: "backdrop-filter blur 半径。",
        inputAlpha: "输入框透明度",
        inputAlphaHint: "输入卡实色占比，越低越透。",
        refractScale: "输入折射位移量",
        refractScaleHint: "feDisplacementMap scale，0 为无位移。",
        refractFrequency: "输入折射频率",
        refractFrequencyHint: "feTurbulence baseFrequency，越大噪点越细碎。",
        sectionAppearance: "外观",
        wallpaperOpacity: "壁纸透明度",
        wallpaperOpacityHint: "壁纸层不透明度；玻璃岛 blur 只作用岛背后，壁纸保持清晰。",
        glassRadius: "玻璃圆角",
        glassRadiusHint: "玻璃岛圆角半径，同时作用于 SDF 透镜轮廓。",
        bgBlur: "玻璃模糊半径",
        bgBlurHint: "侧栏/标题等玻璃岛的 backdrop blur。",
        bgSaturate: "玻璃饱和度",
        bgSaturateHint: "玻璃岛 saturate 系数，1 为原色。",
        bgBrightness: "背景亮度",
        bgBrightnessHint: "深色模式建议 0.5–0.75 保证文字对比度。",
        bgRefract: "背景折射",
        bgRefractHint: "对玻璃岛做 SDF 位移折射，仅桌面端。",
        bgRefractScale: "背景折射强度",
        bgRefractScaleHint: "玻璃岛 SDF 位移 scale（px）。",
        bgRefractFrequency: "背景折射频率",
        bgRefractFrequencyHint: "背景噪声频率。",
        sectionInput: "输入框",
        sectionBubble: "消息气泡",
        bubbleGlass: "气泡玻璃化",
        bubbleGlassHint: "气泡边缘高光 + 背景磨砂。",
        bubbleRefract: "用户气泡折射",
        bubbleRefractHint: "把输入框同款背景位移折射应用到用户气泡。",
        bubbleBlur: "气泡模糊半径",
        bubbleBlurHint: "气泡 backdrop-filter blur 半径。",
        bubbleAlpha: "气泡透明度",
        bubbleAlphaHint: "透明度无下限，可调成完全透明；正文可读性请自行取舍。",
        sectionSurface: "面板与弹层",
        popoverBlur: "弹层模糊半径",
        popoverBlurHint: "菜单/对话框等中小面积 backdrop 模糊。",
        panelAlpha: "面板透明度",
        panelAlphaHint: "主面板层级实色占比，自动派生 bg-base/layer-1/2/3。",
        sidebarAlpha: "侧边栏透明度",
        sidebarAlphaHint: "侧边栏玻璃实色占比。",
        noiseOpacity: "磨砂颗粒",
        noiseOpacityHint: "SVG 噪点层不透明度。",
        sectionSheen: "指针光斑",
        sheenSize: "光斑尺寸",
        sheenSizeHint: "鼠标下的高光直径；中心始终跟随指针。",
        sheenOpacity: "光斑强度",
        sheenOpacityHint: "0 为完全关闭光斑。",
        demoCard: "液态玻璃试玩卡",
        demoCardHint: "页面上显示一张可按住拖动的玻璃卡片；关闭后立即移除。",
        showParams: "展开调参",
        hideParams: "收起调参",
        sectionDemo: "试玩卡片",
        demoChrome: "显示文字与图标",
        demoChromeHint: "关闭后只保留可拖动的玻璃面和悬停显现的关闭叉。",
        demoRefract: "试玩卡折射",
        demoRefractHint: "拖拽时背景位移；关闭后只保留 blur 磨砂。",
        demoWidth: "试玩卡宽度",
        demoWidthHint: "140–560px，手机端会被视口宽度约束。",
        demoHeight: "试玩卡高度",
        demoHeightHint: "100–440px。",
        demoBlur: "试玩卡模糊半径",
        demoBlurHint: "backdrop-filter blur 半径。",
        demoAlpha: "试玩卡浓度",
        demoAlphaHint: "玻璃底色实色占比，0 为完全透明。",
        demoRadius: "试玩卡圆角",
        demoRadiusHint: "8–52px。",
        demoHighlight: "试玩卡高光",
        demoHighlightHint: "顶部内高光强度。",
        demoRefractScale: "试玩卡折射位移",
        demoRefractScaleHint: "SVG feDisplacementMap scale。",
        demoRefractFrequency: "试玩卡折射频率",
        demoRefractFrequencyHint: "SVG feTurbulence baseFrequency。",
        on: "已开启",
        off: "已关闭",
        clearVars: "清除 --glass-* 变量",
        resetSettings: "恢复默认参数",
      },
      en: {
        title: "Liquid Glass Theme",
        description: "iOS 26 Liquid Glass visual layer. Mobile layout stays active when the theme is off. Parameters apply instantly and persist in this browser.",
        enabled: "Theme",
        enabledHint: "Set localStorage['dsh-glass-theme:enabled'] to '0' to restore the default look.",
        inputLens: "Input liquid glass",
        inputLensHint: "Edge highlight + backdrop frost on the composer card.",
        inputRefract: "Input backdrop refraction",
        inputRefractHint: "SVG turbulence + displacement on the backdrop only; typed text is never displaced.",
        inputBlur: "Input blur radius",
        inputBlurHint: "Composer backdrop-filter blur radius.",
        inputAlpha: "Input opacity",
        inputAlphaHint: "Solid ratio of the composer card.",
        refractScale: "Input refraction scale",
        refractScaleHint: "feDisplacementMap scale; 0 disables displacement.",
        refractFrequency: "Input refraction frequency",
        refractFrequencyHint: "feTurbulence baseFrequency.",
        sectionAppearance: "Appearance",
        wallpaperOpacity: "Wallpaper opacity",
        wallpaperOpacityHint: "Wallpaper layer opacity; glass islands blur only behind them.",
        glassRadius: "Glass radius",
        glassRadiusHint: "Glass island corner radius; also shapes the SDF lens.",
        bgBlur: "Glass blur radius",
        bgBlurHint: "backdrop blur of sidebar / title glass islands.",
        bgSaturate: "Glass saturation",
        bgSaturateHint: "Glass island saturate factor; 1 keeps the original.",
        bgBrightness: "Background brightness",
        bgBrightnessHint: "Use 0.5–0.75 in dark mode for contrast.",
        bgRefract: "Background refraction",
        bgRefractHint: "SDF displacement refraction on glass islands, desktop only.",
        bgRefractScale: "Background refraction scale",
        bgRefractScaleHint: "Glass island SDF displacement scale (px).",
        bgRefractFrequency: "Background refraction frequency",
        bgRefractFrequencyHint: "Background noise frequency.",
        sectionInput: "Composer",
        sectionBubble: "Message bubbles",
        bubbleGlass: "Bubble glass",
        bubbleGlassHint: "Edge highlight + backdrop frost on bubbles.",
        bubbleRefract: "User bubble refraction",
        bubbleRefractHint: "Apply the composer-style backdrop refraction to user bubbles.",
        bubbleBlur: "Bubble blur radius",
        bubbleBlurHint: "Bubble backdrop-filter blur radius.",
        bubbleAlpha: "Bubble opacity",
        bubbleAlphaHint: "No lower limit; set 0 for a fully transparent bubble.",
        sectionSurface: "Panels & popovers",
        popoverBlur: "Popover blur radius",
        popoverBlurHint: "Backdrop blur for menus and dialogs.",
        panelAlpha: "Panel opacity",
        panelAlphaHint: "Solid ratio for main panel layers.",
        sidebarAlpha: "Sidebar opacity",
        sidebarAlphaHint: "Solid ratio of the sidebar glass.",
        noiseOpacity: "Grain",
        noiseOpacityHint: "SVG noise layer opacity.",
        sectionSheen: "Pointer sheen",
        sheenSize: "Sheen size",
        sheenSizeHint: "Highlight diameter under the pointer; it stays centered on the cursor.",
        sheenOpacity: "Sheen strength",
        sheenOpacityHint: "Set 0 to disable the pointer sheen.",
        demoCard: "Liquid glass demo card",
        demoCardHint: "Show a draggable glass card on the page. Turn off to remove it.",
        showParams: "Show parameters",
        hideParams: "Hide parameters",
        sectionDemo: "Demo card",
        demoChrome: "Show text & icon",
        demoChromeHint: "When off, only the draggable glass surface and a hover-revealed close button remain.",
        demoRefract: "Demo card refraction",
        demoRefractHint: "Backdrop displacement while dragging; off keeps blur only.",
        demoWidth: "Demo card width",
        demoWidthHint: "140–560px, constrained by viewport on phones.",
        demoHeight: "Demo card height",
        demoHeightHint: "100–440px.",
        demoBlur: "Demo card blur",
        demoBlurHint: "Backdrop blur radius.",
        demoAlpha: "Demo card density",
        demoAlphaHint: "Solid ratio of the glass fill; 0 is fully transparent.",
        demoRadius: "Demo card radius",
        demoRadiusHint: "8–52px.",
        demoHighlight: "Demo card highlight",
        demoHighlightHint: "Top inner highlight strength.",
        demoRefractScale: "Demo refraction scale",
        demoRefractScaleHint: "SVG feDisplacementMap scale.",
        demoRefractFrequency: "Demo refraction frequency",
        demoRefractFrequencyHint: "SVG feTurbulence baseFrequency.",
        on: "On",
        off: "Off",
        clearVars: "Clear --glass-* overrides",
        resetSettings: "Reset defaults",
      },
    };

    // ============ 移动端控制 ============
    var hamburger = null;
    var scrim = null;
    var toggleButton = null;
    var sheen = null;
    var frameObserver = null;
    var pointerRaf = null;
    var demoCard = null;
    var demoDrag = null;

    function loadDemoPos() {
      try {
        var raw = readStorage(DEMO_POS_KEY);
        if (!raw) return null;
        var pos = JSON.parse(raw);
        if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") return null;
        return { x: pos.x, y: pos.y };
      } catch { return null; }
    }
    function saveDemoPos(x, y) {
      try { window.localStorage.setItem(DEMO_POS_KEY, JSON.stringify({ x: x, y: y })); } catch {}
    }
    function clampDemo(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }
    function createDemoCard() {
      if (demoCard) return demoCard;
      var card = document.createElement("div");
      card.className = "dsh-glass-demo-card";
      card.dataset.plugin = "dsh-glass-theme-demo";
      card.innerHTML = '<div class="dsh-glass-demo-handle"><span class="dsh-glass-demo-title">液态玻璃试玩</span><button type="button" class="dsh-glass-demo-close" aria-label="关闭试玩卡">×</button></div>'
        + '<div class="dsh-glass-demo-body"><span class="dsh-glass-demo-orb"></span><p class="dsh-glass-demo-hint">按住我拖动<br/>观察背景折射</p></div>';
      document.body.appendChild(card);
      var close = card.querySelector(".dsh-glass-demo-close");
      close.addEventListener("click", function (event) {
        event.stopPropagation();
        updateSetting({ demoCard: false });
      });
      card.addEventListener("pointerdown", function (event) {
        if (event.target.closest(".dsh-glass-demo-close")) return;
        if (!card.isConnected || event.button !== 0 && event.pointerType === "mouse") return;
        var rect = card.getBoundingClientRect();
        demoDrag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: rect.left,
          originY: rect.top,
        };
        card.classList.add("dragging");
        try { card.setPointerCapture(event.pointerId); } catch {}
        event.preventDefault();
      });
      card.addEventListener("pointermove", function (event) {
        if (!demoDrag || demoDrag.pointerId !== event.pointerId) return;
        var x = clampDemo(demoDrag.originX + event.clientX - demoDrag.startX, -card.offsetWidth + 52, window.innerWidth - 52);
        var y = clampDemo(demoDrag.originY + event.clientY - demoDrag.startY, 8, window.innerHeight - 52);
        card.style.transform = "translate3d(" + x + "px," + y + "px,0)";
      });
      function endDrag(event) {
        if (!demoDrag || demoDrag.pointerId !== event.pointerId) return;
        var rect = card.getBoundingClientRect();
        saveDemoPos(rect.left, rect.top);
        card.classList.remove("dragging");
        try { card.releasePointerCapture(event.pointerId); } catch {}
        demoDrag = null;
      }
      card.addEventListener("pointerup", endDrag);
      card.addEventListener("pointercancel", endDrag);
      var pos = loadDemoPos();
      var x = pos ? clampDemo(pos.x, -card.offsetWidth + 52, window.innerWidth - 52) : Math.max(12, window.innerWidth - card.offsetWidth - 20);
      var y = pos ? clampDemo(pos.y, 8, window.innerHeight - 52) : Math.max(120, window.innerHeight - card.offsetHeight - 140);
      card.style.transform = "translate3d(" + x + "px," + y + "px,0)";
      demoCard = card;
      return card;
    }
    function removeDemoCard() {
      if (demoCard) {
        demoCard.remove();
        demoCard = null;
        demoDrag = null;
      }
    }
    function clampDemoCardPosition() {
      if (!demoCard) return;
      var rect = demoCard.getBoundingClientRect();
      var x = clampDemo(rect.left, -demoCard.offsetWidth + 52, window.innerWidth - 52);
      var y = clampDemo(rect.top, 8, window.innerHeight - 52);
      if (x !== rect.left || y !== rect.top) {
        demoCard.style.transform = "translate3d(" + x + "px," + y + "px,0)";
        saveDemoPos(x, y);
      }
    }
    function syncDemoCard() {
      var on = document.body.classList.contains("dsh-glass-on")
        && document.body.getAttribute("data-dsh-glass-demo") === "on";
      if (on) {
        createDemoCard();
        clampDemoCardPosition();
      } else removeDemoCard();
    }

    function isMobile() {
      return window.matchMedia(MOBILE_MQ).matches;
    }

    function toggleSidebar() {
      try {
        if (window.__dshGlassThemeCtx && window.__dshGlassThemeCtx.layout) {
          window.__dshGlassThemeCtx.layout.toggleSidebar();
          return;
        }
      } catch {}
      var btn = document.querySelector(".pI_x6G_frame .hHd-Xa_toggle");
      if (btn) btn.click();
    }
    function closeDetails() {
      try {
        if (window.__dshGlassThemeCtx && window.__dshGlassThemeCtx.layout) {
          window.__dshGlassThemeCtx.layout.closeDetails();
          return;
        }
      } catch {}
      var btn = document.querySelector(".pI_x6G_frame .ydkMvW_close, .pI_x6G_frame [aria-label='关闭详情'], .pI_x6G_frame [aria-label='Close details']");
      if (btn) btn.click();
    }

    function createControls(frame) {
      if (!scrim) {
        scrim = document.createElement("div");
        scrim.className = "dsh-glass-scrim";
        scrim.dataset.plugin = "dsh-glass-theme-scrim";
        scrim.setAttribute("aria-hidden", "true");
        scrim.addEventListener("click", function () {
          if (!frame.hasAttribute("data-details-collapsed")) closeDetails();
          else if (!frame.hasAttribute("data-sidebar-collapsed")) toggleSidebar();
        });
        document.body.appendChild(scrim);
      }
      if (!hamburger) {
        hamburger = document.createElement("button");
        hamburger.type = "button";
        hamburger.className = "dsh-glass-hamburger";
        hamburger.dataset.plugin = "dsh-glass-theme-hamburger";
        hamburger.innerHTML = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect class="dsh-glass-bar dsh-glass-bar-top" x="2.5" y="4.5" width="15" height="1.8" rx="0.9" fill="currentColor"/><rect class="dsh-glass-bar dsh-glass-bar-mid" x="2.5" y="9.1" width="15" height="1.8" rx="0.9" fill="currentColor"/><rect class="dsh-glass-bar dsh-glass-bar-bot" x="2.5" y="13.7" width="15" height="1.8" rx="0.9" fill="currentColor"/></svg>';
        hamburger.addEventListener("click", toggleSidebar);
        document.body.appendChild(hamburger);
      }
      if (!toggleButton) {
        toggleButton = document.createElement("button");
        toggleButton.type = "button";
        toggleButton.className = "dsh-glass-toggle";
        toggleButton.dataset.plugin = "dsh-glass-theme-toggle";
        toggleButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.2c2.7 0 4.6 1.7 5.5 4.2 1.6.7 2.8 2.1 3 4.2-1.8 2.2-4.2 3.4-7.2 3.6-.5 1.8-1.8 3-3.7 3.4-1.4.3-2.6-.2-3.4-1.4 1.5-.3 2.7-1.2 3.4-2.7.2-1.2.2-2.5 0-3.8-.7-1.5-1.9-2.4-3.4-2.7.8-1.2 2-1.7 3.4-1.4 1.9.4 3.2 1.6 3.7 3.4 3 .2 5.4-1 7.2-3.6.2-2.1-1-3.5-3-4.2-.9-2.5-2.8-4.2-5.5-4.2Z" fill="currentColor"/></svg><span class="dsh-glass-toggle-label">玻璃</span>';
        toggleButton.title = "液态玻璃主题开关";
        toggleButton.addEventListener("click", function () { setEnabled(!isEnabled()); });
        document.body.appendChild(toggleButton);
      }
      if (!sheen) {
        sheen = document.createElement("div");
        sheen.className = "dsh-glass-sheen";
        sheen.dataset.plugin = "dsh-glass-theme-sheen";
        sheen.setAttribute("aria-hidden", "true");
        document.body.appendChild(sheen);
      }
      syncControls(frame);
    }

    function syncControls(frame) {
      if (!frame || !hamburger || !scrim || !toggleButton) return;
      var sidebarOpen = isMobile() && !frame.hasAttribute("data-sidebar-collapsed");
      var detailsOpen = isMobile() && !frame.hasAttribute("data-details-collapsed");
      hamburger.dataset.open = sidebarOpen ? "true" : "false";
      hamburger.setAttribute("aria-label", sidebarOpen ? "收起侧边栏" : "打开侧边栏");
      hamburger.setAttribute("aria-expanded", sidebarOpen ? "true" : "false");
      scrim.classList.toggle("is-open", sidebarOpen || detailsOpen);
      toggleButton.dataset.enabled = isEnabled() ? "true" : "false";
      toggleButton.setAttribute("aria-pressed", isEnabled() ? "true" : "false");
    }

    // ============ 动态视口/软键盘 ============
    var vvRaf = null;
    function syncVisualViewport() {
      if (!isMobile() || !window.visualViewport) {
        document.documentElement.style.removeProperty("--dsh-glass-vv");
        return;
      }
      document.documentElement.style.setProperty("--dsh-glass-vv", Math.round(window.visualViewport.height) + "px");
    }
    function scheduleVisualViewport() {
      if (vvRaf !== null) return;
      vvRaf = requestAnimationFrame(function () {
        vvRaf = null;
        syncVisualViewport();
        var frame = document.querySelector(".pI_x6G_frame");
        if (frame) syncControls(frame);
      });
    }
    function onFocusIn(event) {
      if (!isMobile()) return;
      var target = event.target;
      if (!(target instanceof Element)) return;
      var composer = target.closest(".uV2eYG_card");
      if (!composer) return;
      requestAnimationFrame(function () {
        var rect = composer.getBoundingClientRect();
        var limit = (window.visualViewport ? window.visualViewport.height : window.innerHeight) - 8;
        if (rect.bottom > limit) composer.scrollIntoView({ block: "nearest" });
      });
    }

    // ============ 指针视差 + 触屏高光（rAF 节流） ============
    function onFramePointerMove(event) {
      if (!document.body.classList.contains("dsh-glass-on")) return;
      if (pointerRaf !== null) return;
      pointerRaf = requestAnimationFrame(function () {
        pointerRaf = null;
        var vw = window.innerWidth || 1;
        var vh = window.innerHeight || 1;
        var nx = (event.clientX / vw - 0.5) * 2;
        var ny = (event.clientY / vh - 0.5) * 2;
        document.documentElement.style.setProperty("--glass-shift-x", (nx * 6).toFixed(1) + "px");
        document.documentElement.style.setProperty("--glass-shift-y", (ny * 8).toFixed(1) + "px");
        if (sheen) {
          sheen.classList.add("is-active");
          var halfW = sheen.offsetWidth / 2;
          var halfH = sheen.offsetHeight / 2;
          sheen.style.transform = "translate3d(" + (event.clientX - halfW) + "px," + (event.clientY - halfH) + "px,0)";
        }
      });
    }
    function onFramePointerLeave() {
      if (pointerRaf !== null) { cancelAnimationFrame(pointerRaf); pointerRaf = null; }
      document.documentElement.style.removeProperty("--glass-shift-x");
      document.documentElement.style.removeProperty("--glass-shift-y");
      if (sheen) sheen.classList.remove("is-active");
    }
    function onFrameTouchStart(event) {
      var target = event.target;
      if (!(target instanceof Element)) return;
      var card = target.closest(".uV2eYG_card");
      if (!card || !document.body.classList.contains("dsh-glass-on")) return;
      card.classList.add("dsh-glass-touch");
      window.setTimeout(function () { card.classList.remove("dsh-glass-touch"); }, 360);
    }

    // ============ 主题状态同步 ============
    function renderTheme() {
      var enabled = isEnabled();
      var lens = isInputLensEnabled();
      var settings = getSettings();
      document.body.classList.toggle("dsh-glass-on", enabled);
      document.body.setAttribute("data-dsh-glass-lens", enabled && lens ? "on" : "off");
      syncBodyAttrs(settings);
      if (enabled) {
        ensureBackdropNodes();
        // 主题 CSS 只安装一次；滑块实时更新只改 inline 变量和 SVG 属性。
        if (!getStyle(THEME_STYLE_ID)) installStyle(THEME_STYLE_ID, THEME_CSS);
        applySettingsToDom(settings);
        ensureSvgDefs(settings);
      } else {
        removeStyle(THEME_STYLE_ID);
        removeSvgDefs();
        removeBackdropNodes();
        if (sheen) sheen.classList.remove("is-active");
      }
      applyVarOverrides();
      syncDemoCard();
      var frame = document.querySelector(".pI_x6G_frame");
      if (frame) syncControls(frame);
    }

    function ensureViewportMeta() {
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "viewport";
        document.head.appendChild(meta);
      }
      var content = meta.getAttribute("content") || "";
      if (!content.includes("viewport-fit=cover")) {
        meta.setAttribute("content", content ? content + ", viewport-fit=cover" : "width=device-width, initial-scale=1, viewport-fit=cover");
      }
    }

    // ============ apply ============
    function apply(ctx) {
      // 设置卡片使用 ctx.layout（并在极端情况下兜底点击原生按钮）。
      window.__dshGlassThemeCtx = ctx;

      // 移动端 CSS 常驻，与主题开关无关。
      installStyle(MOBILE_STYLE_ID, MOBILE_CSS);
      installStyle(CONTROL_STYLE_ID, CONTROL_CSS);

      // 设置 → 插件 → 液态玻璃主题。
      ctx.effect(function () {
        return ctx.locale.register(LOCALE_NS, LOCALES);
      }, "dsh-glass-theme: locale");
      ctx.slots.inject("settings.plugin.item", function () {
        return ctx.slots.register({
          name: "settings.plugin.item",
          id: "dsh-glass-theme",
          order: 40,
          locale: LOCALE_NS,
          inject: function () {
            return {
              hooks: { glassTheme: controller },
              toggleEnabled: controller.toggleEnabled,
              toggleInputLens: controller.toggleInputLens,
              updateSetting: controller.updateSetting,
              resetSettings: controller.resetSettings,
              clearVars: controller.clearVars,
            };
          },
        }, GlassSettingsCard);
      });

      ctx.effect(function () {
        var disposed = false;
        var domReadyDisposer = null;
        var frame = null;
        var storageHandler = null;
        var changeHandler = null;
        var viewportResize = null;
        var focusIn = null;
        var settingsClick = null;

        function start() {
          if (disposed) return;
          ensureViewportMeta();
          controller.reload();
          renderTheme();
          syncVisualViewport();

          var onStorage = function (event) {
            if (event.key === null || event.key === STORAGE_KEY || event.key === INPUT_LENS_KEY || event.key === VARS_KEY || event.key === SETTINGS_KEY) {
              controller.reload();
              renderTheme();
            }
          };
          storageHandler = onStorage;
          window.addEventListener("storage", onStorage);

          var onChange = function () {
            controller.reload();
            renderTheme();
          };
          changeHandler = onChange;
          window.addEventListener(CHANGE_EVENT, onChange);

          if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", scheduleVisualViewport);
            window.visualViewport.addEventListener("scroll", scheduleVisualViewport);
          }
          viewportResize = scheduleVisualViewport;
          window.addEventListener("resize", scheduleVisualViewport);

          focusIn = onFocusIn;
          document.addEventListener("focusin", onFocusIn, true);

          // 从抽屉里打开设置时，先把抽屉收起来，避免设置弹层被侧边栏遮挡。
          settingsClick = function (event) {
            if (!isMobile()) return;
            var target = event.target;
            if (!(target instanceof Element)) return;
            if (!target.closest(".VOzbGW_trigger")) return;
            window.setTimeout(function () {
              var f = document.querySelector(".pI_x6G_frame");
              if (f && !f.hasAttribute("data-sidebar-collapsed")) toggleSidebar();
            }, 0);
          };
          document.addEventListener("click", settingsClick, true);

          function adoptFrame(el) {
            if (disposed) return;
            frame = el;
            createControls(frame);
            frameObserver = new MutationObserver(function () {
              syncControls(frame);
            });
            frameObserver.observe(frame, {
              attributes: true,
              attributeFilter: ["data-sidebar-collapsed", "data-details-collapsed"],
            });
            if (window.matchMedia(FINE_POINTER_MQ).matches && !window.matchMedia(REDUCED_MOTION_MQ).matches) {
              frame.addEventListener("pointermove", onFramePointerMove);
              frame.addEventListener("pointerleave", onFramePointerLeave);
            }
            frame.addEventListener("touchstart", onFrameTouchStart, { passive: true });
          }

          var existing = document.querySelector(".pI_x6G_frame");
          if (existing) {
            adoptFrame(existing);
          } else {
            var bodyObserver = new MutationObserver(function () {
              if (disposed) { bodyObserver.disconnect(); return; }
              var el = document.querySelector(".pI_x6G_frame");
              if (el) {
                bodyObserver.disconnect();
                adoptFrame(el);
              }
            });
            domReadyDisposer = function () { bodyObserver.disconnect(); };
            bodyObserver.observe(document.documentElement, { childList: true, subtree: true });
          }
        }

        if (document.body) start();
        else {
          var onReady = function () { start(); };
          document.addEventListener("DOMContentLoaded", onReady, { once: true });
          domReadyDisposer = function () { document.removeEventListener("DOMContentLoaded", onReady); };
        }

        return function () {
          disposed = true;
          if (domReadyDisposer) domReadyDisposer();
          if (storageHandler) window.removeEventListener("storage", storageHandler);
          if (changeHandler) window.removeEventListener(CHANGE_EVENT, changeHandler);
          if (viewportResize) window.removeEventListener("resize", viewportResize);
          if (focusIn) document.removeEventListener("focusin", focusIn, true);
          if (settingsClick) document.removeEventListener("click", settingsClick, true);
          if (window.visualViewport) {
            window.visualViewport.removeEventListener("resize", scheduleVisualViewport);
            window.visualViewport.removeEventListener("scroll", scheduleVisualViewport);
          }
          if (frameObserver) frameObserver.disconnect();
          if (frame) {
            frame.removeEventListener("pointermove", onFramePointerMove);
            frame.removeEventListener("pointerleave", onFramePointerLeave);
            frame.removeEventListener("touchstart", onFrameTouchStart);
          }
          if (vvRaf !== null) cancelAnimationFrame(vvRaf);
          if (pointerRaf !== null) cancelAnimationFrame(pointerRaf);
          if (hamburger) hamburger.remove();
          if (scrim) scrim.remove();
          if (toggleButton) toggleButton.remove();
          if (sheen) sheen.remove();
          removeDemoCard();
          hamburger = scrim = toggleButton = sheen = null;
          removeStyle(MOBILE_STYLE_ID);
          removeStyle(CONTROL_STYLE_ID);
          removeStyle(THEME_STYLE_ID);
          removeSvgDefs();
          removeBackdropNodes();
          document.body.classList.remove("dsh-glass-on");
          document.body.removeAttribute("data-dsh-glass-lens");
          document.documentElement.style.removeProperty("--dsh-glass-vv");
          document.documentElement.style.removeProperty("--glass-shift-x");
          document.documentElement.style.removeProperty("--glass-shift-y");
          for (var prop of appliedVarProps) document.body.style.removeProperty(prop);
          appliedVarProps = [];
          for (var prop of appliedSettingsProps) document.body.style.removeProperty(prop);
          appliedSettingsProps = [];
          if (window.__dshGlassThemeCtx === ctx) delete window.__dshGlassThemeCtx;
        };
      }, "dsh-glass-theme: style + controls lifecycle");
    }

    // 便捷 API：调试与一键开关
    window.__dshGlassTheme = {
      enabled: isEnabled,
      on: function () { setEnabled(true); },
      off: function () { setEnabled(false); },
      toggle: function () { setEnabled(!isEnabled()); },
      lensOn: function () { setInputLens(true); },
      lensOff: function () { setInputLens(false); },
      setVar: setGlassVar,
      clearVars: clearVarOverrides,
      reapply: function () { controller.reload(); renderTheme(); },
    };

    exports.apply = apply;
    exports.inject = ["slots", "layout", "locale"];
    return module.exports;
  }
});
