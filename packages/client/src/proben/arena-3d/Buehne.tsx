/**
 * Die Buehne der 3D-Probe: Brett, Licht, Kamera und acht animierte Figuren.
 *
 * Alles in dieser Datei laeuft INNERHALB der `<Canvas>`. Geladen wird hier
 * nichts mehr — die Modelle kommen fertig von aussen herein (siehe
 * `Arena3D.tsx`). Das ist Absicht und steht so in CLAUDE.md: `useTexture` und
 * Verwandte haengen im Runner die ganze Leinwand ab, wenn eine Datei nicht
 * aufloest, und uebrig bleibt ein Dauerladetext ohne Fehlermeldung. Was
 * anhalten kann, wird deshalb draussen geladen, wo man es sehen kann.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AnimationMixer,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
  type Texture,
} from 'three';
import { clone as klone } from 'three/examples/jsm/utils/SkeletonUtils.js';

import {
  ARENA_REIHEN,
  ARENA_SPALTEN,
  type Haltung,
  type Spur,
  stellungBei,
  weltVonPlatz,
} from './ablauf';

/** Ein geladenes Rollenmodell: die Vorlage und ihre vier Animationen. */
export interface Modell {
  readonly vorlage: Object3D;
  readonly clips: readonly AnimationClip[];
}

/** Warm fuer Seite 0, kuehl fuer Seite 1 — dieselbe Lesart wie in der 2D-Probe. */
const SEITENFARBE = ['#f0a63c', '#4f9ff0'] as const;

/**
 * Wie gross eine Figur auf dem Feld steht.
 *
 * Die KayKit-Figuren sind rund 1,7 Einheiten hoch, ein Feld ist sqrt(3) ≈ 1,73
 * breit. Unskaliert fuellt eine Figur ihr Feld also vollstaendig aus und die
 * Nachbarn beruehren sich. 0,72 laesst zwischen zwei Feldern Luft, ohne dass
 * die Figuren zu Spielsteinen werden.
 */
const FIGURENGROESSE = 0.72;

/**
 * Wie hoch ueber dem Feld der Lebensbalken schwebt.
 *
 * Eine feste Zahl und KEIN gemessener Umriss. `new Box3().setFromObject()`
 * liegt bei einer SkinnedMesh daneben: Gemessen wird die Geometrie in ihrer
 * Bindepose, nicht die Figur, wie sie gerade dasteht. Beim ersten Anlauf
 * standen deshalb nur drei von acht Balken im Bild — die uebrigen schwebten
 * ausserhalb des Ausschnitts, je nach Rig. Alle fuenf Figuren des Pakets sind
 * rund 1,7 Einheiten hoch; mal FIGURENGROESSE macht das 1,22, und ein
 * Fingerbreit Luft darueber ergibt diesen Wert.
 */
const BALKENHOEHE = 1.5;

/**
 * Eine einzelne Figur samt Animationsmischer.
 *
 * WARUM `SkeletonUtils.clone` UND NICHT `Object3D.clone`: Ein gewoehnliches
 * `clone()` kopiert die Knochen, laesst die SkinnedMesh aber auf das ALTE
 * Skelett zeigen. Alle Kopien haengen dann an derselben Pose — acht Figuren
 * bewegen sich wie eine. `SkeletonUtils.clone` verdrahtet die Kopie neu.
 *
 * Geometrie, Material und Textur bleiben dabei GETEILT. Das ist wichtig genug,
 * um es hinzuschreiben: In CLAUDE.md steht der Runner-Befund "niemals clone()
 * je Instanz" — zwoelf zusaetzliche 1024er-Texturen haben dort den
 * WebGL-Kontext gekostet. Hier wird nichts davon vervielfaeltigt.
 */
