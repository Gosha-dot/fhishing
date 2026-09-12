import { fishDatabase, LOCATION_META } from "./fishDatabase.js";
import { BAITS, BOATS, getBait, getBoat, getRod, RODS } from "./shop.js";

// Owns all persisted player state. The rest of the app receives snapshots and
// asks this store to perform mutations so save data stays in one place.
const STORAGE_KEY = "tidebound-fishing-save-v1";

const DEFAULT_STATE = Object.freeze({
  coins: 120,
  xp: 0,
  selectedRod: "willow-rod",
  selectedBait: "crumb-bait",
  currentLocation: "lake",
  ownedRods: ["willow-rod"],
  ownedBaits: ["crumb-bait"],
  ownedBoats: [],
  inventory: [],
  dex: {},
  stats: {
    caught: 0,
    sold: 0,
    earned: 0,
  },
});

export function createPlayerStore() {
  let state = normalizeState(readSave());
  const listeners = new Set();

  function commit(nextState) {
    state = normalizeState(nextState);
    writeSave(state);
    listeners.forEach((listener) => listener(snapshot()));
  }

  function snapshot() {
    const levelInfo = getLevelInfo(state.xp);
    return {
      ...clone(state),
      levelInfo,
      inventoryValue: getInventoryValue(state),
      selectedRodData: getRod(state.selectedRod),
      selectedBaitData: getBait(state.selectedBait),
      currentLocationData: LOCATION_META[state.currentLocation] ?? LOCATION_META.lake,
      unlockedLocations: Object.keys(LOCATION_META).filter((locationId) =>
        isLocationUnlocked(state, locationId),
      ),
    };
  }

  return {
    snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    addCatch(catchItem) {
      const next = clone(state);
      const beforeLevel = getLevelInfo(next.xp).level;
      next.inventory.unshift(catchItem);
      next.xp += catchItem.xp;
      next.stats.caught += 1;

      const dexEntry = next.dex[catchItem.fishId] ?? {
        count: 0,
        bestWeight: 0,
        bestPrice: 0,
        firstCaughtAt: catchItem.caughtAt,
      };

      next.dex[catchItem.fishId] = {
        count: dexEntry.count + 1,
        bestWeight: Math.max(dexEntry.bestWeight, catchItem.weight),
        bestPrice: Math.max(dexEntry.bestPrice, catchItem.price),
        firstCaughtAt: dexEntry.firstCaughtAt,
      };

      const afterLevel = getLevelInfo(next.xp).level;
      commit(next);

      return {
        levelUp: afterLevel > beforeLevel,
        level: afterLevel,
      };
    },
    sellAll() {
      const next = clone(state);
      const total = getInventoryValue(next);
      const count = next.inventory.length;

      if (count === 0) {
        return { ok: false, message: "Inventory is empty." };
      }

      next.inventory = [];
      next.coins += total;
      next.stats.sold += count;
      next.stats.earned += total;
      commit(next);

      return { ok: true, message: `Sold ${count} fish for ${total} coins.` };
    },
    sellAllWithBonus(bonusPercent = 15) {
      const next = clone(state);
      const baseTotal = getInventoryValue(next);
      const count = next.inventory.length;

      if (count === 0) {
        return { ok: false, message: "Your bag is empty." };
      }

      const bonusMultiplier = 1 + bonusPercent / 100;
      const total = Math.round(baseTotal * bonusMultiplier);
      const bonusCoins = total - baseTotal;

      next.inventory = [];
      next.coins += total;
      next.stats.sold += count;
      next.stats.earned += total;
      commit(next);

      return {
        ok: true,
        message: `Old Marco bought ${count} fish for ${total} coins (+${bonusCoins} bonus).`,
      };
    },
    sellCatch(catchId) {
      const next = clone(state);
      const catchIndex = next.inventory.findIndex((item) => item.catchId === catchId);

      if (catchIndex === -1) {
        return { ok: false, message: "That fish is no longer in your bag." };
      }

      const [catchItem] = next.inventory.splice(catchIndex, 1);
      next.coins += catchItem.price;
      next.stats.sold += 1;
      next.stats.earned += catchItem.price;
      commit(next);

      return { ok: true, message: `Sold ${catchItem.name} for ${catchItem.price} coins.` };
    },
    sellCatchWithBonus(catchId, bonusPercent = 15) {
      const next = clone(state);
      const catchIndex = next.inventory.findIndex((item) => item.catchId === catchId);

      if (catchIndex === -1) {
        return { ok: false, message: "That fish is no longer in your bag." };
      }

      const [catchItem] = next.inventory.splice(catchIndex, 1);
      const finalPrice = Math.round(catchItem.price * (1 + bonusPercent / 100));
      next.coins += finalPrice;
      next.stats.sold += 1;
      next.stats.earned += finalPrice;
      commit(next);

      return { ok: true, message: `Sold ${catchItem.name} to Marco for ${finalPrice} coins.` };
    },
    payTravelFare(fare, destinationId) {
      const location = LOCATION_META[destinationId];
      if (!location) {
        return { ok: false, message: "Невідомий маршрут." };
      }

      const levelInfo = getLevelInfo(state.xp);
      if (location.requiredLevel && levelInfo.level < location.requiredLevel) {
        return {
          ok: false,
          message: `Капітан: цей рейс надто небезпечний! Потрібен ${location.requiredLevel} рівень (ваш: ${levelInfo.level}).`,
        };
      }

      if (state.coins < fare) {
        return { ok: false, message: `Не вистачає монет на квиток (потрібно ${fare} монет).` };
      }

      const next = clone(state);
      next.coins -= fare;
      next.currentLocation = destinationId;
      commit(next);

      return {
        ok: true,
        message: `Підняти вітрила! Корабель прибув до: ${location.name} (оплачено ${fare} монет).`,
      };
    },
    buyRod(rodId) {
      const rod = getRod(rodId);
      const next = clone(state);

      if (next.ownedRods.includes(rod.id)) {
        next.selectedRod = rod.id;
        commit(next);
        return { ok: true, message: `${rod.name} equipped.` };
      }

      if (next.coins < rod.price) {
        return { ok: false, message: "Not enough coins." };
      }

      next.coins -= rod.price;
      next.ownedRods.push(rod.id);
      next.selectedRod = rod.id;
      commit(next);

      return { ok: true, message: `${rod.name} purchased and equipped.` };
    },
    buyBait(baitId) {
      const bait = getBait(baitId);
      const next = clone(state);

      if (next.ownedBaits.includes(bait.id)) {
        next.selectedBait = bait.id;
        commit(next);
        return { ok: true, message: `${bait.name} equipped.` };
      }

      if (next.coins < bait.price) {
        return { ok: false, message: "Not enough coins." };
      }

      next.coins -= bait.price;
      next.ownedBaits.push(bait.id);
      next.selectedBait = bait.id;
      commit(next);

      return { ok: true, message: `${bait.name} purchased and equipped.` };
    },
    buyBoat(boatId) {
      const boat = getBoat(boatId);

      if (!boat) {
        return { ok: false, message: "Unknown boat." };
      }

      const next = clone(state);

      if (next.ownedBoats.includes(boat.id)) {
        next.currentLocation = boat.unlocksLocation;
        commit(next);
        return { ok: true, message: `${LOCATION_META[boat.unlocksLocation].name} selected.` };
      }

      if (next.coins < boat.price) {
        return { ok: false, message: "Not enough coins." };
      }

      next.coins -= boat.price;
      next.ownedBoats.push(boat.id);
      next.currentLocation = boat.unlocksLocation;
      commit(next);

      return { ok: true, message: `${boat.name} purchased.` };
    },
    setLocation(locationId) {
      const next = clone(state);

      if (!LOCATION_META[locationId]) {
        return { ok: false, message: "Unknown water." };
      }

      if (!isLocationUnlocked(next, locationId)) {
        return { ok: false, message: "That location is locked." };
      }

      next.currentLocation = locationId;
      commit(next);

      return { ok: true, message: `${LOCATION_META[locationId].name} selected.` };
    },
    reset() {
      commit(clone(DEFAULT_STATE));
      return { ok: true, message: "Progress reset." };
    },
  };
}

