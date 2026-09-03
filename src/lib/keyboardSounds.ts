"use client";

export type GameKey = "w" | "a" | "s" | "d" | "space";

type Slice = [number, number];

type KeyDefinition = {
  timing: Slice[];
};

type PackConfig = {
  audio_file: string;
  definitions: Record<string, KeyDefinition>;
};

const PACK_URL = "/sounds/keyboard/config.json";
const AUDIO_URL = "/sounds/keyboard/oreo.ogg";
const VOLUME = 0.62;

let audio: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let definitions: Record<string, KeyDefinition> = {};
let pool: string[] = [];
let loading: Promise<void> | null = null;
let enabled = false;

const held = new Map<GameKey, string>();
const down = new Set<GameKey>();

function writeEnabled(value: boolean) {
  enabled = value;
}

function context() {
  if (typeof window === "undefined") return null;
  if (!audio) audio = new AudioContext();
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

function buildPool(defs: Record<string, KeyDefinition>) {
  return Object.keys(defs).filter((name) => name !== "Space" && defs[name]?.timing?.length >= 1);
}

async function loadPack() {
  if (buffer && pool.length > 0) return;
  if (loading) return loading;

  loading = (async () => {
    const ac = context();
    if (!ac) return;

    const [configRes, audioRes] = await Promise.all([fetch(PACK_URL), fetch(AUDIO_URL)]);
    if (!configRes.ok || !audioRes.ok) return;

    const config = (await configRes.json()) as PackConfig;
    definitions = config.definitions ?? {};
    pool = buildPool(definitions);

    const data = await audioRes.arrayBuffer();
    buffer = await ac.decodeAudioData(data.slice(0));
  })().finally(() => {
    loading = null;
  });

  return loading;
}

function playSlice(slice: Slice | undefined) {
  const ac = context();
  if (!ac || !buffer || !slice) return;

  const [startMs, endMs] = slice;
  const offset = Math.max(0, startMs / 1000);
  const duration = Math.max(0.012, (endMs - startMs) / 1000);
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  src.buffer = buffer;
  gain.gain.value = VOLUME;
  src.connect(gain);
  gain.connect(ac.destination);
  src.start(ac.currentTime, offset, duration);
}

function pickSample() {
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export function areKeySoundsEnabled() {
  return enabled;
}

export function toggleKeySounds() {
  writeEnabled(!enabled);
  if (enabled) void loadPack();
  return enabled;
}

export function preloadKeySounds() {
  if (!enabled) return;
  void loadPack();
}

export function playKeyDown(gameKey: GameKey) {
  if (!enabled) return;
  if (typeof document !== "undefined" && document.hidden) return;
  if (down.has(gameKey)) return;
  down.add(gameKey);

  const strike = () => {
    if (!enabled || !down.has(gameKey) || held.has(gameKey)) return;
    const sample = pickSample();
    if (!sample) return;
    held.set(gameKey, sample);
    playSlice(definitions[sample]?.timing[0]);
  };

  if (buffer && pool.length > 0) {
    strike();
    return;
  }
  void loadPack().then(strike);
}

export function playKeyUp(gameKey: GameKey) {
  down.delete(gameKey);
  const sample = held.get(gameKey);
  held.delete(gameKey);
  if (!enabled || !sample) return;
  if (typeof document !== "undefined" && document.hidden) return;
  playSlice(definitions[sample]?.timing[1] ?? definitions[sample]?.timing[0]);
}
