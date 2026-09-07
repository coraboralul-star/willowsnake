"use client";

export type LiveGift = {
  id: string;
  user: string;
  name: string;
  repeat?: number;
  diamonds?: number;
};

export type GiftTone = "rose" | "rain" | "golden" | "nitro" | "hearts";

export type GiftAction = {
  apples: number;
  golden: number;
  hearts: number;
  nitroMs: number;
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

export const TEST_GIFTS: { name: string; label: string }[] = [
  { name: "Rose", label: "Rose" },
  { name: "Bouquet", label: "Apple rain" },
  { name: "Golden", label: "Golden" },
  { name: "Nitro", label: "Nitro" },
  { name: "Hearts", label: "Hearts" },
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

export function testGift(name: string, user = "Test gifter") {
  emitLiveGift({
    id: `test-${name}-${Date.now()}`,
    user,
    name,
    repeat: 1,
  });
}

export function resolveGift(gift: LiveGift): GiftAction {
  const name = gift.name.toLowerCase();
  const n = Math.max(1, gift.repeat ?? 1);
  const diamonds = gift.diamonds ?? 0;

  if (
    name.includes("gold") ||
    name.includes("universe") ||
    name.includes("lion") ||
    diamonds >= 100
  ) {
    return {
      apples: 0,
      golden: 1,
      hearts: 0,
      nitroMs: 0,
      glowMs: 7000,
      confetti: true,
      label: "Golden snack",
      tone: "golden",
    };
  }
  if (name.includes("nitro") || name.includes("gg") || name.includes("speed")) {
    return {
      apples: 1,
      golden: 0,
      hearts: 0,
      nitroMs: 8000,
      glowMs: 8000,
      confetti: false,
      label: "Nitro",
      tone: "nitro",
    };
  }
  if (name.includes("heart") || name.includes("love") || name.includes("kiss")) {
    return {
      apples: 0,
      golden: 0,
      hearts: 3,
      nitroMs: 0,
      glowMs: 6000,
      confetti: true,
      label: "Heart rain",
      tone: "hearts",
    };
  }
  if (name.includes("bouquet") || name.includes("rosa") || n >= 5 || diamonds >= 10) {
    return {
      apples: Math.min(12, 5 * n),
      golden: 0,
      hearts: 0,
      nitroMs: 0,
      glowMs: 2500,
      confetti: true,
      label: "Apple rain",
      tone: "rain",
    };
  }
  return {
    apples: Math.min(9, n),
    golden: 0,
    hearts: 0,
    nitroMs: 0,
    glowMs: 1800,
    confetti: false,
    label: "Snack",
    tone: "rose",
  };
}
