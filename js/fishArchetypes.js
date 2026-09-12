// Shared fish body archetype and deterministic variation helpers.
// New species can set `archetype` directly in fishDatabase.js; the fallback map
// keeps older species grouped without requiring a save migration.

export const BODY_ARCHETYPES = Object.freeze({
  classic: {
    label: "Classic",
    body: { length: 1, width: 1, curve: 0.22 },
    fins: { dorsal: 1, pectoral: 1, tail: 1 },
    eyes: { x: 0.74, y: 0.45 },
    animation: { swim: 2.8, tail: 1, dash: 0.46, struggle: 0.28, flop: 0.62 },
  },
  eel: {
    label: "Eel",
    body: { length: 1.42, width: 0.52, curve: 0.92 },
    fins: { dorsal: 0.55, pectoral: 0.48, tail: 0.72 },
    eyes: { x: 0.86, y: 0.48 },
    animation: { swim: 2.15, tail: 1.55, dash: 0.38, struggle: 0.2, flop: 0.5 },
  },
  flat: {
    label: "Flat",
    body: { length: 0.98, width: 1.38, curve: 0.38 },
    fins: { dorsal: 0.78, pectoral: 1.5, tail: 0.48 },
    eyes: { x: 0.7, y: 0.38 },
    animation: { swim: 3.45, tail: 0.55, dash: 0.58, struggle: 0.36, flop: 0.7 },
  },
  torpedo: {
    label: "Torpedo",
    body: { length: 1.2, width: 0.78, curve: 0.16 },
    fins: { dorsal: 0.88, pectoral: 0.85, tail: 1.18 },
    eyes: { x: 0.78, y: 0.45 },
    animation: { swim: 2.25, tail: 1.28, dash: 0.34, struggle: 0.24, flop: 0.56 },
  },
  round: {
    label: "Round",
    body: { length: 0.86, width: 1.24, curve: 0.42 },
    fins: { dorsal: 1.1, pectoral: 0.95, tail: 0.88 },
    eyes: { x: 0.72, y: 0.42 },
    animation: { swim: 3.15, tail: 0.72, dash: 0.52, struggle: 0.34, flop: 0.68 },
  },
  longfin: {
    label: "Longfin",
    body: { length: 1.02, width: 0.96, curve: 0.3 },
    fins: { dorsal: 1.55, pectoral: 1.5, tail: 1.32 },
    eyes: { x: 0.73, y: 0.43 },
    animation: { swim: 3.35, tail: 0.9, dash: 0.5, struggle: 0.32, flop: 0.72 },
  },
  predator: {
    label: "Predator",
    body: { length: 1.34, width: 0.62, curve: 0.12 },
    fins: { dorsal: 0.72, pectoral: 0.76, tail: 1.08 },
    eyes: { x: 0.79, y: 0.43 },
    animation: { swim: 2.05, tail: 1.32, dash: 0.32, struggle: 0.22, flop: 0.52 },
  },
  catfish: {
    label: "Catfish",
    body: { length: 1.12, width: 0.9, curve: 0.26 },
    fins: { dorsal: 0.75, pectoral: 1.2, tail: 0.92 },
    eyes: { x: 0.74, y: 0.4 },
    animation: { swim: 3, tail: 0.86, dash: 0.56, struggle: 0.35, flop: 0.7 },
  },
  angler: {
    label: "Angler",
    body: { length: 0.92, width: 1.1, curve: 0.48 },
    fins: { dorsal: 1.4, pectoral: 1.35, tail: 0.62 },
    eyes: { x: 0.68, y: 0.38 },
    animation: { swim: 3.55, tail: 0.62, dash: 0.62, struggle: 0.36, flop: 0.74 },
  },
  turtle: {
    label: "Turtle",
    body: { length: 0.95, width: 1.2, curve: 0.18 },
    fins: { dorsal: 0.35, pectoral: 1.65, tail: 0.38 },
    eyes: { x: 0.8, y: 0.46 },
    animation: { swim: 3.8, tail: 0.42, dash: 0.68, struggle: 0.42, flop: 0.76 },
  },
  axolotl: {
    label: "Axolotl",
    body: { length: 1.05, width: 0.74, curve: 0.32 },
    fins: { dorsal: 1.65, pectoral: 1.42, tail: 0.82 },
    eyes: { x: 0.78, y: 0.44 },
    animation: { swim: 2.85, tail: 1.05, dash: 0.48, struggle: 0.26, flop: 0.62 },
  },
  leviathan: {
    label: "Leviathan",
    body: { length: 1.38, width: 0.86, curve: 0.52 },
    fins: { dorsal: 1.75, pectoral: 0.92, tail: 1.12 },
    eyes: { x: 0.76, y: 0.42 },
    animation: { swim: 2.65, tail: 1.12, dash: 0.42, struggle: 0.24, flop: 0.58 },
  },
});

