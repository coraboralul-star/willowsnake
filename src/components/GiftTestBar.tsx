"use client";

import { Gift, Heart } from "lucide-react";
import { TEST_DROPS, testCoins, testLikes } from "@/lib/gifts";

export function GiftTestBar() {
  return (
    <div className="relative z-10 flex w-full flex-wrap items-center justify-center gap-2 rounded-xl bg-cream px-3 py-2 text-center shadow-soft">
      <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-ink-soft">
        Coin test
      </p>
      {TEST_DROPS.map((drop) => (
        <button
          key={drop.label}
          type="button"
          className="btn-primary !py-1.5 !text-[0.65rem]"
          onClick={() => testCoins(drop.coins, drop.count)}
        >
          <Gift className="h-3.5 w-3.5" />
          {drop.label}
        </button>
      ))}
      <button
        type="button"
        className="btn-primary !py-1.5 !text-[0.65rem]"
        onClick={() => testLikes(8 + Math.floor(Math.random() * 20))}
      >
        <Heart className="h-3.5 w-3.5" />
        like
      </button>
    </div>
  );
}
