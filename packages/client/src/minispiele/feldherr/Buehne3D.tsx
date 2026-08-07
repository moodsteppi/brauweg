/**
 * Feldherr — 3D-Buehne (Stufe 2 des Strukturumbaus, docs/FELDHERR-3D-UMBAU.md).
 *
 * Steht NEBEN dem 2D-Canvas, nicht darueber: Der Kern rechnet und zeichnet
 * unveraendert; diese Buehne liest je Bild ueber sitzung.lesen() den
 * Simulationszustand und stellt ihn mit Three dar. Sie schreibt NIE in den
 * Zustand — wer das tut, faehrt am Gleichschritt vorbei, und die Partie
 * wird strittig.
 *
 * Die Buehne legt sich exakt ueber das #stage-Element des Kerns und laesst
 * Zeigerereignisse durch (pointer-events: none) — bedient wird weiter der
 * 2D-Pfad samt Bau-Vorschau und HUD. Solange die Modelle aus
 * docs/ASSETS-FELDHERR-3D.md nicht geliefert sind, stehen Platzhalter;
 * nur der Ritter kommt schon als GLB (public/3d/feldherr/ritter.glb).
 *
 * Lehren aus Pro-Subway (CLAUDE.md), die hier eingebaut sind:
 *  - Nichts Anhaltendes im <Canvas>: Das GLB laedt ein Effekt mit dem
 *    GLTFLoader; bis es da ist, steht ein Platzhalterkloetzchen.
 *  - Nach dem Aufbau ein resize am window feuern, sonst bleibt die
 *    Leinwand beim ersten Oeffnen leer.
 *  - Kein clone() je Instanz auf Materialien oder Texturen — Object3D.clone()
 *    teilt Geometrie und Material, genau das wollen wir.
 */
import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { FeldherrLeseblick, FeldherrSitzung } from './kern.js';

/** Brettmasse laut Geometrie-Entscheid vom 7. August 2026. */
const SPALTEN = 8;
const ZEILEN = 12;

/** Farbwelt des 2D-Kerns, nach Hex uebersetzt. */
const FARBE = {
  gras: '#3e5c44',
  grasAlt: '#3a5740',
  erde: '#3a2c20',
  fels: '#707882',
  laub: '#2f6a46',
  stamm: '#4a3624',
  wasser: '#1a4058',
  lava: '#ff7820',
  basalt: '#2e2622',
  holz: '#705234',
  stein: '#8e887c',
  wand: '#d8cbb2',
  spieler: ['#e83a30', '#2a78ff'],
  /** Kupfer, Silber, Gold, Diamant — wie COL.stufe im Kern. */
  stufe: ['#c6763e', '#d2dae4', '#f6ca58', '#a8ecff'],
};

/* Geometrien und Materialien werden geteilt, nie je Instanz erzeugt —
 * zwoelf zusaetzliche Texturen haben im Runner schon einmal den
 * WebGL-Kontext gekostet. */
const GEO = {
  kasten: new THREE.BoxGeometry(1, 1, 1),
  kegel: new THREE.ConeGeometry(0.5, 1, 6),
  walze: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  kugel: new THREE.SphereGeometry(0.5, 10, 8),
};
const materialLager = new Map<string, THREE.MeshLambertMaterial>();
function stoff(farbe: string): THREE.MeshLambertMaterial {
  let m = materialLager.get(farbe);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: farbe });
    materialLager.set(farbe, m);
  }
  return m;
}
function kloetzchen(
  farbe: string,
  sx: number,
  sy: number,
  sz: number,
  geo: THREE.BufferGeometry = GEO.kasten,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, stoff(farbe));
  mesh.scale.set(sx, sy, sz);
  mesh.position.y = sy / 2;
  return mesh;
}

/* ---------- Overlays: Lebensbalken, Bereitschaftsring, Kampf-Effekte ------
 * Die Werte kommen ausschliesslich aus dem Lesefenster (hp, mtimer, atk,
 * G.fx) — hier wird nur dargestellt, nie gerechnet. */

/** Ungefaehre Kopfhoehe je Objektart, dort schwebt der Lebensbalken. */
const HOEHE: Record<string, number> = {
  haus: 1.2, mauer: 0.95, werk: 0.8, kanone: 0.9,
  schwert: 0.75, bogen: 0.75, ritter: 1.05,
};

/**
 * Aktionsringe wie in 2D (drawRing): INNEN der Marschring (mtimer), AUSSEN
 * der Schlagring (timer). Beide fuellen sich als Bogen und sind je Stufe
 * eine geteilte Geometrie — je Bild neu zu bauen kostete Speicher ohne Not.
 * Gezeichnet wird ab 12 Uhr im Uhrzeigersinn; die Ebene liegt flach, daher
 * dreht die Startphase auf -PI/2 minus dem Bogen.
 */
const RING_STUFEN = 24;
function ringSatz(innen: number, aussen: number): THREE.RingGeometry[] {
  const satz: THREE.RingGeometry[] = [];
  for (let i = 0; i <= RING_STUFEN; i++) {
    const bogen = Math.max(0.001, (i / RING_STUFEN) * Math.PI * 2);
    satz.push(new THREE.RingGeometry(innen, aussen, 28, 1, Math.PI / 2 - bogen, bogen));
  }
  return satz;
}
const GEO_MARSCH = ringSatz(0.3, 0.37);
const GEO_SCHLAG = ringSatz(0.4, 0.46);
/** Steht die Truppe, wird aus dem Fuellbogen ein dickes volles Band — das
 *  ist der auffaelligste Unterschied, den eine Ringform hergibt. */
const GEO_HALT = new THREE.RingGeometry(0.24, 0.44, 32);
/** Bodenmarke: ein Feld gross, wird je Marke skaliert. */
const GEO_MARKE = new THREE.PlaneGeometry(1, 1);

/**
 * Partikel. Zwei Schwaerme, weil sie verschieden verblassen muessen:
 *
 *  hell  — Funken, Staub, Glut und Rauch: additiv gemischt. Verblassen
 *          heisst hier, die Farbe gegen Schwarz zu ziehen; additiv ist
 *          Schwarz unsichtbar. So kommt man ohne Deckkraft je Teilchen aus,
 *          die eine InstancedMesh nicht hergibt.
 *  dunkel— Gesteinssplitter: normal gemischt, sonst waeren dunkle Truemmer
 *          additiv gar nicht zu sehen. Sie verblassen ueber die Groesse.
 *
 * Ein Zeichenaufruf je Schwarm statt Hunderter Einzelobjekte.
 */
const PARTIKEL_MAX = 340;
const GEO_PARTIKEL = new THREE.SphereGeometry(0.5, 6, 4);
/** Farben aus drawPT, damit beide Ansichten dieselbe Glut zeigen. */
const PT_FARBE: Record<string, [number, number, number]> = {
  smoke: [152 / 255, 148 / 255, 143 / 255],
  rock: [58 / 255, 48 / 255, 42 / 255],
  emberJung: [1, 220 / 255, 140 / 255],
  emberAlt: [1, 120 / 255, 40 / 255],
  funke: [1, 236 / 255, 190 / 255],
};

/**
 * Muenze des Rundenanfangs. Die Scheibe liegt flach (Zylinderachse ist Y),
 * beim Wurf dreht sie um X. Drei Materialien: Rand, Kopfseite (oben),
 * Zahlseite (unten) — so ist im Bild ablesbar, was gefallen ist.
 */
const GEO_MUENZE = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 22);
const STOFF_MUENZE = [
  new THREE.MeshLambertMaterial({ color: '#c98f2e' }),   // Rand
  new THREE.MeshLambertMaterial({ color: '#ffe08a' }),   // Kopf
  new THREE.MeshLambertMaterial({ color: '#8c6a34' }),   // Zahl
];
/** Halbe Drehungen im Flug — gerade Zahl, damit die Muenze flach landet. */
const MUENZ_DREHUNGEN = 6;
/** Scheitelhoehe des Wurfs in Feldern. */
const MUENZ_HOEHE = 3.4;
/** Farben aus dem 2D-Renderer, damit beide Ansichten dasselbe erzaehlen. */
const RING_FARBE = {
  marsch: '#cfe9fa', marschVoll: '#f0faff',
  /* Stellung: kraeftiges Orange statt des hellen Marschtons — auf einen
   * Blick unterscheidbar, auch am kleinen Handybild. */
  halt: '#ff7a2e', haltSchlag: '#ffb15e',
  schlag: '#f0bc68', schlagVoll: '#ffce78',
};

const spriteLager = new Map<string, THREE.SpriteMaterial>();
function spriteStoff(farbe: string, deckkraft: number): THREE.SpriteMaterial {
  const key = farbe + '/' + deckkraft;
  let m = spriteLager.get(key);
  if (!m) {
    m = new THREE.SpriteMaterial({ color: farbe, opacity: deckkraft, transparent: true, depthTest: false });
    spriteLager.set(key, m);
  }
  return m;
}

/** Schadenszahlen und Meldungen als Leinwand-Texturen, je Text geteilt. */
const textLager = new Map<string, THREE.Texture>();
/**
 * Anteil der Tafel an der Texturbreite. Der freie Rand einer Textur ist
 * durchsichtig; ohne dieses Mass hielte der Randschutz unten die leeren
 * Ecken fuer Schild und schoebe die Tafeln viel zu weit nach innen.
 */
