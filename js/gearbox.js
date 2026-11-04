// Klassisches Skript (funktioniert auch per file://). three.js wird von der Seite übergeben.
window.Gearbox = function (THREE, OrbitControls, RoomEnvironment) {
// Interaktives 3D-Modell: Sperrsynchronisierung (Bauart Borg-Warner) in einem 2-Gang-Wechselgetriebe

// ---------- Getriebedaten ----------
const Z = { an: 16, k: 24, g1: 26, c1: 14, g2: 20, c2: 20 };
const MOD = 0.4;
const rp = (z) => (MOD * z) / 2;
const I_K = Z.k / Z.an;
const I1 = (I_K * Z.g1) / Z.c1;
const I2 = (I_K * Z.g2) / Z.c2;
const RATIO = { 1: I1, 2: I2 };

const PARTS = [
  { id: 'antriebswelle', name: 'Antriebswelle', desc: 'Getriebeeingangswelle – wird über die Kupplung vom Motor angetrieben.' },
  { id: 'antriebsrad', name: 'Antriebsrad (Konstante)', desc: 'Festrad auf der Antriebswelle; bildet mit dem Konstantrad die Antriebskonstante.' },
  { id: 'konstantrad', name: 'Konstantrad (Vorgelegewelle)', desc: 'Festrad auf der Vorgelegewelle; wird von der Antriebswelle ständig angetrieben.' },
  { id: 'vorgelegewelle', name: 'Vorgelegewelle', desc: 'Trägt die Festräder; dreht immer mit, sobald die Antriebswelle dreht.' },
  { id: 'festrad1', name: 'Festrad 1. Gang', desc: 'Fest mit der Vorgelegewelle verbunden; kämmt ständig mit dem Losrad des 1. Gangs.' },
  { id: 'festrad2', name: 'Festrad 2. Gang', desc: 'Fest mit der Vorgelegewelle verbunden; kämmt ständig mit dem Losrad des 2. Gangs.' },
  { id: 'losrad1', name: 'Losrad 1. Gang', desc: 'Dreht frei (nadelgelagert) auf der Hauptwelle, bis es über die Schiebemuffe formschlüssig mit ihr verbunden wird.' },
  { id: 'losrad2', name: 'Losrad 2. Gang', desc: 'Dreht frei (nadelgelagert) auf der Hauptwelle, bis es über die Schiebemuffe formschlüssig mit ihr verbunden wird.' },
  { id: 'kupplungsverzahnung', name: 'Kupplungsverzahnung', desc: 'Schaltverzahnung am Losrad – hier greift die Schiebemuffe beim Einspuren formschlüssig ein.' },
  { id: 'reibkonus', name: 'Reibkonus', desc: 'Kegelfläche am Losrad; Reibpartner des Synchronrings (Kegelreibkupplung).' },
  { id: 'synchronring', name: 'Synchronring', desc: 'Gleicht durch Reibung am Konus die Drehzahlen an und sperrt die Schiebemuffe, solange eine Drehzahldifferenz besteht.' },
  { id: 'synchronkoerper', name: 'Synchronkörper', desc: 'Führungsmuffe – über Keilwellenprofil fest mit der Hauptwelle verbunden; trägt und führt die Schiebemuffe.' },
  { id: 'schiebemuffe', name: 'Schiebemuffe', desc: 'Axial verschiebbar auf dem Synchronkörper; stellt die formschlüssige Verbindung zur Kupplungsverzahnung her.' },
  { id: 'druckstueck', name: 'Druckstück', desc: 'Federbelastetes Rastelement; schiebt den Synchronring beim Vorsynchronisieren gegen den Reibkonus.' },
  { id: 'schaltgabel', name: 'Schaltgabel', desc: 'Greift in die Nut der Schiebemuffe und verschiebt sie axial (über die Schaltstange).' },
  { id: 'hauptwelle', name: 'Hauptwelle (Abtriebswelle)', desc: 'Leitet das Drehmoment zum Achsantrieb weiter; Drehzahl ist an die Fahrgeschwindigkeit gekoppelt.' },
];
const PART = Object.fromEntries(PARTS.map((p) => [p.id, p]));

const FLOW = {
  1: ['antriebswelle', 'antriebsrad', 'konstantrad', 'vorgelegewelle', 'festrad1', 'losrad1', 'kupplungsverzahnung', 'schiebemuffe', 'synchronkoerper', 'hauptwelle'],
  2: ['antriebswelle', 'antriebsrad', 'konstantrad', 'vorgelegewelle', 'festrad2', 'losrad2', 'kupplungsverzahnung', 'schiebemuffe', 'synchronkoerper', 'hauptwelle'],
};

const PHASES = [
  { key: 'neutral', name: 'Neutral', desc: 'Schiebemuffe in Mittelstellung, beide Losräder drehen frei.' },
  { key: 'leerweg', name: 'Leerweg', desc: 'Kupplung getrennt, Schiebemuffe bewegt sich mit den Druckstücken Richtung Gangrad.' },
  { key: 'vorsync', name: 'Vorsynchronisieren', desc: 'Druckstücke drücken den Synchronring auf den Reibkonus. Das Reibmoment verdreht den Ring in Sperrstellung.' },
  { key: 'sperr', name: 'Sperren & Synchronisieren', desc: 'Muffenzähne liegen an den Dachschrägen des Rings an. Die Schaltkraft erzeugt Reibmoment – die Drehzahl des Losrads wird an die Hauptwelle angeglichen. Solange Δn ≠ 0 bleibt die Muffe gesperrt.' },
  { key: 'entsperr', name: 'Entsperren / Durchschalten', desc: 'Δn = 0 → kein Reibmoment mehr. Der Ring lässt sich zurückdrehen, die Muffe schiebt sich durch die Ringverzahnung.' },
  { key: 'einspuren', name: 'Einspuren', desc: 'Die Muffe spurt in die Kupplungsverzahnung des Losrads ein (Formschluss).' },
  { key: 'gang', name: 'Gang eingelegt', desc: 'Losrad formschlüssig mit der Hauptwelle verbunden. Kupplung wird eingerückt – Kraftfluss geschlossen.' },
  { key: 'auslegen', name: 'Gang herausnehmen', desc: 'Kupplung getrennt, Schiebemuffe fährt zurück in Mittelstellung.' },
  { key: 'ratschen', name: 'Zähne ratschen!', desc: 'Ohne Synchronring treffen Muffe und Kupplungsverzahnung mit Drehzahldifferenz aufeinander – der Gang lässt sich nicht einlegen.' },
];

// Muffenweg-Marken (Betrag der Muffenposition)
const A_PRE = 0.92, A_BLOCK = 1.18, A_THRU = 1.46, A_FULL = 2.0;
const RING_SHIFT = 0.06; // axialer Weg des Synchronrings bis zur Anlage am Konus
const V_SLEEVE = 3.0; // Einheiten/s
const SYNC_K = 12; // 1/min pro s und N Schaltkraft
const F_PRE = 15; // Ersatzkraft der Druckstücke
const DRAG = 60; // Schleppverlust 1/min pro s
const EPS = 4, CLASH = 80;
const P_SYNC = (2 * Math.PI) / 30;

// ---------- Simulation ----------
class Sim {
  constructor() {
    Object.assign(this, {
      nOut: 1500, engine: 2200, nIn: 2200, force: 80, timeScale: 0.25, synchro: true,
      target: 0, engaged: 0, d: 0, state: 'idle', timer: 0, clutch: true, phase: 'neutral',
      blocked: false, msg: '', deltaSign: 1, listeners: [],
    });
  }
  gearSpeed(g) { return this.nIn / RATIO[g]; }
  get activeSide() { return this.target || (this.d < 0 ? 1 : this.d > 0 ? 2 : this.engaged); }
  get busy() { return this.state !== 'idle'; }
  shift(g) {
    if (this.state === 'idle' && ((g === 0 && this.engaged === 0 && this.d === 0) || (g !== 0 && this.engaged === g))) return;
    this.target = g; this.state = 'declutch'; this.timer = 0; this.msg = '';
  }
  step(dt) {
    if (dt <= 0) return;
    const freeDrag = () => { this.nIn = Math.max(0, this.nIn - DRAG * dt); };
    switch (this.state) {
      case 'idle':
        if (this.engaged === 0 && this.clutch) this.nIn += (this.engine - this.nIn) * Math.min(1, dt * 4);
        break;
      case 'declutch':
        this.timer += dt;
        if (this.timer > 0.2) {
          this.clutch = false;
          const wrongSide = this.d !== 0 && (this.target === 0 || Math.sign(this.d) !== (this.target === 1 ? -1 : 1));
          this.state = (this.engaged && this.engaged !== this.target) || wrongSide || this.target === 0 ? 'toNeutral' : 'engaging';
        }
        break;
      case 'toNeutral': {
        this.engaged = 0; this.phase = 'auslegen'; freeDrag();
        const a = Math.max(0, Math.abs(this.d) - V_SLEEVE * dt);
        this.d = Math.sign(this.d) * a;
        if (a === 0) { this.d = 0; this.state = this.target ? 'engaging' : 'clutchIn'; this.timer = 0; if (!this.target) this.phase = 'neutral'; }
        break;
      }
      case 'engaging': this.stepEngage(dt); break;
      case 'clash': {
        this.timer += dt; this.phase = 'ratschen'; freeDrag();
        const side = this.target === 1 ? -1 : 1;
        this.d = side * (A_THRU + 0.02 + 0.03 * Math.sin(this.timer * 90));
        if (this.timer > 1.0) {
          const dn = Math.abs(this.nIn / RATIO[this.target] - this.nOut);
          this.msg = `Gang lässt sich nicht einlegen – Zähne ratschen (Δn ≈ ${dn.toFixed(0)} 1/min). Ohne Synchronring muss die Drehzahl von Hand angeglichen werden (Zwischengas / Doppelkuppeln).`;
          this.target = 0; this.state = 'toNeutral';
        }
        break;
      }
      case 'clutchIn':
        this.timer += dt;
        if (this.timer > 0.2) { this.clutch = true; this.state = 'idle'; this.phase = this.engaged ? 'gang' : 'neutral'; }
        break;
    }
    if (this.engaged) this.nIn = this.nOut * RATIO[this.engaged];
  }
  stepEngage(dt) {
    const side = this.target === 1 ? -1 : 1, iT = RATIO[this.target];
    let a = Math.abs(this.d);
    let delta = this.nIn / iT - this.nOut;
    const fric = (rate) => {
      const dd = Math.min(Math.abs(delta), rate * dt);
      delta -= Math.sign(delta) * dd;
    };
    this.nIn = Math.max(0, this.nIn - DRAG * dt); delta = this.nIn / iT - this.nOut;
    this.blocked = false;
    if (a < A_PRE) {
      a = Math.min(A_PRE, a + V_SLEEVE * dt); this.phase = 'leerweg';
      if (Math.abs(delta) > 0) this.deltaSign = Math.sign(delta);
    } else if (a < A_BLOCK) {
      if (this.synchro) { fric(F_PRE * SYNC_K); this.phase = 'vorsync'; } else this.phase = 'leerweg';
      a = Math.min(A_BLOCK, a + V_SLEEVE * dt * (this.synchro ? 0.5 : 1));
    } else if (a < A_THRU) {
      if (this.synchro && Math.abs(delta) > EPS && a <= A_BLOCK + 1e-6) {
        a = A_BLOCK; fric(this.force * SYNC_K); this.blocked = true; this.phase = 'sperr';
        if (Math.abs(delta) <= EPS) delta = 0;
      } else {
        if (this.synchro) delta = 0;
        a = Math.min(A_THRU, a + V_SLEEVE * dt);
        this.phase = this.synchro ? 'entsperr' : 'leerweg';
      }
    } else if (a < A_FULL) {
      if (!this.synchro && Math.abs(delta) > CLASH) { this.state = 'clash'; this.timer = 0; }
      else { delta = 0; a = Math.min(A_FULL, a + V_SLEEVE * dt); this.phase = 'einspuren'; }
    } else {
      a = A_FULL; this.engaged = this.target; this.phase = 'gang'; this.state = 'clutchIn'; this.timer = 0;
    }
    this.nIn = Math.max(0, (this.nOut + delta) * iT);
    this.d = side * a;
  }
}

// ---------- Geometrie-Helfer ----------
function toothPts(rRoot, rTip, z, phase = 0, skip = null) {
  const pts = [], p = (2 * Math.PI) / z;
  const P = (r, a) => new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
  for (let i = 0; i < z; i++) {
    const a = phase + i * p;
    if (skip && skip(i)) { pts.push(P(rRoot, a), P(rRoot, a + 0.5 * p)); continue; }
    pts.push(P(rRoot, a), P(rRoot, a + 0.25 * p), P(rTip, a + 0.4 * p), P(rTip, a + 0.6 * p), P(rRoot, a + 0.75 * p));
  }
  return pts;
}
// Evolventen-Stirnverzahnung (Eingriffswinkel 20°, Kopfhöhe m, Fußhöhe 1,25 m, etwas Flankenspiel)
const inv = (a) => Math.tan(a) - a;
function involutePts(z, m, phase = 0) {
  const rp = (m * z) / 2, alpha = (20 * Math.PI) / 180, rb = rp * Math.cos(alpha);
  const ra = rp + m, rf = rp - 1.25 * m, p = (2 * Math.PI) / z;
  const half = (Math.PI / (2 * z)) * 0.94 + inv(alpha);
  const psi = (r) => half - inv(Math.acos(Math.min(1, rb / Math.max(r, rb))));
  const P = (r, a) => new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
  const radii = [];
  if (rf < rb) radii.push(rf);
  const r0 = Math.max(rf, rb), N = 10;
  for (let k = 0; k <= N; k++) radii.push(r0 + ((ra - r0) * k) / N);
  const pts = [];
  for (let i = 0; i < z; i++) {
    const c = phase + (i + 0.5) * p;
    pts.push(P(rf, c - p / 2));
    for (const r of radii) pts.push(P(r, c - psi(r)));
    for (const r of [...radii].reverse()) pts.push(P(r, c + psi(r)));
  }
  return pts;
}
function spurGeo({ z, bore, width, x = 0, phase = 0 }) {
  const s = new THREE.Shape(involutePts(z, MOD, phase)); s.holes.push(circlePath(bore));
  return extrudeAxial(s, width, x);
}
function circlePath(r) { const p = new THREE.Path(); p.absarc(0, 0, r, 0, Math.PI * 2, false); return p; }
function extrudeAxial(shape, width, x = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 64 });
  g.translate(0, 0, -width / 2); g.rotateY(Math.PI / 2); g.translate(x, 0, 0);
  return g;
}
function gearGeo({ z, rRoot, rTip, bore, width, x = 0, phase = 0, skip }) {
  const s = new THREE.Shape(toothPts(rRoot, rTip, z, phase, skip)); s.holes.push(circlePath(bore));
  return extrudeAxial(s, width, x);
}
function internalGeo({ z, rRoot, rTip, outer, width, x = 0, phase = 0 }) {
  const s = new THREE.Shape(); s.absarc(0, 0, outer, 0, Math.PI * 2, false);
  s.holes.push(new THREE.Path(toothPts(rRoot, rTip, z, phase)));
  return extrudeAxial(s, width, x);
}
// profile: [[r, x], ...] geschlossenes Profil, rotiert um die x-Achse
function latheGeo(profile, segs = 96, phiStart = 0, phiLen = Math.PI * 2) {
  let pts = profile.map(([r, x]) => new THREE.Vector2(r, x));
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a.x * b.y - b.x * a.y; }
  if (area < 0) pts.reverse();
  pts.push(pts[0].clone());
  let g = new THREE.LatheGeometry(pts, segs, phiStart, phiLen);
  g.rotateZ(-Math.PI / 2);
  g = g.toNonIndexed(); g.computeVertexNormals();
  return g;
}
function shaftGeo(r, x0, x1, segs = 48) {
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, segs); g.rotateZ(Math.PI / 2); g.translate((x0 + x1) / 2, 0, 0);
  return g;
}

