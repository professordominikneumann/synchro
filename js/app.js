window.startApp = function (G) {
const { createGearbox, PHASES, FLOW, PART, RATIO, I_K } = G;

const $ = (id) => document.getElementById(id);
const gb = createGearbox($('viewer'));
const sim = gb.sim;
window.gearbox = gb;
const fmt = (n) => Math.round(n).toLocaleString('de-DE');

// ---------- Bedienelemente ----------
function bindRange(id, fn, show) {
  const el = $(id), out = $('o-' + id);
  const upd = () => { fn(+el.value); if (out) out.textContent = show(+el.value); };
  el.addEventListener('input', upd); upd();
  return el;
}
bindRange('force', (v) => (sim.force = v), (v) => `${v} N`);
bindRange('nout', (v) => (sim.nOut = v), (v) => `${fmt(v)} 1/min`);
const engineEl = bindRange('engine', (v) => (sim.engine = v), (v) => `${fmt(v)} 1/min`);
bindRange('ts', (v) => (sim.timeScale = v), (v) => (v >= 0.99 ? 'Echtzeit' : `${Math.round(v * 100)} %`));
const cut = $('cut');
const updCut = () => gb.setCut(cut.checked, +$('cutz').value);
cut.addEventListener('change', updCut);
bindRange('cutz', updCut, (v) => v.toFixed(1));
bindRange('exp', (v) => gb.setExplode(v), (v) => `${Math.round(v * 100)} %`);
$('lbl').addEventListener('change', (e) => gb.setLabels(e.target.checked ? 'names' : 'off'));
$('sync').addEventListener('change', (e) => { sim.synchro = e.target.checked; });

document.querySelectorAll('#views button').forEach((b) => b.addEventListener('click', () => gb.setView(b.dataset.v)));
document.querySelectorAll('#gears button').forEach((b) => b.addEventListener('click', () => sim.shift(+b.dataset.g)));
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === '1' || e.key === '2') sim.shift(+e.key);
  if (e.key.toLowerCase() === 'n' || e.key === '0') sim.shift(0);
});

// URL-Parameter, z. B. ?gang=1&schnitt=1
const q = new URLSearchParams(location.search);
if (q.get('schnitt')) { cut.checked = true; updCut(); }
if (q.get('beschriftung')) { $('lbl').checked = true; gb.setLabels('names'); }
if (q.get('gang')) setTimeout(() => sim.shift(+q.get('gang')), 400);

// ---------- Phasenliste ----------
const MAIN = ['neutral', 'leerweg', 'vorsync', 'sperr', 'entsperr', 'einspuren', 'gang'];
const phaseEls = {};
for (const k of MAIN) {
  const p = PHASES.find((x) => x.key === k);
  const li = document.createElement('li');
  li.innerHTML = `<span class="phase-now">${p.name}</span><small>${p.desc}</small>`;
  $('phases').appendChild(li); phaseEls[k] = li;
}
let lastMsg = '';

