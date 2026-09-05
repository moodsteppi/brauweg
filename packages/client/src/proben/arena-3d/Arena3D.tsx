/**
 * Arena-Probe B: dieselbe Szene in 3D (Three.js).
 *
 * Erreichbar unter `/probe/arena-3d`. Nirgends im Spiel verlinkt und ohne
 * Anmeldung — das laufende Spiel bleibt unberuehrt. Das Gegenstueck ist
 * Probe A, die DIESELBE Aufzeichnung (`arena-szene.json`) in 2D abspielt.
 *
 * WAS HIER ENTSCHIEDEN WERDEN SOLL: nicht, ob 3D huebscher ist, sondern ob es
 * bezahlbar ist. Deshalb steht die Messung mit auf dem Bild (Bundle, Ladezeit,
 * Bilder je Sekunde) und nicht nur in einem Bericht — wer die Probe auf seinem
 * eigenen Geraet oeffnet, sieht seine eigenen Zahlen.
 *
 * WARUM ALLES NACHGELADEN WIRD: `three` wiegt mit `@react-three/fiber` rund
 * 900 kB. Die Einstiegsstelle in `main.tsx` holt dieses Blatt deshalb ueber
 * `lazy()`; Vite legt daraus ein eigenes Stueck, das nur bekommt, wer die
 * Probe oeffnet. Ein gewoehnlicher Import haette es jedem Spieler mitgegeben,
 * fuer eine Probe, die nicht einmal verlinkt ist.
 *
 * WARUM DIE MODELLE VOR DER LEINWAND GELADEN WERDEN: siehe CLAUDE.md — im
 * Runner hat `useTexture` nie aufgeloest, obwohl alle Dateien mit 200
 * antworteten, und die aeussere Suspense hat die ganze Leinwand abgehaengt.
 * Uebrig blieb ein Dauerladetext ohne Fehler. Hier laedt ein gewoehnlicher
 * Effekt mit sichtbarem Fortschritt und sichtbarer Fehlermeldung, und die
 * `<Canvas>` entsteht erst, wenn alles da ist.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { Arena3DBuehne, type Modell } from './Buehne';
import { BERICHT, baueSpuren, dauerMs } from './ablauf';
import stil from './Arena3D.module.css';

/** Wo die Figuren liegen. Eine Datei je Rolle, siehe modelle-bauen.mjs. */
const ROLLEN = ['wache', 'schuetze', 'magier', 'meuchler', 'beistand'] as const;
const MODELLPFAD = (rolle: string): string => `/proben/arena-3d/${rolle}.glb`;
const HOLZPFAD = '/tafelrunde/untergrund-holz.webp';

interface Messung {
  /** Millisekunden vom Oeffnen des Blatts bis zum ersten gezeichneten Bild. */
  bisErstesBild: number | null;
  /** Summe der geladenen GLB-Dateien in Byte. */
  modellBytes: number;
  bilderJeSekunde: number;
  /** Kleinste Bildrate ueber ein Zehntel der Zeit — der Ruckler, nicht der Schnitt. */
  schlechtestes: number;
}

