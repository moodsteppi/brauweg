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
  const imBild = useRef(new Map<number, { obj: THREE.Object3D; art: string; lvl: number }>());
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
        const obj = baueObjekt(e.type, e.owner, e.lvl, ritter);
        eintrag = { obj, art: e.type, lvl: e.lvl };
        imBild.current.set(e.id, eintrag);
        objekte.current.add(obj);
        // Werke sind 1 x 2: Grundflaeche an die echten Masse anpassen.
        if (e.type === 'werk') obj.scale.set((e.w ?? 1) * 0.9, 1, (e.h ?? 1) * 0.9);
        obj.position.set(xVon(e.c, e.w ?? 1), 0, zVon(e.r, e.h ?? 1));
        // Truppen blicken zur gegnerischen Haelfte.
        const vor = e.owner === 0 ? 1 : -1;
        obj.rotation.y = (spiegel ? -vor : vor) > 0 ? Math.PI : 0;
      }
      // Weiches Nachziehen: Die Simulation springt feldweise; das Bild
      // gleitet hinterher. Reine Optik, der Zustand bleibt unberuehrt.
      const zielX = xVon(e.c, e.w ?? 1);
      const zielZ = zVon(e.r, e.h ?? 1);
      eintrag.obj.position.x += (zielX - eintrag.obj.position.x) * 0.25;
      eintrag.obj.position.z += (zielZ - eintrag.obj.position.z) * 0.25;
    }
    for (const [id, eintrag] of imBild.current) {
      if (!gesehen.has(id)) {
        objekte.current.remove(eintrag.obj);
        imBild.current.delete(id);
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
