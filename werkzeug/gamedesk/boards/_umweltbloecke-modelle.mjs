/* Vier 3D-Modelle für die Umweltblöcke — See, Gebirge, Wald, Vulkan.
 *
 * Maßstab wie in docs/ASSETS-FELDHERR-3D.md: **eine Einheit = eine
 * Feldkante**. Jeder Block sitzt auf derselben Grundplatte 1 × 1 und bleibt
 * unter Höhe 1, damit die vier nebeneinander vergleichbar sind und eine
 * Figur davor nicht verschwindet.
 *
 * Farben aus der Tafel: See #6ea8fe, Wald #57c98a, Fels neutral, Vulkan
 * #ef6b6b — so trägt das Modell dieselbe Kennfarbe wie seine Notiz.
 *
 * Das Skript hängt die Modelle in die Tafel und legt je Block eine
 * 3D-Ansicht an. Zweimal laufen lassen ist unschädlich: Modelle und Kacheln
 * werden am Namen wiedererkannt und überschrieben.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/* Pfad aus dem eigenen Ort ableiten — das Skript läuft in jedem Checkout. */
const HIER = dirname(fileURLToPath(import.meta.url));

const DATEI = join(HIER, 'feldherr-funktionsweise.gamedesk.json');
const doc = JSON.parse(readFileSync(DATEI, 'utf8'));
doc.models = doc.models || [];

let n = 0;
const uid = (p) => p + '_ub' + (++n).toString(36);

const MAT = {
  color: '#9fb4d8', rough: 0.5, metal: 0.05, opacity: 1,
  emissive: '#000000', emissiveStrength: 0,
  texture: null, noShadow: false, unlit: false,
  texMode: 'uv', uvScale: [1, 1], uvOffset: [0, 0], uvRot: 0, texSize: 1, texStrength: 1
};

const PARAMS = {
  box: { round: 0.06, sides: 4, seg: 4 },
  cube: { round: 0.06, sides: 4, seg: 4 },
  plane: { round: 0.04, sides: 4, seg: 3, thin: 0.02 },
  prism: { round: 0.05, sides: 3, seg: 4 },
  pyramid: { round: 0.05, sides: 4, seg: 4 },
  cylinder: { round: 0.08, sides: 32, seg: 4 },
  cone: { round: 0.06, sides: 32, seg: 4 },
  sphere: { sides: 32, rings: 20 },
  torus: { sides: 32, rings: 16, tube: 0.34 }
};

/** Ein Knoten. p = Mitte, s = Halbmaße in Feldkanten. */
function k(name, kind, p, s, mat, o = {}) {
  return {
    id: uid('n'), name: name, kind: kind,
    p: p, r: o.r || [0, 0, 0], s: s,
    params: Object.assign({}, PARAMS[kind] || PARAMS.box, o.params || {}),
    mat: Object.assign({}, MAT, mat || {}),
    visible: true, locked: false
  };
}

const grund = (farbe, rough) => k('Feldplatte', 'box', [0, -0.06, 0], [0.5, 0.06, 0.5],
  { color: farbe, rough: rough === undefined ? 0.92 : rough, metal: 0 }, { params: { round: 0.04 } });

function szene(nodes, hintergrund) {
  return {
    nodes: nodes,
    env: {
      background: hintergrund || '#12151c',
      ambient: 0.38, ambientColor: '#8fa4c4',
      sunPos: [4.4, 8, 3.2], sunDir: [-0.455, -0.827, -0.331],
      sunColor: '#ffffff', sunIntensity: 1.05,
      shadows: true, shadowStrength: 0.72,
      floor: false, floorY: -1.001, floorColor: '#1a1e27', gridColor: '#39435a', gridSize: 1
    },
    camera: { yaw: 0.72, pitch: 0.46, dist: 2.9, target: [0, 0.12, 0] },
    snap: { on: true, step: 0.25, rot: 15, scale: 0.1 }
  };
}

/* ===================================================================== */
/* See — Becken, Wasserspiegel, zwei Ringe                               */
/* ===================================================================== */

