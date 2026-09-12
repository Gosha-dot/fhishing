// Vector SVG generator for fish illustration and icons.
// Provides unique silhouettes and color stylings for each species.

import { getFishArchetype, getFishRenderModel } from "./fishArchetypes.js";
import { RARITY_META } from "./fishDatabase.js";

let artCounter = 0;
const svgCache = new Map();

export { getFishArchetype };

export function getFishSvg(
  fish,
  { width = 200, height = 130, animated = true, animation = "idle-swim", className = "", seed, effects = true } = {},
) {
  const model = getFishRenderModel(fish, { seed, animation });
  artCounter += 1;
  const uid = `fish-${fish.id || "unknown"}-${artCounter}`;
  const uidToken = "__FISH_UID__";
  const cacheKey = JSON.stringify({
    id: fish.id ?? fish.fishId,
    rarity: fish.rarity,
    colors: fish.colors,
    archetype: model.archetype,
    seed: seed ?? fish.catchId ?? fish.id,
    width,
    height,
    animated,
    animation,
    className,
    effects,
  });

  if (svgCache.has(cacheKey)) {
    return svgCache.get(cacheKey).replaceAll(uidToken, uid);
  }

  const c1 = model.colors[0];
  const c2 = model.colors[1];
  const archetype = model.archetype;
  const rarity = fish.rarity ?? "Common";
  const rarityMeta = RARITY_META[rarity] ?? RARITY_META.Common;
  const variant = model.variant;

  let bodyMarkup = "";
  switch (archetype) {
    case "eel":
      bodyMarkup = renderEelBody(uidToken, c1, c2, fish.id);
      break;
    case "flat":
      bodyMarkup = renderRayBody(uidToken, c1, c2, fish.id);
      break;
    case "angler":
      bodyMarkup = renderAnglerBody(uidToken, c1, c2);
      break;
    case "turtle":
      bodyMarkup = renderTurtleBody(uidToken, c1, c2);
      break;
    case "axolotl":
      bodyMarkup = renderAxolotlBody(uidToken, c1, c2);
      break;
    case "predator":
      bodyMarkup = renderPredatorBody(uidToken, c1, c2, fish.id);
      break;
    case "catfish":
      bodyMarkup = renderCatfishBody(uidToken, c1, c2, fish.id);
      break;
    case "leviathan":
      bodyMarkup = renderLeviathanBody(uidToken, c1, c2);
      break;
    case "torpedo":
      bodyMarkup = renderStreamlinedBody(uidToken, c1, c2, fish.id);
      break;
    case "round":
      bodyMarkup = renderDeepBodied(uidToken, c1, c2, fish.id);
      break;
    case "longfin":
      bodyMarkup = renderLongfinBody(uidToken, c1, c2, fish.id);
      break;
    default:
      bodyMarkup = renderClassicBody(uidToken, c1, c2, fish.id);
      break;
  }

  const rarityMarkup = effects ? renderRarityEffects(uidToken, rarity, rarityMeta.color) : { under: "", over: "" };
  const animClass = animated ? `animated-fish-svg fish-animation-${animation}` : "";
  const variantTransform = [
    `translate(${(1 - variant.scale) * 110} ${(1 - variant.scale) * 70})`,
    `scale(${variant.scale * variant.bodyLength} ${variant.scale * variant.bodyWidth})`,
  ].join(" ");
  const phaseMs = Math.round(variant.phase * -1400);

  const svg = `
    <svg 
      class="fish-svg ${animClass} ${className}" 
      data-archetype="${escapeHtml(archetype)}"
      data-rarity="${escapeHtml(rarity.toLowerCase())}"
      viewBox="0 0 220 140" 
      width="${width}" 
      height="${height}" 
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="${escapeHtml(fish.name ?? "Fish")}"
      style="--fish-rarity-color: ${rarityMeta.color}; --tail-speed: ${model.params.animation.tail}; --swim-duration: ${model.params.animation.swim}s; --dash-duration: ${model.params.animation.dash}s; --struggle-duration: ${model.params.animation.struggle}s; --flop-duration: ${model.params.animation.flop}s; animation-delay: ${phaseMs}ms;"
    >
      <defs>
        <linearGradient id="${uidToken}-grad" x1="0%" y1="15%" x2="100%" y2="85%">
          <stop offset="0%" stop-color="${c1}" />
          <stop offset="100%" stop-color="${c2}" />
        </linearGradient>
        <linearGradient id="${uidToken}-belly" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.38" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04" />
        </linearGradient>
        <filter id="${uidToken}-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      ${rarityMarkup.under}
      <g class="fish-variant-body" transform="${variantTransform}" style="filter: saturate(${variant.saturation});">
        ${bodyMarkup}
        ${renderPatternOverlay(variant, archetype)}
      </g>
      ${rarityMarkup.over}
    </svg>
  `;

  svgCache.set(cacheKey, svg);
  return svg.replaceAll(uidToken, uid);
}

