import { $, css, MONO, reduce } from './util.js';
import { award } from './trophies.js';

/* ================= turret field-lock demo (same maths as the DECODE TeleOp) ================= */
const TARGET = { x: 72, y: 144 }, TICKS_PER_DEG = 1.62, LIMIT = 585, KP = 0.02;
const cv = $('field'), ctx = cv.getContext('2d');
const out = { pos: $('rPos'), head: $('rHead'), tur: $('rTur'), ticks: $('rTicks') };
const wrap = a => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };
let robot = { x: 40, y: 40, h: 0 }, turretDeg = 0, dragging = false, t = 0, lastUser = -1e9;
function resize() {
  const d = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth;
  cv.width = Math.round(w * d); cv.height = Math.round(w * d);
  ctx.setTransform(d, 0, 0, d, 0, 0);
}
const toPx = (x, y, s) => [x / 144 * s, (144 - y) / 144 * s];
function drawField() {
  const s = cv.clientWidth, fg = css('--fg'), dim = css('--dim'), rule = css('--rule'), green = css('--prompt'), amber = css('--amber'), bgc = css('--bg'), chip = css('--chip');
  ctx.fillStyle = bgc; ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = dim;
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) {
    const big = i % 4 === 0 && j % 4 === 0;
    ctx.fillRect(i * s / 24 - (big ? 1 : .5), j * s / 24 - (big ? 1 : .5), big ? 2 : 1, big ? 2 : 1);
  }
  ctx.strokeStyle = rule; ctx.lineWidth = 1; ctx.strokeRect(.5, .5, s - 1, s - 1);
  ctx.font = `11px ${MONO}`; ctx.fillStyle = dim; ctx.fillText('(0,0)', 6, s - 6);
  const [gx] = toPx(TARGET.x, TARGET.y, s);
  ctx.fillStyle = amber; ctx.fillText('[goal 72,144]', gx - 42, 14);
  const [rx, ry] = toPx(robot.x, robot.y, s), size = 18 / 144 * s;
  const fa = (robot.h + turretDeg) * Math.PI / 180;
  ctx.setLineDash([2, 4]); ctx.strokeStyle = amber; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(fa) * s * 1.5, ry - Math.sin(fa) * s * 1.5); ctx.stroke(); ctx.setLineDash([]);
  ctx.save(); ctx.translate(rx, ry); ctx.rotate(-robot.h * Math.PI / 180);
  ctx.fillStyle = chip; ctx.strokeStyle = fg; ctx.lineWidth = 1.5;
  ctx.fillRect(-size / 2, -size / 2, size, size); ctx.strokeRect(-size / 2, -size / 2, size, size);
  ctx.fillStyle = fg; ctx.fillRect(size / 2 - 4, -2, 4, 4);
  ctx.rotate(-turretDeg * Math.PI / 180);
  ctx.fillStyle = green; ctx.beginPath(); ctx.arc(0, 0, size * .24, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(0, -2, size * .6, 4);
  ctx.restore();
}
function step(dt) {
  if (!dragging && performance.now() - lastUser > 2500) {
    t += dt * (reduce ? 0 : 0.35);
    robot.x = 72 + 46 * Math.sin(t); robot.y = 58 + 34 * Math.sin(2 * t);
    robot.h = wrap(Math.atan2(68 * Math.cos(2 * t), 46 * Math.cos(t)) * 180 / Math.PI);
  }
  const target = wrap(Math.atan2(TARGET.y - robot.y, TARGET.x - robot.x) * 180 / Math.PI - robot.h);
  const err = wrap(target - turretDeg);
  turretDeg = wrap(turretDeg + Math.max(-1, Math.min(1, err * TICKS_PER_DEG * KP)) * 420 * dt);
  const ticks = Math.max(-LIMIT, Math.min(LIMIT, Math.round(target * TICKS_PER_DEG)));
  out.pos.textContent = `${robot.x.toFixed(1).padStart(5)}, ${robot.y.toFixed(1).padStart(5)}`;
  out.head.textContent = `${robot.h.toFixed(0).padStart(4)}°`;
  out.tur.textContent = `${target.toFixed(1).padStart(6)}°`;
  out.ticks.textContent = `${String(ticks).padStart(5)}`;
}
let last = performance.now();
function frame(now) { const dt = Math.min(.05, (now - last) / 1000); last = now; step(dt); drawField(); requestAnimationFrame(frame); }
function pointerField(e) {
  const r = cv.getBoundingClientRect();
  robot.x = Math.max(9, Math.min(135, (e.clientX - r.left) / r.width * 144));
  robot.y = Math.max(9, Math.min(135, 144 - (e.clientY - r.top) / r.height * 144));
}
cv.addEventListener('pointerdown', e => { dragging = true; cv.classList.add('drag'); cv.setPointerCapture(e.pointerId); pointerField(e); lastUser = performance.now(); award('drag'); });
cv.addEventListener('pointermove', e => { if (dragging) { pointerField(e); lastUser = performance.now(); } });
const end = () => { dragging = false; cv.classList.remove('drag'); lastUser = performance.now(); };
cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
cv.addEventListener('wheel', e => { e.preventDefault(); robot.h = wrap(robot.h + (e.deltaY > 0 ? 10 : -10)); lastUser = performance.now(); }, { passive: false });
addEventListener('resize', resize);
resize(); step(0); drawField(); requestAnimationFrame(frame);
