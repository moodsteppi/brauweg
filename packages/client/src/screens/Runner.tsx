import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Sky, useGLTF } from '@react-three/drei';
import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Group,
  LoopOnce,
  LoopRepeat,
  MathUtils,
  Vector3,
  type AnimationAction,
  type Mesh as MeshType,
  type Object3D,
} from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

import { api } from '../api';

/**
 * Endless-Runner (`/?dev=runner`) — Subway-Surfers-Feeling:
 * viele Sprung-/Rutsch-Hindernisse, Büsche, selten Autos/Scooter die auf dich zufahren.
 */

const ANIM = '/3d/subway/penguin_anim.glb';
const OBS_SCOOTER = '/3d/subway/obstacle_scooter.glb';
const OBS_SILVER = '/3d/subway/obstacle_silver.glb';
const OBS_BMW = '/3d/subway/obstacle_bmw.glb';
const PROP = '/3d/subway';

const LANE_WIDTH = 2.5;
const CHUNK_LENGTH = 28;
const NUM_CHUNKS = 6;
const BASE_SPEED = 16;
/** Sprung: Peak ≈ v²/(2g) ≈ 1,6 m — klar über Jump-Props */
const JUMP_FORCE = 9;
const GRAVITY = -26;
/** Rutschdauer — lang genug für ein Tor */
const SLIDE_MS = 900;
/** Stehende Figur (Füße = Origin nach groundFeet) */
const PINGUIN_HOEHE = 1.15;
/** Beim Rutschen: nur zusammenducken, Füße bleiben am Boden */
const SLIDE_SCALE_Y = 0.48;
/** Kopfhöhe beim Rutschen ≈ PINGUIN_HOEHE * SLIDE_SCALE_Y */
const SLIDE_HEAD_Y = PINGUIN_HOEHE * SLIDE_SCALE_Y;
const PLAYER_Z = 2.4;
const GROUND_Y = 0;
/**
 * Sprung-Hindernisse: Füße müssen darüber.
 * Props sind ≤ JUMP_PROP_MAX; etwas Luft nach oben.
 */
const JUMP_PROP_MAX = 0.62;
const CLEAR_JUMP_Y = JUMP_PROP_MAX + 0.08;
/** Fahrzeuge etwas höher — Sprung muss höher tragen */
const CLEAR_VEHICLE_Y = 0.88;
/**
 * Slide-Tore: Querbalken-Unterkante (logisch).
 * Stehend (Kopf ~1,15) trifft; geduckt (Kopf ~0,55) passt darunter.
 */
const SLIDE_CLEARANCE = 0.72;
/** Feste Z-Positionen im Chunk — Hindernisse bewegen sich nicht selbst */
const SLOT_Z = [-10, -5, 0, 5, 10] as const;

type Phase = 'menu' | 'flee' | 'lobby' | 'run' | 'dead';
type Pose = 'flee' | 'run' | 'idle';
type VehicleKind = 'scooter' | 'silver' | 'bmw';
/** jump/bush = drüberspringen, slide = darunter, vehicle = springen/ausweichen */
type HazardRole = 'jump' | 'bush' | 'slide' | 'vehicle';
type JumpProp =
  | 'crate'
  | 'suitcase'
  | 'trashbags'
  | 'cone'
  | 'barrel'
  | 'boxes'
  | 'bench'
  | 'planter'
  | 'keg'
  | 'bike'
  | 'barrier'
  | 'cart';
type BushProp = 'bush' | 'planter';
type SlideProp = 'banner' | 'scaffold' | 'garland';

/** Nach Flee: 5 s Lobby (Hindernisse sichtbar), dann Kollision */
const LOBBY_MS = 5000;

type GameState = {
  lane: -1 | 0 | 1;
  isJumping: boolean;
  isSliding: boolean;
  slideUntil: number;
  yVelocity: number;
  speed: number;
  distance: number;
  phase: Phase;
  /** Füße (Boden / Sprung) */
  playerPosition: Vector3;
  /** Aktuelle Kopfhöhe für Kollision (steht / rutscht) */
  headY: number;
};

const OBSTACLE_URLS: Record<VehicleKind, string> = {
  scooter: OBS_SCOOTER,
  silver: OBS_SILVER,
  bmw: OBS_BMW,
};

/** Niedrig genug, dass der Sprung klar drüber geht */
const VEHICLE_H: Record<VehicleKind, number> = {
  scooter: 0.72,
  silver: 0.68,
  bmw: 0.64,
};

