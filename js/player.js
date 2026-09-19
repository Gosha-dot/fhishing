import { fishDatabase, getWorldConditions, LOCATION_META } from "./fishDatabase.js";
import { BAITS, BOATS, getBait, getBoat, getRod, RODS } from "./shop.js";

// Owns all persisted player state. The rest of the app receives snapshots and
// asks this store to perform mutations so save data stays in one place.
const STORAGE_KEY = "tidebound-fishing-save-v1";

export const QUESTS = Object.freeze([
  { id: "swamp-rare-trio", title: "Три болотні рідкісні", description: "Злови 3 Rare риби в болоті.", target: 3, reward: 180 },
  { id: "flat-two-kilos", title: "Камбала-важковаговик", description: "Принеси камбалу вагою 2+ кг.", target: 1, reward: 120 },
]);

export const ACHIEVEMENTS = Object.freeze([
  { id: "first-catch", title: "Перший улов", description: "Злови свою першу рибу.", target: 1, stat: "caught", reward: 40 },
  { id: "ten-catches", title: "Досвідчений рибалка", description: "Злови 10 риб.", target: 10, stat: "caught", reward: 120 },
  { id: "big-fish", title: "Велика здобич", description: "Злови рибу вагою 20+ кг.", target: 20, stat: "bestWeight", reward: 180 },
  { id: "collector", title: "Колекціонер", description: "Відкрий 10 видів у Fish Dex.", target: 10, stat: "species", reward: 220 },
]);

