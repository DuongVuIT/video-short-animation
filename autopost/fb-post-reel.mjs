// Đăng 1 Reel lên Trang Facebook. Dùng: node fb-post-reel.mjs <PAGE_ID> <video.mp4> <caption.txt>
// Token: lấy từ FB_USER_TOKEN (env) hoặc từ app AutoVideo Studio; tự đổi sang Page token trong bộ nhớ, không in ra.
import fs from "node:fs";
const G = "https://graph.facebook.com/v21.0/";
const [pageId, file, capFile] = process.argv.slice(2);
const userTok = process.env.FB_USER_TOKEN || null;
const envFile = new URL("./.env", import.meta.url);
const envv = Object.fromEntries(fs.readFileSync(envFile, "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const j = async (r) => { const d = await r.json(); if (d.error) throw new Error(JSON.stringify({ code: d.error.code, sub: d.error.error_subcode, msg: d.error.message })); return d; };
const pt = { name: pageId, access_token: envv.FB_PAGE_TOKEN };
console.log("Trang:", pt.name);
const tok = pt.access_token;
const buf = fs.readFileSync(file), caption = fs.readFileSync(capFile, "utf8").trim();
const start = await j(await fetch(`${G}${pageId}/video_reels`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ upload_phase: "start", access_token: tok }) }));
console.log("Bắt đầu, video_id:", start.video_id);
const up = await fetch(start.upload_url, { method: "POST", headers: { Authorization: "OAuth " + tok, offset: "0", file_size: String(buf.length) }, body: buf });
console.log("Upload:", up.status, (await up.text()).slice(0, 200));
const fin = await j(await fetch(`${G}${pageId}/video_reels`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ upload_phase: "finish", video_id: start.video_id, video_state: "PUBLISHED", description: caption, access_token: tok }) }));
console.log("Hoàn tất:", JSON.stringify(fin));
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const s = await j(await fetch(`${G}${start.video_id}?fields=status,permalink_url&access_token=${tok}`));
  console.log("Trạng thái:", JSON.stringify(s.status), s.permalink_url || "");
  if (s.status?.video_status === "ready" || s.status?.video_status === "error") break;
}
