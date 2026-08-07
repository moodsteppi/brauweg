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

/** Bereitschaftsring in 25 Fuellstufen — Geometrien werden geteilt. */
const RING_STUFEN = 24;
const ringGeos: THREE.RingGeometry[] = [];
for (let i = 0; i <= RING_STUFEN; i++) {
  ringGeos.push(new THREE.RingGeometry(0.34, 0.42, 24, 1, Math.PI / 2, Math.max(0.001, (i / RING_STUFEN) * Math.PI * 2)));
}

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
function textTextur(text: string, farbe: string): THREE.Texture {
  const key = text + '/' + farbe;
  let t = textLager.get(key);
  if (!t) {
    const leinwand = document.createElement('canvas');
    leinwand.width = 256; leinwand.height = 96;
    const z = leinwand.getContext('2d')!;
    z.font = '800 56px system-ui, sans-serif';
    z.textAlign = 'center'; z.textBaseline = 'middle';
    z.lineWidth = 8; z.strokeStyle = 'rgba(6,10,14,.85)';
    z.strokeText(text, 128, 48);
    z.fillStyle = farbe;
    z.fillText(text, 128, 48);
    t = new THREE.CanvasTexture(leinwand);
    textLager.set(key, t);
  }
  return t;
}

interface ObjektOverlays {
  balkenBg: THREE.Sprite;
  balkenFill: THREE.Sprite;
  ring: THREE.Mesh | null;
  ringStufe: number;
}
function baueOverlays(gruppe: THREE.Group, art: string, laeuft: boolean): ObjektOverlays {
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
  let ring: THREE.Mesh | null = null;
  if (laeuft) {
    ring = new THREE.Mesh(ringGeos[0], new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    gruppe.add(ring);
  }
  return { balkenBg, balkenFill, ring, ringStufe: -1 };
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

/** Platzhalter je Objektart; der Ritter bekommt das GLB, sobald es da ist. */
function baueObjekt(art: string, owner: number, lvl: number, ritter: THREE.Group | null): THREE.Object3D {
  const gruppe = new THREE.Group();
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
    const rohr = kloetzchen('#bac6d0', 0.16, 0.62, 0.16, GEO.walze);
    rohr.position.y = 0.26;
    // Stufe 2 ist der Moerser: steiler, kuerzer.
    rohr.rotation.x = lvl >= 2 ? -0.5 : -1.2;
    gruppe.add(rohr);
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
  return gruppe;
}

function baueGelaende(art: string): THREE.Object3D {
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
    const wasser = kloetzchen(FARBE.wasser, 0.98, 0.05, 0.98);
    wasser.position.y = 0.025;
    gruppe.add(wasser);
  } else if (art === 'vulkan' || art === 'krater') {
    const kegel = kloetzchen(art === 'vulkan' ? FARBE.basalt : '#1d1815', 0.9, art === 'vulkan' ? 0.7 : 0.2, 0.9, GEO.kegel);
    gruppe.add(kegel);
    if (art === 'vulkan') {
      const glut = kloetzchen(FARBE.lava, 0.3, 0.06, 0.3, GEO.walze);
      glut.position.y = 0.71;
      gruppe.add(glut);
    }
  }
  return gruppe;
}

/**
 * Kamera: fast senkrechte Vogelperspektive. Neigung ist die Abweichung von
 * der Senkrechten in Grad — am 7. August 2026 vom Auftraggeber am lebenden
 * Spiel entschieden (Debug-Regler, inzwischen ausgebaut): 10 Grad, Abstand 17.
 */
const KAMERA = { neigung: 10, abstand: 17 };

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
  const imBild = useRef(new Map<number, {
    obj: THREE.Group; art: string; lvl: number;
    ueber: ObjektOverlays; bx: number; bz: number;
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

    // Fast senkrecht ueber der Arena; die Neigung kippt die Kamera zur
    // eigenen Seite (unten) hin auf. Je Bild gesetzt, damit ein kuenftiger
    // Kameraschwenk (Muenzflug, Sieg) hier einen einzigen Ansatzpunkt hat.
    const n = (KAMERA.neigung * Math.PI) / 180;
    const d = KAMERA.abstand;
    drei.camera.position.set(SPALTEN / 2, d * Math.cos(n), ZEILEN / 2 + d * Math.sin(n));
    drei.camera.lookAt(SPALTEN / 2, 0, ZEILEN / 2);

    const blick: FeldherrLeseblick | undefined = sitzungRef.current?.lesen?.();
    const G = blick?.zustand;
    if (!blick || !G) return;
    const spiegel = blick.spiegel;
    const zeilen = G.grid.length;
    const xVon = (c: number, w: number) => c + w / 2;
    const zVon = (r: number, h: number) => (spiegel ? zeilen - (r + h / 2) : r + h / 2);

    // Gelaende steht je Partie fest — einmal bauen, bei neuer Partie neu.
    if (gelaendeQuelle.current !== G.envs) {
      gelaendeQuelle.current = G.envs;
      gelaende.current.clear();
      for (const env of G.envs) {
        for (const zelle of env.cells) {
          const stueck = baueGelaende(env.type);
          stueck.position.set(xVon(zelle.c, 1), 0, zVon(zelle.r, 1));
          gelaende.current.add(stueck);
        }
      }
    }

    // Objekte abgleichen: neue bauen, bestehende bewegen, verschwundene weg.
    const gesehen = new Set<number>();
    for (const e of G.ents) {
      gesehen.add(e.id);
      let eintrag = imBild.current.get(e.id);
      if (eintrag && (eintrag.art !== e.type || eintrag.lvl !== e.lvl)) {
        objekte.current.remove(eintrag.obj);
        eintrag = undefined;
      }
      if (!eintrag) {
        const obj = baueObjekt(e.type, e.owner, e.lvl, ritter) as THREE.Group;
        const zielX = xVon(e.c, e.w ?? 1);
        const zielZ = zVon(e.r, e.h ?? 1);
        eintrag = {
          obj, art: e.type, lvl: e.lvl,
          ueber: baueOverlays(obj, e.type, blick.beweglich(e)),
          bx: zielX, bz: zielZ,
        };
        imBild.current.set(e.id, eintrag);
        objekte.current.add(obj);
        // Werke sind 1 x 2: Grundflaeche an die echten Masse anpassen.
        if (e.type === 'werk') obj.scale.set((e.w ?? 1) * 0.9, 1, (e.h ?? 1) * 0.9);
        obj.position.set(zielX, 0, zielZ);
        // Truppen blicken zur gegnerischen Haelfte.
        const vor = e.owner === 0 ? 1 : -1;
        obj.rotation.y = (spiegel ? -vor : vor) > 0 ? Math.PI : 0;
      }
      // Weiches Nachziehen: Die Simulation springt feldweise; das Bild
      // gleitet hinterher. Reine Optik, der Zustand bleibt unberuehrt.
      eintrag.bx += (xVon(e.c, e.w ?? 1) - eintrag.bx) * 0.25;
      eintrag.bz += (zVon(e.r, e.h ?? 1) - eintrag.bz) * 0.25;
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
      eintrag.obj.position.set(eintrag.bx + ox, 0, eintrag.bz + oz);

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
      // Bereitschaftsring: fuellt sich bis zum naechsten Zug; Halt = voll
      // und orange (die Truppe steht bewusst).
      const ring = eintrag.ueber.ring;
      if (ring) {
        const dauer = blick.marschDauer(e) || 1;
        const prog = e.halt ? 1 : Math.max(0, Math.min(1, (e.mtimer ?? 0) / dauer));
        const stufe = Math.round(prog * RING_STUFEN);
        if (stufe !== eintrag.ueber.ringStufe) {
          eintrag.ueber.ringStufe = stufe;
          ring.geometry = ringGeos[stufe];
        }
        ring.visible = stufe > 0;
        (ring.material as THREE.MeshBasicMaterial).color.set(
          e.halt ? '#ffa06e' : FARBE.spieler[e.owner] ?? '#ffffff');
      }
    }
    for (const [id, eintrag] of imBild.current) {
      if (!gesehen.has(id)) {
        objekte.current.remove(eintrag.obj);
        imBild.current.delete(id);
      }
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
      <ambientLight intensity={0.85} />
      {/* Sonne links oben, wie das Lichtmodell des 2D-Renderers. */}
      <directionalLight position={[-4, 9, 2]} intensity={1.4} />
      <group>
        {/* Erdsockel und Brettplatte */}
        <mesh position={[SPALTEN / 2, -0.25, ZEILEN / 2]}>
          <boxGeometry args={[SPALTEN + 0.3, 0.5, ZEILEN + 0.3]} />
          <meshLambertMaterial color={FARBE.erde} />
        </mesh>
        {/* Felder als Schachbrett der beiden Grasfarben */}
        {Array.from({ length: ZEILEN * SPALTEN }, (_, i) => {
          const r = Math.floor(i / SPALTEN);
          const c = i % SPALTEN;
          return (
            <mesh key={i} position={[c + 0.5, 0.001, r + 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.98, 0.98]} />
              <meshLambertMaterial color={(r + c) % 2 ? FARBE.gras : FARBE.grasAlt} />
            </mesh>
          );
        })}
        {/* Mittellinie */}
        <mesh position={[SPALTEN / 2, 0.01, ZEILEN / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[SPALTEN, 0.06]} />
          <meshBasicMaterial color="#dfd6c2" transparent opacity={0.55} />
        </mesh>
        <primitive object={gelaende.current} />
        <primitive object={objekte.current} />
        <primitive object={effekte.current} />
        {/* Zielfeld-Marker unter dem Zeiger */}
        <mesh ref={marker} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.94, 0.94]} />
          <meshBasicMaterial color="#dff2ff" transparent opacity={0.38} />
        </mesh>
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
      <Canvas
        gl={{ preserveDrawingBuffer: true }}
        camera={{ position: [SPALTEN / 2, KAMERA.abstand, ZEILEN / 2 + 2], fov: 42 }}
      >
        <Szene sitzungRef={sitzungRef} ritter={ritter} />
      </Canvas>
    </div>
  );
}
