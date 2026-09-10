"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import {
  BOMB_MS,
  spinePath,
  type GameState,
  type Point,
} from "@/lib/engine";
import type { MatchViewer } from "@/lib/matchFeed";
import type { SnakeSkin } from "@/lib/snakeSkins";
import { SNAKE_SKINS } from "@/lib/snakeSkins";

const BOARD = 10;
const WALL_H = 1.08;
const WALL_T = 0.5;
const MAX_PARTS = 900;
const dummy = new THREE.Object3D();
const reducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Board3DProps = {
  liveRef: RefObject<GameState>;
  topGifter: MatchViewer | null;
  skin?: SnakeSkin;
};

export function Board3D({ liveRef, topGifter, skin = SNAKE_SKINS.mint }: Board3DProps) {
  return (
    <Canvas
      className="h-full w-full"
      shadows
      camera={{ position: [0, 18.5, 4.58], fov: 37.4, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
      onCreated={({ gl }) => {
        gl.setClearColor("#1a120c", 1);
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}
    >
      <ambientLight intensity={0.38} />
      <directionalLight
        position={[6, 18, 8]}
        intensity={1.35}
        color="#fff6e0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />
      <directionalLight position={[-8, 7, -5]} intensity={0.22} color="#c4a574" />
      <LookAt />
      <Platform />
      <SnakePipe liveRef={liveRef} topGifter={topGifter} skin={skin} />
      <Pickups liveRef={liveRef} />
    </Canvas>
  );
}

function LookAt() {
  useFrame(({ camera }) => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(0, 18.5, 4.58);
    cam.fov = 37.4;
    cam.updateProjectionMatrix();
    cam.lookAt(0, 0.22, 0.12);
  });
  return null;
}

function Platform() {
  const checker = useMemo(() => makeChecker(), []);
  const plank = useMemo(() => makeWoodWall(), []);
  useEffect(
    () => () => {
      checker.dispose();
      plank.dispose();
    },
    [checker, plank],
  );
  const extent = BOARD + WALL_T * 2;
  const hy = WALL_H / 2;
  const inner = BOARD / 2 - 0.004;
  return (
    <group>
      <mesh position={[0, -0.28, 0]} receiveShadow>
        <boxGeometry args={[extent + 0.18, 0.5, extent + 0.18]} />
        <meshStandardMaterial color="#6b4f2e" roughness={0.86} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[BOARD, BOARD]} />
        <meshStandardMaterial map={checker} roughness={0.88} />
      </mesh>
      <mesh position={[0, hy, -BOARD / 2 - WALL_T / 2]} castShadow receiveShadow>
        <boxGeometry args={[extent, WALL_H, WALL_T]} />
        <meshStandardMaterial color="#8d6238" roughness={0.84} />
      </mesh>
      <mesh position={[0, hy, BOARD / 2 + WALL_T / 2]} castShadow receiveShadow>
        <boxGeometry args={[extent, WALL_H, WALL_T]} />
        <meshStandardMaterial color="#8d6238" roughness={0.84} />
      </mesh>
      <mesh position={[-BOARD / 2 - WALL_T / 2, hy, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL_T, WALL_H, BOARD]} />
        <meshStandardMaterial color="#8d6238" roughness={0.84} />
      </mesh>
      <mesh position={[BOARD / 2 + WALL_T / 2, hy, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL_T, WALL_H, BOARD]} />
        <meshStandardMaterial color="#8d6238" roughness={0.84} />
      </mesh>
      <mesh position={[0, hy, -inner]} receiveShadow>
        <planeGeometry args={[BOARD, WALL_H]} />
        <meshStandardMaterial map={plank} roughness={0.8} />
      </mesh>
      <mesh position={[0, hy, inner]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[BOARD, WALL_H]} />
        <meshStandardMaterial map={plank} roughness={0.8} />
      </mesh>
      <mesh position={[-inner, hy, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[BOARD, WALL_H]} />
        <meshStandardMaterial map={plank} roughness={0.8} />
      </mesh>
      <mesh position={[inner, hy, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[BOARD, WALL_H]} />
        <meshStandardMaterial map={plank} roughness={0.8} />
      </mesh>
      <RimLights />
    </group>
  );
}

function RimLights() {
  const y = WALL_H + 0.06;
  const e = BOARD / 2 + WALL_T / 2;
  const a = BOARD * 0.22;
  const spots: [number, number, number][] = [
    [a, y, -e],
    [-a, y, -e],
    [a, y, e],
    [-a, y, e],
    [-e, y, a],
    [-e, y, -a],
    [e, y, a],
    [e, y, -a],
  ];
  return (
    <group>
      {spots.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color="#ffe08a" emissive="#ffcc55" emissiveIntensity={1.05} />
        </mesh>
      ))}
    </group>
  );
}

const MAX_SEGS = 512;
const yAxis = new THREE.Vector3(0, 1, 0);
const segDir = new THREE.Vector3();
const jointPts: THREE.Vector3[] = Array.from({ length: MAX_SEGS + 1 }, () => new THREE.Vector3());

function SnakePipe({
  liveRef,
  topGifter,
  skin,
}: {
  liveRef: RefObject<GameState>;
  topGifter: MatchViewer | null;
  skin: SnakeSkin;
}) {
  const knit = useMemo(() => makeKnit(), []);
  useEffect(() => () => knit.dispose(), [knit]);
  const segs = useRef<THREE.InstancedMesh>(null);
  const joints = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.Group>(null);

  useFrame(() => {
    const state = liveRef.current;
    const headGroup = head.current;
    const segMesh = segs.current;
    const jointMesh = joints.current;
    if (!headGroup || !segMesh || !jointMesh) return;

    const raw = posePoints(state);
    const n = Math.min(raw.length, MAX_SEGS + 1);
    const cell = BOARD / state.cols;
    for (let i = 0; i < n; i += 1) {
      const [x, , z] = cellToWorld(raw[i].x, raw[i].y, state.cols, state.rows);
      jointPts[i].set(x, 0, z);
    }

    for (let i = 0; i < n - 1; i += 1) {
      const a = jointPts[i];
      const b = jointPts[i + 1];
      segDir.set(b.x - a.x, 0, b.z - a.z);
      const len = segDir.length();
      if (len < 1e-4) {
        hideInstance(segMesh, i);
        continue;
      }
      const r = (bodyRadius(i, n, cell) + bodyRadius(i + 1, n, cell)) * 0.5;
      dummy.position.set((a.x + b.x) * 0.5, r, (a.z + b.z) * 0.5);
      dummy.quaternion.setFromUnitVectors(yAxis, segDir.multiplyScalar(1 / len));
      dummy.scale.set(r, len, r);
      dummy.updateMatrix();
      segMesh.setMatrixAt(i, dummy.matrix);
    }
    for (let i = Math.max(0, n - 1); i < MAX_SEGS; i += 1) hideInstance(segMesh, i);

    hideInstance(jointMesh, 0);
    for (let i = 1; i < n; i += 1) {
      const r = bodyRadius(i, n, cell);
      dummy.position.set(jointPts[i].x, r, jointPts[i].z);
      dummy.quaternion.identity();
      dummy.scale.setScalar(r);
      dummy.updateMatrix();
      jointMesh.setMatrixAt(i, dummy.matrix);
    }
    for (let i = Math.max(1, n); i < MAX_SEGS; i += 1) hideInstance(jointMesh, i);

    segMesh.instanceMatrix.needsUpdate = true;
    jointMesh.instanceMatrix.needsUpdate = true;
    segMesh.visible = n >= 2;
    jointMesh.visible = n >= 2;

    if (n >= 1) {
      const headR = bodyRadius(0, n, cell);
      headGroup.position.set(jointPts[0].x, headR, jointPts[0].z);
      const behind = jointPts[Math.min(1, n - 1)];
      headGroup.rotation.y = Math.atan2(jointPts[0].x - behind.x, jointPts[0].z - behind.z);
      headGroup.scale.setScalar(Math.max(0.75, headR / 0.2));
      headGroup.visible = true;
    } else {
      headGroup.visible = false;
    }
  });

  return (
    <group>
      <instancedMesh ref={segs} args={[undefined, undefined, MAX_SEGS]} castShadow frustumCulled={false} visible={false}>
        <cylinderGeometry args={[1, 1, 1, 10]} />
        <meshStandardMaterial color={skin.body} map={knit} roughness={0.52} />
      </instancedMesh>
      <instancedMesh ref={joints} args={[undefined, undefined, MAX_SEGS]} castShadow frustumCulled={false} visible={false}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color={skin.body} map={knit} roughness={0.52} />
      </instancedMesh>
      <group ref={head}>
        <mesh position={[0, 0.02, 0.08]} castShadow>
          <sphereGeometry args={[0.24, 14, 12]} />
          <meshStandardMaterial color={skin.head} map={knit} roughness={0.58} />
        </mesh>
        <mesh position={[0, -0.01, 0.28]} castShadow>
          <sphereGeometry args={[0.16, 12, 10]} />
          <meshStandardMaterial color={skin.body} map={knit} roughness={0.6} />
        </mesh>
        <mesh position={[0.1, 0.2, 0.1]}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshStandardMaterial color="#f8f4e8" />
        </mesh>
        <mesh position={[-0.1, 0.2, 0.1]}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshStandardMaterial color="#f8f4e8" />
        </mesh>
        <mesh position={[0.1, 0.24, 0.13]}>
          <sphereGeometry args={[0.03, 8, 6]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[-0.1, 0.24, 0.13]}>
          <sphereGeometry args={[0.03, 8, 6]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0, -0.02, 0.4]} rotation={[0.4, 0, 0]}>
          <coneGeometry args={[0.03, 0.12, 6]} />
          <meshStandardMaterial color="#e53935" />
        </mesh>
        {topGifter ? <GifterBadge gifter={topGifter} /> : null}
      </group>
    </group>
  );
}

