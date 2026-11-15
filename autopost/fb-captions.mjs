// Gắn phụ đề .srt cho video / reel của Trang Facebook (Graph API).
//   node fb-captions.mjs <video_id> <file.vi_VN.srt>      (tên file phải kết thúc bằng .<ngôn ngữ>_<VÙNG>.srt)
// Token: FB_PAGE_TOKEN trong .env (không in ra).
import fs from "node:fs";
import path from "node:path";
const [vid, file] = process.argv.slice(2);
if (!vid || !file) { console.log("dùng: node fb-captions.mjs <video_id> <file.vi_VN.srt>"); process.exit(2); }
const env = Object.fromEntries(fs.readFileSync(new URL("./.env", import.meta.url), "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const tok = env.FB_PAGE_TOKEN, G = "https://graph.facebook.com/v21.0/";
const f = new FormData();
f.append("default_locale", "vi_VN");
f.append("captions_file", new Blob([fs.readFileSync(file)], { type: "text/plain" }), path.basename(file));
f.append("access_token", tok);
const r = await (await fetch(`${G}${vid}/captions`, { method: "POST", body: f })).json();
console.log(vid, r.error ? `LỖI ${r.error.code}: ${r.error.message}` : JSON.stringify(r));
const c = await (await fetch(`${G}${vid}/captions?access_token=${tok}`)).json();
console.log("  phụ đề hiện có:", c.error ? c.error.message : JSON.stringify((c.data ?? []).map((x) => ({ locale: x.locale, name: x.locale_name, auto: x.is_auto_generated }))));
