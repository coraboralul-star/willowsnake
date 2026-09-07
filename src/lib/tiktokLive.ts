"use client";

import { emitLiveGift, type LiveGift } from "@/lib/gifts";

export type TikTokLiveHandle = {
  disconnect: () => void;
};

export async function connectTikTokLive(
  uniqueId: string,
  onGift: (gift: LiveGift) => void = emitLiveGift,
): Promise<TikTokLiveHandle> {
  void uniqueId;
  void onGift;
  throw new Error(
    "TikTok Live is not wired yet. Open ?gifts=1 and use the test gifts, then swap this function for a livestream connector that calls emitLiveGift().",
  );
}