const tafelAnteil = new Map<string, number>();
function textTextur(text: string, farbe: string, tafel = false): THREE.Texture {
  const key = text + '/' + farbe + (tafel ? '/tafel' : '');
  let t = textLager.get(key);
  if (!t) {
    const leinwand = document.createElement('canvas');
    // Breite Tafeln fuer Hinweisschilder, quadratisch fuer kurze Zahlen.
    leinwand.width = tafel ? 1024 : 256;
    leinwand.height = tafel ? 200 : 96;
    const z = leinwand.getContext('2d')!;
    const mitteX = leinwand.width / 2, mitteY = leinwand.height / 2;
    if (tafel) {
      // Wie das 2D-Schild: dunkle Platte mit farbigem Rand, damit der Text
      // ueber jedem Untergrund lesbar bleibt. Die Schrift schrumpft nur,
      // wenn eine lange Ansage sonst aus der Tafel liefe — die Sprites
      // haben alle dieselbe Groesse, damit die Schrift gleich gross wirkt.
      let grad = 72;
      z.font = '800 ' + grad + 'px system-ui, sans-serif';
      const platz = leinwand.width - 90;
      if (z.measureText(text).width > platz) {
        grad = Math.max(26, Math.floor((grad * platz) / z.measureText(text).width));
        z.font = '800 ' + grad + 'px system-ui, sans-serif';
      }
      const breite = Math.min(leinwand.width - 12, z.measureText(text).width + 56);
      tafelAnteil.set(key, breite / leinwand.width);
      z.fillStyle = 'rgba(7,12,17,.9)';
      z.beginPath();
      const x0 = mitteX - breite / 2, y0 = 26, h = leinwand.height - 52;
      if (z.roundRect) z.roundRect(x0, y0, breite, h, 26); else z.rect(x0, y0, breite, h);
      z.fill();
      z.strokeStyle = farbe; z.globalAlpha = 0.7; z.lineWidth = 5; z.stroke();
      z.globalAlpha = 1;
    } else {
      z.font = '800 56px system-ui, sans-serif';
      z.lineWidth = 8; z.strokeStyle = 'rgba(6,10,14,.85)';
    }
    z.textAlign = 'center'; z.textBaseline = 'middle';
    if (!tafel) z.strokeText(text, mitteX, mitteY);
    z.fillStyle = farbe;
    z.fillText(text, mitteX, mitteY);
    t = new THREE.CanvasTexture(leinwand);
    textLager.set(key, t);
  }
  return t;
}

