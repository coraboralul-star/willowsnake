"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyAutoplayDir,
  autoplayOnNewRun,
  DIR_TO_KEY,
  enableAutoplay,
  isAutoplay,
  pickAutoplayDir,
} from "@/lib/autoplay";
import {
  createGame,
  enqueueTurn,
  KEY_TO_DIR,
  startRun,
  step,
  type Direction,
  type GameState,
  type GameStatus,
} from "@/lib/engine";
import {
  playKeyDown,
  playKeyUp,
  preloadKeySounds,
  toggleKeySounds,
  type GameKey,
} from "@/lib/keyboardSounds";
import { playBonk, playEat } from "@/lib/sfx";

export type GameUi = {
  score: number;
  status: GameStatus;
  length: number;
  gridSize: number;
};

const GAME_KEY: Record<string, GameKey> = {
  w: "w",
  a: "a",
  s: "s",
  d: "d",
  W: "w",
  A: "a",
  S: "s",
  D: "d",
};

function isOne(event: KeyboardEvent) {
  return event.code === "Digit1" || event.code === "Numpad1" || event.key === "1";
}

function isTwo(event: KeyboardEvent) {
  return event.code === "Digit2" || event.code === "Numpad2" || event.key === "2";
}

function tapKey(gameKey: GameKey, onHeld?: (key: GameKey | null) => void) {
  playKeyDown(gameKey);
  onHeld?.(gameKey);
  window.setTimeout(() => playKeyUp(gameKey), 52);
  window.setTimeout(() => onHeld?.(null), 90);
}

