import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, ContactShadows, Environment, OrbitControls, useGLTF } from '@react-three/drei';

/** Aus chest_normalize.json — visuell eingestellt. */
const LID_OPEN = {
  position: [0.004, 0.423, -0.083] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: 1.02,
};

const LID_CLOSED = {
  position: [0.006, 0.291, -0.098] as [number, number, number],
  rotation: [0.3984, 0, 0] as [number, number, number],
  scale: 1.02,
};

type LidPose = 'open' | 'closed';

type LidTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
};

function poseOf(p: LidPose): typeof LID_CLOSED {
  return p === 'open' ? LID_OPEN : LID_CLOSED;
}

function ChestParts({ lid }: { lid: LidTransform }): React.JSX.Element {
  const bottom = useGLTF('/3d/chest/chest_bottom.glb');
  const top = useGLTF('/3d/chest/chest_top.glb');
  const bottomScene = useMemo(() => bottom.scene.clone(true), [bottom.scene]);
  const topScene = useMemo(() => top.scene.clone(true), [top.scene]);
  const s = lid.scale;

  return (
    <group>
      <primitive object={bottomScene} />
      <group position={lid.position} rotation={lid.rotation} scale={[s, s, s]}>
        <primitive object={topScene} />
      </group>
    </group>
  );
}

useGLTF.preload('/3d/chest/chest_bottom.glb');
useGLTF.preload('/3d/chest/chest_top.glb');

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

function toClipboardJson(t: LidTransform, pose: LidPose): string {
  const s = Number(t.scale.toFixed(4));
  return JSON.stringify(
    {
      pose,
      position: t.position.map((n) => Number(n.toFixed(4))),
      rotation: t.rotation.map((n) => Number(n.toFixed(4))),
      scale: [s, s, s],
    },
    null,
    2,
  );
}

/**
 * Entwickler-Werkzeug: Truhen-Deckel auf dem Korpus ausrichten.
 * Öffnen mit `/?dev=chest` — ohne Anmeldung.
 */
export function ChestAligner(): React.JSX.Element {
  const [pose, setPose] = useState<LidPose>('closed');
  const start = poseOf('closed');
  const [position, setPosition] = useState<[number, number, number]>([...start.position]);
  const [rotation, setRotation] = useState<[number, number, number]>([...start.rotation]);
  const [scale, setScale] = useState(start.scale);
  const [copied, setCopied] = useState(false);

  const lid = useMemo(() => ({ position, rotation, scale }), [position, rotation, scale]);

  const applyPose = (p: LidPose): void => {
    const t = poseOf(p);
    setPose(p);
    setPosition([...t.position]);
    setRotation([...t.rotation]);
    setScale(t.scale);
  };

  const setPos = (i: 0 | 1 | 2, v: number): void => {
    setPosition((prev) => {
      const n: [number, number, number] = [...prev];
      n[i] = v;
      return n;
    });
  };

  const setRot = (i: 0 | 1 | 2, v: number): void => {
    setRotation((prev) => {
      const n: [number, number, number] = [...prev];
      n[i] = v;
      return n;
    });
  };

  const copy = async (): Promise<void> => {
    const text = toClipboardJson(lid, pose);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
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
        <strong>3D-Truhe · Deckel ausrichten</strong>
        <span className="muted">Korpus fest · Deckel mit Reglern · Werte kopieren</span>
      </header>

      <div className="avatar-align-stage">
        <Canvas camera={{ position: [1.6, 1.0, 1.8], fov: 35 }} shadows>
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
              <ChestParts lid={lid} />
            </Bounds>
            <ContactShadows position={[0, 0.001, 0]} opacity={0.45} scale={3} blur={2.2} />
            <Environment preset="warehouse" />
          </Suspense>
          <OrbitControls makeDefault target={[0, 0.35, 0]} minDistance={0.5} maxDistance={8} />
          <gridHelper args={[4, 16, '#5a4030', '#3a2a20']} position={[0, 0, 0]} />
        </Canvas>
      </div>

      <aside className="avatar-align-panel">
        <h2>Pose</h2>
        <div className="avatar-align-actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className={pose === 'closed' ? 'avatar-align-copy' : 'avatar-align-reset'}
            onClick={() => applyPose('closed')}
          >
            Geschlossen
          </button>
          <button
            type="button"
            className={pose === 'open' ? 'avatar-align-copy' : 'avatar-align-reset'}
            onClick={() => applyPose('open')}
          >
            Offen
          </button>
        </div>

        <h2>Deckel · Position</h2>
        <SliderRow label="X" value={position[0]} min={-0.5} max={0.5} step={0.001} onChange={(v) => setPos(0, v)} />
        <SliderRow label="Y" value={position[1]} min={0} max={1.2} step={0.001} onChange={(v) => setPos(1, v)} />
        <SliderRow label="Z" value={position[2]} min={-0.5} max={0.5} step={0.001} onChange={(v) => setPos(2, v)} />

        <h2>Deckel · Rotation (rad)</h2>
        <SliderRow label="X" value={rotation[0]} min={-Math.PI} max={Math.PI} step={0.01} onChange={(v) => setRot(0, v)} />
        <SliderRow label="Y" value={rotation[1]} min={-Math.PI} max={Math.PI} step={0.01} onChange={(v) => setRot(1, v)} />
        <SliderRow label="Z" value={rotation[2]} min={-Math.PI} max={Math.PI} step={0.01} onChange={(v) => setRot(2, v)} />

        <h2>Deckel · Größe</h2>
        <SliderRow label="Scale" value={scale} min={0.5} max={1.5} step={0.01} onChange={setScale} />

        <div className="avatar-align-actions">
          <button type="button" className="avatar-align-copy" onClick={() => void copy()}>
            {copied ? 'Kopiert ✓' : 'Werte kopieren'}
          </button>
          <button type="button" className="avatar-align-reset" onClick={() => applyPose(pose)}>
            Pose zurücksetzen
          </button>
        </div>

        <pre className="avatar-align-json">{toClipboardJson(lid, pose)}</pre>
      </aside>
    </div>
  );
}
