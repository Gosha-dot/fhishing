import { fishDatabase, RARITY_META } from "./fishDatabase.js";
import { FishingController } from "./fishing.js";
import { getFishRenderModel } from "./fishArchetypes.js";
import { createPlayerStore } from "./player.js";
import { RODS } from "./shop.js";
import { UIController } from "./ui.js";
import { BlackjackGame } from "./blackjack.js";
import { WeatherSystem } from "./weather.js";

// Main entry point: owns the canvas loop, audio bus, weather, blackjack, and movement.
const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const playerStore = createPlayerStore();
const audioBus = createAudioBus();
let soundEnabled = true;
const fishSchoolPools = new Map();
const fishByLocationCache = new Map();

// Weather system with 5-15 min intervals and 2x luck bonus during rain
const weatherSystem = new WeatherSystem({
  onWeatherChange({ weather, luckMultiplier, message }) {
    ui.showToast(message);
    if (soundEnabled && weather === "rain") {
      audioBus.play("rain_start");
    }
  },
});

// Blackjack casino engine
const blackjackGame = new BlackjackGame({
  playerStore,
  onNotification(msg) {
    ui.showToast(msg);
  },
});

// Movement state
const movement = {
  xRatio: 0.28,
  targetXRatio: null,
  walkDirection: 0,
  speed: 0.26, // screen width ratio per second
  facing: 1, // 1: right, -1: left
  isWalking: false,
  walkCycle: 0,
};

let activeInteraction = null;

const ui = new UIController({ playerStore, blackjackGame, weatherSystem });
const fishing = new FishingController({
  playerStore,
  weatherSystem,
  onCatch(catchItem) {
    const levelResult = playerStore.addCatch(catchItem);
    ui.showCatchResult(catchItem, levelResult);
    levelResult.completedQuests?.forEach((quest) => ui.showToast(`Квест виконано: ${quest.title} (+${quest.reward} монет).`));
    levelResult.completedAchievements?.forEach((achievement) => ui.showToast(`Досягнення: ${achievement.title} (+${achievement.reward} монет).`));
    levelResult.challengeRewards?.forEach((challenge) => ui.showToast(`Челендж виконано: ${challenge.title} (+${challenge.reward} монет).`));
    if (playerStore.snapshot().combo > 1) ui.showToast(`Комбо x${playerStore.snapshot().combo}: бонусні монети!`);
  },
  onMiss(message) {
    playerStore.breakCombo();
    ui.showToast(message);
  },
  playSound(type) {
    if (soundEnabled) {
      audioBus.play(type);
    }
  },
});

// Click/tap on canvas to walk
canvas.addEventListener("pointerdown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const clickXRatio = (e.clientX - rect.left) / rect.width;
  const clickYRatio = (e.clientY - rect.top) / rect.height;

  if (clickYRatio > 0.42 && clickYRatio < 0.9) {
    movement.targetXRatio = Math.max(0.06, Math.min(0.94, clickXRatio));
  }
});