export function getFishInventoryIcon(fish, { size = 44, seed } = {}) {
  const rarity = RARITY_META[fish.rarity] ?? RARITY_META.Common;
  const svg = getFishSvg(fish, {
    width: size,
    height: Math.round(size * 0.64),
    animated: false,
    className: "inventory-thumb-svg",
    seed,
    effects: false,
  });

  return `
    <span class="inventory-fish-icon" style="--fish-rarity-color: ${rarity.color};" title="${escapeHtml(fish.rarity)}">
      ${svg}
    </span>
  `;
}

// 1. Classic round/oval fish (Minnow, Bluegill, Dace, Wrasse, Phantom)
function renderClassicBody(uid, c1, c2, id) {
  const isPhantom = id === "static-phantom";
  return `
    <g class="fish-graphic-group">
      <!-- Caudal (Tail) Fin -->
      <path d="M 52 70 Q 22 42 16 34 Q 32 68 22 70 Q 32 72 16 106 Q 22 98 52 70 Z" fill="${c2}" opacity="0.88" />
      <path d="M 48 70 Q 28 50 22 42" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" fill="none" />
      <path d="M 48 70 Q 28 90 22 98" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" fill="none" />

      <!-- Dorsal Fin -->
      <path d="M 90 42 Q 115 16 142 34 Q 120 38 90 42 Z" fill="${c2}" opacity="0.82" />
      <path d="M 112 28 Q 118 36 122 40" stroke="rgba(255,255,255,0.35)" stroke-width="1" fill="none" />

      <!-- Ventral / Anal Fin -->
      <path d="M 85 92 Q 102 114 122 98 Q 106 94 85 92 Z" fill="${c2}" opacity="0.8" />

      <!-- Main Body -->
      <path d="M 45 70 C 50 36, 125 36, 175 70 C 125 104, 50 104, 45 70 Z" fill="url(#${uid}-grad)" />

      <!-- Belly / Scale Highlight -->
      <path d="M 60 72 C 70 88, 120 95, 160 74 C 122 84, 82 82, 60 72 Z" fill="url(#${uid}-belly)" />

      <!-- Top Specular Highlight -->
      <path d="M 70 52 Q 115 44 150 60" stroke="rgba(255,255,255,0.45)" stroke-width="2.5" stroke-linecap="round" fill="none" />

      <!-- Operculum (Gill) -->
      <path d="M 142 56 Q 134 70 142 84" stroke="rgba(0,0,0,0.25)" stroke-width="2.2" stroke-linecap="round" fill="none" />

      <!-- Pectoral Fin -->
      <path d="M 125 72 Q 98 84 94 72 Q 110 66 125 72 Z" fill="${c1}" opacity="0.88" stroke="rgba(255,255,255,0.3)" stroke-width="0.8" />

      <!-- Eye -->
      <circle cx="158" cy="63" r="6.5" fill="#1b1c1e" />
      <circle cx="157" cy="62" r="5" fill="#2d3036" />
      <circle cx="156" cy="60.5" r="2.2" fill="#ffffff" />
      <circle cx="159" cy="64" r="0.9" fill="#ffffff" />

      <!-- Mouth -->
      <path d="M 175 70 Q 170 72 168 70" stroke="#1b1c1e" stroke-width="1.8" stroke-linecap="round" fill="none" />

      ${
        isPhantom
          ? `<!-- Cyber lines for static phantom -->
             <path d="M 80 62 L 105 62 L 115 72 L 140 72" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="3,2" fill="none" filter="url(#${uid}-glow)" />
             <circle cx="105" cy="62" r="2" fill="#ffffff" />
             <circle cx="115" cy="72" r="2" fill="#ffffff" />`
          : ""
      }
    </g>
  `;
}

