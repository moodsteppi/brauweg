import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei';
import { CanvasTexture, Group, Mesh, MeshStandardMaterial, SRGBColorSpace, type Texture } from 'three';

import type { Getragen } from './api';
import { MAX_PUNKTE_JE_STRICH, zeichne, type Bemalung, type Strich } from './bemalung';

/**
 * Der Pinguin in drei Dimensionen — zum Drehen und zum Anmalen.
 *
 * **Diese Datei wird nur nachgeladen, wenn jemand sie wirklich sieht.**
 * `three` und `@react-three/drei` wiegen zusammen rund 900 kB; sie stecken
 * deshalb bei jedem Aufrufer hinter einem `React.lazy`.
 *
 * **Keine `Environment`-Beleuchtung.** Die fertigen Voreinstellungen von drei
 * laden ihre HDR-Karte von einem fremden Server nach. Das wäre die einzige
 * Stelle der Anwendung, die etwas aus dem Netz holt. Vier gesetzte Lichter
 * tun es auch — der Pinguin ist eine Spielfigur, kein Produktfoto.
 *
 * **Bemalt wird nur der Pinguin.** Die Mütze und alles, was später dazukommt,
 * behält seine Farben; angefasst wird ausschließlich das Material der Figur.
 */

const PINGUIN = '/3d/penguin_base.glb';

/** Kantenlänge der Malfläche. 1024 reicht: Die Figur ist nie größer als ein Handy. */
const LEINWAND = 1024;

/**
 * Welches angezogene Stück welches Modell hat — und wo es sitzt.
 *
 * **Hier lag der Fehler.** Vorher hatte die Figur einen Schalter `muetze:
 * boolean`, und beide Ansichten im Spiel gaben ihm fest `false` mit. Die
 * Mütze war damit nur in der Werkstatt zu sehen, und auch dort nur, weil man
 * sie dort von Hand einschaltete: Wer sie im Kleiderschrank anzog, sah sie an
 * der 3D-Figur nirgends. Die Figur wusste gar nicht, was man trägt.
 *
 * Jetzt bekommt sie dasselbe `getragen` wie der gemalte Pinguin und sucht
 * sich hier heraus, wofür sie ein Modell hat. Ein Stück ohne Eintrag
 * erscheint nicht — sichtbar wäre nur, was auch wirklich gemodellt ist.
 *
 * **Zurzeit steht hier genau ein Eintrag.** Modelliert ist die Wollmütze; die
 * übrigen fünf Hüte, die Brillen, Oberteile, Schuhe, Handstücke und Auren
 * gibt es nur gemalt. Die Bestellung dafür steht in
 * `docs/ASSETS-3D-ZUBEHOER.md`. Kommt ein Modell, ist es eine Zeile hier und
 * sonst nichts.
 *
 * Die Sitzwerte sind von Hand im Ausrichter eingestellt (`/?dev=avatar`) —
 * **nicht** der rechnerische Kopfansatz aus `avatar_normalize.json`. Der
 * liegt bei y = 0,988, also gut 25 Zentimeter höher, und lässt die Mütze
 * schweben.
 */
interface Sitz {
  readonly datei: string;
  readonly position: [number, number, number];
  readonly rotation: [number, number, number];
  readonly scale: number;
}

const MODELLE: Readonly<Record<string, Sitz>> = {
  'hut-wollmuetze': {
    datei: '/3d/beanie.glb',
    position: [-0.007, 0.736, 0.013],
    rotation: [0, 0, 0],
    scale: 1.09,
  },
};

/** Die Kennungen, für die es ein Modell gibt — in fester Reihenfolge. */
const MODELLIERT = Object.keys(MODELLE);

useGLTF.preload(PINGUIN);
for (const kennung of MODELLIERT) useGLTF.preload(MODELLE[kennung].datei);

