"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyAutoplayDir,
  applyHijackDir,
  autoplayOnNewRun,
  enableAutoplay,
  isAutoplay,
  pickAutoplayDir,
  pickHijackDir,
} from "@/lib/autoplay";
import {
  applyGift,
  cloneGame,
  createGame,
  DELTA,
  enqueueTurn,
  expireBombs,
  KEY_TO_DIR,
  REWIND_MS,
  REWIND_PLAY_MS,
  rewindTape,
  shiftGameClock,
  startRun,
  step,
  type Direction,
  type GameSnap,
  type GameState,
  type GameStatus,
} from "@/lib/engine";
import {
  onLiveGift,
  onLiveLike,
  pushLiveAlert,
  resolveGift,
  type GiftAction,
} from "@/lib/gifts";
import { recordMatchGift, recordMatchLike, resetMatchFeed } from "@/lib/matchFeed";
import { createKeyActor } from "@/lib/keyActor";
import {
  playKeyDown,
  playKeyUp,
  preloadKeySounds,
  toggleKeySounds,
  type GameKey,
} from "@/lib/keyboardSounds";
import { bumpAttempt, bumpDeath, bumpWin } from "@/lib/sessionStats";
import { playBonk, playEat, resumeAudio } from "@/lib/sfx";
import { resetTwanvlBrain } from "@/lib/twanvl";