function Figur({
  spur,
  modell,
  zeit,
}: {
  spur: Spur;
  modell: Modell;
  /** Aktuelle Wiedergabezeit in Millisekunden. Ein Ref, damit ein Sprung in
   *  der Zeit (Knopf "nochmal") die Figuren nicht neu aufbaut. */
  zeit: { current: number };
}): React.JSX.Element {
  const gruppe = useRef<Group>(null);
  const lebensbalken = useRef<Mesh>(null);
  const balkenhalter = useRef<Group>(null);
  const kamera = useThree((s) => s.camera);

  const { objekt, mischer, aktionen } = useMemo(() => {
    const objekt = klone(modell.vorlage);
    objekt.traverse((teil) => {
      teil.castShadow = true;
    });
    const mischer = new AnimationMixer(objekt);
    const aktionen = new Map<Haltung, AnimationAction>();
    for (const clip of modell.clips) {
      const aktion = mischer.clipAction(clip);
      // Angriff und Tod laufen EINMAL und bleiben im letzten Bild stehen.
      // Ohne `clampWhenFinished` springt eine gefallene Figur nach dem
      // Sterben wieder in ihre Ruhepose — der Kampf saehe aus, als stuenden
      // die Toten wieder auf.
      if (clip.name === 'angriff' || clip.name === 'tod') {
        aktion.setLoop(LoopOnce, 1);
        aktion.clampWhenFinished = true;
      } else {
        aktion.setLoop(LoopRepeat, Infinity);
      }
      aktionen.set(clip.name as Haltung, aktion);
    }
    return { objekt, mischer, aktionen };
  }, [modell]);

  useEffect(() => {
    return () => {
      mischer.stopAllAction();
      mischer.uncacheRoot(objekt);
    };
  }, [mischer, objekt]);

  /** Was gerade laeuft, und seit wann. Nur hier drin, nicht im React-Zustand:
   *  ein `setState` je Bild waere sechzig Durchlaeufe der Anzeige je Sekunde. */
  const laufend = useRef<{ haltung: Haltung | null; angriffNr: number }>({
    haltung: null,
    angriffNr: -1,
  });

  useFrame((_zustand, delta) => {
    const t = zeit.current;
    const stellung = stellungBei(spur, t);

    if (gruppe.current) {
      gruppe.current.position.set(stellung.x, 0, stellung.z);
      gruppe.current.rotation.y = stellung.drehung;
    }

    // Wie oft hat die Figur bis jetzt zugeschlagen? Der Zaehler ist der
    // Ausloeser fuer den Neustart der Angriffsanimation: Zwei Schlaege
    // hintereinander sind dieselbe Haltung, sollen aber zweimal zu sehen sein.
    let angriffNr = -1;
    for (let i = 0; i < spur.angriffe.length; i++) {
      if (spur.angriffe[i]! > t) break;
      angriffNr = i;
    }

    const vorher = laufend.current;
    const neueHaltung = stellung.haltung;
    const neuerSchlag = neueHaltung === 'angriff' && angriffNr !== vorher.angriffNr;
    if (neueHaltung !== vorher.haltung || neuerSchlag) {
      const kommt = aktionen.get(neueHaltung);
      const geht = vorher.haltung ? aktionen.get(vorher.haltung) : undefined;
      if (kommt) {
        if (neueHaltung === 'angriff' || neueHaltung === 'tod') {
          kommt.reset();
          // Bei einem Ruecksprung in der Zeit (Knopf "nochmal") steht die
          // Todesanimation sonst noch auf ihrem letzten Bild.
          kommt.paused = false;
        }
        kommt.enabled = true;
        kommt.setEffectiveWeight(1);
        if (geht && geht !== kommt) kommt.crossFadeFrom(geht, 0.18, false).play();
        else kommt.play();
      }
      laufend.current = { haltung: neueHaltung, angriffNr };
    }

    mischer.update(delta);

    // Lebensbalken: schrumpft nach links und dreht sich zur Kamera.
    if (balkenhalter.current) {
      balkenhalter.current.quaternion.copy(kamera.quaternion);
      balkenhalter.current.visible = stellung.haltung !== 'tod';
    }
    if (lebensbalken.current) {
      const anteil = Math.max(0.001, stellung.lebenAnteil);
      lebensbalken.current.scale.x = anteil;
      // Der Balken sitzt mittig; beim Schrumpfen muss er nach links rutschen,
      // sonst zehrt er von beiden Seiten und sieht nach halbem Schaden aus.
      lebensbalken.current.position.x = -(1 - anteil) * 0.36;
    }
  });

  const farbe = SEITENFARBE[spur.seite];

  return (
    <group ref={gruppe}>
      {/* Der farbige Ring sagt, wem die Figur gehoert. Er faerbt nicht das
          Modell selbst ein: Dafuer muesste je Seite ein eigenes Material her,
          und geteilte Materialien sind der halbe Grund, warum acht Figuren
          hier ueberhaupt fluessig laufen. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.52, 24]} />
        <meshBasicMaterial color={farbe} transparent opacity={0.55} />
      </mesh>

      <primitive object={objekt} scale={FIGURENGROESSE} />

      {/* Die Balken zeichnen ohne Tiefentest und zuletzt. Sonst verschwindet
          der Balken der hinteren Figur hinter der vorderen — und ausgerechnet
          in einem Getuemmel, in dem man ihn braucht. */}
      <group ref={balkenhalter} position={[0, BALKENHOEHE, 0]} renderOrder={10}>
        <mesh position={[0, 0, -0.001]} renderOrder={10}>
          <planeGeometry args={[0.78, 0.13]} />
          <meshBasicMaterial
            color="#140f0b"
            transparent
            opacity={0.8}
            side={DoubleSide}
            depthTest={false}
          />
        </mesh>
        {/* `transparent` steht hier, obwohl nichts durchscheinen soll.
            three zeichnet erst alle undurchsichtigen Flaechen und danach die
            durchsichtigen — eine undurchsichtige Fuellung kaeme also VOR
            ihrer durchsichtigen Unterlage an die Reihe, und die uebermalte
            sie anschliessend vollstaendig. Genau so sahen die Balken beim
            ersten Anlauf aus: acht schwarze Striche. Erst wenn beide im
            selben Durchgang liegen, greift `renderOrder`. */}
        <mesh ref={lebensbalken} renderOrder={11}>
          <planeGeometry args={[0.72, 0.09]} />
          <meshBasicMaterial
            color={farbe}
            side={DoubleSide}
            depthTest={false}
            transparent
            opacity={1}
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Das Brett: eine Flaeche mit Holzmaserung und zwanzig angedeuteten Feldern.
 *
 * Die Felder sind Umrisse und keine Plaettchen. Ohne sie sieht man nicht, dass
 * die Figuren auf einem Raster stehen — mit gefuellten Sechsecken saehe es
 * dagegen aus wie ein Brettspiel und nicht wie eine Arena.
 */
function Brett({ holz }: { holz: Texture | null }): React.JSX.Element {
  const umriss = useMemo(() => {
    // Ein Sechseck mit der Spitze nach vorn (odd-r, siehe arena-szene.ts).
    // Aus einem Kreis mit sechs Segmenten wird ein Sechseck; gedreht um 30
    // Grad zeigen die Ecken nach vorn und hinten statt nach links und rechts.
    const g = new CircleGeometry(0.94, 6, Math.PI / 6);
    return g;
  }, []);
  const material = useMemo(
    () => new MeshBasicMaterial({ color: new Color('#e8d9b8'), transparent: true, opacity: 0.13 }),
    [],
  );
  useEffect(() => () => {
    umriss.dispose();
    material.dispose();
  }, [umriss, material]);

  const felder = useMemo(
    () => Array.from({ length: ARENA_REIHEN * ARENA_SPALTEN }, (_, platz) => weltVonPlatz(platz)),
    [],
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12.5, 10.5]} />
        {holz ? (
          <meshStandardMaterial map={holz} roughness={0.95} metalness={0} />
        ) : (
          // Bis die Textur da ist, steht eine Farbflaeche. Ein weisses Nichts
          // saehe nach Fehler aus (CLAUDE.md, kein <img> auf eine Datei, die
          // es noch nicht gibt).
          <meshStandardMaterial color="#6b4f33" roughness={0.95} metalness={0} />
        )}
      </mesh>
      {felder.map((f, i) => (
        <mesh
          key={i}
          geometry={umriss}
          material={material}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[f.x, 0.008, f.z]}
        />
      ))}
      {/* Die Mittellinie zwischen den beiden Haelften. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <planeGeometry args={[10.4, 0.035]} />
        <meshBasicMaterial color="#f3e6c8" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

/**
 * Die Kamera: schraeg von oben, mit einer sehr langsamen Pendelbewegung.
 *
 * "Leicht beweglich, aber ruhig" heisst hier: eine volle Pendelperiode dauert
 * ueber eine Minute, die Auslenkung betraegt gut einen Meter. Man merkt die
 * Bewegung als Raeumlichkeit, nicht als Schwenk — und vor allem wird niemandem
 * schlecht, der die Probe dreimal hintereinander ansieht.
 */
function Kameraflug(): null {
  const kamera = useThree((s) => s.camera);
  useFrame((zustand) => {
    const t = zustand.clock.elapsedTime;
    kamera.position.set(Math.sin(t * 0.1) * 1.15, 6.3, 7.3);
    kamera.lookAt(0, 0.85, 0);
  });
  return null;
}

export function Arena3DBuehne({
  spuren,
  modelle,
  holz,
  zeit,
  onErstesBild,
}: {
  spuren: readonly Spur[];
  modelle: ReadonlyMap<string, Modell>;
  holz: Texture | null;
  zeit: { current: number };
  /** Wird genau einmal gerufen, sobald das erste Bild wirklich stand. */
  onErstesBild: () => void;
}): React.JSX.Element {
  const gemeldet = useRef(false);
  useFrame(() => {
    if (gemeldet.current) return;
    gemeldet.current = true;
    onErstesBild();
  });

  return (
    <>
      <Kameraflug />
      <hemisphereLight args={['#cfe0ff', '#4a3a28', 1.1]} />
      <directionalLight
        position={[5.5, 9, 4.5]}
        intensity={2.1}
        color="#fff3dc"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.0015}
      />
      <Brett holz={holz} />
      {spuren.map((spur) => {
        const modell = modelle.get(spur.rolle);
        if (!modell) return null;
        return <Figur key={spur.id} spur={spur} modell={modell} zeit={zeit} />;
      })}
    </>
  );
}