export interface Avatar3DProps {
  /**
   * Was die Figur trägt — dieselben Kennungen wie beim gemalten Pinguin.
   *
   * Bewusst der ganze Satz und kein einzelner Schalter: Sobald ein zweites
   * Stück ein Modell bekommt, ist hier nichts zu ändern.
   */
  getragen: Getragen;
  bemalung: Bemalung;
  /** Malmodus: Wischen malt, statt zu drehen. */
  malen?: boolean;
  farbe?: string;
  breite?: number;
  /** Ein fertiger Zug — wird erst beim Loslassen gemeldet. */
  onStrich?: (strich: Strich) => void;
  /** Aus für die kleine Ansicht im Profil: Dort wird nur geschaut. */
  drehbar?: boolean;
  /**
   * Eigenbewegung: Die Figur wippt und schaut sich langsam um.
   *
   * Das Modell bringt keine Animation mit — es ist ein starres Netz. „Lebendig"
   * heißt hier deshalb nicht abgespielt, sondern gerechnet: ein Wippen auf und
   * ab und ein leises Pendeln um die eigene Achse. Auf dem Trophäenpfad steht
   * die Figur lange still im Bild, und eine Figur, die sich gar nicht regt,
   * sieht dort aus wie ein Aufkleber.
   */
  lebendig?: boolean;
  /** Wird einmal gerufen, sobald die Figur steht — siehe `anstossen`. */
  onBereit?: () => void;
}