function GifterBadge({ gifter }: { gifter: MatchViewer }) {
  return (
    <Html
      position={[0, 1.25, 0]}
      center
      sprite
      occlude={false}
      zIndexRange={[80, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div className="flex scale-[0.91] flex-col items-center gap-0.5 drop-shadow-[0_3px_10px_rgba(0,0,0,0.7)]">
        <span className="text-2xl leading-none">👑</span>
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-[3px] border-amber-300 bg-zinc-800">
          {gifter.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={gifter.avatar}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-lg font-bold text-amber-100">
              {gifter.user.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <p className="max-w-[9rem] truncate text-center text-sm font-extrabold text-white">
          {gifter.user}
        </p>
        <div className="rounded-full bg-black/90 px-2.5 py-0.5 text-lg font-black tabular-nums text-white">
          {gifter.coins}
        </div>
      </div>
    </Html>
  );
}

function Pickups({ liveRef }: { liveRef: RefObject<GameState> }) {
  const apples = useRef<THREE.InstancedMesh>(null);
  const gifts = useRef<THREE.InstancedMesh>(null);
  const bombs = useRef<THREE.InstancedMesh>(null);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const state = liveRef.current;
    const appleMesh = apples.current;
    const giftMesh = gifts.current;
    const bombMesh = bombs.current;
    if (!appleMesh || !giftMesh || !bombMesh) return;

    const cols = state.cols;
    const rows = state.rows;
    const cell = BOARD / cols;
    const now = performance.now();
    let appleI = 0;
    let giftI = 0;

    for (const food of state.foods) {
      const [x, , z] = cellToWorld(food.x, food.y, cols, rows);
      const gifted = Boolean(food.from) || food.kind !== "apple";
      dummy.position.set(x, cell * 0.28, z);
      dummy.scale.setScalar(cell * (food.kind === "golden" ? 0.34 : 0.28));
      dummy.updateMatrix();
      if (gifted) {
        giftMesh.setMatrixAt(giftI, dummy.matrix);
        giftI += 1;
      } else {
        appleMesh.setMatrixAt(appleI, dummy.matrix);
        appleI += 1;
      }
    }
    for (let i = appleI; i < MAX_PARTS; i += 1) hideInstance(appleMesh, i);
    for (let i = giftI; i < MAX_PARTS; i += 1) hideInstance(giftMesh, i);
    appleMesh.instanceMatrix.needsUpdate = true;
    giftMesh.instanceMatrix.needsUpdate = true;

    if (!bombMesh.instanceColor) {
      bombMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTS * 3), 3);
    }

    state.bombs.forEach((bomb, i) => {
      const [x, , z] = cellToWorld(bomb.x, bomb.y, cols, rows);
      const left = Math.max(0, bomb.until - now);
      const pulse = 1 + 0.12 * Math.sin(now / 90);
      dummy.position.set(x, cell * 0.26, z);
      dummy.scale.setScalar(cell * 0.26 * (left < BOMB_MS * 0.25 ? pulse : 1));
      dummy.updateMatrix();
      bombMesh.setMatrixAt(i, dummy.matrix);
      const hot = left < 2500;
      color.set(hot ? "#ffb300" : "#6a6a70");
      bombMesh.setColorAt(i, color);
    });
    for (let i = state.bombs.length; i < MAX_PARTS; i += 1) hideInstance(bombMesh, i);
    bombMesh.instanceMatrix.needsUpdate = true;
    if (bombMesh.instanceColor) bombMesh.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={apples} args={[undefined, undefined, MAX_PARTS]} frustumCulled={false}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshPhysicalMaterial color="#e53935" roughness={0.32} clearcoat={0.35} />
      </instancedMesh>
      <instancedMesh ref={gifts} args={[undefined, undefined, MAX_PARTS]} frustumCulled={false}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshPhysicalMaterial color="#8b5cff" roughness={0.26} clearcoat={0.5} />
      </instancedMesh>
      <instancedMesh ref={bombs} args={[undefined, undefined, MAX_PARTS]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#6a6a70" roughness={0.45} emissive="#c9a227" emissiveIntensity={0.35} />
      </instancedMesh>
    </group>
  );
}

function bodyRadius(index: number, count: number, cell: number) {
  if (count <= 1) return cell * 0.4;
  const fromTip = count - 1 - index;
  const taper = Math.min(24, Math.max(7, count * 0.28));
  const fat = cell * 0.4;
  const tip = cell * 0.11;
  if (fromTip >= taper) return fat;
  const u = fromTip / taper;
  const thick = u * u * (3 - 2 * u);
  return tip + (fat - tip) * thick;
}

function posePoints(state: GameState): Point[] {
  const progress = reducedMotion
    ? 1
    : state.status === "playing"
      ? Math.min(1, Math.max(0, (performance.now() - state.tickStartedAt) / state.tickMs))
      : state.status === "paused"
        ? state.pauseT
        : 1;
  return spinePath(state.prevSnake, state.snake, progress);
}

function cellToWorld(x: number, y: number, cols: number, rows: number): [number, number, number] {
  return [((x + 0.5) / cols - 0.5) * BOARD, 0, ((y + 0.5) / rows - 0.5) * BOARD];
}

function hideInstance(mesh: THREE.InstancedMesh, index: number) {
  dummy.position.set(0, -20, 0);
  dummy.quaternion.identity();
  dummy.scale.setScalar(0);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function makeChecker() {
  const tiles = 20;
  const px = 24;
  const size = tiles * px;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    for (let y = 0; y < tiles; y += 1) {
      for (let x = 0; x < tiles; x += 1) {
        const light = (x + y) % 2 === 0;
        const base = light ? [201, 163, 106] : [139, 98, 57];
        for (let gy = 0; gy < px; gy += 1) {
          const shade = ((gy * 13 + x * 7 + y * 3) % 9) - 4;
          ctx.fillStyle = `rgb(${base[0] + shade},${base[1] + shade},${base[2] + shade})`;
          ctx.fillRect(x * px, y * px + gy, px, 1);
        }
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  return tex;
}

function makeWoodWall() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const boards = 3;
    const h = canvas.height / boards;
    for (let b = 0; b < boards; b += 1) {
      const tone = b % 2 === 0 ? 0 : -12;
      ctx.fillStyle = `rgb(${168 + tone},${118 + tone},${62 + tone})`;
      ctx.fillRect(0, b * h, 256, h - 1);
      for (let x = 0; x < 256; x += 1) {
        const grain = Math.sin(x * 0.11 + b * 1.7) * 6 + ((x * 13 + b * 9) % 5) - 2;
        ctx.fillStyle = `rgba(90, 55, 22, ${0.08 + Math.abs(grain) * 0.012})`;
        ctx.fillRect(x, b * h, 1, h - 1);
      }
      ctx.fillStyle = "rgba(70, 42, 16, 0.35)";
      ctx.fillRect(0, (b + 1) * h - 1, 256, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(BOARD / 2.4, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function makeKnit() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#f2f2f0";
    ctx.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 1) {
      const row = Math.sin(y * 0.22) * 5;
      for (let x = 0; x < 64; x += 1) {
        const grain = Math.sin(x * 0.4 + y * 0.08) * 4 + ((x * 9 + y * 5) % 5) - 2;
        const shade = row + grain;
        ctx.fillStyle = `rgba(40, 40, 36, ${0.05 + Math.abs(shade) * 0.012})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}