export function getLevelInfo(totalXp) {
  let level = 1;
  let xpIntoLevel = Math.max(0, totalXp);
  let nextLevelXp = getXpForLevel(level);

  while (xpIntoLevel >= nextLevelXp) {
    xpIntoLevel -= nextLevelXp;
    level += 1;
    nextLevelXp = getXpForLevel(level);
  }

  return {
    level,
    xpIntoLevel,
    nextLevelXp,
    progress: nextLevelXp > 0 ? xpIntoLevel / nextLevelXp : 1,
  };
}

export function isLocationUnlocked(state, locationId) {
  const location = LOCATION_META[locationId];

  if (!location) {
    return false;
  }

  const levelInfo = getLevelInfo(state.xp);
  if (location.requiredLevel && levelInfo.level < location.requiredLevel) {
    return false;
  }

  return !location.requiredBoat || state.ownedBoats.includes(location.requiredBoat);
}

function getInventoryValue(state) {
  return state.inventory.reduce((sum, catchItem) => sum + catchItem.price, 0);
}

function getXpForLevel(level) {
  return 70 + level * 32;
}

function readSave() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : clone(DEFAULT_STATE);
  } catch {
    return clone(DEFAULT_STATE);
  }
}

function writeSave(nextState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // Private browsing or disabled storage should not stop a play session.
  }
}

function normalizeState(rawState) {
  const next = {
    ...clone(DEFAULT_STATE),
    ...clone(rawState ?? {}),
    stats: {
      ...DEFAULT_STATE.stats,
      ...(rawState?.stats ?? {}),
    },
  };

  next.ownedRods = ensureOwned(next.ownedRods, RODS[0].id);
  next.ownedBaits = ensureOwned(next.ownedBaits, BAITS[0].id);
  next.ownedBoats = Array.isArray(next.ownedBoats)
    ? next.ownedBoats.filter((id) => BOATS.some((boat) => boat.id === id))
    : [];
  next.inventory = Array.isArray(next.inventory) ? next.inventory : [];
  next.dex = typeof next.dex === "object" && next.dex ? next.dex : {};

  if (!next.ownedRods.includes(next.selectedRod)) {
    next.selectedRod = RODS[0].id;
  }

  if (!next.ownedBaits.includes(next.selectedBait)) {
    next.selectedBait = BAITS[0].id;
  }

  if (!isLocationUnlocked(next, next.currentLocation)) {
    next.currentLocation = "lake";
  }

  for (const fish of fishDatabase) {
    if (next.dex[fish.id]) {
      next.dex[fish.id].count = Number(next.dex[fish.id].count) || 0;
      next.dex[fish.id].bestWeight = Number(next.dex[fish.id].bestWeight) || 0;
      next.dex[fish.id].bestPrice = Number(next.dex[fish.id].bestPrice) || 0;
    }
  }

  return next;
}

function ensureOwned(items, fallbackId) {
  const unique = Array.isArray(items) ? [...new Set(items)] : [];
  return unique.includes(fallbackId) ? unique : [fallbackId, ...unique];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

