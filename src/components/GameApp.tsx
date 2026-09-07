"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { GameBoard } from "@/components/GameBoard";
import { GiftTestBar } from "@/components/GiftTestBar";
import { GiftToasts } from "@/components/GiftToasts";
import { KeyPad, SIDE_RAIL_CLASS } from "@/components/KeyPad";
import { PixelApple, PixelSkull, SnakeMascot } from "@/components/SnakeMascot";
import { useHighScores } from "@/hooks/useHighScores";
import { useSessionStats } from "@/hooks/useSessionStats";
import { useSnakeGame } from "@/hooks/useSnakeGame";
import { GRID_PRESETS, type GridId } from "@/lib/engine";
import { isGiftTestMode } from "@/lib/gifts";

type GameAppProps = {
  gridId: GridId;
  onGridId: (id: GridId) => void;
  enabled: boolean;
};

export function GameApp({ gridId, onGridId, enabled }: GameAppProps) {
  const preset = GRID_PRESETS.find((item) => item.id === gridId) ?? GRID_PRESETS[1];
  const { scores, record } = useHighScores();
  const session = useSessionStats();
  const { liveRef, ui, heldKey, start, reset, togglePause, steer, advance } = useSnakeGame(
    preset.size,
    enabled,
    (score) => record(gridId, score),
  );
  const [giftTest, setGiftTest] = useState(false);
  const best = scores[gridId] ?? 0;
  const liveBest = Math.max(best, ui.score);
  const isNewBest = ui.score > 0 && ui.score >= liveBest && ui.score > (best || 0);
  const overlay = ui.status === "over" || ui.status === "won" || ui.status === "paused";

  useEffect(() => {
    setGiftTest(isGiftTestMode());
  }, []);

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-3">
      <header className="relative z-10 flex w-full flex-col items-center text-center">
        <SnakeMascot className="h-16 w-32 sm:h-20 sm:w-40" />
        <p className="mt-1 text-[0.7rem] font-extrabold uppercase tracking-[0.28em] text-ink-soft">
          Arcade snake
        </p>
        <h1 className="mt-2 font-display text-2xl text-ink sm:text-3xl">WILLOW</h1>
      </header>

      <div className="relative z-10 flex w-full items-stretch justify-center gap-3">
        <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cream px-3 py-2 shadow-soft">
          <PixelApple className="h-8 w-8" />
          <div>
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-ink-soft">Score</p>
            <motion.p
              key={ui.score}
              initial={{ y: 8, scale: 1.12, opacity: 0.5 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 22 }}
              className="font-display text-xl leading-none text-ink"
            >
              {ui.score}
            </motion.p>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center rounded-xl bg-cream px-3 py-2 shadow-soft">
          <div>
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-ink-soft">Best</p>
            <p className="font-display text-xl leading-none text-sage-deep">{liveBest}</p>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cream px-3 py-2 shadow-soft">
          <PixelSkull className="h-8 w-8" />
          <div>
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-ink-soft">Deaths</p>
            <p className="font-display text-xl leading-none text-ink">{session.deaths}</p>
          </div>
        </div>
      </div>

      <p className="relative z-10 font-display text-sm text-ink">
        {session.attempts} attempts
        <span className="mx-2 text-ink-soft">·</span>
        {session.wins} wins
      </p>

      {giftTest && <GiftTestBar />}

      <div className="relative z-10 flex flex-wrap justify-center gap-2">
        {GRID_PRESETS.map((item) => {
          const selected = item.id === gridId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onGridId(item.id)}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                selected ? "bg-sage text-cream shadow-soft" : "bg-cream/80 text-ink hover:bg-cream"
              }`}
            >
              {item.label}
              <span className="ml-2 opacity-70">{item.hint}</span>
            </button>
          );
        })}
      </div>

      <section className="relative z-10 flex w-full flex-row items-center justify-center gap-3">
        <div className={SIDE_RAIL_CLASS}>
          <KeyPad
            heldKey={heldKey}
            onSteer={steer}
            onPause={togglePause}
            onRetry={start}
            status={ui.status}
          />
        </div>
        <div
          className={`board-frame relative min-w-0 w-[min(32rem,56dvh)] max-w-[calc(100%-22.5rem)] ${
            ui.status === "over" ? "board-shake" : ""
          }`}
        >
          <GameBoard liveRef={liveRef} advance={advance} />
          <AnimatePresence>
            {ui.status === "idle" && (
              <Overlay key="idle">
                <PixelApple className="mb-3 h-14 w-14" />
                <p className="font-display text-lg text-ink">EAT!</p>
                <button type="button" className="btn-primary mt-6" onClick={start}>
                  PLAY
                </button>
              </Overlay>
            )}
            {overlay && ui.status !== "idle" && (
              <Overlay key={ui.status}>
                <p className="font-display text-lg text-ink">
                  {ui.status === "paused"
                    ? "PAUSED"
                    : ui.status === "won"
                      ? "CLEARED"
                      : isNewBest
                        ? "NEW BEST"
                        : "GAME OVER"}
                </p>
                {ui.status !== "paused" && (
                  <p className="mt-3 font-display text-2xl text-sage-deep">{ui.score}</p>
                )}
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
        <div className={SIDE_RAIL_CLASS}>
          <GiftToasts />
        </div>
      </section>
    </div>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="absolute inset-3 flex flex-col items-center justify-center rounded-[1.1rem] bg-parchment/82 px-6 text-center backdrop-blur-[6px]"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.16 }}
    >
      {children}
    </motion.div>
  );
}
