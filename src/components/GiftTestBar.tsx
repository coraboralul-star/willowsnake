"use client";

import { Gift } from "lucide-react";
import { TEST_COINS, testCoins } from "@/lib/gifts";

export function GiftTestBar() {
  return (
    <div className="relative z-10 flex w-full flex-wrap items-center justify-center gap-2 rounded-xl bg-cream px-3 py-2 text-center shadow-soft">
      <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-ink-soft">
        Coin test
      </p>
      {TEST_COINS.map((coins) => (
        <button
          key={coins}
          type="button"
          className="btn-primary !py-1.5 !text-[0.65rem]"
          onClick={() => testCoins(coins)}
        >
          <Gift className="h-3.5 w-3.5" />
          {coins}
        </button>
      ))}
    </div>
  );
}