export type GameUi = {
  score: number;
  status: GameStatus;
  length: number;
  gridSize: number;
  hijacked: boolean;
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

export function useSnakeGame(
  cols: number,
  rows: number,
  enabled = true,
  onEnd?: (score: number) => void,
) {
  const liveRef = useRef<GameState>(createGame(cols, rows));
  const onEndRef = useRef(onEnd);
  const comboRef = useRef({
    pristine: false,
    eligible: false,
    oneHeld: false,
    twoHeld: false,
  });
  const retryRef = useRef<number | null>(null);
  const keysRef = useRef<ReturnType<typeof createKeyActor> | null>(null);
  const historyRef = useRef<GameSnap[]>([]);
  const spawnRef = useRef<GameState | null>(null);
  const rewindRef = useRef<{
    frames: GameSnap[];
    startedAt: number;
    shown: number;
    duration: number;
  } | null>(null);
  const giftQueueRef = useRef<{ action: GiftAction; user?: string }[]>([]);
  const [ui, setUi] = useState<GameUi>(() => ({
    score: 3,
    status: "idle",
    length: 3,
    gridSize: cols,
    hijacked: false,
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
    bumpAttempt();
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

  const reset = useCallback(() => {
    liveRef.current = createGame(cols, rows);
    comboRef.current.pristine = false;
    comboRef.current.eligible = false;
    resetMatchFeed();
    historyRef.current = [];
    spawnRef.current = null;
    rewindRef.current = null;
    giftQueueRef.current = [];
    publish();
  }, [cols, rows, publish]);

  const start = useCallback(() => {
    if (retryRef.current != null) {
      window.clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    applyComboToggle();
    resetMatchFeed();
    let game = createGame(cols, rows);
    if (isAutoplay()) {
      autoplayOnNewRun(game.tickMs);
      game = applyAutoplayDir(game, pickAutoplayDir(game));
    }
    const now = performance.now();
    liveRef.current = startRun(game, now);
    spawnRef.current = cloneGame(liveRef.current);
    historyRef.current = [{ at: now, state: spawnRef.current }];
    rewindRef.current = null;
    giftQueueRef.current = [];
    keysRef.current?.reset();
    beginRun();
    publish();
  }, [applyComboToggle, beginRun, cols, rows, publish]);

  const startRef = useRef(start);
  startRef.current = start;
  const beginRewindRef = useRef<(now: number) => void>(() => {});
  const finishRewindRef = useRef<(now: number) => void>(() => {});

  const queueAutoRetry = useCallback(() => {
    if (!isAutoplay() || retryRef.current != null) return;
    const wait = Math.max(7000, 7000 + Math.pow(Math.random(), 2.4) * 5000);
    retryRef.current = window.setTimeout(() => {
      retryRef.current = null;
      startRef.current();
    }, wait);
  }, []);

  const togglePause = useCallback(() => {
    const current = liveRef.current;
    if (current.hijacked || rewindRef.current) return;
    if (current.status === "playing") {
      if (!isAutoplay()) markDirty();
      keysRef.current?.reset();
      const pauseT = Math.min(
        1,
        Math.max(0, (performance.now() - current.tickStartedAt) / current.tickMs),
      );
      liveRef.current = { ...current, status: "paused", pauseT };
      publish();
      return;
    }
    if (current.status === "paused") {
      if (!isAutoplay()) markDirty();
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
      if (isAutoplay() || liveRef.current.hijacked || rewindRef.current) return;
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

  const finishRewind = useCallback((now: number) => {
    const play = rewindRef.current;
    rewindRef.current = null;
    const land = play?.frames.at(-1);
    let next = land
      ? shiftGameClock(cloneGame(land.state), now - land.at)
      : liveRef.current;
    next.status = "playing";
    next.queued = [];
    next.tickStartedAt = now;
    next.prevSnake = next.snake.map((part) => ({ ...part }));
    historyRef.current = [{ at: now, state: cloneGame(next) }];
    resetTwanvlBrain();
    if (isAutoplay() && next.status === "playing") {
      next = applyAutoplayDir(next, pickAutoplayDir(next));
    }
    liveRef.current = next;
    const queued = giftQueueRef.current;
    giftQueueRef.current = [];
    for (const item of queued) {
      if (item.action.rewind) {
        beginRewindRef.current(performance.now());
        break;
      }
      liveRef.current = applyGift(liveRef.current, item.action, now, item.user);
    }
    publish();
  }, [publish]);

  const beginRewind = useCallback(
    (now: number) => {
      const current = liveRef.current;
      if (current.status !== "playing" && current.status !== "paused") return;
      keysRef.current?.reset();
      const frames = rewindTape(historyRef.current, current, now);
      if (frames.length < 2) {
        const snap = frames[0];
        liveRef.current = {
          ...shiftGameClock(cloneGame(snap?.state ?? current), now - (snap?.at ?? now)),
          status: "playing",
          queued: [],
          tickStartedAt: now,
        };
        resetTwanvlBrain();
        if (isAutoplay()) {
          liveRef.current = applyAutoplayDir(liveRef.current, pickAutoplayDir(liveRef.current));
        }
        publish();
        return;
      }
      rewindRef.current = {
        frames,
        startedAt: now,
        shown: -1,
        duration: REWIND_PLAY_MS,
      };
      liveRef.current = {
        ...current,
        status: "playing",
        glowUntil: Math.max(current.glowUntil, now + REWIND_PLAY_MS + 800),
      };
      publish();
    },
    [publish],
  );

  finishRewindRef.current = finishRewind;
  beginRewindRef.current = beginRewind;

  const advance = useCallback((now: number) => {
    const rewind = rewindRef.current;
    if (rewind) {
      const t = Math.min(1, (now - rewind.startedAt) / rewind.duration);
      const eased = t * t;
      const index = Math.min(
        rewind.frames.length - 1,
        Math.floor(eased * (rewind.frames.length - 1)),
      );
      if (index !== rewind.shown) {
        const snap = rewind.frames[index];
        const frame = shiftGameClock(cloneGame(snap.state), now - snap.at);
        frame.status = "playing";
        frame.queued = [];
        frame.hijacked = false;
        frame.ateAt = 0;
        frame.bombHitAt = 0;
        frame.bombBurstAt = 0;
        if (rewind.shown >= 0 && index === rewind.shown + 1) {
          frame.prevSnake = liveRef.current.snake.map((part) => ({ ...part }));
          frame.tickStartedAt = now;
        } else {
          frame.tickStartedAt = now - frame.tickMs;
        }
        frame.glowUntil = Math.max(frame.glowUntil, rewind.startedAt + rewind.duration + 800);
        liveRef.current = frame;
        rewind.shown = index;
        const snapshot = toUi(frame);
        setUi((prev) =>
          prev.score === snapshot.score && prev.length === snapshot.length ? prev : snapshot,
        );
      }
      if (t >= 1) finishRewindRef.current(now);
      return;
    }

    const playing = liveRef.current;
    if (playing.status !== "playing") return;

    if (playing.tickStartedAt === 0) {
      playing.tickStartedAt = now;
    }

    const lag = now - playing.tickStartedAt;
    if (lag > playing.tickMs * 4) {
      playing.tickStartedAt = now - playing.tickMs;
    }

    let advanced = false;
    const burst = now - playing.tickStartedAt >= playing.tickMs * 2;
    while (now - liveRef.current.tickStartedAt >= liveRef.current.tickMs) {
      let current = expireBombs(liveRef.current, now);
      if (current.hijacked && current.hijackUntil > 0 && now >= current.hijackUntil) {
        current = { ...current, hijacked: false, hijackUntil: 0, hijackStartedAt: 0 };
      }
      if (current.hijacked) {
        current = applyHijackDir(current, pickHijackDir(current, now));
      } else if (isAutoplay()) {
        const facing = current.queued.at(0) ?? current.direction;
        const dir = pickAutoplayDir(current);
        current = applyAutoplayDir(current, dir);
        if (!burst) {
          keysRef.current?.onMove(dir, {
            turn: dir !== facing,
            remain: openAhead(current, dir),
            tickMs: current.tickMs,
          });
        }
      }

      const next = step(current, now);
      next.tickStartedAt = current.tickStartedAt + current.tickMs;
      if (next.status === "over" || next.status === "won") {
        next.hijacked = false;
        next.hijackUntil = 0;
        next.hijackStartedAt = 0;
      }
      liveRef.current = next;
      advanced = true;
      if (next.status === "playing") {
        historyRef.current.push({ at: now, state: cloneGame(next) });
        const keep = now - REWIND_MS;
        historyRef.current = historyRef.current.filter((snap) => snap.at >= keep);
      }

      if (!burst && next.score > current.score) playEat();

      if (next.status === "over" || next.status === "won") {
        if (next.status === "over") {
          if (!burst) playBonk();
          bumpDeath();
        }
        if (next.status === "won") bumpWin();
        comboRef.current.eligible =
          !isAutoplay() && next.status === "over" && comboRef.current.pristine;
        setUi(toUi(next));
        onEndRef.current?.(next.snake.length);
        if (isAutoplay()) queueAutoRetry();
        return;
      }
    }

    if (advanced) {
      const snapshot = toUi(liveRef.current);
      setUi((prev) =>
        prev.score === snapshot.score &&
        prev.status === snapshot.status &&
        prev.length === snapshot.length &&
        prev.hijacked === snapshot.hijacked
          ? prev
          : snapshot,
      );
    }
  }, [queueAutoRetry]);

  useEffect(() => {
    const actor = createKeyActor((key) => setHeldKey(key));
    keysRef.current = actor;
    resumeAudio();
    return () => {
      actor.dispose();
      keysRef.current = null;
    };
  }, []);

  useEffect(() => {
    return onLiveGift((gift) => {
      const action = resolveGift(gift);
      const coins = Math.max(0, gift.coins) * Math.max(1, gift.count ?? 1);
      recordMatchGift(gift.user, coins, gift.avatar, gift.uniqueId || gift.user);
      const now = performance.now();
      if (rewindRef.current) {
        if (!action.rewind) giftQueueRef.current.push({ action, user: gift.user });
      } else if (action.rewind) {
        beginRewindRef.current(now);
      } else {
        liveRef.current = applyGift(liveRef.current, action, now, gift.user);
      }
      if (action.takeover) {
        keysRef.current?.reset();
        setHeldKey(null);
      }
      pushLiveAlert({
        id: gift.id,
        user: gift.user,
        label: action.label,
        tone: action.tone,
      });
      publish();
    });
  }, [publish]);

  useEffect(() => {
    return onLiveLike((like) => {
      recordMatchLike(like.user, like.likes, like.avatar, like.uniqueId || like.user);
    });
  }, []);

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

function openAhead(state: GameState, dir: Direction) {
  const delta = DELTA[dir];
  const tail = state.snake[state.snake.length - 1];
  const taken = new Set(state.snake.map((part) => `${part.x},${part.y}`));
  let x = state.snake[0].x + delta.x;
  let y = state.snake[0].y + delta.y;
  let n = 0;
  while (x >= 0 && y >= 0 && x < state.cols && y < state.rows) {
    const atTail = x === tail.x && y === tail.y;
    if (taken.has(`${x},${y}`) && (!atTail || state.pendingGrow > 0)) break;
    if (state.bombs.some((bomb) => bomb.x === x && bomb.y === y)) break;
    n += 1;
    x += delta.x;
    y += delta.y;
  }
  return n;
}

function toUi(state: GameState): GameUi {
  return {
    score: state.snake.length,
    status: state.status,
    length: state.snake.length,
    gridSize: state.gridSize,
    hijacked: state.hijacked,
  };
}
