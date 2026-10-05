import { $, css, MONO, reduce } from './util.js';
import { award, trophyCount, TROPHY_TOTAL } from './trophies.js';

/* ================= background field =================
   A character grid. Faint field dots, a fading cursor trail, and
   robots running steering behaviours: wander, arrive (waypoints),
   flee (cursor), separation. Drawn as text on a canvas.            */
const bg = $('bg'), bctx = bg.getContext('2d');
const FONT_PX = 14, LINE = 19;
let CW = 8.4, cols = 0, rows = 0, W = 0, H = 0, dpr = 1;
const pointer = { x: -1e4, y: -1e4, active: false, lastMove: 0 };
const trail = [];            // {c, r, t, g}
const ripples = [];          // {x, y, t}
let waypoint = null;         // {x, y, t}
const ARROWS = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];


// ---- text mask: per-cell 0..1 value, 1 under text lines, feathered edges ----
let mask = new Float32Array(0), maskDirty = true;
const FEATHER = 2.5;               // cells of soft edge
function buildMask() {
  maskDirty = false;
  mask = new Float32Array(cols * rows);
  const root = document.querySelector('main');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (!n.textContent.trim() || n.parentElement.closest('.term-box, .status')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  const range = document.createRange();
  let n;
  while ((n = walker.nextNode())) {
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.bottom < -LINE || r.top > H + LINE || r.width < 1) continue;
      const c0 = r.left / CW, c1 = r.right / CW, r0 = r.top / LINE, r1 = r.bottom / LINE;
      const ca = Math.max(0, Math.floor(c0 - FEATHER - 1)), cb = Math.min(cols - 1, Math.ceil(c1 + FEATHER + 1));
      const ra = Math.max(0, Math.floor(r0 - FEATHER)), rb = Math.min(rows - 1, Math.ceil(r1 + FEATHER));
      for (let rr = ra; rr <= rb; rr++) {
        const cy = rr + 0.5, dy = cy < r0 ? r0 - cy : cy > r1 ? cy - r1 : 0;
        for (let cc = ca; cc <= cb; cc++) {
          const cx = cc + 0.5, dx = cx < c0 ? c0 - cx : cx > c1 ? cx - c1 : 0;
          const d = Math.hypot(dx * 0.6, dy) - 0.4;      // a little padding, rounder in x
          const v = d <= 0 ? 1 : Math.max(0, 1 - d / FEATHER);
          const i = rr * cols + cc;
          if (v > mask[i]) mask[i] = v;
        }
      }
    }
  }
}
const quiet = (x, y) => {           // alpha multiplier at a pixel position
  const c = Math.floor(x / CW), r = Math.floor(y / LINE);
  if (c < 0 || r < 0 || c >= cols || r >= rows) return 1;
  const m = mask[r * cols + c];
  return 1 - 0.92 * m * m * (3 - 2 * m);   // smoothstep falloff
};
addEventListener('scroll', () => { maskDirty = true; }, { passive: true });
if ('ResizeObserver' in window) new ResizeObserver(() => { maskDirty = true; }).observe(document.body);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { maskDirty = true; });

function sizeBg() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  bg.width = Math.round(W * dpr); bg.height = Math.round(H * dpr);
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  bctx.font = `${FONT_PX}px ${MONO}`;
  CW = bctx.measureText('M').width || 8.4;
  cols = Math.ceil(W / CW); rows = Math.ceil(H / LINE); maskDirty = true;
}

// robots
const MAX_BOTS = 30;
let N = innerWidth < 600 ? 4 : 7;
try { const saved = parseInt(localStorage.getItem('ab-bots'), 10); if (saved >= 0 && saved <= MAX_BOTS) N = saved; } catch (e) {}
const rnd = (a, b) => a + Math.random() * (b - a);
const makeBot = (x = rnd(0, innerWidth), y = rnd(0, innerHeight)) => ({
  x, y, vx: rnd(-40, 40), vy: rnd(-40, 40),
  tx: rnd(0, innerWidth), ty: rnd(0, innerHeight), path: [], lastCell: -1, scared: 0
});
const bots = Array.from({ length: N }, () => makeBot());
function setBots(n) {
  n = Math.max(0, Math.min(MAX_BOTS, n));
  while (bots.length < n) bots.push(makeBot(rnd(20, innerWidth - 20), rnd(20, innerHeight - 20)));
  while (bots.length > n) bots.pop();
  try { localStorage.setItem('ab-bots', String(n)); } catch (e) {}
  $('sBots').textContent = `${bots.length}`;
}
$('botMinus').addEventListener('click', () => setBots(bots.length - 1));
$('botPlus').addEventListener('click', () => setBots(bots.length + 1));
$('sBots').textContent = `${bots.length}`;
const MAX_SPEED = 95, MAX_FORCE = 220, ARRIVE_R = 90, FLEE_R = 130, SEP_R = 40;

