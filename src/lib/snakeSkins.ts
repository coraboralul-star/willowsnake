export type SnakeSkinId = "mint" | "banana" | "sky" | "grape" | "rose" | "cream";

export type SnakeSkin = {
  id: SnakeSkinId;
  label: string;
  body: string;
  head: string;
};

export const SNAKE_SKINS: Record<SnakeSkinId, SnakeSkin> = {
  mint: { id: "mint", label: "Mint", body: "#c8efb0", head: "#d4f5bc" },
  banana: { id: "banana", label: "Banana", body: "#f3e06a", head: "#fff0a8" },
  sky: { id: "sky", label: "Sky", body: "#7eccf2", head: "#bfe8ff" },
  grape: { id: "grape", label: "Grape", body: "#c4a3ff", head: "#e3d2ff" },
  rose: { id: "rose", label: "Rose", body: "#ff8fb8", head: "#ffc1d6" },
  cream: { id: "cream", label: "Cream", body: "#f0ebe0", head: "#fffaf2" },
};

export const SNAKE_SKIN_LIST = Object.values(SNAKE_SKINS);

export const DEFAULT_SNAKE_SKIN: SnakeSkinId = "mint";