interface ObjektOverlays {
  balkenBg: THREE.Sprite;
  balkenFill: THREE.Sprite;
  marsch: THREE.Mesh | null;
  marschStufe: number;
  schlag: THREE.Mesh | null;
  schlagStufe: number;
  /** Schwebende Stellungszahl "n/max" — nur bei stehenden Truppen. */
  stand: THREE.Sprite | null;
  standText: string;
  /** Kurzes Aufglimmen bei Treffern. */
  blitz: THREE.Mesh;
  /** Laufzeitbalken des Werks (Hintergrund und Fuellung). */
  laufBg: THREE.Sprite;
  laufFill: THREE.Sprite;
}
function baueOverlays(
  gruppe: THREE.Group,
  art: string,
  laeuft: boolean,
  schlaegt: boolean,
  mitStand: boolean,
): ObjektOverlays {
  const hoehe = (HOEHE[art] ?? 0.9) + 0.3;
  const balkenBg = new THREE.Sprite(spriteStoff('#0a1116', 0.75));
  balkenBg.scale.set(0.76, 0.1, 1);
  balkenBg.position.y = hoehe;
  balkenBg.visible = false;
  const balkenFill = new THREE.Sprite(spriteStoff('#7fd8a0', 0.95));
  balkenFill.center.set(0, 0.5);            // links verankert, Breite = Lebensanteil
  balkenFill.scale.set(0.72, 0.07, 1);
  balkenFill.position.set(-0.36, hoehe, 0);
  balkenFill.visible = false;
  gruppe.add(balkenBg, balkenFill);
  const ring = (satz: THREE.RingGeometry[], farbe: string, hoch: number) => {
    const m = new THREE.Mesh(satz[0], new THREE.MeshBasicMaterial({
      color: farbe, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = hoch;
    m.visible = false;
    gruppe.add(m);
    return m;
  };
  /* Treffer-Aufleuchten: eine additive Kugel, die bei e.flash kurz
   * aufglimmt. Bewusst ein eigenes Objekt — die Materialien der Figuren
   * sind geteilt, ein Umfaerben traefe alle Objekte derselben Art. */
  const blitz = new THREE.Mesh(GEO.kugel, new THREE.MeshBasicMaterial({
    color: '#ffd7b4', transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  blitz.scale.setScalar(1.1);
  blitz.position.y = (HOEHE[art] ?? 0.9) * 0.5;
  blitz.visible = false;
  gruppe.add(blitz);
  /* Laufzeitbalken des Werks: Wie lange laeuft es noch (2D: drawLaufzeit). */
  const laufBg = new THREE.Sprite(spriteStoff('#0a1116', 0.8));
  laufBg.scale.set(0.8, 0.11, 1);
  laufBg.position.y = hoehe + 0.16;
  laufBg.visible = false;
  const laufFill = new THREE.Sprite(spriteStoff('#ffa64a', 0.95));
  laufFill.center.set(0, 0.5);
  laufFill.scale.set(0.76, 0.08, 1);
  laufFill.position.set(-0.38, hoehe + 0.16, 0);
  laufFill.visible = false;
  gruppe.add(laufBg, laufFill);
  let stand: THREE.Sprite | null = null;
  if (mitStand) {
    stand = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    stand.scale.set(0.62, 0.24, 1);
    stand.position.y = hoehe + 0.26;
    stand.visible = false;
    gruppe.add(stand);
  }
  return {
    balkenBg, balkenFill,
    marsch: laeuft ? ring(GEO_MARSCH, RING_FARBE.marsch, 0.03) : null,
    marschStufe: -1,
    schlag: schlaegt ? ring(GEO_SCHLAG, RING_FARBE.schlag, 0.028) : null,
    schlagStufe: -1,
    stand, standText: '',
    blitz, laufBg, laufFill,
  };
}

/* Kampf-Effekte aus G.fx: Der Kern treibt die Lebenszeit t in animate()
 * (negativ = Verzoegerung, das Bild wartet). Hier wird je Eintrag EIN
 * Objekt gebaut und je Bild nachgefuehrt; verschwindet der Eintrag aus
 * G.fx, verschwindet das Objekt. Materialien sind je Effekt eigene
 * (Deckkraft je Instanz) und werden beim Entsorgen freigegeben. */
/* eslint-disable @typescript-eslint/no-explicit-any */
function baueFx(f: any): THREE.Object3D | null {
  if (f.k === 'txt') {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: textTextur(String(f.tx), String(f.col || '#ffffff')),
      transparent: true, depthTest: false,
    }));
    sp.scale.set(1.5, 0.56, 1);
    return sp;
  }
  if (f.k === 'ring') {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 28),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(String(f.col || '#ffffff')),
        transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  if (f.k === 'boom') {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(1, 24),
      new THREE.MeshBasicMaterial({ color: '#ffb43c', transparent: true, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  if (f.k === 'corpse') {
    return new THREE.Mesh(GEO.kasten, new THREE.MeshLambertMaterial({ color: '#2e2a26', transparent: true }));
  }
  return null;
}
function stelleFx(f: any, o: THREE.Object3D, spiegel: boolean, zeilen: number): void {
  const t = Number(f.t) || 0;
  if (t < 0) { o.visible = false; return; }
  o.visible = true;
  const zr = spiegel ? zeilen - 1 - Number(f.r) : Number(f.r);
  const x = Number(f.c) + 0.5, z = zr + 0.5;
  if (f.k === 'txt') {
    o.position.set(x, 0.8 + Math.min(t, 1.2) * 0.7, z);
    (o as THREE.Sprite).material.opacity = Math.max(0, 1 - t * 0.85);
  } else if (f.k === 'ring') {
    const s = 0.25 + Math.min(t / 0.7, 1) * 0.75;
    o.position.set(x, 0.03, z);
    o.scale.set(s, s, s);
    ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 * (1 - t / 0.7));
  } else if (f.k === 'boom') {
    const s = (Number(f.s) || 1) * (0.3 + Math.min(t / 0.5, 1) * 0.9);
    o.position.set(x, 0.04, z);
    o.scale.set(s, s, s);
    ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - t / 0.5));
  } else if (f.k === 'corpse') {
    const dur = Number(f.dur) || 0.55;
    const a = Math.max(0, 1 - t / dur);
    const w = Number(f.w) || 1, h = Number(f.h) || 1;
    const zm = spiegel ? zeilen - (Number(f.r) + h / 2) : Number(f.r) + h / 2;
    o.position.set(Number(f.c) + w / 2, 0.12 * a + 0.005, zm);
    o.scale.set(w * 0.7 * (0.6 + 0.4 * a), 0.24 * a + 0.01, h * 0.7 * (0.6 + 0.4 * a));
    ((o as THREE.Mesh).material as THREE.MeshLambertMaterial).opacity = a;
  }
}
function entsorgeFx(o: THREE.Object3D): void {
  ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose?.();
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Stufenmarken: eine gedrehte Raute je Stufe über dem Objekt (2D: drawPips). */
const GEO_PIP = new THREE.OctahedronGeometry(0.07);

/** Platzhalter je Objektart; der Ritter bekommt das GLB, sobald es da ist. */
function baueObjekt(
  art: string, owner: number, lvl: number, ritter: THREE.Group | null, turm = false,
): THREE.Object3D {
  const gruppe = new THREE.Group();
  if (turm) {
    // Schützenturm auf dem Fels: Die Figur steht erhöht (2D: drawTurm).
    const sockel = kloetzchen(FARBE.stein, 0.66, 0.42, 0.66);
    gruppe.add(sockel);
    const zinne = kloetzchen(FARBE.stein, 0.74, 0.08, 0.74);
    zinne.position.y = 0.42;
    gruppe.add(zinne);
  }
  const spieler = FARBE.spieler[owner] ?? '#ffffff';
  const metall = FARBE.stufe[Math.max(0, Math.min(3, lvl - 1))];
  if (art === 'haus') {
    gruppe.add(kloetzchen(FARBE.wand, 0.72, 0.5, 0.72));
    const dach = kloetzchen(spieler, 0.85, 0.45, 0.85, GEO.kegel);
    dach.position.y = 0.5 + 0.225;
    gruppe.add(dach);
  } else if (art === 'mauer') {
    // Stufenbild wie in der Anforderungsliste: erst Holzpfaehle, dann Stein.
    gruppe.add(kloetzchen(lvl >= 2 ? FARBE.stein : FARBE.holz, 0.86, 0.3 + 0.18 * lvl, 0.86));
  } else if (art === 'werk') {
    gruppe.add(kloetzchen('#8c3a34', 1, 0.42, 1)); // Grundflaeche setzt der Abgleich (w/h)
    const kamin = kloetzchen(FARBE.stein, 0.14, 0.5, 0.14);
    kamin.position.set(0.28, 0.42, 0.22);
    gruppe.add(kamin);
  } else if (art === 'kanone') {
    gruppe.add(kloetzchen(FARBE.stein, 0.6, 0.26, 0.6));
    // Das Rohr sitzt auf einem drehbaren Traeger: e.aim schwenkt ihn, ohne
    // dass die Neigung (Moerser gegen Kanone) verlorengeht.
    const traeger = new THREE.Group();
    traeger.name = 'rohr';
    traeger.position.y = 0.26;
    const rohr = kloetzchen('#bac6d0', 0.16, 0.62, 0.16, GEO.walze);
    rohr.position.y = 0;
    // Stufe 2 ist der Moerser: steiler, kuerzer.
    rohr.rotation.x = lvl >= 2 ? -0.5 : -1.2;
    traeger.add(rohr);
    gruppe.add(traeger);
  } else if (art === 'ritter' && ritter) {
    // clone() teilt Geometrie, Material und Textur — nichts wird dupliziert.
    const figur = ritter.clone();
    figur.scale.setScalar(0.78);
    gruppe.add(figur);
    const ring = kloetzchen(spieler, 0.5, 0.04, 0.5, GEO.walze);
    gruppe.add(ring);
  } else {
    // Truppen-Platzhalter: Rumpf in Spielerfarbe, Kopf in Stufenmetall.
    const gross = art === 'ritter';
    const rumpf = kloetzchen(spieler, gross ? 0.34 : 0.26, gross ? 0.5 : 0.4, gross ? 0.34 : 0.26, GEO.walze);
    gruppe.add(rumpf);
    const kopf = kloetzchen(metall, 0.2, 0.2, 0.2, GEO.kugel);
    kopf.position.y = gross ? 0.6 : 0.5;
    gruppe.add(kopf);
    if (art === 'bogen') {
      const bogen = kloetzchen('#dbe8f1', 0.05, 0.34, 0.05);
      bogen.position.set(0.18, 0.3, 0);
      gruppe.add(bogen);
    }
  }
  // Ein Turm hebt alles, was darauf steht.
  if (turm) for (const kind of gruppe.children.slice(2)) kind.position.y += 0.5;
  // Stufenmarken: je Stufe über der ersten eine Raute im Stufenmetall.
  const marken = Math.max(0, Math.min(3, lvl - 1));
  for (let i = 0; i < marken; i++) {
    const pip = new THREE.Mesh(GEO_PIP, stoff(FARBE.stufe[Math.min(3, lvl - 1)]));
    pip.position.set((i - (marken - 1) / 2) * 0.19,
      (HOEHE[art] ?? 0.9) + (turm ? 0.5 : 0) + 0.16, 0);
    gruppe.add(pip);
  }
  return gruppe;
}

/**
 * Gelaende, das als EIN Stueck je Block steht statt je Feld: Ein Vulkan ist
 * EIN Berg, kein Kegel auf jedem seiner vier Felder — und spaeter ein
 * einziges Modell (docs/ASSETS-FELDHERR-3D.md). Wald und Gebirge bleiben
 * feldweise: Das sind Flaechen aus vielen Einzelstuecken, keine Einzelkoerper.
 */
const BLOCKWEISE = new Set(['vulkan', 'krater', 'see']);

function baueGelaende(art: string, bw = 1, bh = 1): THREE.Object3D {
  const gruppe = new THREE.Group();
  if (art === 'gebirge') {
    const f1 = kloetzchen(FARBE.fels, 0.55, 0.9, 0.5, GEO.kegel);
    f1.position.set(-0.15, 0.45, 0.1);
    const f2 = kloetzchen(FARBE.fels, 0.4, 0.6, 0.38, GEO.kegel);
    f2.position.set(0.22, 0.3, -0.14);
    gruppe.add(f1, f2);
  } else if (art === 'wald') {
    for (const [dx, dz, s] of [[-0.18, 0.12, 0.8], [0.2, -0.1, 1], [0.02, 0.26, 0.65]] as const) {
      const stamm = kloetzchen(FARBE.stamm, 0.08 * s, 0.18 * s, 0.08 * s);
      stamm.position.set(dx, (0.18 * s) / 2, dz);
      const krone = kloetzchen(FARBE.laub, 0.4 * s, 0.55 * s, 0.4 * s, GEO.kegel);
      krone.position.set(dx, 0.18 * s + (0.55 * s) / 2, dz);
      gruppe.add(stamm, krone);
    }
  } else if (art === 'see') {
    // Eine Wasserflaeche fuer den ganzen Block, nicht eine Pfuetze je Feld.
    const wasser = kloetzchen(FARBE.wasser, bw * 0.99, 0.05, bh * 0.99);
    wasser.position.y = 0.025;
    gruppe.add(wasser);
  } else if (art === 'vulkan') {
    // Ein Kegel ueber dem gesamten Block; die Hoehe waechst mit der Grundflaeche.
    const hoch = 0.45 * Math.min(bw, bh) + 0.25;
    gruppe.add(kloetzchen(FARBE.basalt, bw * 0.94, hoch, bh * 0.94, GEO.kegel));
    const glut = kloetzchen(FARBE.lava, Math.min(bw, bh) * 0.3, 0.06, Math.min(bw, bh) * 0.3, GEO.walze);
    glut.position.y = hoch + 0.01;
    gruppe.add(glut);
  } else if (art === 'krater') {
    const senke = kloetzchen('#1d1815', bw * 0.94, 0.16, bh * 0.94, GEO.kegel);
    gruppe.add(senke);
    const glut = kloetzchen('#7a2a18', Math.min(bw, bh) * 0.45, 0.04, Math.min(bw, bh) * 0.45, GEO.walze);
    glut.position.y = 0.17;
    gruppe.add(glut);
  }
  return gruppe;
}

/**
 * Kamera: fast senkrechte Vogelperspektive. Neigung ist die Abweichung von
 * der Senkrechten in Grad — am 7. August 2026 vom Auftraggeber am lebenden
 * Spiel entschieden (Debug-Regler, inzwischen ausgebaut): 10 Grad, Abstand 17.
 *
 * `abstand` ist der gewuenschte Bildausschnitt, aber eine UNTERGRENZE: Auf
 * einem hochkanten Handy ist das Blickfeld waagerecht viel enger als
 * senkrecht (die Brennweite gilt fuer die Hoehe). Bei 375 x 656 waeren mit
 * Abstand 17 nur 7,5 Felder Breite sichtbar — das Brett ist 8 breit, links
 * und rechts fehlte je eine halbe Spalte. Deshalb faehrt die Kamera so weit
 * zurueck, wie das Format es verlangt.
 */
const KAMERA = { neigung: 10, abstand: 17, fov: 42 };
/** Rand in Feldern, der rundum frei bleiben soll. */
const KAMERA_RAND = 0.6;

/** Einmal nach dem Aufbau die Leinwand anstossen. */
function AnstossNachAufbau(): null {
  useEffect(() => {
    // R3F horcht am window; ohne den Anstoss bleibt die Buehne beim ersten
    // Oeffnen leer, bis jemand das Fenster anfasst (siehe CLAUDE.md).
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}

function Szene({
  sitzungRef,
  ritter,
}: {
  sitzungRef: React.RefObject<FeldherrSitzung | null>;
  ritter: THREE.Group | null;
}): React.JSX.Element {
  const objekte = useRef(new THREE.Group());
  const gelaende = useRef(new THREE.Group());
  const effekte = useRef(new THREE.Group());
  const marken = useRef(new THREE.Group());
  const markenVorrat = useRef<THREE.Mesh[]>([]);
  const schilder = useRef(new THREE.Group());
  const schilderVorrat = useRef<{ sprite: THREE.Sprite; text: string; anteil: number }[]>([]);
  const hilfsPunkt = useRef(new THREE.Vector3());
  const geister = useRef(new THREE.Group());
  const geisterLager = useRef(new Map<string, { obj: THREE.Object3D; stoff: THREE.MeshLambertMaterial }>());
  const pfeile = useRef(new THREE.Group());
  const pfeilVorrat = useRef<THREE.Mesh[]>([]);
  const truemmer = useRef(new THREE.Group());
  const truemmerVorrat = useRef<{ kachel: THREE.Mesh; balken: THREE.Sprite }[]>([]);
  const kugeln = useRef(new THREE.Group());
  const kugelVorrat = useRef<THREE.Mesh[]>([]);
  const hellRef = useRef<THREE.InstancedMesh>(null);
  const dunkelRef = useRef<THREE.InstancedMesh>(null);
  const hilfsMatrix = useRef(new THREE.Matrix4());
  const hilfsFarbe = useRef(new THREE.Color());
  const imBild = useRef(new Map<number, {
    obj: THREE.Group; art: string; lvl: number; turm: boolean;
    /** Grundskalierung (Werke sind 1 x 2) — die Setz-Animation multipliziert sie. */
    basis: THREE.Vector3;
    /** Drehbarer Rohrtraeger der Geschuetze, sonst null. */
    rohr: THREE.Object3D | null;
    ueber: ObjektOverlays;
  }>());
  const fxBild = useRef(new Map<object, THREE.Object3D>());
  const gelaendeQuelle = useRef<unknown>(null);

  /**
   * Spielbarkeit in 3D: Die Eingabe laeuft weiter durch den 2D-Pfad des
   * Kerns (die Buehne laesst Zeiger durch), aber die Zellabbildung kommt
   * von HIER — ein Strahl durch die Kamera auf die Brettebene. Ohne diese
   * Umrechnung traefe jeder Zug die Zelle des flachen 2D-Rasters, nicht
   * die, auf die der Finger in der Perspektive zeigt. Der Uebersetzer
   * merkt sich die letzte Zielzelle fuer den Marker im Bild.
   */
  const { camera, gl } = useThree();
  const ziel = useRef<{ x: number; z: number; zeit: number } | null>(null);
  const muenze = useRef<THREE.Mesh>(null);
  const uebersetzer = useRef<((x: number, y: number) => { r: number; c: number } | null) | null>(null);
  const stabil = useRef((x: number, y: number) => uebersetzer.current?.(x, y) ?? null);
  const angemeldet = useRef<FeldherrSitzung | null>(null);
  const marker = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const strahl = new THREE.Raycaster();
    const ebene = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const punkt = new THREE.Vector3();
    uebersetzer.current = (clientX, clientY) => {
      const r = gl.domElement.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      strahl.setFromCamera(
        new THREE.Vector2(
          ((clientX - r.left) / r.width) * 2 - 1,
          -(((clientY - r.top) / r.height) * 2 - 1),
        ),
        camera,
      );
      if (!strahl.ray.intersectPlane(ebene, punkt)) return null;
      const spalte = Math.floor(punkt.x);
      const zeileWelt = Math.floor(punkt.z);
      if (spalte < 0 || spalte >= SPALTEN || zeileWelt < 0 || zeileWelt >= ZEILEN) return null;
      ziel.current = { x: spalte, z: zeileWelt, zeit: performance.now() };
      // Die Szene zeichnet fuer Sitz 0 gespiegelt — die Brettzeile ist die
      // Umkehrung derselben Abbildung, die zVon beim Zeichnen benutzt.
      const spiegel = !!sitzungRef.current?.lesen?.().spiegel;
      return { r: spiegel ? ZEILEN - 1 - zeileWelt : zeileWelt, c: spalte };
    };
    return () => {
      uebersetzer.current = null;
      angemeldet.current?.zeigerAbbildung?.(null);
      angemeldet.current = null;
    };
  }, [camera, gl, sitzungRef]);

  useFrame((drei) => {
    // Uebersetzer an der aktuellen Sitzung anmelden (sie kann wechseln,
    // z. B. beim Neustart); beim Ausschalten der 3D-Ansicht meldet der
    // Effekt oben ihn wieder ab, und der Kern faellt auf 2D zurueck.
    if (sitzungRef.current !== angemeldet.current) {
      angemeldet.current?.zeigerAbbildung?.(null);
      angemeldet.current = sitzungRef.current;
      angemeldet.current?.zeigerAbbildung?.(stabil.current);
    }
    // Ziel-Marker: solange der Zeiger frisch ueber einer Zelle stand,
    // leuchtet sie — beim Kartenziehen sieht man so das Zielfeld.
    if (marker.current) {
      const z = ziel.current;
      const frisch = z && performance.now() - z.zeit < 350;
      marker.current.visible = !!frisch;
      if (frisch && z) marker.current.position.set(z.x + 0.5, 0.02, z.z + 0.5);
    }

    // Zustand einmal je Bild lesen — auch die Kamera braucht ihn schon
    // (Erschuetterung), deshalb steht die Lesung vor allem anderen.
    const sicht: FeldherrLeseblick | undefined = sitzungRef.current?.lesen?.();

    // Fast senkrecht ueber der Arena; die Neigung kippt die Kamera zur
    // eigenen Seite (unten) hin auf. Je Bild gesetzt, damit ein kuenftiger
    // Kameraschwenk (Muenzflug, Sieg) hier einen einzigen Ansatzpunkt hat.
    const n = (KAMERA.neigung * Math.PI) / 180;
    const kam = drei.camera as THREE.PerspectiveCamera;
    const halbFov = Math.tan(((kam.fov || KAMERA.fov) * Math.PI) / 360);
    const seite = kam.aspect || 1;
    // So weit zurueck, dass Brett plus Rand in BEIDE Richtungen passt —
    // der Wunschabstand bleibt die Untergrenze fuer breite Bildschirme.
    const fuerTiefe = (ZEILEN / 2 + KAMERA_RAND) / halbFov;
    const fuerBreite = (SPALTEN / 2 + KAMERA_RAND) / (halbFov * seite);
    const d = Math.max(KAMERA.abstand, fuerTiefe, fuerBreite);
    /* Erschuetterung bei Einschlaegen und Explosionen (2D: shake). Die
     * Staerke kommt in Pixeln des 2D-Renderers; ueber die Zellbreite wird
     * daraus ein Mass in Feldern. Reine Optik — deko(), nie Spielzufall. */
    let bebenX = 0, bebenZ = 0;
    const beben = sicht?.erschuetterung ? sicht.erschuetterung() : null;
    if (beben && beben.rest > 0 && beben.staerke > 0 && sicht?.raster) {
      const ra = sicht.raster();
      if (ra.tw > 0) {
        const stark = (beben.staerke / ra.tw) * Math.min(1, beben.rest * 3);
        bebenX = (Math.random() - 0.5) * stark;
        bebenZ = (Math.random() - 0.5) * stark;
      }
    }
    drei.camera.position.set(
      SPALTEN / 2 + bebenX, d * Math.cos(n), ZEILEN / 2 + d * Math.sin(n) + bebenZ);
    drei.camera.lookAt(SPALTEN / 2 + bebenX, 0, ZEILEN / 2 + bebenZ);

    const blick = sicht;
    const G = blick?.zustand;
    if (!blick || !G) return;
    const spiegel = blick.spiegel;
    const zeilen = G.grid.length;
    const xVon = (c: number, w: number) => c + w / 2;
    const zVon = (r: number, h: number) => (spiegel ? zeilen - (r + h / 2) : r + h / 2);

    // Gelaende steht je Partie fest — einmal bauen, bei neuer Partie neu.
    // Der Vulkan wird beim Ausbruch zum Krater: Dann aendert sich der Typ,
    // ohne dass envs getauscht wird — deshalb faellt auch das in die Probe.
    const gelaendeStempel = G.envs.map((e) => e.type).join('|') + '#' + G.envs.length;
    if (gelaendeQuelle.current !== gelaendeStempel) {
      gelaendeQuelle.current = gelaendeStempel;
      gelaende.current.clear();
      for (const env of G.envs) {
        if (BLOCKWEISE.has(env.type)) {
          // Blockmasse aus den Feldern lesen — cells ist die Wahrheit ueber
          // die Belegung, w/h nur die umschliessende Box.
          let r0 = Infinity, c0 = Infinity, r1 = -Infinity, c1 = -Infinity;
          for (const p of env.cells) {
            r0 = Math.min(r0, p.r); c0 = Math.min(c0, p.c);
            r1 = Math.max(r1, p.r); c1 = Math.max(c1, p.c);
          }
          const bw = c1 - c0 + 1, bh = r1 - r0 + 1;
          const stueck = baueGelaende(env.type, bw, bh);
          stueck.position.set(xVon(c0, bw), 0, zVon(r0, bh));
          // Seen liegen flach im Boden und werfen keinen Schatten.
          if (env.type !== 'see') stueck.traverse((o) => { o.castShadow = true; });
          gelaende.current.add(stueck);
        } else {
          for (const zelle of env.cells) {
            const stueck = baueGelaende(env.type);
            stueck.position.set(xVon(zelle.c, 1), 0, zVon(zelle.r, 1));
            stueck.traverse((o) => { o.castShadow = true; });
            gelaende.current.add(stueck);
          }
        }
      }
    }

    // Objekte abgleichen: neue bauen, bestehende bewegen, verschwundene weg.
    const gesehen = new Set<number>();
    for (const e of G.ents) {
      gesehen.add(e.id);
      let eintrag = imBild.current.get(e.id);
      if (eintrag && (eintrag.art !== e.type || eintrag.lvl !== e.lvl
                      || eintrag.turm !== !!e.turm)) {
        objekte.current.remove(eintrag.obj);
        eintrag = undefined;
      }
      if (!eintrag) {
        const obj = baueObjekt(e.type, e.owner, e.lvl, ritter, !!e.turm) as THREE.Group;
        // Werke sind 1 x 2: Grundflaeche an die echten Masse anpassen.
        const basis = new THREE.Vector3(1, 1, 1);
        if (e.type === 'werk') basis.set((e.w ?? 1) * 0.9, 1, (e.h ?? 1) * 0.9);
        eintrag = {
          obj, art: e.type, lvl: e.lvl, turm: !!e.turm, basis,
          rohr: obj.getObjectByName('rohr') ?? null,
          ueber: baueOverlays(obj, e.type, blick.beweglich(e), blick.kannSchlagen(e),
            !!blick.stellungsStand(e)),
        };
        imBild.current.set(e.id, eintrag);
        objekte.current.add(obj);
        obj.scale.copy(basis);
        obj.position.set(xVon(e.c, e.w ?? 1), 0, zVon(e.r, e.h ?? 1));
        // Truppen blicken zur gegnerischen Haelfte.
        const vor = e.owner === 0 ? 1 : -1;
        obj.rotation.y = (spiegel ? -vor : vor) > 0 ? Math.PI : 0;
        for (const kind of obj.children) kind.castShadow = true;
      }

      /* Marsch wie in 2D (entXY): Solange ein Schritt laeuft, gleitet die
       * Figur mit weicher Beschleunigung vom Ausgangs- aufs Zielfeld. Der
       * Kern fuehrt dafuer mt (Restzeit des Schrittes) sowie fr/fc (woher)
       * — vorher zog die Buehne nur grob nach und lief dem Zustand
       * hinterher. */
      let zeile = e.r, spalte = e.c;
      const mt = e.mt as number | undefined;
      const fr = e.fr as number | undefined;
      const fc = e.fc as number | undefined;
      if (blick.beweglich(e) && mt !== undefined && fr !== undefined && fc !== undefined
          && mt < blick.marschZeit) {
        const k = Math.max(0, Math.min(1, mt / blick.marschZeit));
        const ke = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
        zeile = fr + (e.r - fr) * ke;
        spalte = fc + (e.c - fc) * ke;
      }
      // Kampfanimation wie in 2D: Der Schlag ist ein Ausfallschritt in
      // Angriffsrichtung (e.atk klingt im Kern ab); die Kanone federt
      // stattdessen leicht zurueck.
      let ox = 0, oz = 0;
      const atk = e.atk ?? 0;
      if (atk > 0 && ((e.adx ?? 0) !== 0 || (e.ady ?? 0) !== 0)) {
        const dxA = e.adx ?? 0;
        const dzA = (spiegel ? -1 : 1) * (e.ady ?? 0);
        const len = Math.hypot(dxA, dzA) || 1;
        const schub = e.type === 'kanone' ? -0.1 : 0.22;
        ox = (dxA / len) * schub * atk;
        oz = (dzA / len) * schub * atk;
      }
      // Wackeln bei abgewiesener Handlung (z. B. Stellungen ausgeschoepft).
      const nudge = (e.nudge as number | undefined) ?? 0;
      eintrag.obj.position.set(
        xVon(spalte, e.w ?? 1) + ox,
        nudge > 0 ? 0.10 * Math.sin(nudge * Math.PI) : 0,
        zVon(zeile, e.h ?? 1) + oz,
      );

      /* Setz-Animation: frisch Gebautes ploppt auf (2D: spawnScale). */
      const spawn = (e.spawn as number | undefined) ?? 1;
      const wuchs = spawn >= 1 ? 1
        : 1.08 * Math.sin(spawn * Math.PI * 0.5) + 0.06 * Math.sin(spawn * Math.PI * 1.5) * (1 - spawn);
      eintrag.obj.scale.set(
        eintrag.basis.x * wuchs, eintrag.basis.y * wuchs, eintrag.basis.z * wuchs);

      /* Rohrschwenk: e.aim ist ein Winkel in der Brettebene
       * (atan2(Zeile, Spalte)); im Spiegel dreht die Zeilenrichtung um. */
      if (eintrag.rohr) {
        const aim = e.aim as number | undefined;
        if (aim !== undefined) {
          const dx = Math.cos(aim);
          const dz = (spiegel ? -1 : 1) * Math.sin(aim);
          eintrag.rohr.rotation.y = Math.atan2(dx, dz);
        }
      }

      /* Treffer-Aufleuchten (2D: der helle Schein ueber Getroffenem). */
      const flash = Math.max(0, (e.flash as number | undefined) ?? 0);
      eintrag.ueber.blitz.visible = flash > 0.01;
      (eintrag.ueber.blitz.material as THREE.MeshBasicMaterial).opacity = Math.min(0.55, flash * 0.8);

      /* Laufzeitbalken: Wie lange arbeitet das Werk noch, bevor es auf
       * Sparflamme faellt (2D: drawLaufzeit). */
      const laufMax = blick.laufzeitVon(e);
      const laufRest = (e.leben as number | undefined) ?? 0;
      const zeigtLauf = laufMax > 0;
      eintrag.ueber.laufBg.visible = zeigtLauf;
      eintrag.ueber.laufFill.visible = zeigtLauf && laufRest > 0;
      if (zeigtLauf) {
        const anteilL = Math.max(0, Math.min(1, laufRest / laufMax));
        eintrag.ueber.laufFill.scale.x = Math.max(0.01, 0.76 * anteilL);
        eintrag.ueber.laufFill.material =
          spriteStoff(anteilL > 0.35 ? '#ffa64a' : '#ff6f52', 0.95);
      }

      // Lebensbalken: nur sichtbar, wenn etwas fehlt; Farbe nach Restanteil.
      const max = blick.maxLeben(e) || 1;
      const anteil = Math.max(0, Math.min(1, e.hp / max));
      const zeigen = anteil < 0.999;
      eintrag.ueber.balkenBg.visible = zeigen;
      eintrag.ueber.balkenFill.visible = zeigen;
      if (zeigen) {
        eintrag.ueber.balkenFill.scale.x = Math.max(0.02, 0.72 * anteil);
        eintrag.ueber.balkenFill.material =
          spriteStoff(anteil > 0.55 ? '#7fd8a0' : anteil > 0.28 ? '#f6ca58' : '#ff6f62', 0.95);
      }
      // Aktionsringe wie in 2D: innen Marsch, aussen Schlag. Der Puls beim
      // vollen Ring ist reine Optik und zieht keinen Spielzufall.
      const puls = 0.6 + 0.35 * Math.sin(drei.clock.elapsedTime * 4);
      const steht = !!e.halt || !!e.turm;
      const marsch = eintrag.ueber.marsch;
      if (marsch) {
        const prog = steht ? 1 : Math.max(0, Math.min(1, (e.mtimer ?? 0) / (blick.marschDauer(e) || 1)));
        // Stellung: dickes volles Band in kraeftigem Orange statt Fuellbogen —
        // -2 merkt sich diese Sonderform, damit die Geometrie nicht je Bild
        // neu gesetzt wird.
        const stufe = steht ? -2 : Math.round(prog * RING_STUFEN);
        if (stufe !== eintrag.ueber.marschStufe) {
          eintrag.ueber.marschStufe = stufe;
          marsch.geometry = steht ? GEO_HALT : GEO_MARSCH[stufe];
        }
        marsch.visible = steht || stufe > 0;
        const stoff2 = marsch.material as THREE.MeshBasicMaterial;
        stoff2.color.set(steht ? RING_FARBE.halt : prog >= 1 ? RING_FARBE.marschVoll : RING_FARBE.marsch);
        stoff2.opacity = steht ? 0.9 : prog >= 1 ? 0.55 + 0.3 * puls : 0.85;
      }
      const schlag = eintrag.ueber.schlag;
      if (schlag) {
        const prog = Math.max(0, Math.min(1, (e.timer ?? 0) / (blick.schlagDauer(e) || 1)));
        const stufe = Math.round(prog * RING_STUFEN);
        if (stufe !== eintrag.ueber.schlagStufe) {
          eintrag.ueber.schlagStufe = stufe;
          schlag.geometry = GEO_SCHLAG[stufe];
        }
        schlag.visible = stufe > 0;
        const stoff2 = schlag.material as THREE.MeshBasicMaterial;
        // Steht die Truppe, faerbt sich auch der Schlagring waermer mit —
        // beide Ringe erzaehlen dann dasselbe: diese Truppe haelt Stellung.
        stoff2.color.set(steht ? RING_FARBE.haltSchlag : prog >= 1 ? RING_FARBE.schlagVoll : RING_FARBE.schlag);
        stoff2.opacity = prog >= 1 ? 0.5 + 0.35 * puls : 0.66;
      }
      // Schwebende Stellungszahl "n/max" ueber stehenden Truppen — dieselbe
      // Zahl wie das Stellungsschild in 2D (Gruppe, nicht Einzeltruppe).
      const stand = eintrag.ueber.stand;
      if (stand) {
        const info = steht ? blick.stellungsStand(e) : null;
        stand.visible = !!info;
        if (info) {
          const text = info.n + '/' + info.max;
          if (text !== eintrag.ueber.standText) {
            eintrag.ueber.standText = text;
            stand.material.map = textTextur(text, info.gruppe === 'schuetze' ? '#8ff0cc' : '#ffc09a');
            stand.material.needsUpdate = true;
          }
        }
      }
    }
    for (const [id, eintrag] of imBild.current) {
      if (!gesehen.has(id)) {
        objekte.current.remove(eintrag.obj);
        imBild.current.delete(id);
      }
    }

    // Muenzwurf: Die Uhr ist coin.t aus dem Kern, nicht die Bildzeit — so
    // liegt die Muenze genau dann, wenn coinTick den Aufschlag meldet, und
    // zeigt genau die Seite, die der Kern gewuerfelt hat.
    const mz = muenze.current;
    if (mz) {
      const coin = (G as { coin?: { stufe: string; t: number; ergebnis: string | null } | null }).coin;
      const mitte = { x: Math.floor(SPALTEN / 2) + 0.5, r: Math.floor(ZEILEN / 2) };
      const mz_z = (spiegel ? zeilen - 1 - mitte.r : mitte.r) + 0.5;
      if (!coin || coin.stufe === 'wahl') {
        mz.visible = false;
      } else {
        mz.visible = true;
        const takte = blick.muenze;
        // Zahl liegt oben, wenn die Zahlseite (Materialindex 2, Unterseite)
        // nach oben zeigt — also eine halbe Drehung mehr.
        const endLage = coin.ergebnis === 'zahl' ? Math.PI : 0;
        if (coin.stufe === 'flug') {
          const k = Math.min(1, coin.t / takte.land);
          // Wurfparabel: steigt, faellt, liegt beim Aufschlag genau auf 0.
          const hoehe = MUENZ_HOEHE * Math.sin(Math.PI * k) * (1 - k * 0.15);
          mz.position.set(mitte.x, 0.05 + hoehe, mz_z);
          mz.rotation.x = k * MUENZ_DREHUNGEN * Math.PI + endLage;
          // Nach dem Aufschlag noch ein kurzes Auftrudeln, dann Ruhe.
          if (coin.t > takte.land) {
            const nach = Math.min(1, (coin.t - takte.land) / 0.35);
            mz.rotation.x = endLage;
            mz.position.y = 0.05 + 0.18 * Math.sin(Math.PI * nach) * (1 - nach);
          }
        } else {
          // Anzeige: Die Muenze liegt und wird leicht angehoben gezeigt.
          mz.position.set(mitte.x, 0.06, mz_z);
          mz.rotation.x = endLage;
        }
      }
    }

    /* Truemmerfelder: Wo etwas Brennendes liegt, ist das Feld gesperrt —
     * rote Kachel plus Restzeitbalken (2D: drawSperren, drawSperrBalken).
     * In 3D waren die Felder bisher unsichtbar blockiert. */
    const sperren = (G.sperren ?? []) as readonly { r: number; c: number; t: number; max: number }[];
    for (let i = 0; i < sperren.length; i++) {
      let eintrag = truemmerVorrat.current[i];
      if (!eintrag) {
        const kachel = new THREE.Mesh(GEO_MARKE, new THREE.MeshBasicMaterial({
          color: '#ff6a52', transparent: true, opacity: 0.3, depthWrite: false,
          side: THREE.DoubleSide,
        }));
        kachel.rotation.x = -Math.PI / 2;
        kachel.position.y = 0.014;
        kachel.scale.setScalar(0.9);
        const balken = new THREE.Sprite(spriteStoff('#ff6a52', 0.9));
        balken.center.set(0, 0.5);
        balken.scale.set(0.6, 0.08, 1);
        eintrag = { kachel, balken };
        truemmerVorrat.current[i] = eintrag;
        truemmer.current.add(kachel, balken);
      }
      const z = sperren[i];
      const zr = spiegel ? zeilen - 1 - z.r : z.r;
      eintrag.kachel.visible = true;
      eintrag.kachel.position.set(z.c + 0.5, 0.014, zr + 0.5);
      eintrag.balken.visible = true;
      const rest = Math.max(0, Math.min(1, z.max > 0 ? z.t / z.max : 0));
      eintrag.balken.scale.x = Math.max(0.01, 0.6 * rest);
      eintrag.balken.position.set(z.c + 0.5 - 0.3, 0.5, zr + 0.5);
    }
    for (let i = sperren.length; i < truemmerVorrat.current.length; i++) {
      truemmerVorrat.current[i].kachel.visible = false;
      truemmerVorrat.current[i].balken.visible = false;
    }

    /* Kanonenkugel: Der ball-Effekt traegt Bildschirmkoordinaten des
     * 2D-Renderers (ax/ay nach bx/by). Ueber dasselbe Raster wie die
     * Partikel wird daraus eine Flugbahn mit Wurfbogen. */
    let kugelZahl = 0;
    if (blick.raster) {
      const ra = blick.raster();
      if (ra.tw > 0 && ra.th > 0) {
        for (const f of G.fx as readonly Record<string, number | string>[]) {
          if (f.k !== 'ball') continue;
          const t = Number(f.t) || 0;
          const dur = Number(f.dur) || 0.42;
          if (t < 0) continue;
          const k = Math.max(0, Math.min(1, t / dur));
          let kugel = kugelVorrat.current[kugelZahl];
          if (!kugel) {
            kugel = new THREE.Mesh(GEO.kugel, new THREE.MeshBasicMaterial({ color: '#ffe0b0' }));
            kugel.scale.setScalar(0.2);
            kugelVorrat.current[kugelZahl] = kugel;
            kugeln.current.add(kugel);
          }
          const sp0 = (Number(f.ax) - ra.ox) / ra.tw, ze0 = (Number(f.ay) - ra.oy) / ra.th;
          const sp1 = (Number(f.bx) - ra.ox) / ra.tw, ze1 = (Number(f.by) - ra.oy) / ra.th;
          const sp = sp0 + (sp1 - sp0) * k;
          const ze = ze0 + (ze1 - ze0) * k;
          kugel.visible = true;
          kugel.position.set(sp, 0.35 + 1.5 * Math.sin(Math.PI * k),
            spiegel ? zeilen - ze : ze);
          kugelZahl += 1;
        }
      }
    }
    for (let i = kugelZahl; i < kugelVorrat.current.length; i++) {
      kugelVorrat.current[i].visible = false;
    }

    // Bodenmarken: welche Felder hervorgehoben gehoeren, entscheidet der
    // Kern (feldMarken) — dieselbe Liste zeichnet der 2D-Renderer. Die
    // Meshes liegen in einem Vorrat und werden wiederverwendet; die Liste
    // wechselt je Bild (Karte gewaehlt, Ziehen, Abriss).
    const markenListe3D = blick.feldMarken ? blick.feldMarken() : [];
    const markenPuls = 0.75 + 0.25 * Math.sin(drei.clock.elapsedTime * 3.4);
    for (let i = 0; i < markenListe3D.length; i++) {
      let feld = markenVorrat.current[i];
      if (!feld) {
        feld = new THREE.Mesh(GEO_MARKE, new THREE.MeshBasicMaterial({
          transparent: true, depthWrite: false, side: THREE.DoubleSide,
        }));
        feld.rotation.x = -Math.PI / 2;
        markenVorrat.current[i] = feld;
        marken.current.add(feld);
      }
      const m = markenListe3D[i];
      feld.visible = true;
      feld.position.set(m.c + 0.5, 0.012, (spiegel ? zeilen - 1 - m.r : m.r) + 0.5);
      feld.scale.setScalar(m.ecken ? 0.92 : 0.86);
      const stoff2 = feld.material as THREE.MeshBasicMaterial;
      stoff2.color.set(m.col);
      // Flaechen wirken flach in 3D schwaecher als auf der 2D-Leinwand.
      stoff2.opacity = Math.min(0.9, m.a * (m.ecken ? 2.4 : 1.9) * markenPuls);
    }
    for (let i = markenListe3D.length; i < markenVorrat.current.length; i++) {
      markenVorrat.current[i].visible = false;
    }

    // Bauvorschau: ein durchscheinendes Modell dessen, was gerade gezogen
    // wird, auf dem Zielfeld. Grün heisst setzbar und bezahlbar, Rot heisst
    // hier nicht — dieselbe Aussage wie die Farbe der Bodenmarke darunter.
    const vorschau = blick.bauVorschau ? blick.bauVorschau() : [];
    geister.current.visible = vorschau.length > 0;
    for (const kind of geister.current.children) kind.visible = false;
    for (const v of vorschau) {
      let r0 = Infinity, c0 = Infinity, r1 = -Infinity, c1 = -Infinity;
      for (const p of v.cells) {
        r0 = Math.min(r0, p.r); c0 = Math.min(c0, p.c);
        r1 = Math.max(r1, p.r); c1 = Math.max(c1, p.c);
      }
      const bw = c1 - c0 + 1, bh = r1 - r0 + 1;
      const schluessel = v.art + '|' + v.own + '|' + v.stufe + '|' + bw + 'x' + bh;
      let geist = geisterLager.current.get(schluessel);
      if (!geist) {
        const obj = baueObjekt(v.art, v.own, v.stufe, ritter);
        // EIN durchscheinender Stoff über alle Teile: Das liest sich als
        // Vorschau und nicht als fertiges Bauwerk. Eigener Stoff je Geist —
        // die geteilten Materialien der echten Objekte bleiben unberührt.
        const stoff2 = new THREE.MeshLambertMaterial({
          transparent: true, opacity: 0.55, depthWrite: false,
        });
        obj.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) m.material = stoff2;
        });
        if (v.art === 'werk') obj.scale.set(bw * 0.9, 1, bh * 0.9);
        geist = { obj, stoff: stoff2 };
        geisterLager.current.set(schluessel, geist);
        geister.current.add(obj);
      }
      geist.obj.visible = true;
      geist.stoff.color.set(v.ok ? '#8ef0b8' : '#ff6a52');
      geist.obj.position.set(xVon(c0, bw), 0.01, zVon(r0, bh));
    }

    // Aufwertungspfeil: Fällt die Karte auf ein Objekt, das dadurch
    // aufsteigt, schwebt ein grüner Pfeil darüber (2D: pfeilHoch). Das
    // goldene Glühen darunter liefert bereits die Bodenmarke.
    let pfeilZahl = 0;
    for (const v of vorschau) {
      if (!v.merge || !v.ok) continue;
      let r0 = Infinity, c0 = Infinity, r1 = -Infinity, c1 = -Infinity;
      for (const p of v.cells) {
        r0 = Math.min(r0, p.r); c0 = Math.min(c0, p.c);
        r1 = Math.max(r1, p.r); c1 = Math.max(c1, p.c);
      }
      const bw = c1 - c0 + 1, bh = r1 - r0 + 1;
      let pfeil = pfeilVorrat.current[pfeilZahl];
      if (!pfeil) {
        pfeil = new THREE.Mesh(GEO.kegel, new THREE.MeshBasicMaterial({ color: '#5fe0a8' }));
        pfeil.rotation.x = Math.PI;             // Spitze nach unten
        pfeilVorrat.current[pfeilZahl] = pfeil;
        pfeile.current.add(pfeil);
      }
      pfeil.visible = true;
      pfeil.scale.set(0.42, 0.5, 0.42);
      pfeil.position.set(
        xVon(c0, bw),
        1.5 + 0.12 * Math.sin(drei.clock.elapsedTime * 5),   // sanftes Wippen
        zVon(r0, bh),
      );
      pfeilZahl += 1;
    }
    for (let i = pfeilZahl; i < pfeilVorrat.current.length; i++) {
      pfeilVorrat.current[i].visible = false;
    }

    // Partikel: Rauch, Funken, Staub, Splitter, Glut. Positionen kommen in
    // Bildschirmkoordinaten des 2D-Renderers und werden über sein Raster
    // in Brettmasse zurückgerechnet.
    const hell = hellRef.current, dunkel = dunkelRef.current;
    if (hell && dunkel && blick.partikel && blick.raster) {
      const ra = blick.raster();
      let nh = 0, nd = 0;
      if (ra.tw > 0 && ra.th > 0) {
        for (const p of blick.partikel) {
          const k = Math.max(0, Math.min(1, p.life / p.max));
          const a = 1 - k * k;                    // wie drawPT
          const spalte = (p.x - ra.ox) / ra.tw;
          const zeileWelt = (p.y - ra.oy) / ra.th;
          const z = spiegel ? zeilen - zeileWelt : zeileWelt;
          const hoehe = p.z / ra.th;
          const gross = p.r / ra.tw;
          if (p.kind === 'rock') {
            if (nd >= PARTIKEL_MAX) continue;
            // Splitter verblassen über die Größe — additiv wären sie unsichtbar.
            const s = gross * 2 * a;
            hilfsMatrix.current.makeScale(s, s, s);
            hilfsMatrix.current.setPosition(spalte, hoehe + s / 2, z);
            dunkel.setMatrixAt(nd, hilfsMatrix.current);
            const f = PT_FARBE.rock;
            dunkel.setColorAt(nd, hilfsFarbe.current.setRGB(f[0], f[1], f[2]));
            nd += 1;
          } else {
            if (nh >= PARTIKEL_MAX) continue;
            let f: [number, number, number];
            let staerke = a;
            if (p.kind === 'smoke') { f = PT_FARBE.smoke; staerke = a * 0.35; }
            else if (p.kind === 'ember') f = k < 0.5 ? PT_FARBE.emberJung : PT_FARBE.emberAlt;
            else f = PT_FARBE.funke;
            const schrumpf = p.kind === 'smoke' ? 1 : p.kind === 'ember' ? 1 - k * 0.4 : 1 - k * 0.5;
            const s = gross * 2 * schrumpf;
            hilfsMatrix.current.makeScale(s, s, s);
            hilfsMatrix.current.setPosition(spalte, hoehe + s / 2, z);
            hell.setMatrixAt(nh, hilfsMatrix.current);
            hell.setColorAt(nh, hilfsFarbe.current.setRGB(
              f[0] * staerke, f[1] * staerke, f[2] * staerke));
            nh += 1;
          }
        }
      }
      hell.count = nh;
      dunkel.count = nd;
      hell.instanceMatrix.needsUpdate = true;
      dunkel.instanceMatrix.needsUpdate = true;
      if (hell.instanceColor) hell.instanceColor.needsUpdate = true;
      if (dunkel.instanceColor) dunkel.instanceColor.needsUpdate = true;
    }

    // Hinweisschilder (Reichweitengewinn, Erdwärme, Walddeckung, Preis) —
    // welche Ansage auf welchem Feld steht, entscheidet der Kern.
    const schilderListe = blick.schilder ? blick.schilder() : [];
    for (let i = 0; i < schilderListe.length; i++) {
      let eintrag = schilderVorrat.current[i];
      if (!eintrag) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
        eintrag = { sprite, text: '', anteil: 1 };
        schilderVorrat.current[i] = eintrag;
        schilder.current.add(sprite);
      }
      const s = schilderListe[i];
      const sp = eintrag.sprite;
      // Zonenschilder blenden mit der Nähe des Fingers ein (a aus dem Kern).
      const sicht = s.a === undefined ? 1 : s.a;
      sp.visible = sicht > 0.01;
      sp.material.opacity = sicht;
      const schluessel = s.tx + '/' + s.col;
      if (schluessel !== eintrag.text) {
        eintrag.text = schluessel;
        sp.material.map = textTextur(s.tx, s.col, true);
        sp.material.needsUpdate = true;
        eintrag.anteil = tafelAnteil.get(schluessel + '/tafel') ?? 1;
      }
      // Alle Schilder gleich gross — die Tafel in der Textur passt sich dem
      // Text an, der freie Rand ist durchsichtig. Nur so wirkt die Schrift
      // ueberall gleich gross.
      sp.scale.set(3.9, 3.9 * (200 / 1024), 1);
      /* Aus der Vogelperspektive traegt Hoehe kaum, also wird die
       * Staffelung in die Tiefe verlegt — und zwar VOM Betrachter WEG
       * (-z), damit das Schild ueber dem Feld steht. Der Finger kommt beim
       * Ziehen von unten ins Bild; ein Schild unterhalb des Feldes laege
       * genau unter der Hand und waere nie zu lesen. Das entspricht auch
       * 2D, wo schild() nach oben versetzt. Der Abstand haelt zugleich
       * mehrere Schilder auseinander (Stufe unter Reichweitengewinn). */
      sp.position.set(s.c + 0.5, s.h * 0.5 + 0.4,
        (spiegel ? zeilen - 1 - s.r : s.r) + 0.5 - s.h * 0.55);

      /* Randschutz: Ein Schild am Brettrand liefe sonst aus dem Bild — in
       * 2D faengt schild() das mit einer Klemme in Bildschirmkoordinaten
       * ab, hier ist das Aequivalent der Weg ueber die Bildebene: Punkt
       * projizieren, in den sichtbaren Bereich klemmen, zurueckrechnen.
       * Gerechnet wird mit der ECHTEN Tafelbreite (anteil), nicht mit der
       * Sprite-Breite — der Rest der Textur ist durchsichtig. */
      const kam2 = drei.camera as THREE.PerspectiveCamera;
      const abstand = kam2.position.distanceTo(sp.position);
      const sichtHoehe = 2 * abstand * Math.tan((kam2.fov * Math.PI) / 360);
      const sichtBreite = sichtHoehe * kam2.aspect;
      // Halbe Ausdehnung in Bildkoordinaten (NDC spannt 2 ueber das Bild),
      // plus etwas Luft — ohne sie klebt das Schild sichtbar am Rand,
      // auch wenn es rechnerisch gerade noch hineinpasst.
      const LUFT = 0.04;
      const randX = (sp.scale.x * eintrag.anteil) / sichtBreite + LUFT;
      const randY = sp.scale.y / sichtHoehe + LUFT;
      const p = hilfsPunkt.current.copy(sp.position).project(kam2);
      // Passt das Schild ueberhaupt ins Bild? Sonst in die Mitte ruecken.
      p.x = randX < 0.98 ? Math.max(-1 + randX, Math.min(1 - randX, p.x)) : 0;
      p.y = randY < 0.98 ? Math.max(-1 + randY, Math.min(1 - randY, p.y)) : 0;
      p.unproject(kam2);
      sp.position.copy(p);
    }
    for (let i = schilderListe.length; i < schilderVorrat.current.length; i++) {
      schilderVorrat.current[i].sprite.visible = false;
    }

    // Kampf-Effekte aus G.fx spiegeln (Schadenszahlen, Ringe, Explosionen,
    // Leichen) — die Lebenszeit t treibt der Kern, hier wird nur gestellt.
    const fxLebend = new Set<object>();
    for (const f of G.fx as readonly object[]) {
      const art = (f as { k?: string }).k;
      if (art !== 'txt' && art !== 'ring' && art !== 'boom' && art !== 'corpse') continue;
      fxLebend.add(f);
      let o = fxBild.current.get(f);
      if (!o) {
        const neu = baueFx(f);
        if (!neu) continue;
        o = neu;
        effekte.current.add(o);
        fxBild.current.set(f, o);
      }
      stelleFx(f, o, spiegel, zeilen);
    }
    for (const [f, o] of fxBild.current) {
      if (!fxLebend.has(f)) {
        effekte.current.remove(o);
        entsorgeFx(o);
        fxBild.current.delete(f);
      }
    }
  });

  return (
    <>
      {/**
       * Licht in drei Schichten, wie es das 2D-Bild nachahmt:
       *
       *  - Himmelslicht faellt von oben und faerbt Schattenseiten kuehl
       *    ein, statt sie schwarz absaufen zu lassen. Es ersetzt einen
       *    Teil des flachen Umgebungslichts.
       *  - Die Sonne steht links oben (wie F.n/F.w im 2D-Lichtmodell) und
       *    ist die EINZIGE Quelle, die Schatten wirft — mehrere
       *    Schattenwerfer kosten je einen Durchgang und bringen bei dieser
       *    Draufsicht kaum etwas.
       *  - Ein schwaches Gegenlicht von rechts unten setzt Kanten ab,
       *    damit Figuren sich vom Boden loesen.
       */}
      <hemisphereLight args={['#9fc8e8', '#2a3a2c', 0.75]} />
      <ambientLight intensity={0.28} />
      <directionalLight
        position={[-7, 13, -3]}
        intensity={1.35}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0012}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[6, 5, 9]} intensity={0.35} color="#cfe3ff" />
      <group>
        {/* Erdsockel und Brettplatte */}
        <mesh position={[SPALTEN / 2, -0.25, ZEILEN / 2]} receiveShadow>
          <boxGeometry args={[SPALTEN + 0.3, 0.5, ZEILEN + 0.3]} />
          <meshLambertMaterial color={FARBE.erde} />
        </mesh>
        {/**
         * Der Rasen ist EIN Feld, das die Schatten aufnimmt; die Kacheln
         * darueber sind nur noch Farbe. Ein Schattenempfaenger statt
         * sechsundneunzig spart Rechenzeit und vermeidet Nahtartefakte an
         * den Kachelraendern.
         */}
        <mesh position={[SPALTEN / 2, 0.0005, ZEILEN / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[SPALTEN, ZEILEN]} />
          <meshLambertMaterial color={FARBE.grasAlt} />
        </mesh>
        {/* Felder als Schachbrett der beiden Grasfarben */}
        {Array.from({ length: ZEILEN * SPALTEN }, (_, i) => {
          const r = Math.floor(i / SPALTEN);
          const c = i % SPALTEN;
          if ((r + c) % 2 === 0) return null;      // nur jede zweite Kachel faerbt
          return (
            <mesh key={i} position={[c + 0.5, 0.0015, r + 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial color={FARBE.gras} transparent opacity={0.5} />
            </mesh>
          );
        })}
        {/* Mittellinie */}
        <mesh position={[SPALTEN / 2, 0.01, ZEILEN / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[SPALTEN, 0.06]} />
          <meshBasicMaterial color="#dfd6c2" transparent opacity={0.55} />
        </mesh>
        <primitive object={gelaende.current} />
        <primitive object={marken.current} />
        <primitive object={truemmer.current} />
        <primitive object={objekte.current} />
        <primitive object={geister.current} />
        <primitive object={pfeile.current} />
        <primitive object={kugeln.current} />
        <primitive object={effekte.current} />
        {/* Partikel: zwei Schwaerme, je ein Zeichenaufruf. count wird je
            Bild gesetzt; frisch angelegt zeigen sie nichts. */}
        <instancedMesh
          ref={hellRef}
          args={[GEO_PARTIKEL, undefined, PARTIKEL_MAX]}
          count={0}
          frustumCulled={false}
        >
          <meshBasicMaterial blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </instancedMesh>
        <instancedMesh
          ref={dunkelRef}
          args={[GEO_PARTIKEL, undefined, PARTIKEL_MAX]}
          count={0}
          frustumCulled={false}
        >
          <meshLambertMaterial />
        </instancedMesh>
        <primitive object={schilder.current} />
        {/* Zielfeld-Marker unter dem Zeiger */}
        <mesh ref={marker} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.94, 0.94]} />
          <meshBasicMaterial color="#dff2ff" transparent opacity={0.38} />
        </mesh>
        {/* Muenze des Rundenanfangs */}
        <mesh ref={muenze} visible={false} geometry={GEO_MUENZE} material={STOFF_MUENZE} />
      </group>
      <AnstossNachAufbau />
    </>
  );
}