const DEFAULT_STATE = Object.freeze({
  coins: 120,
  xp: 0,
  selectedRod: "willow-rod",
  selectedBait: "crumb-bait",
  currentLocation: "pier",
  ownedRods: ["willow-rod"],
  ownedBaits: ["crumb-bait"],
  ownedBoats: [],
  inventory: [],
  aquarium: [],
  dex: {},
  quests: {},
  achievements: {},
  cheatLuck: false,
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
      currentLocationData: LOCATION_META[state.currentLocation] ?? LOCATION_META.pier ?? LOCATION_META.lake,
      conditions: getWorldConditions(state.currentLocation),
      aquarium: state.aquarium,
      quests: QUESTS.map((quest) => ({ ...quest, ...(state.quests[quest.id] ?? {}) })),
      achievements: ACHIEVEMENTS.map((achievement) => ({
        ...achievement,
        ...(state.achievements[achievement.id] ?? {}),
      })),
      cheatLuck: state.cheatLuck,
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

      const completedQuests = updateQuestProgress(next, catchItem);
      for (const quest of completedQuests) {
        next.coins += quest.reward;
      }

      const completedAchievements = updateAchievements(next, catchItem);
      for (const achievement of completedAchievements) {
        next.coins += achievement.reward;
      }

      const afterLevel = getLevelInfo(next.xp).level;
      commit(next);

      return {
        levelUp: afterLevel > beforeLevel,
        level: afterLevel,
        completedQuests,
        completedAchievements,
      };
    },
    exportSave() {
      return JSON.stringify(state, null, 2);
    },
    importSave(serialized) {
      try {
        const imported = JSON.parse(serialized);
        if (!imported || typeof imported !== "object" || !Array.isArray(imported.inventory)) {
          throw new Error("Invalid save");
        }
        commit(imported);
        return { ok: true, message: "Сейв імпортовано." };
      } catch {
        return { ok: false, message: "Не вдалося імпортувати цей сейв." };
      }
    },
    cheatUnlockAll() {
      const next = clone(state);
      next.coins += 100000;
      next.xp = Math.max(next.xp, getXpThroughLevel(10));
      next.ownedBoats = BOATS.map((boat) => boat.id);
      next.ownedRods = RODS.filter((rod) => !rod.cheatOnly).map((rod) => rod.id);
      commit(next);
      return { ok: true, message: "Чит активовано: всі локації та вудки відкрито." };
    },
    cheatGiveRod(rodId) {
      const rod = getRod(rodId);
      if (!rod || rod.id !== rodId) {
        return { ok: false, message: `Вудку не знайдено: ${rodId}.` };
      }
      const next = clone(state);
      if (!next.ownedRods.includes(rod.id)) next.ownedRods.push(rod.id);
      next.selectedRod = rod.id;
      commit(next);
      return { ok: true, message: `Видано та екіпіровано: ${rod.name}.` };
    },
    cheatGiveAllRods() {
      const next = clone(state);
      next.ownedRods = RODS.map((rod) => rod.id);
      commit(next);
      return { ok: true, message: "Усі вудки додано до інвентарю." };
    },
    cheatGiveCoins(amount) {
      const coins = Math.max(0, Math.floor(Number(amount)));
      if (!Number.isFinite(coins) || coins <= 0) {
        return { ok: false, message: "Вкажи додатне число монет." };
      }
      const next = clone(state);
      next.coins += coins;
      commit(next);
      return { ok: true, message: `Додано ${coins} монет.` };
    },
    spendCoins(amount) {
      const coins = Math.floor(Number(amount));
      if (!Number.isFinite(coins) || coins <= 0) {
        return { ok: false, message: "Сума витрат має бути додатною." };
      }
      if (state.coins < coins) {
        return { ok: false, message: `Недостатньо монет: потрібно ${coins}.` };
      }
      const next = clone(state);
      next.coins -= coins;
      commit(next);
      return { ok: true, message: `Списано ${coins} монет.` };
    },
    cheatSetLevel(level) {
      const targetLevel = Math.max(1, Math.min(50, Math.floor(Number(level))));
      if (!Number.isFinite(targetLevel)) {
        return { ok: false, message: "Рівень має бути числом від 1 до 50." };
      }
      const next = clone(state);
      next.xp = getXpThroughLevel(targetLevel);
      commit(next);
      return { ok: true, message: `Встановлено рівень ${targetLevel}.` };
    },
    cheatSetLuck(enabled) {
      const next = clone(state);
      next.cheatLuck = Boolean(enabled);
      commit(next);
      return {
        ok: true,
        message: next.cheatLuck
          ? "Режим удачі увімкнено: ловитимуться лише Legendary або Mythical риби."
          : "Режим удачі вимкнено.",
      };
    },
    keepCatch(catchId) {
      const next = clone(state);
      const index = next.inventory.findIndex((item) => item.catchId === catchId);
      if (index === -1) return { ok: false, message: "Цієї риби вже немає в садку." };
      const [catchItem] = next.inventory.splice(index, 1);
      next.aquarium.unshift({ ...catchItem, feedCount: 0, displayed: next.aquarium.length === 0 });
      commit(next);
      return { ok: true, message: `${catchItem.name} оселилася в акваріумі.` };
    },
    feedFish(catchId) {
      const next = clone(state);
      const fish = next.aquarium.find((item) => item.catchId === catchId);
      if (!fish) return { ok: false, message: "Рибу не знайдено в акваріумі." };
      fish.feedCount = (fish.feedCount ?? 0) + 1;
      commit(next);
      return { ok: true, message: `${fish.name} задоволено хлюпнула хвостом.` };
    },
    toggleDisplayFish(catchId) {
      const next = clone(state);
      const fish = next.aquarium.find((item) => item.catchId === catchId);
      if (!fish) return { ok: false, message: "Рибу не знайдено в акваріумі." };
      fish.displayed = !fish.displayed;
      commit(next);
      return { ok: true, message: fish.displayed ? "Рибу виставлено в головній вітрині." : "Рибу прибрано з вітрини." };
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
        message: `Квиток придбано. Корабель прибув до: ${location.name} (оплачено ${fare} монет).`,
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

function getXpThroughLevel(level) {
  let totalXp = 0;
  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    totalXp += getXpForLevel(currentLevel);
  }
  return totalXp;
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
  next.aquarium = Array.isArray(next.aquarium) ? next.aquarium : [];
  next.dex = typeof next.dex === "object" && next.dex ? next.dex : {};
  next.quests = typeof next.quests === "object" && next.quests ? next.quests : {};
  next.achievements = typeof next.achievements === "object" && next.achievements ? next.achievements : {};
  next.cheatLuck = Boolean(next.cheatLuck);

  if (!next.ownedRods.includes(next.selectedRod)) {
    next.selectedRod = RODS[0].id;
  }

  if (!next.ownedBaits.includes(next.selectedBait)) {
    next.selectedBait = BAITS[0].id;
  }

  if (!isLocationUnlocked(next, next.currentLocation)) {
    next.currentLocation = "pier";
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

function updateQuestProgress(next, catchItem) {
  const completed = [];
  for (const quest of QUESTS) {
    const current = next.quests[quest.id] ?? { progress: 0, completed: false };
    if (current.completed) continue;

    if (quest.id === "swamp-rare-trio" && ["bog", "swamp"].includes(catchItem.locationId) && catchItem.rarity === "Rare") {
      current.progress = Math.min(quest.target, (current.progress ?? 0) + 1);
    }
    if (quest.id === "flat-two-kilos" && catchItem.fishId === "dock-flounder" && catchItem.weight >= 2) {
      current.progress = quest.target;
    }

    if (current.progress >= quest.target) {
      current.completed = true;
      completed.push(quest);
    }
    next.quests[quest.id] = current;
  }
  return completed;
}

function updateAchievements(next, catchItem) {
  const completed = [];
  const bestWeight = Math.max(
    catchItem.weight,
    ...next.inventory.map((item) => Number(item.weight) || 0),
    ...next.aquarium.map((item) => Number(item.weight) || 0),
  );
  const species = Object.values(next.dex).filter((entry) => entry.count > 0).length;

  for (const achievement of ACHIEVEMENTS) {
    const current = next.achievements[achievement.id] ?? { progress: 0, completed: false };
    if (current.completed) continue;
    current.progress = achievement.stat === "bestWeight"
      ? bestWeight
      : achievement.stat === "species"
        ? species
        : next.stats[achievement.stat] ?? 0;
    if (current.progress >= achievement.target) {
      current.completed = true;
      completed.push(achievement);
    }
    next.achievements[achievement.id] = current;
  }
  return completed;
}

function ensureOwned(items, fallbackId) {
  const unique = Array.isArray(items) ? [...new Set(items)] : [];
  return unique.includes(fallbackId) ? unique : [fallbackId, ...unique];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

