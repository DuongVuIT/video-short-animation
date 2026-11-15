// Final picture render on this machine with live progress on the Xưởng phim dashboard.
// usage: node scripts/render/render.mjs <CompositionId> <out.mp4> [scale=1.3333] [--ep <episode>] [--concurrency N] [--frames a-b]
// (scripts/render/render.sh calls this, then muxes the audio.) Bundle and Chrome temp files go to out/ and are deleted.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const TMP = path.resolve(process.env.REMOTION_TMP || "out/.remotion-tmp");
fs.mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { bundle } = await import("@remotion/bundler");
const { renderMedia, selectComposition } = await import("@remotion/renderer");

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const ep = opt("--ep", process.env.XUONG_EP || "");
const concurrency = opt("--concurrency", null);
const frames = opt("--frames", null);
const [comp, out, scale = "1.3333"] = args;
if (!comp || !out) { console.error("usage: node scripts/render/render.mjs <Comp> <out.mp4> [scale] [--ep e] [--concurrency n] [--frames a-b]"); process.exit(2); }
const xuong = (...a) => { if (ep) spawnSync("python3", ["scripts/xuong.py", ...a], { stdio: "ignore" }); };

const chromiumOptions = { gl: "angle" };
const t0 = Date.now();
xuong("log", ep, "render", `Đóng gói dự án (${comp})…`);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: comp, chromiumOptions });
const frameRange = frames ? frames.split("-").map(Number) : null;
const total = frameRange ? frameRange[1] - frameRange[0] + 1 : composition.durationInFrames;
xuong("render", ep, "--frame", "0", "--total", String(total), "--where", "local", "--workers", "1",
  "--msg", `${composition.width * Number(scale)}x${composition.height * Number(scale)} · ${total} khung · Mac`);
let last = 0;
await renderMedia({
  composition, serveUrl, codec: "h264", crf: 16, scale: Number(scale), outputLocation: out, chromiumOptions,
  ...(concurrency ? { concurrency: Number(concurrency) } : {}),
  ...(frameRange ? { frameRange } : {}),
  timeoutInMilliseconds: 240000,
  onProgress: ({ renderedFrames, encodedFrames }) => {
    const now = Date.now();
    if (now - last < 1500 && renderedFrames < total) return;
    last = now;
    xuong("render", ep, "--frame", String(renderedFrames), "--total", String(total), "--where", "local", "--workers", "1");
    process.stdout.write(`\rrendered ${renderedFrames}/${total}, encoded ${encodedFrames}`);
  },
});
const secs = (Date.now() - t0) / 1000;
console.log(`\npicture done in ${(secs / 60).toFixed(1)} min (${(total / secs).toFixed(2)} frames/s): ${out}`);
xuong("render", ep, "--frame", String(total), "--total", String(total), "--where", "local", "--workers", "1",
  "--msg", `xong ${total} khung trong ${(secs / 60).toFixed(1)} phút (${(total / secs).toFixed(2)} khung/giây)`);
fs.rmSync(serveUrl, { recursive: true, force: true });