const see = szene([
  grund('#1c3550'),
  k('Beckenrand', 'box', [0, 0.02, 0], [0.5, 0.05, 0.5], { color: '#22415f', rough: 0.9 }),
  k('Wasser', 'box', [0, 0.045, 0], [0.44, 0.03, 0.44],
    { color: '#3f86d6', rough: 0.12, metal: 0.15, opacity: 0.92 }, { params: { round: 0.03 } }),
  k('Glanz', 'box', [0, 0.062, 0], [0.30, 0.012, 0.30],
    { color: '#7cc0ff', rough: 0.06, metal: 0.3, opacity: 0.5 }, { params: { round: 0.03 } }),
  k('Welle innen', 'torus', [-0.06, 0.075, 0.05], [0.13, 0.13, 0.13],
    { color: '#a8d8ff', rough: 0.2, opacity: 0.55 }, { r: [-Math.PI / 2, 0, 0], params: { tube: 0.11, rings: 20 } }),
  k('Welle außen', 'torus', [0.12, 0.072, -0.10], [0.19, 0.19, 0.19],
    { color: '#8ec8f6', rough: 0.25, opacity: 0.36 }, { r: [-Math.PI / 2, 0, 0], params: { tube: 0.07, rings: 20 } }),
  k('Schilf', 'cylinder', [0.34, 0.14, 0.33], [0.012, 0.14, 0.012], { color: '#4c7a52', rough: 0.9 }),
  k('Schilf 2', 'cylinder', [0.39, 0.11, 0.28], [0.011, 0.11, 0.011], { color: '#5d8a5c', rough: 0.9 },
    { r: [0, 0, 0.18] })
], '#0f1a26');

/* ===================================================================== */
/* Gebirge (Fels) — drei versetzte Blöcke, oben eine Bauplatte           */
/* ===================================================================== */

const fels = szene([
  grund('#2a2f38'),
  k('Sockel', 'box', [0, 0.14, 0], [0.46, 0.14, 0.46], { color: '#4a515d', rough: 0.95 },
    { params: { round: 0.05 } }),
  k('Block links', 'box', [-0.16, 0.36, 0.06], [0.24, 0.22, 0.26], { color: '#5b6472', rough: 0.95 },
    { r: [0, 0.28, 0.06], params: { round: 0.06 } }),
  k('Block rechts', 'box', [0.19, 0.31, -0.10], [0.20, 0.17, 0.22], { color: '#525a67', rough: 0.95 },
    { r: [0, -0.34, -0.05], params: { round: 0.06 } }),
  k('Gipfel', 'box', [-0.02, 0.56, -0.02], [0.17, 0.12, 0.18], { color: '#6a7482', rough: 0.92 },
    { r: [0, 0.6, 0], params: { round: 0.05 } }),
  k('Bauplatte', 'box', [-0.02, 0.68, -0.02], [0.15, 0.02, 0.16],
    { color: '#8b96a5', rough: 0.7, emissive: '#4b5563', emissiveStrength: 0.18 },
    { r: [0, 0.6, 0], params: { round: 0.03 } }),
  k('Geröll', 'sphere', [0.30, 0.05, 0.30], [0.07, 0.05, 0.07], { color: '#4d5561', rough: 1 }),
  k('Geröll 2', 'sphere', [-0.33, 0.04, -0.28], [0.05, 0.04, 0.06], { color: '#464e59', rough: 1 })
], '#141821');

/* ===================================================================== */
/* Wald — Boden, drei Bäume, Unterholz                                   */
/* ===================================================================== */

function baum(nm, x, z, hoehe, breite, ton) {
  return [
    k(nm + ' Stamm', 'cylinder', [x, hoehe * 0.30, z], [0.035, hoehe * 0.30, 0.035],
      { color: '#5c452e', rough: 0.95 }),
    k(nm + ' Krone', 'cone', [x, hoehe * 0.62, z], [breite, hoehe * 0.34, breite],
      { color: ton, rough: 0.88 }, { params: { sides: 20, round: 0.05 } }),
    k(nm + ' Spitze', 'cone', [x, hoehe * 0.86, z], [breite * 0.66, hoehe * 0.24, breite * 0.66],
      { color: ton, rough: 0.88 }, { params: { sides: 20, round: 0.05 } })
  ];
}

const wald = szene([
  grund('#22371f'),
  k('Waldboden', 'box', [0, 0.02, 0], [0.5, 0.05, 0.5], { color: '#2f4a29', rough: 0.98 })
].concat(
  baum('Baum 1', -0.17, 0.12, 0.84, 0.20, '#3f7a44'),
  baum('Baum 2', 0.18, -0.06, 0.66, 0.16, '#4c8c50'),
  baum('Baum 3', 0.02, -0.30, 0.52, 0.13, '#356b3b'),
  [
    k('Unterholz', 'sphere', [-0.32, 0.09, -0.24], [0.10, 0.07, 0.10], { color: '#3a6b3d', rough: 1 }),
    k('Unterholz 2', 'sphere', [0.33, 0.08, 0.30], [0.09, 0.06, 0.08], { color: '#43784a', rough: 1 }),
    k('Farn', 'sphere', [-0.30, 0.07, 0.33], [0.07, 0.05, 0.07], { color: '#4f8a52', rough: 1 })
  ]
), '#0f1a12');

