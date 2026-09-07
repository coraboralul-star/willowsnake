"use client";

import { DIR_TO_KEY } from "@/lib/autoplay";
import type { Direction } from "@/lib/engine";
import { playKeyDown, playKeyUp, type GameKey } from "@/lib/keyboardSounds";

type MoveKey = Exclude<GameKey, "space">;

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

export function createKeyActor(onHeld: (key: GameKey | null) => void) {
  let held: GameKey | null = null;
  let moving: MoveKey | null = null;
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

  function restab(key: MoveKey) {
    later(rand(90, 680), () => {
      if (held || moving !== key) return;
      if (Math.random() < 0.72) startStraightHold(key);
    });
  }

  function scheduleRelease(key: MoveKey, ms: number) {
    later(ms, () => {
      if (held !== key) return;
      release();
      restab(key);
    });
  }

  function scheduleSlip(main: MoveKey) {
    later(rand(50, 420), () => {
      if (held !== main || moving !== main) return;
      const slip = pick(NEIGHBORS[main]);
      playKeyUp(main);
      playKeyDown(slip);
      held = slip;
      light(slip);
      later(rand(22, 68), () => {
        if (held !== slip) return;
        playKeyUp(slip);
        if (moving === main) {
          playKeyDown(main);
          held = main;
          light(main);
        } else {
          held = null;
          light(null);
        }
      });
    });
  }

  function startStraightHold(key: MoveKey) {
    press(key);
    const roll = Math.random();
    const hold =
      roll < 0.16
        ? rand(70, 150)
        : roll < 0.55
          ? rand(180, 640)
          : roll < 0.84
            ? rand(720, 1600)
            : rand(1700, 3400);
    scheduleRelease(key, hold);
    if (Math.random() < 0.2) scheduleSlip(key);
  }

  function onMove(dir: Direction, isTurn: boolean) {
    const key = DIR_TO_KEY[dir];
    moving = key;

    if (isTurn) {
      clearTimers();
      press(key);
      scheduleRelease(key, rand(32, 92));
      return;
    }

    if (held === key || held) return;
    if (timers.size > 0) return;
    if (Math.random() < 0.4) startStraightHold(key);
    else restab(key);
  }

  function tapSpace() {
    clearTimers();
    press("space");
    later(rand(40, 90), () => {
      if (held === "space") release();
    });
  }

  function reset() {
    clearTimers();
    release();
    moving = null;
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