// 2. Streamlined fast swimmers (Trout, Salmon, Tuna, Mackerel, Char)
function renderStreamlinedBody(uid, c1, c2, id) {
  const isTuna = id === "royal-tuna";
  return `
    <g class="fish-graphic-group">
      <!-- Caudal (Tail) Fin - Forked / Crescent -->
      <path d="M 44 70 Q 14 30 8 20 Q 28 66 14 70 Q 28 74 8 120 Q 14 110 44 70 Z" fill="${c2}" opacity="0.92" />

      <!-- Dorsal Fin -->
      <path d="M 95 44 Q 112 18 132 38 Q 114 42 95 44 Z" fill="${c2}" opacity="0.85" />
      <!-- Adipose / Small fin -->
      <path d="M 64 54 Q 56 46 52 56 Z" fill="${c2}" opacity="0.7" />

      <!-- Anal Fin -->
      <path d="M 72 86 Q 84 104 96 88 Z" fill="${c2}" opacity="0.8" />

      <!-- Main Body: Sleek Torpedo -->
      <path d="M 38 70 C 46 44, 126 42, 185 70 C 132 96, 46 96, 38 70 Z" fill="url(#${uid}-grad)" />

      <!-- Lateral Line -->
      <path d="M 48 70 Q 110 74 165 70" stroke="${c1}" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="${isTuna ? "none" : "4,2"}" opacity="0.8" fill="none" />

      <!-- Belly Specular -->
      <path d="M 52 74 C 75 88, 125 90, 172 73 C 130 82, 85 82, 52 74 Z" fill="url(#${uid}-belly)" />

      <!-- Top Sheen -->
      <path d="M 75 52 Q 120 48 160 62" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" fill="none" />

      <!-- Operculum -->
      <path d="M 148 57 Q 138 70 148 83" stroke="rgba(0,0,0,0.28)" stroke-width="2" stroke-linecap="round" fill="none" />

      <!-- Pectoral Fin -->
      <path d="M 132 74 Q 102 84 96 74 Q 115 68 132 74 Z" fill="${c1}" opacity="0.9" />

      <!-- Eye -->
      <circle cx="166" cy="64" r="6" fill="#1b1c1e" />
      <circle cx="165" cy="63" r="4.6" fill="#383d44" />
      <circle cx="164" cy="61.5" r="2" fill="#ffffff" />

      <!-- Snout / Mouth -->
      <path d="M 185 70 L 176 72" stroke="#1b1c1e" stroke-width="1.8" stroke-linecap="round" />
    </g>
  `;
}

// 3. Deep-Bodied Round Fish (Carp, Grouper, Snapper, Koi, Crownfish)
function renderDeepBodied(uid, c1, c2, id) {
  const isCrown = id === "sunken-crownfish";
  const isKoi = id === "lantern-koi";
  return `
    <g class="fish-graphic-group">
      <!-- Caudal (Tail) Fin - Large & flowing -->
      <path d="M 54 70 Q 18 36 10 24 Q 28 66 18 70 Q 28 74 10 116 Q 18 104 54 70 Z" fill="${c2}" opacity="0.9" />

      <!-- High Curved Dorsal Fin -->
      <path d="M 85 36 Q 115 6 150 36 Q 118 34 85 36 Z" fill="${c2}" opacity="0.88" />
      <path d="M 102 18 Q 110 26 116 34" stroke="rgba(255,255,255,0.3)" stroke-width="1.2" fill="none" />
      <path d="M 124 16 Q 130 25 134 35" stroke="rgba(255,255,255,0.3)" stroke-width="1.2" fill="none" />

      <!-- Broad Belly Anal Fin -->
      <path d="M 80 98 Q 98 126 122 102 Z" fill="${c2}" opacity="0.85" />

      <!-- Deep Stout Body -->
      <path d="M 48 70 C 58 26, 126 26, 174 70 C 126 114, 58 114, 48 70 Z" fill="url(#${uid}-grad)" />

      <!-- Scale Texture / Arcs -->
      <path d="M 90 58 Q 96 66 90 74" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" fill="none" />
      <path d="M 105 52 Q 111 60 105 68" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" fill="none" />
      <path d="M 105 68 Q 111 76 105 84" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" fill="none" />
      <path d="M 120 58 Q 126 66 120 74" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" fill="none" />

      <!-- Belly Highlights -->
      <path d="M 64 78 C 82 98, 125 102, 160 76 C 125 90, 85 88, 64 78 Z" fill="url(#${uid}-belly)" />

      <!-- Operculum -->
      <path d="M 142 52 Q 130 70 142 88" stroke="rgba(0,0,0,0.26)" stroke-width="2.2" stroke-linecap="round" fill="none" />

      <!-- Pectoral Fin -->
      <path d="M 122 74 Q 92 88 88 74 Q 106 66 122 74 Z" fill="${c1}" opacity="0.9" />

      <!-- Eye -->
      <circle cx="156" cy="60" r="7" fill="#1b1c1e" />
      <circle cx="155" cy="59" r="5.2" fill="#3c362a" />
      <circle cx="153" cy="57" r="2.2" fill="#ffffff" />

      <!-- Mouth -->
      <path d="M 174 70 Q 166 73 164 69" stroke="#1b1c1e" stroke-width="2" stroke-linecap="round" fill="none" />

      ${
        isKoi
          ? `<!-- Barbels for Koi -->
             <path d="M 166 72 Q 162 84 154 88" stroke="${c1}" stroke-width="2" stroke-linecap="round" fill="none" />`
          : ""
      }

      ${
        isCrown
          ? `<!-- Golden Crown for Sunken Crownfish -->
             <polygon points="144,34 149,12 156,26 163,10 169,26 176,14 179,35" fill="#f5c95c" stroke="#b0841a" stroke-width="1.2" filter="url(#${uid}-glow)" />`
          : ""
      }
    </g>
  `;
}

