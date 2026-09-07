"use client";

import { Gift } from "lucide-react";
import { TEST_GIFTS, testGift } from "@/lib/gifts";

export function GiftTestBar() {
  return (
    <div className="relative z-10 flex w-full flex-wrap items-center justify-center gap-2 rounded-xl bg-cream px-3 py-2 text-center shadow-soft">
      <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-ink-soft">
        Gift test
      </p>
      {TEST_GIFTS.map((gift) => (
        <button
          key={gift.name}
          type="button"
          className="btn-primary !py-1.5 !text-[0.65rem]"
          onClick={() => testGift(gift.name)}
        >
          <Gift className="h-3.5 w-3.5" />
          {gift.label}
        </button>
      ))}
    </div>
  );
}
