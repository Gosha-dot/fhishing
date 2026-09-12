import {
  createCatch,
  getCastZone,
  getCatchDifficulty,
  getWorldConditions,
  rollFish,
} from "./fishDatabase.js";
import { getFishArchetype } from "./fishArchetypes.js";

// Runs the playable loop without exposing catch internals on window. The UI only
// gets a sanitized snapshot for drawing and meter updates.
export class FishingController {
  constructor({ playerStore, onCatch, onMiss, playSound }) {
    this.playerStore = playerStore;
    this.onCatch = onCatch;
    this.onMiss = onMiss;
    this.playSound = playSound;
    this.effects = [];
    this.abilityCooldown = 0;
    this.resetToIdle("Ready at the dock");
  }

  pressPrimary() {
    if (this.mode === "idle") {
      this.mode = "charging";
      this.charge = { value: 0.08, direction: 1 };
      this.status = "Cast power rising";
      return;
    }

    if (this.mode === "bite") {
      this.startReeling();
      this.reelHeld = true;
      return;
    }

    if (this.mode === "reeling") {
      this.reelHeld = true;
    }
  }

  releasePrimary() {
    if (this.mode === "charging") {
      this.finishCast();
      return;
    }

    if (this.mode === "reeling") {
      this.reelHeld = false;
    }
  }

  pressAbility() {
    if (this.mode !== "reeling" || this.abilityCooldown > 0 || !this.reel) return false;
    const ability = this.playerStore.snapshot().selectedRodData.ability;
    if (!ability) return false;

    if (ability.id === "sonar-pulse") {
      this.reel.targetCenter = this.reel.indicator;
      this.reel.line = clamp(this.reel.line + 0.18, 0, 1);
      this.reel.sonar = 1.8;
    } else if (ability.id === "line-stabilizer") {
      this.reel.stabilized = 3.5;
    } else if (ability.id === "quick-hook") {
      this.reel.progress = clamp(this.reel.progress + 0.16, 0, 1);
    }

    this.abilityCooldown = 8;
    this.status = `${ability.name} active`;
    return true;
  }

  update(dt) {
    const safeDt = Math.min(dt, 0.06);
    this.abilityCooldown = Math.max(0, this.abilityCooldown - safeDt);
    this.effects = this.effects
      .map((effect) => ({ ...effect, age: effect.age + safeDt }))
      .filter((effect) => effect.age < effect.life);

    if (this.mode === "charging") {
      this.updateCharging(safeDt);
    } else if (this.mode === "casting") {
      this.updateCasting(safeDt);
    } else if (this.mode === "waiting") {
      this.updateWaiting(safeDt);
    } else if (this.mode === "bite") {
      this.updateBite(safeDt);
    } else if (this.mode === "reeling") {
      this.updateReeling(safeDt);
    }
  }

  getSnapshot() {
    return {
      mode: this.mode,
      status: this.status,
      charge: this.charge?.value ?? 0,
      cast: this.cast ? clone(this.cast) : null,
      bobber: this.bobber ? clone(this.bobber) : null,
      wait: this.wait ? clone(this.wait) : null,
      bite: this.bite ? clone(this.bite) : null,
      reel: this.reel ? clone(this.reel) : null,
      abilityCooldown: this.abilityCooldown,
      effects: this.effects.map((effect) => ({ ...effect })),
    };
  }

  updateCharging(dt) {
    const charge = this.charge;
    charge.value += charge.direction * dt * 0.86;

    if (charge.value >= 1) {
      charge.value = 1;
      charge.direction = -1;
    } else if (charge.value <= 0.08) {
      charge.value = 0.08;
      charge.direction = 1;
    }
  }

  finishCast() {
    const player = this.playerStore.snapshot();
    const rod = player.selectedRodData;
    const rawPower = this.charge?.value ?? 0.35;
    const effectivePower = clamp(rawPower * rod.castMultiplier, 0.08, 1);
    const zone = getCastZone(effectivePower);
    const start = { x: 0.16, y: 0.56 };
    const target = {
      x: clamp(0.3 + effectivePower * 0.58 + randomBetween(-0.012, 0.012), 0.31, 0.91),
      y: randomBetween(0.63, 0.71),
    };

    this.mode = "casting";
    this.status = `Casting toward ${zone.name}`;
    this.cast = {
      t: 0,
      duration: 0.7 + (1 - effectivePower) * 0.18,
      rawPower,
      effectivePower,
      zoneId: zone.id,
      zoneName: zone.name,
      start,
      target,
    };
    this.bobber = { ...start, restY: target.y, pulse: 0 };
    this.charge = null;
    this.playSound?.("cast");
  }

