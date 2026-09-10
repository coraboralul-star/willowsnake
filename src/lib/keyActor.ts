"use client";

import { DIR_TO_KEY } from "@/lib/autoplay";
import type { Direction } from "@/lib/engine";
import { playKeyDown, playKeyUp, setKeySoundPace, type GameKey } from "@/lib/keyboardSounds";

export type KeyPulse = {
  turn: boolean;
  remain: number;
  tickMs: number;
};

type MoveKey = Exclude<GameKey, "space">;

const FAST_RUN = 3;
const FAST_GAP_MS = 220;

const NEIGHBORS: Record<MoveKey, MoveKey[]> = {
  w: ["a", "d"],
  a: ["w", "s"],
  s: ["a", "d"],
  d: ["w", "s"],
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function chance(p: number) {
  return Math.random() < p;
}

export function createKeyActor(onHeld: (key: GameKey | null) => void) {
  let held: GameKey | null = null;
  let moving: MoveKey | null = null;
  let runLen = 0;
  let lastDir: Direction | null = null;
  let remainNow = 0;
  let tappedThisRun = false;
  let lastPressAt = 0;
  let alive = true;
  const timers = new Set<number>();

  function later(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }

  function clearTimers() {
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
  }

  function light(key: GameKey | null) {
    if (alive) onHeld(key);
  }

  function press(key: GameKey) {
    if (held === key) return;
    const now = performance.now();
    if (key !== "space" && lastPressAt > 0 && now - lastPressAt < FAST_GAP_MS) {
      setKeySoundPace("fast");
    }
    lastPressAt = now;
    if (held) playKeyUp(held);
    playKeyDown(key);
    held = key;
    light(key);
  }

  function release() {
    if (!held) return;
    playKeyUp(held);
    held = null;
    light(null);
  }

  function holdFor(key: MoveKey, ms: number) {
    later(ms, () => {
      if (held !== key || moving !== key) return;
      release();
    });
  }

  function flickMs() {
    return chance(0.22) ? rand(40, 56) : rand(58, 74);
  }

  function tapMs() {
    return chance(0.15) ? rand(150, 240) : rand(70, 160);
  }

  function rareOverholdMs() {
    return rand(260, 720);
  }

  function tap(key: MoveKey, ms: number) {
    tappedThisRun = true;
    press(key);
    holdFor(key, ms);
    if (ms >= 260 && chance(0.08)) {
      later(rand(80, 220), () => {
        if (held !== key || moving !== key) return;
        const slip = pick(NEIGHBORS[key]);
        playKeyDown(slip);
        light(slip);
        later(rand(24, 60), () => {
          playKeyUp(slip);
          if (held === key) light(key);
        });
      });
    }
  }

  function swap(next: MoveKey, gapMs: number, ms: number) {
    const prev = held;
    if (prev && prev !== next) {
      later(Math.max(0, gapMs), () => {
        if (held === prev) {
          playKeyUp(prev);
          held = null;
          light(null);
        }
        later(rand(0, 16), () => {
          if (!alive || moving !== next) return;
          tap(next, ms);
        });
      });
      return;
    }
    later(gapMs, () => {
      if (!alive || moving !== next) return;
      tap(next, ms);
    });
  }

  function isQuickCut(prevRun: number) {
    return prevRun > 0 && prevRun <= FAST_RUN;
  }

  function isTight(remain: number, prevRun: number) {
    return remain <= 3 || (isQuickCut(prevRun) && remain <= 5);
  }

  function pressMs(remain: number, prevRun: number) {
    if (isQuickCut(prevRun) || isTight(remain, prevRun)) return flickMs();
    const semiLong = remain >= 6 && remain <= 14;
    if (semiLong && chance(0.08)) return rareOverholdMs();
    return tapMs();
  }

  function handleTurn(key: MoveKey, prevRun: number, remain: number) {
    const quickCut = isQuickCut(prevRun);
    setKeySoundPace(quickCut ? "fast" : "normal");
    const travel = isTight(remain, prevRun) ? rand(0, 20) : rand(12, 55);
    swap(key, travel, pressMs(remain, prevRun));
  }

  function handleStraight(key: MoveKey, remain: number) {
    setKeySoundPace("normal");
    if (held === key || held) return;
    if (timers.size > 0) return;
    if (remain <= 5) return;
    if (!tappedThisRun) {
      later(rand(30, 180), () => {
        if (held || moving !== key || remainNow <= 5) return;
        tap(key, tapMs());
      });
      return;
    }
    if (remain >= 9 && chance(0.04)) {
      later(rand(280, 900), () => {
        if (held || moving !== key || remainNow <= 6) return;
        tap(key, tapMs());
      });
    }
  }

  function onMove(dir: Direction, pulse: KeyPulse) {
    const key = DIR_TO_KEY[dir];
    remainNow = pulse.remain;
    const turned = pulse.turn || lastDir !== dir;
    if (turned) {
      const prevRun = runLen;
      runLen = 1;
      lastDir = dir;
      moving = key;
      tappedThisRun = held === key;
      clearTimers();
      handleTurn(key, prevRun, pulse.remain);
      return;
    }

    runLen += 1;
    moving = key;
    handleStraight(key, pulse.remain);
  }

  function tapSpace() {
    clearTimers();
    press("space");
    later(rand(40, 110), () => {
      if (held === "space") release();
    });
  }

  function reset() {
    clearTimers();
    release();
    moving = null;
    lastDir = null;
    runLen = 0;
    remainNow = 0;
    tappedThisRun = false;
    lastPressAt = 0;
  }

  function dispose() {
    alive = false;
    clearTimers();
    if (held) playKeyUp(held);
    held = null;
    moving = null;
  }

  return { onMove, tapSpace, reset, dispose };
}