/**
 * Legt die 3D-Ansicht ueber das #stage-Element des Kerns. Zeigerereignisse
 * laufen durch — bedient wird der 2D-Pfad, das HUD bleibt sichtbar.
 */
export function Buehne3D({
  sitzungRef,
}: {
  sitzungRef: React.RefObject<FeldherrSitzung | null>;
}): React.JSX.Element | null {
  const [rechteck, setRechteck] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [ritter, setRitter] = useState<THREE.Group | null>(null);
  /**
   * Anzeigefenster zum Muenzwurf. In 3D deckt die Buehne das Spielfeld ab,
   * also auch die Muenz-Meldung des 2D-Renderers — hier steht sie als
   * eigenes Fenster. Bewusst NICHT je Bild aktualisiert: Ein Takt von
   * 120 ms genuegt fuer Text und haelt den Szenenbaum ruhig.
   */
  const [muenzText, setMuenzText] = useState<{ titel: string; zeile: string } | null>(null);
  useEffect(() => {
    const namen = (sitz: number | null, eigen: number | null, duWort: string, erWort: string) => {
      if (sitz === null) return '';
      if (eigen === null) return 'Spieler ' + (sitz + 1);
      return sitz === eigen ? duWort : erWort;
    };
    const takt = window.setInterval(() => {
      const blick = sitzungRef.current?.lesen?.();
      const coin = blick?.zustand?.coin as
        | { stufe: string; waehler: number; ergebnis: string | null; sieger: number | null }
        | null
        | undefined;
      if (!coin) { setMuenzText((alt) => (alt ? null : alt)); return; }
      const eigen = blick?.eigenerSitz ?? null;
      let neu: { titel: string; zeile: string };
      if (coin.stufe === 'wahl') {
        const wer = namen(coin.waehler, eigen, 'Du wählst', 'Der Gegner wählt');
        neu = { titel: 'Münzwurf', zeile: eigen === null ? wer + ' wählt' : wer };
      } else if (coin.stufe === 'flug') {
        neu = { titel: 'Münzwurf', zeile: 'Die Münze fliegt …' };
      } else {
        const wer = namen(coin.sieger, eigen, 'Du setzt zuerst', 'Der Gegner setzt zuerst');
        neu = {
          titel: coin.ergebnis === 'zahl' ? 'Zahl' : 'Kopf',
          zeile: eigen === null ? wer + ' setzt zuerst' : wer,
        };
      }
      setMuenzText((alt) =>
        alt && alt.titel === neu.titel && alt.zeile === neu.zeile ? alt : neu);
    }, 120);
    return () => window.clearInterval(takt);
  }, [sitzungRef]);

  useEffect(() => {
    const stage = document.getElementById('stage');
    if (!stage) return;
    const messen = () => {
      const b = stage.getBoundingClientRect();
      setRechteck({ left: b.left, top: b.top, width: b.width, height: b.height });
    };
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(stage);
    window.addEventListener('resize', messen);
    return () => {
      beobachter.disconnect();
      window.removeEventListener('resize', messen);
    };
  }, []);

  useEffect(() => {
    // GLTF laedt ausserhalb des Canvas — nichts Anhaltendes in der Leinwand.
    let lebt = true;
    new GLTFLoader().load(
      '/3d/feldherr/ritter.glb',
      (gltf) => {
        if (lebt) setRitter(gltf.scene);
      },
      undefined,
      () => {
        /* Ohne Modell bleibt der Platzhalter stehen — kein Fehlerfall. */
      },
    );
    return () => {
      lebt = false;
    };
  }, []);

  if (!rechteck || rechteck.width < 40) return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: rechteck.left,
        top: rechteck.top,
        width: rechteck.width,
        height: rechteck.height,
        zIndex: 10,
        pointerEvents: 'none',
        background: '#05080b',
      }}
    >
      {/* preserveDrawingBuffer: macht toDataURL()-Bildproben moeglich —
          die Sichtpruefungen der Umbau-Sitzungen lesen das Bild headless aus. */}
      {/**
       * pointerEvents MUSS hier und auf der Leinwand selbst stehen:
       * React-Three-Fiber setzt auf seinem Container `pointer-events: auto`
       * und ueberstimmt damit das `none` der aeusseren Huelle. Dadurch
       * schluckte die 3D-Leinwand jeden Tipp aufs Brett — das Haupthaus
       * liess sich in 3D nicht setzen, Halt und Abriss blieben tot
       * (Karten-Drags liefen weiter, weil deren Horcher am window haengen).
       * Diese Ansicht braucht keine eigenen Zeigerereignisse: Sie rechnet
       * die Zelle selbst aus dem Strahl (zeigerAbbildung), und bedient wird
       * der 2D-Pfad darunter.
       */}
      <Canvas
        style={{ pointerEvents: 'none' }}
        shadows="soft"
        gl={{ preserveDrawingBuffer: true }}
        camera={{ position: [SPALTEN / 2, KAMERA.abstand, ZEILEN / 2 + 2], fov: 42 }}
        onCreated={({ gl: renderer }) => {
          renderer.domElement.style.pointerEvents = 'none';
        }}
      >
        <Szene sitzungRef={sitzungRef} ritter={ritter} />
      </Canvas>
      {muenzText && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '8%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            pointerEvents: 'none',
            padding: '10px 18px',
            borderRadius: 12,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            background: 'rgba(12,20,26,.92)',
            boxShadow: '0 0 0 1px #2a3b46, 0 10px 24px -12px #000',
            color: '#dfd6c2',
          }}
        >
          <div style={{ font: '900 22px/1.1 system-ui', letterSpacing: '-.02em', color: '#ffd977' }}>
            {muenzText.titel}
          </div>
          <div style={{ font: '600 12px/1.4 system-ui', color: '#93a7b3', marginTop: 2 }}>
            {muenzText.zeile}
          </div>
        </div>
      )}
    </div>
  );
}
