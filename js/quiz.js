import { createGearbox, PARTS, PART, FLOW, PHASES, I1, I2 } from './gearbox.js';

const $ = (id) => document.getElementById(id);
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const score = (el, ok, n) => { el.textContent = `${ok} / ${n} richtig`; el.style.color = ok === n ? 'var(--ok)' : 'var(--ink)'; };

// ---------- Aufgabe 1: Bauteile benennen ----------
const gb = createGearbox($('quizViewer'), { labels: 'numbers', hover: false });
gb.sim.nOut = 600; gb.sim.engine = 1100; gb.sim.timeScale = 0.15;
$('qcut').addEventListener('change', (e) => gb.setCut(e.target.checked, 0));
$('qexp').addEventListener('input', (e) => gb.setExplode(+e.target.value));

let numbering = {};
function newNames() {
  const order = shuffle(PARTS.map((p) => p.id));
  numbering = Object.fromEntries(order.map((id, i) => [id, i + 1]));
  gb.setLabels('numbers', numbering);
  const opts = ['<option value="">– bitte wählen –</option>', ...[...PARTS].sort((a, b) => a.name.localeCompare(b.name, 'de')).map((p) => `<option value="${p.id}">${p.name}</option>`)].join('');
  $('names').innerHTML = order.map((id, i) => `<label><span class="no">${i + 1}</span><select data-id="${id}">${opts}</select></label>`).join('');
  $('names').querySelectorAll('select').forEach((s) => {
    s.addEventListener('focus', () => gb.setHighlight(s.dataset.id));
    s.addEventListener('blur', () => gb.setHighlight(null));
    s.addEventListener('change', () => s.classList.remove('right', 'wrong'));
  });
  $('n-score').textContent = '';
}
$('n-check').onclick = () => {
  let ok = 0; const sels = $('names').querySelectorAll('select');
  sels.forEach((s) => { const r = s.value === s.dataset.id; ok += r; s.classList.toggle('right', r); s.classList.toggle('wrong', !r); });
  score($('n-score'), ok, sels.length);
};
$('n-solve').onclick = () => { $('names').querySelectorAll('select').forEach((s) => { s.value = s.dataset.id; s.classList.add('right'); s.classList.remove('wrong'); }); $('n-score').textContent = ''; };
$('n-new').onclick = newNames;
newNames();

// ---------- Reihenfolge-Aufgaben (Kraftfluss, Phasen) ----------
function sequenceTask({ bank, seq, scoreEl, items, labelOf }) {
  let pool = [], chosen = [];
  const render = (marks) => {
    bank.innerHTML = ''; seq.innerHTML = '';
    for (const id of pool) {
      const c = document.createElement('span'); c.className = 'chip'; c.textContent = labelOf(id);
      c.onclick = () => { pool = pool.filter((x) => x !== id); chosen.push(id); render(); }; bank.appendChild(c);
    }
    chosen.forEach((id, i) => {
      const c = document.createElement('span'); c.className = 'chip' + (marks ? (marks[i] ? ' right' : ' wrong') : ''); c.textContent = labelOf(id);
      c.onclick = () => { chosen = chosen.filter((x) => x !== id); pool.push(id); render(); }; seq.appendChild(c);
    });
    if (!marks) scoreEl.textContent = '';
  };
  return {
    reset(correct, distractors = []) { this.correct = correct; pool = shuffle([...correct, ...distractors]); chosen = []; render(); },
    check() {
      const marks = chosen.map((id, i) => id === this.correct[i]);
      render(marks);
      const ok = marks.filter(Boolean).length;
      const full = ok === this.correct.length && chosen.length === this.correct.length;
      scoreEl.textContent = full ? '✔ Alles richtig!' : `${ok} von ${this.correct.length} Positionen richtig` + (chosen.length > this.correct.length ? ' – es sind Bauteile zu viel gewählt' : '');
      scoreEl.style.color = full ? 'var(--ok)' : 'var(--ink)';
      return full;
    },
    solve() { pool = pool.concat(chosen).filter((x) => !this.correct.includes(x)); chosen = [...this.correct]; render(this.correct.map(() => true)); },
  };
}