export function useSnakeGame(
  gridSize: number,
  enabled = true,
  onEnd?: (score: number) => void,
) {
  const liveRef = useRef<GameState>(createGame(gridSize));
  const onEndRef = useRef(onEnd);
  const comboRef = useRef({
    pristine: false,
    eligible: false,
    oneHeld: false,
    twoHeld: false,
  });
  const retryRef = useRef<number | null>(null);
  const [ui, setUi] = useState<GameUi>(() => ({
    score: 0,
    status: "idle",
    length: 3,
    gridSize,
  }));
  const [heldKey, setHeldKey] = useState<string | null>(null);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const publish = useCallback(() => {
    setUi(toUi(liveRef.current));
  }, []);

  const beginRun = useCallback(() => {
    comboRef.current.pristine = true;
    comboRef.current.eligible = false;
  }, []);

  const markDirty = useCallback(() => {
    comboRef.current.pristine = false;
    comboRef.current.eligible = false;
  }, []);

  const applyComboToggle = useCallback(() => {
    const current = liveRef.current;
    const combo = comboRef.current;
    if (
      (current.status === "over" || current.status === "won") &&
      combo.eligible
    ) {
      if (combo.oneHeld) toggleKeySounds();
      if (combo.twoHeld) enableAutoplay();
    }
    preloadKeySounds();
  }, []);

  const reset = useCallback(
    (nextSize = gridSize) => {
      liveRef.current = createGame(nextSize);
      comboRef.current.pristine = false;
      comboRef.current.eligible = false;
      publish();
    },
    [gridSize, publish],
  );

  const start = useCallback(() => {
    if (retryRef.current != null) {
      window.clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    applyComboToggle();
    liveRef.current = startRun(createGame(gridSize), performance.now());
    if (isAutoplay()) autoplayOnNewRun(liveRef.current.tickMs);
    beginRun();
    publish();
  }, [applyComboToggle, beginRun, gridSize, publish]);

  const startRef = useRef(start);
  startRef.current = start;

  const queueAutoRetry = useCallback(() => {
    if (!isAutoplay() || retryRef.current != null) return;
    const wait = 900 + Math.random() * 6100;
    retryRef.current = window.setTimeout(() => {
      retryRef.current = null;
      tapKey("space");
      startRef.current();
    }, wait);
  }, []);

  const togglePause = useCallback(() => {
    if (isAutoplay()) return;
    const current = liveRef.current;
    if (current.status === "playing") {
      markDirty();
      const pauseT = Math.min(
        1,
        Math.max(0, (performance.now() - current.tickStartedAt) / current.tickMs),
      );
      liveRef.current = { ...current, status: "paused", pauseT };
      publish();
      return;
    }
    if (current.status === "paused") {
      markDirty();
      liveRef.current = {
        ...current,
        status: "playing",
        tickStartedAt: performance.now() - current.pauseT * current.tickMs,
      };
      publish();
    }
  }, [markDirty, publish]);

  const steer = useCallback(
    (dir: Direction) => {
      if (isAutoplay()) return;
      const now = performance.now();
      const current = liveRef.current;
      if (current.status === "idle") {
        liveRef.current = startRun(current, now, dir);
        beginRun();
        publish();
        return;
      }
      if (current.status !== "playing") return;
      markDirty();
      liveRef.current = enqueueTurn(current, dir);
    },
    [beginRun, markDirty, publish],
  );

  const advance = useCallback((now: number) => {
    if (isAutoplay() && liveRef.current.status === "paused") {
      const current = liveRef.current;
      liveRef.current = {
        ...current,
        status: "playing",
        tickStartedAt: now - current.pauseT * current.tickMs,
      };
    }

    const playing = liveRef.current;
    if (playing.status !== "playing") return;

    if (playing.tickStartedAt === 0) {
      playing.tickStartedAt = now;
    }

    let advanced = false;
    while (now - liveRef.current.tickStartedAt >= liveRef.current.tickMs) {
      let current = liveRef.current;
      if (isAutoplay()) {
        const facing = current.queued.at(0) ?? current.direction;
        const dir = pickAutoplayDir(current);
        current = applyAutoplayDir(current, dir);
        if (dir !== facing) {
          tapKey(DIR_TO_KEY[dir], (key) => setHeldKey(key));
        }
      }

      const next = step(current, now);
      next.tickStartedAt = current.tickStartedAt + current.tickMs;
      liveRef.current = next;
      advanced = true;

      if (next.score > current.score) playEat();

      if (next.status === "over" || next.status === "won") {
        if (next.status === "over") playBonk();
        comboRef.current.eligible =
          !isAutoplay() &&
          next.status === "over" &&
          comboRef.current.pristine &&
          next.snake[0].x === next.gridSize - 1;
        setUi(toUi(next));
        onEndRef.current?.(next.score);
        if (isAutoplay()) queueAutoRetry();
        return;
      }
    }

    if (advanced) {
      const snapshot = toUi(liveRef.current);
      setUi((prev) =>
        prev.score === snapshot.score &&
        prev.status === snapshot.status &&
        prev.length === snapshot.length
          ? prev
          : snapshot,
      );
    }
  }, [queueAutoRetry]);

  useEffect(() => {
    if (!enabled) return;
    preloadKeySounds();
    if (isAutoplay() && liveRef.current.status === "idle") {
      startRef.current();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isOne(event)) {
        comboRef.current.oneHeld = true;
        if (liveRef.current.status === "playing") markDirty();
        return;
      }
      if (isTwo(event)) {
        comboRef.current.twoHeld = true;
        if (liveRef.current.status === "playing") markDirty();
        return;
      }

      const dir = KEY_TO_DIR[event.key];
      if (dir) {
        event.preventDefault();
        if (isAutoplay()) return;
        setHeldKey(event.key.toLowerCase());
        if (event.repeat) return;
        playKeyDown(GAME_KEY[event.key]);
        steer(dir);
        return;
      }

      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        if (event.repeat) return;
        const status = liveRef.current.status;
        if (status === "idle" || status === "over" || status === "won") {
          if (isAutoplay() && status !== "idle") return;
          start();
          playKeyDown("space");
          return;
        }
        togglePause();
        playKeyDown("space");
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (isOne(event)) {
        comboRef.current.oneHeld = false;
        return;
      }
      if (isTwo(event)) {
        comboRef.current.twoHeld = false;
        return;
      }
      if (KEY_TO_DIR[event.key]) {
        setHeldKey((prev) => (prev === event.key.toLowerCase() ? null : prev));
        playKeyUp(GAME_KEY[event.key]);
        return;
      }
      if (event.key === " " || event.code === "Space") {
        playKeyUp("space");
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enabled, markDirty, start, steer, togglePause]);

  return {
    liveRef,
    ui,
    heldKey,
    start,
    reset,
    togglePause,
    steer,
    advance,
  };
}

function toUi(state: GameState): GameUi {
  return {
    score: state.score,
    status: state.status,
    length: state.snake.length,
    gridSize: state.gridSize,
  };
}
