// 构建 browser 端 client.js：
//  - 读取 lib/client.template.js
//  - 把 assets/background.jpg 转成 base64 data URL 内联（避免 host 静态路由）
//  - 写入 lib/client.js
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const templatePath = join(root, "lib", "client.template.js");
const imagePath = join(root, "assets", "background.jpg");
const outputPath = join(root, "lib", "client.js");

const [template, image] = await Promise.all([
  readFile(templatePath, "utf8"),
  readFile(imagePath),
]);

const dataUrl = `data:image/jpeg;base64,${image.toString("base64")}`;
if (!template.includes("__DSH_GLASS_BG_DATA_URL__")) {
  throw new Error("模板中缺少 __DSH_GLASS_BG_DATA_URL__ 占位符");
}

const output = template.replaceAll("__DSH_GLASS_BG_DATA_URL__", dataUrl);
await writeFile(outputPath, output, "utf8");
console.log(`built ${outputPath} (${Buffer.byteLength(output)} bytes, bg ${image.length} bytes)`);
