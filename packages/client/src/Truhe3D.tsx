import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei';
import { Color, Group, Mesh, MeshStandardMaterial } from 'three';

/**
 * Die Truhe in drei Dimensionen.
 *
 * Ersetzt das gezeichnete SVG in `Aufgaben.tsx` und die Ebenen-Attrappe in
 * `TruhenOeffnung.tsx`. Zwei Modelle: Boden und Deckel. Der Deckel hängt unter
 * dem Boden und wird zwischen zwei Posen bewegt — **nicht** über CSS auf ein
 * Bild, sondern als echte Lage im Raum.
 *
 * **Der Grad steckt in der Farbe, nicht im Modell.** Holz, Bronze, Silber,
 * Gold und Diamant sind dasselbe Netz mit einem anderen Farbton auf dem
 * Material. Fünf Modelle wären fünfmal 670 kB für einen Unterschied, den ein
 * Multiplikator auch macht.
 *
 * Wie überall beim 3D hier: Diese Datei wird nachgeladen (`React.lazy`), und
 * es gibt keine `Environment`-Beleuchtung — die zöge eine HDR-Karte von einem
 * fremden Server.
 */

const BODEN = '/3d/chest/chest_bottom.glb';
const DECKEL = '/3d/chest/chest_top.glb';

useGLTF.preload(BODEN);
useGLTF.preload(DECKEL);

export type Grad = 'holz' | 'bronze' | 'silber' | 'gold' | 'diamant';

/**
 * Die beiden Posen des Deckels, aus `chest_normalize.json`.
 *
 * Von Hand im Ausrichter eingestellt (`/?dev=chest`). Zwischen ihnen wird
 * gemischt — Position und Drehung zugleich, sonst hebt der Deckel erst ab und
 * kippt dann, statt aufzuklappen.
 */
const ZU = {
  position: [0.006, 0.291, -0.098] as const,
  rotation: [0.3984, 0, 0] as const,
};
const AUF = {
  position: [0.004, 0.423, -0.083] as const,
  rotation: [0, 0, 0] as const,
};

/**
 * Farbton je Grad.
 *
 * Wird als Multiplikator auf das Material gelegt, nicht als Ersatz: Die
 * gemalte Maserung und die Beschläge bleiben sichtbar, sie bekommen nur einen
 * anderen Ton. `holz` ist weiß — das Modell IST eine Holztruhe, da gibt es
 * nichts einzufärben.
 */
const TOENE: Record<Grad, string> = {
  holz: '#ffffff',
  bronze: '#e0a068',
  silber: '#dfe8ef',
  gold: '#ffd873',
  diamant: '#a8e8f6',
};

function Truhe({
  grad,
  offen,
  sofort,
}: {
  grad: Grad;
  offen: boolean;
  /** Ohne Bewegung — für die kleinen Ansichten in Shop und Aufgabenliste. */
  sofort: boolean;
}): React.JSX.Element {
  const boden = useGLTF(BODEN);
  const deckel = useGLTF(DECKEL);
  const bodenSzene = useMemo(() => boden.scene.clone(true), [boden.scene]);
  const deckelSzene = useMemo(() => deckel.scene.clone(true), [deckel.scene]);

  /**
   * Materialien kopieren, bevor sie eingefärbt werden.
   *
   * `clone()` teilt die Materialien. Ohne die Kopie färbt eine goldene Truhe
   * im Shop jede andere Truhe auf dem Bildschirm gleich mit — auch die
   * hölzerne daneben.
   */
  useEffect(() => {
    const ton = new Color(TOENE[grad]);
    for (const szene of [bodenSzene, deckelSzene]) {
      szene.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        const m = (o.material as MeshStandardMaterial).clone();
        m.color = ton;
        o.material = m;
      });
    }
  }, [bodenSzene, deckelSzene, grad]);

  const gruppe = useRef<Group>(null);

  /**
   * Der Deckel wandert von einer Pose zur anderen.
   *
   * Gemischt wird jedes Bild ein Stück in Richtung Ziel — kein fester Ablauf
   * über eine Dauer. Das ist robuster: Wechselt `offen` mitten in der
   * Bewegung, kehrt sie einfach um, statt zu springen.
   */
  useFrame((_, delta) => {
    const g = gruppe.current;
    if (!g) return;
    const ziel = offen ? AUF : ZU;
    const takt = sofort ? 1 : Math.min(1, delta * 6);
    g.position.x += (ziel.position[0] - g.position.x) * takt;
    g.position.y += (ziel.position[1] - g.position.y) * takt;
    g.position.z += (ziel.position[2] - g.position.z) * takt;
    g.rotation.x += (ziel.rotation[0] - g.rotation.x) * takt;
  });

  return (
    <group>
      <primitive object={bodenSzene} />
      <group
        ref={gruppe}
        position={offen && sofort ? [...AUF.position] : [...ZU.position]}
        rotation={offen && sofort ? [...AUF.rotation] : [...ZU.rotation]}
        scale={[1.02, 1.02, 1.02]}
      >
        <primitive object={deckelSzene} />
      </group>
    </group>
  );
}

