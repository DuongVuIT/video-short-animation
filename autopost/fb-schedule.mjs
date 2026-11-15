// Hẹn giờ đăng video lên Trang Facebook (Graph API), đọc kế hoạch từ một file JSON.
//   node fb-schedule.mjs <ke-hoach.json>            chạy THỬ: kiểm tra token, file, giờ đăng; KHÔNG tải lên, KHÔNG đăng
//   node fb-schedule.mjs <ke-hoach.json> --that     tải lên thật và tạo bài HẸN GIỜ (bài chưa hiện cho tới giờ hẹn;
//                                                   xoá được trong Meta Business Suite > Nội dung > Đã lên lịch)
// Mỗi mục trong "posts" có platform "facebook" và:
//   kind "video" (video ngang, bài video thường của Trang)  hoặc  kind "reel" (video dọc ≤ 90 giây)
//   file, title (chỉ video), description (đường dẫn .txt hoặc chữ), thumb (ảnh bìa, chỉ video), at ("2026-11-15T20:00:00+07:00")
// Token: FB_PAGE_TOKEN trong .env (token của Trang, không in ra).
import fs from "node:fs";
import path from "node:path";

const G = "https://graph.facebook.com/v21.0/", GV = "https://graph-video.facebook.com/v21.0/";
const [planFile, flag] = process.argv.slice(2);
const real = flag === "--that";
if (!planFile) { console.log("dùng: node fb-schedule.mjs <ke-hoach.json> [--that]"); process.exit(2); }
const env = Object.fromEntries(fs.readFileSync(new URL("./.env", import.meta.url), "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const { FB_PAGE_ID: page, FB_PAGE_TOKEN: tok } = env;
const planDir = path.dirname(path.resolve(planFile));
const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
const rel = (p) => (path.isAbsolute(p) ? p : path.resolve(planDir, p));
const text = (v) => (v && fs.existsSync(rel(v)) && v.endsWith(".txt") ? fs.readFileSync(rel(v), "utf8").trim() : v ?? "");
const j = async (r) => { const d = await r.json(); if (d.error) throw new Error(`${d.error.code}/${d.error.error_subcode ?? "-"}: ${d.error.message}`); return d; };
const form = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };

const pg = await j(await fetch(`${G}${page}?fields=name&access_token=${tok}`));
console.log(`Trang: ${pg.name.trim()} (${page}) · ${real ? "CHẠY THẬT" : "chạy thử, không đăng"}`);
const now = Date.now() / 1000;
let bad = 0;
// bài đã đăng ("done") thì bỏ qua; bài còn dở ("todo") chỉ báo, không hẹn giờ
const fbAll = plan.posts.filter((p) => p.platform === "facebook");
for (const p of fbAll) if (p.done || p.todo) console.log(`\n· bỏ qua ${path.basename(p.file)}: ${p.done ? "đã đăng (" + p.done + ")" : "chưa xong (" + p.todo + ")"}`);
const jobs = fbAll.filter((p) => !p.done && !p.todo);
for (const p of jobs) {
  const t = Math.floor(new Date(p.at).getTime() / 1000), file = rel(p.file);
  const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
  const max = p.kind === "reel" ? 29 * 86400 : 180 * 86400;
  const probs = [];
  if (!size) probs.push("không thấy file video");
  if (!(t > now + 600 && t < now + max)) probs.push(`giờ đăng phải sau ít nhất 10 phút và trong vòng ${p.kind === "reel" ? "29 ngày" : "6 tháng"}`);
  if (p.thumb && !fs.existsSync(rel(p.thumb))) probs.push("không thấy ảnh bìa");
  bad += probs.length;
  console.log(`\n• ${p.kind === "reel" ? "Reel" : "Video"} ${p.title ? `“${p.title}” ` : ""}lúc ${new Date(t * 1000).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`);
  console.log(`  file ${path.basename(file)} (${(size / 1048576).toFixed(0)} MB)${p.thumb ? `, ảnh bìa ${path.basename(p.thumb)}` : ""}`);
  console.log(`  mô tả: ${text(p.description).split("\n")[0].slice(0, 90)}…`);
  if (probs.length) { console.log("  ❌ " + probs.join("; ")); continue; }
  if (!real) { console.log("  ✓ hợp lệ"); continue; }

  const buf = fs.readFileSync(file);
  if (p.kind === "reel") {
    const st = await j(await fetch(`${G}${page}/video_reels`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ upload_phase: "start", access_token: tok }) }));
    const up = await fetch(st.upload_url, { method: "POST", headers: { Authorization: "OAuth " + tok, offset: "0", file_size: String(buf.length) }, body: buf });
    if (!up.ok) throw new Error("tải reel lên lỗi " + up.status + " " + (await up.text()).slice(0, 200));
    const fin = await j(await fetch(`${G}${page}/video_reels`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ upload_phase: "finish", video_id: st.video_id, video_state: "SCHEDULED", scheduled_publish_time: t, description: text(p.description), access_token: tok }) }));
    console.log(`  ✓ đã hẹn giờ reel, video_id ${st.video_id}`, fin.success === false ? JSON.stringify(fin) : "");
  } else {
    // tải lên từng phần (file lớn), rồi kết thúc với published=false + giờ hẹn
    let s = await j(await fetch(`${GV}${page}/videos`, { method: "POST", body: form({ upload_phase: "start", file_size: String(buf.length), access_token: tok }) }));
    const sid = s.upload_session_id, vid = s.video_id;
    let a = Number(s.start_offset), b = Number(s.end_offset);
    while (a < b) {
      const r = await j(await fetch(`${GV}${page}/videos`, { method: "POST", body: form({ upload_phase: "transfer", upload_session_id: sid, start_offset: String(a),
        video_file_chunk: new Blob([buf.subarray(a, b)]), access_token: tok }) }));
      a = Number(r.start_offset); b = Number(r.end_offset);
      process.stdout.write(`\r  tải lên ${(100 * a / buf.length).toFixed(0)}%   `);
    }
    await j(await fetch(`${GV}${page}/videos`, { method: "POST", body: form({ upload_phase: "finish", upload_session_id: sid, title: p.title ?? "",
      description: text(p.description), published: "false", scheduled_publish_time: String(t), access_token: tok }) }));
    console.log(`\n  ✓ đã hẹn giờ video, video_id ${vid}`);
    if (p.thumb) {
      const r = await j(await fetch(`${G}${vid}/thumbnails`, { method: "POST", body: form({ is_preferred: "true", source: new Blob([fs.readFileSync(rel(p.thumb))], { type: "image/jpeg" }), access_token: tok }) }));
      console.log("  ✓ ảnh bìa", r.success === false ? JSON.stringify(r) : "");
    }
  }
}
console.log(`\n${jobs.length} bài Facebook, ${bad ? bad + " lỗi" : "không lỗi"}${real ? "" : ". Chưa đăng gì: thêm --that để hẹn giờ thật."}`);
process.exit(bad ? 1 : 0);