/* ===================================================================== */
/* Vulkan — Kegel mit Krater, Lava, Rauchkugeln                          */
/* ===================================================================== */

const vulkan = szene([
  grund('#33231d'),
  k('Aschefeld', 'box', [0, 0.02, 0], [0.5, 0.05, 0.5], { color: '#3b2a23', rough: 1 }),
  k('Kegel', 'cone', [0, 0.34, 0], [0.44, 0.34, 0.44], { color: '#4a332a', rough: 0.96 },
    { params: { sides: 26, round: 0.04 } }),
  k('Kegelkrone', 'cylinder', [0, 0.66, 0], [0.17, 0.04, 0.17], { color: '#3f2b23', rough: 0.96 }),
  k('Krater', 'cylinder', [0, 0.68, 0], [0.13, 0.035, 0.13], { color: '#1d1310', rough: 1 }),
  k('Lava', 'cylinder', [0, 0.70, 0], [0.11, 0.02, 0.11],
    { color: '#ff7a3c', rough: 0.35, emissive: '#ff5a1f', emissiveStrength: 1.5 }),
  k('Lavastrom', 'box', [0.12, 0.40, 0.20], [0.045, 0.16, 0.03],
    { color: '#e8552a', rough: 0.5, emissive: '#ff4d18', emissiveStrength: 0.9 },
    { r: [0.5, -0.5, 0.22], params: { round: 0.03 } }),
  k('Glut', 'sphere', [0.20, 0.11, 0.30], [0.05, 0.035, 0.05],
    { color: '#c9481f', rough: 0.6, emissive: '#ff5a1f', emissiveStrength: 0.6 }),
  k('Rauch', 'sphere', [0.03, 0.86, -0.02], [0.11, 0.09, 0.11],
    { color: '#6b6b70', rough: 1, opacity: 0.42 }),
  k('Rauch 2', 'sphere', [-0.05, 0.99, 0.04], [0.08, 0.07, 0.08],
    { color: '#7a7a80', rough: 1, opacity: 0.28 })
], '#1c1210');

/* ===================================================================== */
/* In die Tafel hängen                                                   */
/* ===================================================================== */

const BLOECKE = [
  ['Feldherr · See', see],
  ['Feldherr · Gebirge', fels],
  ['Feldherr · Wald', wald],
  ['Feldherr · Vulkan', vulkan]
];

const modellId = new Map();
for (const [name, scene] of BLOECKE) {
  const da = doc.models.find((m) => m.name === name);
  if (da) {
    da.scene = scene;
    da.updated = Date.now();
    modellId.set(name, da.id);
  } else {
    const m = { id: uid('mdl'), name: name, scene: scene, updated: Date.now() };
    doc.models.push(m);
    modellId.set(name, m.id);
  }
}

/* Je Block eine 3D-Ansicht. Vorhandene werden nur nachgezogen. */
const ANSICHTEN = [
  ['See — 3D', 'Feldherr · See'],
  ['Gebirge — 3D', 'Feldherr · Gebirge'],
  ['Wald — 3D', 'Feldherr · Wald'],
  ['Vulkan — 3D', 'Feldherr · Vulkan']
];

let neue = 0;
for (const [titel, modell] of ANSICHTEN) {
  const da = doc.windows.find((w) => w.title === titel && w.type === 'modelview');
  const state = {
    modelId: modellId.get(modell), spin: true, speed: 0.24,
    yaw: 0.72, pitch: 0.46, zoom: 1, background: null, floor: false, quality: 'normal'
  };
  if (da) { da.state = state; continue; }
  doc.windows.push({
    id: uid('win'), type: 'modelview', title: titel,
    x: 0, y: 0, w: 340, h: 300, z: 10, accent: '#4fd1c5', collapsed: false,
    state: state
  });
  neue++;
}

writeFileSync(DATEI, JSON.stringify(doc, null, 1), 'utf8');
console.log('Modelle:', doc.models.length, '· neue Ansichten:', neue);
console.log('Knoten je Block:', BLOECKE.map(([nm, s]) => nm.replace('Feldherr · ', '') + ' ' + s.nodes.length).join(' · '));