const JUMP_PROPS: JumpProp[] = [
  'crate',
  'suitcase',
  'trashbags',
  'cone',
  'barrel',
  'boxes',
  'bench',
  'planter',
  'keg',
  'bike',
  'barrier',
  'cart',
];
const BUSH_PROPS: BushProp[] = ['bush', 'planter'];
const SLIDE_PROPS: SlideProp[] = ['banner', 'scaffold', 'garland'];

/** Jump-Props: alle unter CLEAR_JUMP_Y */
const JUMP_H: Record<JumpProp, number> = {
  crate: 0.58,
  suitcase: 0.48,
  trashbags: 0.55,
  cone: 0.58,
  barrel: 0.62,
  boxes: 0.6,
  bench: 0.5,
  planter: 0.58,
  keg: 0.62,
  bike: 0.62,
  barrier: 0.5,
  cart: 0.62,
};

const BUSH_H: Record<BushProp, number> = {
  bush: 0.6,
  planter: 0.58,
};

/**
 * Overhead-Tore: Gesamtmodell hoch, damit der freie Durchlass
 * (Unterkante ≈ SLIDE_CLEARANCE) zum geduckt Rutschen passt.
 */
const SLIDE_H: Record<SlideProp, number> = {
  banner: 2.15,
  scaffold: 2.2,
  garland: 2.1,
};

function propGlb(name: string): string {
  return `${PROP}/prop_${name}.glb`;
}

/** Nicht alle Props beim Modulstart vorladen — sonst knallt ein 404 die ganze Seite. */
function preloadRunnerAssets(): void {
  useGLTF.preload(ANIM);
  useGLTF.preload(OBS_SCOOTER);
  useGLTF.preload(OBS_SILVER);
  useGLTF.preload(OBS_BMW);
  for (const p of JUMP_PROPS) useGLTF.preload(propGlb(p));
  for (const p of BUSH_PROPS) useGLTF.preload(propGlb(p));
  for (const p of SLIDE_PROPS) useGLTF.preload(propGlb(p));
}

function randomLane(): -1 | 0 | 1 {
  return (Math.floor(Math.random() * 3) - 1) as -1 | 0 | 1;
}

function pickRole(): HazardRole {
  const r = Math.random();
  if (r < 0.4) return 'jump';
  if (r < 0.58) return 'bush';
  if (r < 0.82) return 'slide';
  return 'vehicle';
}

function pickVehicle(): VehicleKind {
  const kinds: VehicleKind[] = ['scooter', 'silver', 'bmw'];
  return kinds[Math.floor(Math.random() * kinds.length)]!;
}

function pickOne<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

function fitToHeight(root: Object3D, targetH: number): void {
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  if (size.y < 0.001) return;
  root.scale.setScalar(targetH / size.y);
}

function groundFeet(root: Object3D): void {
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  root.position.y -= box.min.y;
}

function prepareStatic(source: Object3D, targetH: number): Group {
  const root = new Group();
  const clone = source.clone(true);
  clone.traverse((o) => {
    const mesh = o as MeshType;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
  });
  root.add(clone);
  fitToHeight(root, targetH);
  groundFeet(root);
  return root;
}

type PenguinKit = {
  root: Group;
  mixer: AnimationMixer;
  flee: AnimationAction;
  run: AnimationAction;
  hip: Object3D | null;
  hipRest: Vector3;
  /** Lokale Y nach einmaligem Grounden — nie per Welt-BBox nachjustieren */
  groundedY: number;
};

function stripRootMotion(clip: AnimationClip): AnimationClip {
  const tracks = clip.tracks.filter((t) => {
    const n = t.name;
    return !(
      n === 'Root.position' ||
      n === 'Hip.position' ||
      n.endsWith('/Root.position') ||
      n.endsWith('/Hip.position')
    );
  });
  return new AnimationClip(clip.name, clip.duration, tracks);
}

