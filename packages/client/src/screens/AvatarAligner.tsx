import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, ContactShadows, Environment, OrbitControls, useGLTF } from '@react-three/drei';

/** Startwerte aus brauweg-art/3d/avatar_normalize.json (gerundet). */
const DEFAULT = {
  position: [0.002, 0.988, 0.045] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: 1,
};

type BeanieTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
};

function PenguinWithBeanie({ beanie }: { beanie: BeanieTransform }): React.JSX.Element {
  const penguin = useGLTF('/3d/penguin_base.glb');
  const hat = useGLTF('/3d/beanie.glb');
  const penguinScene = useMemo(() => penguin.scene.clone(true), [penguin.scene]);
  const hatScene = useMemo(() => hat.scene.clone(true), [hat.scene]);
  const s = beanie.scale;

  return (
    <group>
      <primitive object={penguinScene} />
      <group position={beanie.position} rotation={beanie.rotation} scale={[s, s, s]}>
        <primitive object={hatScene} />
      </group>
    </group>
  );
}

useGLTF.preload('/3d/penguin_base.glb');
useGLTF.preload('/3d/beanie.glb');

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}): React.JSX.Element {
  return (
    <label className="avatar-align-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        className="avatar-align-num"
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(value.toFixed(4))}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function toClipboardJson(t: BeanieTransform): string {
  const s = Number(t.scale.toFixed(4));
  return JSON.stringify(
    {
      position: t.position.map((n) => Number(n.toFixed(4))),
      rotation: t.rotation.map((n) => Number(n.toFixed(4))),
      scale: [s, s, s],
    },
    null,
    2,
  );
}

/**
 * Entwickler-Werkzeug: Mütze visuell auf dem 3D-Pinguin ausrichten.
 * Öffnen mit `/?dev=avatar` — ohne Anmeldung.
 */
export function AvatarAligner(): React.JSX.Element {
  const [position, setPosition] = useState<[number, number, number]>([...DEFAULT.position]);
  const [rotation, setRotation] = useState<[number, number, number]>([...DEFAULT.rotation]);
  const [scale, setScale] = useState(DEFAULT.scale);
  const [copied, setCopied] = useState(false);

  const beanie = useMemo(
    () => ({ position, rotation, scale }),
    [position, rotation, scale],
  );

  const setPos = (i: 0 | 1 | 2, v: number): void => {
    setPosition((p) => {
      const n: [number, number, number] = [...p];
      n[i] = v;
      return n;
    });
  };

  const setRot = (i: 0 | 1 | 2, v: number): void => {
    setRotation((r) => {
      const n: [number, number, number] = [...r];
      n[i] = v;
      return n;
    });
  };

  const copy = async (): Promise<void> => {
    const text = toClipboardJson(beanie);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback für ältere Browser / unsichere Kontexte
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="avatar-align">
      <header className="avatar-align-head">
        <strong>3D-Avatar · Mütze ausrichten</strong>
        <span className="muted">Drehen mit Maus · Werte unten kopieren</span>
      </header>

      <div className="avatar-align-stage">
        <Canvas camera={{ position: [1.4, 1.1, 1.6], fov: 35 }} shadows>
          <color attach="background" args={['#2a1f18']} />
          <ambientLight intensity={0.55} />
          <directionalLight
            castShadow
            intensity={1.15}
            position={[2.5, 4, 2]}
            shadow-mapSize={[1024, 1024]}
          />
          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.35}>
              <PenguinWithBeanie beanie={beanie} />
            </Bounds>
            <ContactShadows position={[0, 0.001, 0]} opacity={0.45} scale={3} blur={2.2} />
            <Environment preset="warehouse" />
          </Suspense>
          <OrbitControls makeDefault target={[0, 0.55, 0]} minDistance={0.6} maxDistance={6} />
          <gridHelper args={[4, 16, '#5a4030', '#3a2a20']} position={[0, 0, 0]} />
        </Canvas>
      </div>

      <aside className="avatar-align-panel">
        <h2>Position</h2>
        <SliderRow label="X" value={position[0]} min={-0.5} max={0.5} step={0.001} onChange={(v) => setPos(0, v)} />
        <SliderRow label="Y" value={position[1]} min={0.5} max={1.4} step={0.001} onChange={(v) => setPos(1, v)} />
        <SliderRow label="Z" value={position[2]} min={-0.5} max={0.5} step={0.001} onChange={(v) => setPos(2, v)} />

        <h2>Rotation (rad)</h2>
        <SliderRow label="X" value={rotation[0]} min={-Math.PI} max={Math.PI} step={0.01} onChange={(v) => setRot(0, v)} />
        <SliderRow label="Y" value={rotation[1]} min={-Math.PI} max={Math.PI} step={0.01} onChange={(v) => setRot(1, v)} />
        <SliderRow label="Z" value={rotation[2]} min={-Math.PI} max={Math.PI} step={0.01} onChange={(v) => setRot(2, v)} />

        <h2>Größe</h2>
        <SliderRow label="Scale" value={scale} min={0.4} max={2} step={0.01} onChange={setScale} />

        <div className="avatar-align-actions">
          <button type="button" className="avatar-align-copy" onClick={() => void copy()}>
            {copied ? 'Kopiert ✓' : 'Werte kopieren'}
          </button>
          <button
            type="button"
            className="avatar-align-reset"
            onClick={() => {
              setPosition([...DEFAULT.position]);
              setRotation([...DEFAULT.rotation]);
              setScale(DEFAULT.scale);
            }}
          >
            Zurücksetzen
          </button>
        </div>

        <pre className="avatar-align-json">{toClipboardJson(beanie)}</pre>
      </aside>
    </div>
  );
}
