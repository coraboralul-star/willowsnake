"use client";

export type GameKey = "w" | "a" | "s" | "d" | "space";
export type KeyPace = "fast" | "normal";

type Slice = [number, number];

type KeyDefinition = {
  timing: Slice[];
};

type PackConfig = {
  audio_file: string;
  definitions: Record<string, KeyDefinition>;
};

type Voice = {
  sample: string;
  rate: number;
  pace: KeyPace;
};

const PACK_URL = "/sounds/keyboard/config.json";
const AUDIO_URL = "/sounds/keyboard/oreo.ogg";
const VOLUME = 0.62;
const NORMAL_VOLUME = 0.38;
const SKIP_NORMAL_UP = 0.34;
const FAST_RATE_MIN = 1.08;
const FAST_RATE_MAX = 1.16;
const SLOW_NAMES = [
  "Backspace",
  "Enter",
  "Tab",
  "CapsLock",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
] as const;

let audio: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let definitions: Record<string, KeyDefinition> = {};
let fastPool: string[] = [];
let slowPool: string[] = [];
let fastBag: string[] = [];
let slowBag: string[] = [];
let lastSample: string | null = null;
let pace: KeyPace = "normal";
let loading: Promise<void> | null = null;
let enabled = false;

const held = new Map<GameKey, Voice>();
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

function shuffle(items: string[]) {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function takeFrom(pool: string[], bag: string[]) {
  if (pool.length === 0) return null;
  if (bag.length === 0) {
    const fresh = shuffle(pool.filter((name) => name !== lastSample));
    bag.push(...(fresh.length > 0 ? fresh : shuffle(pool)));
  }
  const next = bag.pop();
  if (!next) return null;
  lastSample = next;
  return next;
}

function buildPools(defs: Record<string, KeyDefinition>) {
  const names = Object.keys(defs).filter((name) => defs[name]?.timing?.length >= 1);
  fastPool = names.filter((name) => /^Key[A-Z]$/.test(name) || /^Digit[0-9]$/.test(name));
  slowPool = SLOW_NAMES.filter((name) => names.includes(name));
  fastBag = [];
  slowBag = [];
  lastSample = null;
}

async function loadPack() {
  if (buffer && (fastPool.length > 0 || slowPool.length > 0)) return;
  if (loading) return loading;

  loading = (async () => {
    const ac = context();
    if (!ac) return;

    const [configRes, audioRes] = await Promise.all([fetch(PACK_URL), fetch(AUDIO_URL)]);
    if (!configRes.ok || !audioRes.ok) return;

    const config = (await configRes.json()) as PackConfig;
    definitions = config.definitions ?? {};
    buildPools(definitions);

    const data = await audioRes.arrayBuffer();
    buffer = await ac.decodeAudioData(data.slice(0));
  })().finally(() => {
    loading = null;
  });

  return loading;
}

function volumeFor(next: KeyPace) {
  return next === "fast" ? VOLUME : NORMAL_VOLUME;
}

function playSlice(slice: Slice | undefined, rate = 1, gainValue = VOLUME) {
  const ac = context();
  if (!ac || !buffer || !slice) return;

  const [startMs, endMs] = slice;
  const offset = Math.max(0, startMs / 1000);
  const duration = Math.max(0.012, (endMs - startMs) / 1000);
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  gain.gain.value = gainValue;
  src.connect(gain);
  gain.connect(ac.destination);
  src.start(ac.currentTime, offset, duration);
}

function pickVoice(gameKey: GameKey): Voice | null {
  if (gameKey === "space") {
    const sample = definitions.Space ? "Space" : takeFrom(slowPool, slowBag);
    return sample ? { sample, rate: 1, pace: "normal" } : null;
  }
  if (pace === "fast") {
    const sample = takeFrom(fastPool, fastBag);
    if (!sample) return null;
    const rate = FAST_RATE_MIN + Math.random() * (FAST_RATE_MAX - FAST_RATE_MIN);
    return { sample, rate, pace: "fast" };
  }
  const sample = takeFrom(slowPool, slowBag);
  return sample ? { sample, rate: 1, pace: "normal" } : null;
}

export function setKeySoundPace(next: KeyPace) {
  pace = next;
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
  if (down.has(gameKey)) return;
  down.add(gameKey);

  const strike = () => {
    if (!enabled || !down.has(gameKey) || held.has(gameKey)) return;
    const voice = pickVoice(gameKey);
    if (!voice) return;
    held.set(gameKey, voice);
    playSlice(definitions[voice.sample]?.timing[0], voice.rate, volumeFor(voice.pace));
  };

  if (buffer && (fastPool.length > 0 || slowPool.length > 0)) {
    strike();
    return;
  }
  void loadPack().then(strike);
}

export function playKeyUp(gameKey: GameKey) {
  down.delete(gameKey);
  const voice = held.get(gameKey);
  held.delete(gameKey);
  if (!enabled || !voice) return;
  if (voice.pace === "normal" && Math.random() < SKIP_NORMAL_UP) return;
  playSlice(
    definitions[voice.sample]?.timing[1] ?? definitions[voice.sample]?.timing[0],
    voice.rate,
    volumeFor(voice.pace),
  );
}
