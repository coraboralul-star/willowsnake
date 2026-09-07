"use client";

export type LiveGift = {
  id: string;
  user: string;
  name: string;
  repeat?: number;
  diamonds?: number;
};

export type GiftTone = "rose" | "rain" | "golden" | "nitro" | "hearts" | "slow" | "disco" | "party" | "cheer" | "lucky";

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

export const TEST_GIFTS: { name: string; label: string }[] = [
  { name: "Rose", label: "Rose" },
  { name: "Bouquet", label: "Apple rain" },
  { name: "Golden", label: "Golden" },
  { name: "Nitro", label: "Nitro" },
  { name: "Hearts", label: "Hearts" },
  { name: "Slow", label: "Slow-mo" },
  { name: "Disco", label: "Disco" },
  { name: "Party", label: "Party" },
  { name: "Cheer", label: "Cheer" },
  { name: "Lucky", label: "Lucky" },
];

const LUCKY_NAMES = ["Rose", "Golden", "Nitro", "Hearts", "Slow", "Disco", "Party"] as const;

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

export function resolveGift(gift: LiveGift): GiftAction {
  const name = gift.name.toLowerCase();
  const n = Math.max(1, gift.repeat ?? 1);
  const diamonds = gift.diamonds ?? 0;

  if (name.includes("lucky") || name.includes("mystery") || name.includes("box")) {
    const pick = LUCKY_NAMES[Math.floor(Math.random() * LUCKY_NAMES.length)];
    const action = resolveGift({ ...gift, name: pick });
    return { ...action, label: `Lucky · ${action.label}`, tone: "lucky" };
  }

  if (
    name.includes("gold") ||
    name.includes("universe") ||
    name.includes("lion") ||
    diamonds >= 100
  ) {
    return snack("Golden snack", "golden", {
      golden: 1,
      glowMs: 7000,
      confetti: true,
    });
  }

  if (name.includes("nitro") || name.includes("gg") || name.includes("speed")) {
    return snack("Nitro", "nitro", {
      apples: 1,
      nitroMs: 8000,
      glowMs: 8000,
    });
  }

  if (name.includes("heart") || name.includes("love") || name.includes("kiss")) {
    return snack("Heart rain", "hearts", {
      hearts: 3,
      glowMs: 6000,
      confetti: true,
    });
  }

  if (name.includes("slow") || name.includes("chill") || name.includes("turtle")) {
    return snack("Slow-mo", "slow", {
      apples: 1,
      slowMs: 8000,
      glowMs: 8000,
    });
  }

  if (name.includes("disco") || name.includes("rainbow") || name.includes("star")) {
    return snack("Disco", "disco", {
      apples: 1,
      glowMs: 12000,
      confetti: true,
    });
  }

  if (name.includes("party") || name.includes("firework") || name.includes("confetti")) {
    return snack("Party", "party", {
      apples: 5,
      hearts: 2,
      glowMs: 5000,
      confetti: true,
    });
  }

  if (name.includes("cheer") || name.includes("clap") || name.includes("wave")) {
    return snack("Cheer", "cheer", {
      glowMs: 1600,
      confetti: true,
    });
  }

  if (name.includes("bouquet") || name.includes("rosa") || n >= 5 || diamonds >= 10) {
    return snack("Apple rain", "rain", {
      apples: Math.min(12, 5 * n),
      glowMs: 2500,
      confetti: true,
    });
  }

  return snack("Snack", "rose", {
    apples: 1,
    glowMs: 1800,
  });
}