// 4. Elongated Predators (Pike, Gar, Needlefish)
function renderPredatorBody(uid, c1, c2, id) {
  const isNeedle = id === "sapphire-needlefish";
  return `
    <g class="fish-graphic-group">
      <!-- Caudal (Tail) Fin -->
      <path d="M 38 70 Q 12 40 8 32 Q 22 68 14 70 Q 22 72 8 108 Q 12 100 38 70 Z" fill="${c2}" opacity="0.9" />

      <!-- Dorsal set far back -->
      <path d="M 58 56 Q 74 36 90 52 Q 74 54 58 56 Z" fill="${c2}" opacity="0.85" />
      <!-- Anal Fin set far back -->
      <path d="M 58 84 Q 74 104 90 88 Z" fill="${c2}" opacity="0.85" />

      <!-- Slender Long Predator Body -->
      <path d="M 34 70 C 44 52, 130 52, ${isNeedle ? "205" : "192"} 70 C 130 88, 44 88, 34 70 Z" fill="url(#${uid}-grad)" />

      <!-- Long Sharp Jaw / Snout -->
      <path d="M 160 70 L ${isNeedle ? "205" : "192"} 70" stroke="#1a1c1a" stroke-width="2" stroke-linecap="round" fill="none" />

      <!-- Predator Spots / Bars -->
      <path d="M 75 62 L 75 78" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" />
      <path d="M 95 60 L 95 80" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" />
      <path d="M 115 62 L 115 78" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" />
      <path d="M 135 64 L 135 76" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" />

      <!-- Operculum -->
      <path d="M 152 60 Q 144 70 152 80" stroke="rgba(0,0,0,0.3)" stroke-width="1.8" stroke-linecap="round" fill="none" />

      <!-- Pectoral Fin -->
      <path d="M 138 73 Q 115 82 110 74 Z" fill="${c1}" opacity="0.85" />

      <!-- Sharp Fierce Eye -->
      <circle cx="164" cy="65" r="5.5" fill="#f5c95c" />
      <circle cx="164" cy="65" r="3.2" fill="#1b1c1e" />
      <circle cx="163" cy="63.5" r="1.3" fill="#ffffff" />
    </g>
  `;
}

// 5. Catfish / Sturgeon (Whiskers, Broad Head, Bony Plates)
function renderCatfishBody(uid, c1, c2, id) {
  const isSturgeon = id === "granite-sturgeon";
  return `
    <g class="fish-graphic-group">
      <!-- Caudal Tail -->
      <path d="M 44 70 Q 16 38 10 30 Q 24 68 18 70 Q 24 72 10 110 Q 16 102 44 70 Z" fill="${c2}" opacity="0.9" />

      <!-- Dorsal Fin -->
      <path d="M 88 44 Q 104 22 120 42 Z" fill="${c2}" opacity="0.85" />
      <path d="M 68 56 Q 60 48 56 56 Z" fill="${c2}" opacity="0.75" />

      <!-- Main Body: Broad Flat Head -->
      <path d="M 40 70 C 48 44, 118 42, 178 68 C 172 96, 50 96, 40 70 Z" fill="url(#${uid}-grad)" />

      <!-- Sturgeon Bony Plates or Catfish Mottles -->
      ${
        isSturgeon
          ? `<!-- Bony diamond scutes for sturgeon -->
             <polygon points="70,54 75,50 80,54 75,58" fill="#ffffff" opacity="0.45" />
             <polygon points="95,51 100,47 105,51 100,55" fill="#ffffff" opacity="0.45" />
             <polygon points="120,50 125,46 130,50 125,54" fill="#ffffff" opacity="0.45" />
             <polygon points="145,52 150,48 155,52 150,56" fill="#ffffff" opacity="0.45" />`
          : `<!-- Catfish mottling -->
             <circle cx="80" cy="62" r="5" fill="rgba(0,0,0,0.18)" />
             <circle cx="108" cy="58" r="6" fill="rgba(0,0,0,0.18)" />
             <circle cx="128" cy="66" r="4.5" fill="rgba(0,0,0,0.18)" />`
      }

      <!-- Long Whisker Barbels -->
      <path d="M 168 70 Q 174 85 158 98" stroke="${c1}" stroke-width="2.6" stroke-linecap="round" fill="none" />
      <path d="M 172 73 Q 182 92 170 106" stroke="${c1}" stroke-width="2.2" stroke-linecap="round" fill="none" />
      <path d="M 166 65 Q 170 52 156 46" stroke="${c1}" stroke-width="2" stroke-linecap="round" fill="none" />

      <!-- Pectoral Fin -->
      <path d="M 132 76 Q 106 94 98 84 Q 114 74 132 76 Z" fill="${c1}" opacity="0.9" />

      <!-- Eye -->
      <circle cx="160" cy="58" r="5" fill="#1b1c1e" />
      <circle cx="159" cy="57" r="1.5" fill="#ffffff" />
    </g>
  `;
}

