#!/usr/bin/env node
/**
 * dsh-glass-theme 构建脚本：把背景图打成 data URL，注入 client 模板，
 * 产出可被 dsh-client-modules 直接服务的 lib/client.js。
 *
 * 为什么用「构建时内联 data URL」而不是运行时引用外部图片：
 *  - client.js 是 dsh 的静态资源路由（/plugins/<id>/client.js），只服务 .js/.map，
 *    无法引用外部图片文件；
 *  - 背景图作为 data URL 内联进 CSS 字符串，最自包含、卸载最干净；
 *  - 源码模板 lib/client.template.js 保持可读，占位符 __GLASS_BG_DATA_URL__ 在构建时替换。
 *
 * 用法：node scripts/build.mjs
 * 换背景图：替换 assets/background.jpg 后重新运行本脚本。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const templatePath = join(root, "lib", "client.template.js");
const outPath = join(root, "lib", "client.js");
const bgPath = join(root, "assets", "background.jpg");

const template = readFileSync(templatePath, "utf8");
const bg = readFileSync(bgPath);
const dataUrl = "data:image/jpeg;base64," + bg.toString("base64");

if (!template.includes("__GLASS_BG_DATA_URL__")) {
  throw new Error("模板中未找到占位符 __GLASS_BG_DATA_URL__");
}
const out = template.replaceAll("__GLASS_BG_DATA_URL__", dataUrl);
writeFileSync(outPath, out, "utf8");

console.log("✓ 已生成 " + outPath);
console.log("  背景图 " + bgPath + "（" + bg.length + " 字节）→ data URL（" + dataUrl.length + " 字符）");
