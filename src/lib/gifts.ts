"use client";

export type LiveGift = {
  id: string;
  user: string;
  coins: number;
};

export type GiftTone = "rose" | "rain" | "nitro" | "golden";

export type GiftAction = {
  apples: number;
  golden: number;
  hearts: number;
  nitroMs: number;
  slowMs: number;
  glowMs: number;
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

export const TEST_COINS = [1, 10, 50, 100] as const;

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

export function testCoins(coins: number, user = "Test gifter") {
  emitLiveGift({
    id: `test-${coins}-${Date.now()}`,
    user,
    coins,
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
    confetti: false,
    label,
    tone,
    ...extra,
  };
}

function coinLabel(coins: number) {
  return coins === 1 ? "1 coin" : `${coins} coins`;
}

export function resolveGift(gift: LiveGift): GiftAction {
  const coins = Math.max(0, gift.coins);
  const label = coinLabel(coins);

  if (coins >= 100) {
    return snack(label, "golden", {
      golden: 1,
      glowMs: 7000,
      confetti: true,
    });
  }
  if (coins >= 50) {
    return snack(label, "nitro", {
      apples: 1,
      nitroMs: 8000,
      glowMs: 8000,
    });
  }
  if (coins >= 10) {
    return snack(label, "rain", {
      apples: Math.min(12, Math.max(5, Math.floor(coins / 2))),
      glowMs: 2500,
      confetti: true,
    });
  }
  return snack(label, "rose", {
    apples: coins > 0 ? 1 : 0,
    glowMs: coins > 0 ? 1800 : 0,
  });
}