// 6. Eel (Long Wavy Body)
function renderEelBody(uid, c1, c2, id) {
  const isStorm = id === "storm-eel";
  return `
    <g class="fish-graphic-group">
      <!-- Sinuous Eel Body -->
      <path 
        d="M 22 76 Q 50 102 90 74 Q 130 46 160 66 Q 184 82 195 70 Q 182 56 150 48 Q 115 42 80 66 Q 45 90 22 76 Z" 
        fill="url(#${uid}-grad)" 
      />

      <!-- Continuous Dorsal Fringe Fin -->
      <path 
        d="M 22 76 Q 50 108 90 80 Q 130 52 160 72" 
        stroke="${c2}" 
        stroke-width="5" 
        stroke-linecap="round" 
        opacity="0.75" 
        fill="none" 
      />

      <!-- Spine / Energy Flow Line -->
      <path 
        d="M 26 76 Q 50 96 90 70 Q 128 46 165 64 Q 180 72 192 68" 
        stroke="${isStorm ? "#ffffff" : c1}" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-dasharray="${isStorm ? "4,3" : "none"}"
        opacity="0.8" 
        fill="none" 
        ${isStorm ? `filter="url(#${uid}-glow)"` : ""}
      />

      <!-- Eel Head & Eye -->
      <circle cx="188" cy="67" r="4.2" fill="#1b1c1e" />
      <circle cx="187" cy="66" r="1.4" fill="#ffffff" />

      <!-- Tiny Pectoral Fin -->
      <ellipse cx="172" cy="72" rx="6" ry="3" transform="rotate(-20 172 72)" fill="${c1}" opacity="0.85" />
    </g>
  `;
}

// 7. Ray & Manta (Wide Wings, Whip Tail)
function renderRayBody(uid, c1, c2, id) {
  const isManta = id === "starlit-manta";
  return `
    <g class="fish-graphic-group">
      <!-- Whip Tail -->
      <path d="M 75 70 Q 30 72 10 65" stroke="${c2}" stroke-width="2.5" stroke-linecap="round" fill="none" />

      <!-- Broad Wing Diamond Silhouette -->
      <path d="M 60 70 Q 110 20 135 15 Q 148 45 180 70 Q 148 95 135 125 Q 110 120 60 70 Z" fill="url(#${uid}-grad)" />

      <!-- Cephalic Fins / Horns for Manta -->
      ${
        isManta
          ? `<!-- Cephalic Lobes -->
             <path d="M 174 62 Q 196 55 192 65 Z" fill="${c1}" />
             <path d="M 174 78 Q 196 85 192 75 Z" fill="${c1}" />
             <!-- Starry Back Spots -->
             <circle cx="120" cy="55" r="2" fill="#ffffff" filter="url(#${uid}-glow)" />
             <circle cx="105" cy="70" r="2.5" fill="#ffffff" filter="url(#${uid}-glow)" />
             <circle cx="130" cy="80" r="2" fill="#ffffff" filter="url(#${uid}-glow)" />
             <circle cx="95" cy="62" r="1.6" fill="#ffffff" />
             <circle cx="138" cy="65" r="1.8" fill="#ffffff" />`
          : `<!-- Wing Edge Glow -->
             <path d="M 130 18 Q 142 45 174 70 Q 142 95 130 122" stroke="${c1}" stroke-width="2" fill="none" opacity="0.6" />`
      }

      <!-- Ray Eyes on Dorsal Surface -->
      <circle cx="152" cy="58" r="4.5" fill="#1b1c1e" />
      <circle cx="151" cy="57" r="1.4" fill="#ffffff" />
      <circle cx="152" cy="82" r="4.5" fill="#1b1c1e" />
      <circle cx="151" cy="81" r="1.4" fill="#ffffff" />
    </g>
  `;
}

