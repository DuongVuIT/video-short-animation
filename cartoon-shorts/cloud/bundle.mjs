// Local step of the cloud render: bundle the Remotion project once and read the composition's size/length.
// usage: node cloud/bundle.mjs <CompositionId> <outDir>   -> writes the bundle to <outDir>, prints one JSON line
// (outDir is deleted by scripts/render/render-cloud.sh when the render is done)
import fs from "node:fs";
import path from "node:path";
const [comp, outDir] = process.argv.slice(2);
if (!comp || !outDir) { console.error("usage: node cloud/bundle.mjs <CompositionId> <outDir>"); process.exit(1); }
const tmp = path.resolve(path.dirname(outDir), ".tmp");
fs.mkdirSync(tmp, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = tmp; // keep Remotion's temp files under out/
const { bundle } = await import("@remotion/bundler");
const { selectComposition } = await import("@remotion/renderer");
fs.rmSync(outDir, { recursive: true, force: true });
const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public"), outDir: path.resolve(outDir) });
const c = await selectComposition({ serveUrl, id: comp, chromiumOptions: { gl: "angle" } });
console.log(JSON.stringify({ serveUrl, id: c.id, durationInFrames: c.durationInFrames, fps: c.fps, width: c.width, height: c.height,
  bundleSeconds: (Date.now() - t0) / 1000 }));
