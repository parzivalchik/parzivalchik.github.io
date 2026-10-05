import { $, reduce } from './util.js';
import { award } from './trophies.js';

/* ================= menu ================= */
const menuBtn = $('menuBtn'), menu = $('menu');
const setMenu = open => { menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.textContent = open ? 'Menu [−]' : 'Menu [+]'; };
menuBtn.addEventListener('click', () => setMenu(menu.hidden));
menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });

/* ================= copy email ================= */
const copyBtn = $('copyBtn'), emailEl = $('email');
copyBtn.addEventListener('click', () => {
  const ok = () => { copyBtn.textContent = '[copied]'; award('mail'); setTimeout(() => copyBtn.textContent = '[copy]', 1600); };
  const fallback = () => { const r = document.createRange(); r.selectNodeContents(emailEl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); copyBtn.textContent = '[selected · ⌘C]'; award('mail'); };
  try { navigator.clipboard.writeText(emailEl.textContent).then(ok, fallback); } catch (e) { fallback(); }
});

/* ================= wave decode =================
   Text stays real at rest. When triggered, each character turns into
   a short glyph cycle, delayed by its position, then resolves.        */
const CYCLE = ['#', '=', '-', '·', '-', '='];
const STEP = 40, PER_CHAR = 360, SPREAD = 520;
const running = new WeakSet();
function wave(el) {
  if (reduce || running.has(el)) return;
  const target = el.dataset.text || (el.dataset.text = el.textContent);
  const len = target.length;
  if (!len) return;
  running.add(el);
  const t0 = performance.now();
  function tick(now) {
    const t = now - t0;
    let out = '', done = true;
    for (let i = 0; i < len; i++) {
      const ch = target[i];
      if (ch === ' ' || ch === '\n') { out += ch; continue; }
      const local = t - (i / Math.max(1, len - 1)) * SPREAD;
      if (local >= PER_CHAR) out += ch;
      else { done = false; out += local < 0 ? ch : CYCLE[Math.floor(local / STEP) % CYCLE.length]; }
    }
    el.textContent = out;
    if (!done) requestAnimationFrame(tick);
    else { el.textContent = target; running.delete(el); }
  }
  requestAnimationFrame(tick);
}
const waveEls = [...document.querySelectorAll('[data-decode], .cmd')];
// each heading decodes the first time it scrolls into view
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { wave(e.target); io.unobserve(e.target); } }), { threshold: 0.8 });
  waveEls.forEach(el => io.observe(el));
}
// hover re-decodes headings
waveEls.forEach(el => el.addEventListener('pointerenter', () => wave(el)));
