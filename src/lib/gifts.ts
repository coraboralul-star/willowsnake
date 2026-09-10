"use client";

export type LiveGift = {
  id: string;
  user: string;
  coins: number;
  count?: number;
  avatar?: string;
  uniqueId?: string;
};

export type LiveLike = {
  id: string;
  user: string;
  likes: number;
  avatar?: string;
  uniqueId?: string;
};

export type GiftTone = "rose" | "rain" | "bomb" | "flood" | "rewind";

export type GiftAction = {
  apples: number;
  bombs: number;
  golden: number;
  hearts: number;
  appleFlood: boolean;
  bombFlood: boolean;
  nitroMs: number;
  slowMs: number;
  glowMs: number;
  takeover: boolean;
  rewind: boolean;
  confetti: boolean;
  label: string;
  tone: GiftTone;
};

export type LiveAlert = {
  id: string;
  user: string;
  label: string;
  tone: GiftTone;
};

export const TEST_DROPS: { coins: number; count: number; label: string }[] = [
  { coins: 1, count: 1, label: "1" },
  { coins: 10, count: 1, label: "10" },
  { coins: 15, count: 1, label: "15" },
  { coins: 100, count: 1, label: "100" },
  { coins: 149, count: 1, label: "149" },
  { coins: 200, count: 1, label: "200" },
];

type GiftHandler = (gift: LiveGift) => void;
type LikeHandler = (like: LiveLike) => void;
type AlertHandler = (alert: LiveAlert) => void;

const giftHandlers = new Set<GiftHandler>();
const likeHandlers = new Set<LikeHandler>();
const alertHandlers = new Set<AlertHandler>();

export function onLiveGift(handler: GiftHandler) {
  giftHandlers.add(handler);
  return () => {
    giftHandlers.delete(handler);
  };
}

export function emitLiveGift(gift: LiveGift) {
  for (const handler of giftHandlers) handler(gift);
}

export function onLiveLike(handler: LikeHandler) {
  likeHandlers.add(handler);
  return () => {
    likeHandlers.delete(handler);
  };
}

export function emitLiveLike(like: LiveLike) {
  for (const handler of likeHandlers) handler(like);
}

export function onLiveAlert(handler: AlertHandler) {
  alertHandlers.add(handler);
  return () => {
    alertHandlers.delete(handler);
  };
}

export function pushLiveAlert(alert: LiveAlert) {
  for (const handler of alertHandlers) handler(alert);
}

export function isGiftTestMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("gifts");
}

export function testCoins(coins: number, count = 1, user = "Test gifter") {
  emitLiveGift({
    id: `test-${coins}x${count}-${Date.now()}`,
    user,
    coins,
    count,
  });
}

export function testLikes(likes = 12, user = "Test liker") {
  emitLiveLike({
    id: `like-${user}-${Date.now()}`,
    user,
    likes,
  });
}

function snack(label: string, tone: GiftTone, extra: Partial<GiftAction> = {}): GiftAction {
  return {
    apples: 0,
    bombs: 0,
    golden: 0,
    hearts: 0,
    appleFlood: false,
    bombFlood: false,
    nitroMs: 0,
    slowMs: 0,
    glowMs: 0,
    takeover: false,
    rewind: false,
    confetti: false,
    label,
    tone,
    ...extra,
  };
}

function coinLabel(coins: number, count: number) {
  const unit = coins === 1 ? "1 coin" : `${coins} coins`;
  if (count > 1) return `${count}×${unit}`;
  return unit;
}

export function resolveGift(gift: LiveGift): GiftAction {
  const unit = Math.max(0, Math.floor(gift.coins));
  const count = Math.max(1, Math.floor(gift.count ?? 1));
  const label = coinLabel(unit, count);

  if (unit === 1) {
    return snack(label, "rose", { apples: count, glowMs: 1800 });
  }
  if (unit === 10) {
    return snack(label, "rain", { apples: 15 * count, glowMs: 2500, confetti: true });
  }
  if (unit === 15) {
    return snack(label, "bomb", { bombs: 5 * count, glowMs: 2500 });
  }
  if (unit === 100) {
    return snack(label, "flood", { appleFlood: true, glowMs: 4000, confetti: true });
  }
  if (unit === 149) {
    return snack(label, "bomb", { bombFlood: true, glowMs: 4000 });
  }
  if (unit === 200) {
    return snack(label, "rewind", { rewind: true, glowMs: 3600 });
  }
  return snack(label, "rose");
}