// 8. Veil Angler (Deep-Sea Bulbous Glowfish)
function renderAnglerBody(uid, c1, c2) {
  return `
    <g class="fish-graphic-group">
      <!-- Caudal Tail -->
      <path d="M 52 70 Q 22 46 16 38 Q 30 68 20 70 Q 30 72 16 102 Q 22 94 52 70 Z" fill="${c2}" opacity="0.8" />

      <!-- Glowing Lure (Illicium & Esca) -->
      <path d="M 148 42 Q 165 8 186 25" stroke="${c1}" stroke-width="2.5" stroke-linecap="round" fill="none" />
      <circle cx="186" cy="25" r="7" fill="#ffffff" filter="url(#${uid}-glow)" />
      <circle cx="186" cy="25" r="4" fill="${c1}" />

      <!-- Large Round Dark Body -->
      <path d="M 48 70 C 54 30, 120 30, 165 52 C 180 75, 155 110, 48 70 Z" fill="url(#${uid}-grad)" />

      <!-- Massive Underbite Jaw & Translucent Fangs -->
      <path d="M 135 74 Q 172 74 175 88 Q 145 92 135 74 Z" fill="#1a1c24" />
      <!-- Teeth -->
      <polygon points="144,74 147,67 150,74" fill="#ffffff" opacity="0.9" />
      <polygon points="154,74 157,65 160,74" fill="#ffffff" opacity="0.9" />
      <polygon points="164,75 167,68 170,75" fill="#ffffff" opacity="0.9" />
      <polygon points="148,82 151,76 154,82" fill="#ffffff" opacity="0.9" />
      <polygon points="158,82 161,75 164,82" fill="#ffffff" opacity="0.9" />

      <!-- Flowing Veil Fins -->
      <path d="M 85 36 Q 70 18 60 28 Q 78 38 85 36 Z" fill="${c2}" opacity="0.6" />
      <path d="M 75 92 Q 62 112 50 102 Q 68 90 75 92 Z" fill="${c2}" opacity="0.6" />

      <!-- Pale Glowing Eye -->
      <circle cx="145" cy="54" r="6" fill="#181c26" />
      <circle cx="145" cy="54" r="4" fill="${c1}" opacity="0.85" filter="url(#${uid}-glow)" />
      <circle cx="144" cy="53" r="1.5" fill="#ffffff" />
    </g>
  `;
}

// 9. Whiteout Leviathan (Giant Icy Crested Sea Dragon)
function renderLeviathanBody(uid, c1, c2) {
  return `
    <g class="fish-graphic-group">
      <!-- Serpentine Spined Tail -->
      <path d="M 32 70 Q 12 36 6 22 Q 22 66 12 70 Q 22 74 6 118 Q 12 104 32 70 Z" fill="${c2}" opacity="0.95" />

      <!-- Dorsal Ice Crest Spikes -->
      <polygon points="65,48 74,22 84,46" fill="#ffffff" filter="url(#${uid}-glow)" />
      <polygon points="92,44 104,14 116,42" fill="#ffffff" filter="url(#${uid}-glow)" />
      <polygon points="124,42 138,10 148,44" fill="#ffffff" filter="url(#${uid}-glow)" />

      <!-- Great Serpentine Leviathan Body -->
      <path d="M 28 70 C 40 40, 130 38, 188 62 C 145 102, 40 98, 28 70 Z" fill="url(#${uid}-grad)" />

      <!-- Icy Armor Plates -->
      <path d="M 68 56 Q 115 50 162 64" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.8" fill="none" filter="url(#${uid}-glow)" />

      <!-- Horn & Ferocious Jaw -->
      <polygon points="166,48 188,32 178,54" fill="#ffffff" opacity="0.9" />
      <path d="M 160 74 L 188 68 L 175 84 Z" fill="#121820" />
      <polygon points="168,72 172,66 176,72" fill="#ffffff" />
      <polygon points="178,71 182,65 186,71" fill="#ffffff" />

      <!-- Glowing Icy Eye -->
      <circle cx="162" cy="58" r="6" fill="#081018" />
      <circle cx="162" cy="58" r="4" fill="#8ffcff" filter="url(#${uid}-glow)" />
      <circle cx="161" cy="57" r="1.6" fill="#ffffff" />
    </g>
  `;
}

// 10. Witchmire Turtle
function renderTurtleBody(uid, c1, c2) {
  return `
    <g class="fish-graphic-group">
      <!-- Flippers -->
      <path d="M 68 85 Q 46 108 38 122 Q 54 116 75 92 Z" fill="${c1}" opacity="0.9" />
      <path d="M 125 85 Q 148 118 162 124 Q 150 102 135 85 Z" fill="${c1}" opacity="0.9" />
      <path d="M 130 52 Q 155 24 168 18 Q 154 38 136 54 Z" fill="${c1}" opacity="0.9" />
      <path d="M 62 52 Q 42 32 30 22 Q 46 40 65 52 Z" fill="${c1}" opacity="0.9" />

      <!-- Turtle Tail -->
      <polygon points="42,70 30,73 40,76" fill="${c1}" />

      <!-- Domed Shell Carapace -->
      <ellipse cx="98" cy="70" rx="55" ry="38" fill="url(#${uid}-grad)" stroke="${c2}" stroke-width="2.5" />

      <!-- Shell Scute Patterns -->
      <polygon points="98,46 112,58 112,78 98,90 84,78 84,58" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.8" />
      <polygon points="70,54 82,62 82,78 70,86 58,78 58,62" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" />
      <polygon points="126,54 138,62 138,78 126,86 114,78 114,62" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" />

      <!-- Ancient Head -->
      <path d="M 148 65 Q 176 58 184 70 Q 176 82 148 75 Z" fill="${c1}" />
      <circle cx="174" cy="67" r="3.2" fill="#1b1c1e" />
      <circle cx="173.5" cy="66.5" r="1.1" fill="#ffffff" />
      <path d="M 184 70 L 176 72" stroke="#1b1c1e" stroke-width="1.4" stroke-linecap="round" />
    </g>
  `;
}