export function Arena3D(): React.JSX.Element {
  /**
   * Der Nullpunkt der Ladezeit.
   *
   * Bewusst beim ERSTEN Auswerten des Moduls und nicht im Effekt: Zwischen
   * "Blatt geoeffnet" und "erster Effekt gelaufen" liegt das Nachladen des
   * three-Stuecks, und genau das soll mitgemessen werden. Im Effekt gesetzt
   * waere die Zahl geschmeichelt.
   */
  const begonnen = useRef(performance.now());

  const [modelle, setModelle] = useState<ReadonlyMap<string, Modell> | null>(null);
  const [holz, setHolz] = useState<Texture | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(0);
  const [messung, setMessung] = useState<Messung>({
    bisErstesBild: null,
    modellBytes: 0,
    bilderJeSekunde: 0,
    schlechtestes: 0,
  });

  /** Nur ein Zaehler: Ein Wechsel baut die Wiedergabe neu auf ("nochmal"). */
  const [lauf, setLauf] = useState(0);

  const spuren = useMemo(() => baueSpuren(BERICHT), []);
  const gesamt = useMemo(() => dauerMs(BERICHT), []);

  // Wiedergabezeit. Ein Ref und kein Zustand: Die Buehne liest ihn in jedem
  // Bild, und ein `setState` je Bild waere sechzig Durchlaeufe der ganzen
  // Anzeige je Sekunde.
  const zeit = useRef(0);
  const [fortschritt, setFortschritt] = useState(0);
  const [vorbei, setVorbei] = useState(false);

  // --- Laden ---------------------------------------------------------------
  useEffect(() => {
    let abgebrochen = false;
    const gltfLader = new GLTFLoader();
    const texturLader = new TextureLoader();

    texturLader.load(
      HOLZPFAD,
      (t) => {
        if (abgebrochen) return;
        t.colorSpace = SRGBColorSpace;
        t.wrapS = RepeatWrapping;
        t.wrapT = RepeatWrapping;
        t.repeat.set(4, 3.5);
        setHolz(t);
      },
      undefined,
      // Der Boden ist Kulisse: Faellt er aus, steht eine Farbflaeche da und
      // die Probe laeuft weiter. Nur die Figuren sind unverzichtbar.
      () => undefined,
    );

    void (async () => {
      try {
        let bytes = 0;
        const paare = await Promise.all(
          ROLLEN.map(async (rolle) => {
            const pfad = MODELLPFAD(rolle);
            const antwort = await fetch(pfad);
            if (!antwort.ok) throw new Error(`${pfad} antwortet ${antwort.status}`);
            const puffer = await antwort.arrayBuffer();
            bytes += puffer.byteLength;
            const gltf = await gltfLader.parseAsync(puffer, '');
            if (!abgebrochen) setGeladen((n) => n + 1);
            return [rolle, { vorlage: gltf.scene, clips: gltf.animations }] as const;
          }),
        );
        if (abgebrochen) return;
        setMessung((m) => ({ ...m, modellBytes: bytes }));
        setModelle(new Map(paare));
      } catch (e) {
        if (!abgebrochen) setFehler(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      abgebrochen = true;
    };
  }, []);

  // --- Wiedergabe und Bildrate ---------------------------------------------
  useEffect(() => {
    if (!modelle) return;
    zeit.current = 0;
    setVorbei(false);
    setFortschritt(0);

    let angehalten = false;
    let anker = performance.now();
    let bilder = 0;
    let fensterBeginn = anker;
    let schlechtestes = Infinity;

    const takt = (jetzt: number): void => {
      if (angehalten) return;
      zeit.current = Math.min(jetzt - anker, gesamt);
      bilder += 1;
      const offen = jetzt - fensterBeginn;
      if (offen >= 500) {
        const rate = (bilder * 1000) / offen;
        schlechtestes = Math.min(schlechtestes, rate);
        setMessung((m) => ({
          ...m,
          bilderJeSekunde: Math.round(rate),
          schlechtestes: Math.round(schlechtestes),
        }));
        bilder = 0;
        fensterBeginn = jetzt;
      }
      setFortschritt(zeit.current / gesamt);
      if (zeit.current >= gesamt) {
        setVorbei(true);
        return;
      }
      kennung = requestAnimationFrame(takt);
    };
    let kennung = requestAnimationFrame(takt);

    return () => {
      angehalten = true;
      cancelAnimationFrame(kennung);
    };
  }, [modelle, gesamt, lauf]);

  const erstesBild = useCallback(() => {
    setMessung((m) =>
      m.bisErstesBild === null
        ? { ...m, bisErstesBild: Math.round(performance.now() - begonnen.current) }
        : m,
    );
  }, []);

  const sieger = BERICHT.sieger;

  return (
    <div className={stil.blatt}>
      <header className={stil.kopf}>
        <div>
          <h1 className={stil.titel}>Arena-Probe B — 3D</h1>
          <p className={stil.unterzeile}>
            Three.js, {spuren.length} Figuren, dieselbe Aufzeichnung wie Probe A
          </p>
        </div>
        <button type="button" className={stil.knopf} onClick={() => setLauf((n) => n + 1)}>
          nochmal
        </button>
      </header>

      <div className={stil.buehne}>
        {fehler ? (
          <p className={stil.meldung}>
            Die Figuren liessen sich nicht laden: {fehler}
          </p>
        ) : !modelle ? (
          <p className={stil.meldung}>
            Figuren werden geladen … {geladen} von {ROLLEN.length}
          </p>
        ) : (
          <Canvas
            key={lauf}
            shadows
            dpr={[1, 2]}
            camera={{ fov: 42, near: 0.1, far: 60, position: [0, 7.4, 8.2] }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => {
              gl.shadowMap.type = PCFSoftShadowMap;
              gl.toneMapping = ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.05;
              // Ohne diesen Anstoss bleibt die Leinwand beim ersten Oeffnen
              // leer und fuellt sich erst, wenn jemand das Fenster anfasst.
              // R3F misst ueber react-use-measure am Element UND am Fenster,
              // und nur der zweite Weg wirkt hier (CLAUDE.md, Avatarwerkstatt).
              requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
            }}
          >
            <color attach="background" args={['#1a1410']} />
            <fog attach="fog" args={['#1a1410', 14, 30]} />
            <Arena3DBuehne
              spuren={spuren}
              modelle={modelle}
              holz={holz}
              zeit={zeit}
              onErstesBild={erstesBild}
            />
          </Canvas>
        )}

        {vorbei && (
          <div className={stil.endbild}>
            <p className={stil.endtitel}>
              {sieger === null ? 'Unentschieden' : `Seite ${sieger} gewinnt`}
            </p>
            <button type="button" className={stil.knopf} onClick={() => setLauf((n) => n + 1)}>
              nochmal
            </button>
          </div>
        )}
      </div>

      <div className={stil.leiste} aria-hidden="true">
        <div className={stil.fortschritt} style={{ width: `${fortschritt * 100}%` }} />
      </div>

      {/* Die Messwerte gehoeren auf den Bildschirm und nicht nur in den
          Bericht: Die Frage ist, ob 3D auf einem HANDY traegt, und das
          entscheidet sich auf dem Geraet des Betrachters, nicht auf dem
          Rechner desjenigen, der die Probe gebaut hat. */}
      <dl className={stil.messung}>
        <div>
          <dt>Figuren</dt>
          <dd>{(messung.modellBytes / 1024).toFixed(0)} kB (5 GLB)</dd>
        </div>
        <div>
          <dt>bis zum ersten Bild</dt>
          <dd>{messung.bisErstesBild === null ? '…' : `${messung.bisErstesBild} ms`}</dd>
        </div>
        <div>
          <dt>Bilder je Sekunde</dt>
          <dd>
            {messung.bilderJeSekunde || '…'}
            {messung.schlechtestes ? ` (min ${messung.schlechtestes})` : ''}
          </dd>
        </div>
      </dl>

      <p className={stil.fussnote}>
        Figuren: KayKit „Character Pack: Adventurers" von Kay Lousberg, CC0 1.0 — frei
        verwendbar, Namensnennung nicht verlangt. Herkunft und Bearbeitung stehen in
        <code> packages/client/src/proben/arena-3d/modelle-bauen.mjs</code>.
      </p>
    </div>
  );
}
