// Our own flat 2D cartoon cast (riflemen, officer, townsfolk, kid, parent) + 2D effects, drawn on a canvas.
// Construction v2 (characters.md, our own cast): superellipse heads (pointed crown 1.75 / full jaw 2.3, chin taper,
// seeded side bulge + tilt), bean torsos, single-stroke limbs with ink-dot hands, a thick-thin plum outline weighted
// away from the light, soft painted crescents, deadpan lidded eyes, no blush, no catchlights.
// Design space 600 x 1000 units (soles at y = 975); the canvas transform scales it.
export const INK = "#241726";
export const SKIN = "#ffe2c2";
const WHITE = "#ffffff";
const MOUTH = "#5a1e28";
const TONGUE = "#e86e78";
type C3 = [number, number, number];
const SH_SKIN: C3 = [0.96, 0.86, 0.84]; // measured shadow/lit ratio on skin heads
const SH_CLOTH: C3 = [0.64, 0.66, 0.74]; // torsos: lit side -> far side ~0.65
const SH_FELT: C3 = [0.62, 0.62, 0.7];

export type Build = "adult" | "stout" | "kid";
export type Outfit = {
  jacket: string; pants: string; boots: string; hat?: string | null; /** "khan" headscarf: depth of the peak over the forehead, 1 = the classic V (default), 0 = a flat soft band (the V reads as a scowl in close-up) */ khanPeak?: number; belt?: string | null; buttons?: string; rifle?: boolean;
  sash?: string; sword?: boolean; moustache?: string; skin?: string; head?: number; cap?: string; hair?: string; dress?: string;
  build?: Build;
  /** wet hair strands over the face (drowned) */ wet?: boolean;
  /** wrinkles (grandmother) */ old?: boolean;
  /** glasses frame colour (octagonal metal frames) */ glasses?: string;
  /** brow thickness multiplier (1 = default) */ brows?: number;
  /** quilted puffer jacket (stitch lines + zip, no buttons); collar = colour of the tee showing at the neck */ puffer?: boolean; collar?: string;
  /** jaw exponent override: higher = fuller, rounder lower face (default ~2.3) */ jaw?: number;
  // ---- Cây gạo (14th-century cast) ----
  /** `dress` = colour of an ankle-length skirt (váy) under the tunic. `head` = head-shape seed: overrides the caller's
   *  seed for the head contour only, so a character keeps one face whatever index the stage gives it. */
  /** cross-collar tunic (áo giao lĩnh): colour of the collar band; no buttons */ cross?: string;
  /** feminine face: lash flick at the outer eye corners, a hint of red lips (colour), narrower jaw */ fem?: boolean; lips?: string;
  /** long robe to the feet in the jacket colour, with wide sleeves (Taoist) */ robe?: boolean;
  /** long thin beard colour */ beard?: string;
  /** ill: dark under-eyes, a few loose strands of hair */ sick?: boolean;
  /** clay figurine: painted dot eyes + painted mouth (expression and blinks ignored), hairline cracks, stiff */ clay?: boolean;
  /** ghost hair: longer, ragged hem, a strand over one eye (with hat "silk") */ messy?: boolean;
  // ---- Ma da (long): acting cast ----
  /** whole-figure scale about the soles (1 = default): a small child next to adults, e.g. 0.8 */ small?: number;
  /** torso width multiplier (1 = default): a thin old man ~0.88 */ slim?: number;
};
type P2 = [number, number];