// 11. Abyssal Axolotl
function renderAxolotlBody(uid, c1, c2) {
  return `
    <g class="fish-graphic-group">
      <!-- Caudal Fin Frill -->
      <path d="M 32 70 Q 12 44 8 36 Q 22 68 14 70 Q 22 72 8 104 Q 12 96 32 70 Z" fill="${c2}" opacity="0.85" />

      <!-- Salamander Body -->
      <path d="M 32 70 C 44 48, 115 46, 160 56 C 172 75, 160 90, 32 70 Z" fill="url(#${uid}-grad)" />

      <!-- External Feathery Gills (3 pairs) -->
      <!-- Top gill branches -->
      <path d="M 148 50 Q 160 22 178 18 Q 165 34 154 52" fill="${c1}" filter="url(#${uid}-glow)" opacity="0.95" />
      <path d="M 142 46 Q 148 14 162 10 Q 152 28 146 48" fill="${c1}" filter="url(#${uid}-glow)" opacity="0.85" />
      <path d="M 136 44 Q 134 16 145 12 Q 138 30 138 46" fill="${c1}" filter="url(#${uid}-glow)" opacity="0.75" />

      <!-- Bottom gill branches -->
      <path d="M 148 76 Q 162 98 178 102 Q 165 88 152 74" fill="${c1}" filter="url(#${uid}-glow)" opacity="0.95" />
      <path d="M 142 80 Q 148 108 162 114 Q 152 94 146 76" fill="${c1}" filter="url(#${uid}-glow)" opacity="0.85" />

      <!-- Little Legs -->
      <path d="M 68 76 Q 58 94 48 95" stroke="${c2}" stroke-width="2.5" stroke-linecap="round" fill="none" />
      <path d="M 125 76 Q 120 95 112 97" stroke="${c2}" stroke-width="2.5" stroke-linecap="round" fill="none" />

      <!-- Head & Smile -->
      <path d="M 152 56 C 182 56, 185 84, 152 82 Z" fill="url(#${uid}-grad)" />
      <!-- Big Cute Eyes -->
      <circle cx="168" cy="62" r="5" fill="#1b1c1e" />
      <circle cx="167" cy="61" r="1.8" fill="#ffffff" />
      <!-- Cheerful Smile -->
      <path d="M 176 72 Q 170 76 166 74" stroke="#4a1844" stroke-width="1.8" stroke-linecap="round" fill="none" />
    </g>
  `;
}

// 12. Long-finned reef/prize fish
function renderLongfinBody(uid, c1, c2, id) {
  const isCrown = id === "sunken-crownfish";
  return `
    <g class="fish-graphic-group">
      <path class="fish-tail" d="M 52 70 Q 16 28 8 18 Q 26 66 16 70 Q 26 74 8 122 Q 16 110 52 70 Z" fill="${c2}" opacity="0.86" />

      <path class="fish-fin fish-fin-dorsal" d="M 78 40 Q 100 4 142 30 Q 126 44 78 40 Z" fill="${c2}" opacity="0.72" />
      <path class="fish-fin fish-fin-ventral" d="M 78 94 Q 102 132 138 104 Q 112 98 78 94 Z" fill="${c2}" opacity="0.62" />

      <path d="M 48 70 C 58 34, 124 34, 174 70 C 126 106, 58 106, 48 70 Z" fill="url(#${uid}-grad)" />
      <path d="M 62 75 C 84 93, 126 96, 160 76 C 124 86, 86 84, 62 75 Z" fill="url(#${uid}-belly)" />
      <path d="M 72 53 Q 112 45 150 60" stroke="rgba(255,255,255,0.44)" stroke-width="2.2" stroke-linecap="round" fill="none" />
      <path d="M 140 54 Q 132 70 140 86" stroke="rgba(0,0,0,0.24)" stroke-width="2" stroke-linecap="round" fill="none" />

      <path class="fish-fin fish-fin-pectoral" d="M 124 73 Q 90 94 86 76 Q 104 66 124 73 Z" fill="${c1}" opacity="0.88" />
      <circle cx="157" cy="60" r="6.6" fill="#1b1c1e" />
      <circle cx="156" cy="59" r="5" fill="#36373c" />
      <circle cx="154.5" cy="57.5" r="2" fill="#ffffff" />
      <path d="M 174 70 Q 166 73 164 69" stroke="#1b1c1e" stroke-width="1.8" stroke-linecap="round" fill="none" />

      ${
        isCrown
          ? `<polygon points="143,35 149,14 156,28 164,12 170,29 177,16 180,36" fill="#f5c95c" stroke="#b0841a" stroke-width="1.2" filter="url(#${uid}-glow)" />`
          : ""
      }
    </g>
  `;
}