function limit(v, m) { const l = Math.hypot(v[0], v[1]); return l > m ? [v[0] / l * m, v[1] / l * m] : v; }
function arrive(b, tx, ty, speed = MAX_SPEED) {
  const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1e-4;
  const s = d < ARRIVE_R ? speed * d / ARRIVE_R : speed;
  return limit([dx / d * s - b.vx, dy / d * s - b.vy], MAX_FORCE);
}
function flee(b, cx, cy) {
  const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy) || 1e-4;
  if (d >= FLEE_R) return [0, 0];
  const k = 1 - d / FLEE_R;
  return limit([dx / d * MAX_SPEED * 3 * k, dy / d * MAX_SPEED * 3 * k], MAX_FORCE * 2.2);
}

function update(dt, now) {
  for (const b of bots) {
    let f = [0, 0];
    // target: waypoint if fresh, else wander target
    if (waypoint && now - waypoint.t < 6000) {
      const a = arrive(b, waypoint.x + Math.cos(now / 500 + b.x) * 22, waypoint.y + Math.sin(now / 500 + b.y) * 22, MAX_SPEED * 1.4);
      f[0] += a[0]; f[1] += a[1];
    } else {
      if (Math.hypot(b.tx - b.x, b.ty - b.y) < 30) { b.tx = rnd(20, W - 20); b.ty = rnd(20, H - 20); }
      const a = arrive(b, b.tx, b.ty, MAX_SPEED * 0.7); f[0] += a[0]; f[1] += a[1];
    }
    if (pointer.active) {
      const fl = flee(b, pointer.x, pointer.y);
      if (fl[0] || fl[1]) { f[0] += fl[0]; f[1] += fl[1]; if (Math.hypot(b.x - pointer.x, b.y - pointer.y) < 70) award('scatter'); }
    }
    for (const o of bots) if (o !== b) {
      const dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < SEP_R) { f[0] += dx / d * 60; f[1] += dy / d * 60; }
    }
    b.vx += f[0] * dt; b.vy += f[1] * dt;
    [b.vx, b.vy] = limit([b.vx, b.vy], MAX_SPEED * 1.8);
    b.x += b.vx * dt; b.y += b.vy * dt;
    // soft walls
    if (b.x < 0) { b.x = 0; b.vx *= -1; } if (b.x > W) { b.x = W; b.vx *= -1; }
    if (b.y < 0) { b.y = 0; b.vy *= -1; } if (b.y > H) { b.y = H; b.vy *= -1; }
    // odometry trail: record cell changes
    const c = Math.floor(b.x / CW), r = Math.floor(b.y / LINE), id = r * 10000 + c;
    if (id !== b.lastCell) { b.path.push({ c, r, t: now }); b.lastCell = id; if (b.path.length > 40) b.path.shift(); }
  }
}

