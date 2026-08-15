/**
 * dsh-glass-theme — host half（宿主端）。
 *
 * 职责一：注册同源静态资源路由 `/glass-assets`，把 `serve/` 目录（AI 生成的
 * 截图/文件）挂到 DSH 的 3080 端口下，使 markdown 里的 `![](/glass-assets/x.png)`
 * 同源可加载 —— 这是"AI 在 WebUI 里发图"的通道。
 * 职责二：主题本身仍是纯 CSS/JS 客户端注入（./client），与本文件互不影响。
 */
import { writeFileSync } from "node:fs";

import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, sep } from "node:path";

export const name = "glass-theme";

export const inject = ["webServer"];

const MIME = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".txt": "text/plain; charset=utf-8",
	".md": "text/markdown; charset=utf-8",
	".json": "application/json",
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".pdf": "application/pdf",
	".zip": "application/zip",
};

/**
 * The directory served at /glass-assets.
 * Resolved in preference order: (1) symlink-chain sibling (../serve relative to this
 * module, which resolves through the installed/symlinked package), (2) the workspace
 * source checkout, (3) the installed package's own serve/ sibling. Keeps working even
 * when the @local symlink or the serve symlink is missing after a reinstall.
 */
import { existsSync } from "node:fs";

function resolveServeRoot() {
	const viaSymlink = join(dirname(new URL(import.meta.url).pathname), "..", "serve");
	if (existsSync(viaSymlink)) return viaSymlink;
	const workspace = "/root/DeepSeek_harness/Workspace/dsh-glass-theme/serve";
	if (existsSync(workspace)) return workspace;
	return viaSymlink;
}
const ROOT = resolveServeRoot();

export function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: "/glass-assets",
		handler: async (req, res) => {
			try {
				const url = new URL(req.url, "http://localhost");
				const rel = decodeURIComponent(url.pathname.slice("/glass-assets".length)).replace(/^[/\\]+/, "");
				const file = normalize(join(ROOT, rel));
				if (file !== ROOT && !file.startsWith(ROOT + sep)) {
					res.writeHead(403);
					res.end("forbidden");
					return;
				}
				const data = await readFile(file);
				res.writeHead(200, {
					"content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
					"cache-control": "no-cache",
				});
				res.end(data);
			} catch {
				res.writeHead(404);
				res.end("not found");
			}
		},
	}), "glass-theme: /glass-assets static route");
}