// ---------- Diagramm ----------
const samples = [];
let tNow = 0;
function setupCanvas(c) {
  const dpr = Math.min(devicePixelRatio, 2), w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function drawPlot() {
  const { ctx, w, h } = setupCanvas($('plot'));
  ctx.clearRect(0, 0, w, h);
  const L = 46, R = 8, T = 8, B = 22, win = 12;
  const maxV = Math.max(3000, ...samples.map((s) => Math.max(s.sh, s.g1, s.g2, s.inp)));
  const yMax = Math.ceil(maxV / 1000) * 1000;
  const X = (t) => L + ((t - (tNow - win)) / win) * (w - L - R);
  const Y = (v) => T + (1 - v / yMax) * (h - T - B);
  ctx.font = '11px system-ui'; ctx.fillStyle = css('--muted'); ctx.strokeStyle = css('--line'); ctx.lineWidth = 1;
  for (let v = 0; v <= yMax; v += 1000) {
    ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(w - R, Y(v)); ctx.stroke();
    ctx.fillText(v.toLocaleString('de-DE'), 4, Y(v) + 4);
  }
  ctx.fillText('Zeit (letzte 12 s) →', L, h - 6);
  const line = (key, color, dash = []) => {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.setLineDash(dash);
    samples.forEach((s, i) => (i ? ctx.lineTo(X(s.t), Y(s[key])) : ctx.moveTo(X(s.t), Y(s[key]))));
    ctx.stroke(); ctx.setLineDash([]);
  };
  line('inp', '#ff7a1a', [5, 4]); line('g1', '#2f7de1'); line('g2', '#16a37a'); line('sh', '#6b7785');
  ctx.fillStyle = css('--muted'); ctx.fillText('1/min', 4, h - 6);
}

// ---------- Abwicklung ----------
function drawUnroll() {
  const { ctx, w, h } = setupCanvas($('unroll'));
  ctx.clearRect(0, 0, w, h);
  const side = sim.activeSide || 1;
  const a = Math.abs(sim.d);
  const u0 = -1.5, u1 = 3.7;
  const U = (u) => ((u - u0) / (u1 - u0)) * w;
  const P = 56, tw = 0.36 * P, ch = 0.16;
  const tooth = (ua, ub, center, color, chamA, chamB) => {
    for (let k = -2; k < h / P + 2; k++) {
      const yc = (((center % 1) + 1) % 1) * P + k * P;
      const y0 = yc - tw / 2, y1 = yc + tw / 2;
      ctx.beginPath();
      ctx.moveTo(U(ua + (chamA ? ch : 0)), y0); ctx.lineTo(U(ub - (chamB ? ch : 0)), y0);
      if (chamB) ctx.lineTo(U(ub), yc); ctx.lineTo(U(ub - (chamB ? ch : 0)), y1);
      ctx.lineTo(U(ua + (chamA ? ch : 0)), y1);
      if (chamA) ctx.lineTo(U(ua), yc);
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
    }
  };
  const p = gb.P_SYNC;
  tooth(-1.2, 1.2, 0.5, '#5d6973', false, false);
  tooth(2.8, 3.4, 0.5 + gb.relAngle(side) / p, '#2c5596', true, false);
  if (sim.synchro) {
    const shift = gb.ringShift(side);
    tooth(2.42 + shift, 2.7 + shift, 0.5 + gb.ringOffset(side) / p, '#d0a443', true, true);
  }
  ctx.globalAlpha = 0.92;
  const ua = Math.sign(sim.d) === (side === 1 ? -1 : 1) || sim.d === 0 ? a : -a;
  tooth(ua - 1.3, ua + 1.3, 0, '#c5cbd1', true, true);
  ctx.globalAlpha = 1;
  ctx.fillStyle = css('--ink'); ctx.font = '600 12px system-ui';
  ctx.fillText(`→ Richtung Losrad ${side}. Gang`, 8, 16);
  ctx.fillStyle = css('--muted'); ctx.font = '11px system-ui';
  ctx.fillText('↕ Umfangsrichtung', 8, h - 8);
}

// ---------- Laufende Anzeige ----------
gb.onUpdate((s, dtReal) => {
  tNow += dtReal;
  samples.push({ t: tNow, sh: s.nOut, g1: s.gearSpeed(1), g2: s.gearSpeed(2), inp: s.nIn });
  while (samples.length && samples[0].t < tNow - 12.5) samples.shift();
  drawPlot(); drawUnroll();

  // Gangtasten
  document.querySelectorAll('#gears button').forEach((b) => {
    const g = +b.dataset.g;
    b.classList.toggle('sel', !s.busy && (s.engaged === g) && !(g === 0 && s.d !== 0));
    b.classList.toggle('pending', s.busy && s.target === g);
  });
  engineEl.disabled = s.engaged !== 0;

  // Phasen
  const idx = MAIN.indexOf(s.phase);
  MAIN.forEach((k, i) => {
    phaseEls[k].classList.toggle('active', k === s.phase);
    phaseEls[k].classList.toggle('done', idx > 0 && i < idx && i > 0);
  });
  const msgEl = $('msg');
  const special = s.phase === 'ratschen' ? PHASES.find((p) => p.key === 'ratschen').desc : s.phase === 'auslegen' ? 'Gang herausnehmen: Kupplung getrennt, Schiebemuffe fährt in Mittelstellung …' : '';
  if (special || s.msg) { const m = special || s.msg; if (m !== lastMsg) { msgEl.textContent = m; lastMsg = m; } msgEl.hidden = false; msgEl.style.color = s.phase === 'auslegen' ? 'var(--muted)' : ''; }
  else { msgEl.hidden = true; lastMsg = ''; }

  // Werte
  const side = s.target || s.engaged || (s.d < 0 ? 1 : s.d > 0 ? 2 : 0);
  const dn = side ? s.gearSpeed(side) - s.nOut : null;
  const rows = [
    ['Antriebswelle (Motor)', `${fmt(s.nIn)} 1/min`],
    ['Vorgelegewelle', `${fmt(s.nIn / I_K)} 1/min`],
    ['Losrad 1. Gang', `${fmt(s.gearSpeed(1))} 1/min`],
    ['Losrad 2. Gang', `${fmt(s.gearSpeed(2))} 1/min`],
    ['Hauptwelle', `${fmt(s.nOut)} 1/min`],
  ];
  let html = rows.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
  if (dn !== null) html += `<span>Δn Losrad ${side} – Hauptwelle</span><b class="delta ${Math.abs(dn) < 5 ? 'zero' : ''}">${dn > 0 ? '+' : ''}${fmt(dn)} 1/min</b>`;
  html += `<span>Übersetzung i₁ / i₂</span><b>${RATIO[1].toFixed(2)} / ${RATIO[2].toFixed(2)}</b>`;
  $('values').innerHTML = html;

  // Badges
  $('badges').innerHTML = `<span>Gang: ${s.engaged ? s.engaged + '.' : 'N'}</span>`
    + `<span class="${s.clutch ? '' : 'clutch-off'}">Kupplung: ${s.clutch ? 'eingerückt' : 'getrennt'}</span>`
    + (s.blocked ? '<span class="blocked">🔒 Muffe gesperrt</span>' : '');

  // Kraftfluss
  const flowOn = $('flow').checked && s.engaged && s.clutch;
  gb.setFlow(flowOn ? s.engaged : 0);
  const chainKey = flowOn ? 'g' + s.engaged : 'none';
  const chain = $('chain');
  if (chain.dataset.k !== chainKey) {
    chain.dataset.k = chainKey;
    chain.innerHTML = flowOn
      ? `<b style="width:100%">Kraftfluss ${s.engaged}. Gang:</b>` + FLOW[s.engaged].map((id) => `<span class="n">${PART[id].name}</span>`).join('<span class="arr">→</span>')
      : '<span style="color:var(--muted)">Kraftfluss wird angezeigt, sobald ein Gang eingelegt und die Kupplung eingerückt ist.</span>';
  }
});

};
