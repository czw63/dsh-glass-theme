// dsh-glass-theme-ios26 — host half（宿主端）。
// 主题完全在浏览器端通过 window.__ModuleLoader__.load 注入；
// host 侧无逻辑，仅保留 DSH 插件骨架，便于 cordis 安装与卸载。
export const name = "glass-theme";

export const inject = [];

export function apply() {}