function buildPenguin(source: Object3D, clips: AnimationClip[]): PenguinKit {
  const root = new Group();
  const orient = new Group();
  orient.rotation.x = Math.PI / 2 - Math.PI / 4;
  orient.rotation.y = Math.PI;

  const model = cloneSkinned(source);
  let hipBone: Object3D | undefined;
  model.traverse((o) => {
    if (o.name === 'Hip') hipBone = o;
    const mesh = o as MeshType;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
  });
  orient.add(model);
  root.add(orient);

  const hip = hipBone ?? null;
  const hipRest = hip ? hip.position.clone() : new Vector3();
  const mixer = new AnimationMixer(model);
  if (!clips[0]) {
    fitToHeight(root, PINGUIN_HOEHE);
    groundFeet(root);
    const groundedY = root.position.y;
    const dummy = mixer.clipAction(new AnimationClip('empty', 0, []));
    return { root, mixer, flee: dummy, run: dummy, hip, hipRest, groundedY };
  }
  const flee = mixer.clipAction(stripRootMotion(clips[0]));
  flee.setLoop(LoopOnce, 1);
  flee.clampWhenFinished = true;
  const run = mixer.clipAction(stripRootMotion(clips[1] ?? clips[0]));
  run.setLoop(LoopRepeat, Infinity);

  flee.reset().play();
  mixer.setTime(0);
  if (hip) hip.position.copy(hipRest);
  fitToHeight(root, PINGUIN_HOEHE);
  groundFeet(root);
  flee.stop();
  const groundedY = root.position.y;

  return { root, mixer, flee, run, hip, hipRest, groundedY };
}

function AnimatedPenguin({
  pose,
  onFleeDone,
}: {
  pose: Pose;
  onFleeDone: () => void;
}): React.JSX.Element {
  const gltf = useGLTF(ANIM);
  const kit = useMemo(
    () => buildPenguin(gltf.scene, gltf.animations),
    [gltf.scene, gltf.animations],
  );
  const fleeDone = useRef(false);

  useEffect(() => {
    fleeDone.current = false;
    const { flee, run, mixer } = kit;

    if (pose === 'flee') {
      run.fadeOut(0.15);
      flee.reset().fadeIn(0.05).play();
      const onFinished = (e: { action: AnimationAction }): void => {
        if (e.action !== flee || fleeDone.current) return;
        fleeDone.current = true;
        onFleeDone();
      };
      mixer.addEventListener('finished', onFinished);
      return () => mixer.removeEventListener('finished', onFinished);
    }

    if (pose === 'run') {
      flee.fadeOut(0.2);
      run.reset().fadeIn(0.2).play();
      return;
    }

    flee.stop();
    run.reset().play();
    kit.mixer.setTime(0);
    run.paused = true;
    return () => {
      run.paused = false;
    };
  }, [pose, kit, onFleeDone]);

  useFrame((_, dt) => {
    kit.mixer.update(dt);
    if (kit.hip) kit.hip.position.copy(kit.hipRest);
    // Nur lokale Ground-Y halten — Welt-groundFeet würde den Sprung optisch killen
    kit.root.position.y = kit.groundedY;
  });

  return <primitive object={kit.root} />;
}

function VehicleModel({ kind }: { kind: VehicleKind }): React.JSX.Element {
  const gltf = useGLTF(OBSTACLE_URLS[kind]);
  const model = useMemo(
    () => prepareStatic(gltf.scene, VEHICLE_H[kind]),
    [gltf.scene, kind],
  );
  return <primitive object={model} />;
}

/** 3D-Prop aus GLB, auf Zielhöhe skaliert und auf den Boden gesetzt */
function PropModel({ url, height }: { url: string; height: number }): React.JSX.Element {
  const gltf = useGLTF(url);
  const model = useMemo(
    () => prepareStatic(gltf.scene, height),
    [gltf.scene, height],
  );
  return <primitive object={model} />;
}

/** Deko-Busch am Rand (einfache Geometrie) */
function BushDecor(): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.28, 0]} castShadow>
        <sphereGeometry args={[0.55, 12, 10]} />
        <meshStandardMaterial color="#2f6b2f" />
      </mesh>
      <mesh position={[-0.35, 0.22, 0.15]} castShadow>
        <sphereGeometry args={[0.38, 10, 8]} />
        <meshStandardMaterial color="#3a7a35" />
      </mesh>
      <mesh position={[0.32, 0.2, -0.1]} castShadow>
        <sphereGeometry args={[0.34, 10, 8]} />
        <meshStandardMaterial color="#275c28" />
      </mesh>
    </group>
  );
}

type SlotConfig = {
  role: HazardRole;
  vehicle: VehicleKind;
  jumpProp: JumpProp;
  bushProp: BushProp;
  slideProp: SlideProp;
  lane: -1 | 0 | 1;
  z: number;
  active: boolean;
};

