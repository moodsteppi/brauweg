import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import { CanvasTexture, DoubleSide, ExtrudeGeometry, Group, MeshStandardMaterial, PointLight, RepeatWrapping, Shape, SRGBColorSpace } from 'three';
import type { Grad } from './api';
import { begrenze, truhenPose, TRUHEN_STIL } from './truhen-ablauf';
export type { Grad } from './api';

/** Gewölbter Deckel und seine Beschläge teilen exakt dieselbe Rundung. */
function bogen(breite: number, ring = false): ExtrudeGeometry {
  const s = new Shape();
  s.absarc(0, 0, ring ? 0.405 : 0.37, 0, Math.PI, false);
  if (ring) { s.lineTo(-0.376, 0); s.absarc(0, 0, 0.376, Math.PI, 0, true); }
  else s.lineTo(0.37, 0);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: breite, bevelEnabled: !ring, bevelSize: 0.014, bevelThickness: 0.014, bevelSegments: 2, curveSegments: 12 });
  g.translate(0, 0, -breite / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

function stern(): Shape {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const winkel = Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 === 0 ? 0.105 : 0.049;
    const x = Math.cos(winkel) * r, y = Math.sin(winkel) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

/** Kleine gemalte Oberflächen aus dem Code: keine Bilddateien oder Netzabrufe. */
function oberflaeche(schatten = false): CanvasTexture {
  const bild = document.createElement('canvas'); bild.width = 256; bild.height = schatten ? 256 : 128;
  const stift = bild.getContext('2d')!;
  if (schatten) {
    const g = stift.createRadialGradient(128, 128, 8, 128, 128, 126);
    g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(.5, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    stift.fillStyle = g; stift.fillRect(0, 0, 256, 256);
  } else {
    const g = stift.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#fff1d6'); g.addColorStop(.5, '#d8c6a7'); g.addColorStop(1, '#f9e6c4');
    stift.fillStyle = g; stift.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 42; i++) {
      const y = (i * 31) % 128, x = (i * 67) % 200 - 40;
      stift.strokeStyle = i % 3 === 0 ? '#76624844' : '#fff6e044'; stift.lineWidth = i % 4 === 0 ? 1.3 : .7;
      stift.beginPath(); stift.moveTo(x, y); stift.bezierCurveTo(x + 34, y - 6, x + 75, y + 7, x + 142, y - 1); stift.stroke();
    }
  }
  const textur = new CanvasTexture(bild); textur.colorSpace = SRGBColorSpace;
  if (!schatten) { textur.wrapS = RepeatWrapping; textur.wrapT = RepeatWrapping; }
  return textur;
}

type Punkt = [number, number, number];
function Quader({ ort, mass, material, radius = 0.018 }: { ort: Punkt; mass: Punkt; material: MeshStandardMaterial; radius?: number }) {
  return <RoundedBox position={ort} args={mass} radius={radius} smoothness={2} material={material} />;
}

/** Eigene Formen statt einer Einfärbung: Holzplanken, Metallbeschläge, Sterne und Kristalle. */
function Truhe({ grad, offen, sofort, feier, onBereit }: { grad: Grad; offen: boolean; sofort: boolean; feier: boolean; onBereit?: () => void }) {
  const stil = TRUHEN_STIL[grad];
  const gruppe = useRef<Group>(null);
  const deckel = useRef<Group>(null);
  const schwall = useRef<Group>(null);
  const funken = useRef<Group>(null);
  const licht = useRef<PointLight>(null);
  const seit = useRef<number | null>(null);
  const holz = useMemo(() => oberflaeche(), []);
  useEffect(() => () => holz.dispose(), [holz]);
  const material = useMemo(() => ({
    panel: new MeshStandardMaterial({ color: stil.panel, map: grad === 'holz' || grad === 'bronze' ? holz : null, roughness: grad === 'holz' ? 0.66 : 0.36, metalness: grad === 'holz' ? 0.05 : 0.25 }),
    innen: new MeshStandardMaterial({ color: stil.innen, roughness: 0.9, side: DoubleSide }),
    metall: new MeshStandardMaterial({ color: stil.metall, metalness: stil.metallisch, roughness: 0.28 }),
    akzent: new MeshStandardMaterial({ color: stil.akzent, metalness: 0.5, roughness: 0.22 }),
    kristall: new MeshStandardMaterial({ color: stil.akzent, metalness: 0.3, roughness: 0.1, emissive: stil.akzent, emissiveIntensity: 0.18, flatShading: true }),
    muenze: new MeshStandardMaterial({ color: '#ffd16b', metalness: 0.65, roughness: 0.25 }),
  }), [grad, stil, holz]);
  const form = useMemo(() => ({ deckel: bogen(1.16), band: bogen(0.10, true), stern: new ExtrudeGeometry(stern(), { depth: 0.022, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, steps: 1 }) }), []);
  useEffect(() => () => {
    Object.values(material).forEach(m => m.dispose());
  }, [material]);
  useEffect(() => () => Object.values(form).forEach(g => g.dispose()), [form]);
  // Erst melden, wenn der Inhalt des Canvas wirklich montiert ist; vorher bleibt die Bildvorschau stehen.
  useEffect(() => { onBereit?.(); }, [onBereit]);

  useFrame(({ clock }) => {
    if (!gruppe.current || !deckel.current) return;
    if (offen && seit.current === null) seit.current = clock.elapsedTime;
    if (!offen) seit.current = null;
    const t = seit.current === null ? -1 : sofort ? 10 : clock.elapsedTime - seit.current;
    const pose = truhenPose(t);
    deckel.current.rotation.x = offen ? pose.deckel : 0;
    gruppe.current.position.y = offen ? pose.hoehe : sofort ? 0 : Math.sin(clock.elapsedTime * 1.6) * 0.015;
    gruppe.current.rotation.z = offen && !sofort ? pose.wackeln : 0;
    gruppe.current.rotation.y = offen && !sofort ? Math.sin(begrenze(t / 1.5) * Math.PI * 2) * 0.09 : 0;
    gruppe.current.scale.set(1 / Math.sqrt(pose.stauchen), pose.stauchen, 1);
    if (licht.current) licht.current.intensity = offen ? pose.licht * 2.2 : 0;
    schwall.current?.children.forEach((objekt, i) => {
      const lauf = pose.muenzen - i * 0.035;
      const sichtbar = feier && !sofort && offen && lauf > 0 && lauf < 1.7;
      objekt.visible = sichtbar;
      if (!sichtbar) return;
      const winkel = i * 2.39996;
      const geschwindigkeit = 0.35 + (i % 4) * 0.12;
      objekt.position.set(Math.cos(winkel) * lauf * geschwindigkeit, 0.6 + 2.1 * lauf - 1.6 * lauf * lauf, 0.14 + Math.sin(winkel) * lauf * geschwindigkeit);
      objekt.rotation.set(lauf * 5 + i, winkel + lauf * 3, lauf * 2);
      objekt.scale.setScalar(Math.min(1, lauf * 8) * Math.min(1, (1.7 - lauf) * 3));
    });
    funken.current?.children.forEach((objekt, i) => {
      const lauf = t - 0.72 - (i % 5) * 0.06;
      objekt.visible = feier && !sofort && offen && lauf > 0 && lauf < 2.2;
      if (!objekt.visible) return;
      const winkel = i * 2.39996;
      objekt.position.set(Math.cos(winkel) * (0.18 + lauf * 0.48), 0.65 + lauf * (0.45 + i % 3 * 0.15), Math.sin(winkel) * (0.15 + lauf * 0.3));
      objekt.rotation.set(lauf, winkel, lauf * 2);
      objekt.scale.setScalar(Math.sin(begrenze(lauf / 2.2) * Math.PI));
    });
  });

  const edel = grad === 'gold' || grad === 'diamant';
  return <group>
    <group ref={gruppe}>
      {/* Vier Wände statt einer Vollbox: Der geöffnete Deckel gibt einen echten Innenraum frei. */}
      <Quader ort={[0, 0.075, 0]} mass={[1.16, 0.12, 0.72]} material={material.innen} />
      {[-1, 1].map(seite => <group key={seite}>
        <Quader ort={[0, 0.31, seite * 0.33]} mass={[1.16, 0.43, 0.09]} material={material.panel} />
        <Quader ort={[seite * 0.54, 0.31, 0]} mass={[0.09, 0.43, 0.65]} material={material.panel} />
        <Quader ort={[0, 0.12, seite * 0.37]} mass={[1.22, 0.095, 0.08]} material={material.metall} />
        <Quader ort={[0, 0.51, seite * 0.36]} mass={[1.22, 0.07, 0.10]} material={material.metall} />
        <Quader ort={[seite * 0.56, 0.51, 0]} mass={[0.10, 0.07, 0.68]} material={material.metall} />
        {[-1, 1].map(vorne => <group key={vorne}>
          <Quader ort={[seite * 0.39, 0.31, vorne * 0.38]} mass={[0.105, 0.44, 0.06]} material={material.metall} />
          <Quader ort={[seite * 0.53, 0.09, vorne * 0.3]} mass={[0.20, 0.15, 0.20]} material={material.metall} />
          {[0.16, 0.46].map(y => <mesh key={y} position={[seite * 0.39, y, vorne * 0.42]} material={material.akzent}><sphereGeometry args={[0.027, 10, 6]} /></mesh>)}
        </group>)}
      </group>)}
      {/* Die schmalen Fugen geben der Holztruhe echte Planken, auch ohne Texturdownload. */}
      {[0.22, 0.38].map(y => <Quader key={y} ort={[0, y, 0.379]} mass={[1.05, 0.012, 0.008]} material={material.innen} radius={0.003} />)}
      <Quader ort={[0, 0.34, 0.415]} mass={[0.19, 0.24, 0.07]} material={material.akzent} radius={0.025} />
      <mesh position={[0, 0.365, 0.455]} material={material.innen}><circleGeometry args={[0.027, 12]} /></mesh>
      <Quader ort={[0, 0.326, 0.457]} mass={[0.024, 0.05, 0.012]} material={material.innen} radius={0.004} />
      <group ref={deckel} position={[0, 0.545, -0.36]}>
        <group position={[0, 0, 0.36]}>
          <mesh geometry={form.deckel} material={material.panel} />
          {[-0.39, 0.39].map(x => <mesh key={x} position={[x, 0, 0]} geometry={form.band} material={material.metall} />)}
          <Quader ort={[0, 0.014, 0]} mass={[1.19, 0.045, 0.74]} material={material.metall} />
          <Quader ort={[0, -0.014, 0]} mass={[0.96, 0.012, 0.53]} material={material.innen} radius={0.004} />
          <Quader ort={[0, 0.08, 0.357]} mass={[0.13, 0.18, 0.07]} material={material.metall} />
          {grad !== 'holz' && <group position={[0, 0.19, 0.335]}>
            <mesh material={material.metall} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.15, 0.15, 0.05, edel ? 8 : 6]} /></mesh>
            {grad === 'diamant' ? <mesh material={material.kristall} scale={[1, 1.15, 0.48]} position={[0, 0, 0.055]}><octahedronGeometry args={[0.145]} /></mesh>
              : <mesh geometry={form.stern} material={material.akzent} position={[0, 0, 0.055]} />}
          </group>}
        </group>
      </group>
      {edel && [-1, 1].map(seite => <group key={seite}>
        <mesh position={[seite * 0.39, 0.31, 0.43]} material={grad === 'diamant' ? material.kristall : material.akzent} scale={[1, 1.2, 0.45]}><octahedronGeometry args={[0.065]} /></mesh>
        {grad === 'diamant' && <mesh position={[seite * 0.53, 0.13, 0.418]} material={material.kristall} scale={[1, 1, 0.5]}><octahedronGeometry args={[0.048]} /></mesh>}
      </group>)}
      <pointLight ref={licht} position={[0, 0.67, 0.1]} color={stil.licht} intensity={0} distance={3} decay={2} />
    </group>
    <group ref={schwall}>
      {Array.from({ length: 14 }, (_, i) => <mesh key={i} visible={false} material={material.muenze}><cylinderGeometry args={[0.06, 0.06, 0.015, 16]} /></mesh>)}
    </group>
    <group ref={funken}>
      {Array.from({ length: stil.funken }, (_, i) => <mesh key={i} visible={false} material={material.kristall}><octahedronGeometry args={[i % 3 === 0 ? 0.025 : 0.012]} /></mesh>)}
    </group>
  </group>;
}