export default function Avatar3D({
  getragen,
  bemalung,
  malen = false,
  farbe = '#e8433a',
  breite = 0.045,
  onStrich,
  drehbar = true,
  lebendig = false,
  onBereit,
}: Avatar3DProps): React.JSX.Element {
  /**
   * Geladen wird hier oben, **außerhalb** der Leinwand.
   *
   * `useGLTF` braucht den Leinwand-Kontext nicht. Hier aufgerufen hält es die
   * äußere Suspense-Grenze des Aufrufers an, und die Leinwand entsteht erst,
   * wenn beide Modelle da sind — damit ist schon das erste Bild vollständig.
   */
  const pinguin = useGLTF(PINGUIN);
  /**
   * Alle Zubehörmodelle werden geladen, nicht nur die getragenen.
   *
   * `useGLTF` ist ein Hook: Er muss bei jedem Durchlauf gleich oft und in
   * derselben Reihenfolge aufgerufen werden. Nur das gerade Getragene zu laden
   * hieße, die Zahl der Hooks vom Zustand abhängig zu machen — und beim
   * Wechseln der Mütze stürzt React ab. Die Modelle sind klein und liegen
   * ohnehin schon im Zwischenspeicher (`preload` oben).
   */
  const zubehoer = useGLTF(MODELLIERT.map((k) => MODELLE[k].datei));

  // `clone(true)` statt der Szene selbst: `useGLTF` hält sie zwischengespeichert
  // und gibt jedem Aufrufer dasselbe Objekt. Wer es direkt einhängt, klaut es
  // dem nächsten — und dann ist der Pinguin beim zweiten Öffnen weg.
  const pinguinSzene = useMemo(() => pinguin.scene.clone(true), [pinguin.scene]);
  const zubehoerSzenen = useMemo(
    () => zubehoer.map((g) => g.scene.clone(true)),
    [zubehoer],
  );

  /**
   * Was davon gerade zu sehen ist.
   *
   * Aus `getragen` werden die Werte genommen und gegen die Modelltabelle
   * geprüft — nicht die Plätze. So ist es gleich, auf welchem Platz ein Stück
   * sitzt: Bekommt die Brille ein Modell, greift derselbe Weg.
   */
  const sichtbar = useMemo(() => {
    const angezogen = new Set(Object.values(getragen).filter(Boolean));
    return MODELLIERT.map((kennung, i) => ({ kennung, i }))
      .filter(({ kennung }) => angezogen.has(kennung));
  }, [getragen]);

  /**
   * Die Malfläche und ihre Textur.
   *
   * `flipY = false`, weil glTF seine Texturkoordinaten andersherum zählt als
   * eine HTML-Leinwand. Ohne das steht die Bemalung auf dem Kopf, und man
   * sucht den Fehler beim Malen statt beim Aufhängen.
   */
  const leinwand = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = LEINWAND;
    c.height = LEINWAND;
    return c;
  }, []);
  const textur = useMemo(() => {
    const t = new CanvasTexture(leinwand);
    t.flipY = false;
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [leinwand]);
  useEffect(() => () => textur.dispose(), [textur]);

  /**
   * Das Material der Figur — einmal kopiert.
   *
   * `Object3D.clone()` kopiert die Netze, aber **nicht** die Materialien: Die
   * bleiben geteilt. Wer hier die Textur austauscht, ohne vorher zu kopieren,
   * bemalt jede andere Ansicht derselben Figur gleich mit — auch die kleine
   * im Profil.
   */
  const { material, grundTextur } = useMemo(() => {
    let erstes: MeshStandardMaterial | null = null;
    pinguinSzene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const kopie = (o.material as MeshStandardMaterial).clone();
      o.material = kopie;
      if (!erstes) erstes = kopie;
    });
    const m = erstes as MeshStandardMaterial | null;
    return { material: m, grundTextur: (m?.map ?? null) as Texture | null };
  }, [pinguinSzene]);

  // Design umschalten: entweder die gemalte Fläche oder die des Modells.
  useEffect(() => {
    if (!material) return;
    material.map = bemalung.design === 'bemalt' ? textur : grundTextur;
    material.needsUpdate = true;
  }, [material, grundTextur, textur, bemalung.design]);

  /**
   * Der Zug, an dem gerade gemalt wird.
   *
   * Steht in einem Ref und nicht im Zustand: Beim Wischen kommen dutzende
   * Punkte je Sekunde, und für jeden neu zu rendern macht das Malen zäh. Die
   * Leinwand wird direkt bemalt, React erfährt erst beim Loslassen davon.
   */
  const laufend = useRef<Strich | null>(null);

  // Alles neu zeichnen, wenn sich die gespeicherten Züge ändern.
  useEffect(() => {
    zeichne(leinwand, bemalung.striche);
    textur.needsUpdate = true;
  }, [leinwand, textur, bemalung.striche]);

  const malePunkt = (e: ThreeEvent<PointerEvent>, neu: boolean): void => {
    if (!malen || !e.uv) return;
    const punkt: readonly [number, number] = [e.uv.x, e.uv.y];
    if (neu || !laufend.current) {
      laufend.current = { f: farbe, b: breite, p: [punkt] };
    } else {
      const p = laufend.current.p;
      if (p.length >= MAX_PUNKTE_JE_STRICH) return;
      laufend.current = { ...laufend.current, p: [...p, punkt] };
    }
    // Sofort sichtbar: die gespeicherten Züge plus der laufende.
    zeichne(leinwand, [...bemalung.striche, laufend.current]);
    textur.needsUpdate = true;
  };

  const beenden = (): void => {
    const strich = laufend.current;
    laufend.current = null;
    if (strich) onStrich?.(strich);
  };

  /**
   * Melden, dass die Figur steht.
   *
   * **Hier im Rumpf und ausdruecklich NICHT als Bauteil innerhalb von
   * `<Canvas>`.** Dort lief der Ruf im Reconciler von R3F und damit vor dem
   * Zeitpunkt, an dem der Browser die Leinwand zusammensetzt — die Buehne
   * blieb schwarz. Das hat beim Bauen einen ganzen Umweg gekostet: Der
   * Aufbau sah in beiden Fassungen gleich richtig aus, nur die Reihenfolge
   * war eine andere.
   *
   * Wozu der Ruf gut ist, steht beim Empfaenger (`anstossen` in
   * `Avatarwerkstatt.tsx`).
   */
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      // Der Anstoss selbst, damit auch Aufrufer ohne `onBereit` eine
      // sichtbare Figur bekommen — im Kopfband und im Profil zum Beispiel.
      window.dispatchEvent(new Event('resize'));
      onBereit?.();
    });
    return () => cancelAnimationFrame(id);
  }, [onBereit]);

  return (
    <Canvas
      // Die Kamera schaut leicht von oben auf Kopfhöhe — so, wie man eine
      // Figur in der Hand hält. Der Abstand ist nach dem höchsten Fall
      // bemessen: Mit Mütze ist die Figur einen Kopf höher, und bei 2,1 wurde
      // sie oben abgeschnitten.
      camera={{ position: [0, 0.8, 2.7], fov: 32 }}
      // Auf dem Handy bringt mehr als das Doppelte der Bildpunkte nichts und
      // kostet spürbar Rechenzeit.
      dpr={[1, 2]}
      shadows
    >
      {/*
        Die Zahlen sehen hoch aus und sind es nicht.
        ------------------------------------------------------------------
        Mit Werten um 1 — wie sie in älteren Anleitungen stehen — ist die
        Figur kaum zu erkennen; die ACES-Tonwertkurve, die R3F von Haus aus
        setzt, nimmt zusätzlich Helligkeit heraus.

        **Nicht zu verwechseln mit der Umstellung in three r155:** Die
        betrifft Punkt- und Spotlichter, die seither in Candela rechnen und
        vierstellige Werte brauchen. Hier stehen nur Umgebungs-, Halbraum-
        und Richtungslichter — die bleiben einstellig. Wer hier 3000 einträgt,
        blendet alles weiß.
      */}
      <ambientLight intensity={2.2} />
      <hemisphereLight args={['#ffe6bd', '#3a2a1c', 1.6]} />
      <directionalLight
        castShadow
        intensity={3.2}
        position={[2.5, 4, 2.5]}
        shadow-mapSize={[1024, 1024]}
      />
      {/* Gegenlicht von hinten links, damit die Silhouette vom dunklen
          Hintergrund abhebt. Ohne das verschwindet ein dunkler Pinguin. */}
      <directionalLight intensity={1.2} position={[-2, 1.5, -2]} />

      <Wippe an={lebendig}>
      <group
        onPointerDown={(e) => {
          if (!malen) return;
          e.stopPropagation();
          malePunkt(e, true);
        }}
        onPointerMove={(e) => {
          if (!malen || !laufend.current) return;
          e.stopPropagation();
          malePunkt(e, false);
        }}
        onPointerUp={beenden}
        // Wer beim Malen über den Rand der Figur hinausfährt, hat den Zug
        // beendet — sonst hängt er, und die nächste Berührung setzt ihn fort.
        onPointerLeave={beenden}
      >
        <primitive object={pinguinSzene} />
        {sichtbar.map(({ kennung, i }) => {
          const sitz = MODELLE[kennung];
          return (
            <group
              key={kennung}
              position={sitz.position}
              rotation={sitz.rotation}
              scale={[sitz.scale, sitz.scale, sitz.scale]}
            >
              <primitive object={zubehoerSzenen[i]} />
            </group>
          );
        })}
      </group>
      </Wippe>

      <ContactShadows position={[0, 0.001, 0]} opacity={0.45} scale={3} blur={2.4} />

      <OrbitControls
        makeDefault
        target={[0, 0.55, 0]}
        // Beim Malen ist das Drehen aus: Ein Finger kann nicht beides, und
        // wer malt, dreht sich sonst bei jedem Strich die Figur weg.
        enableRotate={drehbar && !malen}
        // Rundherum drehen ja, verschieben nein: Wer die Figur aus dem Bild
        // schiebt, findet sie ohne Zurücksetzen nicht wieder.
        enablePan={false}
        enableZoom={false}
        // Nicht unter den Boden und nicht über den Scheitel — von dort sieht
        // man nur eine Fläche und hält es für kaputt.
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.52}
        enableDamping
        dampingFactor={0.08}
      />

    </Canvas>
  );
}

/**
 * Die Eigenbewegung.
 *
 * Ein Wippen auf und ab und ein leises Pendeln um die Hochachse — beides aus
 * derselben Uhr, aber mit verschiedenen Perioden, damit es nicht im Takt
 * zusammenfällt und mechanisch wirkt.
 *
 * Als eigenes Bauteil, weil `useFrame` nur innerhalb der Leinwand läuft. Ist
 * die Bewegung aus, hängt die Gruppe still da und kostet nichts.
 */
function Wippe({
  an,
  children,
}: {
  an: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const gruppe = useRef<Group>(null);
  const zeit = useRef(0);

  useFrame((_, delta) => {
    const g = gruppe.current;
    if (!g || !an) return;
    zeit.current += delta;
    g.position.y = Math.sin(zeit.current * 1.6) * 0.022;
    g.rotation.y = Math.sin(zeit.current * 0.55) * 0.22;
  });

  return <group ref={gruppe}>{children}</group>;
}
