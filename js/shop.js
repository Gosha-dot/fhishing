// Gear definitions and lookup helpers used by the player store, shop UI, and
// fishing controller. Rod fields are pure tuning data: price, cast reach, reel
// progress speed, green-zone size, line durability, and rare-fish luck.
export const RODS = Object.freeze([
  {
    id: "bamboo-rod",
    name: "Bamboo Rod",
    price: 0,
    castMultiplier: 1,
    reelSpeed: 1,
    zoneBonus: 0.01,
    lineStrength: 1,
    luckBonus: 0,
    icon: { primary: "#d7aa62", secondary: "#78d27d" },
    summary: "Light starter rod with honest, steady handling.",
  },
  {
    id: "willow-rod",
    name: "Willow Rod",
    price: 65,
    castMultiplier: 1.05,
    reelSpeed: 1.05,
    zoneBonus: 0.025,
    lineStrength: 1.04,
    luckBonus: 0,
    icon: { primary: "#b7c984", secondary: "#516a46" },
    summary: "A forgiving dock rod kept for early save compatibility.",
  },
  {
    id: "mangrove-rod",
    name: "Mangrove Rod",
    price: 230,
    castMultiplier: 1.1,
    reelSpeed: 1.08,
    zoneBonus: 0.045,
    lineStrength: 1.15,
    luckBonus: 0.025,
    icon: { primary: "#8f6b42", secondary: "#6fb16d" },
    summary: "Stable in murky water and kind to heavy bottom feeders.",
  },
  {
    id: "carbon-tide-rod",
    name: "Carbon Rod",
    price: 390,
    castMultiplier: 1.22,
    reelSpeed: 1.2,
    zoneBonus: 0.055,
    lineStrength: 1.16,
    luckBonus: 0.045,
    icon: { primary: "#4a5c68", secondary: "#59c7f2" },
    summary: "Mid-tier speed with a wider control window.",
  },
  {
    id: "glacier-pike-rod",
    name: "Glacier Pike Rod",
    price: 880,
    castMultiplier: 1.3,
    reelSpeed: 1.28,
    zoneBonus: 0.062,
    lineStrength: 1.3,
    luckBonus: 0.08,
    icon: { primary: "#d9edf0", secondary: "#78a9d4" },
    summary: "Stiff blank for cold lakes and sharp turns.",
  },
  {
    id: "stormglass-rod",
    name: "Stormglass Rod",
    price: 1280,
    castMultiplier: 1.42,
    reelSpeed: 1.36,
    zoneBonus: 0.078,
    lineStrength: 1.38,
    luckBonus: 0.11,
    icon: { primary: "#b798ff", secondary: "#f5c95c" },
    summary: "Built for deep pulls and rare fights.",
  },
  {
    id: "treasure-hunter-rod",
    name: "Treasure Hunter Rod",
    price: 2250,
    castMultiplier: 1.6,
    reelSpeed: 1.48,
    zoneBonus: 0.095,
    lineStrength: 1.48,
    luckBonus: 0.2,
    icon: { primary: "#f5c95c", secondary: "#ff7d67" },
    summary: "Premium reach and the strongest rare-fish bonus.",
  },
]);

export const BAITS = Object.freeze([
  {
    id: "crumb-bait",
    name: "Crumb Bait",
    price: 0,
    biteMultiplier: 1,
    luckBonus: 0,
    icon: { primary: "#d7aa62", secondary: "#f6f7f2" },
    summary: "Reliable and simple.",
  },
  {
    id: "mire-leech",
    name: "Mire Leech",
    price: 140,
    biteMultiplier: 1.12,
    luckBonus: 0.1,
    icon: { primary: "#4d5b35", secondary: "#78d27d" },
    summary: "Good for swamp edges and patient rare rolls.",
  },
  {
    id: "glow-worm",
    name: "Glow Worm",
    price: 220,
    biteMultiplier: 1.24,
    luckBonus: 0.18,
    icon: { primary: "#78d27d", secondary: "#f5c95c" },
    summary: "Faster bites with a touch of luck.",
  },
  {
    id: "frost-fly",
    name: "Frost Fly",
    price: 410,
    biteMultiplier: 1.18,
    luckBonus: 0.27,
    icon: { primary: "#d9edf0", secondary: "#59c7f2" },
    summary: "A crisp lure prized in high-altitude water.",
  },
  {
    id: "pearl-lure",
    name: "Pearl Lure",
    price: 620,
    biteMultiplier: 1.38,
    luckBonus: 0.34,
    icon: { primary: "#f6f7f2", secondary: "#ff7dcb" },
    summary: "Tempts heavier and rarer fish.",
  },
  {
    id: "coral-mote",
    name: "Coral Mote",
    price: 980,
    biteMultiplier: 1.48,
    luckBonus: 0.46,
    icon: { primary: "#ff7d67", secondary: "#59c7f2" },
    summary: "Bright reef bait for the most elusive catches.",
  },
]);

export const BOATS = Object.freeze([
  {
    id: "marsh-skiff",
    name: "Marsh Skiff",
    price: 260,
    unlocksLocation: "swamp",
    icon: { primary: "#4d5b35", secondary: "#d7aa62" },
    summary: "Unlocks Murkfen Swamp after level 2.",
  },
  {
    id: "river-skiff",
    name: "River Skiff",
    price: 340,
    unlocksLocation: "river",
    icon: { primary: "#815f3f", secondary: "#78d27d" },
    summary: "Unlocks Copper River.",
  },
  {
    id: "mountain-pass",
    name: "Mountain Pass",
    price: 760,
    unlocksLocation: "mountain",
    icon: { primary: "#d9edf0", secondary: "#5c7c92" },
    summary: "Unlocks Frostpeak Lake after level 4.",
  },
  {
    id: "ocean-sloop",
    name: "Ocean Sloop",
    price: 980,
    unlocksLocation: "ocean",
    icon: { primary: "#1d7fa9", secondary: "#f5c95c" },
    summary: "Unlocks Opal Coast after level 4.",
  },
  {
    id: "reef-cutter",
    name: "Reef Cutter",
    price: 1850,
    unlocksLocation: "coral",
    icon: { primary: "#ff7d67", secondary: "#59c7f2" },
    summary: "Unlocks Coral Bay after level 6.",
  },
  {
    id: "abyss-lantern",
    name: "Abyss Lantern",
    price: 2950,
    unlocksLocation: "abyss",
    icon: { primary: "#b798ff", secondary: "#06131f" },
    summary: "Unlocks Gloam Trench after level 8.",
  },
]);

export function getRod(id) {
  return RODS.find((rod) => rod.id === id) ?? RODS[0];
}

export function getBait(id) {
  return BAITS.find((bait) => bait.id === id) ?? BAITS[0];
}

export function getBoat(id) {
  return BOATS.find((boat) => boat.id === id) ?? null;
}

export function getBoatForLocation(locationId) {
  return BOATS.find((boat) => boat.unlocksLocation === locationId) ?? null;
}
