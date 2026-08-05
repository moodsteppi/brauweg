import { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei';

/**
 * Der Pinguin in drei Dimensionen, zum Drehen.
 *
 * **Diese Datei wird nur nachgeladen, wenn jemand sie wirklich öffnet.**
 * `three` und `@react-three/drei` wiegen zusammen rund 900 kB — läge das im
 * Hauptbündel, zahlte jeder Spieler dafür, auch wer nie in die Werkstatt geht.
 * Deshalb steht der Einstieg in `Avatarwerkstatt.tsx` hinter einem
 * `React.lazy`, und alles, was `three` anfasst, steht hier drin.
 *
 * **Keine `Environment`-Beleuchtung.** Die fertigen Voreinstellungen von drei
 * (`preset="warehouse"` und Verwandte) laden ihre HDR-Karte von einem fremden
 * Server nach. Das wäre die einzige Stelle in der ganzen Anwendung, die etwas
 * aus dem Netz holt, und sie fiele genau dann aus, wenn der fremde Server
 * ausfällt. Drei gesetzte Lichter tun es auch — der Pinguin ist eine
 * Spielfigur, kein Produktfoto.
 */

const PINGUIN = '/3d/penguin_base.glb';
const MUETZE = '/3d/beanie.glb';

/**
 * Wo die Mütze sitzt.
 *
 * Von Hand im Ausrichter eingestellt (`/?dev=avatar`) und von dort als JSON
 * übernommen — **nicht** der rechnerische Kopfansatz aus
 * `avatar_normalize.json`. Der liegt bei y = 0,988, also gut 25 Zentimeter
 * höher; nach Augenmaß sitzt sie hier richtig. Wer sie verschieben will,
 * ändert genau diese Zahlen und sonst nichts.
 */
const MUETZE_SITZ = {
  position: [-0.007, 0.736, 0.013] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: 1.09,
};

useGLTF.preload(PINGUIN);
useGLTF.preload(MUETZE);

export default function Avatar3D({
  muetze,
  onBereit,
}: {
  muetze: boolean;
  /** Wird einmal gerufen, sobald die Modelle stehen — siehe `anstossen`. */
  onBereit?: () => void;
}): React.JSX.Element {
  /**
   * Geladen wird hier oben, **außerhalb** der Leinwand.
   *
   * Standen die `useGLTF`-Aufrufe in einem Bauteil innerhalb von `<Canvas>`
   * hinter einem `<Suspense>`, blieb die Bühne beim ersten Öffnen schwarz:
   * Die Leinwand entstand mit leerem Inhalt, und wenn die Modelle ankamen,
   * wurde nicht mehr neu gezeichnet. Sichtbar wurde es erst, wenn man das
   * Fenster um einen einzigen Pixel veränderte.
   *
   * Das hat lange gekostet, weil davor drei plausible Fährten lagen, die
   * alle nichts brachten: `frameloop="demand"` abschalten, die Vermessung im
   * rollbaren Blatt umstellen, und Bilder von Hand nachfordern.
   *
   * `useGLTF` braucht den Leinwand-Kontext nicht. Hier oben aufgerufen hält
   * es die **äußere** Suspense-Grenze in `Avatarwerkstatt.tsx` an ("Figur
   * wird geladen…"), und die Leinwand entsteht erst, wenn beide Modelle da
   * sind. Damit ist schon das erste Bild vollständig.
   */
  const pinguin = useGLTF(PINGUIN);
  const hut = useGLTF(MUETZE);

  // `clone(true)` statt der Szene selbst: `useGLTF` hält sie zwischengespeichert
  // und gibt jedem Aufrufer dasselbe Objekt. Wer es direkt einhängt, klaut es
  // dem nächsten — und dann ist der Pinguin beim zweiten Öffnen weg.
  const pinguinSzene = useMemo(() => pinguin.scene.clone(true), [pinguin.scene]);
  const hutSzene = useMemo(() => hut.scene.clone(true), [hut.scene]);

  // Der Anstoß von aussen. Begründung steht in `Avatarwerkstatt.tsx`.
  useEffect(() => {
    const id = requestAnimationFrame(() => onBereit?.());
    return () => cancelAnimationFrame(id);
  }, [onBereit]);

  return (
    <Canvas
      // Die Kamera schaut leicht von oben auf Kopfhöhe — so, wie man eine
      // Figur in der Hand hält.
      //
      // Der Abstand ist nach dem höchsten Fall bemessen, nicht nach dem
      // nackten Pinguin: Mit Mütze ist die Figur gut einen Kopf höher, und
      // bei 2,1 wurde die Mütze oben abgeschnitten. Wer hier näher
      // heranrückt, muss mit aufgesetzter Mütze gegenprüfen.
      camera={{ position: [0, 0.8, 2.7], fov: 32 }}
      // Auf dem Handy bringt mehr als das Doppelte der Bildpunkte nichts und
      // kostet spürbar Rechenzeit.
      dpr={[1, 2]}
      shadows
    >
      {/*
        Die Zahlen sehen hoch aus und sind es nicht.
        ------------------------------------------------------------------
        three rechnet seit r155 mit physikalischen Lichteinheiten. Werte um
        1, wie sie in jeder älteren Anleitung stehen, ergeben ein sehr
        dunkles Bild.

        Der Ausrichter unter `?dev=avatar` täuscht dabei: Er hat genau solche
        niedrigen Werte, sieht aber gut aus, weil `<Environment>` dort die
        eigentliche Beleuchtung macht. Wer sich daran orientiert, sucht lange.
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

      <group>
        <primitive object={pinguinSzene} />
        {muetze && (
          <group
            position={MUETZE_SITZ.position}
            rotation={MUETZE_SITZ.rotation}
            scale={[MUETZE_SITZ.scale, MUETZE_SITZ.scale, MUETZE_SITZ.scale]}
          >
            <primitive object={hutSzene} />
          </group>
        )}
      </group>

      <ContactShadows position={[0, 0.001, 0]} opacity={0.45} scale={3} blur={2.4} />

      <OrbitControls
        makeDefault
        target={[0, 0.55, 0]}
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