  updateCasting(dt) {
    this.cast.t += dt / this.cast.duration;
    const t = clamp(this.cast.t, 0, 1);
    const eased = easeOutCubic(t);
    const arc = Math.sin(t * Math.PI) * 0.18;
    this.bobber.x = lerp(this.cast.start.x, this.cast.target.x, eased);
    this.bobber.y = lerp(this.cast.start.y, this.cast.target.y, eased) - arc;

    if (t >= 1) {
      this.bobber = {
        x: this.cast.target.x,
        y: this.cast.target.y,
        restY: this.cast.target.y,
        pulse: 0,
      };
      this.spawnSplash(this.bobber.x, this.bobber.y, 0.75);
      this.startWaiting();
    }
  }

  startWaiting() {
    const player = this.playerStore.snapshot();
    const bait = player.selectedBaitData;
    const location = player.currentLocationData;
    const depthPenalty = this.cast.zoneId === "deep" ? 1.4 : this.cast.zoneId === "far" ? 0.7 : 0;
    const delay = (randomBetween(3, 11.5) + depthPenalty) / (bait.biteMultiplier * location.biteTempo);

    this.mode = "waiting";
    this.status = `${this.cast.zoneName} is quiet`;
    this.wait = {
      remaining: delay,
      total: delay,
      zoneId: this.cast.zoneId,
      zoneName: this.cast.zoneName,
    };
  }

  updateWaiting(dt) {
    this.wait.remaining -= dt;
    this.bobber.pulse += dt;
    this.bobber.y = this.bobber.restY + Math.sin(this.bobber.pulse * 3.2) * 0.004;

    if (this.wait.remaining <= 0) {
      this.startBite();
    }
  }

  startBite() {
    const player = this.playerStore.snapshot();
    const fish = rollFish({
      locationId: player.currentLocation,
      zoneId: this.wait.zoneId,
      luckBonus: player.selectedBaitData.luckBonus,
      conditions: player.conditions,
      rarityFilter: player.cheatLuck ? ["Legendary", "Mythical"] : null,
    });

    this.pendingCatch = createCatch(fish, {
      locationId: player.currentLocation,
      zoneId: this.wait.zoneId,
    });
    this.mode = "bite";
    this.status = "Bite on the line";
    const biteTime = player.selectedRodData.ability?.id === "quick-hook" ? 4.4 : 3.2;
    this.bite = {
      remaining: biteTime,
      total: biteTime,
      pulse: 0,
    };
    this.wait = null;
    this.spawnSplash(this.bobber.x, this.bobber.y, 1.15);
    this.playSound?.("bite");
  }

  updateBite(dt) {
    this.bite.remaining -= dt;
    this.bite.pulse += dt;
    this.bobber.y =
      this.bobber.restY + Math.sin(this.bite.pulse * 18) * 0.013 + Math.sin(this.bite.pulse * 7) * 0.008;

    if (this.bite.remaining <= 0) {
      this.playSound?.("miss");
      this.onMiss?.("The bite slipped away.");
      this.resetToIdle("Ready at the dock");
    }
  }

  startReeling() {
    if (!this.pendingCatch) {
      this.resetToIdle("Ready at the dock");
      return;
    }

    const player = this.playerStore.snapshot();
    const rod = player.selectedRodData;
    const difficulty = getCatchDifficulty(this.pendingCatch);
    const archetype = getFishArchetype(this.pendingCatch);
    const greenSize = clamp(0.34 + rod.zoneBonus - difficulty * 0.12, 0.16, 0.39);

    this.mode = "reeling";
    this.status = "Reeling";
    this.bite = null;
    this.reelHeld = false;
    this.reel = {
      indicator: randomBetween(0.36, 0.55),
      zoneCenter: 0.5,
      targetCenter: randomBetween(0.32, 0.68),
      greenSize,
      progress: 0,
      line: 1,
      elapsed: 0,
      changeTimer: 0,
      difficulty,
      archetype,
      stabilized: 0,
      sonar: 0,
      zoneSpeed: 0.18 + difficulty * 0.34,
      progressRate: 0.22 * rod.reelSpeed,
      lineDrain: (0.12 + difficulty * 0.12) / rod.lineStrength,
      inside: true,
    };
    this.playSound?.("hook");
  }

