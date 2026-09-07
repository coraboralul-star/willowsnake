"use client";

export type LiveGift = {
  id: string;
  user: string;
  coins: number;
  count?: number;
};

export type GiftTone = "rose" | "rain" | "nitro" | "golden" | "takeover";

export type GiftAction = {
  apples: number;
  golden: number;
  hearts: number;
  nitroMs: number;
  slowMs: number;
  glowMs: number;
  takeover: boolean;
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
  { coins: 1, count: 10, label: "10×1" },
  { coins: 10, count: 1, label: "10" },
  { coins: 50, count: 1, label: "50" },
  { coins: 100, count: 1, label: "100" },
  { coins: 999, count: 1, label: "999+" },
];

type GiftHandler = (gift: LiveGift) => void;
type AlertHandler = (alert: LiveAlert) => void;

const giftHandlers = new Set<GiftHandler>();
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

function snack(label: string, tone: GiftTone, extra: Partial<GiftAction> = {}): GiftAction {
  return {
    apples: 0,
    golden: 0,
    hearts: 0,
    nitroMs: 0,
    slowMs: 0,
    glowMs: 0,
    takeover: false,
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
  const label = unit >= 999 ? "Take over" : coinLabel(unit, count);

  if (unit >= 999) {
    return snack(label, "takeover", { takeover: true });
  }
  if (unit >= 100) {
    return snack(label, "golden", {
      golden: count,
      glowMs: 7000,
      confetti: true,
    });
  }
  if (unit >= 50) {
    return snack(label, "nitro", {
      apples: count,
      nitroMs: 8000,
      glowMs: 8000,
    });
  }
  if (unit >= 10) {
    const rain = Math.min(12, Math.max(5, Math.floor(unit / 2)));
    return snack(label, "rain", {
      apples: rain * count,
      glowMs: 2500,
      confetti: true,
    });
  }
  return snack(label, "rose", {
    apples: count,
    glowMs: 1800,
  });
}
