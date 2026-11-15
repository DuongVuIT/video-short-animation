// Runs INSIDE a Modal container (copied to /app/worker.mjs next to the Linux node_modules). Not used locally.
// One job as JSON in argv[2]; prints one JSON object per line on stdout (events + final result) for remotion_modal.py.
//   mode "render": renderMedia of job.frameRange [a, b] (inclusive) -> job.output (H.264, no audio track)
//   mode "stills": renderStill of job.frames -> `${job.output}${frame}.${ext}`
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const job = JSON.parse(process.argv[2]);
const say = (o) => process.stdout.write(JSON.stringify(o) + "\n");
const t0 = Date.now();
const sec = () => +((Date.now() - t0) / 1000).toFixed(2);

const chromiumOptions = { gl: job.gl || null, enableMultiProcessOnLinux: true };
const chromeMode = job.chromeMode || "headless-shell";
const timeoutInMilliseconds = job.timeoutMs || 300000; // SwiftShader frames can be slow; delayRender default (30 s) is too short
const onBrowserLog = (l) => {
  if (l.type === "error" || l.type === "warning") say({ ev: "browserlog", type: l.type, text: String(l.text).slice(0, 400) });
};

const browser = await openBrowser("chrome", { chromiumOptions, chromeMode, logLevel: job.logLevel || "info" });
say({ ev: "browser", t: sec() });

const composition = await selectComposition({
  serveUrl: job.serveUrl, id: job.comp, inputProps: job.inputProps || {}, puppeteerInstance: browser,
  chromiumOptions, chromeMode, timeoutInMilliseconds, onBrowserLog,
});
say({ ev: "composition", t: sec(), durationInFrames: composition.durationInFrames, fps: composition.fps });

try {
  if (job.mode === "stills") {
    const ext = job.imageFormat === "png" ? "png" : "jpeg";
    for (const frame of job.frames) {
      const s = Date.now();
      await renderStill({
        composition, serveUrl: job.serveUrl, frame, output: `${job.output}${frame}.${ext === "png" ? "png" : "jpg"}`,
        imageFormat: ext, jpegQuality: job.jpegQuality || 88, scale: job.scale, inputProps: job.inputProps || {},
        puppeteerInstance: browser, chromiumOptions, chromeMode, timeoutInMilliseconds, onBrowserLog,
      });
      say({ ev: "still", frame, s: +((Date.now() - s) / 1000).toFixed(2), t: sec() });
    }
  } else {
    const [a, b] = job.frameRange;
    let last = 0, first = null;
    await renderMedia({
      composition, serveUrl: job.serveUrl, codec: "h264", crf: job.crf ?? 16, scale: job.scale,
      frameRange: [a, b], outputLocation: job.output, muted: true, enforceAudioTrack: false,
      // same intermediate as the local CLI render (remotion.config.ts: jpeg, Remotion's default quality 80)
      imageFormat: job.imageFormat || "jpeg", jpegQuality: job.jpegQuality || 80,
      concurrency: job.concurrency, inputProps: job.inputProps || {}, puppeteerInstance: browser,
      chromiumOptions, chromeMode, timeoutInMilliseconds, onBrowserLog, overwrite: true,
      onProgress: (p) => {
        if (first === null && p.renderedFrames > 0) { first = sec(); say({ ev: "firstframe", t: first }); }
        const now = Date.now();
        if (now - last > 700 || p.renderedFrames === b - a + 1) {
          last = now;
          say({ ev: "progress", rendered: p.renderedFrames, encoded: p.encodedFrames, stage: p.stitchStage, t: sec() });
        }
      },
    });
    say({ ev: "rendered", t: sec(), firstFrameAt: first, frames: b - a + 1 });
  }
} finally {
  await browser.close({ silent: true }).catch(() => {});
}
say({ ev: "end", t: sec() });
process.exit(0);