const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const mul = (c: string, m: C3) => {
  const n = parseInt(c.slice(1), 16);
  const ch = (v: number, k: number) => Math.min(255, Math.round(v * k)).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255, m[0])}${ch((n >> 8) & 255, m[1])}${ch(n & 255, m[2])}`;
};
export const shade = (c: string, k: number) => mul(c, [k, k, k]);
export const mix = (a: string, b: string, t: number) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};
/** deterministic per-character random in [0, 1) */
const rnd = (seed: number, k: number) => { const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const rotPts = (pts: P2[], a: number, cx: number, cy: number): P2[] =>
  pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
const rotAbout = (q: P2, a: number, c: P2): P2 => rotPts([q], a, c[0], c[1])[0];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** smooth curve from a through (near) k to b, as a polyline */
const curve = (a: P2, k: P2, b: P2, n = 10): P2[] => {
  const c: P2 = [2 * k[0] - (a[0] + b[0]) / 2, 2 * k[1] - (a[1] + b[1]) / 2], out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = 1 - t;
    out.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]);
  }
  return out;
};

export const RIFLEMAN: Outfit = { jacket: "#357650", pants: "#3d4440", boots: INK, hat: "shako", belt: "#f1efe6", buttons: "#d9dde0", rifle: true };
export const OFFICER: Outfit = { ...RIFLEMAN, hat: "shako_tall", buttons: "#e8c45a", sash: "#c0353a", sword: true, moustache: "#4a3020", rifle: false, belt: null, build: "stout" };
export const KID: Outfit = { jacket: "#f08a2c", pants: "#3b5b9a", boots: "#f4f1ea", hat: "cap", cap: "#e2453c", build: "kid" };
export const PARENT: Outfit = { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#5a3b2a", hat: "hair", hair: "#5a3b2a" };
export const SKINS = [SKIN, "#f5c9a0", "#ecd0b6", "#c99067"];

export const soldier = (v = 0, extra: Partial<Outfit> = {}): Outfit => {
  const o: Outfit = { ...RIFLEMAN, skin: SKINS[v % 4] };
  if (v % 4 === 1) o.moustache = "#4a3426";
  if (v % 4 === 3) o.moustache = "#2a201a";
  return { ...o, ...extra };
};

export const townsfolk = (v = 0): Outfit => {
  const coats = ["#3f6fb5", "#8c3b4a", "#5d7a3a", "#b5653f", "#2f5f6a", "#7b5ac9"];
  const o: Outfit = { jacket: coats[v % 6], pants: "#3b3f52", boots: "#4a3426", skin: SKINS[v % 4] };
  return v % 2 ? { ...o, hat: "bonnet", dress: ["#d9a441", "#c25a7a", "#5a8fc2"][v % 3] } : { ...o, hat: "tophat" };
};

export class Pen {
  g: CanvasRenderingContext2D;
  ol = 12;
  /** [angle, cx, cy] rotation about (cx, cy), optional post-translation [.., dx, dy] */
  rot: number[] | null = null;
  constructor(g: CanvasRenderingContext2D) { this.g = g; }
  P(x: number, y: number): P2 {
    if (!this.rot) return [x, y];
    const r = this.rot, a = r[0], cx = r[1], cy = r[2], dx = r.length > 3 ? r[3] : 0, dy = r.length > 4 ? r[4] : 0, c = Math.cos(a), s = Math.sin(a);
    return [cx + (x - cx) * c - (y - cy) * s + dx, cy + (x - cx) * s + (y - cy) * c + dy];
  }
  path(pts: P2[], close: boolean) {
    const g = this.g;
    g.beginPath();
    pts.forEach((p, i) => { const [x, y] = this.P(p[0], p[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    if (close) g.closePath();
  }
  /** filled shape with an ink outline; fill=null draws the outline only */
  poly(pts: P2[], fill: string | null, ol?: number) {
    const g = this.g, w = ol ?? this.ol;
    this.path(pts, true);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (w) { g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = "round"; g.stroke(); }
  }
  ell(cx: number, cy: number, rx: number, ry: number, fill: string | null, ol?: number, a0 = 0, a1 = 360, rot = 0) {
    this.poly(ellPts(cx, cy, rx, ry, a0, a1, rot), fill, ol);
  }
  /** thick round-capped limb with an ink rim (effects, rope) */
  line(pts: P2[], fill: string, w: number, ink = true) {
    const g = this.g;
    g.lineCap = "round"; g.lineJoin = "round";
    if (ink) { this.path(pts, false); g.strokeStyle = INK; g.lineWidth = w + 2 * this.ol * 0.9; g.stroke(); }
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
  }
  stroke(pts: P2[], w: number, fill = INK) {
    const g = this.g;
    g.lineCap = "round"; g.lineJoin = "round";
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
  }
  arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, w: number, fill = INK) {
    const pts: P2[] = [];
    for (let i = 0; i <= 24; i++) pts.push([cx + rx * Math.cos(rad(a0 + ((a1 - a0) * i) / 24)), cy + ry * Math.sin(rad(a0 + ((a1 - a0) * i) / 24))]);
    this.stroke(pts, w, fill);
  }
  dot(cx: number, cy: number, r: number, fill = INK) {
    const [x, y] = this.P(cx, cy);
    this.g.beginPath(); this.g.arc(x, y, r, 0, Math.PI * 2); this.g.fillStyle = fill; this.g.fill();
  }
  /** draw with a closed shape as clip */
  clip(pts: P2[], fn: () => void) { const g = this.g; g.save(); this.path(pts, true); g.clip(); fn(); g.restore(); }
  /** flat fill + soft crescent on the side away from the light (light = canvas angle the light comes FROM).
   *  Radial ramp centred `shift` R toward the light: flat out to ~0.6 R on the far side, full shadow by ~0.8 R. */
  shadedFill(pts: P2[], base: string, shadow: string, light: number, R: number, shift = 0.45, r0 = 1.05, r1 = 1.25) {
    const g = this.g, n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const [gx, gy] = this.P(cx + Math.cos(light) * shift * R, cy + Math.sin(light) * shift * R);
    const gr = g.createRadialGradient(gx, gy, 0, gx, gy, r1 * R);
    gr.addColorStop(0, base); gr.addColorStop(r0 / r1, base); gr.addColorStop(1, shadow);
    this.path(pts, true); g.fillStyle = gr; g.fill();
  }
  /** broad gradient across a shape along the light: lit edge = base, far edge = shadow (torsos, coats) */
  gradFill(pts: P2[], base: string, shadow: string, light: number, flat = 0.22) {
    const g = this.g, dx = Math.cos(light), dy = Math.sin(light), n = pts.length;
    let cx = 0, cy = 0, lo = Infinity, hi = -Infinity;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; const d = x * dx + y * dy; lo = Math.min(lo, d); hi = Math.max(hi, d); }
    const dc = cx * dx + cy * dy;
    const [ax, ay] = this.P(cx + dx * (hi - dc), cy + dy * (hi - dc)), [bx, by] = this.P(cx + dx * (lo - dc), cy + dy * (lo - dc));
    const gr = g.createLinearGradient(ax, ay, bx, by);
    gr.addColorStop(0, base); gr.addColorStop(flat, base); gr.addColorStop(1, shadow);
    this.path(pts, true); g.fillStyle = gr; g.fill();
  }
  /** thick-thin ink ring: w(θ) = w0 (1 + k cos(θ − thick)), θ from the contour centroid (canvas angles) */
  inkRing(pts: P2[], w0: number, thick: number, k = 0.45, col = INK) {
    const n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const out: P2[] = [], inn: P2[] = [];
    pts.forEach((q, i) => {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      let nx = b[1] - a[1], ny = a[0] - b[0]; // outward normal for clockwise-on-screen contours
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const h = 0.5 * w0 * (1 + k * Math.cos(Math.atan2(q[1] - cy, q[0] - cx) - thick));
      out.push([q[0] + nx * h, q[1] + ny * h]); inn.push([q[0] - nx * h, q[1] - ny * h]);
    });
    const g = this.g;
    const trace = (r: P2[]) => { r.forEach(([x0, y0], i) => { const [x, y] = this.P(x0, y0); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); };
    g.beginPath(); trace(out); trace(inn.reverse());
    g.fillStyle = col; g.fill("evenodd");
  }
  /** flat strap with a thin ink rim (cross belts, sash, rifle, handles) */
  band(pts: P2[], fill: string, w: number, rim: number, cap: CanvasLineCap = "butt") {
    const g = this.g; g.lineCap = cap; g.lineJoin = "round";
    this.path(pts, false); g.strokeStyle = INK; g.lineWidth = w + 2 * rim; g.stroke();
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
    g.lineCap = "round";
  }
}

const ellPts = (cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = 360, rot = 0, n = 48): P2[] => {
  const r = rad(rot), pts: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / n), x = rx * Math.cos(a), y = ry * Math.sin(a);
    pts.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return pts;
};

const rrect = (x0: number, y0: number, x1: number, y1: number, r: number, n = 8): P2[] => {
  const pts: P2[] = [];
  for (const [cx, cy, a] of [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]])
    for (let i = 0; i <= n; i++) pts.push([cx + r * Math.cos(rad(a + (90 * i) / n)), cy + r * Math.sin(rad(a + (90 * i) / n))]);
  return pts;
};

/** tapered stroke, thick end at a: brows, moustache halves */
const taper = (p: Pen, a: P2, b: P2, wa: number, wb: number, col = INK) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  p.poly([[a[0] + nx * wa / 2, a[1] + ny * wa / 2], [b[0] + nx * wb / 2, b[1] + ny * wb / 2],
    [b[0] - nx * wb / 2, b[1] - ny * wb / 2], [a[0] - nx * wa / 2, a[1] - ny * wa / 2]], col, 0);
  p.dot(a[0], a[1], wa / 2, col); p.dot(b[0], b[1], wb / 2, col);
};

// ---------------- contours ----------------
export type Blob = { a: number; b: number; nTop: number; nBot: number; egg: number; asym: number; rot: number; noise: number; seed: number };

/** superellipse "bean": separate crown / jaw exponents, egg taper (neg = narrower chin), one-side bulge, soft noise.
 *  Points run right -> down -> left -> up (clockwise on screen). */
export const blobPts = (cx: number, cy: number, B: Blob, n = 72): P2[] => {
  const ph = [rnd(B.seed, 11), rnd(B.seed, 12), rnd(B.seed, 13)].map((v) => v * Math.PI * 2);
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), e = 2 / (s < 0 ? B.nTop : B.nBot);
    let X = Math.sign(c) * Math.abs(c) ** e;
    const Y = Math.sign(s) * Math.abs(s) ** e;
    X *= (1 + B.egg * Y) * (1 + B.asym * Math.sign(X));
    const r = 1 + B.noise * (Math.cos(2 * t + ph[0]) + 0.7 * Math.cos(3 * t + ph[1]) + 0.5 * Math.cos(4 * t + ph[2]));
    const x = B.a * X * r, y = B.b * Y * r;
    pts.push([cx + x * Math.cos(B.rot) - y * Math.sin(B.rot), cy + x * Math.sin(B.rot) + y * Math.cos(B.rot)]);
  }
  return pts;
};

/** measured head: H/W 0.94, slightly pointed crown (1.75), fuller jaw (2.3), chin taper -0.12, 8 % bulge to the facing side */
export const headBlob = (seed: number, a = 118, facing = 0): Blob => ({
  a, b: a * (0.94 + 0.08 * (rnd(seed, 1) - 0.5)),
  nTop: 1.75 + 0.3 * (rnd(seed, 2) - 0.5), nBot: 2.3 + 0.3 * (rnd(seed, 3) - 0.5),
  egg: -0.12 + 0.06 * (rnd(seed, 4) - 0.5),
  asym: (0.06 + 0.04 * rnd(seed, 5)) * (facing || (rnd(seed, 6) < 0.5 ? -1 : 1)),
  rot: rad(8 * (rnd(seed, 7) - 0.5)), noise: 0.008, seed,
});

/** thickest outline direction: away from the light, pulled toward the ground (64 deg measured for upper-left light) */
export const thickAngle = (light: number) => Math.atan2(-Math.sin(light) + 0.8, -Math.cos(light));
const DEF_LIGHT = rad(-120);

// ---------------- faces ----------------
export type Expr = "neutral" | "stern" | "grin" | "laugh" | "whistle" | "nervous" | "shock" | "relief" | "relief_open" | "dazed"
  | "pained" | "smile" | "smile_closed" | "lick" | "sad" | "ghost" | "ghost_closed" | "call" | "terror" | "tired" | "scared" | "fierce" | "sly" | "worried"
  | "lovely" | "plead" | "sick";
type EyeK = "dot" | "small" | "lid" | "slit" | "happy" | "dash" | "squeeze" | "shock" | "shockHalf" | "spiral" | "hollow";
type MouthK = "dash" | "frown" | "smirk" | "smile" | "smileWide" | "grin" | "laugh" | "o" | "O" | "wave" | "teeth" | "lick";
/** eyes [back, front], brows [inner, outer] offsets in u (+ = down), mouth kind */
const FACE: Record<Expr, { eye: [EyeK, EyeK]; brow: [number, number]; mouth: MouthK }> = {
  neutral: { eye: ["lid", "lid"], brow: [0, -1], mouth: "dash" },
  stern: { eye: ["lid", "lid"], brow: [3, -2], mouth: "frown" },
  grin: { eye: ["happy", "happy"], brow: [-3, -3], mouth: "grin" },
  laugh: { eye: ["squeeze", "squeeze"], brow: [-4, -4], mouth: "laugh" },
  whistle: { eye: ["dash", "dash"], brow: [-2, -4], mouth: "o" },
  nervous: { eye: ["small", "small"], brow: [-3, 2], mouth: "wave" },
  shock: { eye: ["shock", "shock"], brow: [-7, -6], mouth: "O" },
  relief: { eye: ["happy", "happy"], brow: [-2, 1], mouth: "smileWide" },
  relief_open: { eye: ["happy", "happy"], brow: [-2, 1], mouth: "grin" },
  dazed: { eye: ["spiral", "spiral"], brow: [-3, 2], mouth: "wave" },
  pained: { eye: ["squeeze", "lid"], brow: [-3, 2], mouth: "teeth" },
  smile: { eye: ["dot", "dot"], brow: [0, -1], mouth: "smirk" },
  smile_closed: { eye: ["happy", "happy"], brow: [0, -1], mouth: "smile" },
  lick: { eye: ["dot", "dot"], brow: [0, -1], mouth: "lick" },
  sad: { eye: ["dot", "dot"], brow: [-5, 3], mouth: "frown" },
  ghost: { eye: ["hollow", "hollow"], brow: [-1, 1], mouth: "o" },
  ghost_closed: { eye: ["dash", "dash"], brow: [-1, 1], mouth: "dash" },
  call: { eye: ["lid", "lid"], brow: [-3, -2], mouth: "O" },
  terror: { eye: ["shock", "shock"], brow: [-7, -5], mouth: "teeth" },
  tired: { eye: ["lid", "lid"], brow: [-3, 2], mouth: "o" },
  scared: { eye: ["small", "small"], brow: [-5, 3], mouth: "wave" },
  fierce: { eye: ["dot", "dot"], brow: [5, -3], mouth: "teeth" },
  sly: { eye: ["lid", "lid"], brow: [5, -3], mouth: "grin" },
  worried: { eye: ["dot", "dot"], brow: [-6, 3], mouth: "teeth" },
  lovely: { eye: ["lid", "lid"], brow: [-1, 0], mouth: "smile" },
  plead: { eye: ["hollow", "hollow"], brow: [-7, 3], mouth: "o" },
  sick: { eye: ["slit", "slit"], brow: [-2, 1], mouth: "dash" },
};
const halfLid = (k: EyeK): EyeK => (k === "dot" || k === "small" ? "lid" : k === "lid" ? "slit" : k === "shock" ? "shockHalf" : k);
const eyeKind = (k: EyeK, lid: number): EyeK =>
  k === "hollow" ? k : lid >= 1 && k !== "happy" && k !== "squeeze" && k !== "spiral" ? "dash" : lid > 0 ? halfLid(k) : k;
const lidOf = (b: boolean | number | undefined) => (b === true ? 1 : Number(b) || 0);

const eye = (p: Pen, kind: EyeK, x: number, ey: number, u: number, side: number, look: number, skin: string, gy = 0) => {
  const lx = x + look * 3 * u, lw = 3.8 * u;
  if (gy) { // opt-in vertical gaze: the pupil slides up / down (lidded eyes: under the lid line)
    const dy = gy * 2.6 * u;
    if (kind === "dot") { p.ell(lx, ey + dy, 3.8 * u, 5.5 * u, INK, 0); return; }
    if (kind === "small") { p.ell(lx, ey + dy, 3 * u, 4.4 * u, INK, 0); return; }
    if (kind === "lid" || kind === "slit") {
      const y0 = kind === "lid" ? ey - u : ey, ry = kind === "lid" ? 6 * u : 2.6 * u;
      p.clip([[x - 12 * u, y0], [x + 12 * u, y0], [x + 12 * u, y0 + 12 * u], [x - 12 * u, y0 + 12 * u]], () => p.ell(lx, y0 + dy * 0.8, 7 * u, ry + Math.max(0, dy * 0.5), INK, 0));
      p.stroke([[x - 9 * u, y0], [x + 9 * u, y0]], lw);
      return;
    }
    if (kind === "shock" || kind === "shockHalf") {
      p.ell(x, ey, 11 * u, 11 * u, WHITE, 2.6 * u); p.dot(lx - side * 1.5 * u, ey + 1.5 * u + gy * 4 * u, 3 * u);
      if (kind === "shockHalf") { p.ell(x, ey, 11 * u, 11 * u, skin, 0, 180, 360); p.stroke([[x - 11 * u, ey], [x + 11 * u, ey]], 2.6 * u); }
      return;
    }
  }
  switch (kind) {
    case "dot": p.ell(lx, ey, 3.8 * u, 5.5 * u, INK, 0); break;
    case "small": p.ell(lx, ey, 3 * u, 4.4 * u, INK, 0); break;
    case "lid": p.ell(lx, ey - u, 7 * u, 6 * u, INK, 0, 0, 180); p.stroke([[x - 9 * u, ey - u], [x + 9 * u, ey - u]], lw); break;
    case "slit": p.ell(lx, ey, 7 * u, 2.6 * u, INK, 0, 0, 180); p.stroke([[x - 9 * u, ey], [x + 9 * u, ey]], lw); break;
    case "happy": p.arc(x, ey + 3 * u, 8 * u, 6 * u, 200, 340, lw); break;
    case "dash": p.stroke([[x - 8.5 * u, ey], [x + 8.5 * u, ey]], lw); break;
    case "hollow": p.ell(x, ey + u, 8.5 * u, 10.5 * u, "#141018", 0); p.ell(x, ey + u, 8.5 * u, 10.5 * u, null, 1.6 * u); break;
    case "squeeze": p.stroke([[x + 6 * u * side, ey - 5 * u], [x - 6 * u * side, ey], [x + 6 * u * side, ey + 5 * u]], lw); break;
    case "shock": case "shockHalf":
      p.ell(x, ey, 11 * u, 11 * u, WHITE, 2.6 * u); p.dot(lx - side * 1.5 * u, ey + 1.5 * u, 3 * u);
      if (kind === "shockHalf") { p.ell(x, ey, 11 * u, 11 * u, skin, 0, 180, 360); p.stroke([[x - 11 * u, ey], [x + 11 * u, ey]], 2.6 * u); }
      break;
    default: {
      const s: P2[] = [];
      for (let t = 1; t < 15; t++) s.push([x + Math.cos(t * 0.9) * t * 0.55 * u, ey + Math.sin(t * 0.9) * t * 0.55 * u]);
      p.stroke(s, 2.4 * u);
    }
  }
};

/** open "D" mouth with a white teeth band (+ tongue) */
const dmouth = (p: Pen, mx: number, y: number, rx: number, ry: number, u: number, tongue = false) => {
  p.ell(mx, y, rx, ry, MOUTH, 0, 0, 180);
  p.clip([[mx - rx, y], [mx + rx, y], [mx + rx, y + 3 * u], [mx - rx, y + 3 * u]], () => p.ell(mx, y, rx, ry, WHITE, 0, 0, 180));
  if (tongue) p.ell(mx + 2 * u, y + 0.62 * ry, 0.4 * rx, 0.28 * ry, TONGUE, 0);
  p.ell(mx, y, rx, ry, null, 3 * u, 0, 180);
};

/** the closed mouths as centre lines (for the talking mouth that opens out of them) */
const mouthLine = (kind: MouthK, mx: number, my: number, u: number, k: number): P2[] | null => {
  const arcP = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): P2[] => {
    const pts: P2[] = [];
    for (let i = 0; i <= 16; i++) pts.push([cx + rx * Math.cos(rad(a0 + ((a1 - a0) * i) / 16)), cy + ry * Math.sin(rad(a0 + ((a1 - a0) * i) / 16))]);
    return pts[0][0] > pts[16][0] ? pts.reverse() : pts;
  };
  switch (kind) {
    case "dash": { const pts: P2[] = []; for (let i = 0; i <= 16; i++) pts.push([mx - 5.5 * u * k + (11 * u * k * i) / 16, my - (0.8 * u * i) / 16]); return pts; }
    case "frown": return arcP(mx, my + 3 * u, 6.5 * u * k, 3.5 * u, 200, 340);
    case "smirk": return arcP(mx + u, my - 3 * u, 7 * u * k, 4 * u, 10, 150);
    case "smile": case "lick": return arcP(mx, my - 3 * u, 8 * u * k, 4.5 * u, 20, 160);
    case "smileWide": return arcP(mx, my - 4 * u, 11 * u * k, 6 * u, 15, 165);
    case "wave": { const s: P2[] = []; for (let i = 0; i <= 12; i++) s.push([mx - 9 * u * k + i * 1.5 * u * k, my + 1.5 * u * Math.sin(i * 1.3)]); return s; }
    default: return null;
  }
};
/** talking mouth: the expression's own mouth opened by t in 0..1 (t -> 0 gives the closed mouth back, so it can flap) */
const talkMouth = (p: Pen, kind: MouthK, mx: number, my: number, u: number, k: number, t: number) => {
  const line = mouthLine(kind, mx, my, u, k);
  if (line) {
    const n = line.length - 1, xc = (line[0][0] + line[n][0]) / 2, nar = kind === "frown" ? 1 : 1 - 0.1 * t, w0 = kind === "wave" ? 3 * u : 4 * u;
    const down = kind === "frown" ? 7.5 : kind === "wave" ? 8 : 9.5, up = kind === "frown" ? 3 : 1.2, yc = (line[0][1] + line[n][1]) / 2;
    const top: P2[] = [], bot: P2[] = [];
    line.forEach(([x, y0], i) => {
      const s = (2 * i) / n - 1, prof = Math.max(0, 1 - s * s) ** 0.55, X = xc + (x - xc) * nar, y = kind === "wave" ? yc + (y0 - yc) * (1 - 0.65 * t) : y0;
      top.push([X, y - up * u * t * prof]); bot.push([X, y + down * u * t * prof]);
    });
    const pts = [...top, ...bot.reverse()];
    p.poly(pts, MOUTH, 0);
    if (t > 0.35) p.clip(pts, () => p.ell(xc + 1 * u, line[n >> 1][1] + (down + 1.5) * u * t, 5.5 * u * k, 4.2 * u * t, TONGUE, 0));
    p.poly(pts, null, lerp(w0, 2.8 * u, Math.min(1, t * 2.5)));
    if (kind === "lick") p.ell(mx + 6 * u * k, my + 3 * u, 3.6 * u, 4.6 * u, TONGUE, 2.4 * u);
    return;
  }
  switch (kind) {
    case "grin": dmouth(p, mx, my - u, 12 * u * k, (8 + 5 * t) * u, u, t > 0.5); break;
    case "laugh": dmouth(p, mx, my, 16 * u * k, (11 + 4 * t) * u, u, true); break;
    case "o": p.ell(mx + 4 * u * (1 - 0.6 * t), my + 1.5 * u * t, (3.5 + 2.6 * t) * u, (4 + 5 * t) * u, MOUTH, 2.8 * u);
      if (t > 0.5) p.clip(ellPts(mx + 4 * u * (1 - 0.6 * t), my + 1.5 * u * t, (3.5 + 2.6 * t) * u, (4 + 5 * t) * u), () => p.ell(mx + 3 * u, my + 9 * u * t, 4.5 * u, 3.4 * u * t, TONGUE, 0));
      break;
    case "O": { const rx = (9 + 1.2 * t) * u * k, ry = (11 + 3.6 * t) * u, cy = my + 2 * u + 1.6 * u * t;
      p.ell(mx, cy, rx, ry, MOUTH, 3.2 * u);
      p.clip(ellPts(mx, cy, rx - 1.4 * u, ry - 1.4 * u), () => p.ell(mx + u, cy + ry * 0.78, rx * 0.62, ry * (0.3 + 0.12 * t), TONGUE, 0));
      break; }
    case "teeth": { // clenched teeth part: a dark gap opens between the rows
      const h = (4 + 5.4 * t) * u, gap = 3.3 * u * t;
      const box: P2[] = [[mx - 12 * u * k, my - h], [mx + 12 * u * k, my - h], [mx + 11 * u * k, my + h], [mx - 11 * u * k, my + h]];
      p.poly(box, WHITE, 0);
      for (const j of [-1, 0, 1]) p.stroke([[mx + j * 6 * u * k, my - h], [mx + j * 6 * u * k, my + h]], 1.5 * u);
      p.clip(box, () => p.poly(rrect(mx - 10.5 * u * k, my - gap, mx + 10.5 * u * k, my + gap + 0.01, Math.min(gap, 3 * u) + 0.01, 4), MOUTH, 1.2 * u * Math.min(1, t * 3)));
      p.poly(box, null, 3 * u);
      break; }
    default: mouth(p, kind, mx, my, u, k);
  }
};

const mouth = (p: Pen, kind: MouthK, mx: number, my: number, u: number, k = 1, talk = 0) => {
  const mw = 4 * u;
  if (talk > 0) { talkMouth(p, kind, mx, my, u, k, clamp(talk, 0, 1)); return; }
  switch (kind) {
    case "dash": p.stroke([[mx - 5.5 * u * k, my], [mx + 5.5 * u * k, my - 0.8 * u]], mw); break;
    case "frown": p.arc(mx, my + 3 * u, 6.5 * u * k, 3.5 * u, 200, 340, mw); break;
    case "smirk": p.arc(mx + u, my - 3 * u, 7 * u * k, 4 * u, 10, 150, mw); break;
    case "smile": p.arc(mx, my - 3 * u, 8 * u * k, 4.5 * u, 20, 160, mw); break;
    case "smileWide": p.arc(mx, my - 4 * u, 11 * u * k, 6 * u, 15, 165, mw); break;
    case "grin": dmouth(p, mx, my - u, 12 * u * k, 8 * u, u); break;
    case "laugh": dmouth(p, mx, my, 16 * u * k, 11 * u, u, true); break;
    case "o": p.ell(mx + 4 * u, my, 3.5 * u, 4 * u, MOUTH, 2.8 * u); break;
    case "O": p.ell(mx, my + 2 * u, 9 * u * k, 11 * u, MOUTH, 3.2 * u); break;
    case "wave": { const s: P2[] = []; for (let i = 0; i <= 12; i++) s.push([mx - 9 * u * k + i * 1.5 * u * k, my + 1.5 * u * Math.sin(i * 1.3)]); p.stroke(s, 3 * u); break; }
    case "teeth":
      p.poly([[mx - 12 * u * k, my - 4 * u], [mx + 12 * u * k, my - 4 * u], [mx + 11 * u * k, my + 4 * u], [mx - 11 * u * k, my + 4 * u]], WHITE, 3 * u);
      for (const j of [-1, 0, 1]) p.stroke([[mx + j * 6 * u * k, my - 4 * u], [mx + j * 6 * u * k, my + 4 * u]], 1.5 * u);
      break;
    case "lick": p.arc(mx, my - 3 * u, 8 * u * k, 4.5 * u, 20, 160, mw); p.ell(mx + 6 * u * k, my + 3 * u, 3.6 * u, 4.6 * u, TONGUE, 2.4 * u); break;
  }
};

/** face v2 (front / 3-4). u = 1 % of the head path width W. Eyes 26u apart on the centre line, brows 20u up, mouth 20u
 *  down, everything slid toward the facing side. No blush, no catchlights. */
const faceFront = (p: Pen, cx: number, cy: number, W: number, expr: Expr, facing: number, look: number, lid: number, brim: boolean,
  skin: string, moustache?: string, stout = false, glasses?: string, brows = 1, o?: Outfit, talk = 0, gy = 0) => {
  const u = W / 100, F = FACE[expr], fx = cx + 7 * u * facing;
  if (o?.clay) { clayFace(p, fx, cy, u, facing); return; }
  const ex = (F.eye[0] === "shock" ? 12 : 13) * u, ey = cy;
  if (o?.sick) for (const side of [-1, 1]) underEye(p, fx + side * ex + look * 2 * u, ey, u);
  for (const side of [-1, 1]) {
    const x = fx + side * ex;
    const kind = eyeKind(F.eye[(facing ? side === facing : side > 0) ? 1 : 0], lid);
    eye(p, kind, x, ey, u, side, look, skin, gy);
    if (o?.fem && (kind === "lid" || kind === "slit" || kind === "dot" || kind === "small" || kind === "dash" || kind === "happy"))
      lash(p, x, ey, u, side, kind);
    const [dI, dO] = F.brow, by = ey - (brim ? 17 : 20) * u + (glasses ? 2.5 * u : 0);
    if (kind === "shock" || kind === "shockHalf") p.arc(x, by - 6 * u, 9 * u, 3 * u, 200, 340, 4 * u * brows);
    else taper(p, [x - side * 8.5 * u, by + dI * u], [x + side * 8.5 * u, by + dO * u], 5 * u * brows, 2.5 * u * brows);
  }
  if (glasses) { // big octagonal metal frames: ink-edged metal, faint lens tint + glint, bridge, temples to the head edge
    const gw = 13 * u, gh = 12.5 * u, gx = 16.5 * u, gy = ey + 2 * u, k = 0.42;
    const oct = (x: number): P2[] => [[x - gw * (1 - k), gy - gh], [x + gw * (1 - k), gy - gh], [x + gw, gy - gh * (1 - k)], [x + gw, gy + gh * (1 - k)],
      [x + gw * (1 - k), gy + gh], [x - gw * (1 - k), gy + gh], [x - gw, gy + gh * (1 - k)], [x - gw, gy - gh * (1 - k)]];
    const metal = (pts: P2[], close = false) => { const q = close ? [...pts, pts[0], pts[1]] : pts; p.stroke(q, 3.6 * u); p.stroke(q, 1.9 * u, glasses); };
    for (const side of [-1, 1]) {
      const x = fx + side * gx, o8 = oct(x);
      p.poly(o8, "rgba(235,245,255,0.16)", 0);
      p.stroke([[x - 7 * u, gy - 2 * u], [x - 3 * u, gy - 7 * u]], 1.5 * u, "rgba(255,255,255,0.75)");
      metal(o8, true);
      metal([[x + side * gw, gy - gh * 0.55], [cx + side * (47 - Math.max(0, side * facing) * 6) * u, gy - 5 * u]]);
    }
    const bY = gy - gh * (1 - k);
    metal([[fx - gx + gw, bY], [fx, bY - 2 * u], [fx + gx - gw, bY]]);
  }
  const mx = cx + 8 * u * facing, my = cy + 20 * u;
  if (o?.lips && !(talk > 0) && (F.mouth === "smile" || F.mouth === "dash" || F.mouth === "smirk")) femMouth(p, F.mouth, mx, my, u, o.lips);
  else mouth(p, F.mouth, mx, my, u, 1, talk);
  if (moustache) for (const s of [-1, 1])
    taper(p, [mx + s * 1.5 * u, cy + 12.5 * u], [mx + s * (stout ? 19 : 15) * u, cy + (stout ? 10.5 : 15) * u], stout ? 5.5 * u : 4.5 * u, 1.6 * u, moustache);
  if (expr === "nervous") p.ell(cx + 40 * u * (facing || 1), cy - 22 * u, 3 * u, 5 * u, "#9fd4ff", 2 * u);
};

/** dark hollow under an eye (sick): a soft filled crescent */
const underEye = (p: Pen, x: number, ey: number, u: number) => {
  const outer = ellPts(x, ey + 2.5 * u, 8.5 * u, 6.5 * u, 15, 165, 0, 16), inner = ellPts(x, ey + 2.5 * u, 7 * u, 3 * u, 165, 15, 0, 16);
  p.poly([...outer, ...inner], "rgba(105,70,105,0.3)", 0);
};
/** a small lash flick at the outer corner of a (lidded) eye: feminine faces */
const lash = (p: Pen, x: number, ey: number, u: number, side: number, kind: EyeK) => {
  const y0 = kind === "lid" ? ey - u : kind === "happy" ? ey + 0.5 * u : ey - (kind === "dot" ? 2 : 1) * u;
  const x0 = x + side * (kind === "dot" || kind === "small" ? 3.4 : 8.5) * u;
  p.stroke(curve([x0, y0], [x0 + side * 2.6 * u, y0 - 1.6 * u], [x0 + side * 4.6 * u, y0 - 4.4 * u], 5), 2.2 * u);
};
/** closed feminine mouth: a soft ink line with a small tinted lower lip under it */
const femMouth = (p: Pen, kind: MouthK, mx: number, my: number, u: number, lips: string, k = 1) => {
  if (kind === "smile") {
    p.ell(mx, my + 0.2 * u, 4.4 * u * k, 3.2 * u, lips, 0, 0, 180);
    p.arc(mx, my - 3 * u, 6.4 * u * k, 3.4 * u, 22, 158, 2.9 * u);
  } else if (kind === "smirk") {
    p.ell(mx + u, my - 1 * u, 4.2 * u * k, 2.6 * u, lips, 0, 0, 180);
    p.arc(mx + u, my - 3 * u, 6 * u * k, 3.4 * u, 12, 150, 3.2 * u);
  } else {
    p.ell(mx, my + 0.9 * u, 4.2 * u * k, 3 * u, lips, 0, 0, 180);
    p.stroke([[mx - 5 * u * k, my], [mx + 5 * u * k, my - 0.5 * u]], 2.9 * u);
  }
};
/** painted clay face: round dot eyes, thin painted brows, a small red-brown painted mouth (never blinks) */
const CLAY_PAINT = "#2a1712", CLAY_RED = "#8e2a1c", CLAY_CRACK = "rgba(58,24,14,0.85)";
const clayFace = (p: Pen, fx: number, cy: number, u: number, facing: number, side = false) => {
  const eyes = side ? [fx + 27 * u - 7 * u * facing] : [fx - 13 * u, fx + 13 * u];
  for (const x of eyes) {
    p.ell(x, cy + u, 3.6 * u, 3.6 * u, CLAY_PAINT, 0);
    p.arc(x, cy - 10 * u, 7 * u, 2.6 * u, 200, 340, 1.7 * u, CLAY_PAINT);
  }
  const mx = side ? fx + 31 * u : fx + 1 * u * facing, my = cy + 20 * u;
  p.poly([[mx - 5 * u, my - 0.5 * u], [mx, my - 2.2 * u], [mx + 5 * u, my - 0.5 * u], [mx + 2.5 * u, my + 2.2 * u], [mx - 2.5 * u, my + 2.2 * u]], CLAY_RED, 0);
};
/** hairline cracks: a few jagged thin lines from the given start points (clay figurine) */
const cracks = (p: Pen, starts: [P2, number, number][], u: number, seed: number) => {
  starts.forEach(([a, ang, len], i) => {
    const pts: P2[] = [a];
    let [x, y] = a, d = ang;
    for (let k = 0; k < 5; k++) {
      d += (rnd(seed, 70 + i * 7 + k) - 0.5) * 1.1;
      x += Math.cos(d) * len / 5; y += Math.sin(d) * len / 5;
      pts.push([x, y]);
      if (k === 2) { // a short branch
        const b = d + (rnd(seed, 90 + i) < 0.5 ? -0.9 : 0.9);
        p.stroke([[x, y], [x + Math.cos(b) * len * 0.22, y + Math.sin(b) * len * 0.22]], 0.9 * u, CLAY_CRACK);
      }
    }
    p.stroke(pts, 1.2 * u, CLAY_CRACK);
  });
};

/** profile face (facing screen-right): one eye, brow, nose tick, mouth near the front edge; no skin bump nose, no ear */
const faceSide = (p: Pen, hx: number, hy: number, W: number, expr: Expr, lid: number, brim: boolean, skin: string, moustache?: string, stout = false, o?: Outfit, talk = 0) => {
  const u = W / 100, F = FACE[expr], ex = hx + 27 * u, ey = hy;
  if (o?.clay) {
    clayFace(p, hx, hy, u, 0, true);
    p.stroke([[hx + 44 * u, hy + 4 * u], [hx + 47.5 * u, hy + 9 * u], [hx + 43 * u, hy + 10 * u]], 3 * u);
    return;
  }
  const kind = eyeKind(F.eye[1], lid);
  if (o?.sick) underEye(p, ex + 1.5 * u, ey, u);
  eye(p, kind, ex, ey, u, 1, 0.6, skin);
  if (o?.fem && kind !== "hollow" && kind !== "shock" && kind !== "shockHalf") lash(p, ex - 0.4 * u, ey, u, -1, kind);
  const by = ey - (brim ? 17 : 20) * u, [dI, dO] = F.brow;
  if (kind === "shock" || kind === "shockHalf") p.arc(ex, by - 6 * u, 9 * u, 3 * u, 200, 340, 4 * u);
  else taper(p, [ex + 8 * u, by + dI * u], [ex - 7 * u, by - u + dO * u], 5 * u, 2.5 * u);
  p.stroke([[hx + 44 * u, hy + 4 * u], [hx + 47.5 * u, hy + 9 * u], [hx + 43 * u, hy + 10 * u]], 3 * u);
  if (o?.lips && !(talk > 0) && (F.mouth === "smile" || F.mouth === "dash" || F.mouth === "smirk")) femMouth(p, F.mouth, hx + 33 * u, hy + 21 * u, u, o.lips, 0.62);
  else mouth(p, F.mouth, hx + 33 * u, hy + 21 * u, u, 0.62, talk);
  if (moustache) taper(p, [hx + 41 * u, hy + 13.5 * u], [hx + 25 * u, hy + (stout ? 11.5 : 16) * u], stout ? 5.5 * u : 4.5 * u, 1.6 * u, moustache);
  if (expr === "nervous") p.ell(hx - 30 * u, hy - 24 * u, 3 * u, 5 * u, "#9fd4ff", 2 * u);
};

// ---------------- hats ----------------
const BONNET = "#e9cf8f", BONNET_BRIM = "#d6b46a";
/** hats that sit on the crown without a brim over the brows (brows at the normal height) */
const NOBRIM = new Set(["hair", "bonnet", "cap", "long", "khan", "chom", "capback", "bun", "buns", "silk", "khandong", "daocap", "pigtails"]);
const brimOf = (o: Outfit) => !!o.hat && !NOBRIM.has(o.hat);
const sstep = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
/** the head contour where keep(x, y), as one contiguous run (scaled out from the head centre by sc), closed by
 *  close(lastPoint, firstPoint) (the hairline / hat edge, from the run's end back to its start) */
const capPts = (hp: P2[], cx: number, hc: number, keep: (x: number, y: number) => boolean, close: (a: P2, b: P2) => P2[], sc = 1.03): P2[] | null => {
  const n = hp.length;
  const startIdx = Math.max(0, hp.findIndex(([x, y], i) => keep(x, y) && !keep(hp[(i + n - 1) % n][0], hp[(i + n - 1) % n][1])));
  const arc = [...hp.slice(startIdx), ...hp.slice(0, startIdx)].filter(([x, y]) => keep(x, y)).map(([x, y]) => [cx + (x - cx) * sc, hc + (y - hc) * sc] as P2);
  if (arc.length < 3) return null;
  return [...arc, ...close(arc[arc.length - 1], arc[0])];
};
/** samples of y = f(x) from a.x to b.x (exclusive of both ends) */
const along = (a: P2, b: P2, f: (x: number) => number, n = 14): P2[] => {
  const out: P2[] = [];
  for (let i = 1; i < n; i++) { const x = a[0] + ((b[0] - a[0]) * i) / n; out.push([x, f(x)]); }
  return out;
};
/** front / side hairline of the period hair styles (bun = combed back into a topknot, buns = the maid's two buns,
 *  silk = long hair parted in the middle); y of the hairline at x */
const hairEdge = (o: Outfit, H: Blob, cx: number, hc: number, side: boolean, facing: number, down = false) => {
  const HH = 2 * H.b, crown = hc - H.b, sh = 0.03 * H.a * facing;
  if (side) {
    // profile: from the top of the forehead, back behind the ear, down to the nape (down = head bowed onto the arms:
    // the hair covers all but the face, which is turned into the arms)
    const [y0, y1, xa, xb] = down ? [0.25, 1.2, 0.85, 0.35] : o.hat === "silk" ? [-0.5, 0.95, 0.45, -0.2] : o.hat === "buns" ? [-0.48, 0.6, 0.4, -0.75] : [-0.44, 0.56, 0.38, -0.85];
    return (x: number) => hc + H.b * (y0 + (y1 - y0) * sstep(xa, xb, (x - cx) / H.a));
  }
  if (o.hat === "silk") return (x: number) => { const X = Math.abs((x - cx - sh) / H.a); return crown + 0.13 * HH + 0.56 * HH * X ** 2.3; };
  if (o.hat === "buns") return (x: number) => { const X = (x - cx - sh) / H.a; return crown + 0.33 * HH + 0.12 * HH * X ** 4; };
  return (x: number) => { const X = (x - cx - sh) / H.a; return crown + 0.28 * HH + 0.16 * HH * X ** 4; };
};
/** long hair hanging down the back (hat "silk"): drawn BEFORE the torso so it hangs behind the shoulders. hc = head
 *  centre, bot = y of the hem (waist; knees when messy). Front: symmetric behind the body; side: down the back. */
const hairBack = (p: Pen, o: Outfit, H: Blob, cx: number, hc: number, bot: number, light: number, thick: number, ow: number, side: boolean, seed: number) => {
  if (o.hat !== "silk") return;
  const col = o.hair ?? "#16131a", u = (2 * H.a) / 100, messy = !!o.messy;
  let pts: P2[];
  if (!side) {
    const wTop = 1.0 * H.a, wBot = (messy ? 1.02 : 0.9) * H.a, y0 = hc - 0.3 * H.b;
    pts = [...curve([cx + wTop, y0], [cx + wTop * 1.04, (y0 + bot) / 2], [cx + wBot, bot], 10)];
    if (messy) { // ragged hem: hanging locks of different lengths, pointed tips, rounded notches
      const n = 7;
      for (let i = 0; i < n; i++) {
        const x0 = cx + wBot - (2 * wBot * i) / n, x1 = cx + wBot - (2 * wBot * (i + 1)) / n, xm = (x0 + x1) / 2 + (rnd(seed, 80 + i) - 0.5) * 6 * u;
        const tip = bot + (8 + 22 * rnd(seed, 90 + i)) * u, notch = bot - (6 + 10 * rnd(seed, 100 + i)) * u;
        pts.push(...curve([x0, bot - 4 * u], [(x0 + xm) / 2 + 1 * u, (bot + tip) / 2], [xm, tip], 4).slice(1));
        pts.push(...curve([xm, tip], [(xm + x1) / 2 - 1 * u, (tip + notch) / 2], [x1, i === n - 1 ? bot - 4 * u : notch], 4).slice(1));
      }
    } else for (let i = 1; i < 12; i++) { const t = i / 12, x = cx + wBot - 2 * wBot * t; pts.push([x, bot + 5 * u * Math.sin(Math.PI * t) - 4 * u]); }
    pts.push(...curve([cx - wBot, bot], [cx - wTop * 1.04, (y0 + bot) / 2], [cx - wTop, y0], 10));
    pts.push(...curve([cx - wTop, y0], [cx, hc - 1.25 * H.b], [cx + wTop, y0], 10).slice(1, -1));
  } else {
    // down the back of the head and the back of the torso; slightly away from the back
    const xb = cx - 0.95 * H.a, y0 = hc - 0.2 * H.b, xBot = cx - (messy ? 0.98 : 0.86) * H.a;
    pts = [[cx - 0.2 * H.a, hc - 0.9 * H.b], [cx + 0.1 * H.a, hc - 0.2 * H.b], [cx - 0.35 * H.a, hc + 0.7 * H.b],
      ...curve([cx - 0.5 * H.a, hc + 0.95 * H.b], [cx - 0.6 * H.a, (hc + bot) / 2], [xBot + 0.28 * H.a, bot], 8)];
    if (messy) for (let i = 1; i < 5; i++) pts.push([xBot + 0.28 * H.a - (0.28 * H.a * i) / 5, bot + (i % 2 ? 12 : -4) * u * (0.6 + rnd(seed, 85 + i))]);
    pts.push([xBot, bot - 2 * u], ...curve([xBot, bot - 2 * u], [xb - 0.12 * H.a, (y0 + bot) / 2], [xb, y0], 8).slice(1));
  }
  p.shadedFill(pts, col, mul(col, SH_FELT), light, H.a * 1.4, 0.3);
  // a few fine strand lines (slightly lighter), no shine blobs
  p.clip(pts, () => {
    for (let i = 0; i < 5; i++) {
      const x0 = side ? cx - 0.55 * H.a - i * 0.08 * H.a : cx - 0.7 * H.a + i * 0.35 * H.a;
      p.stroke(curve([x0, hc + 0.9 * H.b], [x0 + (side ? -0.05 : 0.04 * (i - 2)) * H.a, (hc + bot) / 2 + H.b * 0.4], [x0 + (side ? -0.12 : 0.08 * (i - 2)) * H.a, bot - 4 * u], 6), 1.2 * u, mix(col, "#ffffff", 0.13));
    }
  });
  p.inkRing(pts, ow * 0.85, thick, 0.35);
};
/** parts of a hat that sit behind the head (bonnet) */
const hatBehind = (p: Pen, o: Outfit, H: Blob, cx: number, hc: number, light: number, thick: number, ow: number, side: boolean, facing = 0) => {

  if (o.hat === "long") { // long hair hanging behind the head and shoulders
    const col = o.hair ?? "#1d1a20", u = (2 * H.a) / 100;
    const pts: P2[] = [[cx - H.a * 1.06, hc - H.b * 0.2], [cx - H.a * 1.0, hc + H.b * 1.5], [cx - H.a * 0.82, hc + H.b * 2.45], [cx - H.a * 0.55, hc + H.b * 2.2],
      [cx + H.a * 0.55, hc + H.b * 2.25], [cx + H.a * 0.8, hc + H.b * 2.5], [cx + H.a * 1.0, hc + H.b * 1.45], [cx + H.a * 1.06, hc - H.b * 0.2], [cx, hc - H.b * 1.08]];
    const sm: P2[] = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; sm.push(...curve(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b, 4).slice(0, -1)); }
    p.shadedFill(sm, col, mul(col, SH_FELT), light, H.a * 1.2);
    p.poly(sm, null, ow * 0.85);
    for (let i = 0; i < 5; i++) p.stroke([[cx - H.a * 0.8 + i * H.a * 0.4, hc + H.b * 1.2], [cx - H.a * 0.85 + i * H.a * 0.42, hc + H.b * 2.3]], 1.5 * u, mix(col, "#ffffff", 0.12));
    return;
  }
  if (o.hat === "capback") { // the peak of a backwards cap pokes out behind the head, angled back and down
    const u = (2 * H.a) / 100, col = o.cap ?? "#26304f", sd = side ? -1 : facing ? -facing : -1;
    p.ell(cx + sd * 0.82 * H.a, hc - 0.62 * H.b, 0.5 * H.a, 0.1 * 2 * H.b, shade(col, 0.78), ow * 0.85, 0, 360, sd * -28);
    p.arc(cx + sd * 0.82 * H.a, hc - 0.62 * H.b, 0.42 * H.a, 0.07 * 2 * H.b, 200, 340, 1.2 * u, shade(col, 0.6));
    return;
  }
  if (o.hat === "pigtails") { // two short pigtails sticking out behind the ears (one at the back in profile), tied with red bands
    const col = o.hair ?? "#1d1a20", u = (2 * H.a) / 100;
    for (const sd of side ? [-1] : [-1, 1]) {
      const x0 = cx + sd * (side ? 0.78 : 0.9) * H.a, y0 = hc + 0.1 * H.b;
      const tail = ribbon(curve([x0, y0], [x0 + sd * 18 * u, y0 + 2 * u], [x0 + sd * 29 * u, y0 + 20 * u], 8), 17 * u, 5 * u, 1.2);
      p.poly(tail, col, ow * 0.8);
      p.band([[x0 + sd * 8.5 * u, y0 - 9 * u], [x0 + sd * 11 * u, y0 + 9 * u]], "#c2413a", 3.2 * u, 1 * u, "round");
    }
    return;
  }
  if (o.hat !== "bonnet") return;
  const bb = blobPts(cx - (side ? 12 : 0) * (H.a / 50), hc - 0.07 * 2 * H.b, { ...H, a: H.a * 1.17, b: H.b * 1.13, asym: 0, egg: 0.04, seed: H.seed + 3 });
  p.shadedFill(bb, BONNET, mul(BONNET, SH_CLOTH), light, H.a * 1.17);
  p.inkRing(bb, ow * 0.85, thick);
};

const hatOn = (p: Pen, o: Outfit, hp: P2[], H: Blob, cx: number, hc: number, light: number, seed: number, facing: number, side: boolean, down = false, back = false) => {
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100, crown = hc - H.b, ow = 0.85 * 5 * u;
  const a = H.rot + rad(4 * (rnd(seed, 20) - 0.5)); // tilt with the head, +-2 deg extra
  const R = (pts: P2[]) => rotPts(pts, a, cx, hc);
  const sag = (yb: number, wb: number): P2[] => {
    const base: P2[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; base.push([cx + wb * (2 * t - 1), yb + 3 * u * (1 - (2 * t - 1) ** 2)]); }
    return base;
  };
  if (o.hat === "bun" || o.hat === "buns" || o.hat === "silk") { // period hair: a smooth cap over the crown + a topknot / buns
    const col = o.hair ?? "#1d1a20", edge = hairEdge(o, H, cx, hc, side, facing, down), hi = mix(col, "#ffffff", 0.16);
    const cap = capPts(hp, cx, hc, (x, y) => y < edge(x), (a2, b2) => along(a2, b2, (x) => edge(x) + 0.8 * u, 18), side ? 1.035 : 1.03);
    if (!cap) return;
    if (o.hat === "bun" && side) { // topknot sits at the top-back: drawn first so the cap overlaps its foot
      const [bx, by] = R([[cx - 0.3 * H.a, crown + 0.02 * HH]])[0];
      p.ell(bx, by, 15 * u, 11.5 * u, col, ow * 0.85, 0, 360, -25 + (a * 180) / Math.PI);
    }
    p.shadedFill(cap, col, mul(col, SH_FELT), light, H.a, 0.35);
    p.clip(cap, () => { // fine comb lines toward the knot / the parting
      if (o.hat === "silk" && !side) for (const sd of [-1, 1]) for (const k of [0.3, 0.62])
        p.stroke(curve([cx + 0.03 * H.a * facing + sd * 2 * u, crown + 0.1 * HH], [cx + sd * k * H.a, crown + 0.2 * HH], [cx + sd * (k + 0.3) * H.a, edge(cx + sd * (k + 0.3) * H.a) - 3 * u], 8), 1.2 * u, hi);
      else if (!side) for (const sd of [-1, 0, 1])
        p.stroke(curve([cx + sd * 0.55 * H.a, edge(cx + sd * 0.55 * H.a) - 2 * u], [cx + sd * 0.3 * H.a, crown + 0.12 * HH], [cx + sd * 0.06 * H.a, crown + 0.02 * HH], 8), 1.2 * u, hi);
      else for (const k of [0, 1, 2])
        p.stroke(curve([cx + (0.35 - k * 0.32) * H.a, edge(cx + (0.35 - k * 0.32) * H.a) - 2 * u], [cx - (0.05 + k * 0.12) * H.a, crown + (0.18 + k * 0.08) * HH], [cx - 0.3 * H.a, crown + 0.06 * HH], 8), 1.2 * u, hi);
    });
    p.poly(cap, null, ow);
    if (o.hat === "silk" && !side) // the parting
      p.stroke([[cx + 0.03 * H.a * facing, crown + 0.04 * HH], [cx + 0.03 * H.a * facing, crown + 0.13 * HH]], 1.4 * u, shade(col, 0.6));
    if (o.hat === "bun" && !side) { // topknot on the crown with a thin wooden hairpin through it
      const [bx, by] = R([[cx + 0.02 * H.a * facing, crown - 3.5 * u]])[0], deg = (a * 180) / Math.PI;
      p.ell(bx, by, 15 * u, 11.5 * u, col, ow * 0.85, 0, 360, deg);
      p.arc(bx - 2 * u, by - 1 * u, 9 * u, 6 * u, 200, 300, 1.2 * u, hi);
      p.band(R([[cx - 23 * u, crown - 5.5 * u], [cx + 23 * u, crown - 7.5 * u]]), "#c9b48a", 2.4 * u, 1.1 * u, "round");
    }
    if (o.hat === "bun" && side) {
      const [bx, by] = R([[cx - 0.3 * H.a, crown + 0.02 * HH]])[0];
      p.band(R([[bx - 22 * u, by + 4 * u], [bx + 20 * u, by - 9 * u]]), "#c9b48a", 2.4 * u, 1.1 * u, "round");
    }
    if (o.hat === "buns") { // the maid's two buns on top (one at the top-back in profile), each tied with a thin red cord
      for (const sd of side ? [0] : [-1, 1]) {
        const [bx, by] = R([[side ? cx - 0.34 * H.a : cx + sd * 0.5 * H.a + 0.03 * H.a * facing, crown + (side ? 0.08 : 0.07) * HH]])[0];
        const tilt = side ? -20 : sd * 18;
        p.ell(bx, by, 0.25 * H.a, 0.23 * H.a, col, ow * 0.85, 0, 360, tilt);
        p.arc(bx - 0.04 * H.a, by - 0.03 * H.a, 0.14 * H.a, 0.11 * H.a, 205, 300, 1.2 * u, hi);
        // a red cord wound round the foot of the bun, following its lower outline (toward the head)
        const foot = tilt + 90 - (side ? 0 : sd * 25);
        p.band(ellPts(bx, by, 0.25 * H.a - 1.2 * u, 0.23 * H.a - 1.2 * u, foot - 34, foot + 34, 0, 10), o.clay ? CLAY_RED : "#94352e", 2 * u, 0.7 * u, "round");
      }
    }
    if (o.sick) for (let i = 0; i < 2; i++) { // loose strands fallen over the forehead
      const x0 = side ? cx + (0.22 + 0.14 * i) * H.a : cx + (-0.22 + 0.42 * i) * H.a + 0.05 * H.a * facing, y0 = edge(x0) - 3 * u, len = (15 + 5 * i) * u;
      p.stroke(curve([x0, y0], [x0 + (i ? 2.5 : -2) * u, y0 + len * 0.55], [x0 + (i ? 0.5 : -3.5) * u, y0 + len], 8), 1.5 * u, col);
    }
  } else if (o.hat === "khandong") { // man's black wrapped turban (khăn đóng): a firm ring, flat top, pleats crossing in front
    const col = "#1f1b24", fold = "#47404f", top = crown - 0.025 * HH, bot = crown + 0.33 * HH, hw = 1.07 * H.a, xo = side ? -0.05 * H.a : 0;
    const mid = (top + bot) / 2, hh2 = (bot - top) / 2, ne = 3.4;
    // temple hair under the band
    if (!side) p.clip(hp, () => { for (const sd of [-1, 1]) p.poly([[cx + sd * 0.72 * H.a, bot - 4 * u], [cx + sd * 1.1 * H.a, bot - 4 * u], [cx + sd * 1.1 * H.a, bot + 0.12 * HH], [cx + sd * 0.92 * H.a, bot + 0.1 * HH], [cx + sd * 0.8 * H.a, bot + 0.02 * HH]], o.hair ?? "#1d1a20", 1.2 * u); });
    else p.clip(hp, () => p.poly([[cx - 1.1 * H.a, bot - 2 * u], [cx - 0.1 * H.a, bot - 2 * u], [cx - 0.22 * H.a, bot + 0.1 * HH], [cx - 1.1 * H.a, bot + 0.28 * HH]], o.hair ?? "#1d1a20", 1.2 * u));
    const ring: P2[] = [];
    for (let i = 0; i < 64; i++) {
      const t = (i / 64) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t), X = Math.sign(c) * Math.abs(c) ** (2 / ne);
      ring.push([cx + xo + hw * X, mid + hh2 * Math.sign(sn) * Math.abs(sn) ** (2 / ne) + (sn > 0 ? 0.04 * HH * (1 - X * X) : 0)]);
    }
    const rp = R(ring);
    p.shadedFill(rp, col, "#0d0b10", light, H.a, 0.35);
    p.clip(rp, () => {
      if (!side) {
        const xc = cx + 0.03 * H.a * facing;
        for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) { // chevron pleats meeting over the forehead
          const x0 = xc + sd * k * 0.22 * H.a;
          p.stroke(R([[x0, top + 1 * u], [x0 + sd * 0.34 * H.a, bot + 0.04 * HH]]), 1.5 * u, fold);
        }
        p.stroke(R([[xc, top], [xc, bot + 0.05 * HH]]), 1.2 * u, "#100d13");
      } else for (let k = -2; k < 5; k++) { const x0 = cx + xo + k * 0.24 * H.a; p.stroke(R([[x0, top + 1 * u], [x0 - 0.3 * H.a, bot + 0.04 * HH]]), 1.5 * u, fold); }
      p.stroke(R(curve([cx + xo - hw, top + 0.05 * HH], [cx + xo, top + 0.01 * HH], [cx + xo + hw, top + 0.05 * HH], 10)), 1.1 * u, "#57505f");
    });
    p.inkRing(rp, ow, thickAngle(light), 0.35);
  } else if (o.hat === "daocap") { // Taoist's tall black cap: flared, flat top, a band at the foot, a small jade plaque
    const col = "#1d1b22", yb = crown + 0.27 * HH, ht = 0.6 * HH, wb = (side ? 38 : 44) * u, wt = (side ? 42 : 50) * u, xo = side ? -6 * u : 0;
    // sideburns under the cap
    p.clip(hp, () => { for (const sd of side ? [-1] : [-1, 1]) p.poly([[cx + sd * 0.62 * H.a, yb - 6 * u], [cx + sd * 1.1 * H.a, yb - 6 * u], [cx + sd * 1.1 * H.a, yb + 0.16 * HH], [cx + sd * 0.9 * H.a, yb + 0.14 * HH], [cx + sd * 0.74 * H.a, yb + 0.03 * HH]], o.hair ?? "#1d1a20", 1.2 * u); });
    const topY = yb - ht, base = sag(yb, wb).map(([x, y]) => [x + xo, y] as P2);
    const body = R([...base.reverse(), ...curve([cx + xo - wt, topY + 5 * u], [cx + xo, topY - 3 * u], [cx + xo + wt, topY + 5 * u], 8)]);
    p.shadedFill(body, col, "#0c0b0f", light, wt, 0.4);
    p.clip(body, () => {
      p.band(R([[cx + xo - wt - 5 * u, yb - 0.07 * HH], [cx + xo + wt + 5 * u, yb - 0.07 * HH]]), "#2e2c36", 0.1 * HH, 1.2 * u);
      for (const k of side ? [0.25] : [-0.3, 0.3]) p.stroke(R([[cx + xo + k * wb, yb - 0.17 * HH], [cx + xo + k * wt * 1.05, topY + 4 * u]]), 1.2 * u, "#34313c");
    });
    p.poly(body, null, ow);
    if (!side && !back) {
      const [jx, jy] = R([[cx + 0.03 * H.a * facing, yb - 0.32 * HH]])[0];
      p.poly(rrect(jx - 6 * u, jy - 6 * u, jx + 6 * u, jy + 6 * u, 2 * u), "#7f9a86", 1.6 * u);
    }
  } else if (o.hat === "shako" || o.hat === "shako_tall") {
    const tall = o.hat === "shako_tall", yb = crown + 0.25 * HH, ht = (tall ? 0.66 : 0.56) * HH, wb = 46 * u, wt = 52 * u;
    const body = R([...sag(yb, wb).reverse(), [cx - wt, yb - ht], [cx + wt, yb - ht]]);
    p.shadedFill(body, "#3a3d47", "#24262d", light, wt, 0.4);
    if (tall) p.clip(body, () => p.band(R([[cx - wt - 5 * u, yb - ht + 0.07 * HH], [cx + wt + 5 * u, yb - ht + 0.07 * HH]]), "#e8c45a", 0.06 * HH, 1.5 * u));
    p.poly(body, null, ow);
    const deg = (a * 180) / Math.PI;
    if (side) {
      p.poly(R([[cx + 36 * u, yb - 1 * u], [cx + 60 * u, yb + 8 * u], [cx + 34 * u, yb + 6 * u]]), "#16171b", 2.5 * u);
      const [tx, ty] = R([[cx + 24 * u, yb - ht - 6 * u]])[0];
      p.ell(tx, ty, 7 * u, 7 * u, "#2b7a4b", 2.5 * u);
    } else {
      if (!back) {
      const [px, py] = R([[cx + 3 * u * facing, yb + 3 * u]])[0];
      p.ell(px, py, 34 * u, 0.045 * HH, "#16171b", 2.5 * u, 0, 180, deg); // peak
      const [bx, by] = R([[cx, yb - 0.45 * ht]])[0];
      p.ell(bx, by, 7 * u, 6 * u, tall ? "#e8c45a" : "#c9ccd2", 2 * u, 0, 360, deg); // badge plate
      p.arc(bx, by, 3.5 * u, 2.8 * u, 200, 500, 1.6 * u);
      }
      const [tx, ty] = R([[cx, yb - ht - 6 * u]])[0];
      p.ell(tx, ty, 7 * u, 7 * u, "#2b7a4b", 2.5 * u); // green tuft
    }
  } else if (o.hat === "cap" || o.hat === "hair" || o.hat === "long" || o.hat === "pigtails") {
    const cut = crown + (o.hat === "cap" ? 0.3 : 0.42) * HH;
    const keep = (x: number, y: number) => y < cut || (side && o.hat !== "cap" && x < cx - 6 * u && y < hc + 0.42 * H.b);
    // start the arc at the first kept point after a dropped one, so the kept run is contiguous and the cut closes it
    const n = hp.length, startIdx = Math.max(0, hp.findIndex(([x, y], i) => keep(x, y) && !keep(hp[(i + n - 1) % n][0], hp[(i + n - 1) % n][1])));
    const arc = [...hp.slice(startIdx), ...hp.slice(0, startIdx)].filter(([x, y]) => keep(x, y))
      .map(([x, y]) => [cx + (x - cx) * 1.03, hc + (y - hc) * 1.03] as P2);
    if (arc.length < 3) return;
    if (o.hat !== "cap") { // scalloped lower edge
      const [x0, y0] = arc[arc.length - 1], [x1, y1] = arc[0];
      for (let i = 1; i < 6; i++) arc.push([x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * i) / 6 + (i % 2 ? 4 * u : 0)]);
    }
    const col = o.hat === "cap" ? o.cap! : o.hair!;
    p.shadedFill(arc, col, mul(col, SH_FELT), light, H.a, 0.35);
    p.poly(arc, null, ow);
    if (o.hat !== "cap") {
      const s = side ? -1 : facing || 1;
      p.stroke([[cx + s * 10 * u, cut - 30 * u], [cx + s * 2 * u, cut - 12 * u]], 1.2 * u);
    }
    if (o.hat === "cap") {
      const deg = (a * 180) / Math.PI;
      if (side) p.poly(R([[cx + 40 * u, cut - 2 * u], [cx + 74 * u, cut + 4 * u], [cx + 40 * u, cut + 6 * u]]), shade(col, 0.8), ow);
      else {
        const s = facing || (rnd(seed, 21) < 0.5 ? -1 : 1), [px, py] = R([[cx + s * 4 * u, cut + 1.5 * u]])[0];
        p.ell(px, py, 32 * u, 0.06 * HH, shade(col, 0.8), ow, 0, 180, deg);
      }
    }
  } else if (o.hat === "capback") { // baseball cap worn backwards: dome, snapback opening over the forehead with hair showing
    // the lower edge curves: high at the front strap, dropping toward the ears
    const cutC = crown + 0.19 * HH, drop = 0.17 * HH, col = o.cap ?? "#26304f", hair = o.hair ?? "#1d1a20";
    const edge = (x: number) => cutC + drop * Math.min(1, ((x - cx) / H.a) ** 2);
    // short hair at the temples, peeking out under the cap edge (clipped to the head)
    p.clip(hp, () => { for (const sd of [-1, 1]) {
      const yS = edge(cx + sd * H.a);
      p.poly([[cx + sd * 0.7 * H.a, yS - 10 * u], [cx + sd * 1.1 * H.a, yS - 10 * u], [cx + sd * 1.1 * H.a, yS + 0.16 * HH], [cx + sd * 0.95 * H.a, yS + 0.2 * HH],
        [cx + sd * 0.87 * H.a, yS + 0.07 * HH], [cx + sd * 0.8 * H.a, yS + 0.02 * HH]], hair, 1.4 * u);
    } });
    const n = hp.length, keep = (x: number, y: number) => y < edge(x);
    const startIdx = Math.max(0, hp.findIndex(([x, y], i) => keep(x, y) && !keep(hp[(i + n - 1) % n][0], hp[(i + n - 1) % n][1])));
    const dome = [...hp.slice(startIdx), ...hp.slice(0, startIdx)].filter(([x, y]) => keep(x, y))
      .map(([x, y]) => [cx + (x - cx) * 1.04, hc + (y - hc) * 1.04] as P2);
    if (dome.length < 3) return;
    const xr = dome[dome.length - 1][0], xl = dome[0][0];
    for (let i = 1; i < 16; i++) { const x = xr + ((xl - xr) * i) / 16; dome.push([x, edge(x) + 1.5 * u]); }
    p.shadedFill(dome, col, mul(col, SH_FELT), light, H.a, 0.35);
    p.clip(dome, () => {
      for (const sd of [-1, 1]) p.stroke(R(curve([cx + sd * 4 * u, crown], [cx + sd * 0.5 * H.a, crown + 0.14 * HH], [cx + sd * 0.78 * H.a, edge(cx + sd * 0.78 * H.a)], 6)), 1.3 * u, shade(col, 0.7));
      // snapback opening: an arch over the forehead filled with hair, strap across its foot
      const ow2 = 22 * u, oh = 0.16 * HH, oy = cutC - 0.5 * u;
      const archPts = R(ellPts(cx, oy, ow2, oh, 180, 360));
      p.poly(archPts, hair, 0);
      for (let i = -2; i <= 2; i++) p.stroke(R(curve([cx + i * 7 * u, oy], [cx + i * 8 * u - 3 * u, oy - oh * 0.55], [cx + i * 5 * u - 5 * u, oy - oh * 0.92], 5)), 1.4 * u, mul(hair, [0.72, 0.68, 0.66]));
      p.stroke(R(curve([cx - 12 * u, oy - oh * 0.75], [cx - 2 * u, oy - oh * 1.02], [cx + 9 * u, oy - oh * 0.8], 5)), 1.6 * u, mix(hair, "#ffffff", 0.3));
      p.poly(archPts, null, 2.2 * u);
      p.poly(R([[cx - ow2 - 5 * u, oy - 6 * u], [cx + ow2 + 5 * u, oy - 6 * u], [cx + ow2 + 5 * u, oy + 1.5 * u], [cx - ow2 - 5 * u, oy + 1.5 * u]]), shade(col, 0.82), 1.8 * u);
      p.stroke(R([[cx - ow2, oy - 2.2 * u], [cx + ow2, oy - 2.2 * u]]), 0.9 * u, "rgba(255,255,255,0.25)");
    });
    p.poly(dome, null, ow);
    const [bx, by] = R([[cx, crown - 1 * u]])[0];
    p.ell(bx, by, 5 * u, 3 * u, col, 1.6 * u);
  } else if (o.hat === "tophat") {
    const yb = crown + 0.22 * HH, ht = 0.8 * HH, wb = 0.31 * W, wt = 0.33 * W, col = "#2e2a36";
    const body = R([...sag(yb, wb).reverse(), [cx - wt, yb - ht], [cx + wt, yb - ht]]);
    p.shadedFill(body, col, mul(col, SH_FELT), light, wt, 0.4);
    p.clip(body, () => p.band(R([[cx - wt - 4 * u, yb - 0.13 * HH], [cx + wt + 4 * u, yb - 0.13 * HH]]), shade(o.jacket, 0.9), 0.14 * HH, 0.8 * u));
    p.poly(body, null, ow);
    const [bx, by] = R([[cx, yb + 1 * u]])[0];
    p.ell(bx, by, 0.45 * W, 0.05 * HH, "#1d1b22", ow, 0, 360, (a * 180) / Math.PI);
  } else if (o.hat === "nonla") { // conical palm-leaf hat
    const yb = crown + 0.3 * HH, wb = 0.86 * W, ap = crown - 0.34 * HH, col = "#e8d49c";
    const body = R([[cx - wb, yb], [cx, ap], [cx + wb, yb], ...ellPts(cx, yb, wb, 0.075 * HH, 0, 180).slice(1, -1)]);
    p.shadedFill(body, col, mul(col, SH_CLOTH), light, wb, 0.35);
    for (const k of [0.35, 0.62, 0.85]) {
      const y = ap + (yb - ap) * k, hw = wb * k;
      p.stroke(R([[cx - hw, y + 0.012 * HH], [cx, y + 0.03 * HH * k], [cx + hw, y + 0.012 * HH]]), 1.4 * u, "rgba(120,90,40,0.55)");
    }
    p.poly(body, null, ow);
    const deg = (a * 180) / Math.PI;
    const [bx, by] = R([[cx, yb]])[0];
    p.ell(bx, by, wb, 0.075 * HH, null, ow * 0.8, 0, 180, deg);
    if (!back) p.stroke([[cx - 0.36 * W, yb + 0.05 * HH], [cx - 0.2 * W, hc + 0.85 * H.b], [cx, hc + 1.02 * H.b], [cx + 0.2 * W, hc + 0.85 * H.b], [cx + 0.36 * W, yb + 0.05 * HH]], 1.3 * u, "#7a5a3a");
  } else if (o.hat === "khan") { // grandmother's black headscarf (khăn mỏ quạ): covers the crown, peak over the forehead
    const cut = crown + 0.3 * HH, col = "#3a3040";
    const n = hp.length, top = hp.filter(([, y]) => y < cut);
    if (top.length < 3) return;
    top.sort((A, B) => Math.atan2(A[1] - hc, A[0] - cx) - Math.atan2(B[1] - hc, B[0] - cx));
    void n;
    const sc = (q2: P2): P2 => [cx + (q2[0] - cx) * 1.09, hc + (q2[1] - hc) * 1.09];
    const L0 = sc(top[0]), R0 = sc(top[top.length - 1]);
    // grey hair showing at the temples under the scarf
    for (const sd of [-1, 1]) for (let k = 0; k < 3; k++)
      p.stroke([[cx + sd * (0.62 + 0.08 * k) * H.a, cut - 0.02 * HH], [cx + sd * (0.72 + 0.08 * k) * H.a, cut + 0.1 * HH]], 2.6 * u, "#d9d4ce");
    const band: P2[] = [...top.map(sc), [R0[0] - 2 * u, cut + 0.05 * HH], [cx + 0.35 * H.a, cut + 0.04 * HH], [cx, cut + (0.04 + 0.12 * (o.khanPeak ?? 1)) * HH], [cx - 0.35 * H.a, cut + 0.04 * HH], [L0[0] + 2 * u, cut + 0.05 * HH]];
    p.shadedFill(band, col, "#120e15", light, H.a, 0.35);
    // wrapped folds: two curved bands across the scarf
    for (const k of [0.38, 0.7]) {
      const y = crown + k * 0.3 * HH + 0.04 * HH;
      p.stroke([[cx - 0.9 * H.a, y + 0.03 * HH], [cx - 0.3 * H.a, y - 0.01 * HH], [cx + 0.3 * H.a, y - 0.01 * HH], [cx + 0.9 * H.a, y + 0.03 * HH]], 2.2 * u, "#4e4352");
    }
    p.poly(band, null, ow);
  } else if (o.hat === "chom") { // shaved head with the little tuft on top
    const col = o.hair ?? "#1d1a20", [tx, ty] = R([[cx + 4 * u * (side ? 1 : facing || 1), crown + 5 * u]])[0];
    p.ell(tx, ty, 13 * u, 9 * u, col, ow * 0.8);
    p.stroke([[tx - 4 * u, ty - 6 * u], [tx + 2 * u, ty - 14 * u]], 3 * u, col);
  } else if (o.hat === "bonnet") {
    const [bx, by] = R([[cx + (side ? 6 * u : 0), crown + 0.16 * HH]])[0];
    p.arc(bx, by, 0.5 * W, 0.2 * HH, 200, 340, 7 * u, BONNET_BRIM);
    p.arc(bx, by, 0.5 * W + 3.5 * u, 0.2 * HH + 3.5 * u, 200, 340, 1.2 * u);
    const cy = hc + H.b * 0.98;
    if (!back) p.stroke([[cx - 14 * u, cy - 4 * u], [cx, cy + 2 * u], [cx + 14 * u, cy - 4 * u]], 2 * u, BONNET_BRIM);
  }
};

/** the back of the head (FrontOpts.back): hair / scarf / hat seen from behind, drawn over the bare head contour hp */
const hatBack = (p: Pen, o: Outfit, hp: P2[], H: Blob, cx: number, hc: number, light: number, seed: number, thick: number) => {
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100, crown = hc - H.b, ow = 0.85 * 5 * u, hat = o.hat ?? null;
  const hair = o.hair ?? (o.old ? "#cfcac4" : "#1d1a20"), hi = mix(hair, "#ffffff", 0.16);
  const a = H.rot + rad(4 * (rnd(seed, 20) - 0.5)), R = (pts: P2[]) => rotPts(pts, a, cx, hc);
  /** nape line: lv = how far down the head the cover reaches (in H.b from the centre), a little higher toward the ears */
  const nape = (lv: number) => (x: number) => hc + H.b * (lv - 0.14 * ((x - cx) / H.a) ** 2);
  const cover = (col: string, lv: number, scallop: boolean, sc = 1.03, dark?: string): P2[] | null => {
    const edge = nape(lv);
    const cap = capPts(hp, cx, hc, (x, y) => y < edge(x), (a2, b2) => along(a2, b2, (x) => edge(x), 19).map(([x, y], i) => [x, y + (scallop && i % 2 === 0 ? 3.5 * u : 0)] as P2), sc);
    if (!cap) return null;
    p.shadedFill(cap, col, dark ?? mul(col, SH_FELT), light, H.a, 0.35);
    return cap;
  };
  const strands = (cap: P2[], col: string) => p.clip(cap, () => { // a whorl on the crown, hair combed down from it
    const wx = cx + 5 * u, wy = crown + 0.2 * HH;
    for (const [dx, bend] of [[-0.62, -0.1], [-0.25, -0.04], [0.2, 0.05], [0.6, 0.1]] as const)
      p.stroke(curve([wx + dx * 8 * u, wy + 3 * u], [wx + dx * 0.6 * H.a + bend * H.a, hc - 0.05 * H.b], [wx + dx * H.a, hc + 0.4 * H.b], 8), 1.2 * u, col);
    p.arc(wx, wy, 3.2 * u, 2.4 * u, 150, 400, 1.2 * u, col);
  });
  const fringe = () => { // an old man's horseshoe of thin hair round the back, the crown bare
    const top = (x: number) => hc + H.b * (0.12 + 0.1 * ((x - cx) / H.a) ** 2), bot = nape(0.62);
    const band: P2[] = [];
    for (let i = 0; i <= 16; i++) { const x = cx - 1.1 * H.a + (2.2 * H.a * i) / 16; band.push([x, top(x) + (i % 2 ? 2.5 * u : 0)]); }
    for (let i = 16; i >= 0; i--) { const x = cx - 1.1 * H.a + (2.2 * H.a * i) / 16; band.push([x, bot(x) + (i % 2 ? 2.5 * u : 0)]); }
    p.clip(hp, () => p.poly(band, hair, 1.3 * u));
  };
  if (hat === null) { if (o.old || o.hair) fringe(); return; }
  if (hat === "chom") { if (o.old) fringe(); hatOn(p, o, hp, H, cx, hc, light, seed, 0, false, false, true); return; }
  if (hat === "long") { const c0 = cover(hair, 0.95, false, 1.05); if (c0) p.poly(c0, null, ow); }
  if (hat === "long" || hat === "bonnet") { hatBehind(p, o, H, cx, hc, light, thick, 5 * u, false, 0); return; }
  if (hat === "silk") { hairBack(p, o, H, cx, hc, hc + (o.messy ? 3.6 : 3.0) * H.b, light, thick, 5 * u, false, seed); return; }
  if (hat === "khan") { // the headscarf wraps the whole back of the head, its two ends tied and hanging at the nape
    const col = "#3a3040";
    for (const sd of [-1, 1]) p.poly(ribbon(curve([cx + sd * 3 * u, hc + 0.5 * H.b], [cx + sd * 9 * u, hc + 0.85 * H.b], [cx + sd * 13 * u, hc + 1.22 * H.b], 6), 9 * u, 4 * u, 1), col, 1.6 * u);
    const cap = cover(col, 0.66, false, 1.07, "#120e15");
    if (!cap) return;
    p.clip(cap, () => { for (const k of [0.3, 0.55, 0.8]) p.stroke(curve([cx - 1.1 * H.a, crown + k * HH * 0.75 + 0.05 * HH], [cx, crown + k * HH * 0.75], [cx + 1.1 * H.a, crown + k * HH * 0.75 + 0.05 * HH], 10), 2.2 * u, "#4e4352"); });
    p.poly(cap, null, ow);
    p.ell(cx, hc + 0.52 * H.b, 6 * u, 4.5 * u, col, 1.6 * u);
    return;
  }
  // everything else has hair under it: a cap of hair down to the nape
  const bowl = hat === "hair" || hat === "pigtails", cap = cover(hair, bowl ? 0.66 : 0.74, bowl);
  if (cap) { strands(cap, hi); p.poly(cap, null, ow); }
  if (hat === "bun") { // topknot with its pin
    const [bx, by] = R([[cx, crown - 3.5 * u]])[0], deg = (a * 180) / Math.PI;
    p.ell(bx, by, 15 * u, 11.5 * u, hair, ow * 0.85, 0, 360, deg);
    p.band(R([[cx - 23 * u, crown - 7.5 * u], [cx + 23 * u, crown - 5.5 * u]]), "#c9b48a", 2.4 * u, 1.1 * u, "round");
  } else if (hat === "buns") {
    for (const sd of [-1, 1]) {
      const [bx, by] = R([[cx + sd * 0.5 * H.a, crown + 0.07 * HH]])[0];
      p.ell(bx, by, 0.25 * H.a, 0.23 * H.a, hair, ow * 0.85, 0, 360, sd * 18);
      const foot = sd * 18 + 90 - sd * 25;
      p.band(ellPts(bx, by, 0.25 * H.a - 1.2 * u, 0.23 * H.a - 1.2 * u, foot - 34, foot + 34, 0, 10), o.clay ? CLAY_RED : "#94352e", 2 * u, 0.7 * u, "round");
    }
  } else if (hat === "pigtails") { // the parting down the back of the head
    p.stroke([[cx, crown + 0.05 * HH], [cx + 1 * u, hc + 0.3 * H.b]], 1.4 * u, shade(hair, 0.55));
  } else if (hat === "cap" || hat === "capback") { // the dome of the cap from behind (capback: its peak points down the neck)
    const col = o.cap ?? "#26304f", cut = crown + 0.3 * HH;
    const dome = capPts(hp, cx, hc, (_x, y) => y < cut, (a2, b2) => along(a2, b2, () => cut + 1.5 * u, 14), 1.04);
    if (dome) {
      if (hat === "capback") p.ell(cx, cut + 2 * u, 0.5 * H.a, 0.075 * HH, shade(col, 0.78), ow * 0.85, 0, 180);
      p.shadedFill(dome, col, mul(col, SH_FELT), light, H.a, 0.35);
      p.clip(dome, () => { for (const sd of [-1, 1]) p.stroke(R(curve([cx + sd * 4 * u, crown], [cx + sd * 0.5 * H.a, crown + 0.14 * HH], [cx + sd * 0.78 * H.a, cut], 6)), 1.3 * u, shade(col, 0.7)); });
      p.poly(dome, null, ow);
      const [bx, by] = R([[cx, crown - 1 * u]])[0];
      p.ell(bx, by, 5 * u, 3 * u, col, 1.6 * u);
    }
  } else if (!bowl) hatOn(p, o, hp, H, cx, hc, light, seed, 0, false, false, true);
};

// ---------------- bodies ----------------
export type Arms = [P2[], P2[]];
/** held prop; for the hammer the number is the strike 0 (raised) .. 1 (struck).
 *  Cây gạo: ["dan", strum 0..1] pear-shaped lute across the lap / chest, plucked (made for mode "sit"); "danHold" the lute
 *  held upright against the chest with both arms (standing); ["axe" | "axeBroken" | "mallet", swing 0 raised .. 1 struck];
 *  "talisman" a yellow paper strip held up in one hand; "rope" ropes binding the torso and arms (sitting); "scrap" a torn
 *  piece of dark-indigo cloth in the hand; "lanternPaper" / "lanternPaperOut" a paper lantern on a short bamboo stick. */
export type Prop = null | "icecream" | "shako" | ["hammer", number] | "cup" | "wag" | "kite" | "lantern" | "lanternOut" | "string"
  | ["dan", number] | "danHold" | ["axe", number] | ["axeBroken", number] | ["mallet", number] | "talisman" | "rope" | "scrap"
  | "lanternPaper" | "lanternPaperOut"
  /** Ma da (long): "rod" a bamboo fishing rod in one hand, the line hanging; "bowl" a rice bowl with chopsticks carried
   *  in both hands in front of the belly (= gesture "hold"; with gesture ["hold", k] the bowl follows the hands);
   *  "cane" a walking stick in one hand, the body leaning on it a little (also SideOpts.prop) */
  | "rod" | "bowl" | "cane";
/** arm poses for FrontOpts.gesture. One arm: point, pat, wipe, scratch, chin. Both arms: reach, up, hips, ears, pray,
 *  hold, hug, cupcall. */
export type Gesture = "point" | "reach" | "up" | "hips" | "ears" | "pray" | "pat" | "hold" | "wipe" | "scratch" | "chin" | "hug" | "cupcall";
const ONE_ARM = new Set<Gesture>(["point", "pat", "wipe", "scratch", "chin"]);
type ToolK = "hammer" | "axe" | "axeBroken" | "mallet";
const toolOf = (prop: Prop | undefined): [ToolK, number] | null => (Array.isArray(prop) && prop[0] !== "dan" ? [prop[0] as ToolK, clamp(prop[1], 0, 1)] : null);

const BUILD: Record<Build, { a: number; torso: number; legs: number; tw: number }> = {
  adult: { a: 118, torso: 1.1, legs: 1.4, tw: 0.8 },
  stout: { a: 118, torso: 1.15, legs: 1.32, tw: 0.92 },
  kid: { a: 112, torso: 0.85, legs: 1.0, tw: 0.72 },
};

export type FrontOpts = {
  phase?: number; expr?: Expr; mode?: "march" | "stroll" | "stand" | "sit" | "fall"; look?: number; blink?: boolean | number; lift?: number;
  prop?: Prop; tilt?: number; headTilt?: number; wave?: number;
  /** canvas angle the key light comes FROM (painted crescent + thick outline side) */
  light?: number; facing?: -1 | 0 | 1; seed?: number;
  // ---- opt-in acting (all default to the old drawing) ----
  /** arm pose [name, k, side?]: blended from the current arms by k in 0..1 (animate k). side -1 | 1 picks the arm of the
   *  one-armed gestures (default: the facing side, else 1; the other arm if that one holds a prop). Modes stand / sit /
   *  stroll / march; ignored in "fall" and with a two-handed prop (lute, rope, cup, kite). An arm holding a prop keeps it. */
  gesture?: [Gesture, number, (-1 | 1)?];
  /** mouth openness 0..1 over the expression's own mouth (0 = unchanged): flap it on the syllables of speech */
  talk?: number;
  /** seen from behind: no face, the hair / hat covers the back of the head, plain back of the jacket (stand / sit / stroll) */
  back?: boolean;
  /** breathing -1..1: the chest and shoulders rise, the head lifts about 1 % of the card (drive it with a sine) */
  breath?: number;
  /** pupil offset [x, y] in -1..1 (continuous; x replaces `look`) */
  gaze?: [number, number];
};

const footStroke = (p: Pen, a: P2, b: P2, w: number, col: string) => {
  if (col !== INK) p.stroke([a, b], w + 3, INK);
  p.stroke([a, b], w, col);
};

/** head contour of an outfit: the head seed (o.head) and the feminine / jaw overrides */
const headOf = (o: Outfit, seed: number, a: number, facing: number): Blob => {
  let H = headBlob(o.head ?? seed, a, facing);
  if (o.jaw) H = { ...H, nBot: o.jaw, egg: H.egg * 0.4 };
  if (o.fem) H = { ...H, nBot: 2.0, egg: -0.19, b: H.b * 1.01 };
  return H;
};

/** front-view landmarks (shared by bodyFront and the prop-point helpers) */
const frontRig = (o: Outfit, opts: FrontOpts) => {
  const { phase = 0, mode = "march", facing = 0, seed = 1 } = opts;
  const Bd = BUILD[o.build ?? "adult"], two = Math.PI * 2;
  const H = headOf(o, seed, Bd.a, facing), W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  const tall = (1 + Bd.torso + Bd.legs) * HH, sole = 975;
  // body bob 5 % (march) / 3 % (stroll) of the height, lowest at contact (phase 0 and 0.5)
  const bob = mode === "march" ? 0.025 * tall * Math.cos(2 * two * phase) : mode === "stroll" ? 0.015 * tall * Math.cos(2 * two * phase) : 0;
  const torsoBot = mode === "sit" ? sole - 0.2 * HH : sole - Bd.legs * HH + bob;
  const brK = clamp(opts.breath ?? 0, -1, 1), br = brK * 0.045 * HH;
  const chin = torsoBot - Bd.torso * HH - br, hc = chin - H.b, crown = hc - H.b, hipY = torsoBot - 0.12 * HH;
  const T: Blob = { a: (((Bd.tw / 2) * W) / 1.06) * (o.slim ?? 1) * (1 + 0.025 * brK), b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.6, egg: o.build === "stout" ? 0.17 : 0.12,
    asym: 0.04 * facing, rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = 300 + 3 * u * facing;
  const sh = (side: number): P2 => [tcx + side * 0.85 * T.a, chin + 0.12 * HH];
  return { Bd, H, W, HH, u, sole, torsoBot, chin, hc, crown, hipY, T, tcx, sh, two, br };
};
/** where the hand holding a paper lantern is (front view) */
const paperHand = (r: ReturnType<typeof frontRig>): P2 => { const S = r.sh(1); return [r.tcx + 1.1 * r.T.a + 12 * r.u, S[1] + 0.48 * r.HH]; };
/** centre of the paper lantern relative to the hand holding its stick (u = 1 % head width) */
const PAPER_C: P2 = [21, 17];
/** where paperLanternArt last put a lantern centre (canvas units after the Pen rotation); read by the point helpers */
let PAPER_AT: P2 | null = null;
/** a 2D context that draws nothing (the point helpers run the body code just to see where the lantern lands) */
const nullCtx = (): CanvasRenderingContext2D => {
  const grad = { addColorStop: () => undefined };
  return new Proxy({}, {
    get: (_t, k) => (k === "createRadialGradient" || k === "createLinearGradient" ? () => grad : k === "getTransform" ? () => ({ a: 1 }) : () => undefined),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
};
/** design-canvas point (600 x 1000 card) of the paper lantern's centre for a front-view card with prop "lanternPaper":
 *  pass the same FrontOpts the card is drawn with (mode, phase, tilt, facing, seed) and put the flame / glow there
 *  (cast.ts: cardPoint(cam, x, y, z, cx, cy, scale, false)). Standing, facing 0: KHANH [476, 572], HAU [458, 744]. */
export const lanternPaperPoint = (o: Outfit, fo: FrontOpts = {}): [number, number] => {
  PAPER_AT = null;
  bodyFront(new Pen(nullCtx()), o, { mode: "stand", ...fo, prop: fo.prop === "lanternPaperOut" ? "lanternPaperOut" : "lanternPaper" });
  if (o.small && PAPER_AT) return smallPt(PAPER_AT, o.small);
  return PAPER_AT ?? [300, 600];
};
/** the same for a side-view card drawn with SideOpts.lanternPaper (walking): design point before mirroring */
export const lanternPaperSidePoint = (o: Outfit, so: SideOpts = {}): [number, number] => {
  PAPER_AT = null;
  bodySide(new Pen(nullCtx()), o, { ...so, lanternPaper: true });
  if (o.small && PAPER_AT) return smallPt(PAPER_AT, o.small);
  return PAPER_AT ?? [300, 600];
};

/** Outfit.small: design point -> where it lands on the card (scaled about the soles) */
const smallPt = (q: P2, s: number): P2 => [300 + (q[0] - 300) * s, 975 + (q[1] - 975) * s];
/** run a body drawing scaled about the soles (Outfit.small) */
const withSmall = (p: Pen, o: Outfit, fn: () => void) => {
  const s = o.small;
  if (!s || s === 1) { fn(); return; }
  const g = p.g;
  g.save(); g.translate(300 * (1 - s), 975 * (1 - s)); g.scale(s, s);
  fn();
  g.restore();
};

/** a tapered ribbon along a polyline (w0 at the start, w1 at the end): hair locks, wide sleeves */
const ribbon = (pts: P2[], w0: number, w1: number, ex = 1.4): P2[] => {
  const n = pts.length, L: P2[] = [], Rr: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const t = i / (n - 1), w = (w0 + (w1 - w0) * t ** ex) / 2;
    L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); Rr.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  return [...L, ...Rr.reverse()];
};
/** wide robe sleeve from the shoulder to the wrist (stops short of the hand), the cuff hanging open */
const sleeveArt = (p: Pen, a: [P2, P2, P2], col: string, u: number, light: number) => {
  const c = curve(a[0], a[1], a[2], 14).slice(0, 13), n = c.length;
  // one normal orientation for the whole arm: the side facing down is the "lower" edge that the cloth hangs from
  const D: P2 = [a[2][0] - a[0][0], a[2][1] - a[0][1]], sg = (D[0] >= 0 ? 1 : -1);
  const up: P2[] = [], lo: P2[] = [];
  for (let i = 0; i < n; i++) {
    const A2 = c[Math.max(0, i - 1)], B2 = c[Math.min(n - 1, i + 1)];
    let dx = B2[0] - A2[0], dy = B2[1] - A2[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const nx = -dy * sg, ny = dx * sg, t = i / (n - 1), w = (10 + 8 * t) * u / 2, drape = 15 * u * t ** 1.6 * Math.abs(dx);
    up.push([c[i][0] - nx * w, c[i][1] - ny * w]);
    lo.push([c[i][0] + nx * w, c[i][1] + ny * w + drape]);
  }
  const pts = [...up, ...lo.reverse()];
  p.gradFill(pts, col, mul(col, SH_CLOTH), light, 0.3);
  const e0 = up[n - 1], e1 = lo[0], m: P2 = [(e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2];
  const ang = Math.atan2(e1[1] - e0[1], e1[0] - e0[0]);
  p.ell(m[0], m[1], Math.hypot(e1[0] - e0[0], e1[1] - e0[1]) / 2 - 1.2 * u, 3 * u, shade(col, 0.42), 0, 0, 360, (ang * 180) / Math.PI);
  p.poly(pts, null, 2.6 * u);
};
/** long skirt (váy) / robe hem, front view: waist yTop (hidden under the tunic) to the hem yHem; sit = draped over the knees */
const skirtFront = (p: Pen, col: string, light: number, thick: number, ow: number, u: number, xc: number, yTop: number, yHem: number,
  wTop: number, wHem: number, sway: number, knee: [number, number] | null, clay: boolean, seed: number) => {
  const right: P2[] = knee ? [...curve([xc + wTop, yTop], [xc + knee[0] * 0.9, knee[1] - 4 * u], [xc + knee[0], knee[1]], 6), ...curve([xc + knee[0], knee[1]], [xc + (knee[0] + wHem) / 2 + u, (knee[1] + yHem) / 2], [xc + wHem + sway, yHem], 6).slice(1)]
    : curve([xc + wTop, yTop], [xc + (wTop + wHem) / 2 + 2.5 * u, (yTop + yHem) / 2], [xc + wHem + sway, yHem], 12);
  const left: P2[] = right.map(([x, y]) => [2 * xc - x + 2 * sway * (y - yTop) / (yHem - yTop), y] as P2).reverse();
  const hem: P2[] = [];
  for (let i = 1; i < 14; i++) { const t = i / 14; hem.push([xc + wHem + sway - 2 * wHem * t, yHem + 4.5 * u * Math.sin(Math.PI * t)]); }
  const pts: P2[] = [...right, ...hem, ...left];
  p.gradFill(pts, col, mul(col, SH_CLOTH), light);
  p.clip(pts, () => {
    const y0 = knee ? knee[1] + 4 * u : yTop + 0.3 * (yHem - yTop);
    for (const k of [-0.5, 0.05, 0.55]) {
      const xa = xc + k * (knee ? knee[0] * 0.8 : wTop * 0.9), xb = xc + k * wHem * 0.95 + sway;
      p.stroke(curve([xa, y0], [(xa + xb) / 2 + 2 * u * k, (y0 + yHem) / 2], [xb, yHem + 2 * u], 8), 1.4 * u, shade(col, 0.76));
    }
    p.stroke(curve([xc - wHem, yHem - 5 * u], [xc + sway, yHem - 1 * u], [xc + wHem, yHem - 5 * u], 10), 1.2 * u, shade(col, 0.8));
    if (clay) cracks(p, [[[xc - 0.3 * wHem, y0], 1.3, 0.42 * (yHem - y0)], [[xc + 0.5 * wHem, yHem - 4 * u], -1.9, 0.3 * (yHem - y0)]], u, seed + 3);
  });
  p.inkRing(pts, ow, thick);
};
/** rope wraps over the torso and arms (bound sick man), with a knot and two loose ends */
const ropeArt = (p: Pen, xc: number, ys: number[], w: number, u: number) => {
  const col = "#c4a266", dark = "#8a6a3a";
  ys.forEach((y, i) => {
    const c = curve([xc - w, y - 3 * u], [xc + 0.05 * w, y + 4 * u], [xc + w, y - 3 * u], 16);
    p.band(c, col, 5 * u, 1.2 * u, "round");
    for (let k = 1; k < c.length - 1; k += 1) { const [x, yy] = c[k]; p.stroke([[x - 1.6 * u, yy - 2 * u], [x + 1.6 * u, yy + 2 * u]], 0.9 * u, dark); }
    if (i === 1) {
      const kx = xc + 0.12 * w, ky = y + 4 * u;
      p.ell(kx, ky, 5 * u, 4 * u, col, 1.4 * u);
      for (const sd of [-1, 1]) p.band(curve([kx + sd * 2 * u, ky + 3 * u], [kx + sd * 5 * u, ky + 11 * u], [kx + sd * 3 * u, ky + 19 * u], 6), col, 3.6 * u, 1.1 * u, "round");
    }
  });
};
/** pear-shaped lute (đàn tỳ bà): body centre c, axis angle ang (canvas radians, body -> neck), overall length L */
const luteArt = (p: Pen, c: P2, ang: number, L: number, u: number) => {
  const d: P2 = [Math.cos(ang), Math.sin(ang)], n: P2 = [-d[1], d[0]];
  const at = (s: number, t = 0): P2 => [c[0] + d[0] * s * L + n[0] * t * L, c[1] + d[1] * s * L + n[1] * t * L];
  const rot = Math.atan2(d[0], -d[1]);
  const wood = "#c98f52", rim = "#6b3d22", neck = "#5a3420", peg = "#33201a", bone = "#eadbb6";
  // pegbox bent back, pegs, then the neck
  const pb = [at(0.63), at(0.8, 0.025)];
  for (const s of [0.68, 0.75]) for (const sd of [-1, 1]) {
    const q = lerp2(pb[0], pb[1], (s - 0.63) / 0.17);
    p.band([q, [q[0] + n[0] * sd * 0.06 * L, q[1] + n[1] * sd * 0.06 * L]], peg, 1.6 * u, 0.9 * u, "round");
  }
  p.band(pb, neck, 0.062 * L, 1.2 * u, "round");
  p.band([at(0.2), at(0.64)], neck, 0.074 * L, 1.2 * u, "butt");
  // body: dark rim (thickness) then the soundboard
  const B: Blob = { a: 0.2 * L, b: 0.29 * L, nTop: 2.0, nBot: 2.1, egg: 0.42, asym: 0, rot, noise: 0, seed: 1 };
  const off: P2 = [c[0] + 1.6 * u, c[1] + 2.2 * u];
  p.poly(blobPts(off[0], off[1], B), rim, 2.2 * u);
  const bp = blobPts(c[0], c[1], B);
  p.gradFill(bp, wood, shade(wood, 0.82), rad(-120), 0.35);
  p.poly(bp, null, 2.2 * u);
  // frets on the neck, two small crescent sound holes, the bridge, four strings
  for (const s of [0.3, 0.4, 0.49, 0.57]) p.band([at(s, -0.042), at(s, 0.042)], bone, 1.3 * u, 0.7 * u);
  for (const sd of [-1, 1]) { const [hx, hy] = at(0.1, sd * 0.085); p.ell(hx, hy, 1.8 * u, 1.1 * u, rim, 0, 0, 360, (rot * 180) / Math.PI); }
  p.band([at(-0.17, -0.07), at(-0.17, 0.07)], peg, 2.2 * u, 0.8 * u, "round");
  for (const t of [-0.033, -0.011, 0.011, 0.033]) p.stroke([at(-0.17, t * 1.3), at(0.64, t * 0.75)], 0.7 * u, "rgba(250,240,215,0.9)");
};
/** axe / broken axe handle / wooden mallet / hammer in a hand at (hx, hy), rotated by ang (0 = handle straight up, head
 *  at the top, blade toward +x) */
const toolArt = (p: Pen, kind: ToolK, hx: number, hy: number, ang: number, u: number) => {
  const Rh = (pts: P2[]) => rotPts(pts, ang, hx, hy);
  const wood = "#8a5a34";
  if (kind === "axeBroken") { // the handle alone, its top split where the head flew off
    p.band(Rh([[hx, hy + 12 * u], [hx, hy - 42 * u]]), wood, 5 * u, 1.5 * u, "round");
    p.poly(Rh([[hx - 2.5 * u, hy - 42 * u], [hx - 1.5 * u, hy - 49 * u], [hx, hy - 45 * u], [hx + 1 * u, hy - 51 * u], [hx + 2.5 * u, hy - 43 * u]]), "#c9a36e", 1.2 * u);
  } else {
    p.band(Rh([[hx, hy + 12 * u], [hx, hy - 46 * u]]), wood, 5 * u, 1.5 * u, "round");
    if (kind === "hammer") p.poly(Rh([[hx - 12 * u, hy - 58 * u], [hx + 20 * u, hy - 58 * u], [hx + 20 * u, hy - 42 * u], [hx - 12 * u, hy - 42 * u]]), "#7d848c", 2.2 * u);
    else if (kind === "mallet") {
      const head = Rh(rrect(hx - 14 * u, hy - 61 * u, hx + 18 * u, hy - 40 * u, 5 * u, 4));
      p.poly(head, "#a06e40", 2.2 * u);
      for (const x of [hx - 8 * u, hx + 12 * u]) p.stroke(Rh([[x, hy - 59 * u], [x, hy - 42 * u]]), 1.2 * u, "#6e4626");
    } else axeHeadArt(p, Rh, hx, hy - 50 * u, u);
  }
  p.dot(hx, hy, 5.5 * u);
};
/** iron axe head around (x, y) in a rotation R: socket over the handle, blade toward +x with a bright edge */
const axeHeadArt = (p: Pen, R: (pts: P2[]) => P2[], x: number, y: number, u: number) => {
  const edge = curve([x + 23 * u, y - 15 * u], [x + 27 * u, y], [x + 23 * u, y + 15 * u], 8);
  const blade: P2[] = [[x - 7 * u, y - 7 * u], [x + 7 * u, y - 6 * u], ...edge, [x + 7 * u, y + 6 * u], [x - 7 * u, y + 7 * u]];
  p.poly(R(blade), "#6c737b", 2.2 * u);
  p.stroke(R(curve([x + 20 * u, y - 12 * u], [x + 23.5 * u, y], [x + 20 * u, y + 12 * u], 8)), 2.6 * u, "#c3cad0");
  p.stroke(R([[x + 3 * u, y - 5 * u], [x + 3 * u, y + 5 * u]]), 1.2 * u, "#4a5056");
};
/** yellow paper talisman held at its foot by a hand at (hx, hy), standing up, tilted by deg; squeeze < 1 = seen at an angle */
const talismanArt = (p: Pen, hx: number, hy: number, u: number, deg = 6, squeeze = 1) => {
  const R = (pts: P2[]) => rotPts(pts.map(([x, y]) => [hx + (x - hx) * squeeze, y] as P2), rad(deg), hx, hy);
  const red = "#c0281f", w = 7.5 * u;
  p.poly(R([[hx - w, hy - 64 * u], [hx + w, hy - 64 * u], [hx + w, hy + 3 * u], [hx - w, hy + 3 * u]]), "#ecc94b", 1.6 * u);
  p.stroke(R([[hx - 4.5 * u, hy - 57 * u], [hx + 4.5 * u, hy - 57 * u]]), 2.2 * u, red);
  for (const x of [-3, 0, 3]) p.dot(...R([[hx + x * u, hy - 51.5 * u]])[0], 1.2 * u, red);
  p.stroke(R([[hx, hy - 47 * u], [hx - 3.5 * u, hy - 41 * u], [hx + 3.5 * u, hy - 35 * u], [hx - 3.5 * u, hy - 29 * u], [hx + 3.5 * u, hy - 23 * u], [hx, hy - 18 * u]]), 1.7 * u, red);
  p.poly(R(ellPts(hx, hy - 11 * u, 3.4 * u, 3 * u)), null, 1.5 * u);
  p.stroke(R([[hx - 4 * u, hy - 11 * u], [hx + 4 * u, hy - 11 * u]]), 1.2 * u, red);
  p.dot(hx, hy, 5.5 * u);
};
/** a torn scrap of dark-indigo cloth hanging from a hand at (hx, hy) */
const scrapArt = (p: Pen, hx: number, hy: number, u: number, flip = 1) => {
  const col = "#2f3d5c";
  const pts: P2[] = [[hx - 3 * u, hy - 2 * u], [hx + 4 * u, hy - 1 * u], [hx + 13 * u * flip, hy + 12 * u], [hx + 15 * u * flip, hy + 27 * u],
    [hx + 10 * u * flip, hy + 31 * u], [hx + 7 * u * flip, hy + 27 * u], [hx + 3 * u * flip, hy + 34 * u], [hx - 1 * u * flip, hy + 29 * u],
    [hx - 5 * u * flip, hy + 36 * u], [hx - 8 * u * flip, hy + 28 * u], [hx - 11 * u * flip, hy + 31 * u], [hx - 10 * u * flip, hy + 12 * u]];
  p.poly(pts, col, 2 * u);
  p.stroke(curve([hx + 1 * u, hy + 2 * u], [hx + 3 * u * flip, hy + 16 * u], [hx + 1 * u * flip, hy + 28 * u], 6), 1.3 * u, shade(col, 0.6));
  p.stroke([[hx - 9 * u * flip, hy + 9 * u], [hx + 12 * u * flip, hy + 11 * u]], 1 * u, "rgba(150,165,200,0.55)");
  p.stroke(curve([hx + 10 * u * flip, hy + 31 * u], [hx + 12 * u * flip, hy + 36 * u], [hx + 9 * u * flip, hy + 40 * u], 4), 0.8 * u, col);
  p.dot(hx, hy, 5.5 * u);
};
/** paper lantern (đèn lồng giấy) hanging on a short cord from a bamboo stick held by a hand at (hx, hy); the stick
 *  points toward +x * dir. Lantern centre = hand + PAPER_C u. */
export const paperLanternArt = (p: Pen, hx: number, hy: number, u: number, lit: boolean, dir = 1) => {
  const tx = hx + 20 * u * dir, ty = hy - 9 * u, cx = hx + PAPER_C[0] * u * dir, cy = hy + PAPER_C[1] * u, rx = 13.5 * u, ry = 15.5 * u;
  PAPER_AT = p.P(cx, cy);
  p.band([[hx - 5 * u * dir, hy + 2.5 * u], [tx, ty]], "#b8975a", 2.2 * u, 0.9 * u, "round");
  p.stroke([[tx, ty], [cx, cy - ry - 2 * u]], 1.1 * u);
  const body = ellPts(cx, cy, rx, ry);
  if (lit) {
    const g = p.g, [gx, gy] = p.P(cx, cy + 2 * u), gr = g.createRadialGradient(gx, gy, 0, gx, gy, ry * 1.05);
    gr.addColorStop(0, "#ffe6a6"); gr.addColorStop(0.45, "#ffb85e"); gr.addColorStop(1, "#e2622c");
    p.path(body, true); g.fillStyle = gr; g.fill();
  } else p.poly(body, "#a8483a", 0);
  const rib = lit ? "rgba(110,40,18,0.55)" : "rgba(50,18,14,0.6)";
  p.clip(body, () => {
    p.g.strokeStyle = rib;
    for (const k of [0.38, 0.75]) { p.path(ellPts(cx, cy, rx * k, ry), true); p.g.lineWidth = 1 * u; p.g.stroke(); }
    p.stroke([[cx, cy - ry], [cx, cy + ry]], 1 * u, rib);
    for (const m of [-0.45, 0, 0.45]) p.arc(cx, cy + ry * m, rx * Math.sqrt(1 - m * m), 1.6 * u, 0, 180, 0.9 * u, rib);
  });
  p.poly(body, null, 2.1 * u);
  for (const s of [-1, 1]) p.poly(rrect(cx - 6.5 * u, cy + s * ry - 2 * u, cx + 6.5 * u, cy + s * ry + 2 * u, 1 * u, 3), "#3a2a20", 1.2 * u);
  p.stroke([[cx, cy + ry + 2 * u], [cx, cy + ry + 9 * u]], 2 * u, "#b5322a");
  p.dot(hx, hy, 5.5 * u);
};
/** long thin beard hanging from the chin (x0, y0) */
const beardArt = (p: Pen, x0: number, y0: number, len: number, u: number, col: string, lean = 0) => {
  const c = curve([x0, y0], [x0 + 2 * u + lean * 0.5, y0 + len * 0.5], [x0 - 1 * u + lean, y0 + len], 10);
  const pts = ribbon(c, 11 * u, 1.5 * u, 0.8);
  p.poly(pts, col, 1.6 * u);
  p.stroke(c.slice(1, 8), 0.9 * u, mix(col, "#ffffff", 0.22));
};
/** ghost hair extras: a lock over one eye (screen-right eye), a few stray strands */
const messyFront = (p: Pen, o: Outfit, H: Blob, cx: number, hc: number, u: number, facing: number, seed: number) => {
  const col = o.hair ?? "#16131a", crown = hc - H.b, ex = cx + 7 * u * facing + 13 * u;
  const top: P2 = [cx + 4 * u + 0.03 * H.a * facing, crown + 0.12 * H.b];
  const c = [...curve(top, [ex + 6 * u, hc - 0.45 * H.b], [ex + 1 * u, hc + 0.1 * H.b], 8), ...curve([ex + 1 * u, hc + 0.1 * H.b], [ex - 4 * u, hc + 0.5 * H.b], [ex - 1 * u, hc + 1.0 * H.b], 8).slice(1)];
  p.poly(ribbon(c, 13 * u, 2 * u, 1.1), col, 1.3 * u);
  p.stroke(curve([top[0] + 9 * u, top[1] + 4 * u], [ex + 13 * u, hc - 0.2 * H.b], [ex + 8 * u, hc + 0.75 * H.b], 10), 1.4 * u, col);
  for (const [sd, k] of [[-1, 0], [1, 1]] as const) { // two loose wisps off the sides of the hair
    const y0 = hc + (0.1 + 0.25 * k) * H.b, x0 = cx + sd * 0.98 * H.a;
    p.stroke(curve([x0, y0], [x0 + sd * (5 + 3 * rnd(seed, 30 + k)) * u, y0 + 16 * u], [x0 + sd * (3 + 4 * rnd(seed, 33 + k)) * u, y0 + 36 * u], 8), 1.3 * u, col);
  }
};

/** bamboo pole from a to b (thick end at a) with node rings */
const bambooArt = (p: Pen, a: P2, b: P2, w0: number, w1: number, u: number, col = "#c9a85a") => {
  const pts: P2[] = []; for (let i = 0; i <= 12; i++) pts.push(lerp2(a, b, i / 12));
  const rb = ribbon(pts, w0, w1, 1);
  p.poly(rb, col, 1.5 * u);
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, n = Math.max(2, Math.round(L / (30 * u)));
  for (let i = 1; i < n; i++) { const t = i / n, q = lerp2(a, b, t), w = lerp(w0, w1, t) / 2; p.stroke([[q[0] + nx * w, q[1] + ny * w], [q[0] - nx * w, q[1] - ny * w]], 1.1 * u, shade(col, 0.62)); }
  p.stroke([lerp2(a, b, 0.04), lerp2(a, b, 0.9)].map(([x, y]) => [x + nx * w0 * 0.18, y + ny * w0 * 0.18] as P2), 0.8 * u, mix(col, "#ffffff", 0.45));
};
/** fishing rod held at (hx, hy), pointing up and outward (+x * dir); the line hangs straight down from the tip to a float.
 *  Drawn in the caller's Pen rotation except the line, which hangs plumb. */
const rodArt = (p: Pen, hx: number, hy: number, u: number, HH: number, dir = 1) => {
  const len = Math.min(1.9 * HH, (hy - 36) / 0.95, (dir > 0 ? 588 - hx : hx - 12) / 0.33), dx = 0.31 * dir, dy = -0.95;
  const butt: P2 = [hx - dx * 15 * u, hy - dy * 15 * u], tip: P2 = [hx + dx * len, hy + dy * len];
  const rot = p.rot, T2 = p.P(tip[0], tip[1]);
  p.rot = null;
  const drop = Math.min(len * 0.86, 950 - T2[1]), fy = T2[1] + drop;
  p.stroke(curve(T2, [T2[0] - 2 * u * dir, T2[1] + drop * 0.5], [T2[0], fy], 8), 0.9 * u, "#4a4350");
  p.ell(T2[0], fy + 3 * u, 2.3 * u, 3.6 * u, "#f3efe6", 1.1 * u); p.ell(T2[0], fy + 1.6 * u, 2.3 * u, 2 * u, "#c9373a", 0, 180, 360);
  p.stroke([[T2[0], fy + 6.5 * u], [T2[0], fy + 12 * u]], 0.8 * u, "#4a4350");
  p.rot = rot;
  bambooArt(p, butt, tip, 3.6 * u, 1.3 * u, u);
  p.dot(hx, hy, 5.5 * u);
};
/** walking stick: crook handle in the hand (hx, hy), the tip on the ground at design point (gx, gy) */
const caneArt = (p: Pen, hx: number, hy: number, gx: number, gy: number, u: number, dir = 1) => {
  const col = "#7a5234";
  p.band([[hx + 1 * u * dir, hy - 2 * u], [gx, gy]], col, 3.4 * u, 1.3 * u, "round");
  p.band(curve([hx + 1 * u * dir, hy - 1 * u], [hx - 2 * u * dir, hy - 9 * u], [hx - 10 * u * dir, hy - 4 * u], 8), col, 3.4 * u, 1.3 * u, "round");
};
/** rice bowl seen from the front, slightly from above: rim centre (cx, cy); white rice heaped over the rim, a blue line
 *  under the rim, chopsticks laid across */
const bowlArt = (p: Pen, cx: number, cy: number, u: number) => {
  const rx = 15.5 * u, china = "#eef1f3";
  const body: P2[] = [[cx - rx, cy], ...ellPts(cx, cy, rx, 14 * u, 180, 0, 0, 20).slice(1, -1), [cx + rx, cy]];
  p.poly([[cx - 6 * u, cy + 12 * u], [cx + 6 * u, cy + 12 * u], [cx + 5 * u, cy + 16.5 * u], [cx - 5 * u, cy + 16.5 * u]], shade(china, 0.9), 1.7 * u);
  p.poly(ellPts(cx, cy - 1 * u, 12.5 * u, 9.5 * u, 180, 360, 0, 16), "#fdfcf6", 1.7 * u);
  for (const [dx, dy] of [[-6, -4], [-1, -6.5], [4.5, -4.5], [0, -2.5]] as const) p.arc(cx + dx * u, cy + dy * u, 2.2 * u, 1.3 * u, 200, 340, 0.8 * u, "#cfcabb");
  p.gradFill(body, china, shade(china, 0.82), rad(-120), 0.3);
  p.clip(body, () => p.stroke(curve([cx - rx, cy + 3 * u], [cx, cy + 7.5 * u], [cx + rx, cy + 3 * u], 10), 1.5 * u, "#4a6fa8"));
  p.poly(body, null, 1.9 * u);
  for (const d of [0, 2.6]) p.band([[cx - 20 * u, cy - 0.5 * u - d * u], [cx + 21 * u, cy - 4.5 * u - d * u]], "#7a4a2a", 1.5 * u, 0.8 * u, "round");
};

const bodyFront0 = (p: Pen, o: Outfit, opts: FrontOpts) => {
  const { phase = 0, expr = "neutral", mode = "march", blink = false, lift = 60, prop = null, tilt = 0, headTilt = 0, wave,
    light = DEF_LIGHT, facing = 0, seed = 1, back = false } = opts;
  const look = opts.gaze ? clamp(opts.gaze[0], -1.5, 1.5) : opts.look ?? 0, gazeY = opts.gaze ? clamp(opts.gaze[1], -1.5, 1.5) : 0;
  const rig = frontRig(o, opts), { H, W, HH, u, sole, torsoBot, chin, hc, hipY, T, tcx, sh, two } = rig;
  const skin = o.skin ?? SKIN, lid = o.clay ? 0 : lidOf(blink);
  const thick = thickAngle(light), ow = 5 * u;
  const legCol = mix(o.pants, INK, 0.55), armCol = mix(o.jacket, INK, 0.5), footCol = o.boots;
  const legW = 5.8 * u, footW = 7.5 * u;
  const skirt = (o.dress || o.robe) && mode !== "fall" ? (o.robe ? o.jacket : o.dress!) : null;
  const tool = toolOf(prop);
  // opt-in acting: which gesture (if any) is in play
  const twoH = (Array.isArray(prop) && prop[0] === "dan") || prop === "danHold" || prop === "rope" || prop === "cup" || prop === "kite";
  const canAct = mode !== "fall" && !twoH;
  let gName: Gesture | null = canAct && opts.gesture ? opts.gesture[0] : null, gK = gName ? clamp(opts.gesture![1] || 0, 0, 1) : 0;
  if (canAct && prop === "bowl" && gName !== "hold") { gName = "hold"; gK = 1; }
  if (!(gK > 0)) gName = null;
  const hugK = gName === "hug" && mode === "sit" && !skirt ? gK : 0; // knees drawn up in front of the chest
  const sitLeg = (side: number): [P2, P2, P2] => {
    const h: P2 = [300 + side * 15 * u, hipY];
    return [h, lerp2([300 + side * 36 * u, hipY + 0.2 * HH], [300 + side * 20 * u, torsoBot - 0.42 * HH], hugK), lerp2([300 + side * 44 * u, sole - 8 * u], [300 + side * 19 * u, sole - 5 * u], hugK)];
  };
  // ---- legs + feet (not rotated) ----
  p.rot = null;
  if (mode === "sit") {
    for (const side of [-1, 1]) {
      let h: P2 = [300 + side * 15 * u, hipY], k: P2 = [300 + side * 36 * u, hipY + 0.2 * HH], f: P2 = [300 + side * 44 * u, sole - 8 * u];
      if (hugK) [h, k, f] = sitLeg(side);
      if (!skirt) p.stroke(curve(h, k, f), legW, legCol);
      footStroke(p, [f[0] - side * 2 * u, f[1]], [f[0] + side * 12 * u, f[1] - 5 * u], footW, footCol);
    }
    if (skirt) skirtFront(p, skirt, light, thick, ow, u, 300, torsoBot - 0.14 * HH, sole - 10 * u, 0.92 * T.a, 52 * u, 0, [44 * u, hipY + 0.17 * HH], !!o.clay, seed);
  } else if (mode === "fall") {
    const legs: [P2, P2, P2][] = [
      [[300 - 15 * u, hipY], [300 - 46 * u, hipY + 0.5 * HH], [300 - 70 * u, hipY + 0.72 * HH]],
      [[300 + 15 * u, hipY], [300 + 50 * u, hipY + 0.45 * HH], [300 + 76 * u, hipY + 0.22 * HH]],
    ];
    legs.forEach(([h, k, f], i) => {
      p.stroke(curve(h, k, f), legW, legCol);
      footStroke(p, f, [f[0] + (i ? 14 : -14) * u, f[1] + (i ? -6 : 4) * u], footW, footCol);
    });
  } else if (skirt) {
    // feet peeking under the hem (a small lift on each step), then the skirt over them
    const L = mode === "march" ? lift * 0.25 : mode === "stroll" ? lift * 0.15 : 0;
    for (const [side, ph] of [[-1, 0], [1, 0.5]] as const) {
      const up = Math.max(0, Math.sin(two * (phase + ph))) * L, fx = 300 + side * 15 * u, fy = sole - 4 * u - up;
      footStroke(p, [fx - side * 3 * u, fy], [fx + side * 11 * u, fy + 0.5 * u], footW, footCol);
    }
    const sway = mode === "march" ? 3 * u * Math.sin(two * phase) : mode === "stroll" ? 2 * u * Math.sin(two * phase) : 0;
    const hem = o.robe ? sole - 7 * u : sole - 9 * u, wHem = o.robe ? 1.12 * T.a + 8 * u : 1.0 * T.a + 6 * u;
    skirtFront(p, skirt, light, thick, ow, u, 300, torsoBot - 0.16 * HH, hem, 0.94 * T.a, wHem, sway, null, !!o.clay, seed);
  } else {
    const L = mode === "march" ? lift * 1.25 : mode === "stroll" ? lift * 0.55 : 0;
    for (const [side, ph] of [[-1, 0], [1, 0.5]] as const) {
      const up = Math.max(0, Math.sin(two * (phase + ph))) * L;
      const hx = 300 + side * 15 * u, fx = 300 + side * 22 * u, fy = sole - 4 * u - up;
      const k: P2 = [(hx + fx) / 2 + side * (1.5 * u + up * 0.16), (hipY + fy) / 2 - up * 0.08];
      p.stroke(curve([hx, hipY], k, [fx, fy]), legW, legCol);
      footStroke(p, [fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 0.5 * u], footW, footCol);
    }
  }
  // ---- upper body: rotates about the hips (tilt + a small weight-shift sway on every step) ----
  const sway = mode === "march" ? 1.6 * Math.sin(two * phase) : mode === "stroll" ? 1.0 * Math.sin(two * phase) : 0;
  const A = tilt + sway + (canAct && prop === "cane" && mode !== "sit" ? 2.5 : 0);
  p.rot = A ? [rad(A), 300, hipY] : null;
  if (!back) hairBack(p, o, H, 300, hc, mode === "sit" ? torsoBot - 0.1 * HH : torsoBot + (o.messy ? 0.62 : 0.02) * HH, light, thick, ow, false, seed);
  const tp = blobPts(tcx, torsoBot - T.b, T);
  const hang = (side: number, fwd: number): [P2, P2, P2] => {
    const S = sh(side), ex = tcx + side * (1.12 * T.a + 4 * u);
    const hx = ex + side * 3 * u - side * 6 * u * Math.max(0, fwd) + side * 4 * u * Math.max(0, -fwd);
    return [S, [ex, S[1] + 0.48 * HH], [hx, chin + 1.04 * HH - Math.abs(fwd) * 9 * u + 0.7 * rig.br]];
  };
  const sw = mode === "march" || mode === "stroll" ? Math.sin(two * phase) : 0;
  // rifle at the order: butt by the right hip, held by the hanging right hand, muzzle past the crown
  const R0: P2 = [300 + 47 * u, torsoBot + 0.12 * HH], R1: P2 = [300 + 64 * u, rig.crown - 0.32 * HH];
  const rifle = !!o.rifle && (mode === "march" || mode === "stand" || mode === "stroll");
  type Arm = { pts: [P2, P2, P2]; front: boolean };
  const arms: Arm[] = [];
  // lute: body centre, axis angle, length
  const lute = Array.isArray(prop) && prop[0] === "dan" ? { c: [tcx + 0.3 * T.a, torsoBot - 0.24 * HH] as P2, ang: rad(-150), L: 1.25 * HH, k: clamp(prop[1], 0, 1) }
    : prop === "danHold" ? { c: [tcx + 0.04 * T.a, torsoBot - 0.24 * HH] as P2, ang: rad(-114), L: 1.08 * HH, k: 0 } : null;
  if (lute) {
    const d: P2 = [Math.cos(lute.ang), Math.sin(lute.ang)], n: P2 = [-d[1], d[0]];
    const at = (s: number, t = 0): P2 => [lute.c[0] + d[0] * s * lute.L + n[0] * t * lute.L, lute.c[1] + d[1] * s * lute.L + n[1] * t * lute.L];
    const SL = sh(-1), SR = sh(1);
    if (prop === "danHold") {
      arms.push({ pts: [SL, [tcx - 1.15 * T.a - 8 * u, SL[1] + 0.42 * HH], at(0.38, 0.01)], front: true });
      arms.push({ pts: [SR, [tcx + 1.15 * T.a + 8 * u, SR[1] + 0.36 * HH], at(-0.06, 0.2)], front: true });
    } else {
      arms.push({ pts: [SL, [tcx - 1.22 * T.a - 10 * u, SL[1] + 0.26 * HH], at(0.56, 0.01)], front: true });
      arms.push({ pts: [SR, [tcx + 1.22 * T.a + 12 * u, SR[1] + 0.34 * HH], at(0.04, -0.02 + (lute.k - 0.5) * 0.07)], front: true });
    }
  } else if (prop === "rope") {
    for (const sd of [-1, 1]) { const S = sh(sd); arms.push({ pts: [S, [tcx + sd * (1.04 * T.a + 2 * u), S[1] + 0.36 * HH], [tcx + sd * (1.0 * T.a + 3 * u), torsoBot - 0.08 * HH]], front: false }); }
  } else if (mode === "sit") for (const side of [-1, 1]) arms.push({ pts: [sh(side), [tcx + side * (1.1 * T.a + 6 * u), sh(side)[1] + 0.4 * HH], [tcx + side * (1.2 * T.a + 10 * u), torsoBot + 0.04 * HH]], front: false });
  else if (mode === "fall") for (const side of [-1, 1]) arms.push({ pts: [sh(side), [tcx + side * (1.15 * T.a + 12 * u), sh(side)[1] - 0.25 * HH], [tcx + side * (1.3 * T.a + 24 * u), sh(side)[1] - 0.68 * HH]], front: false });
  else {
    arms.push({ pts: prop === "shako" ? hang(-1, 0) : o.clay ? hang(-1, 0) : hang(-1, -sw), front: false });
    const S = sh(1);
    if (rifle) {
      const G = lerp2(R0, R1, 0.1);
      arms.push({ pts: [S, [tcx + 1.12 * T.a + 5 * u, S[1] + 0.45 * HH], G], front: false });
    } else if (wave !== undefined) {
      arms.push({ pts: [S, [tcx + 1.1 * T.a + 10 * u + 3 * u * wave, S[1] - 0.22 * HH], [tcx + 1.18 * T.a + 16 * u + 12 * u * wave, S[1] - 0.6 * HH]], front: false });
    } else if (prop === "icecream") {
      arms.push({ pts: [S, [tcx + 1.05 * T.a + 4 * u, S[1] + 0.45 * HH], [tcx + 0.5 * T.a, S[1] + 0.4 * HH]], front: true });
    } else if (tool && tool[0] !== "hammer") {
      const k = tool[1];
      const E = lerp2([tcx + 1.2 * T.a + 14 * u, S[1] - 0.05 * HH], [tcx + 1.2 * T.a + 10 * u, S[1] + 0.3 * HH], k);
      const Hd = lerp2([tcx + 1.3 * T.a + 26 * u, S[1] - 0.5 * HH], [tcx + 1.45 * T.a + 22 * u, S[1] + 0.35 * HH], k);
      arms.push({ pts: [S, E, Hd], front: true });
    } else if (tool) {
      const k = tool[1];
      const E = lerp2([tcx + 1.1 * T.a + 10 * u, S[1] - 0.15 * HH], [tcx + 1.2 * T.a + 10 * u, S[1] + 0.3 * HH], k);
      const Hd = lerp2([tcx + 1.15 * T.a + 14 * u, S[1] - 0.55 * HH], [tcx + 1.45 * T.a + 22 * u, S[1] + 0.35 * HH], k);
      arms.push({ pts: [S, E, Hd], front: true });
    } else if (prop === "wag") {
      arms.push({ pts: [S, [tcx + 1.15 * T.a + 8 * u, S[1] + 0.05 * HH], [tcx + 1.05 * T.a + 6 * u, S[1] - 0.42 * HH]], front: true });
    } else if (prop === "string") {
      arms.push({ pts: [S, [tcx + 1.1 * T.a + 12 * u, S[1] - 0.12 * HH], [tcx + 1.15 * T.a + 18 * u, S[1] - 0.62 * HH]], front: false });
    } else if (prop === "lantern" || prop === "lanternOut") {
      arms.push({ pts: [S, [tcx + 1.12 * T.a + 6 * u, S[1] + 0.38 * HH], [tcx + 1.05 * T.a + 10 * u, S[1] + 0.62 * HH]], front: true });
    } else if (prop === "lanternPaper" || prop === "lanternPaperOut") {
      arms.push({ pts: [S, [tcx + 1.14 * T.a + 6 * u, S[1] + 0.34 * HH], paperHand(rig)], front: true });
    } else if (prop === "talisman") {
      arms.push({ pts: [S, [tcx + 1.2 * T.a + 12 * u, S[1] + 0.06 * HH], [tcx + 1.1 * T.a + 15 * u, S[1] - 0.4 * HH]], front: true });
    } else if (prop === "scrap") {
      arms.push({ pts: [S, [tcx + 1.12 * T.a + 6 * u, S[1] + 0.4 * HH], [tcx + 1.0 * T.a + 12 * u, S[1] + 0.64 * HH]], front: true });
    } else arms.push({ pts: o.clay ? hang(1, 0) : hang(1, sw), front: false });
    if (prop === "cup" || prop === "kite") { // both hands in front: at the mouth (calling) or at the chest (holding the kite)
      arms.length = 0;
      for (const sd of [-1, 1]) {
        const S2 = sh(sd);
        arms.push(prop === "cup"
          ? { pts: [S2, [tcx + sd * (1.15 * T.a + 8 * u), S2[1] + 0.3 * HH], [300 + sd * 15 * u, hc + 0.62 * H.b]], front: true }
          : { pts: [S2, [tcx + sd * (1.1 * T.a + 4 * u), S2[1] + 0.32 * HH], [300 + sd * 20 * u, chin + 0.42 * HH]], front: true });
      }
    }
  }
  // ---- opt-in acting: one-handed new props, then the gesture blended over whatever the arms were doing ----
  const actArms = canAct && arms.length === 2, S1 = sh(1);
  if (actArms && prop === "rod") arms[1] = { pts: [S1, [tcx + 1.14 * T.a + 4 * u, S1[1] + 0.36 * HH], [tcx + 1.1 * T.a + 14 * u, S1[1] + 0.22 * HH]], front: true };
  if (actArms && prop === "cane") arms[1] = { front: true, pts: mode === "sit" ? [S1, [tcx + 1.2 * T.a + 8 * u, S1[1] + 0.3 * HH], [tcx + 1.25 * T.a + 20 * u, S1[1] + 0.2 * HH]]
    : [S1, [tcx + 1.16 * T.a + 8 * u, S1[1] + 0.34 * HH], [tcx + 1.12 * T.a + 16 * u, S1[1] + 0.6 * HH]] };
  /** where a gesture puts the elbow e and the hand h of the arm on side s. out = the arm swings out sideways to get there
   *  (else the hand travels straight, in front of the body); front = the arm ends up in front of the torso; over = 1 the
   *  hand, 2 the forearm too, lies over the head; r = hand dot radius in u */
  type GPose = { h: P2; e: P2; out?: boolean; front?: boolean; over?: 0 | 1 | 2; r?: number };
  const gPose = (name: Gesture, s: number): GPose => {
    const S = sh(s), X = (d: number) => tcx + s * d, belly = chin + 0.55 * rig.Bd.torso * HH;
    switch (name) {
      case "point": return { h: [S[0] + s * 0.8 * HH, S[1] - 0.27 * HH], e: [S[0] + s * 0.42 * HH, S[1] - 0.115 * HH], out: true };
      case "pat": return { h: [S[0] + s * 0.8 * HH, S[1] + 0.2 * HH], e: [S[0] + s * 0.43 * HH, S[1] + 0.03 * HH], out: true };
      case "up": { const h: P2 = [300 + s * (H.a + 40 * u), S[1] - 0.7 * HH]; return { h, e: [(S[0] + h[0]) / 2 + s * 0.07 * HH, (S[1] + h[1]) / 2 + 0.05 * HH], out: true }; }
      case "ears": return { h: [300 + s * 0.98 * H.a, hc + 0.15 * H.b], e: [300 + s * (H.a + 26 * u), S[1] - 0.2 * HH], out: true, over: 1, r: 6.8 };
      case "scratch": return { h: [300 + s * 0.96 * H.a, hc - 0.5 * H.b], e: [300 + s * (H.a + 24 * u), chin - 0.12 * HH], out: true, over: 1, r: 6 };
      case "reach": return { h: [X(0.62 * T.a), Math.min(S[1] + 1.1 * HH, sole - 8 * u)], e: [X(1.04 * T.a + 3 * u), S[1] + 0.56 * HH], front: true, r: 8.6 };
      case "hips": { const hy = torsoBot - 0.2 * HH; return { h: [X(0.9 * T.a), hy], e: [X(1.25 * T.a + 12 * u), lerp(S[1], hy, 0.5)], front: true }; }
      case "pray": return { h: [X(3.5 * u), chin + 0.34 * HH], e: [X(1.02 * T.a + 4 * u), chin + 0.42 * HH], front: true };
      case "hold": return { h: [X((prop === "bowl" ? 18.5 : 14) * u), belly], e: [X(1.05 * T.a + 5 * u), belly - 0.02 * HH], front: true };
      case "wipe": return { h: [300 + s * 9 * u, hc + 1 * u], e: [300 + s * (H.a + 9 * u), hc + 0.3 * H.b], front: true, over: 2, r: 6 };
      case "chin": return { h: [300 + s * 11 * u, hc + 0.93 * H.b], e: [X(1.0 * T.a), S[1] + 0.36 * HH], front: true, over: 1, r: 6.2 };
      case "cupcall": return { h: [300 + s * 20 * u, hc + 0.62 * H.b], e: [X(1.15 * T.a + 8 * u), S[1] + 0.3 * HH], front: true, over: 1, r: 6.5 };
      default: // hug: round the drawn-up knees when sitting, else round the own chest
        return hugK ? { h: [300 - s * 12 * u, torsoBot - 0.25 * HH], e: [X(1.14 * T.a + 7 * u), S[1] + 0.44 * HH], front: true }
          : { h: [X(-0.72 * T.a), chin + 0.5 * rig.Bd.torso * HH + s * 4 * u], e: [X(1.12 * T.a + 6 * u), S[1] + 0.42 * HH], front: true };
    }
  };
  const blendArm = (pts: [P2, P2, P2], G: GPose, s: number, k: number): [P2, P2, P2] => {
    const S = pts[0];
    const pol = (q: P2, wrap: boolean): [number, number] => { let a = Math.atan2(s * (q[0] - S[0]), q[1] - S[1]); if (wrap && a < -0.6) a += Math.PI * 2; return [a, Math.hypot(q[0] - S[0], q[1] - S[1])]; };
    const mixP = (q0: P2, q1: P2): P2 => {
      if (!G.out) return lerp2(q0, q1, k);
      const [a0, l0] = pol(q0, false), [a1, l1] = pol(q1, true), a = lerp(a0, a1, k), l = lerp(l0, l1, k);
      return [S[0] + s * l * Math.sin(a), S[1] + l * Math.cos(a)];
    };
    const e = mixP(pts[1], G.e), bulge = G.out ? 0 : 9 * u * Math.sin(Math.PI * k);
    return [S, [e[0] + s * bulge, e[1]], mixP(pts[2], G.h)];
  };
  type GArm = { i: number; s: number; G: GPose };
  const gArms: GArm[] = [];
  if (actArms && gName) {
    const busy = [prop === "shako", arms[1].front || rifle || wave !== undefined || prop === "string"];
    const one = ONE_ARM.has(gName);
    let pick = (opts.gesture?.[2] ?? (facing || 1)) > 0 ? 1 : 0;
    if (one && busy[pick]) pick = 1 - pick;
    for (const i of [0, 1]) {
      if (busy[i] || (one && i !== pick)) continue;
      const s = i ? 1 : -1, G = gPose(gName, s);
      arms[i] = { pts: blendArm(arms[i].pts, G, s, gK), front: false };
      gArms.push({ i, s, G });
    }
  }
  const drawArm = (a: Arm) => {
    if (o.robe) sleeveArt(p, a.pts, o.jacket, u, light);
    else p.stroke(curve(a.pts[0], a.pts[1], a.pts[2]), 5.2 * u, armCol);
    p.dot(a.pts[2][0], a.pts[2][1], 5.5 * u);
  };
  /** an arm drawn only farther than r from its shoulder: a gesture arm comes in front of the body (or the head) from
   *  the hand toward the shoulder as k rises, so nothing pops */
  const reveal = (a: Arm, r: number) => {
    if (r <= 0) { drawArmOver(a); return; }
    const g2 = p.g, [sx, sy] = p.P(a.pts[0][0], a.pts[0][1]);
    g2.save(); g2.beginPath(); g2.rect(-4000, -4000, 9000, 9000); g2.moveTo(sx + r, sy); g2.arc(sx, sy, r, 0, Math.PI * 2); g2.clip("evenodd");
    drawArmOver(a);
    g2.restore();
  };
  /** a gesture arm lying over the body: a thin ink rim keeps it readable on a dark jacket */
  const drawArmOver = (a: Arm) => {
    if (!o.robe) p.clip(tp, () => p.stroke(curve(a.pts[0], a.pts[1], a.pts[2]), 5.2 * u + 2.6 * u * sstep(0.1, 0.4, gK), INK));
    drawArm(a);
  };
  const armR = 1.25 * HH;
  // behind the body: rifle, sword, arms
  if (rifle) {
    p.band([R0, R1], "#7a4b2a", 5 * u, 1.5 * u, "round");
    p.band([lerp2(R0, R1, 0.6), R1], "#8d949c", 2.4 * u, 1.2 * u, "round");
  }
  if (o.sword && mode !== "sit") {
    const s0: P2 = [tcx - 0.75 * T.a, torsoBot - 0.2 * HH];
    p.band([s0, [s0[0] - Math.sin(rad(25)) * 0.8 * HH, s0[1] + Math.cos(rad(25)) * 0.8 * HH]], "#c9ccd2", 3 * u, 1.2 * u, "round");
  }
  for (const a of arms) if (!a.front) drawArm(a);
  // torso: shaded fill -> clothing clipped to it -> thick-thin ink ring
  p.gradFill(tp, o.jacket, mul(o.jacket, SH_CLOTH), light);
  p.clip(tp, () => {
    if (back) { // the plain back of the jacket: collar line, centre seam, the belt / sash going round
      if (o.belt) for (const s of [-1, 1]) p.band([[tcx - s * 0.75 * T.a, chin - 0.05 * HH], [tcx + s * 0.8 * T.a, torsoBot - 0.1 * HH]], o.belt!, 5.5 * u, 1.8 * u);
      if (o.sash) p.band([[tcx - 1.3 * T.a, torsoBot - 0.32 * HH], [tcx + 1.3 * T.a, torsoBot - 0.32 * HH]], o.sash, 0.13 * HH, 1.8 * u);
      if (o.puffer) for (let i = 0; i < 5; i++) {
        const y = chin + 0.16 * HH + i * 0.19 * HH;
        p.stroke(curve([tcx - 1.15 * T.a, y + 1 * u], [tcx, y + 9 * u], [tcx + 1.15 * T.a, y + 1 * u], 8), 1.6 * u, shade(o.jacket, 0.62));
      }
      const dk = shade(o.jacket, 0.7);
      p.stroke(curve([tcx - 0.5 * T.a, chin + 0.02 * HH], [tcx, chin + 0.1 * HH], [tcx + 0.5 * T.a, chin + 0.02 * HH], 8), 1.6 * u, dk);
      if (!o.puffer) p.stroke([[tcx, chin + 0.1 * HH], [tcx - 1 * u, torsoBot - (o.sash ? 0.4 : 0.06) * HH]], 1.3 * u, dk);
      for (const sd of [-1, 1]) p.stroke(curve([tcx + sd * 0.62 * T.a, chin + 0.2 * HH], [tcx + sd * 0.7 * T.a, chin + 0.36 * HH], [tcx + sd * 0.66 * T.a, chin + 0.5 * HH], 6), 1.2 * u, dk);
      return;
    }
    if (o.belt) {
      for (const s of [-1, 1]) p.band([[tcx - s * 0.75 * T.a, chin - 0.05 * HH], [tcx + s * 0.8 * T.a, torsoBot - 0.1 * HH]], o.belt!, 5.5 * u, 1.8 * u);
      const xc = tcx + 0.025 * T.a, yc = chin - 0.05 * HH + (torsoBot - 0.1 * HH - (chin - 0.05 * HH)) * (0.75 / 1.55);
      p.poly([[xc - 3.5 * u, yc - 3.5 * u], [xc + 3.5 * u, yc - 3.5 * u], [xc + 3.5 * u, yc + 3.5 * u], [xc - 3.5 * u, yc + 3.5 * u]], "#d9dde0", 1.5 * u);
    }
    if (o.cross) { // crossed collar: the under lapel shows at the neck, the over lapel runs down to the right side
      const nx = tcx + 2 * u * facing, cw = 5.5 * u;
      p.band([[nx + 0.46 * T.a, chin - 0.04 * HH], [nx + 0.02 * T.a, chin + 0.21 * HH]], o.cross, cw, 1.2 * u);
      p.band(curve([nx - 0.46 * T.a, chin - 0.04 * HH], [nx + 0.1 * T.a, chin + 0.26 * HH], [nx + 1.0 * T.a, chin + 0.64 * HH], 12), o.cross, cw, 1.2 * u);
    }
    if (o.sash) p.band([[tcx - 1.3 * T.a, torsoBot - 0.32 * HH], [tcx + 1.3 * T.a, torsoBot - 0.32 * HH]], o.sash, 0.13 * HH, 1.8 * u);
    if (o.puffer) { // quilted puffer: curved stitch rows with a soft highlight above each, zip down the middle, tee + collar at the neck
      for (let i = 0; i < 5; i++) {
        const y = chin + 0.16 * HH + i * 0.19 * HH;
        p.stroke(curve([tcx - 1.15 * T.a, y - 4 * u], [tcx, y + 4 * u], [tcx + 1.15 * T.a, y - 4 * u], 8), 4.5 * u, mix(o.jacket, "#ffffff", 0.12));
        p.stroke(curve([tcx - 1.15 * T.a, y + 1 * u], [tcx, y + 9 * u], [tcx + 1.15 * T.a, y + 1 * u], 8), 1.6 * u, shade(o.jacket, 0.62));
      }
      p.stroke([[tcx + 2 * u * facing, chin], [tcx + 2 * u * facing, torsoBot]], 2 * u, shade(o.jacket, 0.55));
      p.ell(tcx + 2 * u * facing, chin + 0.01 * HH, 13 * u, 0.1 * HH, o.collar ?? shade(o.jacket, 0.8), 1.6 * u, 0, 180);
      for (const sd of [-1, 1]) p.ell(tcx + sd * 21 * u, chin + 0.02 * HH, 11 * u, 0.085 * HH, mix(o.jacket, "#ffffff", 0.08), 1.8 * u, 0, 360, sd * 12);
    } else if (!o.cross && !o.robe && !o.clay) for (let i = 0; i < 4; i++) {
      const y = chin + 0.12 * HH + i * 0.2 * HH;
      if (o.sash && Math.abs(y - (torsoBot - 0.32 * HH)) < 0.08 * HH) continue;
      p.dot(tcx + 2 * u * facing, y, 2.2 * u + 0.8 * u, INK); p.dot(tcx + 2 * u * facing, y, 2.2 * u, o.buttons ?? shade(o.jacket, 0.7));
    }
    if (o.clay) cracks(p, [[[tcx - 0.45 * T.a, chin + 0.05 * HH], 1.2, 0.5 * HH], [[tcx + 0.6 * T.a, torsoBot - 0.45 * HH], 2.1, 0.3 * HH]], u, seed + 1);
  });
  if (o.sash && !back) { const s = facing || 1; p.poly([[tcx + s * 0.55 * T.a, torsoBot - 0.3 * HH], [tcx + s * 0.75 * T.a, torsoBot + 0.05 * HH], [tcx + s * 0.45 * T.a, torsoBot + 0.02 * HH]], o.sash, 1.6 * u); }
  p.inkRing(tp, ow, thick);
  if (hugK && !back) { // the drawn-up shins and feet come in front of the chest (revealed from the ground up as k rises)
    const g2 = p.g, rot = p.rot, yLine = lerp(torsoBot + 4 * u, torsoBot - 0.7 * HH, sstep(0, 0.45, hugK));
    p.rot = null;
    g2.save(); g2.beginPath(); g2.rect(-4000, yLine, 9000, 4000); g2.clip();
    for (const side of [-1, 1]) {
      const [h, k, f] = sitLeg(side);
      p.stroke(curve(h, k, f).slice(4), legW + 2.4 * u * hugK, INK); p.stroke(curve(h, k, f).slice(4), legW, legCol);
      footStroke(p, [f[0] - side * 2 * u, f[1]], [f[0] + side * 12 * u, f[1] - 5 * u], footW, footCol);
    }
    g2.restore();
    p.rot = rot;
  }
  if (lute) luteArt(p, lute.c, lute.ang, lute.L, u);
  // in front of the body: hands holding props
  for (const a of arms) if (a.front) {
    drawArm(a);
    const [hx, hy] = a.pts[2];
    if (prop === "icecream") {
      p.poly([[hx - 8 * u, hy - 12 * u], [hx + 8 * u, hy - 12 * u], [hx, hy + 7 * u]], "#e0a35a", 1.8 * u);
      p.ell(hx, hy - 19 * u, 11 * u, 10 * u, "#f7c6d9", 2.2 * u);
      p.dot(hx, hy, 5.5 * u);
    } else if (tool) toolArt(p, tool[0], hx, hy, rad(tool[0] === "hammer" ? -70 + 105 * tool[1] : -12 + 62 * tool[1]), u);
    else if (prop === "talisman") talismanArt(p, hx, hy, u, 8);
    else if (prop === "scrap") scrapArt(p, hx, hy, 1.45 * u);
  }
  for (const a of arms) if (a.front) {
    const [hx, hy] = a.pts[2];
    if (prop === "wag") p.stroke([[hx, hy], [hx - 2 * u, hy - 13 * u]], 3.4 * u);
    if (prop === "lantern" || prop === "lanternOut") lanternArt(p, hx, hy, u, prop === "lantern");
    if (prop === "lanternPaper" || prop === "lanternPaperOut") paperLanternArt(p, hx, hy, u, prop === "lanternPaper");
  }
  // ---- opt-in acting: gesture arms in front of the body, special hands, the new props ----
  if (actArms && prop === "cane") {
    const [hx, hy] = arms[1].pts[2], rot = p.rot, [fx, fy] = p.P(hx, hy);
    p.rot = null;
    caneArt(p, fx, fy, fx + (mode === "sit" ? 10 : 5) * u, sole - 1.5 * u, u);
    p.rot = rot;
    p.dot(hx, hy, 5.8 * u);
  }
  if (actArms && prop === "rod") rodArt(p, arms[1].pts[2][0], arms[1].pts[2][1], u, HH);
  if (!back) for (const ga of gArms) if (ga.G.front) reveal(arms[ga.i], armR * (1 - sstep(0.03, 0.3, gK)));
  for (const ga of gArms) {
    const [, e, h] = arms[ga.i].pts, dl = Math.hypot(h[0] - e[0], h[1] - e[1]) || 1, d: P2 = [(h[0] - e[0]) / dl, (h[1] - e[1]) / dl], kk = sstep(0.45, 1, gK);
    if (gName === "point" && kk > 0) p.stroke([h, [h[0] + d[0] * 16 * u * kk, h[1] + d[1] * 16 * u * kk - 1.5 * u * kk]], 3.8 * u);
    else if (gName === "reach") { // open grabbing hands, big because they come toward the viewer
      p.dot(h[0], h[1], lerp(5.5, 8, gK) * u);
      if (kk > 0 && !back) for (const j of [-1, 0, 1]) p.stroke([h, [h[0] + (j * 6.5 + ga.s * 1.5) * u * kk, h[1] + (11 - Math.abs(j) * 2.5) * u * kk]], 3.2 * u);
    }
    else if (gName === "pat" && kk > 0) p.ell(h[0] + d[0] * 4 * u * kk, h[1] + d[1] * 4 * u * kk, lerp(5.5, 9, kk) * u, lerp(5.5, 4.2, kk) * u, INK, 0, 0, 360, (Math.atan2(d[1], d[0]) * 180) / Math.PI);
    else if (ga.G.r && !(back && ga.G.front)) p.dot(h[0], h[1], lerp(5.5, ga.G.r, gK) * u);
  }
  if (gName === "pray" && gArms.length === 2 && !back) { // palms together: one upright shape between the two hands
    const kk = sstep(0.6, 1, gK), a0 = arms[0].pts[2], a1 = arms[1].pts[2];
    if (kk > 0) p.ell((a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2 - 5 * u * kk, lerp(3, 6, kk) * u, lerp(4, 11.5, kk) * u, INK, 0);
  }
  if (actArms && prop === "bowl" && gArms.length === 2 && !back) {
    const a0 = arms[0].pts[2], a1 = arms[1].pts[2];
    bowlArt(p, (a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2 - 6 * u, u);
    for (const q of [a0, a1]) p.dot(q[0], q[1], 5.5 * u);
  }
  if (prop === "rope") ropeArt(p, tcx, [chin + 0.3 * HH, chin + 0.56 * HH, chin + 0.82 * HH], T.a + 13 * u, u);
  if (prop === "kite") kiteArt(p, 300, chin + 0.3 * HH, 0.55 * HH);
  if (prop === "shako") { // carried by the left hand
    const [hx, hy] = arms[0].pts[2];
    p.poly([[hx - 14 * u, hy + 3 * u], [hx + 14 * u, hy + 3 * u], [hx + 16 * u, hy + 30 * u], [hx - 16 * u, hy + 30 * u]], "#3a3d47", 2.2 * u);
    p.ell(hx, hy + 31 * u, 3.5 * u, 3.5 * u, "#2b7a4b", 1.5 * u);
    p.dot(hx, hy, 5.5 * u);
  }
  // ---- head: rotates with the body, plus its own tilt about the chin ----
  const Ah = A + headTilt, [cpx, cpy] = rotAbout([300, chin], rad(A), [300, hipY]);
  p.rot = Ah ? [rad(Ah), 300, chin, cpx - 300, cpy - chin] : null;
  if (back) { // seen from behind: ears, the bare head, then its hair / hat from the back; no face
    if (o.hat !== "long" && o.hat !== "bonnet" && o.hat !== "silk") hatBehind(p, o, H, 300, hc, light, thick, ow, false, 0);
    const hp = blobPts(300, hc, H);
    for (const sd of [-1, 1]) { // ears: just proud of the head contour at eye height
      const ex = hp.reduce((m, q) => (Math.abs(q[1] - (hc + 0.16 * H.b)) < 0.2 * H.b && sd * q[0] > sd * m ? q[0] : m), 300);
      p.ell(ex - sd * 1.5 * u, hc + 0.16 * H.b, 5.5 * u, 9 * u, mul(skin, SH_SKIN), ow * 0.8);
    }
    p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
    p.inkRing(hp, ow, thick);
    if (o.clay) p.clip(hp, () => cracks(p, [[[300 - 0.28 * H.a, hc - 0.92 * H.b], 1.4, 0.5 * HH]], u, seed));
    hatBack(p, o, hp, H, 300, hc, light, seed, thick);
    p.rot = A ? [rad(A), 300, hipY] : null;
    for (const ga of gArms) if (ga.G.over && !ga.G.front) p.dot(arms[ga.i].pts[2][0], arms[ga.i].pts[2][1], lerp(5.5, ga.G.r ?? 5.5, gK) * u);
    p.rot = null;
    return;
  }
  hatBehind(p, o, H, 300, hc, light, thick, ow, false, facing);
  const hp = blobPts(300, hc, H);
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  if (o.clay) p.clip(hp, () => cracks(p, [[[300 + 0.28 * H.a, hc - 0.92 * H.b], 1.75, 0.5 * HH], [[300 - 0.95 * H.a, hc + 0.25 * H.b], -0.25, 0.3 * HH]], u, seed));
  hatOn(p, o, hp, H, 300, hc, light, seed, facing, false);
  faceFront(p, 300, hc, W, expr, facing, look, lid, brimOf(o), skin, o.moustache, o.build === "stout", o.glasses, o.brows, o, opts.talk ?? 0, gazeY);
  if (o.old) wrinkles(p, 300 + 7 * u * facing, hc, u);
  if (o.wet) wetStrands(p, 300, hc, H, o.hair ?? "#1d1a20", seed);
  if (o.messy && o.hat === "silk") messyFront(p, o, H, 300, hc, u, facing, seed);
  if (o.beard) beardArt(p, 300 + 8 * u * facing, hc + 0.8 * H.b, 0.55 * HH, u, o.beard, 3 * u * facing);
  if (o.hat === "long") for (const sd of [-1, 1]) { // long wet locks hanging in front of the shoulders
    const x0 = 300 + sd * 0.78 * H.a;
    p.poly([[x0 - sd * 6 * u, hc - 0.2 * H.b], [x0 + sd * 10 * u, hc - 0.1 * H.b], [x0 + sd * 12 * u, chin + 0.7 * HH], [x0 + sd * 2 * u, chin + 0.8 * HH], [x0 - sd * 8 * u, chin + 0.5 * HH]],
      o.hair ?? "#1d1a20", ow * 0.6);
  }
  if (prop === "cup") for (const a of arms) p.dot(a.pts[2][0], a.pts[2][1], 6.5 * u);
  if (gArms.length) { // hands (and the wiping forearm) that lie over the head
    p.rot = A ? [rad(A), 300, hipY] : null;
    for (const ga of gArms) {
      if (ga.G.over === 2) reveal(arms[ga.i], armR * (1 - 0.8 * sstep(0.35, 0.85, gK)));
      if (ga.G.over) p.dot(arms[ga.i].pts[2][0], arms[ga.i].pts[2][1], lerp(5.5, ga.G.r ?? 5.5, gK) * u);
    }
  }
  p.rot = null;
};
/** front-view character card on the 600 x 1000 design (soles at y = 975). All the acting options (gesture, talk, back,
 *  breath, gaze, props "rod" / "bowl" / "cane") are opt-in: without them the drawing is the classic one. */
export const bodyFront = (p: Pen, o: Outfit, opts: FrontOpts) => withSmall(p, o, () => bodyFront0(p, o, opts));

export type SideOpts = {
  phase?: number; expr?: Expr; mode?: "march" | "stand" | "swing" | "push" | "hold" | "kneelHug"; blink?: boolean | number; stomp?: number; pose?: number;
  /** step length as a multiple of 0.8 m (370 units): matches 1.6 m/s at 2 steps/s; scale by the view's foreshortening */
  stride?: number; light?: number; seed?: number; lantern?: boolean;
  /** paper lantern on a short stick, held forward in the near hand (walking side views) */
  lanternPaper?: boolean;
  /** push mode: where the hands land at pose 1, in final canvas units (e.g. the swing kid's back).
   *  kneelHug: where the hands rest (default: about the hip height of a standing adult, ~[560, 664]) */
  hand?: [number, number];
  /** held prop in the side view: ["axe" | "axeBroken" | "hammer", k] two-handed chop (0 raised .. 1 struck);
   *  ["mallet", k] one-handed strike with the far hand pressing a talisman forward; "talisman" held up forward;
   *  "scrap" torn cloth in the near hand; "cane" a walking stick in the near hand, planted ahead on every other step */
  prop?: Prop;
  /** march: an old person's shuffle: feet barely leave the ground, stooped, small arm swing (give a small stride, ~0.35-0.5) */
  shuffle?: boolean;
  /** mouth openness 0..1 over the expression's mouth (0 = unchanged) */
  talk?: number;
};

/** two-bone leg, knee bending forward (+x) */
const ik = (hip: P2, ank: P2, l1: number, l2: number): P2 => {
  const dx = ank[0] - hip[0], dy = ank[1] - hip[1], d = clamp(Math.hypot(dx, dy), 1, l1 + l2 - 0.01);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), k = Math.atan2(dy, dx) - A;
  return [hip[0] + l1 * Math.cos(k), hip[1] + l1 * Math.sin(k)];
};

/** hip height of the seated kid in `swing` mode (design units); swingKid seats the torso bottom on the plank */
const SWING_HIP = 733;

/** side view facing screen-right; march footfalls land at phase 0 (near foot) and 0.5 (far foot), like the front view.
 *  The stance foot is planted: it slides back at exactly the walking speed while the hip rises and falls over it.
 *  kneelHug: kneeling, torso bent ~60 deg forward (pose scales it), both arms stretched forward over something at about
 *  standing-hip height, head down on the arms with the face hidden; the figure is shifted left on the card so the
 *  hands stay on it (knees ~x 215, hands ~x 560). */
export const bodySide = (p: Pen, o: Outfit, opts: SideOpts) => withSmall(p, o, () => bodySide0(p, o, opts));
const bodySide0 = (p: Pen, o: Outfit, opts: SideOpts) => {
  const { phase = 0, expr = "neutral", mode = "march", blink = false, stomp = 1, pose = 0, stride = 1, light = DEF_LIGHT, seed = 1, prop = null } = opts;
  const Bd = BUILD[o.build ?? "adult"], skin = o.skin ?? SKIN, two = Math.PI * 2, lid = o.clay ? 0 : lidOf(blink);
  const H: Blob = { ...headOf(o, seed, Bd.a, 1), asym: 0.12, rot: rad(3 + 3 * (rnd(seed, 7) - 0.5)) };
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100, sole = 975, ankY = sole - 4 * u;
  const thick = thickAngle(light), ow = 5 * u;
  const legLen = (Bd.legs + 0.12) * HH - 4 * u, l1 = legLen / 2, l2 = legLen / 2;
  const nearCol = mix(o.pants, INK, 0.55), farCol = mix(o.pants, INK, 0.75), footCol = o.boots;
  const kneel = mode === "kneelHug", tool = toolOf(prop);
  const skirt = (o.dress || o.robe) && !kneel && mode !== "swing" ? (o.robe ? o.jacket : o.dress!) : null;
  const g = p.g;
  g.save();
  if (kneel) g.translate(-0.45 * HH, 0);
  type LegS = { ank: P2; pitch: number; near: boolean; knee?: P2 };
  const legs: LegS[] = [];
  let hipY = ankY - legLen * 0.995, lean = 0, nearFwd = 0;
  const shuffle = !!opts.shuffle && mode === "march", cane = prop === "cane" && (mode === "march" || mode === "stand");
  let caneSw = 0.4, caneUp = 0; // cane: where its tip is in its swing (-1 back .. 1 planted ahead), how far it is lifted
  if (mode === "march") {
    const S = 370 * stride, liftH = shuffle ? 7 : Math.max(22, 40 + 70 * (stomp - 1));
    const st = (ph: number) => {
      const c = (((phase + ph) % 1) + 1) % 1;
      if (c < 0.5) { const s = c / 0.5; return { x: S / 2 - S * s, h: 0, stance: true, s }; }
      const s = (c - 0.5) / 0.5; // swing: cycloid in world space, so the foot leaves and lands at zero ground speed
      return { x: -S / 2 + S * s - (S / Math.PI) * Math.sin(2 * Math.PI * s), h: liftH * Math.sin(Math.PI * s), stance: false, s };
    };
    const nL = st(0), fL = st(0.5), stance = nL.stance ? nL : fL;
    const Leff = legLen * (1 - (shuffle ? 0.05 : 0.035) * Math.sin(Math.PI * stance.s));
    hipY = ankY - Math.sqrt(Math.max(1, Leff * Leff - stance.x * stance.x));
    for (const [L, near] of [[fL, false], [nL, true]] as const)
      legs.push({ ank: [300 + L.x, ankY - L.h], pitch: L.stance ? 0 : rad(35 * Math.sin(Math.PI * L.s) * (1 - 1.6 * L.s)), near });
    lean = 4 + 3 * Math.cos(2 * two * phase); // 7 deg at contact, 1 deg at passing
    nearFwd = nL.x / (S / 2);
    if (shuffle) { lean = 11 + 1.5 * Math.cos(2 * two * phase); nearFwd *= 0.45; }
    if (cane) { caneSw = fL.x / (S / 2); caneUp = fL.stance ? 0 : Math.sin(Math.PI * fL.s); if (!shuffle) lean += 3; }
  } else if (mode === "hold") { // standing, both arms up toward opts.hand (kite string)
    legs.push({ ank: [300 - 6 * u, ankY], pitch: 0, near: false }, { ank: [300 + 6 * u, ankY], pitch: 0, near: true });
  } else if (mode === "push") {
    hipY = ankY - 0.87 * legLen;
    legs.push({ ank: [300 - 0.5 * legLen, ankY], pitch: rad(-8), near: false }, { ank: [300 + 0.32 * legLen, ankY], pitch: 0, near: true });
    lean = 14 * pose;
  } else if (mode === "swing") {
    hipY = SWING_HIP;
    const a = rad(60 * pose);
    for (const [dx, near] of [[-6, false], [0, true]] as const) {
      const knee: P2 = [300 + l1 * 0.98 + dx * u, hipY + 6 * u];
      legs.push({ ank: [knee[0] + l2 * Math.sin(a), knee[1] + l2 * Math.cos(a)], pitch: -a * 0.5, near });
    }
  } else if (kneel) { // knees on the floor, shins flat behind, thighs nearly upright
    for (const [dx, near] of [[-7, false], [0, true]] as const) {
      const K: P2 = [300 + 0.12 * l1 + dx * u, ankY - 3 * u];
      legs.push({ knee: K, ank: [K[0] - 0.97 * l2, ankY - 5 * u], pitch: rad(180 - 8), near });
    }
    hipY = ankY - 3 * u - 0.985 * l1;
    lean = 40 * (opts.pose ?? 1);
  } else {
    legs.push({ ank: [300 - 4 * u, ankY], pitch: 0, near: false }, { ank: [300 + 4 * u, ankY], pitch: 0, near: true });
    if (tool) lean = tool[0] === "mallet" ? 4 * tool[1] : lerp(-5, 12, tool[1]);
    if (cane) lean = 6;
  }
  const torsoBot = hipY + 0.12 * HH, chin = torsoBot - Bd.torso * HH, hc = chin - H.b, crown = hc - H.b, hip: P2 = [300, hipY];
  p.rot = null;
  for (const L of legs) {
    const knee = mode === "swing" ? ([300 + l1 * 0.98 + (L.near ? 0 : -6 * u), hipY + 6 * u] as P2) : L.knee ?? ik(hip, L.ank, l1, l2);
    const hp0: P2 = [300 + (L.near ? 0 : -5 * u), hipY];
    if (!skirt) p.stroke([hp0, knee, L.ank], 5.8 * u, L.near ? nearCol : farCol);
    const c = Math.cos(L.pitch), s = Math.sin(L.pitch);
    footStroke(p, [L.ank[0] - 3 * u * c, L.ank[1] - 3 * u * s], [L.ank[0] + 13 * u * c, L.ank[1] + 13 * u * s + 0.5 * u],
      7.5 * u, L.near ? footCol : footCol === INK ? INK : shade(footCol, 0.82));
  }
  // ---- upper body leans about the hip ----
  p.rot = lean ? [rad(lean), 300, hipY] : null;
  const T: Blob = { a: (o.build === "stout" ? 0.36 : 0.31) * W, b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.5, egg: 0.1, asym: 0.06,
    rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = 300 + 2 * u, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  if (skirt) { // skirt / robe hem from the waist to the ankles, following the feet (drawn upright, under the tunic)
    p.rot = null;
    const xs = legs.map((L) => L.ank[0]), front = Math.max(Math.max(...xs) + 15 * u, tcx + 1.05 * T.a + 4 * u), back = Math.min(Math.min(...xs) - 6 * u, tcx - 1.0 * T.a - 4 * u);
    const yT = torsoBot - 0.16 * HH, yH = o.robe ? ankY - 1 * u : ankY - 3 * u;
    const pts: P2[] = [...curve([tcx + 0.95 * T.a, yT], [(tcx + 0.95 * T.a + front) / 2 + 3 * u, (yT + yH) / 2], [front, yH], 10)];
    for (let i = 1; i < 10; i++) { const t = i / 10; pts.push([front + (back - front) * t, yH + 3 * u * Math.sin(Math.PI * t)]); }
    pts.push(...curve([back, yH], [(back + tcx - 0.92 * T.a) / 2 - 2 * u, (yT + yH) / 2], [tcx - 0.92 * T.a, yT], 10));
    p.gradFill(pts, skirt, mul(skirt, SH_CLOTH), light);
    p.clip(pts, () => {
      for (const k of [-0.4, 0.3]) p.stroke(curve([tcx + k * T.a, yT + 0.25 * (yH - yT)], [tcx + k * T.a + (front + back - 2 * tcx) * 0.2, (yT + yH) / 2 + 0.1 * (yH - yT)], [(front + back) / 2 + k * (front - back) * 0.45, yH + 2 * u], 8), 1.4 * u, shade(skirt, 0.76));
      if (o.clay) cracks(p, [[[tcx, yT + 0.3 * (yH - yT)], 1.4, 0.4 * (yH - yT)]], u, seed + 3);
    });
    p.inkRing(pts, ow, thick);
    p.rot = lean ? [rad(lean), 300, hipY] : null;
  }
  hairBack(p, o, H, 300 + 4 * u, hc, torsoBot + (o.messy ? 0.62 : 0.02) * HH, light, thick, ow, true, seed);
  const armCol = mix(o.jacket, INK, 0.5), farArm = mix(o.jacket, INK, 0.68);
  const S: P2 = [tcx + 0.05 * T.a, chin + 0.14 * HH], aLen = 0.95 * HH;
  const swingArm = (ang: number): [P2, P2, P2] => {
    const e: P2 = [S[0] + Math.sin(ang) * aLen * 0.5, S[1] + Math.cos(ang) * aLen * 0.5], a2 = ang + rad(16) * Math.sign(ang || 1);
    return [S, e, [e[0] + Math.sin(a2) * aLen * 0.5, e[1] + Math.cos(a2) * aLen * 0.5]];
  };
  /** target in final canvas units -> the leaned frame the arms are drawn in */
  const unlean = (q: [number, number]): P2 => {
    const th = -rad(lean), dx = q[0] - 300, dy = q[1] - hipY;
    return [300 + dx * Math.cos(th) - dy * Math.sin(th), hipY + dx * Math.sin(th) + dy * Math.cos(th)];
  };
  /** arm from the shoulder to a hand point, the elbow bent downward by `bend` */
  const armTo = (h: P2, bend: number): [P2, P2, P2] => {
    const mx = (S[0] + h[0]) / 2, my = (S[1] + h[1]) / 2, dx = h[0] - S[0], dy = h[1] - S[1], l = Math.hypot(dx, dy) || 1;
    return [S, [mx - (dy / l) * bend * (dx >= 0 ? -1 : 1), my + (dx / l) * bend * (dx >= 0 ? 1 : -1)], h];
  };
  const rifle = !!o.rifle && (mode === "march" || mode === "stand");
  const B0: P2 = [tcx + 0.72 * T.a, chin + 0.58 * HH], B1: P2 = [tcx - 0.95 * T.a - 22 * u, crown - 0.4 * HH];
  let near: [P2, P2, P2], far: [P2, P2, P2] | null;
  let toolAt: { h: P2; ang: number } | null = null, talAt: P2 | null = null, caneAt: { h: P2; g: P2 } | null = null;
  const kneelHand: [number, number] = opts.hand ? [opts.hand[0] + 0.45 * HH, opts.hand[1]] : [530 + 0.45 * HH, sole - 1.4 * HH];
  if (mode === "swing") { near = [S, [S[0] + 12 * u, S[1] - 0.16 * HH], [300 + 6 * u, chin - 0.3 * HH]]; far = [S, [S[0] + 8 * u, S[1] - 0.18 * HH], [300 + 2 * u, chin - 0.36 * HH]]; }
  else if (mode === "hold") {
    const tg: P2 = opts.hand ?? [S[0] + 0.5 * HH, S[1] - 0.6 * HH];
    near = [S, [(S[0] + tg[0]) / 2 + 6 * u, (S[1] + tg[1]) / 2 + 10 * u], tg];
    far = [S, [(S[0] + tg[0]) / 2 + 2 * u, (S[1] + tg[1]) / 2 + 14 * u], [tg[0] - 5 * u, tg[1] + 8 * u]];
  }
  else if (mode === "push") {
    const reach = 0.55 * HH + 0.45 * HH * pose;
    let hN: P2 = [S[0] + reach, S[1] + 0.06 * HH];
    if (opts.hand) {
      // target is in final canvas units; the arm is drawn inside the lean rotation, so undo it
      const tg = unlean(opts.hand);
      hN = [hN[0] + (tg[0] - hN[0]) * pose, hN[1] + (tg[1] - hN[1]) * pose];
    }
    near = [S, [(S[0] + hN[0]) / 2, (S[1] + hN[1]) / 2 + 0.06 * HH], hN];
    far = [S, [(S[0] + hN[0]) / 2 - 4 * u, (S[1] + hN[1]) / 2 - 0.02 * HH], [hN[0] - 6 * u, hN[1] - 0.08 * HH]];
  } else if (kneel) {
    const tg = unlean(kneelHand);
    near = armTo(tg, -6 * u);
    far = armTo([tg[0] - 9 * u, tg[1] - 5 * u], -6 * u);
  } else if (tool && tool[0] !== "mallet") { // two-handed chop: the hands circle over the shoulder, the blade leading
    const th = rad(lerp(-30, 100, tool[1])), G: P2 = [S[0] + Math.sin(th) * 0.8 * aLen, S[1] - Math.cos(th) * 0.8 * aLen];
    near = armTo(G, 0.12 * HH);
    const G2: P2 = [G[0] - Math.sin(th) * 9 * u, G[1] + Math.cos(th) * 9 * u];
    far = armTo(G2, 0.14 * HH);
    toolAt = { h: G, ang: th };
  } else if (tool) { // mallet in the near hand, the far hand pressing a talisman forward
    const th = rad(lerp(-15, 80, tool[1])), G: P2 = [S[0] + Math.sin(th) * 0.78 * aLen, S[1] - Math.cos(th) * 0.78 * aLen];
    near = armTo(G, 0.12 * HH);
    talAt = [S[0] + 0.66 * HH, S[1] + 0.02 * HH];
    far = armTo(talAt, 0.08 * HH);
    toolAt = { h: G, ang: th };
  } else if (prop === "talisman") {
    talAt = [S[0] + 0.48 * HH, S[1] - 0.42 * HH];
    near = armTo(talAt, 0.1 * HH);
    far = null;
  } else if (prop === "scrap") {
    near = armTo([S[0] + 0.22 * HH, S[1] + 0.62 * HH], -0.04 * HH);
    far = null;
  } else if (cane) { // the near hand on the stick: the tip swings ahead with the far foot and stays planted while the body passes it
    const [sx, sy] = rotAbout(S, rad(lean), [300, hipY]), gy = sole - 1.5 * u, th = rad(4 + 12 * caneSw);
    const hx = sx + 0.3 * HH, L = (gy - (sy + 0.52 * HH)) / Math.cos(rad(16));
    caneAt = { h: [hx, gy - 5 * u * caneUp - L * Math.cos(th)], g: [hx + L * Math.sin(th), gy - 5 * u * caneUp] };
    near = armTo(unlean(caneAt.h), 0.07 * HH);
    far = mode === "march" ? swingArm(rad(30) * nearFwd) : null;
  } else if (rifle) { near = [S, [S[0] - 4 * u, S[1] + 0.42 * HH], B0]; far = mode === "march" ? swingArm(rad(30) * nearFwd) : swingArm(0); }
  else { near = swingArm(rad(-30) * nearFwd); far = mode === "march" ? swingArm(rad(30) * nearFwd) : null; }
  if (opts.lanternPaper) near = [S, [S[0] + 5 * u, S[1] + 0.34 * HH], [S[0] + 17 * u, S[1] + 0.47 * HH]];
  const drawArm = (a: [P2, P2, P2], col: string) => {
    if (o.robe) sleeveArt(p, a, col === armCol ? o.jacket : shade(o.jacket, 0.8), u, light);
    else p.stroke(curve(a[0], a[1], a[2]), 5.2 * u, col);
    p.dot(a[2][0], a[2][1], 5.5 * u);
  };
  if (talAt && tool) talismanArt(p, talAt[0] + 3 * u, talAt[1] + 8 * u, u, 0, 0.55);
  if (far) drawArm(far, farArm);
  p.gradFill(tp, o.jacket, mul(o.jacket, SH_CLOTH), light);
  p.clip(tp, () => {
    if (o.belt) p.band([[tcx - 0.65 * T.a, chin - 0.05 * HH], [tcx + 0.75 * T.a, torsoBot - 0.1 * HH]], o.belt!, 5.5 * u, 1.8 * u);
    if (o.cross) p.band(curve([tcx - 0.15 * T.a, chin - 0.05 * HH], [tcx + 0.5 * T.a, chin + 0.22 * HH], [tcx + 1.0 * T.a, chin + 0.5 * HH], 10), o.cross, 5.5 * u, 1.2 * u);
    if (o.sash) p.band([[tcx - 1.3 * T.a, torsoBot - 0.32 * HH], [tcx + 1.3 * T.a, torsoBot - 0.32 * HH]], o.sash, 0.13 * HH, 1.8 * u);
    if (!o.dress && !o.cross && !o.robe && !o.clay) for (let i = 0; i < 3; i++) { const y = chin + 0.16 * HH + i * 0.24 * HH; p.dot(tcx + 0.8 * T.a, y, 3 * u, INK); p.dot(tcx + 0.8 * T.a, y, 2.2 * u, o.buttons ?? shade(o.jacket, 0.7)); }
    if (o.clay) cracks(p, [[[tcx - 0.3 * T.a, chin + 0.08 * HH], 1.3, 0.45 * HH]], u, seed + 1);
  });
  p.inkRing(tp, ow, thick);
  if (rifle) {
    p.band([B0, B1], "#7a4b2a", 5 * u, 1.5 * u, "round");
    p.band([lerp2(B0, B1, 0.6), B1], "#8d949c", 2.4 * u, 1.2 * u, "round");
  }
  const nearArm = () => {
    if (caneAt) { const rot = p.rot; p.rot = null; caneArt(p, caneAt.h[0], caneAt.h[1], caneAt.g[0], caneAt.g[1], u, -1); p.rot = rot; }
    drawArm(near, armCol);
    if (opts.lantern) lanternArt(p, near[2][0], near[2][1], u, true);
    if (opts.lanternPaper) paperLanternArt(p, near[2][0], near[2][1], u, true);
    if (toolAt) toolArt(p, tool![0], toolAt.h[0], toolAt.h[1], toolAt.ang, u);
    if (talAt && !tool) talismanArt(p, talAt[0], talAt[1], u, 4, 0.7);
    if (prop === "scrap") scrapArt(p, near[2][0], near[2][1], 1.45 * u);
  };
  const nearLate = kneel || !!toolAt || (!!talAt && !tool);
  if (!nearLate) nearArm();
  // ---- head ----
  const hx = 300 + 4 * u;
  if (kneel) { // bowed down onto the arms: rotate about the chin, then carry the chin to its leaned place
    // bow just enough for the head to rest on the arms (its lowest point at the hands' height), never backward
    const [cx2, cy2] = rotAbout([hx, chin], rad(lean), [300, hipY]);
    const th = clamp(Math.acos(clamp((cy2 - (kneelHand[1] - 0.95 * H.b)) / H.b, -1, 1)), rad(lean + 5), rad(lean + 75));
    p.rot = [th, hx, chin, cx2 - hx, cy2 - chin];
  }
  hatBehind(p, o, H, hx, hc, light, thick, ow, true);
  const hp = blobPts(hx, hc, H);
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  if (o.clay) p.clip(hp, () => cracks(p, [[[hx - 0.1 * H.a, hc - 0.95 * H.b], 1.5, 0.5 * HH]], u, seed));
  hatOn(p, o, hp, H, hx, hc, light, seed, 1, true, kneel);
  if (!kneel) {
    faceSide(p, hx, hc, W, expr, lid, brimOf(o), skin, o.moustache, o.build === "stout", o, opts.talk ?? 0);
    if (o.beard) beardArt(p, hx + 30 * u, hc + 0.82 * H.b, 0.55 * HH, u, o.beard, 4 * u);
    if (o.messy && o.hat === "silk") p.poly(ribbon(curve([hx + 0.42 * H.a, hc - 0.72 * H.b], [hx + 0.36 * H.a, hc - 0.05 * H.b], [hx + 0.3 * H.a, hc + 0.85 * H.b], 10), 5.5 * u, 2.5 * u, 1), o.hair ?? "#16131a", 1.4 * u);
  }
  if (nearLate) { p.rot = lean ? [rad(lean), 300, hipY] : null; nearArm(); }
  p.rot = null;
  g.restore();
};

/** rope + seat + seated kid on a 700 x 2300 canvas; the pivot is design (350, 20); kid drawn at 0.92 scale */
export const swingKid = (p: Pen, o: Outfit, kick: number, expr: Expr, light = DEF_LIGHT, blink: number = 0) => {
  const rope = 1830, k = 1.1, HH = 2 * headBlob(5, BUILD[o.build ?? "adult"].a, 1).b;
  // two ropes from the pivot to the ends of a wide plank, the kid framed between them: a single rope behind the kid
  // ended at the cap and read as a hanging. Far rope behind the kid, near rope drawn over (clear of the face).
  const seat = rope + 18, x0 = 150, x1 = 550;
  p.line([[350, 20], [x0 + 16, seat + 4]], "#a07a4c", 10);
  p.poly(rrect(x0, seat, x1, seat + 36, 10), "#b5653f", 9);
  const g = p.g;
  g.save();
  g.translate(350 - 300 * k, rope + 18 - (SWING_HIP + 0.12 * HH) * k);
  g.scale(k, k);
  bodySide(new Pen(g), o, { expr, mode: "swing", pose: kick, light, seed: 5, blink });
  g.restore();
  p.line([[350, 20], [x1 - 16, seat + 4]], "#a07a4c", 10);
};

// ---------------- effects ----------------
export const fxNote = (p: Pen, kind: number, col = "#1f2a44") => {
  p.ell(70, 200, 46, 34, col, 8, 0, 360, -20);
  p.stroke([[110, 190], [110, 40]], 14);
  if (kind === 0) p.poly([[110, 40], [170, 70], [170, 110], [110, 82]], col, 8);
  else {
    p.ell(150, 170, 40, 30, col, 8, 0, 360, -20);
    p.stroke([[186, 160], [186, 20]], 14);
    p.poly([[110, 40], [186, 20], [186, 50], [110, 70]], col, 8);
  }
};

/** spark / impact star on a 500 x 500 canvas; t in 0..1 */
export const fxBurst = (p: Pen, t: number, col = "#fff3b0", rays = 10, r0 = 40, r1 = 230) => {
  const c = 250, e = 1 - (1 - t) ** 3;
  for (let i = 0; i < rays; i++) {
    const a = rad((i * 360) / rays + 7 * (i % 2)), ra = r0 + (r1 - r0) * e * (0.75 + 0.25 * (i % 2));
    p.poly([[c + r0 * 0.5 * Math.cos(a + 0.18), c + r0 * 0.5 * Math.sin(a + 0.18)], [c + ra * Math.cos(a), c + ra * Math.sin(a)],
      [c + r0 * 0.5 * Math.cos(a - 0.18), c + r0 * 0.5 * Math.sin(a - 0.18)]], col, Math.max(3, 8 * (1 - t)));
  }
  if (t < 0.5) p.ell(c, c, r0 * (1.4 - t), r0 * (1.4 - t), WHITE, 8);
};

/** water splash crown on an 800 x 800 canvas; t in 0..1 */
export const fxSplash = (p: Pen, t: number) => {
  const c = 400, size = 800, rise = Math.sin(Math.min(1, t * 1.3) * Math.PI);
  const blue = "#bfe8ff", deep = "#6cc0f0";
  if (rise > 0.02) {
    const pts: P2[] = [];
    for (let i = 0; i < 19; i++) {
      const h = (i % 2 ? 260 : 130) * rise * (0.7 + 0.3 * Math.sin(i * 1.7));
      pts.push([c - 330 + (660 * i) / 18, size - 120 - h]);
    }
    p.poly([...pts, [c + 330, size - 90], [c - 330, size - 90]], blue, 10);
    p.ell(c, size - 100, 360, 46, deep, 10);
  }
  for (let i = 0; i < 8; i++) {
    const a = rad(200 + i * 18), d = 120 + 380 * t, y = size - 160 + d * Math.sin(a) + 520 * t * t, r = 26 * (1 - t) + 6;
    if (t > 0.08 && y < size - 40) p.ell(c + d * Math.cos(a), y, r, r * 1.25, blue, 7);
  }
};

/** dust puff on a 300 x 300 canvas; t in 0..1 */
export const fxPuff = (p: Pen, t: number) => {
  for (let i = 0; i < 5; i++) {
    const a = rad(160 + i * 55), d = 40 + 70 * t, r = (34 + 20 * (i % 2)) * (1 - 0.6 * t);
    p.ell(150 + d * Math.cos(a), 180 + d * 0.45 * Math.sin(a), r, r * 0.8, `rgba(238,225,205,${(1 - t).toFixed(3)})`, 0);
  }
};

/** circling stars on a 420 x 210 canvas */
export const fxStars = (p: Pen, t: number) => {
  for (let i = 0; i < 4; i++) {
    const a = t * Math.PI * 2 + (i * Math.PI) / 2, x = 210 + 150 * Math.cos(a), y = 110 + 40 * Math.sin(a), pts: P2[] = [];
    for (let k = 0; k < 10; k++) { const r = k % 2 ? 14 : 34, b = rad(k * 36 - 90); pts.push([x + r * Math.cos(b), y + r * Math.sin(b)]); }
    p.poly(pts, "#ffd84a", 6);
  }
};

/** three jittering strain ticks on a 300 x 300 canvas */
export const fxCreak = (p: Pen, t: number) => {
  const j = 6 * Math.sin(t * 40);
  for (const a of [-30, 0, 30]) {
    const b = rad(a - 90);
    p.stroke([[150 + 70 * Math.cos(b) + j, 230 + 70 * Math.sin(b)], [150 + 100 * Math.cos(b) + 10 + j, 230 + 100 * Math.sin(b)],
      [150 + 130 * Math.cos(b) + j, 230 + 130 * Math.sin(b)]], 10);
  }
};

/** flat water ring (drawn top-down) on a 600 x 600 canvas; t in 0..1 */
export const fxRing = (p: Pen, t: number, c1 = "#f6fcff", c2 = "#cfe8fa") => {
  // thin light water rings (white crest, pale blue trailing rings), thinning as they spread
  const g = p.g;
  for (let k = 0; k < 3; k++) {
    const u = t - k * 0.22;
    if (u <= 0 || u >= 1) continue;
    g.beginPath(); g.ellipse(300, 300, 60 + 230 * u, 60 + 230 * u, 0, 0, Math.PI * 2);
    g.globalAlpha = Math.sin(Math.PI * u) ** 0.8; // fade in and out, so a ring that restarts never pops
    g.strokeStyle = k === 0 ? c1 : c2; g.lineWidth = 9 * (1 - u) + 3; g.stroke();
    g.globalAlpha = 1;
  }
};

/** text-free sign on a 700 x 520 canvas: "no marching in step on the bridge". A bridge (deck + arch + piers), four
 *  identical pairs of marching legs in the same stride (in step), a bold red X over all of it. */
export const fxSign = (p: Pen) => {
  const g = p.g, RED = "#d42f2f";
  p.poly(rrect(14, 14, 686, 506, 40), "#f6ecd2", 0);
  p.poly(rrect(14, 14, 686, 506, 40), null, 14);
  // bridge: deck, stone arch underneath, two piers
  p.poly(rrect(70, 352, 630, 384, 8), "#8a5a3a", 9);
  g.beginPath(); g.moveTo(112, 470); g.quadraticCurveTo(350, 300, 588, 470);
  g.strokeStyle = INK; g.lineWidth = 16; g.lineCap = "round"; g.stroke();
  for (const x of [88, 612]) p.poly(rrect(x - 16, 384, x + 16, 470, 4), "#8a5a3a", 9);
  // four identical soldiers' legs mid-stride: same leg forward on every one = in step
  for (const x of [150, 278, 406, 534]) {
    p.poly(rrect(x - 30, 150, x + 30, 214, 14), "#357650", 9);                  // coat hem
    p.stroke([[x - 8, 210], [x + 34, 262], [x + 46, 338]], 15, INK);           // front leg
    p.stroke([[x + 6, 210], [x - 12, 274], [x - 36, 336]], 15, INK);           // back leg
    p.poly(rrect(x + 30, 330, x + 74, 350, 9), INK, 0);                          // boots point forward
    p.poly(rrect(x - 52, 328, x - 8, 348, 9), INK, 0);
  }
  // big red X
  for (const [a, b] of [[[96, 70], [604, 452]], [[604, 70], [96, 452]]] as [[number, number], [number, number]][]) {
    p.stroke([a, b], 58, "#ffffff");
    p.stroke([a, b], 42, RED);
  }
};

/** soft cartoon cloud on a 600 x 300 canvas */
export const fxCloud = (p: Pen, seed: number) => {
  const blobs: [number, number, number][] = [[150, 190, 80], [250, 150, 105], [360, 160, 95], [450, 195, 70], [300, 210, 90]];
  for (const [x, y, r] of blobs) p.ell(x + ((seed * 37) % 20) - 10, y, r, r * 0.8, "#ffffff", 0);
  p.ell(300, 235, 230, 40, "#ffffff", 0);
};

/** cast shadow on a 128 x 256 canvas: dark soft contact pool at the feet (y 205) and a softer tail that runs up the
 *  canvas = away from the sun, fading with distance; multiply colour (sRGB-encoded linear ratio), white = no change */
export const fxShadow = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = WHITE; g.fillRect(0, 0, 128, 256);
  g.save(); g.filter = "blur(9px)";
  const lg = g.createLinearGradient(0, 205, 0, 22);
  lg.addColorStop(0, mix(col, WHITE, 0.08)); lg.addColorStop(0.55, mix(col, WHITE, 0.3)); lg.addColorStop(1, mix(col, WHITE, 0.85));
  g.fillStyle = lg;
  g.beginPath(); g.moveTo(40, 205); g.bezierCurveTo(36, 120, 46, 50, 64, 30); g.bezierCurveTo(82, 50, 92, 120, 88, 205); g.closePath(); g.fill();
  g.fillStyle = col; g.beginPath(); g.ellipse(64, 205, 30, 17, 0, 0, Math.PI * 2); g.fill();
  g.restore();
};

/** tight contact shadow right under the feet on a 128 x 128 canvas: dark core, short fall-off (multiply colour) */
export const fxContact = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = WHITE; g.fillRect(0, 0, 128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [r, k] of [[0, 0], [0.32, 0.02], [0.5, 0.22], [0.66, 0.58], [0.82, 0.88], [1, 1]] as const) gr.addColorStop(r, mix(col, WHITE, k));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
};

/** floating wooden plank, side-on, on a 320 x 110 canvas */
export const fxPlank = (p: Pen) => {
  p.poly(rrect(14, 30, 306, 78, 10), "#a8744a", 9);
  p.line([[40, 46], [150, 44], [270, 50]], "#7d5234", 4);
  p.line([[60, 62], [200, 64], [284, 60]], "#7d5234", 4);
  p.dot(36, 54, 5, INK); p.dot(284, 54, 5, INK);
};

/** floating marching drum (no text) on a 260 x 240 canvas: white shell, red hoops, ink zig-zag cord */
export const fxDrum = (p: Pen) => {
  p.poly(rrect(40, 70, 220, 190, 16), "#f1ece0", 9);
  p.poly(rrect(32, 58, 228, 86, 12), "#c9373a", 8);
  p.poly(rrect(32, 176, 228, 204, 12), "#c9373a", 8);
  p.line([[52, 88], [82, 172], [112, 88], [142, 172], [172, 88], [202, 172]], INK, 6);
  p.ell(130, 58, 98, 18, "#f7f3ea", 8);
};

/** soft ground contact blob on a 128 x 128 canvas, multiply colour (sRGB-encoded linear ratio) in the centre */
export const fxBlob = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = WHITE; g.fillRect(0, 0, 128, 128);
  // soft contact shadow: flat core, then a long smooth (roughly gaussian) fall-off to white = no change
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [r, k] of [[0, 0], [0.5, 0.04], [0.64, 0.18], [0.76, 0.42], [0.87, 0.72], [0.95, 0.92], [1, 1]] as const) gr.addColorStop(r, mix(col, WHITE, k));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
};

// =============================== Ma da: props, ghosts and effects ===============================
/** hurricane lantern hanging from a hand at (hx, hy): wire bail, glass globe (warm when lit), tin base and cap */
export const lanternArt = (p: Pen, hx: number, hy: number, u: number, lit: boolean) => {
  const cy = hy + 30 * u, gw = 13 * u, gh = 17 * u;
  p.stroke([[hx - 9 * u, cy - 14 * u], [hx, hy], [hx + 9 * u, cy - 14 * u]], 1.8 * u);
  p.poly(rrect(hx - 11 * u, cy - 22 * u, hx + 11 * u, cy - 15 * u, 3 * u), "#4d555c", 2 * u);
  p.ell(hx, cy, gw, gh, lit ? "#ffe9a8" : "#a9b8bf", 2.4 * u);
  if (lit) { p.ell(hx, cy + 3 * u, 4 * u, 7 * u, "#fff8e0", 0); p.ell(hx, cy + 5 * u, 2.4 * u, 4 * u, "#ffb347", 0); }
  p.poly(rrect(hx - 13 * u, cy + 14 * u, hx + 13 * u, cy + 22 * u, 3 * u), "#4d555c", 2 * u);
  p.stroke([[hx - gw, cy], [hx + gw, cy]], 1.2 * u, "rgba(60,60,70,0.6)");
};
/** paper kite (diamond, two colours, cross sticks, bow tail) centred at (cx, cy), height h */
export const kiteArt = (p: Pen, cx: number, cy: number, h: number, flutter = 0) => {
  const w = h * 0.72, top: P2 = [cx, cy - h * 0.42], bot: P2 = [cx, cy + h * 0.58], L: P2 = [cx - w / 2, cy - h * 0.1], Rr: P2 = [cx + w / 2, cy - h * 0.1], c: P2 = [cx, cy - h * 0.1];
  const tail: P2[] = [];
  for (let i = 0; i <= 10; i++) tail.push([cx + Math.sin(i * 0.9 + flutter) * h * 0.08, bot[1] + i * h * 0.09]);
  p.stroke(tail, h * 0.015, INK);
  for (let i = 2; i <= 10; i += 3) { const [x, y] = tail[i]; p.poly([[x - h * 0.06, y - h * 0.03], [x, y], [x - h * 0.06, y + h * 0.03]], "#f2c84b", h * 0.008); p.poly([[x + h * 0.06, y - h * 0.03], [x, y], [x + h * 0.06, y + h * 0.03]], "#f2c84b", h * 0.008); }
  p.poly([top, Rr, c, L], "#d8473a", 0); p.poly([L, c, Rr, bot], "#f2c84b", 0);
  p.poly([top, Rr, bot, L], null, h * 0.028);
  p.stroke([top, bot], h * 0.014, "#7a4a2a"); p.stroke([L, Rr], h * 0.014, "#7a4a2a");
};
/** wet hair stuck to the forehead and cheeks */
const wetStrands = (p: Pen, cx: number, hc: number, H: Blob, col: string, seed: number) => {
  const u = (2 * H.a) / 100;
  for (let i = 0; i < 7; i++) {
    const x0 = cx + (i - 3) * 9 * u + (rnd(seed, 40 + i) - 0.5) * 4 * u, y0 = hc - 0.62 * H.b, len = (0.45 + 0.35 * rnd(seed, 50 + i)) * H.b;
    const bend = (rnd(seed, 60 + i) - 0.5) * 10 * u;
    p.stroke(curve([x0, y0], [x0 + bend, y0 + len * 0.5], [x0 + bend * 0.4, y0 + len], 6), 3.2 * u, col);
  }
};

/** a ghost: the body drawn off-screen, then laid down see-through, pale, with a cold glow and a fading hem.
 *  cw x ch canvas holds the 600 x 1000 design. */
export const ghostDraw = (o: Outfit, fo: FrontOpts, alpha = 0.82, glow = "rgba(170,225,235,0.9)") => (p: Pen) => {
  const g = p.g, W = g.canvas.width, Hh = g.canvas.height;
  const off = document.createElement("canvas"); off.width = W; off.height = Hh;
  const og = off.getContext("2d")!;
  og.setTransform(W / 600, 0, 0, Hh / 1000, 0, 0);
  bodyFront(new Pen(og), o, fo);
  og.setTransform(1, 0, 0, 1, 0, 0);
  og.globalCompositeOperation = "destination-in";
  const fade = og.createLinearGradient(0, Hh * 0.55, 0, Hh * 0.98);
  fade.addColorStop(0, "rgba(0,0,0,1)"); fade.addColorStop(1, "rgba(0,0,0,0.15)");
  og.fillStyle = fade; og.fillRect(0, 0, W, Hh);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.shadowColor = glow; g.shadowBlur = W * 0.04; g.globalAlpha = alpha;
  g.drawImage(off, 0, 0);
  g.restore();
};
export const CU_LIVE: Outfit = { jacket: "#c96a3a", pants: "#3a3f4a", boots: "#e7b98e", hat: "chom", hair: "#1d1a20", build: "kid", skin: "#f0c79e" };
export const CU_GHOST: Outfit = { jacket: "#9cb3b8", pants: "#56666f", boots: "#c8dadc", hat: "chom", hair: "#151b20", build: "kid", skin: "#cfe0e2", wet: true };
export const TI: Outfit = { jacket: "#ece5d2", pants: "#2f3a52", boots: "#e8b98c", hat: "hair", hair: "#1c1a20", build: "kid", skin: "#f1c9a0" };
export const TI_WET: Outfit = { ...TI, jacket: "#cfc9b8", wet: true };
export const BA: Outfit = { jacket: "#6e4a32", pants: "#25232a", boots: "#3a2a20", hat: "khan", build: "adult", skin: "#e8bf98", old: true };
export const BA_GHOST: Outfit = { jacket: "#8fa2a8", pants: "#3f4a52", boots: "#b9c9cc", hat: "long", hair: "#c9cdd0", build: "adult", skin: "#cfdfe0", wet: true };
export const VILLAGER = (v: number): Outfit => {
  const shirts = ["#5a6e8a", "#7a5a3e", "#e2d8c0", "#4f6a52", "#8a4a42"];
  return { jacket: shirts[v % 5], pants: ["#2a2a30", "#3a3328", "#2f3a52"][v % 3], boots: "#d9ad84", hat: v % 3 === 1 ? "hair" : "nonla", hair: "#1d1a20", skin: SKINS[(v + 1) % 4] };
};
export const KIDS = [
  { jacket: "#3f7fbf", pants: "#2f3a52", boots: "#e8b98c", hat: "chom", hair: "#1d1a20", build: "kid", skin: "#f1c9a0" },
  { jacket: "#d9a441", pants: "#3a3f4a", boots: "#e0b088", hat: "hair", hair: "#1d1a20", build: "kid", skin: "#ecc29a" },
  { jacket: "#c25a7a", pants: "#2a2a30", boots: "#e8b98c", hat: "long", hair: "#1d1a20", build: "kid", skin: "#f3cfaa" },
  { jacket: "#5d8a4a", pants: "#2f3a52", boots: "#d9ad84", hat: "hair", hair: "#1d1a20", build: "kid", skin: "#e2b48c" },
] as Outfit[];
export const DROWNED = (v: number): Outfit => {
  const k = v % 4;
  return k === 0 ? { jacket: "#c7d3d6", pants: "#7a8a92", boots: "#c8dadc", hat: "long", hair: "#141a1f", skin: "#d2e2e4", wet: true }
    : k === 1 ? { jacket: "#8fa2a8", pants: "#4f5c64", boots: "#c8dadc", hat: "hair", hair: "#141a1f", skin: "#cadcdf", wet: true }
    : k === 2 ? { ...CU_GHOST }
    : { jacket: "#b2c2c6", pants: "#5f6e76", boots: "#c8dadc", hat: "long", hair: "#1a2026", skin: "#d6e4e5", wet: true, build: "kid" };
};

// =============================== Cây gạo: the cast (Trần dynasty countryside, 14th century) ===============================
// Plain cross-collar tunics (áo giao lĩnh, collar band = `cross`), cloth sashes, trousers or ankle-length skirts, earth
// and dark colours. `head` pins each character's head shape whatever index the stage gives the card.
/** Trình Trung Ngộ: young merchant, topknot with a wooden pin, dark indigo áo, light hemp trousers, cloth shoes */
export const NGO: Outfit = { jacket: "#2f3d5c", pants: "#cdbb94", boots: "#3a2e28", hat: "bun", hair: "#1b181d", skin: "#f1c9a0",
  cross: "#d9cdb0", sash: "#1f2638", head: 3, brows: 1.08 };
/** Ngộ wasting away: greyer skin, dark under-eyes, loose strands */
export const NGO_SICK: Outfit = { ...NGO, skin: "#ddcbbb", sick: true, jacket: "#34405a" };
/** Ngộ's ghost: pale grey-blue skin, faded clothes (like BA_GHOST / CU_GHOST) */
export const NGO_GHOST: Outfit = { ...NGO, jacket: "#6d7c95", pants: "#aab4b6", boots: "#56616a", hair: "#151b20", skin: "#cfdfe0", cross: "#b3bcbe", sash: "#4a5566" };
/** Nhị Khanh: long black hair parted in the middle, pale rose áo, deep-red sash, long dark skirt */
export const KHANH: Outfit = { jacket: "#e6b3bb", pants: "#2a2230", boots: "#5a2a30", dress: "#2b2331", hat: "silk", hair: "#17141b", skin: "#f6dcc2",
  cross: "#f6e3e3", sash: "#8e2f3c", fem: true, lips: "#c2404c", head: 6, brows: 0.8 };
/** Nhị Khanh's ghost: grey-blue skin, longer ragged hair with a lock over one eye, faded grey-pink áo */
export const KHANH_GHOST: Outfit = { ...KHANH, jacket: "#b9a5ac", dress: "#3b4250", boots: "#56616a", hair: "#12161b", skin: "#d2e0e4",
  cross: "#d6cfd3", sash: "#6e5c66", lips: "#7d6f80", messy: true };
/** the maid (con hầu): kid, two buns, brown áo, dark skirt */
export const HAU: Outfit = { jacket: "#94603c", pants: "#3a2c26", boots: "#e2b088", dress: "#3a2c28", hat: "buns", hair: "#1d1a20", skin: "#f1c9a0",
  build: "kid", cross: "#d8c6a4", sash: "#5a3a26", head: 4 };
/** the maid as a clay figurine: terracotta all over, painted face, hairline cracks */
export const HAU_CLAY: Outfit = { ...HAU, jacket: "#8e4c30", pants: "#7a3f28", boots: "#9a5436", dress: "#743a25", hair: "#4e2618", skin: "#b06a45",
  cross: "#a65c3a", sash: "#6a321f", clay: true };
/** the older merchant friend: stout, moustache, black wrapped turban (khăn đóng) */
export const BAN: Outfit = { jacket: "#4f5a3c", pants: "#35302a", boots: "#2e2620", hat: "khandong", hair: "#2a2622", skin: "#e8bf98", build: "stout",
  moustache: "#2a201a", cross: "#c9bfa2", sash: "#2a2620", old: true, head: 2 };
/** the Taoist priest: long dark-indigo robe with wide sleeves to the feet, tall black cap, long thin beard */
export const DAOSI: Outfit = { jacket: "#28324f", pants: "#1d2236", boots: "#18171c", hat: "daocap", hair: "#1d1a20", skin: "#e3b892", robe: true,
  cross: "#15161c", sash: "#15161c", beard: "#2c282c", moustache: "#2c282c", head: 5 };
/** another young man for the ending: brown áo (áo nâu), topknot */
export const BOY2: Outfit = { jacket: "#6a4630", pants: "#2f2a26", boots: "#3a2e28", hat: "bun", hair: "#1b181d", skin: "#ecc29a", cross: "#c8b48e", sash: "#3a2a1e", head: 1 };

/** kite card (flying or fallen) on a 400 x 600 canvas */
export const fxKite = (p: Pen, flutter: number) => kiteArt(p, 200, 230, 330, flutter);
/** a pale drowned hand and forearm reaching up out of the water, 300 x 600; curl 0 open .. 1 clenched */
export const fxHand = (p: Pen, curl: number) => {
  const skin = "#bfd0cc", dark = "#8ea6a2", g = p.g;
  g.save(); g.shadowColor = "rgba(170,225,235,0.8)"; g.shadowBlur = 18;
  p.poly([[118, 600], [112, 330], [124, 270], [178, 270], [190, 330], [184, 600]], skin, 9);
  g.restore();
  p.stroke([[150, 590], [148, 330]], 3, dark);
  const palm: P2[] = ellPts(151, 238, 48, 52, 0, 360);
  p.poly(palm, skin, 9);
  const fingers: [number, number, number][] = [[-38, -95, -0.35], [-14, -118, -0.12], [12, -120, 0.08], [36, -100, 0.3]];
  for (const [dx, len, ang] of fingers) {
    const b: P2 = [151 + dx * 0.9, 206], L = -len * (1 - 0.55 * curl);
    const tip: P2 = [b[0] + Math.sin(ang) * -L * 0.6, b[1] + L + curl * 40];
    const mid: P2 = [(b[0] + tip[0]) / 2 + ang * 10, (b[1] + tip[1]) / 2 - curl * 22];
    p.line(curve(b, mid, tip, 6), skin, 20, true);
    p.dot(tip[0], tip[1] - 2, 4, "#5f6f70");
  }
  p.line(curve([108, 252], [80, 220 - 20 * curl], [74 + 30 * curl, 186 + 20 * curl], 6), skin, 22, true);
  for (let i = 0; i < 4; i++) p.ell(130 + i * 14, 330 + i * 60, 4, 7, "#d7f0f5", 2);
};
/** an old woman's pair of rubber sandals seen from above, neatly side by side, 400 x 400 */
export const fxSandals = (p: Pen) => {
  for (const [cx, rot] of [[140, -0.06], [262, 0.06]] as const) {
    const sole = ellPts(cx, 205, 55, 150, 0, 360, rot * 57);
    p.poly(sole, "#4e3a2e", 8);
    p.poly(ellPts(cx, 205, 44, 138, 0, 360, rot * 57), "#6b5040", 0);
    p.line([[cx - 46, 150], [cx, 112], [cx + 46, 150]], "#8a3a32", 22, true);
    p.line([[cx - 40, 240], [cx + 40, 240]], "#8a3a32", 16, true);
  }
};
/** low drifting mist band, 1024 x 256 (soft card) */
export const fxMist = (p: Pen, seed: number, a = 0.5, rgb = "235,240,248") => {
  const g = p.g;
  g.save(); g.filter = "blur(22px)";
  for (let i = 0; i < 9; i++) {
    const x = 120 + ((i * 173 + seed * 97) % 780), y = 128 + ((i * 53 + seed * 31) % 50) - 25, rx = 140 + ((i * 61 + seed * 13) % 120), ry = 26 + ((i * 17) % 22);
    g.fillStyle = `rgba(${rgb},${(a * (0.5 + 0.5 * ((i * 7) % 3) / 2)).toFixed(3)})`;
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
};
/** round soft glow, 256 x 256 (soft card); core colour then fall-off */
export const fxGlow = (p: Pen, col: string, a = 1) => {
  const g = p.g, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, col.replace("A", a.toFixed(3))); gr.addColorStop(0.25, col.replace("A", (a * 0.55).toFixed(3))); gr.addColorStop(1, col.replace("A", "0"));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
};
/** incense smoke wisp rising, 128 x 512 (soft card); t = time for the drift */
export const fxWisp = (p: Pen, t: number) => {
  const g = p.g;
  g.save(); g.filter = "blur(3px)"; g.lineCap = "round";
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const y = 500 - i * 12, x = 64 + Math.sin(i * 0.25 + t * 1.3 + k * 2) * (4 + i * 0.9) + (k - 1) * 4;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    const gr = g.createLinearGradient(0, 500, 0, 20); gr.addColorStop(0, "rgba(230,230,235,0.75)"); gr.addColorStop(1, "rgba(230,230,235,0)");
    g.strokeStyle = gr; g.lineWidth = 5 - k; g.stroke();
  }
  g.restore();
};
/** something under the surface: a dark soft shape with a wake, 512 x 256 (soft card, laid flat) */
export const fxUnder = (p: Pen) => {
  const g = p.g;
  g.save(); g.strokeStyle = "rgba(190,200,235,0.55)"; g.lineWidth = 5; g.lineCap = "round"; // the wake: a faint V on the surface
  for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(470, 128 + sd * 20); g.quadraticCurveTo(300, 128 + sd * 70, 60, 128 + sd * 118); g.stroke(); }
  g.beginPath(); g.ellipse(395, 128, 105, 60, 0, 0, Math.PI * 2); g.stroke();
  g.restore();
  g.save(); g.filter = "blur(14px)";
  g.fillStyle = "rgba(5,8,14,0.75)"; g.beginPath(); g.ellipse(380, 128, 90, 46, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(5,8,14,0.4)"; g.beginPath(); g.moveTo(300, 100); g.quadraticCurveTo(120, 128, 30, 128); g.quadraticCurveTo(120, 140, 300, 156); g.fill();
  g.restore();
};
/** a face just under the water seen from above (600 x 600, soft card laid flat): hair floating out, pale skin,
 *  eyes closed or hollow, the whole thing tinted by the water and fading out at the edges */
export const fxFace = (p: Pen, who: "cu" | "ba", open: boolean) => {
  const g = p.g, H = { ...headBlob(who === "cu" ? 5 : 9, 104, 0), b: 128 }, hair = who === "cu" ? "#10161b" : "#a9b0b4", skin = "#c9dadd";
  g.save();
  g.translate(300, 290); g.rotate(-0.12); g.translate(-300, -290);
  // hair drifting downstream (+x), long and wavy for her, short for him
  g.lineCap = "round";
  const n = who === "ba" ? 30 : 16;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.95 + (i / (n - 1)) * Math.PI * 1.25, r0 = 98;
    const x0 = 300 + Math.cos(a) * r0, y0 = 290 + Math.sin(a) * r0 * 0.95;
    const len = who === "ba" ? 150 + 60 * Math.sin(i * 1.7) : 50 + 20 * Math.sin(i * 2.1);
    g.strokeStyle = hair; g.globalAlpha = 0.85; g.lineWidth = who === "ba" ? 6 : 10;
    g.beginPath(); g.moveTo(x0, y0);
    g.bezierCurveTo(x0 + len * 0.4, y0 - 18 * Math.sin(i), x0 + len * 0.7, y0 + 22 * Math.cos(i * 1.3), x0 + len, y0 + 10 * Math.sin(i * 0.7));
    g.stroke();
  }
  g.globalAlpha = 1;
  const hp = blobPts(300, 290, H);
  p.shadedFill(hp, skin, "#93abb2", rad(-120), H.a);
  p.inkRing(hp, 7, thickAngle(rad(-120)), 0.45, "#1a252b");
  // eyes: closed slits or black hollows; a dark open mouth
  const u = (2 * H.a) / 100;
  for (const sd of [-1, 1]) { // sunken eye sockets
    const ex = 300 + sd * 14 * u, gr = g.createRadialGradient(ex, 292, 2, ex, 292, 16 * u);
    gr.addColorStop(0, "rgba(40,55,70,0.75)"); gr.addColorStop(1, "rgba(40,55,70,0)");
    g.fillStyle = gr; g.beginPath(); g.ellipse(ex, 292, 16 * u, 14 * u, 0, 0, Math.PI * 2); g.fill();
  }
  for (const sd of [-1, 1]) {
    if (open) { p.ell(300 + sd * 14 * u, 290, 9 * u, 11 * u, "#06080b", 0); p.dot(300 + sd * 14 * u + 2 * u, 290 + 2 * u, 1.6 * u, "#c9dadd"); }
    else p.arc(300 + sd * 14 * u, 288, 8 * u, 3 * u, 20, 160, 3 * u, "#1a252b");
    p.stroke([[300 + sd * 6 * u, 290 - 17 * u], [300 + sd * 21 * u, 290 - 15 * u]], 2.4 * u, "#3a4a52");
  }
  p.ell(300, 290 + 24 * u, 6 * u, open ? 5 * u : 2.2 * u, "#0b0f13", 0);
  if (who === "ba") wrinkles(p, 300, 290, u);
  // two wet strands stuck along the sides of the face
  for (const sd of [-1, 1]) p.stroke(curve([300 + sd * 0.5 * H.a, 290 - 0.9 * H.b], [300 + sd * 0.78 * H.a, 290 - 0.1 * H.b], [300 + sd * 0.62 * H.a, 290 + 0.6 * H.b], 8), 3 * u, hair);
  g.restore();
  // water over it: dark tint, ripple bands, soft edge
  g.save();
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = "rgba(18,36,58,0.42)"; g.fillRect(0, 0, 600, 600);
  g.strokeStyle = "rgba(200,220,240,0.18)"; g.lineWidth = 7;
  for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(300, 300, 120 + k * 45, 110 + k * 42, 0, 0, Math.PI * 2); g.stroke(); }
  g.globalCompositeOperation = "destination-in";
  const gr = g.createRadialGradient(300, 300, 110, 300, 300, 300);
  gr.addColorStop(0, "rgba(0,0,0,0.9)"); gr.addColorStop(0.65, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 600, 600);
  g.restore();
};
/** two small creases under each eye and at the mouth corners (old faces) */
const wrinkles = (p: Pen, fx: number, cy: number, u: number) => {
  for (const sd of [-1, 1]) {
    p.arc(fx + sd * 13 * u, cy + 7 * u, 6 * u, 2.4 * u, 20, 160, 1.6 * u, "rgba(90,50,40,0.55)");
    p.stroke([[fx + sd * 9 * u, cy + 13 * u], [fx + sd * 12 * u, cy + 21 * u]], 1.6 * u, "rgba(90,50,40,0.5)");
  }
};
/** water drops falling off a wet body, 300 x 300 */
export const fxDrops = (p: Pen, t: number) => {
  for (let i = 0; i < 6; i++) {
    const u = (t * 1.7 + i / 6) % 1, x = 40 + i * 44 + Math.sin(i * 3.1) * 12, y = 30 + u * 250;
    p.ell(x, y, 5, 8, `rgba(190,225,245,${(1 - u).toFixed(3)})`, 0);
  }
};

// =============================== Cây gạo: effects ===============================
/** one silk-cotton flower (hoa gạo) seen from slightly above, 256 x 256: five thick fleshy red petals, a cream-yellow
 *  stamen tuft, plum ink outline; rot = in-plane rotation (radians) */
export const fxPetal = (p: Pen, rot = 0) => {
  const g = p.g, cx = 128, cy = 134, fy = 0.78;
  p.rot = rot ? [rot, cx, cy] : null;
  const petal = (a: number) => {
    const pts: P2[] = [], n = 18, L = 96, r0 = 6;
    const P = (r: number, w: number): P2 => [cx + Math.cos(a) * r - Math.sin(a) * w, cy + (Math.sin(a) * r + Math.cos(a) * w) * fy];
    const wid = (s: number) => 37 * Math.sin(Math.PI * Math.min(1, s * 1.02)) ** 0.55 * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, s * 0.9 + 0.1)));
    for (let i = 0; i <= n; i++) { const s = i / n; pts.push(P(r0 + (L - r0) * s, wid(s))); }
    for (let i = n; i >= 0; i--) { const s = i / n; pts.push(P(r0 + (L - r0) * s, -wid(s))); }
    const [gx, gy] = p.P(cx, cy), gr = g.createRadialGradient(gx, gy, 6, gx, gy, L);
    gr.addColorStop(0, "#a81a17"); gr.addColorStop(0.3, "#c8231e"); gr.addColorStop(1, "#e0452d");
    p.path(pts, true); g.fillStyle = gr; g.fill();
    p.stroke([P(r0 + 14, 0), P(L * 0.55, 1.5), P(L * 0.86, 0)], 2.2, "#9a1915");          // mid crease
    p.stroke([P(L * 0.5, 14), P(L * 0.8, 9)], 2, "rgba(255,170,140,0.45)");                 // fleshy sheen line
    p.poly(pts, null, 4.5);
  };
  const angs = [0, 1, 2, 3, 4].map((i) => rad(-90 + 8 + i * 72));
  const back = angs.filter((a) => Math.sin(a) < 0.2), front = angs.filter((a) => Math.sin(a) >= 0.2);
  back.forEach(petal);
  // stamen tuft: a brush of filaments rising from the centre, cream anthers at the tips
  p.ell(cx, cy - 2, 16, 11, "#7a1f18", 3);
  const tips: P2[] = [];
  for (let i = 0; i < 30; i++) { // a dense round brush of filaments
    const a = rad(-90 + (i - 14.5) * 4.6), len = 26 + 12 * Math.sin(i * 2.3) ** 2, b: P2 = [cx + (i - 14.5) * 0.7, cy - 1];
    const tip: P2 = [b[0] + Math.cos(a) * len * 0.9, b[1] + Math.sin(a) * len];
    p.stroke([b, [(b[0] + tip[0]) / 2, (b[1] + tip[1]) / 2 - 2], tip], 2.4, "#f1e3b4");
    tips.push(tip);
  }
  tips.sort((A, B) => A[1] - B[1]).forEach(([x, y]) => p.ell(x, y, 4.2, 3.6, "#e6c454", 1.6));
  front.forEach(petal);
  p.rot = null;
};

/** loopable sheet of thin slanted rain streaks, light grey-blue, 1024 x 1024 (soft card). t 0..1 moves it one full
 *  period (4 tiles down, 1 tile sideways), so it loops; it also tiles in x and y. */
export const fxRain = (p: Pen, t: number) => {
  const g = p.g, S = 1024, sx = -0.25, n = 240;
  g.save(); g.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const x0 = rnd(17, i) * S, y0 = rnd(23, i) * S, len = 40 + 80 * rnd(29, i), a = 0.13 + 0.27 * rnd(31, i), w = 1.1 + 1.4 * rnd(37, i);
    const x = (((x0 + 4 * S * sx * t) % S) + S) % S, y = (((y0 + 4 * S * t) % S) + S) % S;
    const dx = sx * len / Math.hypot(1, sx), dy = len / Math.hypot(1, sx);
    g.strokeStyle = `rgba(205,220,240,${a.toFixed(3)})`; g.lineWidth = w;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0]) {
      const X = x + ox, Y = y + oy;
      if (X + Math.min(0, dx) > S || X + Math.max(0, dx) < 0 || Y > S || Y + dy < 0) continue;
      g.beginPath(); g.moveTo(X, Y); g.lineTo(X + dx, Y + dy); g.stroke();
    }
  }
  g.restore();
};

/** jagged lightning bolt with branches, 512 x 1024 (soft card): white core, a narrow pale-blue glow */
export const fxBolt = (p: Pen, seed = 1) => {
  const g = p.g, R = (k: number) => rnd(seed + 0.37, k);
  let kk = 0;
  const jag = (a: P2, b: P2, rough: number, depth: number): P2[] => {
    if (depth === 0) return [a, b];
    const m: P2 = [(a[0] + b[0]) / 2 + (R(kk++) - 0.5) * rough, (a[1] + b[1]) / 2 + (R(kk++) - 0.5) * rough * 0.3];
    return [...jag(a, m, rough * 0.55, depth - 1), ...jag(m, b, rough * 0.55, depth - 1).slice(1)];
  };
  const main = jag([256 + (R(1) - 0.5) * 80, 0], [256 + (R(2) - 0.5) * 160, 1010], 260, 6);
  const paths: [P2[], number][] = [[main, 1]];
  for (let i = 0; i < 4; i++) {
    const at = main[Math.floor(main.length * (0.18 + 0.6 * R(10 + i)))], dir = R(20 + i) < 0.5 ? -1 : 1, len = 160 + 220 * R(30 + i);
    const br = jag(at, [clamp(at[0] + dir * len * (0.5 + 0.4 * R(40 + i)), 20, 492), at[1] + len], 120, 4);
    paths.push([br, 0.55]);
    if (R(50 + i) < 0.6) { const at2 = br[Math.floor(br.length * 0.5)]; paths.push([jag(at2, [clamp(at2[0] + dir * 80, 10, 502), at2[1] + 120], 60, 3), 0.35]); }
  }
  g.save(); g.lineCap = "round"; g.lineJoin = "round";
  const pass = (col: string, w: number, blur: number) => {
    g.filter = blur ? `blur(${blur}px)` : "none";
    for (const [pts, k] of paths) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.strokeStyle = col; g.lineWidth = w * k; g.stroke(); }
  };
  pass("rgba(150,190,255,0.45)", 18, 7);
  pass("rgba(200,225,255,0.85)", 7, 2);
  pass("#ffffff", 3.2, 0);
  g.restore();
};

/** torn piece of dark-indigo cloth (the coat tail), 256 x 256: a hemmed edge with stitches, ragged torn edges, loose threads */
export const fxScrap = (p: Pen) => {
  const col = "#2f3d5c", dk = "#1f2a42";
  const torn: P2[] = [[214, 62], [222, 96], [206, 112], [226, 138], [204, 160], [214, 188], [188, 196], [176, 222], [150, 206], [128, 226], [112, 202], [86, 214], [70, 190], [46, 196], [52, 168], [30, 150], [44, 126], [34, 98]];
  const pts: P2[] = [[40, 58], [130, 48], [214, 62], ...torn.slice(1)];
  p.gradFill(pts, col, dk, rad(-120), 0.3);
  p.clip(pts, () => {
    p.stroke(curve([60, 90], [118, 140], [150, 200], 10), 3, dk);                         // fold
    p.stroke(curve([70, 96], [124, 136], [160, 190], 10), 2, "rgba(120,140,190,0.35)");
    p.band(curve([36, 70], [130, 58], [218, 74], 10), mix(col, "#000000", 0.25), 9, 0);  // the hem
    for (let i = 0; i < 12; i++) { const x = 46 + i * 15; p.stroke([[x, 64 + (x - 46) * 0.06 - (x > 130 ? (x - 130) * 0.13 : 0)], [x + 7, 64 + (x - 46) * 0.06 - (x > 130 ? (x - 130) * 0.13 : 0)]], 1.6, "rgba(190,200,225,0.55)"); }
  });
  p.poly(pts, null, 5);
  for (const [a, b] of [[[176, 222], [170, 244]], [[128, 226], [134, 246]], [[46, 196], [30, 214]], [[226, 138], [244, 142]]] as [P2, P2][])
    p.stroke(curve(a, [(a[0] + b[0]) / 2 + 4, (a[1] + b[1]) / 2], b, 5), 1.6, col);
};

/** a sickly pale green-grey curling wisp (the stench), 256 x 512 (soft card); t = time for the drift */
export const fxSmell = (p: Pen, t: number) => {
  const g = p.g;
  g.save(); g.filter = "blur(5px)"; g.lineCap = "round";
  const F = [[0.16, 1.0, 0.0], [0.27, 0.75, 2.1], [0.21, 1.25, 4.0]];
  F.forEach(([fq, sp, ph0], k) => {
    g.beginPath();
    for (let i = 0; i <= 44; i++) {
      const y = 492 - i * 10.5, amp = 6 + i * 1.9, drift = (k - 1) * (6 + i * 0.9);
      const x = 128 + drift + Math.sin(i * fq + t * sp + ph0) * amp + Math.sin(i * 0.47 + t * 0.6 + k * 2) * amp * 0.2;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    const gr = g.createLinearGradient(0, 492, 0, 30);
    gr.addColorStop(0, "rgba(176,196,148,0)"); gr.addColorStop(0.1, "rgba(176,196,148,0.75)"); gr.addColorStop(0.65, "rgba(168,186,150,0.45)"); gr.addColorStop(1, "rgba(160,176,150,0)");
    g.strokeStyle = gr; g.lineWidth = 14 - 3 * k; g.stroke();
  });
  g.restore();
};

/** the iron axe head flying off, 128 x 128; rot = in-plane rotation (radians) */
export const fxAxeHead = (p: Pen, rot = 0) => {
  const u = 2.7, x = 64 - 10 * u, y = 64;
  axeHeadArt(p, (pts) => rotPts(pts, rot, 64, 64), x, y, u);
  p.poly(rotPts(rrect(x - 3.2 * u, y - 4 * u, x + 3.2 * u, y + 4 * u, 1.5 * u, 3), rot, 64, 64), "#1a1418", 0); // the empty socket
};

/** the sky procession, 2048 x 512 (cut-out card for a storm sky): dark slate silhouettes of bull-headed soldiers (lính
 *  đầu trâu: horns, spears, three with whips raised) marching left to right on a cloud bank, a thin pale moon rim on their
 *  upper-left edges; in the middle the two pale ghosts (a man with a topknot, a woman with long hair), hunched, wrists
 *  chained, the chain held by the soldier ahead. t = walk-cycle phase 0..1. */
export const fxHorde = (p: Pen, t: number) => {
  const g = p.g, W2 = 2048, H2 = 512, base = 404, SLATE = "#1a2030", RIM = "#a9bbd2", two = Math.PI * 2;
  const layer = () => { const c = document.createElement("canvas"); c.width = W2; c.height = H2; const cg = c.getContext("2d")!; cg.setTransform(g.getTransform()); return { c, cg }; };
  const tint = (src: HTMLCanvasElement, col: string) => {
    const c = document.createElement("canvas"); c.width = src.width; c.height = src.height; const cg = c.getContext("2d")!;
    cg.drawImage(src, 0, 0); cg.globalCompositeOperation = "source-in"; cg.fillStyle = col; cg.fillRect(0, 0, c.width, c.height); return c;
  };
  const k0 = g.getTransform().a || 1;
  const rimmed = (src: HTMLCanvasElement, col: string, rim = RIM, off = 2.6) => {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(tint(src, rim), -off * k0, -off * k0);
    g.drawImage(tint(src, col), 0, 0);
    g.restore();
  };
  // ---- shapes (filled black on a mask layer; x, y = feet on the cloud top, s = scale, facing +x) ----
  type Ctx = CanvasRenderingContext2D;
  const poly = (cg: Ctx, pts: P2[]) => { cg.beginPath(); pts.forEach(([x, y], i) => (i ? cg.lineTo(x, y) : cg.moveTo(x, y))); cg.closePath(); cg.fill(); };
  const line = (cg: Ctx, pts: P2[], w: number) => { cg.beginPath(); pts.forEach(([x, y], i) => (i ? cg.lineTo(x, y) : cg.moveTo(x, y))); cg.lineWidth = w; cg.stroke(); };
  const ell = (cg: Ctx, x: number, y: number, rx: number, ry: number, r = 0) => { cg.beginPath(); cg.ellipse(x, y, rx, ry, r, 0, two); cg.fill(); };
  const horn = (cg: Ctx, pts: P2[], w0: number) => poly(cg, ribbon(curve(pts[0], pts[1], pts[2], 10), w0, 1.5, 1));
  type Kind = "spear" | "whip" | "chain";
  const soldier = (cg: Ctx, x: number, y: number, s: number, ph: number, kind: Kind): P2 => {
    const T = (px: number, py: number): P2 => [x + px * s, y + py * s];
    const sw = Math.sin(two * ph), bob = -4 * Math.abs(Math.cos(two * ph)) * s;
    const Tb = (px: number, py: number): P2 => [x + px * s, y + py * s + bob];
    cg.lineCap = "round"; cg.lineJoin = "round";
    for (const sd of [-1, 1]) { // legs + feet
      const a = rad(26 * sw * sd), hip = Tb(sd * 3, -92), f: P2 = [hip[0] + Math.sin(a) * 90 * s, hip[1] + Math.cos(a) * 90 * s];
      line(cg, [hip, [(hip[0] + f[0]) / 2 + 3 * s, (hip[1] + f[1]) / 2], f], 12 * s); line(cg, [f, [f[0] + 16 * s, f[1] + 1 * s]], 9 * s);
    }
    poly(cg, [Tb(-27, -116), Tb(25, -116), Tb(33, -68), Tb(6, -74), Tb(-32, -68)]);                   // armour skirt
    cg.beginPath(); cg.ellipse(...Tb(3, -140), 27 * s, 40 * s, rad(6), 0, two); cg.fill();           // torso
    ell(cg, ...Tb(5, -166), 21 * s, 11 * s, rad(-8));                                                 // shoulder plate
    poly(cg, [Tb(-2, -178), Tb(12, -178), Tb(14, -168), Tb(-4, -168)]);                               // neck
    ell(cg, ...Tb(6, -193), 20 * s, 19 * s, rad(10));                                                 // skull
    poly(cg, [Tb(12, -206), Tb(34, -204), Tb(44, -196), Tb(46, -180), Tb(38, -170), Tb(18, -171)]);    // blunt snout
    poly(cg, [Tb(-6, -199), Tb(-33, -203), Tb(-36, -197), Tb(-10, -188)]);                            // ear, sticking out
    horn(cg, [Tb(-6, -206), Tb(-30, -222), Tb(-20, -246)], 10 * s);                                   // far horn
    horn(cg, [Tb(10, -208), Tb(-6, -228), Tb(14, -250)], 11 * s);                                     // near horn
    cg.lineWidth = 3 * s; cg.beginPath(); cg.arc(...Tb(44, -181), 5 * s, rad(-60), rad(200)); cg.stroke(); // nose ring
    const S2 = Tb(8, -160);
    if (kind === "whip") {
      const hand = Tb(-16, -228);
      line(cg, [S2, Tb(-10, -196), hand], 10 * s);
      line(cg, [hand, Tb(-28, -244)], 6 * s);
      const lash = curve(Tb(-28, -244), Tb(-100, -300 - 20 * sw), Tb(-160, -238), 16);
      lash.push(...curve(Tb(-160, -238), Tb(-172, -222), Tb(-152, -218), 5).slice(1));
      cg.beginPath(); lash.forEach(([px, py], i) => (i ? cg.lineTo(px, py) : cg.moveTo(px, py))); cg.lineWidth = 3 * s; cg.stroke();
      line(cg, [S2, Tb(24, -130), Tb(34, -118)], 10 * s);
      return hand;
    }
    if (kind === "chain") {
      const hand = Tb(-30, -122);
      line(cg, [S2, Tb(-14, -138), hand], 10 * s);
      line(cg, [S2, Tb(26, -136), Tb(30, -124)], 10 * s);
      line(cg, [Tb(22, -20), Tb(40, -318)], 4.5 * s);                                                // spear in the other hand
      poly(cg, [Tb(40, -318), Tb(46, -334), Tb(41, -356), Tb(35, -334)]);
      return hand;
    }
    const hand = Tb(30, -128);
    line(cg, [S2, Tb(26, -142), hand], 10 * s);
    line(cg, [Tb(23, -26), Tb(42, -322)], 4.5 * s);                                                  // spear shaft
    poly(cg, [Tb(42, -322), Tb(49, -339), Tb(43, -362), Tb(36, -339)]);                               // blade
    ell(cg, ...Tb(41, -312), 6 * s, 5 * s);                                                           // tassel knot
    line(cg, [S2, Tb(-12, -134), Tb(-22 - 8 * sw, -114)], 10 * s);                                   // far arm swinging
    return hand;
  };
  /** pale prisoner (our cast's build in silhouette): hunched, head bowed, wrists together in front; hair on its own
   *  layer (drawn a shade darker). Returns the wrists. */
  const prisoner = (cg: Ctx, hg: Ctx, x: number, y: number, s: number, ph: number, woman: boolean): P2 => {
    const sw = Math.sin(two * ph), bob = -3 * Math.abs(Math.cos(two * ph)) * s, lean = rad(24), bow = lean + rad(30);
    const hip: P2 = [x, y - 76 * s + bob];
    const Rl = (px: number, py: number): P2 => [hip[0] + (px * Math.cos(lean) - py * Math.sin(lean)) * s, hip[1] + (px * Math.sin(lean) + py * Math.cos(lean)) * s];
    cg.lineCap = hg.lineCap = "round"; cg.lineJoin = hg.lineJoin = "round";
    if (woman) { // long skirt to the ankles, two small feet
      for (const sd of [-1, 1]) line(cg, [[x + sd * 7 * s + 4 * sw * sd * s, y - 2 * s], [x + sd * 7 * s + 4 * sw * sd * s + 11 * s, y - 2 * s]], 7 * s);
      poly(cg, [Rl(-19, 4), Rl(19, 4), [x + 24 * s + 3 * sw * s, y - 3 * s], [x - 22 * s + 3 * sw * s, y - 3 * s]]);
    } else for (const sd of [-1, 1]) {
      const a = rad(18 * sw * sd), f: P2 = [hip[0] + Math.sin(a) * 74 * s, hip[1] + Math.cos(a) * 74 * s];
      line(cg, [hip, f], 9 * s); line(cg, [f, [f[0] + 12 * s, f[1]]], 8 * s);
    }
    cg.beginPath(); cg.ellipse(...Rl(1, -36), 23 * s, 40 * s, lean, 0, two); cg.fill();               // bean torso
    const neck = Rl(2, -74), hr = 29 * s, hc: P2 = [neck[0] + Math.sin(bow) * hr * 0.9, neck[1] - Math.cos(bow) * hr * 0.9];
    cg.beginPath(); cg.ellipse(hc[0], hc[1], hr, hr * 0.94, bow, 0, two); cg.fill();                   // bean head, bowed
    // hair: cap over the back of the head; long hair down her back / his topknot
    const back: P2 = [hc[0] - Math.cos(bow) * hr, hc[1] - Math.sin(bow) * hr], top: P2 = [hc[0] + Math.sin(bow) * hr, hc[1] - Math.cos(bow) * hr];
    hg.save(); hg.beginPath(); hg.ellipse(hc[0], hc[1], hr * 1.03, hr * 0.97, bow, 0, two); hg.clip();
    poly(hg, [[back[0] - 20 * s, back[1] + 30 * s], [back[0] - 20 * s, back[1] - 40 * s], [top[0] + 30 * s, top[1] - 20 * s], [top[0] + 6 * s, top[1] + 14 * s], [hc[0] - 4 * s, hc[1] + 6 * s]]);
    hg.restore();
    if (woman) poly(hg, [[back[0] + 2 * s, back[1] - 8 * s], [back[0] - 10 * s, back[1] + 30 * s], Rl(-30, -10), Rl(-14, -6), [back[0] + 14 * s, back[1] + 8 * s]]);
    else ell(hg, top[0] - 6 * s, top[1] - 4 * s, 9 * s, 7 * s, bow);
    const sh = Rl(6, -62), wr: P2 = [hip[0] + 30 * s, hip[1] - 20 * s];
    line(cg, [sh, [sh[0] + 4 * s, sh[1] + 30 * s], wr], 8 * s);
    ell(cg, wr[0] + 2 * s, wr[1], 6 * s, 5 * s);                                                       // shackle
    return wr;
  };
  // ---- the scene ----
  const xs = [70, 190, 312, 432, 552, 672, 792, 905, 1015, 1135, 1262, 1384, 1505, 1625, 1745, 1865, 1980];
  const kinds: (Kind | "P2" | "P1")[] = ["spear", "spear", "spear", "whip", "spear", "spear", "whip", "P2", "P1", "chain", "spear", "whip", "spear", "spear", "spear", "spear", "spear"];
  // back cloud bank
  const cb = layer();
  cb.cg.fillStyle = "#000";
  for (let i = 0; i < 34; i++) { const x = i * 64 + 20 * Math.sin(i * 1.7), r = 52 + 30 * rnd(3, i); cb.cg.beginPath(); cb.cg.ellipse(x, base + 36 - 0.35 * r, r, r * 0.62, 0, 0, two); cb.cg.fill(); }
  cb.cg.fillRect(0, base + 30, W2, H2 - base - 30);
  // soldiers
  const sl = layer(), cg = sl.cg; cg.fillStyle = "#000"; cg.strokeStyle = "#000";
  const pale = layer(), pg = pale.cg; pg.fillStyle = "#000"; pg.strokeStyle = "#000";
  const hair = layer(), hg2 = hair.cg; hg2.fillStyle = "#000"; hg2.strokeStyle = "#000";
  let holder: P2 = [0, 0]; const wrists: P2[] = [];
  xs.forEach((x, i) => {
    const k = kinds[i], s = 1 + 0.05 * Math.sin(i * 2.1), y = base + 4 * Math.sin(i * 1.3), ph = (t + i * 0.07) % 1;
    if (k === "P1" || k === "P2") wrists[k === "P1" ? 0 : 1] = prisoner(pg, hg2, x, y, 0.95, ph, k === "P2");
    else { const h = soldier(cg, x, y, s, ph, k); if (k === "chain") holder = h; }
  });
  // front cloud puffs over the feet
  const cf = layer();
  cf.cg.fillStyle = "#000";
  for (let i = 0; i < 46; i++) { const x = i * 46 + 14 * Math.sin(i * 2.3), r = 26 + 20 * rnd(5, i); cf.cg.beginPath(); cf.cg.ellipse(x, base + 22 - 0.2 * r, r, r * 0.55, 0, 0, two); cf.cg.fill(); }
  cf.cg.fillRect(0, base + 26, W2, H2 - base - 26);
  // fade the bank out toward the bottom of the card
  for (const L2 of [cb, cf]) {
    L2.cg.save(); L2.cg.globalCompositeOperation = "destination-in";
    const gr = L2.cg.createLinearGradient(0, base - 60, 0, H2); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.55, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    L2.cg.fillStyle = gr; L2.cg.fillRect(0, 0, W2, H2); L2.cg.restore();
  }
  rimmed(cb.c, "#232a3c", "#6f7f98", 2);
  rimmed(sl.c, SLATE);
  // the two ghosts: pale fill with a thin darker contour
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const both = document.createElement("canvas"); both.width = pale.c.width; both.height = pale.c.height;
  both.getContext("2d")!.drawImage(pale.c, 0, 0); both.getContext("2d")!.drawImage(hair.c, 0, 0);
  const ol = tint(both, "#5d7080");
  for (const [dx, dy] of [[-1.6, 0], [1.6, 0], [0, -1.6], [0, 1.6]]) g.drawImage(ol, dx * k0, dy * k0);
  g.drawImage(tint(pale.c, "#cfe0e8"), 0, 0);
  g.drawImage(tint(hair.c, "#8fa3b3"), 0, 0);
  g.restore();
  // chains: holder's hand -> the man's wrists -> the woman's wrists, small links
  const chain = (a: P2, b: P2) => {
    const n = Math.max(2, Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / 9)), sag = 14;
    g.save(); g.lineWidth = 2.2; g.strokeStyle = "#8b98ab";
    for (let i = 0; i < n; i++) {
      const u0 = (i + 0.5) / n, x = a[0] + (b[0] - a[0]) * u0, y = a[1] + (b[1] - a[1]) * u0 + sag * Math.sin(Math.PI * u0);
      g.beginPath(); g.ellipse(x, y, i % 2 ? 4.6 : 3, i % 2 ? 2.4 : 3.4, Math.atan2(b[1] - a[1], b[0] - a[0]), 0, two); g.stroke();
    }
    g.restore();
  };
  if (wrists[0] && wrists[1]) { chain(holder, wrists[0]); chain(wrists[0], wrists[1]); }
  rimmed(cf.c, "#1d2333", "#5f6e86", 1.6);
};

// =============================== Ma da (long): acting cast, props and effects ===============================
/** Tí at seventy: the same bowl haircut gone white-grey, wrinkles, a brown áo bà ba, thin */
export const TI_OLD: Outfit = { jacket: "#6b4a34", pants: "#2a2622", boots: "#d9ad84", hat: "hair", hair: "#d6d3ce", build: "adult", skin: "#e6bd96",
  old: true, slim: 0.86, buttons: "#3a2a20", brows: 0.9 };
/** the village ritual master (thầy cúng): long black tunic, black wrapped turban, sparse grey beard, heavy brows */
export const THAY: Outfit = { jacket: "#24212b", pants: "#1b1a20", boots: "#17161a", hat: "khandong", hair: "#3b3836", build: "adult", skin: "#dcb48e",
  robe: true, cross: "#3a3644", sash: "#15141a", beard: "#9b9792", moustache: "#8d8985", old: true, brows: 1.35, head: 7 };
/** Na, five years old: drawn at 0.8 scale, two short pigtails tied in red, a faded red áo */
export const NA: Outfit = { jacket: "#c8685f", pants: "#3a3038", boots: "#e8b98c", hat: "pigtails", hair: "#1d1a20", build: "kid", skin: "#f3cfaa",
  small: 0.8, head: 8, buttons: "#9c4a44" };
/** the drowned grandfather: an old man, pale grey-blue skin (like BA_GHOST), wet thin grey hair, a thin moustache */
export const ONG_GHOST: Outfit = { jacket: "#8fa2a8", pants: "#3f4a52", boots: "#b9c9cc", hat: "hair", hair: "#c3c9cc", build: "adult", skin: "#cfdfe0",
  wet: true, old: true, moustache: "#9aa6aa", slim: 0.92, head: 9 };
/** the grandmother soaked through: wet strands stuck to the face, darker clothes */
export const BA_WET: Outfit = { ...BA, jacket: "#4d3323", pants: "#19181d", boots: "#2a1f18", hair: "#b9b4ae", wet: true };

/** a straw effigy (hình nhân rơm) the size of a child on a 400 x 700 canvas: bound straw bundles for the head, arms and
 *  legs, wearing a boy's white shirt; wet = darker, limp, dripping */
export const fxEffigy = (p: Pen, wet: boolean) => {
  const straw = wet ? "#8d7742" : "#dcb75e", dark = wet ? "#5c4c28" : "#a67f33", cord = wet ? "#5a3020" : "#8e3a2a", shirt = wet ? "#bdb8a8" : "#f0eadb";
  const ol0 = p.ol;
  const fray = (q: P2, ang: number, n = 5, len = 26) => {
    p.ol = 3.6;
    for (let i = 0; i < n; i++) { const a = ang + (i - (n - 1) / 2) * 0.26 + (wet ? 0.25 * Math.sign(Math.cos(ang) || 1) : 0); p.line([q, [q[0] + Math.cos(a) * len * (0.75 + 0.25 * ((i * 7) % 3) / 2), q[1] + Math.sin(a) * len]], straw, 6); }
    p.ol = ol0;
  };
  const bundle = (pts: P2[], w0: number, w1: number, ties: number[]) => {
    const rb = ribbon(pts, w0, w1, 1);
    p.poly(rb, straw, 8);
    p.clip(rb, () => {
      for (const k of [-0.3, 0, 0.3]) p.stroke(pts.map(([x, y], i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [x - ((b[1] - a[1]) / l) * k * w0, y + ((b[0] - a[0]) / l) * k * w0] as P2; }), 2.4, dark);
    });
    for (const t of ties) {
      const i = Math.round(t * (pts.length - 1)), a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const w = (w0 + (w1 - w0) * t) / 2 + 3, nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l;
      p.band([[pts[i][0] + nx * w, pts[i][1] + ny * w], [pts[i][0] - nx * w, pts[i][1] - ny * w]], cord, 7, 2.5, "round");
    }
  };
  // legs: two bundles, bound at the knee and the ankle, straw ends splayed as feet
  for (const sd of [-1, 1]) {
    const hip: P2 = [200 + sd * 30, 430], knee: P2 = [200 + sd * (wet ? 44 : 38), 540], foot: P2 = [200 + sd * (wet ? 40 : 46), 640];
    fray(foot, Math.PI / 2 + sd * -0.25, 5, 30);
    bundle(curve(hip, knee, foot, 10), 44, 34, [0.5, 0.92]);
  }
  // arms: out of the short sleeves (dry: held out stiffly; wet: hanging)
  for (const sd of [-1, 1]) {
    const sh: P2 = [200 + sd * 62, 268], el: P2 = wet ? [200 + sd * 112, 340] : [200 + sd * 118, 286], hd: P2 = wet ? [200 + sd * 122, 428] : [200 + sd * 160, 300];
    fray(hd, wet ? Math.PI / 2 : sd > 0 ? 0.1 : Math.PI - 0.1, 5, 26);
    bundle(curve(sh, el, hd, 10), 36, 28, [0.88]);
  }
  // straw belly under the shirt hem, then the shirt
  bundle([[200, 380], [200, 420], [200, 462]], 104, 96, []);
  const body: P2[] = [[138, 232], [262, 232], [274, 300], [268, 408], [200, 418], [132, 408], [126, 300]];
  for (const sd of [-1, 1]) p.poly([[200 + sd * 56, 236], [200 + sd * 112, wet ? 268 : 250], [200 + sd * (wet ? 124 : 128), wet ? 322 : 296], [200 + sd * 84, wet ? 330 : 316], [200 + sd * 62, 300]], shirt, 8);
  p.gradFill(body, shirt, mul(shirt, [0.8, 0.82, 0.88]), rad(-120));
  p.clip(body, () => {
    p.stroke([[200, 240], [200, 416]], 3, mul(shirt, [0.7, 0.7, 0.76]));
    for (let i = 0; i < 4; i++) { p.dot(207, 268 + i * 38, 5.5, INK); p.dot(207, 268 + i * 38, 3.6, mul(shirt, [0.78, 0.78, 0.82])); }
    if (wet) for (const [x, y, l] of [[150, 300, 70], [176, 340, 60], [236, 290, 90], [252, 350, 50]] as const) p.stroke([[x, y], [x + 3, y + l]], 5, "rgba(90,100,110,0.28)");
  });
  p.poly(body, null, 8);
  for (const sd of [-1, 1]) p.poly([[200, 250], [200 + sd * 34, 232], [200 + sd * 28, 262]], shirt, 5); // collar
  // head: a round bundle bound at the neck and the crown, the straw ends standing up (wet: flopped over)
  bundle([[200, 248], [200, 222]], 50, 46, [0.5]);
  p.ol = 3.6;
  for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.2 + (wet ? 0.5 + i * 0.12 : 0); p.line([[200 + (i - 3) * 6, 62], [200 + (i - 3) * 6 + Math.cos(a) * (wet ? 40 : 46), 62 + Math.sin(a) * (wet ? 30 : 46)]], straw, 7); }
  p.ol = ol0;
  const head = blobPts(200, 138, { a: 84, b: 84, nTop: 2.1, nBot: 2.3, egg: -0.05, asym: 0, rot: wet ? 0.1 : 0, noise: 0.012, seed: 4 });
  p.shadedFill(head, straw, shade(straw, 0.8), rad(-120), 84);
  p.clip(head, () => {
    for (let i = -4; i <= 4; i++) p.stroke(curve([200 + i * 14, 58], [200 + i * 21, 138], [200 + i * 14, 222], 8), 2.4, dark);
    p.band(curve([112, 150], [200, 164], [288, 150], 10), cord, 7, 2.5); p.band(curve([116, 96], [200, 108], [284, 96], 10), cord, 7, 2.5);
  });
  p.poly(head, null, 9);
  p.band([[176, 66], [224, 66]], cord, 8, 2.5, "round");
  if (wet) for (const [x, y] of [[122, 448], [278, 452], [160, 668], [246, 672], [200, 480], [296, 250]] as const) p.ell(x, y, 5, 8.5, "#bfe0f0", 2.4);
};
/** a folded leaf boat (thuyền lá) seen 3/4 from above, 256 x 256 */
export const fxLeafBoat = (p: Pen) => {
  const leaf = "#6aa544", inner = "#3f7a30", light = "#8cc45e";
  const bow: P2 = [22, 132], stern: P2 = [236, 112];
  const far = curve(bow, [128, 84], stern, 14), near = curve(stern, [134, 150], bow, 14), keel = curve(stern, [140, 206], bow, 14);
  p.poly([...far, ...near.slice(1, -1)], inner, 0); // the inside, seen over the near rim
  p.clip([...far, ...near.slice(1, -1)], () => { for (let i = 1; i < 7; i++) { const q = far[i * 2]; p.stroke([q, [q[0] + 4, q[1] + 34]], 1.6, shade(inner, 0.78)); } });
  const hull: P2[] = [...near, ...keel.slice().reverse().slice(1, -1)];
  p.gradFill(hull, light, leaf, rad(-110), 0.15);
  p.clip(hull, () => { // the leaf's veins run along the hull, the midrib a little lighter
    p.stroke(curve([30, 140], [134, 180], [230, 122], 12), 2.2, mix(leaf, "#ffffff", 0.35));
    for (let i = 0; i < 8; i++) { const x = 46 + i * 24; p.stroke([[x, 138 + 20 * Math.sin((i + 0.5) / 8 * Math.PI)], [x + 12, 196]], 1.4, shade(leaf, 0.72)); }
  });
  p.poly([...far, ...near.slice(1, -1)], null, 6);
  p.poly(hull, null, 7);
  // the pinched ends, each skewered with a sliver of bamboo
  for (const [q, d] of [[bow, -1], [stern, 1]] as const) {
    p.poly([[q[0], q[1] - 10], [q[0] + d * 14, q[1] - 2], [q[0] + d * 4, q[1] + 12], [q[0] - d * 8, q[1] + 4]], leaf, 5);
    p.band([[q[0] - d * 10, q[1] - 10], [q[0] + d * 12, q[1] + 10]], "#d9c48a", 2.6, 1.6, "round");
  }
};
/** a bamboo fishing rod floating on the water, 600 x 120: the pole, its line trailing in a loose curl, a few ripples */
export const fxRod = (p: Pen) => {
  for (const [x0, x1, y] of [[40, 190, 92], [240, 420, 100], [470, 570, 84], [120, 300, 34], [360, 520, 30]] as const)
    p.stroke(curve([x0, y], [(x0 + x1) / 2, y + 5], [x1, y], 8), 3, "rgba(240,250,255,0.6)");
  const line: P2[] = [];
  for (let i = 0; i <= 30; i++) { const t = i / 30; line.push([566 - t * 230 + 22 * Math.sin(t * 9), 46 + t * 46 + 12 * Math.sin(t * 7 + 1)]); }
  p.stroke(line, 1.8, "#4a4350");
  const e = line[30]; p.ell(e[0], e[1], 5, 8, "#f3efe6", 2.4, 0, 360, 60); p.ell(e[0], e[1], 5, 4.4, "#c9373a", 0, 180, 360, 60);
  bambooArt(p, [28, 72], [568, 46], 15, 5, 3.6);
};
/** a bowl of white rice with a pair of chopsticks laid across it, seen 3/4 from above, 256 x 256 (put it on a step) */
export const fxBowl = (p: Pen) => {
  const china = "#eef1f3", cx = 128, cy = 112, rx = 86, ry = 34;
  p.ell(cx, 214, 58, 13, "rgba(30,20,30,0.22)", 0);
  p.poly([[cx - 36, 186], [cx + 36, 186], [cx + 31, 212], ...ellPts(cx, 212, 31, 7, 0, 180, 0, 10).slice(1, -1), [cx - 31, 212]], shade(china, 0.88), 6);
  const body: P2[] = [...ellPts(cx, cy, rx, ry, 180, 360, 0, 24), ...ellPts(cx, cy, rx, 86, 0, 180, 0, 28).slice(1, -1)];
  p.gradFill(body, china, shade(china, 0.8), rad(-120), 0.3);
  p.clip(body, () => {
    p.stroke(ellPts(cx, cy + 10, rx + 2, ry + 26, 8, 172, 0, 24), 5, "#4a6fa8");
    p.stroke(ellPts(cx, cy + 10, rx - 4, ry + 34, 14, 166, 0, 24), 2, "#7f9bc6");
  });
  p.poly(body, null, 7);
  p.ell(cx, cy, rx - 5, ry - 4, "#d9dde0", 0); // the inside of the rim
  // the heap of rice
  const rice: P2[] = [...ellPts(cx, cy - 2, rx - 12, 58, 180, 360, 0, 24), ...ellPts(cx, cy - 2, rx - 12, ry - 8, 0, 180, 0, 24).slice(1, -1)];
  p.shadedFill(rice, "#fffef8", "#e3dfd0", rad(-120), 70, 0.4, 0.9, 1.3);
  p.clip(rice, () => { for (let i = 0; i < 26; i++) { const x = cx - 62 + ((i * 53) % 124), y = cy - 46 + ((i * 31) % 64); p.arc(x, y, 6, 3.4, 200 + (i % 3) * 20, 340, 1.8, "#cdc8b6"); } });
  p.poly(rice, null, 6);
  p.stroke(ellPts(cx, cy, rx, ry, 10, 170, 0, 20), 6);
  for (const d of [0, 13]) p.band([[26, 96 - d], [232, 60 - d]], "#7a4a2a", 7, 2.6, "round");
};
/** the full moon, 256 x 256 (soft card): a pale disc with soft grey seas and a faint halo */
export const fxMoon = (p: Pen) => {
  const g = p.g;
  const halo = g.createRadialGradient(128, 128, 80, 128, 128, 128);
  halo.addColorStop(0, "rgba(236,238,214,0.32)"); halo.addColorStop(1, "rgba(236,238,214,0)");
  g.fillStyle = halo; g.fillRect(0, 0, 256, 256);
  g.save(); g.filter = "blur(1.5px)";
  const disc = g.createRadialGradient(108, 106, 10, 128, 128, 92);
  disc.addColorStop(0, "#fffdf0"); disc.addColorStop(0.7, "#f4f0d6"); disc.addColorStop(1, "#e2dcc0");
  g.fillStyle = disc; g.beginPath(); g.arc(128, 128, 90, 0, Math.PI * 2); g.fill();
  g.restore();
  g.save(); g.beginPath(); g.arc(128, 128, 89, 0, Math.PI * 2); g.clip(); g.filter = "blur(5px)";
  for (const [x, y, rx, ry, a] of [[100, 96, 30, 22, 0.3], [150, 110, 24, 30, 0.26], [112, 150, 34, 20, 0.24], [164, 162, 18, 14, 0.2], [78, 134, 12, 16, 0.18], [140, 70, 14, 9, 0.16]] as const) {
    g.fillStyle = `rgba(168,166,150,${a})`; g.beginPath(); g.ellipse(x, y, rx, ry, 0.4, 0, Math.PI * 2); g.fill();
  }
  g.restore();
};
/** a small torch / oil-lamp flame, 128 x 256 (soft card); t = time in seconds for the flicker. The wick is at (64, 214). */
export const fxTorch = (p: Pen, t: number) => {
  const g = p.g, fl = 0.5 + 0.5 * Math.sin(t * 13.1) * Math.sin(t * 7.3 + 1), sw = Math.sin(t * 9.7) * 5 + Math.sin(t * 23.3) * 2.5;
  const glow = g.createRadialGradient(64, 160, 4, 64, 160, 64);
  glow.addColorStop(0, `rgba(255,190,90,${(0.5 + 0.12 * fl).toFixed(3)})`); glow.addColorStop(0.5, "rgba(255,150,60,0.16)"); glow.addColorStop(1, "rgba(255,140,50,0)");
  g.fillStyle = glow; g.fillRect(0, 60, 128, 196);
  const flame = (w: number, h: number, col: string, blur: number) => {
    const tipX = 64 + sw * (h / 150), tipY = 214 - h;
    g.save(); g.filter = `blur(${blur}px)`; g.fillStyle = col;
    g.beginPath(); g.moveTo(64 - w * 0.55, 214);
    g.bezierCurveTo(64 - w * 1.25, 214 - h * 0.35, 64 - w * 0.5 + sw * 0.5, 214 - h * 0.7, tipX, tipY);
    g.bezierCurveTo(64 + w * 0.5 + sw * 0.5, 214 - h * 0.7, 64 + w * 1.25, 214 - h * 0.35, 64 + w * 0.55, 214);
    g.quadraticCurveTo(64, 214 + w * 0.5, 64 - w * 0.55, 214);
    g.fill(); g.restore();
  };
  const h = 128 + 22 * fl;
  flame(25, h, "rgba(255,120,40,0.85)", 4);
  flame(18, h * 0.8, "rgba(255,196,80,0.95)", 2.5);
  flame(10, h * 0.5, "rgba(255,246,210,0.98)", 1.5);
  g.save(); g.filter = "blur(1px)"; g.fillStyle = "rgba(80,90,170,0.55)"; g.beginPath(); g.ellipse(64, 211, 7, 5, 0, 0, Math.PI * 2); g.fill(); g.restore();
};
