"use client";

import type { ReactNode } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { Direction, GameStatus } from "@/lib/engine";
import { playKeyDown, playKeyUp, type GameKey } from "@/lib/keyboardSounds";

type KeyPadProps = {
  heldKey: string | null;
  onSteer: (dir: Direction) => void;
  onPause: () => void;
  onRetry: () => void;
  status: GameStatus;
};

const KEYS: { id: GameKey; dir: Direction; label: string; className: string }[] = [
  { id: "w", dir: "up", label: "W", className: "col-start-2 row-start-1" },
  { id: "a", dir: "left", label: "A", className: "col-start-1 row-start-2" },
  { id: "s", dir: "down", label: "S", className: "col-start-2 row-start-2" },
  { id: "d", dir: "right", label: "D", className: "col-start-3 row-start-2" },
];

export const SIDE_RAIL_CLASS = "w-[168px] shrink-0";

export function SideRailSlot({ children }: { children: ReactNode }) {
  return (
    <div className={`${SIDE_RAIL_CLASS} relative`}>
      <div className="invisible pointer-events-none select-none" aria-hidden>
        <div className="flex flex-col items-center gap-3">
          <div className="grid h-[6.5rem] w-[168px] grid-cols-3 grid-rows-2 gap-2" />
          <div className="h-12 w-[168px]" />
        </div>
      </div>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}

export function KeyPad({ heldKey, onSteer, onPause, onRetry, status }: KeyPadProps) {
  const retry = status === "over" || status === "won";
  const idle = status === "idle";
  const paused = status === "paused";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid w-[168px] grid-cols-3 grid-rows-2 gap-2">
        {KEYS.map((key) => {
          const active = heldKey === key.id;
          return (
            <button
              key={key.id}
              type="button"
              aria-label={`Move ${key.dir}`}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                playKeyDown(key.id);
                onSteer(key.dir);
              }}
              onPointerUp={() => playKeyUp(key.id)}
              onPointerCancel={() => playKeyUp(key.id)}
              onClick={(event) => {
                if (event.detail === 0) onSteer(key.dir);
              }}
              className={`keycap ${key.className} ${active ? "keycap-active" : ""}`}
            >
              {key.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="keycap w-[168px] text-[0.62rem]"
        onPointerDown={(event) => {
          if (idle || retry) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          playKeyDown("space");
        }}
        onPointerUp={() => playKeyUp("space")}
        onPointerCancel={() => playKeyUp("space")}
        onClick={() => {
          if (idle || retry) {
            onRetry();
            playKeyDown("space");
            return;
          }
          onPause();
        }}
      >
        {idle || retry ? (
          <RotateCcw className="h-3.5 w-3.5" />
        ) : paused ? (
          <Play className="h-3.5 w-3.5" />
        ) : (
          <Pause className="h-3.5 w-3.5" />
        )}
        {idle ? "Play" : retry ? "Retry" : paused ? "Resume" : "Pause"}
        <span className="ml-1 text-ink-soft">Space</span>
      </button>
    </div>
  );
}