// Kraftfluss: Bauteile pro Gang mit Gangbezug benennen
const kfLabel = (gear) => (id) => {
  if (['kupplungsverzahnung', 'reibkonus', 'synchronring'].includes(id.split(':')[0])) {
    const [base, g] = id.split(':'); return `${PART[base].name} (${g}. Gang)`;
  }
  return PART[id].name;
};
let kfGear = 1;
const kf = sequenceTask({ bank: $('kf-bank'), seq: $('kf-seq'), scoreEl: $('kf-score'), items: [], labelOf: (id) => kfLabel(kfGear)(id) });
function newKf(gear) {
  kfGear = gear;
  const other = gear === 1 ? 2 : 1;
  const correct = FLOW[gear].map((id) => (id === 'kupplungsverzahnung' ? `${id}:${gear}` : id));
  const distractors = [`synchronring:${gear}`, `reibkonus:${gear}`, 'druckstueck', 'schaltgabel', `losrad${other}`, `festrad${other}`, `kupplungsverzahnung:${other}`];
  $('kf-gear').textContent = `${gear}.`;
  $('kf-model').href = `index.html?gang=${gear}`;
  $('kf-expl').hidden = true;
  kf.reset(correct, distractors);
}
$('kf-check').onclick = () => {
  kf.check();
  $('kf-expl').hidden = false;
  $('kf-expl').innerHTML = '<b>Merke:</b> Synchronring, Reibkonus und Druckstücke werden nur <i>während</i> des Schaltens gebraucht. Nach dem Einspuren überträgt die Schiebemuffe das Moment formschlüssig von der Kupplungsverzahnung des Losrads über den Synchronkörper auf die Hauptwelle. Das andere Losrad dreht leer mit.';
};
$('kf-solve').onclick = () => kf.solve();
$('kf-new').onclick = () => newKf(kfGear === 1 ? 2 : 1);
newKf(Math.random() < 0.5 ? 1 : 2);

// Phasen
const PH = ['leerweg', 'vorsync', 'sperr', 'entsperr', 'einspuren', 'gang'];
const phName = (k) => PHASES.find((p) => p.key === k).name;
const ph = sequenceTask({ bank: $('ph-bank'), seq: $('ph-seq'), scoreEl: $('ph-score'), items: PH, labelOf: phName });
$('ph-check').onclick = () => {
  ph.check();
  $('ph-expl').hidden = false;
  $('ph-expl').innerHTML = PH.map((k) => `<li><b>${phName(k)}:</b> ${PHASES.find((p) => p.key === k).desc}</li>`).join('');
};
$('ph-solve').onclick = () => ph.solve();
$('ph-new').onclick = () => { $('ph-expl').hidden = true; ph.reset(PH); };
ph.reset(PH);