function renderPatternOverlay(variant, archetype) {
  const opacity = variant.patternOpacity;
  const scale = archetype === "eel" || archetype === "predator" || archetype === "torpedo" ? 0.78 : 1;

  if (variant.pattern === "stripes") {
    return `
      <g class="fish-pattern-layer" opacity="${opacity}">
        <path d="M 76 50 L 70 86" stroke="#ffffff" stroke-width="${4 * scale}" stroke-linecap="round" />
        <path d="M 98 47 L 92 90" stroke="#ffffff" stroke-width="${4 * scale}" stroke-linecap="round" />
        <path d="M 120 50 L 116 87" stroke="#ffffff" stroke-width="${3.6 * scale}" stroke-linecap="round" />
        <path d="M 142 56 L 138 82" stroke="#ffffff" stroke-width="${3 * scale}" stroke-linecap="round" />
      </g>
    `;
  }

  if (variant.pattern === "spots") {
    return `
      <g class="fish-pattern-layer" opacity="${opacity}">
        <circle cx="78" cy="60" r="${5 * scale}" fill="#ffffff" />
        <circle cx="102" cy="55" r="${4.4 * scale}" fill="#ffffff" />
        <circle cx="125" cy="66" r="${5.5 * scale}" fill="#ffffff" />
        <circle cx="96" cy="78" r="${3.8 * scale}" fill="#ffffff" />
        <circle cx="146" cy="72" r="${3.5 * scale}" fill="#ffffff" />
      </g>
    `;
  }

  return `
    <g class="fish-pattern-layer" opacity="${opacity}">
      <circle cx="72" cy="63" r="${2.2 * scale}" fill="#ffffff" />
      <circle cx="90" cy="55" r="${1.8 * scale}" fill="#ffffff" />
      <circle cx="112" cy="62" r="${2 * scale}" fill="#ffffff" />
      <circle cx="134" cy="58" r="${1.6 * scale}" fill="#ffffff" />
      <circle cx="126" cy="78" r="${1.9 * scale}" fill="#ffffff" />
      <circle cx="150" cy="72" r="${1.6 * scale}" fill="#ffffff" />
    </g>
  `;
}

function renderRarityEffects(uid, rarity, color) {
  const isRarePlus = ["Rare", "Epic", "Legendary", "Mythical", "Secret"].includes(rarity);
  const isLegendaryPlus = ["Legendary", "Mythical", "Secret"].includes(rarity);

  return {
    under: `
      <ellipse class="fish-rarity-aura" cx="112" cy="72" rx="82" ry="34" fill="${color}" opacity="0.16" filter="url(#${uid}-glow)" />
      ${isLegendaryPlus ? `<path class="fish-shimmer" d="M 42 34 L 76 20 L 188 106 L 154 122 Z" fill="#ffffff" opacity="0.16" />` : ""}
    `,
    over: isRarePlus
      ? `
        <g class="fish-particles" fill="${color}" opacity="0.86">
          <circle cx="37" cy="28" r="2.2" />
          <circle cx="187" cy="100" r="2" />
          <circle cx="180" cy="31" r="2.4" />
          <circle cx="45" cy="113" r="1.8" />
          <path d="M 35 28 L 38 22 L 41 28 L 47 31 L 41 33 L 38 39 L 35 33 L 29 31 Z" opacity="0.7" />
          <path d="M 178 30 L 181 23 L 184 30 L 191 33 L 184 36 L 181 43 L 178 36 L 171 33 Z" opacity="0.62" />
        </g>
      `
      : "",
  };
}

// Particle sparkles for high-tier catches
function renderSparkles(rarity) {
  if (
    rarity !== "Epic" &&
    rarity !== "Legendary" &&
    rarity !== "Mythical" &&
    rarity !== "Secret"
  ) {
    return "";
  }

  const starColor =
    rarity === "Secret"
      ? "#ffffff"
      : rarity === "Mythical"
        ? "#ff7dcb"
        : "#f5c95c";

  return `
    <g class="fish-sparkles" opacity="0.85">
      <path d="M 36 26 L 38 18 L 40 26 L 48 28 L 40 30 L 38 38 L 36 30 L 28 28 Z" fill="${starColor}" />
      <path d="M 188 100 L 189 94 L 191 100 L 197 101 L 191 103 L 189 109 L 188 103 L 182 101 Z" fill="${starColor}" />
      <path d="M 178 30 L 180 22 L 182 30 L 190 32 L 182 34 L 180 42 L 178 34 L 170 32 Z" fill="${starColor}" />
      <path d="M 44 112 L 45 106 L 47 112 L 53 113 L 47 115 L 45 121 L 44 115 L 38 113 Z" fill="${starColor}" />
    </g>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

