"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { GameBoard } from "@/components/GameBoard";
import { MatchRecap } from "@/components/MatchRecap";
import { GiftTestBar } from "@/components/GiftTestBar";
import { GiftToasts } from "@/components/GiftToasts";
import { KeyPad } from "@/components/KeyPad";
import { PixelApple } from "@/components/SnakeMascot";
import { useHighScores } from "@/hooks/useHighScores";
import { useSessionStats } from "@/hooks/useSessionStats";
import { useSnakeGame } from "@/hooks/useSnakeGame";
import { BOARD_COLS, BOARD_ROWS } from "@/lib/engine";
import { isGiftTestMode } from "@/lib/gifts";
import { useTopGifter } from "@/lib/matchFeed";
import { connectTikTokLive } from "@/lib/tiktokLive";
import {
  DEFAULT_SNAKE_SKIN,
  SNAKE_SKINS,
  SNAKE_SKIN_LIST,
  type SnakeSkinId,
} from "@/lib/snakeSkins";

const Board3D = dynamic(() => import("@/components/Board3D").then((mod) => mod.Board3D), {
  ssr: false,
});

type GameAppProps = {
  enabled: boolean;
};

export function GameApp({ enabled }: GameAppProps) {
  const { best, record } = useHighScores();
  const session = useSessionStats();
  const topGifter = useTopGifter();
  const { liveRef, ui, heldKey, start, reset, togglePause, steer, advance } = useSnakeGame(
    BOARD_COLS,
    BOARD_ROWS,
    enabled,
    record,
  );
  const [giftTest, setGiftTest] = useState(false);
  const [skinId, setSkinId] = useState<SnakeSkinId>(DEFAULT_SNAKE_SKIN);
  const skin = SNAKE_SKINS[skinId];
  const liveBest = Math.max(best, ui.score);
  const overlay = ui.status === "over" || ui.status === "won" || ui.status === "paused";
  const ended = ui.status === "over" || ui.status === "won";
  const hud = useMemo(
    () => ({
      score: ui.score,
      best: liveBest,
      deaths: session.deaths,
      attempts: session.attempts,
      wins: session.wins,
    }),
    [ui.score, liveBest, session.deaths, session.attempts, session.wins],
  );

  useEffect(() => {
    setGiftTest(isGiftTestMode());
    try {
      const saved = localStorage.getItem("willow-snake-skin");
      if (saved && saved in SNAKE_SKINS) setSkinId(saved as SnakeSkinId);
    } catch {
      // Ignore private-mode read failures.
    }
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return;
    const handle = connectTikTokLive();
    return () => handle.disconnect();
  }, []);


  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center gap-2">
      <AnimatePresence>
        {ui.hijacked && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-40 bg-zinc-950/55 backdrop-grayscale"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          />
        )}
      </AnimatePresence>
      {giftTest && <GiftTestBar />}

      <section className="relative z-10 flex w-full items-center justify-center gap-3">
        <div className="flex flex-col items-center gap-3">
          <KeyPad
            heldKey={heldKey}
            onSteer={steer}
            onPause={togglePause}
            onRetry={start}
            status={ui.status}
          />
          <SnakeColorPicker
            selected={skinId}
            onSelect={(id) => {
              setSkinId(id);
              try {
                localStorage.setItem("willow-snake-skin", id);
              } catch {
                // Ignore private-mode write failures.
              }
            }}
          />
        </div>
        <div
          className={`relative min-w-0 w-[min(58rem,calc(100%-8rem))] transition-transform duration-300 ${
            ui.hijacked ? "scale-[1.04]" : ""
          }`}
        >
          <div className="pointer-events-none absolute -left-[1200px] top-0" aria-hidden>
            <GameBoard liveRef={liveRef} advance={advance} textureSize={256} />
          </div>
          <div className="aspect-square w-full overflow-hidden rounded-[1.2rem] bg-[#1a120c]">
            <Board3D liveRef={liveRef} topGifter={topGifter} skin={skin} />
          </div>
          <ScoreHubs hud={hud} />
          <div className="pointer-events-none absolute right-3 top-16 z-20 w-36 sm:w-40">
            <div className="pointer-events-auto">
              <GiftToasts />
            </div>
          </div>
          <AnimatePresence>
            {ui.status === "idle" && (
              <Overlay key="idle">
                <PixelApple className="mb-3 h-14 w-14" />
                <p className="font-display text-lg text-white">EAT!</p>
                <button type="button" className="btn-primary mt-6" onClick={start}>
                  PLAY
                </button>
              </Overlay>
            )}
            {overlay && ui.status !== "idle" && (
              <Overlay key={ui.status}>
                <p className="font-display text-lg text-white">
                  {ui.status === "paused" ? "PAUSED" : ui.status === "won" ? "CLEARED" : "GAME OVER"}
                </p>
                {ended && <p className="mt-3 font-display text-2xl text-emerald-300">{ui.score}</p>}
                {ended && <MatchRecap />}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {ui.status === "paused" ? (
                    <button type="button" className="btn-primary" onClick={togglePause}>
                      RESUME
                    </button>
                  ) : (
                    <>
                      <button type="button" className="btn-primary" onClick={start}>
                        RETRY
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => reset()}>
                        <RotateCcw className="h-4 w-4" />
                        RESET
                      </button>
                    </>
                  )}
                </div>
              </Overlay>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}

function SnakeColorPicker({
  selected,
  onSelect,
}: {
  selected: SnakeSkinId;
  onSelect: (id: SnakeSkinId) => void;
}) {
  return (
    <div className="grid w-[108px] grid-cols-3 gap-1.5" role="group" aria-label="Snake color">
      {SNAKE_SKIN_LIST.map((skin) => {
        const on = skin.id === selected;
        return (
          <button
            key={skin.id}
            type="button"
            aria-label={skin.label}
            aria-pressed={on}
            title={skin.label}
            onClick={() => onSelect(skin.id)}
            className={`h-7 w-7 justify-self-center rounded-full border-2 shadow-soft ${
              on ? "scale-110 border-white" : "border-black/25 hover:border-white/80"
            }`}
            style={{ background: skin.body }}
          />
        );
      })}
    </div>
  );
}

function ScoreHubs({
  hud,
}: {
  hud: { score: number; best: number; deaths: number; attempts: number; wins: number };
}) {
  const cells = [
    { emoji: "🍎", label: "Score", value: hud.score },
    { emoji: "🏆", label: "Best", value: hud.best },
    { emoji: "💀", label: "Deaths", value: hud.deaths },
    { emoji: "🎮", label: "Attempts", value: hud.attempts },
    { emoji: "🏅", label: "Wins", value: hud.wins },
  ];
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex w-[calc(100%-0.75rem)] -translate-x-1/2 flex-wrap justify-center gap-1.5">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="flex items-center gap-1 rounded-lg bg-black/75 px-2 py-1 shadow-soft backdrop-blur-sm"
        >
          <span className="text-sm leading-none">{cell.emoji}</span>
          <span className="font-display text-[0.38rem] uppercase tracking-wide text-white/70">
            {cell.label}
          </span>
          <span className="font-display text-[0.8rem] text-white">{cell.value}</span>
        </div>
      ))}
    </div>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="pointer-events-auto absolute left-1/2 top-1/2 z-30 flex w-[min(20rem,64%)] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center overflow-hidden rounded-[1.1rem] bg-zinc-950/82 px-4 py-5 text-center text-white shadow-soft backdrop-blur-[8px] sm:px-6"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.16 }}
    >
      {children}
    </motion.div>
  );
}
