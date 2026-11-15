// usage: COMP=<Comp> node scripts/render/bridge-stills.mjs <outPrefix> <frame,frame,...> [scale]  (e.g. out/stills/x_)  (bundles once, GPU via ANGLE, jpeg)
// COMP=<composition id> picks another short (default BridgeShort). BRIDGE_ENTRY=src/sandboxes/<name>/index.tsx renders a sandbox copy instead of the main project entry.
import fs from "node:fs";
// Remotion bundles fill the temp folder: they go to REMOTION_TMP (default out/.remotion-tmp) and this script deletes its own
// bundle when it is done
const TMP = process.env.REMOTION_TMP || "out/.remotion-tmp";
fs.mkdirSync(TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = (await import("node:path")).resolve(TMP);
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [prefix, frames, scale = "0.5"] = process.argv.slice(2);
// null = Remotion's own Chrome Headless Shell (downloaded once); set BROWSER_EXECUTABLE to use another Chrome
const browserExecutable = process.env.BROWSER_EXECUTABLE || null;
const chromiumOptions = { gl: "angle" };
const serveUrl = await bundle({ entryPoint: path.resolve(process.env.BRIDGE_ENTRY || "src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: process.env.COMP || "BridgeShort", browserExecutable, chromiumOptions });
const onBrowserLog = (l) => { if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
// XUONG_EP=<episode> also shows every still on the Xưởng phim dashboard (scripts/xuong.py frame / progress)
const ep = process.env.XUONG_EP;
import { spawnSync } from "node:child_process";
const xuong = (...a) => { if (ep) spawnSync("python3", ["scripts/xuong.py", ...a], { stdio: "ignore" }); };
const list = frames.split(",").map(Number);
for (const [i, f] of list.entries()) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale),
    browserExecutable, chromiumOptions, timeoutInMilliseconds: 180000, onBrowserLog });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
  xuong("frame", ep, `${prefix}${f}.jpg`);
  xuong("progress", ep, "xem-thu", `${i + 1}/${list.length}`, `ảnh thử khung ${f} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
fs.rmSync(serveUrl, { recursive: true, force: true }); // the bundle copy is only needed while rendering
