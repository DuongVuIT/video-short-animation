// Kiểm tra token Facebook (chỉ ĐỌC, không đăng gì). Chạy: node fb-check.mjs
import fs from "node:fs";
const env = Object.fromEntries(
  fs.readFileSync(new URL("./.env", import.meta.url), "utf8")
    .split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const { FB_PAGE_ID, FB_PAGE_TOKEN } = env;
if (!FB_PAGE_TOKEN) { console.log("❌ FB_PAGE_TOKEN trống trong .env"); process.exit(1); }
const g = async (p) => (await fetch(`https://graph.facebook.com/v21.0/${p}${p.includes("?") ? "&" : "?"}access_token=${FB_PAGE_TOKEN}`)).json();
const page = await g(`${FB_PAGE_ID}?fields=id,name,fan_count,followers_count`);
console.log("Trang:", page.error ? "❌ " + page.error.message : page);
const dbg = await g(`debug_token?input_token=${FB_PAGE_TOKEN}`);
if (dbg.data) console.log("Loại token:", dbg.data.type, "| Quyền:", (dbg.data.scopes || []).join(", "), "| Hết hạn:", dbg.data.expires_at ? new Date(dbg.data.expires_at * 1000).toISOString() : "không hết hạn");