// ---------- Aufgabe 4: Verständnisfragen ----------
const MC = [
  { q: 'Welche Aufgabe hat die Synchronisierung?', a: ['Die Drehzahlen von Losrad und Hauptwelle vor dem Formschluss angleichen', 'Das Drehmoment des Motors erhöhen', 'Die Übersetzung stufenlos verändern', 'Die Kupplung beim Anfahren ersetzen'], e: 'Erst bei Gleichlauf kann die Schiebemuffe geräuschlos und verschleißfrei einspuren.' },
  { q: 'Welches Bauteil liegt bei eingelegtem Gang NICHT im Kraftfluss?', a: ['Synchronring', 'Schiebemuffe', 'Synchronkörper', 'Losrad des eingelegten Gangs'], e: 'Der Synchronring wirkt nur während des Schaltens (Reibschluss). Danach überträgt die Muffe formschlüssig.' },
  { q: 'Wodurch wird die Schiebemuffe während der Synchronisierung gesperrt?', a: ['Der Synchronring ist durch das Reibmoment verdreht – seine Dachschrägen stehen vor den Muffenzähnen', 'Die Druckstücke rasten in der Muffennut ein', 'Die Schaltgabel wird hydraulisch blockiert', 'Die Kupplungsverzahnung ist noch nicht gefettet'], e: 'Solange Δn ≠ 0 ist, hält das Reibmoment den Ring in Sperrstellung.' },
  { q: 'Was bewirkt eine größere Schaltkraft am Schalthebel?', a: ['Die Synchronisierzeit wird kürzer', 'Die Sperre wird bei Drehzahldifferenz überwunden', 'Die Enddrehzahl des Losrads wird höher', 'Sie hat keinen Einfluss'], e: 'Mehr Axialkraft → mehr Normalkraft am Konus → größeres Reibmoment → schnellerer Gleichlauf. Die Sperre bleibt trotzdem wirksam.' },
  { q: 'Beim Hochschalten vom 1. in den 2. Gang muss das Losrad des 2. Gangs …', a: ['abgebremst werden', 'beschleunigt werden', 'nicht angeglichen werden', 'mit der Vorgelegewelle entkoppelt werden'], e: 'Im 1. Gang dreht die Eingangsseite schneller (größere Übersetzung). Das Losrad des 2. Gangs ist daher schneller als die Hauptwelle und wird gebremst.' },
  { q: 'Beim Zurückschalten vom 2. in den 1. Gang muss das Losrad des 1. Gangs …', a: ['beschleunigt werden', 'abgebremst werden', 'stillgesetzt werden', 'nicht angeglichen werden'], e: 'Im 2. Gang dreht das Losrad 1 langsamer als die Hauptwelle (Δn negativ) und muss beschleunigt werden.' },
  { q: 'Wie ist der Synchronkörper mit der Hauptwelle verbunden?', a: ['Formschlüssig über ein Keilwellenprofil', 'Drehbar über ein Nadellager', 'Über eine Reibkupplung', 'Gar nicht – er sitzt auf der Vorgelegewelle'], e: 'Der Synchronkörper dreht immer mit der Hauptwelle.' },
  { q: 'Wie sind die Losräder gelagert?', a: ['Frei drehbar (z. B. nadelgelagert) auf der Hauptwelle', 'Fest auf der Hauptwelle verzahnt', 'Fest auf der Vorgelegewelle', 'Im Getriebegehäuse'], e: 'Losräder kämmen ständig mit den Festrädern, drehen aber frei auf der Hauptwelle, bis sie geschaltet werden.' },
  { q: 'Warum muss beim Schalten die Kupplung getrennt sein?', a: ['Damit nur die kleine Masse der Getriebeeingangsseite synchronisiert werden muss, nicht der ganze Motor', 'Damit der Synchronring abkühlt', 'Damit die Vorgelegewelle stillsteht', 'Damit die Hauptwelle die Drehrichtung wechselt'], e: 'Die Synchronisierung kann nur kleine Trägheitsmomente (Kupplungsscheibe, Wellen, Räder) angleichen.' },
  { q: 'Welche Aufgabe haben die Druckstücke?', a: ['Den Synchronring beim Vorsynchronisieren gegen den Reibkonus drücken und die Muffe in Neutral halten', 'Das Drehmoment auf die Hauptwelle übertragen', 'Die Losräder axial sichern', 'Das Getriebeöl verteilen'], e: 'Sie leiten die erste Axialkraft auf den Ring, damit sich das Reibmoment aufbaut und der Ring in Sperrstellung dreht.' },
  { q: 'Warum ist die Reibfläche als Kegel ausgeführt?', a: ['Die Keilwirkung erhöht die Anpresskraft – großes Reibmoment bei kleiner Schaltkraft', 'Damit der Ring leichter zu fertigen ist', 'Damit kein Öl an die Reibfläche kommt', 'Damit das Losrad axial geführt wird'], e: 'Je kleiner der Kegelwinkel, desto größer die Normalkraft F_N = F_ax / sin α.' },
  { q: 'Was passiert, wenn man ohne Synchronisierung mit Drehzahldifferenz schaltet?', a: ['Die Zähne von Muffe und Kupplungsverzahnung „ratschen“ – der Gang lässt sich nicht einlegen', 'Der Gang springt sofort rein', 'Der Motor geht automatisch aus', 'Die Übersetzung passt sich an'], e: 'Früher half nur Zwischengas bzw. Doppelkuppeln, um die Drehzahl von Hand anzugleichen.' },
];
function newMc() {
  const qs = shuffle(MC).slice(0, 8);
  $('mc').innerHTML = qs.map((m, i) => {
    const opts = shuffle(m.a.map((t, j) => ({ t, ok: j === 0 })));
    return `<div class="mc"><p>${i + 1}. ${m.q}</p>${opts.map((o) => `<label data-ok="${o.ok}"><input type="radio" name="mc${i}"> ${o.t}</label>`).join('')}<div class="expl">${m.e}</div></div>`;
  }).join('');
  $('mc-score').textContent = '';
}
$('mc-check').onclick = () => {
  let ok = 0; const blocks = $('mc').querySelectorAll('.mc');
  blocks.forEach((b) => {
    b.classList.add('checked');
    b.querySelectorAll('label').forEach((l) => {
      const sel = l.querySelector('input').checked, right = l.dataset.ok === 'true';
      l.classList.toggle('right', right); l.classList.toggle('wrong', sel && !right);
      if (sel && right) ok++;
    });
  });
  score($('mc-score'), ok, blocks.length);
};
$('mc-new').onclick = newMc;
newMc();