export default function Truhe3D({
  grad,
  offen = false,
  sofort = false,
  drehbar = false,
  onBereit,
}: {
  grad: Grad;
  offen?: boolean;
  sofort?: boolean;
  drehbar?: boolean;
  onBereit?: () => void;
}): React.JSX.Element {
  /**
   * Der Anstoß — hier IM Bauteil und nicht beim Aufrufer.
   *
   * Ohne ihn bleibt die Leinwand beim ersten Aufbau leer; sichtbar wird sie
   * erst, wenn die Seite ein Größenereignis sieht. Warum, ist offen (siehe
   * `Avatarwerkstatt.tsx`) — sicher ist nur, was hilft.
   *
   * Die Truhe steht an drei Stellen: im Shop, in der Aufgabenliste und in der
   * Öffnung. Der Anstoß gehört deshalb hierher und nicht dreimal nach außen —
   * sonst vergisst ihn die vierte Stelle.
   *
   * Im Rumpf und ausdrücklich nicht als Bauteil innerhalb von `<Canvas>`:
   * Dort liefe er im Reconciler von R3F und damit zu früh.
   */
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      onBereit?.();
    });
    return () => cancelAnimationFrame(id);
  }, [onBereit]);

  return (
    <Canvas
      /*
        Abstand nach dem Ergebnis bemessen, nicht nach Gefuehl: Bei 2,2 stand
        die Kamera so nah, dass die Truhe im Vollbild links und rechts
        angeschnitten wurde. Die Truhe ist eine Einheit breit und mit offenem
        Deckel gut eine hoch — 3,1 laesst rundherum Luft, auch auf einem
        schmalen Handy.
      */
      camera={{ position: [0, 0.6, 3.1], fov: 30 }}
      dpr={[1, 2]}
      shadows
    >
      {/* Physikalische Einheiten — siehe die ausführliche Begründung in
          `Avatar3D.tsx`. Werte um 1 ergeben ein sehr dunkles Bild. */}
      <ambientLight intensity={2.4} />
      <hemisphereLight args={['#ffe6bd', '#3a2a1c', 1.5]} />
      <directionalLight
        castShadow
        intensity={3.0}
        position={[2, 3.5, 2.5]}
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight intensity={1.1} position={[-2, 1.5, -2]} />

      <Truhe grad={grad} offen={offen} sofort={sofort} />
      <ContactShadows position={[0, 0.001, 0]} opacity={0.4} scale={2.5} blur={2.2} />

      {drehbar && (
        <OrbitControls
          makeDefault
          target={[0, 0.3, 0]}
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI * 0.2}
          maxPolarAngle={Math.PI * 0.5}
          enableDamping
        />
      )}
    </Canvas>
  );
}