const COLORS = {
  antriebswelle: 0xa3abb3, hauptwelle: 0xa3abb3, vorgelegewelle: 0x8f979f,
  antriebsrad: 0x7b8fa8, konstantrad: 0x7b8fa8, festrad1: 0x7b8fa8, festrad2: 0x7b8fa8,
  losrad1: 0x4f7cc4, losrad2: 0x4f7cc4, kupplungsverzahnung: 0x2c5596, reibkonus: 0x9db7dc,
  synchronring: 0xd0a443, synchronkoerper: 0x5d6973, schiebemuffe: 0xc5cbd1, druckstueck: 0xd2553a, schaltgabel: 0x3e9b6b,
};

// ---------- Szene ----------
function createGearbox(container, opts = {}) {
  const sim = new Sim();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.localClippingEnabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);
  camera.position.set(10, 9, 30);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-1.5, -3.2, 0);
  controls.enableDamping = true;
  controls.update();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.7));
  const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(10, 20, 15); scene.add(dl);

  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1000);
  const clip = [cutPlane];
  const meshes = [];

  function addMesh(parent, geo, partId, side) {
    const color = new THREE.Color(COLORS[partId]);
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.38, clippingPlanes: clip, envMapIntensity: 0.9 });
    const m = new THREE.Mesh(geo, mat);
    m.userData = { part: partId, side };
    // Schnittfläche: Rückseiten flach eingefärbt und schraffiert (wie in einer technischen Zeichnung)
    const capMat = new THREE.MeshBasicMaterial({ color: color.clone().lerp(new THREE.Color(0xffffff), 0.1), side: THREE.BackSide, clippingPlanes: clip });
    capMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\n float hz = mod(gl_FragCoord.x + gl_FragCoord.y, 9.0);\n if (hz < 1.6) gl_FragColor.rgb *= 0.72;');
    };
    const cap = new THREE.Mesh(geo, capMat); cap.raycast = () => {};
    m.add(cap);
    parent.add(m); meshes.push(m);
    return m;
  }
  const carrier = (x = 0, y = 0) => { const c = new THREE.Group(); c.position.set(x, y, 0); const r = new THREE.Group(); c.add(r); scene.add(c); return { c, r, base: new THREE.Vector3(x, y, 0) }; };

  // Antriebswelle + Antriebsrad
  const inp = carrier();
  addMesh(inp.r, shaftGeo(1.0, -13, -6.7), 'antriebswelle');
  addMesh(inp.r, new THREE.BoxGeometry(2.5, 0.12, 0.3).translate(-11.5, 1.0, 0), 'antriebswelle');
  const pIn = (2 * Math.PI) / Z.an;
  addMesh(inp.r, spurGeo({ z: Z.an, bore: 0.99, width: 1.2, x: -7.4, phase: -Math.PI / 2 - 0.5 * pIn }), 'antriebsrad');

  // Vorgelegewelle
  const cs = carrier(0, -8);
  addMesh(cs.r, shaftGeo(0.9, -9, 6), 'vorgelegewelle');
  addMesh(cs.r, spurGeo({ z: Z.k, bore: 0.89, width: 1.2, x: -7.4, phase: Math.PI / 2 }), 'konstantrad');
  addMesh(cs.r, spurGeo({ z: Z.c1, bore: 0.89, width: 1.6, x: -4.2, phase: Math.PI / 2 }), 'festrad1');
  addMesh(cs.r, spurGeo({ z: Z.c2, bore: 0.89, width: 1.6, x: 4.2, phase: Math.PI / 2 }), 'festrad2');

  // Hauptwelle
  const sh = carrier();
  addMesh(sh.r, shaftGeo(1.0, -6.6, 10), 'hauptwelle');
  addMesh(sh.r, latheGeo([[0.9, 9.4], [2.4, 9.4], [2.4, 10.0], [0.9, 10.0]]), 'hauptwelle');
  addMesh(sh.r, new THREE.BoxGeometry(2.4, 0.12, 0.3).translate(7.6, 1.0, 0), 'hauptwelle');

  // Losräder mit Kupplungsverzahnung und Reibkonus
  function losrad(side) {
    const s = side === 1 ? -1 : 1, z = side === 1 ? Z.g1 : Z.g2, p = (2 * Math.PI) / z;
    const g = carrier();
    addMesh(g.r, spurGeo({ z, bore: 1.05, width: 1.6, x: s * 4.2, phase: -Math.PI / 2 - 0.5 * p }), 'losrad' + side, side);
    addMesh(g.r, gearGeo({ z: 30, rRoot: 2.85, rTip: 3.2, bore: 1.05, width: 0.6, x: s * 3.1 }), 'kupplungsverzahnung', side);
    addMesh(g.r, latheGeo([[1.05, s * 2.8], [2.55, s * 2.8], [2.35, s * 2.0], [1.05, s * 2.0]]), 'reibkonus', side);
    return g;
  }
  const g1 = losrad(1), g2 = losrad(2);

  // Synchronringe
  function ring(side) {
    const s = side === 1 ? -1 : 1;
    const r = carrier();
    addMesh(r.r, latheGeo([[2.54, s * 2.7], [2.8, s * 2.7], [2.8, s * 2.42], [2.56, s * 1.95], [2.35, s * 1.95]]), 'synchronring', side);
    addMesh(r.r, gearGeo({ z: 30, rRoot: 2.85, rTip: 3.2, bore: 2.75, width: 0.28, x: s * 2.56 }), 'synchronring', side);
    for (let k = 0; k < 3; k++) {
      const alpha = (k * 10 + 0.5) * P_SYNC, rr = 2.8;
      const lug = addMesh(r.r, new THREE.BoxGeometry(0.53, 0.32, 0.3), 'synchronring', side);
      lug.position.set(s * 1.685, rr * Math.sin(alpha), -rr * Math.cos(alpha));
      lug.rotation.x = alpha - Math.PI / 2;
    }
    return r;
  }
  const r1 = ring(1), r2 = ring(2);

  // Synchronkörper mit Druckstücken
  const hub = carrier();
  addMesh(hub.r, gearGeo({ z: 30, rRoot: 2.85, rTip: 3.2, bore: 1.0, width: 2.4, skip: (i) => i % 10 === 0 }), 'synchronkoerper');
  const struts = [];
  for (let k = 0; k < 3; k++) {
    const alpha = (k * 10 + 0.5) * P_SYNC;
    const st = addMesh(hub.r, new THREE.BoxGeometry(1.0, 0.26, 0.34), 'druckstueck');
    const rr = 2.98;
    st.userData.base = new THREE.Vector3(0, rr * Math.sin(alpha), -rr * Math.cos(alpha));
    st.position.copy(st.userData.base);
    st.rotation.x = alpha - Math.PI / 2;
    struts.push(st);
  }

  // Schiebemuffe (Innenverzahnung, Schaltnut)
  const slv = carrier();
  const sp = { z: 30, rRoot: 3.25, rTip: 2.9, phase: P_SYNC / 2 };
  addMesh(slv.r, internalGeo({ ...sp, outer: 3.9, width: 0.9, x: -0.85 }), 'schiebemuffe');
  addMesh(slv.r, internalGeo({ ...sp, outer: 3.5, width: 0.8, x: 0 }), 'schiebemuffe');
  addMesh(slv.r, internalGeo({ ...sp, outer: 3.9, width: 0.9, x: 0.85 }), 'schiebemuffe');

  // Schaltgabel + Schaltstange (dreht nicht)
  const fork = carrier();
  addMesh(fork.c, latheGeo([[3.55, -0.36], [4.5, -0.36], [4.5, 0.36], [3.55, 0.36]], 48, Math.PI * 1.08, Math.PI * 0.84), 'schaltgabel');
  addMesh(fork.c, new THREE.BoxGeometry(0.7, 3.4, 0.9).translate(0, 6.0, 0), 'schaltgabel');
  addMesh(fork.c, shaftGeo(0.45, -5, 5, 24).translate(0, 7.9, 0), 'schaltgabel');

  // ---------- Beschriftungen ----------
  const anchors = {
    antriebswelle: [inp, [-11.8, 1.1, 0.6]], antriebsrad: [inp, [-7.4, 2.4, 2.6]],
    konstantrad: [cs, [-7.4, -3.4, 3.6]], vorgelegewelle: [cs, [0, 0.4, 0.8]],
    festrad1: [cs, [-4.2, -1.6, 2.6]], festrad2: [cs, [4.2, -2.6, 3.4]],
    losrad1: [g1, [-4.2, 3.0, 4.6]], losrad2: [g2, [4.2, 2.5, 3.4]],
    kupplungsverzahnung: [g1, [-3.1, -2.3, 2.3]], reibkonus: [g1, [-2.4, -1.1, 2.1]],
    synchronring: [r1, [-2.4, 2.1, 1.9]], synchronkoerper: [hub, [-0.6, -1.3, 2.4]],
    schiebemuffe: [slv, [1.0, -3.3, 2.2]], druckstueck: [hub, [0, 2.6, 1.6]],
    schaltgabel: [fork, [0, 7.0, 0.6]], hauptwelle: [sh, [7.4, 1.0, 0.4]],
  };
  const labelLayer = document.createElement('div'); labelLayer.className = 'labels'; container.appendChild(labelLayer);
  const labels = {};
  for (const p of PARTS) {
    const el = document.createElement('div'); el.className = 'lbl'; el.textContent = p.name; labelLayer.appendChild(el);
    labels[p.id] = el;
  }
  let labelMode = opts.labels || 'off';
  let numbers = {};
  function setLabels(mode, nums) {
    labelMode = mode; if (nums) numbers = nums;
    for (const p of PARTS) {
      labels[p.id].textContent = mode === 'numbers' ? String(numbers[p.id] ?? '?') : p.name;
      labels[p.id].classList.toggle('num', mode === 'numbers');
    }
    labelLayer.style.display = mode === 'off' ? 'none' : '';
  }
  setLabels(labelMode);

  // ---------- Hover / Hervorhebung ----------
  const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; container.appendChild(tip);
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let hover = null, flowGear = 0, highlight = null;
  const allowHover = opts.hover !== false;
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!allowHover) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(meshes, false).find((h) => h.object.visible && cutPlane.distanceToPoint(h.point) >= 0);
    hover = hit ? hit.object : null;
    if (hover) {
      const p = PART[hover.userData.part];
      tip.innerHTML = `<b>${p.name}</b><span>${p.desc}</span>`;
      tip.style.left = e.clientX - rect.left + 14 + 'px'; tip.style.top = e.clientY - rect.top + 14 + 'px';
      tip.hidden = false;
    } else tip.hidden = true;
  });
  renderer.domElement.addEventListener('pointerleave', () => { hover = null; tip.hidden = true; });

  const FLOW_EMI = new THREE.Color(0xff7a1a), HOVER_EMI = new THREE.Color(0x3a4a66), HL_EMI = new THREE.Color(0x1f9d55);
  function inFlow(m) {
    if (!flowGear || sim.engaged !== flowGear) return false;
    const { part, side } = m.userData;
    return FLOW[flowGear].includes(part) && (side === undefined || side === flowGear);
  }
  function refreshEmissive() {
    for (const m of meshes) {
      const e = m.material.emissive.setRGB(0, 0, 0);
      if (inFlow(m)) e.copy(FLOW_EMI).multiplyScalar(0.55);
      if (highlight && m.userData.part === highlight && (m.userData.side === undefined || m.userData.side === 1)) e.copy(HL_EMI).multiplyScalar(0.8);
      if (hover && hover.userData.part === m.userData.part && hover.userData.side === m.userData.side) e.add(HOVER_EMI);
    }
  }

  // ---------- Darstellung ----------
  let explode = 0;
  const ang = { in: 0, shaft: 0 };
  let ringOff = { 1: 0, 2: 0 };
  const ringShift = { 1: 0, 2: 0 };
  const VIS = ((2 * Math.PI) / 60) * 0.06;
  const wrap = (x, p) => x - p * Math.round(x / p);

  function updateVisuals(dt) {
    ang.in += sim.nIn * VIS * dt;
    ang.shaft += sim.nOut * VIS * dt;
    // Einspuren: Muffen-Dachschrägen verdrehen das (freie) Losrad, bis die Zähne fluchten
    const side = sim.activeSide;
    if (side && ['entsperr', 'einspuren', 'gang'].includes(sim.phase)) {
      const iT = RATIO[side];
      const m = wrap(ang.in / iT - ang.shaft, P_SYNC);
      ang.in -= m * iT * (sim.phase === 'gang' ? 1 : Math.min(1, dt * 12));
    }
    inp.r.rotation.x = ang.in;
    cs.r.rotation.x = (-ang.in * Z.an) / Z.k;
    g1.r.rotation.x = ang.in / I1;
    g2.r.rotation.x = ang.in / I2;
    for (const o of [sh, hub, slv]) o.r.rotation.x = ang.shaft;

    const a = Math.abs(sim.d), s = Math.sign(sim.d);
    for (const k of [1, 2]) {
      const active = (k === 1 ? s < 0 : s > 0) && sim.synchro;
      const lock = active && (sim.phase === 'vorsync' || sim.phase === 'sperr');
      const tgt = lock ? sim.deltaSign * P_SYNC * 0.42 : 0;
      ringOff[k] += (tgt - ringOff[k]) * Math.min(1, dt * 14);
      const rr = k === 1 ? r1 : r2;
      rr.r.rotation.x = ang.shaft + ringOff[k];
      const shift = active ? THREE.MathUtils.clamp((a - A_PRE) / RING_SHIFT, 0, 1) * RING_SHIFT : 0;
      ringShift[k] = shift;
      rr.c.position.x = (k === 1 ? -1 : 1) * (shift + 1.3 * explode);
      rr.c.visible = sim.synchro;
    }
    for (const st of struts) st.position.x = s * Math.min(a, A_PRE + RING_SHIFT);
    slv.c.position.x = sim.d;
    fork.c.position.set(sim.d, 3 * explode, 0);
    g1.c.position.x = -2.6 * explode; g2.c.position.x = 2.6 * explode;
    inp.c.position.x = -4.2 * explode;
    cs.c.position.y = -8 - 3.2 * explode;
    refreshEmissive();
  }

  const v = new THREE.Vector3();
  function updateLabels() {
    if (labelMode === 'off') return;
    const w = container.clientWidth, h = container.clientHeight;
    for (const p of PARTS) {
      const [car, off] = anchors[p.id];
      v.set(...off); car.c.localToWorld(v);
      const el = labels[p.id];
      // im Schnitt die Marke auf die Schnittfläche legen
      if (v.z > cutPlane.constant) v.z = cutPlane.constant;
      const hidden = p.id === 'synchronring' && !sim.synchro;
      v.project(camera);
      el.style.display = hidden || v.z > 1 ? 'none' : '';
      el.style.transform = `translate(-50%,-50%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
    }
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container); resize();

  const clock = new THREE.Clock();
  const listeners = [];
  renderer.setAnimationLoop(() => {
    const dtReal = Math.min(clock.getDelta(), 0.05);
    const dt = dtReal * sim.timeScale;
    sim.step(dt);
    updateVisuals(dt);
    controls.update();
    renderer.render(scene, camera);
    updateLabels();
    for (const f of listeners) f(sim, dtReal);
  });

  return {
    sim, camera, controls, ang,
    onUpdate: (f) => listeners.push(f),
    setCut(on, z = 0) { cutPlane.constant = on ? z : 1000; },
    setExplode(e) { explode = e; },
    setView(name) {
      const V = { all: [[10, 9, 30], [-1.5, -3.2, 0]], sync: [[4, 4, 13], [0, 0.5, 0]], front: [[0, 0, 30], [-1.5, -3.5, 0]] };
      const [p, t] = V[name] || V.all; camera.position.set(...p); controls.target.set(...t); controls.update();
    },
    setLabels, setFlow(g) { flowGear = g; },
    setHighlight(id) { highlight = id; },
    relAngle(side) { return wrap(ang.in / RATIO[side] - ang.shaft, P_SYNC); },
    ringOffset: (side) => ringOff[side],
    ringShift: (side) => ringShift[side],
    P_SYNC, A: { A_PRE, A_BLOCK, A_THRU, A_FULL },
  };
}

return { createGearbox, Sim, PARTS, PART, FLOW, PHASES, RATIO, Z, I_K, I1, I2 };
};