function draw(now) {
  const dim = css('--dim'), muted = css('--muted'), green = css('--prompt'), amber = css('--amber'), fg = css('--fg');
  if (maskDirty) buildMask();
  bctx.clearRect(0, 0, W, H);
  bctx.font = `${FONT_PX}px ${MONO}`;
  bctx.textBaseline = 'top';
  const pc = pointer.x / CW, pr = pointer.y / LINE;

  // field dots on a sparse tile grid; brighten near the cursor
  for (let r = 1; r < rows; r += 2) {
    for (let c = 2; c < cols; c += 4) {
      const d = pointer.active ? Math.hypot((c - pc) * CW, (r - pr) * LINE) : 1e9;
      if (d < 110) {
        const k = 1 - d / 110;
        bctx.globalAlpha = (0.25 + 0.6 * k) * quiet(c * CW, r * LINE);
        bctx.fillStyle = k > 0.55 ? green : muted;
        bctx.fillText(k > 0.55 ? '+' : '·', c * CW, r * LINE);
      } else {
        bctx.globalAlpha = 0.28 * quiet(c * CW, r * LINE); bctx.fillStyle = dim;
        bctx.fillText('·', c * CW, r * LINE);
      }
    }
  }

  // cursor trail
  for (let i = trail.length - 1; i >= 0; i--) {
    const p = trail[i], age = (now - p.t) / 900;
    if (age >= 1) { trail.splice(i, 1); continue; }
    bctx.globalAlpha = (1 - age) * 0.8 * quiet(p.c * CW, p.r * LINE); bctx.fillStyle = amber;
    bctx.fillText(age < 0.3 ? '=' : age < 0.6 ? '-' : '·', p.c * CW, p.r * LINE);
  }

  // click ripples
  for (let i = ripples.length - 1; i >= 0; i--) {
    const rp = ripples[i], age = (now - rp.t) / 700;
    if (age >= 1) { ripples.splice(i, 1); continue; }
    const rad = 10 + age * 90, n = 18;
    bctx.globalAlpha = (1 - age) * 0.8; bctx.fillStyle = amber;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2;
      const gx = rp.x + Math.cos(a) * rad - CW / 2, gy = rp.y + Math.sin(a) * rad * 0.8 - LINE / 2;
      bctx.globalAlpha = (1 - age) * 0.8 * quiet(gx, gy);
      bctx.fillText(age < 0.5 ? 'o' : '·', gx, gy);
    }
  }

  // waypoint
  if (waypoint) {
    const age = now - waypoint.t;
    if (age > 6000) waypoint = null;
    else {
      bctx.globalAlpha = age > 5000 ? 1 - (age - 5000) / 1000 : 1;
      bctx.fillStyle = amber;
      const wc = Math.floor(waypoint.x / CW) * CW, wr = Math.floor(waypoint.y / LINE) * LINE;
      bctx.fillText('+', wc, wr);
      bctx.globalAlpha *= 0.6;
      bctx.fillText('[', wc - CW, wr); bctx.fillText(']', wc + CW, wr);
    }
  }

  // robots: fading odometry path + heading arrow
  for (const b of bots) {
    for (const p of b.path) {
      const age = (now - p.t) / 2400;
      if (age >= 1) continue;
      bctx.globalAlpha = (1 - age) * 0.7 * quiet(p.c * CW, p.r * LINE); bctx.fillStyle = green;
      bctx.fillText(age < 0.25 ? '•' : '·', p.c * CW, p.r * LINE);
    }
    const ang = Math.atan2(-b.vy, b.vx);
    const idx = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
    const hx = Math.floor(b.x / CW) * CW, hy = Math.floor(b.y / LINE) * LINE;
    const q = quiet(hx, hy);
    bctx.globalAlpha = 0.35 * q; bctx.fillStyle = green;
    bctx.fillText('[', hx - CW, hy); bctx.fillText(']', hx + CW, hy);
    bctx.globalAlpha = Math.max(0.12, q); bctx.fillStyle = fg;
    bctx.font = `700 ${FONT_PX + 2}px ${MONO}`;
    bctx.fillText(ARROWS[idx], hx, hy - 1);
    bctx.font = `${FONT_PX}px ${MONO}`;
  }
  bctx.globalAlpha = 1;
}

// pointer input on the whole page
addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; pointer.lastMove = performance.now();
  const c = Math.floor(e.clientX / CW), r = Math.floor(e.clientY / LINE);
  const last = trail[trail.length - 1];
  if (!last || last.c !== c || last.r !== r) trail.push({ c, r, t: performance.now() });
  if (trail.length > 80) trail.shift();
}, { passive: true });
document.addEventListener('pointerleave', () => { pointer.active = false; });
addEventListener('blur', () => { pointer.active = false; });
document.addEventListener('click', e => {
  if (e.target.closest('a, button, canvas#field, input, .menu, .trophies, .chip, .term-box, .status')) return;
  if (getSelection && String(getSelection()).length) return;
  waypoint = { x: e.clientX, y: e.clientY, t: performance.now() };
  ripples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  award('waypoint');
});


let lastStat = 0;
const sEl = { bots: $('sBots'), mode: $('sMode'), near: $('sNear'), cur: $('sCur'), tro: $('sTro') };
function stat(now) {
  sEl.bots.textContent = `${bots.length}`;
  const wp = waypoint && now - waypoint.t < 6000;
  sEl.mode.textContent = wp ? `arrive → waypoint (${Math.ceil((6000 - (now - waypoint.t)) / 1000)}s)` : 'wander';
  if (pointer.active) {
    let d = Infinity; for (const b of bots) d = Math.min(d, Math.hypot(b.x - pointer.x, b.y - pointer.y));
    sEl.near.textContent = `${Math.round(d)} px from cursor${d < FLEE_R ? ' · fleeing' : ''}`;
    sEl.cur.textContent = `${Math.round(pointer.x)}, ${Math.round(pointer.y)}`;
  } else { sEl.near.textContent = '—'; sEl.cur.textContent = 'idle'; }
  sEl.tro.textContent = `${trophyCount()} / ${TROPHY_TOTAL}`;
}
sizeBg();
addEventListener('resize', sizeBg);
let lastBg = performance.now();
function bgFrame(now) {
  const dt = Math.min(0.05, (now - lastBg) / 1000); lastBg = now;
  if (pointer.active && now - pointer.lastMove > 4000) pointer.active = false;
  if (!reduce) update(dt, now);
  draw(now);
  if (now - lastStat > 200) { lastStat = now; stat(now); }
  requestAnimationFrame(bgFrame);
}
requestAnimationFrame(bgFrame);