/** Distanz, die die Welt in der Lobby zurücklegt — erste Kollision erst danach. */
const LOBBY_LEAD = BASE_SPEED * (LOBBY_MS / 1000);

function makeSlotConfigs(chunkWorldZ = 0): SlotConfig[] {
  return SLOT_Z.map((z) => {
    const role = pickRole();
    const worldZ = chunkWorldZ + z;
    const distanceAhead = PLAYER_Z - worldZ;
    // Sichtbar in der Lobby, aber erst nach ~5s am Spieler → Kollision erst im Run
    const arrivesAfterLobby = distanceAhead >= LOBBY_LEAD * 0.92;
    return {
      role,
      vehicle: pickVehicle(),
      jumpProp: pickOne(JUMP_PROPS),
      bushProp: pickOne(BUSH_PROPS),
      slideProp: pickOne(SLIDE_PROPS),
      lane: randomLane(),
      z,
      active: Math.random() > 0.12 && arrivesAfterLobby,
    };
  });
}

function HazardVisual({ cfg }: { cfg: SlotConfig }): React.JSX.Element {
  if (cfg.role === 'jump') {
    return (
      <Suspense fallback={null}>
        <PropModel url={propGlb(cfg.jumpProp)} height={JUMP_H[cfg.jumpProp]} />
      </Suspense>
    );
  }
  if (cfg.role === 'bush') {
    return (
      <Suspense fallback={null}>
        <PropModel url={propGlb(cfg.bushProp)} height={BUSH_H[cfg.bushProp]} />
      </Suspense>
    );
  }
  if (cfg.role === 'slide') {
    return (
      <Suspense fallback={null}>
        <PropModel url={propGlb(cfg.slideProp)} height={SLIDE_H[cfg.slideProp]} />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={null}>
      <VehicleModel kind={cfg.vehicle} />
    </Suspense>
  );
}

const CAM_OFFSET = { x: 0, y: 3.4, z: 5.8 } as const;
const CAM_LOOK_AHEAD = { y: 0.7, z: -4.0 } as const;

function CameraRig({ gameState }: { gameState: React.MutableRefObject<GameState> }): null {
  useFrame(({ camera }, delta) => {
    const pos = gameState.current.playerPosition;
    const camY = CAM_OFFSET.y + Math.max(0, pos.y) * 0.35;
    camera.position.x = MathUtils.lerp(camera.position.x, pos.x + CAM_OFFSET.x, 8 * delta);
    camera.position.y = MathUtils.lerp(camera.position.y, camY, 6 * delta);
    camera.position.z = PLAYER_Z + CAM_OFFSET.z;
    camera.lookAt(pos.x, CAM_LOOK_AHEAD.y + pos.y * 0.25, PLAYER_Z + CAM_LOOK_AHEAD.z);
  });
  return null;
}

function Player({
  gameState,
  pose,
  onFleeDone,
}: {
  gameState: React.MutableRefObject<GameState>;
  pose: Pose;
  onFleeDone: () => void;
}): React.JSX.Element {
  const playerRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);

  useFrame((_, delta) => {
    const gs = gameState.current;
    if (!playerRef.current || gs.phase === 'dead') return;
    const dt = Math.min(delta, 0.05);

    const targetX = gs.lane * LANE_WIDTH;
    playerRef.current.position.x = MathUtils.lerp(playerRef.current.position.x, targetX, 12 * dt);

    if (gs.isSliding && performance.now() >= gs.slideUntil) {
      gs.isSliding = false;
    }

    if (gs.isJumping) {
      gs.yVelocity += GRAVITY * dt;
      playerRef.current.position.y += gs.yVelocity * dt;
      if (playerRef.current.position.y <= GROUND_Y) {
        playerRef.current.position.y = GROUND_Y;
        gs.isJumping = false;
        gs.yVelocity = 0;
      }
    } else {
      playerRef.current.position.y = GROUND_Y;
    }

    if (bodyRef.current) {
      /**
       * Rutschen = ducken am Boden (Scale Y), kein Versenken.
       * Origin sitzt an den Füßen → scale.y schrumpft nach oben, Füße bleiben.
       * Leichte Vorwärtsneigung, kein Purzelbaum durch den Boden.
       */
      const duck = gs.isSliding ? SLIDE_SCALE_Y : 1;
      const lean = gs.isSliding ? 0.42 : gs.isJumping ? -0.18 : 0;
      bodyRef.current.scale.y = MathUtils.lerp(bodyRef.current.scale.y, duck, 16 * dt);
      bodyRef.current.scale.x = MathUtils.lerp(bodyRef.current.scale.x, 1, 16 * dt);
      bodyRef.current.scale.z = MathUtils.lerp(bodyRef.current.scale.z, 1, 16 * dt);
      bodyRef.current.position.y = MathUtils.lerp(bodyRef.current.position.y, 0, 16 * dt);
      bodyRef.current.rotation.x = MathUtils.lerp(bodyRef.current.rotation.x, lean, 14 * dt);
    }

    gs.playerPosition.copy(playerRef.current.position);
    const standHead = gs.playerPosition.y + PINGUIN_HOEHE;
    const slideHead = gs.playerPosition.y + SLIDE_HEAD_Y;
    gs.headY = gs.isSliding ? slideHead : standHead;
  });

  return (
    <group ref={playerRef} position={[0, GROUND_Y, PLAYER_Z]}>
      <group ref={bodyRef}>
        <Suspense fallback={null}>
          <AnimatedPenguin pose={pose} onFleeDone={onFleeDone} />
        </Suspense>
      </group>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={2.6} blur={2.2} />
    </group>
  );
}