const DEFAULT_ARCHETYPE_BY_FISH_ID = Object.freeze({
  "amber-carp": "round",
  "ancient-bog-lurker": "torpedo",
  "aurora-salmon": "torpedo",
  "blind-cavefish": "classic",
  "bog-lantern-carp": "round",
  "bog-pike": "predator",
  "captain-snapper": "round",
  "canyon-pike": "predator",
  "coral-snapper": "round",
  "crownmire-eel": "eel",
  "crystal-leviathan": "leviathan",
  "crystal-tetra": "classic",
  "dock-flounder": "flat",
  "dusk-ray": "flat",
  "ember-parrotfish": "round",
  "foam-mackerel": "torpedo",
  "frost-pebble-char": "torpedo",
  "gilded-grouper": "round",
  "glass-bluegill": "classic",
  "glow-grotto-eel": "eel",
  "golden-bass": "round",
  "granite-sturgeon": "catfish",
  "harbor-herring": "torpedo",
  "lantern-koi": "longfin",
  "lilyshade-perch": "classic",
  "mire-bullhead": "catfish",
  "moss-catfish": "catfish",
  mudwhisker: "catfish",
  "prism-wrasse": "longfin",
  "quickfin-dace": "classic",
  "reed-minnow": "classic",
  "royal-tuna": "torpedo",
  "sapphire-needlefish": "predator",
  "silver-trout": "torpedo",
  "siltback-gar": "predator",
  "snowglass-trout": "torpedo",
  "starlit-manta": "flat",
  "static-phantom": "classic",
  "storm-eel": "eel",
  "sunken-crownfish": "longfin",
  "veil-angler": "angler",
  "void-sturgeon": "catfish",
  "whiteout-leviathan": "leviathan",
  "wisp-tetra": "longfin",
  "witchmire-turtle": "turtle",
});

export function getFishArchetype(fish) {
  const id = typeof fish === "string" ? fish : fish?.id ?? fish?.fishId;
  const configured = typeof fish === "object" ? fish?.archetype : null;
  const archetype = configured ?? DEFAULT_ARCHETYPE_BY_FISH_ID[id] ?? "classic";
  return BODY_ARCHETYPES[archetype] ? archetype : "classic";
}

export function getFishRenderModel(fish, { seed, animation = "idle-swim" } = {}) {
  const archetype = getFishArchetype(fish);
  const params = BODY_ARCHETYPES[archetype];
  const variant = createFishVariant(seed ?? fish?.catchId ?? fish?.id ?? "fish");

  return {
    archetype,
    params,
    animation,
    variant,
    colors: applyVariantToColors(fish?.colors ?? ["#78d27d", "#2b7188"], variant),
  };
}

export function createFishVariant(seed) {
  const random = mulberry32(hashSeed(String(seed)));
  const patternRoll = random();
  return {
    scale: round(0.93 + random() * 0.16),
    bodyLength: round(0.94 + random() * 0.14),
    bodyWidth: round(0.92 + random() * 0.16),
    finScale: round(0.86 + random() * 0.28),
    hue: Math.round((random() - 0.5) * 26),
    saturation: round(0.92 + random() * 0.22),
    pattern: patternRoll < 0.34 ? "spots" : patternRoll < 0.68 ? "stripes" : "speckles",
    patternOpacity: round(0.16 + random() * 0.18),
    phase: round(random()),
  };
}

function applyVariantToColors(colors, variant) {
  return colors.map((color, index) => shiftHexColor(color, variant.hue, variant.saturation - index * 0.03));
}

function shiftHexColor(hex, hueDegrees, saturationScale) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.h = (hsl.h + hueDegrees + 360) % 360;
  hsl.s = clamp(hsl.s * saturationScale, 0, 1);
  const shifted = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(shifted.r, shifted.g, shifted.b);
}

function hashSeed(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const value = String(hex).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }

  return { h, s, l };
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