ui.bindHandlers({
  primaryDown() {
    audioBus.unlock();
    fishing.pressPrimary();
  },
  primaryUp() {
    fishing.releasePrimary();
  },
  walkLeftDown() {
    movement.walkDirection = -1;
    movement.targetXRatio = null;
  },
  walkLeftUp() {
    if (movement.walkDirection === -1) movement.walkDirection = 0;
  },
  walkRightDown() {
    movement.walkDirection = 1;
    movement.targetXRatio = null;
  },
  walkRightUp() {
    if (movement.walkDirection === 1) movement.walkDirection = 0;
  },
  interactAction() {
    triggerNearbyInteraction();
  },
  ability() {
    if (!fishing.pressAbility()) {
      ui.showToast("Здібність ще не готова або працює лише під час виважування.");
    }
  },
  sellAll() {
    if (activeInteraction !== "npc") {
      ui.showToast("Продати рибу можна тільки у Старого Марко на Острові.");
      return;
    }
    const result = playerStore.sellAll();
    ui.showToast(result.message);
  },
  sellCatch(catchId) {
    if (activeInteraction !== "npc") {
      ui.showToast("Продати рибу можна тільки у Старого Марко на Острові.");
      return;
    }
    const result = playerStore.sellCatch(catchId);
    ui.showToast(result.message);
  },
  keepCatch(catchId) {
    const result = playerStore.keepCatch(catchId);
    ui.showToast(result.message);
  },
  feedFish(catchId) {
    const result = playerStore.feedFish(catchId);
    ui.showToast(result.message);
  },
  toggleDisplayFish(catchId) {
    const result = playerStore.toggleDisplayFish(catchId);
    ui.showToast(result.message);
  },
  exportSave() {
    const blob = new Blob([playerStore.exportSave()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tidebound-fishing-save.json";
    link.click();
    URL.revokeObjectURL(url);
    ui.showToast("Сейв експортовано.");
  },
  importSave(serialized) {
    const result = playerStore.importSave(serialized);
    ui.showToast(result.message);
  },
  cheatCommand(command) {
    return runCheatCommand(command);
  },
  sellAllNpc() {
    if (activeInteraction !== "npc") {
      ui.showToast("Підійди до ятки Старого Марко, щоб продати рибу.");
      return;
    }
    const result = playerStore.sellAllWithBonus(15);
    ui.showToast(result.message);
  },
  sellCatchNpc(catchId) {
    if (activeInteraction !== "npc") {
      ui.showToast("Підійди до ятки Старого Марко, щоб продати рибу.");
      return;
    }
    const result = playerStore.sellCatchWithBonus(catchId, 15);
    ui.showToast(result.message);
  },
  setLocation(locationId) {
    if (fishing.getSnapshot().mode !== "idle") {
      ui.showToast("Finish the current cast first.");
      return;
    }

    const result = playerStore.setLocation(locationId);
    ui.showToast(result.message);
  },
  sailTo(destinationId, fare) {
    if (fishing.getSnapshot().mode !== "idle") {
      ui.showToast("Спочатку заверши поточну риболовлю.");
      return;
    }

    const result = playerStore.payTravelFare(fare, destinationId);
    ui.showToast(result.message);
    if (result.ok) {
      ui.closeModal("shipModal");
      movement.xRatio = 0.25; // Land near the boat
      movement.targetXRatio = null;
    }
  },
  shopAction(action, itemId) {
    if (fishing.getSnapshot().mode !== "idle") {
      ui.showToast("Gear changes wait until the line is clear.");
      return;
    }

    const result = runShopAction(action, itemId);
    ui.showToast(result.message);
  },
  toggleSound() {
    soundEnabled = !soundEnabled;
    if (soundEnabled) {
      audioBus.unlock();
    }
    ui.setSoundEnabled(soundEnabled);
  },
  repairRod() {
    const result = playerStore.repairRod();
    ui.showToast(result.message);
  },
  setTheme(theme) {
    const result = playerStore.setTheme(theme);
    document.documentElement.dataset.theme = playerStore.snapshot().theme;
    ui.showToast(result.message);
  },
  blackjackDeal(amount) {
    audioBus.unlock();
    const res = blackjackGame.placeBet(amount);
    ui.showToast(res.message);
    if (soundEnabled) audioBus.play("card");
    ui.renderBlackjack();
  },
  blackjackHit() {
    audioBus.unlock();
    const res = blackjackGame.hit();
    if (soundEnabled) audioBus.play("card");
    if (!res.ok || res.bust) {
      ui.showToast(res.message ?? blackjackGame.getSnapshot().result?.message ?? "Хід недоступний.");
    }
    ui.renderBlackjack();
  },
  blackjackStand() {
    audioBus.unlock();
    const res = blackjackGame.stand();
    if (soundEnabled && res.result) audioBus.play(res.result.payout > 0 ? "success" : "miss");
    ui.showToast(res.result?.message ?? res.message ?? "Хід недоступний.");
    ui.renderBlackjack();
  },
  blackjackReset() {
    blackjackGame.reset();
    ui.renderBlackjack();
  },
});

ui.setSoundEnabled(soundEnabled);
document.documentElement.dataset.theme = playerStore.snapshot().theme;
if (!localStorage.getItem("tidebound-tutorial-seen")) {
  localStorage.setItem("tidebound-tutorial-seen", "1");
  ui.openModal("journalModal");
}
requestAnimationFrame(frame);

let previousTime = performance.now();

function frame(now) {
  const dt = (now - previousTime) / 1000;
  previousTime = now;

  weatherSystem.update(dt);
  updateMovement(dt);
  fishing.update(dt);
  const player = playerStore.snapshot();
  const fishingState = fishing.getSnapshot();

  checkInteractionZones(player, fishingState);
  drawScene(ctx, canvas, player, fishingState, now / 1000, weatherSystem, movement);
  ui.render(player, fishingState);

  requestAnimationFrame(frame);
}

function updateMovement(dt) {
  const fishingState = fishing.getSnapshot();
  // Player stands still when actively reeling or charging
  if (fishingState.mode === "reeling" || fishingState.mode === "charging") {
    movement.walkDirection = 0;
    movement.targetXRatio = null;
    movement.isWalking = false;
    return;
  }

  let dir = movement.walkDirection;
  if (movement.targetXRatio !== null) {
    const diff = movement.targetXRatio - movement.xRatio;
    if (Math.abs(diff) < 0.012) {
      movement.targetXRatio = null;
      dir = 0;
    } else {
      dir = Math.sign(diff);
    }
  }

  if (dir !== 0) {
    movement.isWalking = true;
    movement.facing = dir;
    movement.xRatio = Math.max(0.06, Math.min(0.92, movement.xRatio + dir * movement.speed * dt));
    movement.walkCycle += dt;
  } else {
    movement.isWalking = false;
  }
}

function checkInteractionZones(player, fishingState) {
  const loc = player.currentLocation;
  const x = movement.xRatio;

  if (loc === "island") {
    if (x < 0.2) {
      activeInteraction = "boat";
      ui.setInteractionPrompt("⛵ [E] Корабель на Причал");
    } else if (x >= 0.28 && x <= 0.52) {
      activeInteraction = "npc";
      ui.setInteractionPrompt("🐟 [E] Торговець рибою Старий Марко");
    } else if (x >= 0.62 && x <= 0.88) {
      activeInteraction = "blackjack";
      ui.setInteractionPrompt("♠️ [E] Казино «Блекджек» (Стіл)");
    } else if (x > 0.88) {
      activeInteraction = "cast";
      ui.setInteractionPrompt(fishingState.mode === "idle" ? "🎣 [Cast] Закинути вудку" : null);
    } else {
      activeInteraction = null;
      ui.setInteractionPrompt(null);
    }
  } else if (loc === "pier" || loc === "harbor") {
    if (x < 0.22) {
      activeInteraction = "boat";
      ui.setInteractionPrompt("⛵ [E] Корабель на Острів");
    } else if (x > 0.32) {
      activeInteraction = "cast";
      ui.setInteractionPrompt(fishingState.mode === "idle" ? "🎣 [Cast] Закинути вудку" : null);
    } else {
      activeInteraction = null;
      ui.setInteractionPrompt(null);
    }
  } else {
    // Other wild locations
    if (x < 0.2) {
      activeInteraction = "boat";
      ui.setInteractionPrompt("⛵ [E] Корабель для подорожей");
    } else {
      activeInteraction = "cast";
      ui.setInteractionPrompt(fishingState.mode === "idle" ? "🎣 [Cast] Закинути вудку" : null);
    }
  }

  ui.setMerchantAccess(activeInteraction === "npc");
}

function triggerNearbyInteraction() {
  if (activeInteraction === "boat") {
    ui.openModal("shipModal");
  } else if (activeInteraction === "npc") {
    ui.openModal("npcModal");
  } else if (activeInteraction === "blackjack") {
    ui.openModal("blackjackModal");
  } else if (activeInteraction === "cast") {
    fishing.pressPrimary();
    setTimeout(() => fishing.releasePrimary(), 120);
  }
}

function runShopAction(action, itemId) {
  if (action.endsWith("rod")) {
    return playerStore.buyRod(itemId);
  }

  if (action.endsWith("bait")) {
    return playerStore.buyBait(itemId);
  }

  if (action.endsWith("boat")) {
    return playerStore.buyBoat(itemId);
  }

  return { ok: false, message: "Unknown shop action." };
}

function runCheatCommand(command) {
  const parts = command.trim().split(/\s+/);
  const verb = parts[0]?.toLowerCase();
  const subject = parts[1]?.toLowerCase();
  const value = parts[2];

  if (command.trim().toLowerCase() === "help") {
    return {
      ok: true,
      message: `Команди: weather rain | weather clear | unlock all | give rod <id> | give rod all | give coins <amount> | set level <1-50> | luck on/off | reset all. Вудки: ${RODS.map((rod) => rod.id).join(", ")}`,
    };
  }
  if (verb === "weather" && subject === "rain") {
    weatherSystem.setWeather("rain", 180);
    return { ok: true, message: "Погода змінена на Дощ (2x Удача) на 3 хвилини." };
  }
  if (verb === "weather" && subject === "clear") {
    weatherSystem.setWeather("clear");
    return { ok: true, message: "Погода змінена на Ясно." };
  }
  if (verb === "reset" && subject === "all") return playerStore.reset();
  if (verb === "luck" && subject === "on") return playerStore.cheatSetLuck(true);
  if (verb === "luck" && subject === "off") return playerStore.cheatSetLuck(false);
  if (verb === "unlock" && subject === "all") return playerStore.cheatUnlockAll();
  if (verb === "give" && subject === "rod" && value?.toLowerCase() === "all") return playerStore.cheatGiveAllRods();
  if (verb === "give" && subject === "rod" && value) return playerStore.cheatGiveRod(value.toLowerCase());
  if (verb === "give" && subject === "coins") return playerStore.cheatGiveCoins(value);
  if (verb === "set" && subject === "level") return playerStore.cheatSetLevel(value);
  return { ok: false, message: "Невідома команда. Введи help." };
}

function drawScene(context, targetCanvas, player, fishingState, time, weather, move) {
  const { width, height } = resizeCanvas(targetCanvas, context);
  const location = player.currentLocationData;
  const palette = location.palette;
  const waterLine = height * 0.56;

  drawSky(context, width, height, palette, location.id, time);
  drawFarShore(context, width, height, waterLine, palette, location.id, time);
  drawWater(context, width, height, waterLine, palette, location.id, time);
  drawLocationEnvironment(context, width, height, waterLine, location.id, time, palette);
  if (location.id !== "island") {
    drawFishShapes(context, width, height, waterLine, player.currentLocation, time);
  }
  drawWeatherOverlay(context, width, height, player.conditions, time, weather, waterLine);
  drawDetailedAngler(context, width, height, waterLine, palette, time, fishingState, move);
  drawFishingLine(context, width, height, waterLine, time, fishingState, move);
  const rodTip = getRodTip(width, height, waterLine, time, fishingState.mode, move);
  drawEffects(context, width, height, fishingState.effects, rodTip);

  if (fishingState.mode === "reeling") {
    drawWaterTension(context, width, height, fishingState);
  }
}

function resizeCanvas(targetCanvas, context) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = targetCanvas.clientWidth;
  const height = targetCanvas.clientHeight;
  const pixelWidth = Math.floor(width * dpr);
  const pixelHeight = Math.floor(height * dpr);

  if (targetCanvas.width !== pixelWidth || targetCanvas.height !== pixelHeight) {
    targetCanvas.width = pixelWidth;
    targetCanvas.height = pixelHeight;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  return { width, height };
}

function drawSky(context, width, height, palette, locationId, time) {
  const gradient = context.createLinearGradient(0, 0, 0, height * 0.58);
  gradient.addColorStop(0, palette.skyTop);
  gradient.addColorStop(1, palette.skyBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height * 0.58);

  context.fillStyle = palette.haze;
  context.beginPath();
  context.ellipse(width * 0.78, height * 0.16, width * 0.12, width * 0.12, 0, 0, Math.PI * 2);
  context.fill();

  const orbColor = locationId === "abyss" ? "rgba(230, 220, 255, 0.72)" : "rgba(255, 236, 168, 0.78)";
  context.fillStyle = orbColor;
  context.beginPath();
  context.arc(width * 0.78, height * 0.16, Math.max(34, width * 0.035), 0, Math.PI * 2);
  context.fill();

  drawCloud(context, width * 0.24 + Math.sin(time * 0.1) * 10, height * 0.16, width * 0.09);
  drawCloud(context, width * 0.53 + Math.cos(time * 0.08) * 12, height * 0.11, width * 0.07);
}

function drawCloud(context, x, y, scale) {
  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.28)";
  context.beginPath();
  context.ellipse(x, y, scale, scale * 0.28, 0, 0, Math.PI * 2);
  context.ellipse(x - scale * 0.46, y + scale * 0.05, scale * 0.5, scale * 0.22, 0, 0, Math.PI * 2);
  context.ellipse(x + scale * 0.5, y + scale * 0.03, scale * 0.58, scale * 0.24, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawFarShore(context, width, height, waterLine, palette, locationId, time) {
  context.save();
  context.fillStyle = withAlpha(palette.shore, 0.62);
  context.beginPath();
  context.moveTo(0, waterLine);

  for (let x = 0; x <= width; x += 40) {
    const y =
      waterLine -
      height * 0.08 -
      Math.sin(x * 0.008 + time * 0.18) * 8 -
      Math.cos(x * 0.017) * 12;
    context.lineTo(x, y);
  }

  context.lineTo(width, waterLine + 18);
  context.lineTo(0, waterLine + 18);
  context.closePath();
  context.fill();

  if (locationId === "pier" || locationId === "harbor") {
    // Lighthouse on distant cliff
    const lhX = width * 0.88;
    const lhY = waterLine - height * 0.16;
    context.fillStyle = "#ffffff";
    context.fillRect(lhX, lhY, 14, 38);
    context.fillStyle = "#ff4444";
    context.fillRect(lhX, lhY + 12, 14, 10);
    context.fillStyle = "rgba(255, 240, 150, 0.85)";
    context.beginPath();
    context.arc(lhX + 7, lhY - 2, 7, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawWater(context, width, height, waterLine, palette, locationId, time) {
  const gradient = context.createLinearGradient(0, waterLine, 0, height);
  gradient.addColorStop(0, palette.waterTop);
  gradient.addColorStop(1, palette.waterBottom);
  context.fillStyle = gradient;
  context.fillRect(0, waterLine, width, height - waterLine);

  context.save();
  context.globalAlpha = 0.34;
  context.lineWidth = 2;

  for (let row = 0; row < 9; row += 1) {
    const y = waterLine + 18 + row * 34;
    context.strokeStyle = row % 2 === 0 ? "rgba(255,255,255,0.32)" : withAlpha(palette.accent, 0.34);
    context.beginPath();

    for (let x = -30; x <= width + 30; x += 18) {
      const wave = Math.sin(x * 0.025 + time * (0.85 + row * 0.08) + row) * (4 + row * 0.35);
      if (x === -30) {
        context.moveTo(x, y + wave);
      } else {
        context.lineTo(x, y + wave);
      }
    }

    context.stroke();
  }

  context.restore();
}

// Draws location structures: Pier dock, Island shops, Ferry boat
function drawLocationEnvironment(context, width, height, waterLine, locationId, time, palette) {
  const dockY = waterLine + height * 0.13;

  context.save();

  if (locationId === "island") {
    // Layered island beach with a shallow lagoon, dunes, and a path inland.
    const sandGrad = context.createLinearGradient(0, dockY - 14, 0, height);
    sandGrad.addColorStop(0, "#edd293");
    sandGrad.addColorStop(1, "#c9a660");
    context.fillStyle = sandGrad;
    context.fillRect(0, dockY - 10, width, height - dockY + 10);

    context.fillStyle = "rgba(255, 244, 190, 0.72)";
    context.beginPath();
    context.moveTo(0, dockY + 18);
    context.quadraticCurveTo(width * 0.24, dockY - 2, width * 0.48, dockY + 16);
    context.quadraticCurveTo(width * 0.75, dockY + 34, width, dockY + 10);
    context.lineTo(width, dockY + 30);
    context.quadraticCurveTo(width * 0.7, dockY + 51, width * 0.42, dockY + 32);
    context.quadraticCurveTo(width * 0.18, dockY + 15, 0, dockY + 42);
    context.closePath();
    context.fill();

    context.fillStyle = "rgba(112, 145, 91, 0.24)";
    context.beginPath();
    context.ellipse(width * 0.58, dockY + height * 0.17, width * 0.25, height * 0.08, -0.12, 0, Math.PI * 2);
    context.fill();

    drawIslandRocks(context, width, dockY);
    drawIslandVegetation(context, width, dockY, time);
    drawIslandPath(context, width, dockY);

    // Palm trees
    drawPalmTree(context, width * 0.06, dockY - 10, 0.9);
    drawPalmTree(context, width * 0.92, dockY - 10, 1.05);

    // Marco's Fishmonger Booth at x: ~38%
    drawFishmongerBooth(context, width * 0.38, dockY - 8, time, 1.55);

    // Casino Blackjack Table & Tent at x: ~74%
    drawCasinoTent(context, width * 0.74, dockY - 8, time, 1.6);

    // Ferry Boat at left shore
    drawFerryBoat(context, width * 0.12, dockY - 4, time, "На Причал", 1.7);
  } else {
    // Default or Pier: wooden boardwalk extending across
    const dockEndX = locationId === "pier" || locationId === "harbor" ? width * 0.94 : width * 0.42;

    context.fillStyle = "#3e271c";
    context.fillRect(0, dockY, dockEndX, 22);

    // Dock pilings into the deep water
    context.fillStyle = "#271810";
    for (let x = 32; x < dockEndX; x += 55) {
      context.fillRect(x, dockY + 16, 12, height * 0.28);
    }

    // Wooden deck planks
    context.fillStyle = "#63412f";
    for (let x = 0; x < dockEndX; x += 36) {
      context.fillRect(x, dockY - 4, 32, 10);
      context.fillStyle = "#7b523c";
      context.fillRect(x + 2, dockY - 3, 28, 3);
      context.fillStyle = "#63412f";
    }

    // Maritime lantern on pole
    const lanX = dockEndX - 30;
    context.fillStyle = "#1e130c";
    context.fillRect(lanX, dockY - 48, 6, 46);
    context.fillStyle = "#f5c95c";
    context.beginPath();
    context.arc(lanX + 3, dockY - 50, 10, 0, Math.PI * 2);
    context.fill();
    // Warm lantern glow
    const glow = context.createRadialGradient(lanX + 3, dockY - 50, 2, lanX + 3, dockY - 50, 48);
    glow.addColorStop(0, "rgba(245, 201, 92, 0.42)");
    glow.addColorStop(1, "rgba(245, 201, 92, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(lanX + 3, dockY - 50, 48, 0, Math.PI * 2);
    context.fill();

    // Ferry Boat moored at the left end
    drawFerryBoat(context, width * 0.11, dockY - 4, time, "На Острів", 1.35);
  }

  context.restore();
}

function drawIslandRocks(context, width, dockY) {
  context.save();
  const rocks = [
    [width * 0.2, dockY + 28, 18, 8],
    [width * 0.53, dockY + 48, 25, 10],
    [width * 0.86, dockY + 30, 20, 9],
  ];
  for (const [x, y, rx, ry] of rocks) {
    context.fillStyle = "#8e795e";
    context.beginPath();
    context.ellipse(x, y, rx, ry, -0.12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(255, 236, 177, 0.42)";
    context.beginPath();
    context.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.55, ry * 0.25, -0.12, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawIslandVegetation(context, width, dockY, time) {
  context.save();
  context.strokeStyle = "#47723d";
  context.lineWidth = 3;
  for (const x of [width * 0.28, width * 0.32, width * 0.84]) {
    const sway = Math.sin(time * 1.4 + x) * 3;
    context.beginPath();
    context.moveTo(x, dockY + 18);
    context.quadraticCurveTo(x + sway, dockY - 2, x + 5, dockY - 13);
    context.stroke();
    context.beginPath();
    context.moveTo(x + 3, dockY - 5);
    context.lineTo(x - 8, dockY - 17);
    context.moveTo(x + 4, dockY - 7);
    context.lineTo(x + 13, dockY - 18);
    context.stroke();
  }
  context.restore();
}

function drawIslandPath(context, width, dockY) {
  context.save();
  context.fillStyle = "rgba(176, 132, 76, 0.28)";
  context.beginPath();
  context.moveTo(width * 0.49, dockY + 12);
  context.quadraticCurveTo(width * 0.47, dockY + 55, width * 0.42, dockY + 110);
  context.lineTo(width * 0.66, dockY + 110);
  context.quadraticCurveTo(width * 0.57, dockY + 55, width * 0.56, dockY + 12);
  context.closePath();
  context.fill();
  context.restore();
}

function drawFerryBoat(context, x, y, time, label, scale = 1) {
  context.save();
  const bob = Math.sin(time * 2.2) * 2.5;
  context.translate(x, y + bob);
  context.scale(scale, scale);

  // Hull
  context.fillStyle = "#1b384c";
  context.beginPath();
  context.moveTo(-36, 0);
  context.lineTo(36, 0);
  context.lineTo(26, 18);
  context.lineTo(-24, 18);
  context.closePath();
  context.fill();

  // Mooring rope, lifebuoy, and a reflected hull highlight add scale to the ferry.
  context.strokeStyle = "#d5b77a";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(-26, 17);
  context.quadraticCurveTo(-42, 25, -48, 14);
  context.stroke();
  context.strokeStyle = "#e65d45";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(25, 8, 6, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = "rgba(255,255,255,0.25)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-38, 25);
  context.lineTo(38, 25);
  context.stroke();

  // White stripe on hull
  context.fillStyle = "#ffffff";
  context.fillRect(-30, 4, 60, 3);

  // Cabin
  context.fillStyle = "#dfd5c4";
  context.fillRect(-16, -14, 28, 14);
  context.fillStyle = "#226a8f";
  context.fillRect(-12, -10, 8, 6);
  context.fillRect(0, -10, 8, 6);

  // Mast & rigging
  context.strokeStyle = "#4d3422";
  context.lineWidth = 2.5;
  context.beginPath();
  context.moveTo(4, -14);
  context.lineTo(4, -36);
  context.stroke();

  // Flag
  context.fillStyle = "#f5c95c";
  context.beginPath();
  context.moveTo(4, -36);
  context.lineTo(16, -31);
  context.lineTo(4, -26);
  context.closePath();
  context.fill();

  // Sign / Label
  context.fillStyle = "rgba(10, 20, 25, 0.75)";
  context.roundRect(-28, -26, 56, 11, 3);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "bold 8px sans-serif";
  context.textAlign = "center";
  context.fillText(label, 0, -18);

  context.restore();
}

function drawPalmTree(context, x, y, scale) {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);

  // Curved trunk
  context.strokeStyle = "#7a5538";
  context.lineWidth = 11;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(0, 0);
  context.quadraticCurveTo(14, -45, 8, -85);
  context.stroke();

  // Fronds
  const topX = 8;
  const topY = -85;
  context.fillStyle = "#3e7c33";

  const angles = [-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8];
  for (const a of angles) {
    context.save();
    context.translate(topX, topY);
    context.rotate(a);
    context.beginPath();
    context.ellipse(26, 0, 28, 8, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  // Coconuts
  context.fillStyle = "#4a301a";
  context.beginPath();
  context.arc(topX - 3, topY + 4, 4, 0, Math.PI * 2);
  context.arc(topX + 4, topY + 4, 4, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function drawFishmongerBooth(context, x, y, time, scale = 1) {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);

  // Timber frame and shaded back wall turn the booth into a full market stall.
  context.fillStyle = "#70472d";
  context.fillRect(-40, -58, 80, 58);
  context.fillStyle = "#9a633b";
  context.fillRect(-37, -55, 74, 30);
  context.fillStyle = "#2b6c72";
  context.fillRect(-28, -49, 18, 14);
  context.fillRect(10, -49, 18, 14);
  context.strokeStyle = "#d9ba70";
  context.lineWidth = 1.5;
  context.strokeRect(-28, -49, 18, 14);
  context.strokeRect(10, -49, 18, 14);

  // Counter
  context.fillStyle = "#5c3d28";
  context.fillRect(-34, -22, 68, 22);
  context.fillStyle = "#7a5237";
  context.fillRect(-36, -26, 72, 5);

  // Crates and baskets under the counter.
  context.fillStyle = "#b7793d";
  context.fillRect(-31, -4, 17, 11);
  context.fillRect(15, -4, 17, 11);
  context.strokeStyle = "#5b351f";
  context.lineWidth = 1;
  context.strokeRect(-31, -4, 17, 11);
  context.strokeRect(15, -4, 17, 11);

  // Sign: $ РИБА
  context.fillStyle = "#eed49f";
  context.fillRect(-24, -48, 48, 14);
  context.strokeStyle = "#382315";
  context.lineWidth = 1.5;
  context.strokeRect(-24, -48, 48, 14);
  context.fillStyle = "#1e130c";
  context.font = "bold 9px sans-serif";
  context.textAlign = "center";
  context.fillText("🐟 МАРКО", 0, -38);

  // Striped canopy / awning
  const awningY = -56;
  for (let i = 0; i < 6; i += 1) {
    context.fillStyle = i % 2 === 0 ? "#e74c3c" : "#ffffff";
    context.fillRect(-34 + i * 11.3, awningY, 11.5, 9);
  }

  // Old Marco NPC standing behind counter
  const wave = Math.sin(time * 3) * 3;
  // Body & apron
  context.fillStyle = "#274f7d";
  context.fillRect(-9, -38, 18, 16);
  context.fillStyle = "#ffffff";
  context.fillRect(-6, -34, 12, 12);
  // Head
  context.fillStyle = "#f3c49e";
  context.beginPath();
  context.arc(0, -44, 7, 0, Math.PI * 2);
  context.fill();
  // White beard
  context.fillStyle = "#f0f0f0";
  context.beginPath();
  context.arc(0, -41, 5.5, 0, Math.PI);
  context.fill();
  // Fisherman cap
  context.fillStyle = "#d4a843";
  context.fillRect(-7, -50, 14, 4);

  // Hand waving
  context.strokeStyle = "#f3c49e";
  context.lineWidth = 2.5;
  context.beginPath();
  context.moveTo(8, -34);
  context.lineTo(16, -42 + wave);
  context.stroke();

  context.restore();
}

function drawCasinoTent(context, x, y, time, scale = 1) {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);

  // Full canopy behind the table gives the casino a recognizable silhouette.
  context.fillStyle = "#38204b";
  context.beginPath();
  context.moveTo(-50, -73);
  context.lineTo(50, -73);
  context.lineTo(40, -18);
  context.lineTo(-40, -18);
  context.closePath();
  context.fill();
  context.fillStyle = "#d74b4d";
  context.beginPath();
  context.moveTo(-52, -73);
  context.lineTo(52, -73);
  context.lineTo(44, -62);
  context.lineTo(-44, -62);
  context.closePath();
  context.fill();
  context.fillStyle = "#f5c95c";
  for (let i = -3; i <= 3; i += 2) {
    context.fillRect(i * 14 - 5, -72, 10, 10);
  }

  // Blackjack table
  context.fillStyle = "#155724"; // Casino green felt
  context.beginPath();
  context.ellipse(0, -14, 38, 14, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#d4af37"; // Golden rim
  context.lineWidth = 2;
  context.stroke();

  context.strokeStyle = "rgba(255,255,255,0.2)";
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(0, -12, 31, 9, 0, 0, Math.PI * 2);
  context.stroke();

  // Table legs
  context.fillStyle = "#3d2716";
  context.fillRect(-22, -8, 5, 12);
  context.fillRect(17, -8, 5, 12);

  // Cards and chips on table
  context.fillStyle = "#ffffff";
  context.fillRect(-10, -18, 7, 10);
  context.fillRect(-1, -18, 7, 10);
  context.fillStyle = "#d4af37";
  context.beginPath();
  context.arc(14, -14, 3.5, 0, Math.PI * 2);
  context.arc(17, -15, 3.5, 0, Math.PI * 2);
  context.fill();

  // Dealer NPC behind table
  // Vest & tie
  context.fillStyle = "#111111";
  context.fillRect(-8, -35, 16, 18);
  context.fillStyle = "#ffffff";
  context.fillRect(-3, -33, 6, 12);
  context.fillStyle = "#cc0000"; // Red bowtie
  context.fillRect(-2, -34, 4, 3);
  // Head
  context.fillStyle = "#f5cdab";
  context.beginPath();
  context.arc(0, -42, 6.5, 0, Math.PI * 2);
  context.fill();
  // Hair
  context.fillStyle = "#2b2118";
  context.beginPath();
  context.arc(0, -45, 6, Math.PI, Math.PI * 2);
  context.fill();

  // Casino Sign above
  context.fillStyle = "#1b1429";
  context.roundRect(-30, -68, 60, 16, 4);
  context.fill();
  context.strokeStyle = "#f5c95c";
  context.lineWidth = 1.5;
  context.stroke();
  context.fillStyle = "#f5c95c";
  context.font = "bold 8.5px sans-serif";
  context.textAlign = "center";
  context.fillText("♠ КАЗИНО 21 ♦", 0, -56);

  // Warm entrance lamps animate subtly with the island scene.
  for (const lampX of [-46, 46]) {
    context.fillStyle = "#4a2d1b";
    context.fillRect(lampX - 2, -43, 4, 24);
    context.fillStyle = "#ffd36a";
    context.beginPath();
    context.arc(lampX, -47, 5 + Math.sin(time * 3) * 0.5, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawWeatherOverlay(context, width, height, conditions, time, weather, waterLine) {
  context.save();
  const isRaining = weather?.isRaining() || conditions.weather === "rain";

  if (conditions.isNight) {
    context.fillStyle = "rgba(4, 10, 30, 0.34)";
    context.fillRect(0, 0, width, height * 0.58);
  }

  if (isRaining) {
    // Darkened stormy sky
    context.fillStyle = "rgba(10, 24, 38, 0.36)";
    context.fillRect(0, 0, width, height);

    // Falling raindrops
    context.strokeStyle = "rgba(195, 235, 255, 0.52)";
    context.lineWidth = 1.3;

    const drops = weather?.drops ?? [];
    for (const drop of drops) {
      drop.y += drop.speed * 0.016;
      drop.x -= 0.003;
      if (drop.y > 1) {
        drop.y = 0;
        drop.x = Math.random();
      }
      if (drop.x < 0) drop.x = 1;

      const sx = drop.x * width;
      const sy = drop.y * height;
      context.beginPath();
      context.moveTo(sx, sy);
      context.lineTo(sx - 4, sy + drop.length);
      context.stroke();

      // Ripple when hitting water line
      if (Math.abs(sy - waterLine) < 8) {
        context.strokeStyle = "rgba(255, 255, 255, 0.35)";
        context.beginPath();
        context.ellipse(sx, waterLine + (drop.y % 0.04) * height, 6, 2, 0, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = "rgba(195, 235, 255, 0.52)";
      }
    }
  }

  context.restore();
}

function getRodTip(width, height, waterLine, time, mode = "idle", move = movement) {
  const dockY = waterLine + height * 0.13;
  const playerX = (move?.xRatio ?? 0.28) * width;
  const bob = move?.isWalking ? Math.abs(Math.sin((move.walkCycle ?? 0) * 14)) * 3 : Math.sin(time * 1.5) * 1.2;
  const playerY = dockY - 26 + bob;
  const facing = move?.facing ?? 1;

  const bend = mode === "reeling" ? 12 + Math.sin(time * 9) * 3 : mode === "bite" ? 7 + Math.sin(time * 16) * 3 : 0;
  const tipX = playerX + facing * Math.min(width * 0.08, 72);
  const tipY = playerY - Math.min(height * 0.10, 56) + bend;
  return { x: tipX, y: tipY, playerX, playerY };
}

// Detailed animated fisherman sprite with hat, hook, face, beard, vest, waders, and boots
function drawDetailedAngler(context, width, height, waterLine, palette, time, fishingState, move) {
  const mode = fishingState?.mode ?? "idle";
  const rodInfo = getRodTip(width, height, waterLine, time, mode, move);
  const playerX = rodInfo.playerX;
  const playerY = rodInfo.playerY;
  const facing = move.facing;
  const isWalking = move.isWalking;
  const walkSwing = isWalking ? Math.sin(move.walkCycle * 14) : 0;

  context.save();
  context.translate(playerX, playerY);
  context.scale(facing, 1);

  // --- LEGS & BOOTS ---
  const leftLegSwing = walkSwing * 12;
  const rightLegSwing = -walkSwing * 12;

  // Left Leg
  context.save();
  context.translate(-5, 14);
  context.rotate((leftLegSwing * Math.PI) / 180);
  context.fillStyle = "#2c3b2e"; // Dark olive waders
  context.fillRect(-4, 0, 8, 22);
  // Boot
  context.fillStyle = "#4a3220";
  context.fillRect(-5, 20, 11, 8);
  context.fillStyle = "#111111"; // Sole
  context.fillRect(-6, 26, 13, 3);
  context.restore();

  // Right Leg
  context.save();
  context.translate(5, 14);
  context.rotate((rightLegSwing * Math.PI) / 180);
  context.fillStyle = "#233125";
  context.fillRect(-4, 0, 8, 22);
  // Boot
  context.fillStyle = "#3e291a";
  context.fillRect(-5, 20, 11, 8);
  context.fillStyle = "#111111"; // Sole
  context.fillRect(-6, 26, 13, 3);
  context.restore();

  // --- TORSO & TACKLE VEST ---
  // Thermal undershirt
  context.fillStyle = "#bf4335";
  context.roundRect(-12, -14, 24, 28, 4);
  context.fill();

  // Fishing Tackle Vest (Olive khaki)
  context.fillStyle = "#55643e";
  context.beginPath();
  context.roundRect(-13, -13, 26, 26, 4);
  context.fill();

  // Brass zipper
  context.strokeStyle = "#d4af37";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, -12);
  context.lineTo(0, 11);
  context.stroke();

  // Vest front pockets
  context.fillStyle = "#434f31";
  context.fillRect(-10, -3, 8, 7);
  context.fillRect(2, -3, 8, 7);
  // Pocket flaps
  context.fillStyle = "#323c24";
  context.fillRect(-10, -5, 8, 3);
  context.fillRect(2, -5, 8, 3);

  // --- HEAD, FACE & BEARD ---
  // Neck
  context.fillStyle = "#e2b28c";
  context.fillRect(-3, -20, 6, 8);

  // Head base
  context.fillStyle = "#f1c29b";
  context.beginPath();
  context.arc(1, -27, 10.5, 0, Math.PI * 2);
  context.fill();

  // Eye
  context.fillStyle = "#1a1612";
  context.beginPath();
  context.arc(5, -28, 1.8, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(5.6, -28.4, 0.7, 0, Math.PI * 2);
  context.fill();

  // Rugged fisherman beard and mustache
  context.fillStyle = "#5c4331";
  context.beginPath();
  context.arc(2, -24, 8, 0, Math.PI * 0.85);
  context.fill();
  context.fillRect(2, -26, 6, 4); // Mustache

  // --- FISHERMAN HAT WITH HOOK ---
  // Hat dome
  context.fillStyle = "#d8b257";
  context.beginPath();
  context.ellipse(1, -36, 10, 8, 0, Math.PI, Math.PI * 2);
  context.fill();

  // Hat brim
  context.fillStyle = "#c19a41";
  context.beginPath();
  context.ellipse(1, -34, 15, 4, 0, 0, Math.PI * 2);
  context.fill();

  // Hat ribbon band
  context.fillStyle = "#2c2825";
  context.fillRect(-9, -38, 20, 3.5);

  // Metallic shiny fish hook pinned to the hat band!
  context.strokeStyle = "#e8eff2";
  context.lineWidth = 1.3;
  context.beginPath();
  context.arc(2, -36.5, 2.5, Math.PI * 0.5, Math.PI * 1.8);
  context.lineTo(4.5, -34);
  context.stroke();

  // --- ARMS & FISHING ROD ---
  // Arm holding the rod
  context.strokeStyle = "#434f31";
  context.lineWidth = 4.5;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(4, -6);
  context.lineTo(15, -4);
  context.stroke();

  // Hand
  context.fillStyle = "#f1c29b";
  context.beginPath();
  context.arc(16, -4, 3, 0, Math.PI * 2);
  context.fill();

  // Rod handle / cork grip
  context.strokeStyle = "#a97d52";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(11, 2);
  context.lineTo(19, -10);
  context.stroke();

  // Reel spool
  context.fillStyle = "#2f383d";
  context.beginPath();
  context.arc(16, -4, 4, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#ffffff";
  context.lineWidth = 0.8;
  context.stroke();

  // Rod blank / shaft
  const tipRelX = (rodInfo.x - playerX) * facing;
  const tipRelY = rodInfo.y - playerY;
  const ctrlX = 18 + (tipRelX - 18) * 0.45;
  const ctrlY = -10 + (tipRelY - -10) * 0.92;

  context.strokeStyle = "#382315";
  context.lineWidth = 2.4;
  context.beginPath();
  context.moveTo(18, -10);
  context.quadraticCurveTo(ctrlX, ctrlY, tipRelX, tipRelY);
  context.stroke();

  // Rod tip ring
  context.strokeStyle = "#ffffff";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(tipRelX, tipRelY, 2, 0, Math.PI * 2);
  context.stroke();

  context.restore();
}

function drawFishingLine(context, width, height, waterLine, time, fishingState, move) {
  const bobber = fishingState.bobber;
  if (!bobber) {
    return;
  }

  const rodTip = getRodTip(width, height, waterLine, time, fishingState.mode, move);
  const bobberPoint = { x: bobber.x * width, y: bobber.y * height };

  context.save();
  context.strokeStyle = "rgba(246, 247, 242, 0.75)";
  context.lineWidth = 1.3;
  context.beginPath();
  context.moveTo(rodTip.x, rodTip.y);

  if (fishingState.mode === "casting" && fishingState.cast) {
    const midX = (rodTip.x + bobberPoint.x) / 2;
    const midY = Math.min(rodTip.y, bobberPoint.y) - height * 0.08;
    context.quadraticCurveTo(midX, midY, bobberPoint.x, bobberPoint.y);
  } else {
    context.lineTo(bobberPoint.x, bobberPoint.y);
  }
  context.stroke();

  drawBobber(context, bobberPoint.x, bobberPoint.y, fishingState.mode);
  context.restore();
}

function drawBobber(context, x, y, mode) {
  context.save();
  const scale = mode === "bite" ? 1.25 : 1;
  context.translate(x, y);
  context.scale(scale, scale);
  context.shadowColor = mode === "bite" ? "rgba(255, 125, 103, 0.8)" : "rgba(0, 0, 0, 0.35)";
  context.shadowBlur = mode === "bite" ? 22 : 10;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(0, -6, 7, Math.PI, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ff6048";
  context.beginPath();
  context.arc(0, -6, 7, 0, Math.PI);
  context.fill();
  context.fillStyle = "#151515";
  context.fillRect(-1, -17, 2, 10);
  context.restore();
}

function drawEffects(context, width, height, effects, rodTip) {
  context.save();
  for (const effect of effects) {
    if (effect.type === "splash") {
      drawSplashEffect(context, width, height, effect);
    } else if (effect.type === "fish_leap") {
      drawFishLeapEffect(context, width, height, effect, rodTip);
    }
  }
  context.restore();
}

function drawSplashEffect(context, width, height, effect) {
  const progress = effect.age / effect.life;
  const x = effect.x * width;
  const y = effect.y * height;
  const radius = (10 + progress * 42) * effect.scale;
  context.globalAlpha = Math.max(0, 1 - progress);
  context.strokeStyle = "rgba(255,255,255,0.78)";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(x, y, radius, radius * 0.28, 0, 0, Math.PI * 2);
  context.stroke();

  for (let i = 0; i < 7; i += 1) {
    const angle = (Math.PI * 2 * i) / 7;
    const dropX = x + Math.cos(angle) * radius * 0.45;
    const dropY = y + Math.sin(angle) * radius * 0.18 - progress * 24;
    context.fillStyle = "rgba(255,255,255,0.65)";
    context.beginPath();
    context.arc(dropX, dropY, Math.max(1, 3 - progress * 2), 0, Math.PI * 2);
    context.fill();
  }
}

function drawFishLeapEffect(context, width, height, effect, rodTip) {
  const progress = Math.min(effect.age / effect.life, 1);
  const startX = effect.startX * width;
  const startY = effect.startY * height;
  const targetX = rodTip ? rodTip.x : startX - 80;
  const targetY = rodTip ? rodTip.y : startY - 60;

  const currentX = startX + (targetX - startX) * progress;
  const arcY = Math.sin(progress * Math.PI) * Math.min(height * 0.24, 160);
  const currentY = startY + (targetY - startY) * progress - arcY;

  const dx = targetX - startX;
  const dy = targetY - startY - Math.cos(progress * Math.PI) * Math.min(height * 0.24, 160) * Math.PI;
  const angle = Math.atan2(dy, dx);

  if (rodTip) {
    context.save();
    context.strokeStyle = "rgba(255, 255, 255, 0.55)";
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(rodTip.x, rodTip.y);
    context.lineTo(currentX, currentY);
    context.stroke();
    context.restore();
  }

  context.save();
  context.translate(currentX, currentY);
  context.rotate(angle);
  const colors = effect.catchItem?.colors ?? ["#78d27d", "#2b7188"];
  const gradient = context.createLinearGradient(-26, -10, 26, 10);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);

  context.fillStyle = colors[1];
  context.beginPath();
  context.moveTo(-20, 0);
  context.lineTo(-38, -11);
  context.lineTo(-34, 11);
  context.closePath();
  context.fill();

  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(0, 0, 24, 10, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(14, -3, 2.8, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#111111";
  context.beginPath();
  context.arc(14.5, -3, 1.4, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function drawWaterTension(context, width, height, fishingState) {
  const bobber = fishingState.bobber;
  const reel = fishingState.reel;

  if (!bobber || !reel) {
    return;
  }

  const x = bobber.x * width;
  const y = bobber.y * height;
  context.save();
  context.strokeStyle = reel.inside ? "rgba(120, 210, 125, 0.8)" : "rgba(255, 125, 103, 0.9)";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x, y, 28 + Math.sin(reel.elapsed * 9) * 4, 0.2, Math.PI * 1.45);
  context.stroke();
  context.beginPath();
  context.arc(x, y, 48 + Math.cos(reel.elapsed * 7) * 5, Math.PI * 0.15, Math.PI * 1.2);
  context.stroke();
  context.restore();
}

function drawFishShapes(context, width, height, waterLine, locationId, time) {
  const localFish = getFishByLocation(locationId);
  const count = Math.min(localFish.length, width < 720 ? 4 : 7);
  const swimmers = getFishSchool(locationId, count, localFish);

  context.save();
  for (let i = 0; i < count; i += 1) {
    const swimmer = swimmers[i];
    const fish = swimmer.fish;
    const direction = swimmer.direction;
    const swim = (time * swimmer.speed + swimmer.phase) % 1;
    const x = direction > 0 ? swim * (width + 180) - 90 : width - (swim * (width + 180) - 90);
    const y = waterLine + 58 + swimmer.lane * ((height - waterLine - 100) / Math.max(1, count + 1));
    const rarity = RARITY_META[fish.rarity] ?? RARITY_META.Common;
    const scale = 0.55 + rarity.difficulty * 0.35 + (i % 3) * 0.08;
    const model = getFishRenderModel(fish, { seed: `${locationId}-${fish.id}-${i}` });

    drawFishPrimitive(context, x, y + Math.sin(time * swimmer.bob + i) * 7, scale, model, direction);
  }
  context.restore();
}

function getFishByLocation(locationId) {
  if (!fishByLocationCache.has(locationId)) {
    fishByLocationCache.set(
      locationId,
      fishDatabase.filter((fish) => fish.locations.includes(locationId)),
    );
  }

  return fishByLocationCache.get(locationId);
}

function getFishSchool(locationId, count, localFish) {
  let pool = fishSchoolPools.get(locationId);

  if (!pool) {
    pool = [];
    fishSchoolPools.set(locationId, pool);
  }

  while (pool.length < count) {
    const i = pool.length;
    pool.push({
      fish: localFish[i % localFish.length],
      lane: i + 1,
      direction: i % 2 === 0 ? 1 : -1,
      speed: 0.018 + i * 0.004,
      phase: i * 0.19,
      bob: 1.25 + i * 0.08,
    });
  }

  if (pool.length > count) {
    pool.length = count;
  }

  return pool;
}

function drawFishPrimitive(context, x, y, scale, model, direction) {
  context.save();
  context.translate(x, y);
  context.scale(direction * scale, scale);
  context.globalAlpha = 0.38;
  const colors = model.colors;
  const gradient = context.createLinearGradient(-34, -12, 36, 12);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  context.fillStyle = gradient;

  if (model.archetype === "eel") {
    context.lineWidth = 13 * model.params.body.width;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-46, 4);
    context.quadraticCurveTo(-18, -14, 8, 0);
    context.quadraticCurveTo(28, 12, 48, -1);
    context.strokeStyle = gradient;
    context.stroke();
  } else if (model.archetype === "flat") {
    context.beginPath();
    context.moveTo(-42, 0);
    context.quadraticCurveTo(-4, -28, 42, 0);
    context.quadraticCurveTo(-4, 28, -42, 0);
    context.fill();
  } else {
    const bodyX = 36 * model.params.body.length;
    const bodyY = 15 * model.params.body.width;
    context.beginPath();
    context.ellipse(0, 0, bodyX, bodyY, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(-bodyX + 3, 0);
    context.lineTo(-bodyX - 24 * model.params.fins.tail, -14 * model.params.fins.tail);
    context.lineTo(-bodyX - 20 * model.params.fins.tail, 14 * model.params.fins.tail);
    context.closePath();
    context.fill();
  }

  context.fillStyle = "rgba(255,255,255,0.75)";
  context.beginPath();
  context.arc(24, -4, 3, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function withAlpha(hex, alpha) {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function createAudioBus() {
  let context = null;

  function unlock() {
    context ??= new AudioContext();

    if (context.state === "suspended") {
      context.resume();
    }
  }

  function play(type) {
    unlock();

    const now = context.currentTime;
    if (type === "cast") {
      playTone(now, 260, 0.08, "sine", 0.045);
      playTone(now + 0.06, 170, 0.12, "triangle", 0.035);
    } else if (type === "bite") {
      playTone(now, 580, 0.07, "square", 0.035);
      playTone(now + 0.08, 760, 0.09, "sine", 0.04);
    } else if (type === "hook") {
      playTone(now, 220, 0.1, "sawtooth", 0.03);
    } else if (type === "success") {
      playTone(now, 420, 0.08, "sine", 0.04);
      playTone(now + 0.09, 620, 0.1, "triangle", 0.04);
      playTone(now + 0.2, 840, 0.12, "sine", 0.04);
    } else if (type === "miss") {
      playTone(now, 150, 0.14, "triangle", 0.035);
    } else if (type === "card") {
      playTone(now, 800, 0.03, "sine", 0.02);
      playTone(now + 0.02, 500, 0.04, "triangle", 0.015);
    } else if (type === "rain_start") {
      playTone(now, 110, 0.5, "sawtooth", 0.025);
    }
  }

  function playTone(startTime, frequency, duration, type, volume) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  }

  return { unlock, play };
}