function WorldChunk({
  index,
  gameState,
  onCoin,
  onHit,
  resetToken,
}: {
  index: number;
  gameState: React.MutableRefObject<GameState>;
  onCoin: () => void;
  onHit: () => void;
  resetToken: number;
}): React.JSX.Element {
  const groupRef = useRef<Group>(null);
  const slotsRef = useRef<SlotConfig[]>(makeSlotConfigs());
  const hazardGroups = useRef<(Group | null)[]>([]);
  const coinsRef = useRef<(MeshType | null)[]>([]);
  const hitLock = useRef(false);
  const remountQueued = useRef(false);
  const [layoutKey, setLayoutKey] = useState(0);

  const layoutCoins = useCallback((chunkWorldZ: number) => {
    for (const coin of coinsRef.current) {
      if (!coin) continue;
      const localZ = (Math.random() - 0.5) * (CHUNK_LENGTH - 4);
      coin.position.x = randomLane() * LANE_WIDTH;
      coin.position.z = localZ;
      coin.position.y = 0.7 + Math.random() * 0.5;
      const distanceAhead = PLAYER_Z - (chunkWorldZ + localZ);
      // Münzen ebenfalls erst nach Lobby-Lead in Reichweite
      coin.userData.alive = Math.random() > 0.2 && distanceAhead >= LOBBY_LEAD * 0.5;
      coin.visible = false;
    }
  }, []);

  /** Neues Layout — setState nur verzögert (nie synchron in useFrame). */
  const recycleLayout = useCallback(() => {
    hitLock.current = false;
    const z = groupRef.current?.position.z ?? index * -CHUNK_LENGTH;
    slotsRef.current = makeSlotConfigs(z);
    layoutCoins(z);
    if (remountQueued.current) return;
    remountQueued.current = true;
    queueMicrotask(() => {
      remountQueued.current = false;
      setLayoutKey((k) => k + 1);
    });
  }, [index, layoutCoins]);

  useEffect(() => {
    const z = index * -CHUNK_LENGTH;
    if (groupRef.current) groupRef.current.position.z = z;
    hitLock.current = false;
    slotsRef.current = makeSlotConfigs(z);
    layoutCoins(z);
    setLayoutKey((k) => k + 1);
  }, [index, resetToken, layoutCoins]);

  useFrame((_, delta) => {
    const gs = gameState.current;
    if (!groupRef.current) return;

    const scrolling = gs.phase === 'lobby' || gs.phase === 'run';
    const trackVisible = scrolling; // Lobby + Run: Hindernisse schon sichtbar
    const collideOn = gs.phase === 'run'; // Kollision erst nach Lobby
    const slots = slotsRef.current;

    for (let i = 0; i < slots.length; i++) {
      const cfg = slots[i]!;
      const g = hazardGroups.current[i];
      if (!g) continue;
      g.visible = trackVisible && cfg.active;
      g.position.set(cfg.lane * LANE_WIDTH, 0, cfg.z);
    }

    if (!scrolling) return;

    groupRef.current.position.z += gs.speed * delta;

    if (groupRef.current.position.z > CHUNK_LENGTH) {
      groupRef.current.position.z -= NUM_CHUNKS * CHUNK_LENGTH;
      recycleLayout();
    }

    const playerPos = gs.playerPosition;
    const hitX = 0.95;
    const hitZ = 1.1;

    if (collideOn) {
      for (let i = 0; i < slots.length; i++) {
        const cfg = slots[i]!;
        const g = hazardGroups.current[i];
        if (!g?.visible) continue;

        const obsWorldZ = groupRef.current.position.z + cfg.z;
        const dx = Math.abs(playerPos.x - cfg.lane * LANE_WIDTH);
        const dz = Math.abs(playerPos.z - obsWorldZ);
        if (dx >= hitX || dz >= hitZ) continue;

        let hit = false;
        if (cfg.role === 'jump' || cfg.role === 'bush') {
          // Füße müssen über die Prop-Oberkante
          hit = playerPos.y < CLEAR_JUMP_Y;
        } else if (cfg.role === 'slide') {
          // Stehend zu hoch für den Durchlass; geduckt passt der Kopf darunter
          hit = gs.headY > SLIDE_CLEARANCE;
        } else {
          hit = playerPos.y < CLEAR_VEHICLE_Y;
        }

        if (hit && !hitLock.current) {
          hitLock.current = true;
          onHit();
        }
      }
    }

    for (const coin of coinsRef.current) {
      if (!coin) continue;
      const alive = coin.userData.alive !== false;
      coin.visible = trackVisible && alive;
      if (!alive) continue;
      coin.rotation.y += 3 * delta;
      // Sammeln schon in der Lobby möglich
      const coinWorldZ = groupRef.current.position.z + coin.position.z;
      const dx = Math.abs(playerPos.x - coin.position.x);
      const dz = Math.abs(playerPos.z - coinWorldZ);
      const dy = Math.abs(playerPos.y - coin.position.y);
      if (dx < hitX && dz < hitZ && dy < 1.6) {
        coin.userData.alive = false;
        coin.visible = false;
        onCoin();
      }
    }
  });

  const grass = index % 2 === 0 ? '#4a7c3f' : '#3d6b35';
  const slots = slotsRef.current;

  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[LANE_WIDTH * 3 + 2, CHUNK_LENGTH]} />
        <meshStandardMaterial color={grass} />
      </mesh>
      {([-1, 0, 1] as const).map((lane) => (
        <mesh
          key={lane}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[lane * LANE_WIDTH, 0.02, 0]}
          receiveShadow
        >
          <planeGeometry args={[0.12, CHUNK_LENGTH]} />
          <meshStandardMaterial color="#c9b896" />
        </mesh>
      ))}
      <mesh position={[-(LANE_WIDTH * 1.5 + 0.6), 0.7, 0]} castShadow>
        <boxGeometry args={[0.4, 1.4, CHUNK_LENGTH]} />
        <meshStandardMaterial color="#5c4030" />
      </mesh>
      <mesh position={[LANE_WIDTH * 1.5 + 0.6, 0.7, 0]} castShadow>
        <boxGeometry args={[0.4, 1.4, CHUNK_LENGTH]} />
        <meshStandardMaterial color="#5c4030" />
      </mesh>

      {[-1, 1].map((side) =>
        [-8, -2, 5].map((z) => (
          <group key={`${side}-${z}`} position={[side * (LANE_WIDTH * 1.5 + 1.1), 0, z]}>
            <BushDecor />
          </group>
        )),
      )}

      {slots.map((cfg, i) => (
        <group
          key={`${layoutKey}-${i}`}
          ref={(el) => {
            hazardGroups.current[i] = el;
          }}
          position={[cfg.lane * LANE_WIDTH, 0, cfg.z]}
          visible={false}
        >
          <HazardVisual cfg={cfg} />
        </group>
      ))}

      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={`coin-${i}`}
          ref={(el) => {
            coinsRef.current[i] = el;
          }}
          position={[0, 0.7, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          visible={false}
        >
          <cylinderGeometry args={[0.35, 0.35, 0.08, 16]} />
          <meshStandardMaterial
            color="#e8b84a"
            metalness={0.55}
            roughness={0.3}
            emissive="#9a6b10"
            emissiveIntensity={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

export function Runner({
  hubMode = false,
  onBack,
}: {
  /** Aus der Spielauswahl: Münzen gehen ins Hub-Konto. */
  hubMode?: boolean;
  onBack?: () => void;
} = {}): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>('menu');
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [hubCoins, setHubCoins] = useState<number | null>(null);
  const [restHeute, setRestHeute] = useState<number | null>(null);
  const [cashPending, setCashPending] = useState(false);
  const cashedRef = useRef(false);
  const scoreRef = useRef(0);
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);

  const gameState = useRef<GameState>({
    lane: 0,
    isJumping: false,
    isSliding: false,
    slideUntil: 0,
    yVelocity: 0,
    speed: BASE_SPEED,
    distance: 0,
    phase: 'menu',
    playerPosition: new Vector3(0, GROUND_Y, PLAYER_Z),
    headY: PINGUIN_HOEHE,
  });

  useEffect(() => {
    preloadRunnerAssets();
  }, []);

  useEffect(() => {
    gameState.current.phase = phase;
  }, [phase]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    if (!hubMode) return;
    void api.runnerToday()
      .then((t) => setRestHeute(t.restHeute))
      .catch(() => setRestHeute(null));
  }, [hubMode]);

  const start = useCallback(() => {
    setScore(0);
    scoreRef.current = 0;
    setDistance(0);
    setHubCoins(null);
    cashedRef.current = false;
    setResetToken((n) => n + 1);
    gameState.current = {
      lane: 0,
      isJumping: false,
      isSliding: false,
      slideUntil: 0,
      yVelocity: 0,
      speed: BASE_SPEED,
      distance: 0,
      phase: 'flee',
      playerPosition: new Vector3(0, GROUND_Y, PLAYER_Z),
      headY: PINGUIN_HOEHE,
    };
    setPhase('flee');
  }, []);

  const onFleeDone = useCallback(() => {
    setPhase((p) => (p === 'flee' ? 'lobby' : p));
  }, []);

  useEffect(() => {
    if (phase !== 'flee') return;
    const t = window.setTimeout(() => setPhase('lobby'), 2900);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'lobby') return;
    const t = window.setTimeout(() => setPhase('run'), LOBBY_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'run' && phase !== 'lobby') return;
    if (phase === 'lobby') return; // Distanz erst ab echtem Run
    const id = window.setInterval(() => {
      setDistance((d) => {
        const next = d + 1;
        gameState.current.distance = next;
        return next;
      });
      gameState.current.speed = Math.min(28, gameState.current.speed + 0.07);
    }, 200);
    return () => window.clearInterval(id);
  }, [phase]);

  const playing = phase === 'lobby' || phase === 'run';

  const jump = useCallback(() => {
    const gs = gameState.current;
    if (!playing || gs.phase === 'dead' || gs.isJumping) return;
    if (gs.phase !== 'lobby' && gs.phase !== 'run') return;
    gs.isSliding = false;
    gs.isJumping = true;
    gs.yVelocity = JUMP_FORCE;
  }, [playing]);

  const slide = useCallback(() => {
    const gs = gameState.current;
    if (gs.phase !== 'lobby' && gs.phase !== 'run') return;
    if (gs.isJumping) return;
    gs.isSliding = true;
    gs.slideUntil = performance.now() + SLIDE_MS;
  }, []);

  const shiftLane = useCallback((dir: -1 | 1) => {
    const gs = gameState.current;
    if (gs.phase !== 'lobby' && gs.phase !== 'run') return;
    const next = gs.lane + dir;
    if (next >= -1 && next <= 1) gs.lane = next as -1 | 0 | 1;
  }, []);

  const onHit = useCallback(() => {
    if (gameState.current.phase !== 'run') return;
    gameState.current.phase = 'dead';
    setPhase('dead');
  }, []);

  /** Nach dem Lauf: Runner-Münzen (Score/10) ins Hub gutschreiben. */
  useEffect(() => {
    if (phase !== 'dead' || !hubMode || cashedRef.current) return;
    cashedRef.current = true;
    const runnerCoins = Math.floor(scoreRef.current / 10);
    if (runnerCoins <= 0) {
      setHubCoins(0);
      return;
    }
    setCashPending(true);
    void api
      .runnerCashout(runnerCoins)
      .then((r) => {
        setHubCoins(r.gutgeschrieben);
        setRestHeute(r.restHeute);
      })
      .catch(() => setHubCoins(0))
      .finally(() => setCashPending(false));
  }, [phase, hubMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (phase === 'menu' || phase === 'dead') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start();
        }
        return;
      }
      if (phase !== 'lobby' && phase !== 'run') return;
      if (e.key === 'ArrowLeft' || e.key === 'a') shiftLane(-1);
      if (e.key === 'ArrowRight' || e.key === 'd') shiftLane(1);
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
        e.preventDefault();
        jump();
      }
      if (e.key === 'ArrowDown' || e.key === 's') {
        e.preventDefault();
        slide();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, start, jump, slide, shiftLane]);

  const pose: Pose =
    phase === 'flee' ? 'flee' : phase === 'lobby' || phase === 'run' ? 'run' : 'idle';

  return (
    <div
      className="runner"
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
        touchY.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(e) => {
        if (phase === 'menu' || phase === 'dead') {
          start();
          return;
        }
        if ((phase !== 'lobby' && phase !== 'run') || touchX.current === null || touchY.current === null)
          return;
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
        const dy = (e.changedTouches[0]?.clientY ?? 0) - touchY.current;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
          shiftLane(dx > 0 ? 1 : -1);
        } else if (dy < -40) {
          jump();
        } else if (dy > 40) {
          slide();
        }
        touchX.current = null;
        touchY.current = null;
      }}
    >
      <Canvas
        shadows
        camera={{ position: [0, CAM_OFFSET.y, PLAYER_Z + CAM_OFFSET.z], fov: 42, near: 0.1, far: 120 }}
      >
        <color attach="background" args={['#87b8d8']} />
        <fog attach="fog" args={['#87b8d8', 28, 75]} />
        <ambientLight intensity={0.65} />
        <directionalLight
          castShadow
          intensity={1.55}
          position={[8, 16, 6]}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-far={60}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <hemisphereLight args={['#cfe8ff', '#4a6b35', 0.4]} />
        <Sky sunPosition={[80, 30, 40]} />

        <CameraRig gameState={gameState} />
        <Player gameState={gameState} pose={pose} onFleeDone={onFleeDone} />

        {Array.from({ length: NUM_CHUNKS }, (_, i) => (
          <WorldChunk
            key={`${resetToken}-${i}`}
            index={i}
            gameState={gameState}
            resetToken={resetToken}
            onCoin={() => setScore((s) => s + 10)}
            onHit={onHit}
          />
        ))}
      </Canvas>

      <div className="runner-hud">
        <strong>{hubMode ? 'Pro-Subway' : 'Brauweg-Lauf'}</strong>
        <span>
          {Math.floor(distance)} m · {Math.floor(score / 10)} Münzen
          {hubMode && restHeute !== null ? ` · noch ${restHeute} heute` : ''}
        </span>
        {hubMode && onBack && (
          <button type="button" className="runner-back" onClick={onBack}>
            Zurück
          </button>
        )}
      </div>

      {phase === 'menu' && (
        <div className="runner-overlay">
          <h1>{hubMode ? 'Pro-Subway' : 'Brauweg-Lauf'}</h1>
          <p>
            {hubMode
              ? 'Alleine rennen, Münzen sammeln — sie landen in deinem Hub-Konto (max. 40/Tag).'
              : 'Flee → 5 s Lobby → Hindernisse springen & rutschen.'}
          </p>
          <button type="button" className="runner-start" onClick={start}>
            Start
          </button>
          {hubMode && onBack && (
            <button type="button" className="runner-start runner-start--neben" onClick={onBack}>
              Zurück zur Auswahl
            </button>
          )}
          <p className="runner-hint">
            ← → Spur · ↑ springen · ↓ rutschen
          </p>
        </div>
      )}

      {phase === 'flee' && (
        <div className="runner-banner">
          <span>Los!</span>
        </div>
      )}

      {phase === 'lobby' && (
        <div className="runner-banner">
          <span>Hindernisse kommen…</span>
        </div>
      )}

      {phase === 'dead' && (
        <div className="runner-overlay">
          <h1>Autsch!</h1>
          <p>
            {Math.floor(distance)} m · {Math.floor(score / 10)} Münzen
          </p>
          {hubMode && (
            <p className="runner-hub-coins">
              {cashPending
                ? 'Münzen werden gutgeschrieben…'
                : hubCoins === null
                  ? ''
                  : hubCoins > 0
                    ? `+${hubCoins} Hub-Münzen`
                    : restHeute === 0
                      ? 'Tageslimit erreicht'
                      : 'Keine Hub-Münzen diesmal'}
            </p>
          )}
          <button type="button" className="runner-start" onClick={start}>
            Nochmal
          </button>
          {hubMode && onBack && (
            <button type="button" className="runner-start runner-start--neben" onClick={onBack}>
              Zurück
            </button>
          )}
        </div>
      )}
    </div>
  );
}