  updateReeling(dt) {
    const reel = this.reel;
    reel.elapsed += dt;
    reel.changeTimer -= dt;
    reel.stabilized = Math.max(0, reel.stabilized - dt);
    reel.sonar = Math.max(0, reel.sonar - dt);

    if (reel.changeTimer <= 0) {
      const half = reel.greenSize / 2;
      reel.targetCenter = randomBetween(half + 0.06, 1 - half - 0.06);
      reel.changeTimer = randomBetween(0.55, 1.15);
    }

    reel.zoneCenter = approach(reel.zoneCenter, reel.targetCenter, reel.zoneSpeed * dt);

    const twitch = Math.sin(reel.elapsed * (3.7 + reel.difficulty * 2.8)) * 0.14 * reel.difficulty;
    const eelJolt = reel.archetype === "eel" ? Math.sin(reel.elapsed * 18) * 0.18 : 0;
    const flatPull = reel.archetype === "flat" ? -0.16 : 0;
    const torpedoDash = reel.archetype === "torpedo" ? Math.sin(reel.elapsed * 5.5) * 0.24 : 0;
    const fishJolt = twitch + eelJolt + flatPull + torpedoDash;
    const playerPull = this.reelHeld ? 0.62 + reel.progressRate * 0.18 : -0.52 - reel.difficulty * 0.08;
    reel.indicator = clamp(reel.indicator + (playerPull + fishJolt) * dt, 0.02, 0.98);

    const half = reel.greenSize / 2;
    reel.inside = reel.indicator >= reel.zoneCenter - half && reel.indicator <= reel.zoneCenter + half;

    if (reel.inside) {
      reel.progress = clamp(reel.progress + reel.progressRate * dt, 0, 1);
      reel.line = clamp(reel.line + 0.035 * dt, 0, 1);
    } else {
      reel.progress = clamp(reel.progress - (0.08 + reel.difficulty * 0.04) * dt, 0, 1);
      const stabilizerScale = reel.stabilized > 0 ? 0.35 : 1;
      reel.line = clamp(reel.line - reel.lineDrain * dt * stabilizerScale, 0, 1);
    }

    this.bobber.pulse += dt;
    this.bobber.y = this.bobber.restY + Math.sin(this.bobber.pulse * 9) * 0.008;

    if (reel.progress >= 1) {
      const catchItem = this.pendingCatch;
      this.spawnSplash(this.bobber.x, this.bobber.y, 1.35);
      this.spawnFishLeap(this.bobber.x, this.bobber.y, catchItem);
      this.playSound?.("success");
      this.onCatch?.(catchItem);
      this.resetToIdle("Ready at the dock");
      return;
    }

    if (reel.line <= 0) {
      this.playSound?.("miss");
      this.onMiss?.("The line snapped.");
      this.resetToIdle("Ready at the dock");
    }
  }

  resetToIdle(status) {
    this.mode = "idle";
    this.status = status;
    this.charge = null;
    this.cast = null;
    this.wait = null;
    this.bite = null;
    this.reel = null;
    this.reelHeld = false;
    this.bobber = null;
    this.pendingCatch = null;
  }

  spawnSplash(x, y, scale) {
    this.effects.push({
      type: "splash",
      x,
      y,
      scale,
      age: 0,
      life: 1.1,
    });
  }

  spawnFishLeap(x, y, catchItem) {
    this.effects.push({
      type: "fish_leap",
      startX: x,
      startY: y,
      targetX: 0.18,
      targetY: 0.52,
      catchItem,
      age: 0,
      life: 0.85,
    });
  }
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function approach(current, target, maxDelta) {
  const delta = target - current;

  if (Math.abs(delta) <= maxDelta) {
    return target;
  }

  return current + Math.sign(delta) * maxDelta;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