// ---------- Aufgabe 5: Drehzahlen ----------
let calc = [];
function newCalc() {
  const nOut = 800 + 50 * Math.floor(Math.random() * 35);
  $('c-nout').textContent = `n = ${nOut.toLocaleString('de-DE')} 1/min`;
  const nMot2 = nOut * I2, nLos1 = nMot2 / I1;
  calc = [
    { q: 'Gesamtübersetzung im 1. Gang i₁', v: I1, unit: '', dec: 2 },
    { q: 'Gesamtübersetzung im 2. Gang i₂', v: I2, unit: '', dec: 2 },
    { q: 'Motordrehzahl im 2. Gang', v: nMot2, unit: '1/min' },
    { q: 'Drehzahl des Losrads 1. Gang (vor dem Schalten, Kupplung noch eingerückt)', v: nLos1, unit: '1/min' },
    { q: 'Drehzahldifferenz Hauptwelle – Losrad 1, die die Synchronisierung ausgleichen muss', v: nOut - nLos1, unit: '1/min' },
    { q: 'Motordrehzahl nach dem Rückschalten (1. Gang, gleiche Geschwindigkeit)', v: nOut * I1, unit: '1/min' },
  ];
  $('calc').innerHTML = calc.map((c, i) => `<label><span>${String.fromCharCode(97 + i)}) ${c.q}</span><input type="number" step="any" data-i="${i}"><span>${c.unit}</span></label>`).join('');
  $('c-score').textContent = '';
}
$('c-check').onclick = () => {
  let ok = 0;
  $('calc').querySelectorAll('input').forEach((inp) => {
    const c = calc[+inp.dataset.i], x = parseFloat(String(inp.value).replace(',', '.'));
    const right = Number.isFinite(x) && Math.abs(x - c.v) <= Math.max(0.01 * Math.abs(c.v), c.dec ? 0.011 : 2);
    ok += right; inp.classList.toggle('right', right); inp.classList.toggle('wrong', !right);
  });
  score($('c-score'), ok, calc.length);
};
$('c-solve').onclick = () => {
  $('calc').querySelectorAll('input').forEach((inp) => { const c = calc[+inp.dataset.i]; inp.value = c.dec ? c.v.toFixed(c.dec) : Math.round(c.v); inp.classList.add('right'); inp.classList.remove('wrong'); });
  $('c-score').innerHTML = 'Lösungsweg: i = (z<sub>Konstantrad</sub>/z<sub>Antriebsrad</sub>)·(z<sub>Losrad</sub>/z<sub>Festrad</sub>); n<sub>Motor</sub> = n<sub>Hauptwelle</sub>·i; n<sub>Losrad 1</sub> = n<sub>Motor</sub>/i₁';
  $('c-score').style.color = 'var(--muted)';
};
$('c-new').onclick = newCalc;
newCalc();