/** Eine kleine Szene, ohne HDR, Modell-Downloads, Schattenpässe oder Nachbearbeitung. */
export default function Truhe3D({ grad, offen = false, sofort = false, drehbar = false, feier = false, onBereit }: {
  grad: Grad; offen?: boolean; sofort?: boolean; drehbar?: boolean; feier?: boolean; onBereit?: () => void;
}): React.JSX.Element {
  const schatten = useMemo(() => oberflaeche(true), []);
  useEffect(() => () => schatten.dispose(), [schatten]);
  return <Canvas camera={{ position: [1.6, 1.25, 2.8], fov: 33 }} dpr={[1, 1.5]} frameloop={sofort && !drehbar ? 'demand' : 'always'} gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}>
    <ambientLight intensity={1.5} />
    <hemisphereLight args={['#e3f0ff', '#635039', 1.4]} />
    <directionalLight intensity={3.5} position={[-2, 4, 3]} color="#fff0d3" />
    <directionalLight intensity={2.2} position={[3, 2, -2]} color="#8dbfff" />
    <group position={[0, -0.43, 0]}>
      <Truhe grad={grad} offen={offen} sofort={sofort} feier={feier} onBereit={onBereit} />
      <mesh position={[0, -0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2, 1.65]} /><meshBasicMaterial map={schatten} transparent depthWrite={false} /></mesh>
    </group>
    {drehbar && <OrbitControls makeDefault target={[0, 0, 0]} enablePan={false} enableZoom={false} minPolarAngle={Math.PI * 0.2} maxPolarAngle={Math.PI * 0.5} enableDamping />}
  </Canvas>;
}
