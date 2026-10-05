import { $ } from './util.js';

/* ================= trophies ================= */
const TROPHIES = [
  ['boot', 'BOOT', 'open the terminal'],
  ['scatter', 'SCATTER', 'make a robot flee from your cursor'],
  ['waypoint', 'WAYPOINT', 'drop a waypoint on the field'],
  ['drag', 'PILOT', 'drive the turret robot yourself'],
  ['lib', 'READER', 'open Platapus Pathing'],
  ['code', 'REVIEWER', 'open the DECODE code'],
  ['mail', 'OPERATOR', 'copy the email'],
];
let got = {};
try { got = JSON.parse(localStorage.getItem('ab-trophies-v2') || '{}') || {}; } catch (e) { got = {}; }
const list = $('trophyList'), tBtn = $('trophyBtn'), toast = $('toast'), toastText = $('toastText');
let toastTimer;
function label() {
  const n = TROPHIES.filter(x => got[x[0]]).length;
  tBtn.textContent = `Trophies [${n}/${TROPHIES.length}] ${list.hidden ? '[+]' : '[−]'}`;
}
function render() {
  list.innerHTML = '';
  for (const [id, name, desc] of TROPHIES) {
    const has = !!got[id], d = document.createElement('div');
    d.className = has ? 'got' : '';
    const a = document.createElement('span'); a.textContent = has ? '★' : '·';
    const b = document.createElement('span'); b.textContent = `${has ? name : '???'}  ${desc}`;
    d.append(a, b); list.appendChild(d);
  }
  label();
}
export function award(id) {
  if (got[id]) return;
  got[id] = 1;
  try { localStorage.setItem('ab-trophies-v2', JSON.stringify(got)); } catch (e) {}
  const t = TROPHIES.find(x => x[0] === id);
  toastText.textContent = `${t[1]}  ${t[2]}`;
  toast.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.hidden = true, 3200);
  render();
}
tBtn.addEventListener('click', () => { list.hidden = !list.hidden; tBtn.setAttribute('aria-expanded', String(!list.hidden)); label(); });
render();
setTimeout(() => award('boot'), 900);
document.querySelectorAll('[data-trophy]').forEach(a => a.addEventListener('click', () => award(a.dataset.trophy)));

export const trophyCount = () => TROPHIES.filter(x => got[x[0]]).length;
export const TROPHY_TOTAL = TROPHIES.length;
