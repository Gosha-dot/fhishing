import { fishDatabase, RARITY_META } from "./fishDatabase.js";
import { FishingController } from "./fishing.js";
import { getFishRenderModel } from "./fishArchetypes.js";
import { createPlayerStore } from "./player.js";
import { UIController } from "./ui.js";

// Main entry point: owns the canvas loop, audio bus, and cross-module wiring.
const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const playerStore = createPlayerStore();
const audioBus = createAudioBus();
let soundEnabled = true;
const fishSchoolPools = new Map();
const fishByLocationCache = new Map();

const ui = new UIController({ playerStore });
const fishing = new FishingController({
  playerStore,
  onCatch(catchItem) {
    const levelResult = playerStore.addCatch(catchItem);
    ui.showCatchResult(catchItem, levelResult);
  },
  onMiss(message) {
    ui.showToast(message);
  },
  playSound(type) {
    if (soundEnabled) {
      audioBus.play(type);
    }
  },
});

ui.bindHandlers({
  primaryDown() {
    audioBus.unlock();
    fishing.pressPrimary();
  },
  primaryUp() {
    fishing.releasePrimary();
  },
  sellAll() {
    const result = playerStore.sellAll();
    ui.showToast(result.message);
  },
  sellCatch(catchId) {
    const result = playerStore.sellCatch(catchId);
    ui.showToast(result.message);
  },
  sellAllNpc() {
    const result = playerStore.sellAllWithBonus(15);
    ui.showToast(result.message);
  },
  sellCatchNpc(catchId) {
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
});

ui.setSoundEnabled(soundEnabled);
requestAnimationFrame(frame);

let previousTime = performance.now();

function frame(now) {
  const dt = (now - previousTime) / 1000;
  previousTime = now;

  fishing.update(dt);
  const player = playerStore.snapshot();
  const fishingState = fishing.getSnapshot();
  drawScene(ctx, canvas, player, fishingState, now / 1000);
  ui.render(player, fishingState);

  requestAnimationFrame(frame);
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

function drawScene(context, targetCanvas, player, fishingState, time) {
  const { width, height } = resizeCanvas(targetCanvas, context);
  const location = player.currentLocationData;
  const palette = location.palette;
  const waterLine = height * 0.56;

  drawSky(context, width, height, palette, location.id, time);
  drawFarShore(context, width, height, waterLine, palette, location.id, time);
  drawWater(context, width, height, waterLine, palette, location.id, time);
  drawFishShapes(context, width, height, waterLine, player.currentLocation, time);
  drawDockAndAngler(context, width, height, waterLine, palette, time, fishingState);
  drawFishingLine(context, width, height, waterLine, time, fishingState);
  const rodTip = getRodTip(width, height, waterLine, time, fishingState.mode);
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

  if (locationId === "river") {
    context.fillStyle = "rgba(255, 148, 91, 0.22)";
    context.fillRect(0, waterLine - height * 0.05, width, height * 0.035);
  }

  if (locationId === "abyss") {
    context.fillStyle = "rgba(183, 152, 255, 0.2)";
    for (let i = 0; i < 18; i += 1) {
      const x = ((i * 97 + time * 12) % (width + 80)) - 40;
      const y = waterLine - height * 0.12 + Math.sin(i + time) * 24;
      context.fillRect(x, y, 3, 16 + (i % 3) * 8);
    }
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

  context.globalAlpha = locationId === "abyss" ? 0.18 : 0.12;
  context.fillStyle = "#ffffff";
  for (let i = 0; i < 70; i += 1) {
    const x = (i * 83 + time * 18 * ((i % 3) + 1)) % width;
    const y = waterLine + ((i * 47 + time * 11) % (height - waterLine));
    context.fillRect(x, y, 2, 2);
  }

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
    context.strokeStyle = colors[1];
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-42, 0);
    context.lineTo(-62, 3);
    context.stroke();
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

function getRodTip(width, height, waterLine, time, mode = "idle") {
  const dockY = waterLine + height * 0.13;
  const playerX = width * 0.15;
  const playerY = dockY - 28 + Math.sin(time * 1.5) * 1.5;
  const bend = mode === "reeling" ? 10 + Math.sin(time * 9) * 3 : mode === "bite" ? 6 + Math.sin(time * 16) * 3 : 0;
  const tipX = playerX + Math.min(width * 0.08, 75);
  const tipY = playerY - Math.min(height * 0.10, 58) + bend;
  return { x: tipX, y: tipY, playerX, playerY };
}

function drawDockAndAngler(context, width, height, waterLine, palette, time, fishingState) {
  const dockY = waterLine + height * 0.13;
  const dockEndX = width * 0.24;

  context.save();
  context.fillStyle = "#4a3027";
  context.fillRect(0, dockY, dockEndX, 18);
  context.fillStyle = "#6f4939";
  for (let x = 0; x < dockEndX; x += 38) {
    context.fillRect(x, dockY - 4, 30, 10);
  }

  context.fillStyle = "#2f211c";
  for (let x = 26; x < dockEndX; x += 74) {
    context.fillRect(x, dockY - 8, 12, height * 0.2);
  }

  const mode = fishingState?.mode ?? "idle";
  const rodInfo = getRodTip(width, height, waterLine, time, mode);
  const playerX = rodInfo.playerX;
  const playerY = rodInfo.playerY;

  // Legs
  context.strokeStyle = "#151715";
  context.lineWidth = 8;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(playerX, playerY + 20);
  context.lineTo(playerX - 18, playerY + 42);
  context.moveTo(playerX + 4, playerY + 22);
  context.lineTo(playerX + 23, playerY + 42);
  context.stroke();

  // Torso
  context.fillStyle = palette.accent;
  context.beginPath();
  context.roundRect(playerX - 15, playerY - 18, 30, 42, 8);
  context.fill();

  // Head
  context.fillStyle = "#1c1712";
  context.beginPath();
  context.arc(playerX, playerY - 31, 13, 0, Math.PI * 2);
  context.fill();

  // Arm holding rod (compact, natural grip)
  context.strokeStyle = "#2b1b13";
  context.lineWidth = 3.8;
  context.beginPath();
  context.moveTo(playerX + 9, playerY - 7);
  context.lineTo(playerX + 24, playerY - 18);
  context.stroke();

  // Rod handle / grip
  context.strokeStyle = "#1b140f";
  context.lineWidth = 3.5;
  context.beginPath();
  context.moveTo(playerX + 17, playerY - 11);
  context.lineTo(playerX + 26, playerY - 20);
  context.stroke();

  // Reel spool
  context.fillStyle = "#3a4044";
  context.beginPath();
  context.arc(playerX + 21, playerY - 14, 3.5, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,0.4)";
  context.lineWidth = 1;
  context.stroke();

  // Rod shaft (curved, tapered, smaller)
  const tipX = rodInfo.x;
  const tipY = rodInfo.y;
  const ctrlX = playerX + (tipX - playerX) * 0.42;
  const ctrlY = playerY - (playerY - tipY) * 0.96;

  context.strokeStyle = "#382315";
  context.lineWidth = 2.4;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(playerX + 25, playerY - 19);
  context.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
  context.stroke();

  // Tip ring
  context.strokeStyle = "#d8e1d2";
  context.lineWidth = 1.4;
  context.beginPath();
  context.arc(tipX, tipY, 1.8, 0, Math.PI * 2);
  context.stroke();

  context.restore();
}

function drawFishingLine(context, width, height, waterLine, time, fishingState) {
  const bobber = fishingState.bobber;
  if (!bobber) {
    return;
  }

  const rodTip = getRodTip(width, height, waterLine, time, fishingState.mode);
  const bobberPoint = { x: bobber.x * width, y: bobber.y * height };

  context.save();
  context.strokeStyle = "rgba(246, 247, 242, 0.72)";
  context.lineWidth = 1.4;
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
  const scale = mode === "bite" ? 1.24 : 1;
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
  const targetX = effect.targetX * width;
  const targetY = effect.targetY * height;

  const currentX = startX + (targetX - startX) * progress;
  const arcY = Math.sin(progress * Math.PI) * Math.min(height * 0.24, 160);
  const currentY = startY + (targetY - startY) * progress - arcY;

  // Tangent trajectory angle
  const dx = targetX - startX;
  const dy = targetY - startY - Math.cos(progress * Math.PI) * Math.min(height * 0.24, 160) * Math.PI;
  const angle = Math.atan2(dy, dx);

  // Line pulling toward rod tip
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

  // Water droplets behind the leaping fish
  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.72)";
  for (let i = 0; i < 4; i += 1) {
    const dropLag = (i + 1) * 0.04;
    const trailT = Math.max(0, progress - dropLag);
    const tx = startX + (targetX - startX) * trailT + Math.sin(effect.age * 20 + i) * 5;
    const ty = startY + (targetY - startY) * trailT - Math.sin(trailT * Math.PI) * Math.min(height * 0.24, 160) + i * 4;
    context.beginPath();
    context.arc(tx, ty, Math.max(1, 3 - i * 0.5), 0, Math.PI * 2);
    context.fill();
  }

  // Draw leaping fish sprite
  context.translate(currentX, currentY);
  context.rotate(angle);
  const colors = effect.catchItem?.colors ?? ["#78d27d", "#2b7188"];
  const gradient = context.createLinearGradient(-26, -10, 26, 10);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);

  // Tail
  context.fillStyle = colors[1];
  context.beginPath();
  context.moveTo(-20, 0);
  context.lineTo(-38, -11);
  context.lineTo(-34, 11);
  context.closePath();
  context.fill();

  // Body
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(0, 0, 24, 10, 0, 0, Math.PI * 2);
  context.fill();

  // Eye
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
