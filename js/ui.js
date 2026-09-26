import { fishDatabase, getFishById, LOCATION_META, RARITY_META } from "./fishDatabase.js";
import { BAITS, BOATS, RODS } from "./shop.js";
import { ACHIEVEMENTS, DAILY_CHALLENGE, isLocationUnlocked, QUESTS, WEEKLY_CHALLENGE } from "./player.js";
import { getFishInventoryIcon, getFishSvg } from "./fishArt.js";

// DOM adapter for HUD, panels, modals, inventory, and input. Rendering is keyed
// so frequently updated meters do not rebuild large panels every frame.
export class UIController {
  constructor({ playerStore, blackjackGame, weatherSystem }) {
    this.playerStore = playerStore;
    this.blackjackGame = blackjackGame ?? null;
    this.weatherSystem = weatherSystem ?? null;
    this.renderKeys = new Map();
    this.resultTimer = null;
    this.soundEnabled = true;
    this.canSellAtMerchant = false;
    this.dom = {
      coinAmount: document.querySelector("#coinAmount"),
      levelBadge: document.querySelector("#levelBadge"),
      xpLabel: document.querySelector("#xpLabel"),
      xpBar: document.querySelector("#xpBar"),
      weatherBadge: document.querySelector("#weatherBadge"),
      weatherIcon: document.querySelector("#weatherIcon"),
      weatherName: document.querySelector("#weatherName"),
      weatherTimer: document.querySelector("#weatherTimer"),
      statusText: document.querySelector("#statusText"),
      rodName: document.querySelector("#rodName"),
      baitName: document.querySelector("#baitName"),
      worldConditions: document.querySelector("#worldConditions"),
      abilityButton: document.querySelector("#abilityButton"),
      locationTabs: document.querySelector("#locationTabs"),
      castMeter: document.querySelector("#castMeter"),
      castFill: document.querySelector("#castFill"),
      reelPanel: document.querySelector("#reelPanel"),
      reelZone: document.querySelector("#reelZone"),
      reelMarker: document.querySelector("#reelMarker"),
      reelProgress: document.querySelector("#reelProgress"),
      lineHealth: document.querySelector("#lineHealth"),
      lineLabel: document.querySelector("#lineLabel"),
      inventoryCount: document.querySelector("#inventoryCount"),
      inventoryList: document.querySelector("#inventoryList"),
      sellAllButton: document.querySelector("#sellAllButton"),
      primaryButton: document.querySelector("#primaryButton"),
      shopButton: document.querySelector("#shopButton"),
      dexButton: document.querySelector("#dexButton"),
      npcButton: document.querySelector("#npcButton"),
      blackjackButton: document.querySelector("#blackjackButton"),
      aquariumButton: document.querySelector("#aquariumButton"),
      journalButton: document.querySelector("#journalButton"),
      cheatButton: document.querySelector("#cheatButton"),
      shipButton: document.querySelector("#shipButton"),
      soundButton: document.querySelector("#soundButton"),
      themeButton: document.querySelector("#themeButton"),
      shopModal: document.querySelector("#shopModal"),
      dexModal: document.querySelector("#dexModal"),
      npcModal: document.querySelector("#npcModal"),
      blackjackModal: document.querySelector("#blackjackModal"),
      shipModal: document.querySelector("#shipModal"),
      shopContent: document.querySelector("#shopContent"),
      dexContent: document.querySelector("#dexContent"),
      npcContent: document.querySelector("#npcContent"),
      blackjackContent: document.querySelector("#blackjackContent"),
      aquariumModal: document.querySelector("#aquariumModal"),
      aquariumContent: document.querySelector("#aquariumContent"),
      journalModal: document.querySelector("#journalModal"),
      journalContent: document.querySelector("#journalContent"),
      cheatModal: document.querySelector("#cheatModal"),
      cheatOutput: document.querySelector("#cheatOutput"),
      cheatForm: document.querySelector("#cheatForm"),
      cheatInput: document.querySelector("#cheatInput"),
      shipContent: document.querySelector("#shipContent"),
      interactionPrompt: document.querySelector("#interactionPrompt"),
      walkLeftButton: document.querySelector("#walkLeftButton"),
      walkRightButton: document.querySelector("#walkRightButton"),
      resultToast: document.querySelector("#resultToast"),
      toastStack: document.querySelector("#toastStack"),
    };
  }

  bindHandlers(handlers) {
    this.dom.primaryButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.dom.primaryButton.setPointerCapture?.(event.pointerId);
      handlers.primaryDown();
    });

    this.dom.primaryButton.addEventListener("pointerup", (event) => {
      event.preventDefault();
      handlers.primaryUp();
    });

    this.dom.primaryButton.addEventListener("pointercancel", handlers.primaryUp);
    this.dom.primaryButton.addEventListener("lostpointercapture", handlers.primaryUp);

    document.addEventListener("keydown", (event) => {
      if (isTypingTarget(event.target)) return;

      if (event.code === "Backquote") {
        event.preventDefault();
        this.openModal("cheatModal");
      } else if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        handlers.primaryDown();
      } else if (event.code === "KeyA" || event.code === "ArrowLeft") {
        handlers.walkLeftDown?.();
      } else if (event.code === "KeyD" || event.code === "ArrowRight") {
        handlers.walkRightDown?.();
      } else if (event.code === "KeyE" || event.code === "Enter") {
        handlers.interactAction?.();
      } else if (event.code === "KeyQ") {
        handlers.ability?.();
      }
    });

    document.addEventListener("keyup", (event) => {
      if (isTypingTarget(event.target)) return;

      if (event.code === "Space") {
        event.preventDefault();
        handlers.primaryUp();
      } else if (event.code === "KeyA" || event.code === "ArrowLeft") {
        handlers.walkLeftUp?.();
      } else if (event.code === "KeyD" || event.code === "ArrowRight") {
        handlers.walkRightUp?.();
      }
    });

    this.dom.shopButton?.addEventListener("click", () => this.openModal("shopModal"));
    this.dom.dexButton?.addEventListener("click", () => this.openModal("dexModal"));
    this.dom.npcButton?.addEventListener("click", () => this.openModal("npcModal"));
    this.dom.aquariumButton?.addEventListener("click", () => this.openModal("aquariumModal"));
    this.dom.journalButton?.addEventListener("click", () => this.openModal("journalModal"));
    this.dom.cheatButton?.addEventListener("click", () => this.openModal("cheatModal"));
    this.dom.abilityButton?.addEventListener("click", () => handlers.ability?.());
    this.dom.shipButton?.addEventListener("click", () => this.openModal("shipModal"));
    this.dom.soundButton?.addEventListener("click", () => handlers.toggleSound());
    this.dom.themeButton?.addEventListener("click", () => handlers.setTheme?.(this.playerStore.snapshot().theme === "dark" ? "light" : "dark"));
    this.dom.journalContent?.addEventListener("click", (event) => {
      if (event.target.closest("[data-repair-rod]")) handlers.repairRod?.();
      if (event.target.closest("[data-theme-toggle]")) handlers.setTheme?.(this.playerStore.snapshot().theme === "dark" ? "light" : "dark");
    });
    this.dom.sellAllButton?.addEventListener("click", () => handlers.sellAll());

    if (this.dom.walkLeftButton) {
      this.dom.walkLeftButton.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        handlers.walkLeftDown?.();
      });
      this.dom.walkLeftButton.addEventListener("pointerup", (e) => {
        e.preventDefault();
        handlers.walkLeftUp?.();
      });
      this.dom.walkLeftButton.addEventListener("pointercancel", () => handlers.walkLeftUp?.());
    }

    if (this.dom.walkRightButton) {
      this.dom.walkRightButton.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        handlers.walkRightDown?.();
      });
      this.dom.walkRightButton.addEventListener("pointerup", (e) => {
        e.preventDefault();
        handlers.walkRightUp?.();
      });
      this.dom.walkRightButton.addEventListener("pointercancel", () => handlers.walkRightUp?.());
    }

    this.dom.interactionPrompt?.addEventListener("click", () => {
      handlers.interactAction?.();
    });

    this.dom.locationTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-location]");
      if (button) {
        handlers.setLocation(button.dataset.location);
      }
    });

    this.dom.inventoryList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sell-catch]");
      if (button) {
        handlers.sellCatch(button.dataset.sellCatch);
      }
    });

    this.dom.shopContent.addEventListener("click", (event) => {
      const button = event.target.closest("[data-shop-action]");
      if (button) {
        handlers.shopAction(button.dataset.shopAction, button.dataset.itemId);
      }
    });

    this.dom.npcContent?.addEventListener("click", (event) => {
      const sellAllBtn = event.target.closest("[data-npc-sell-all]");
      if (sellAllBtn) {
        handlers.sellAllNpc?.();
        return;
      }
      const sellItemBtn = event.target.closest("[data-npc-sell-catch]");
      if (sellItemBtn) {
        handlers.sellCatchNpc?.(sellItemBtn.dataset.npcSellCatch);
        return;
      }
      const questKeepBtn = event.target.closest("[data-keep-catch]");
      if (questKeepBtn) handlers.keepCatch?.(questKeepBtn.dataset.keepCatch);
    });

    this.dom.inventoryList.addEventListener("click", (event) => {
      const keepButton = event.target.closest("[data-keep-catch]");
      if (keepButton) handlers.keepCatch?.(keepButton.dataset.keepCatch);
    });

    this.dom.aquariumContent?.addEventListener("click", (event) => {
      const feedButton = event.target.closest("[data-feed-fish]");
      const displayButton = event.target.closest("[data-display-fish]");
      if (feedButton) handlers.feedFish?.(feedButton.dataset.feedFish);
      if (displayButton) handlers.toggleDisplayFish?.(displayButton.dataset.displayFish);
    });

    this.dom.journalContent?.addEventListener("click", (event) => {
      if (event.target.closest("[data-export-save]")) handlers.exportSave?.();
      if (event.target.closest("[data-import-save]")) this.saveImportInput?.click();
    });

    this.dom.cheatForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const command = this.dom.cheatInput.value.trim();
      if (!command) return;
      this.appendCheatLine(`> ${command}`);
      const result = handlers.cheatCommand?.(command);
      if (result?.message) this.appendCheatLine(result.message, result.ok ? "success" : "error");
      this.dom.cheatInput.value = "";
    });

    this.saveImportInput = document.createElement("input");
    this.saveImportInput.type = "file";
    this.saveImportInput.accept = "application/json,.json";
    this.saveImportInput.hidden = true;
    this.saveImportInput.addEventListener("change", () => {
      const file = this.saveImportInput.files?.[0];
      if (file) file.text().then((text) => handlers.importSave?.(text));
      this.saveImportInput.value = "";
    });
    document.body.append(this.saveImportInput);

    this.dom.shipContent?.addEventListener("click", (event) => {
      const sailBtn = event.target.closest("[data-sail-destination]");
      if (sailBtn) {
        const dest = sailBtn.dataset.sailDestination;
        const fare = Number(sailBtn.dataset.fare || 0);
        handlers.sailTo?.(dest, fare);
      }
    });

    this.dom.blackjackButton?.addEventListener("click", () => this.openModal("blackjackModal"));

    this.dom.blackjackContent?.addEventListener("click", (event) => {
      const chipBtn = event.target.closest("[data-bj-chip]");
      if (chipBtn) {
        const amt = Number(chipBtn.dataset.bjChip);
        const input = this.dom.blackjackContent.querySelector("#bjBetInput");
        if (input) input.value = amt;
        return;
      }

      if (event.target.closest("[data-bj-deal]")) {
        const input = this.dom.blackjackContent.querySelector("#bjBetInput");
        const amt = Number(input?.value || 10);
        handlers.blackjackDeal?.(amt);
        return;
      }

      if (event.target.closest("[data-bj-hit]")) {
        handlers.blackjackHit?.();
        return;
      }

      if (event.target.closest("[data-bj-stand]")) {
        handlers.blackjackStand?.();
        return;
      }

      if (event.target.closest("[data-bj-new-round]")) {
        handlers.blackjackReset?.();
        return;
      }
    });

    document.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => this.closeModal(button.dataset.close));
    });

    document.querySelectorAll(".modal-layer").forEach((layer) => {
      layer.addEventListener("click", (event) => {
        if (event.target === layer) {
          this.closeModal(layer.id);
        }
      });
    });
  }

  render(player, fishingState) {
    this.dom.coinAmount.textContent = formatNumber(player.coins);
    this.dom.levelBadge.textContent = player.levelInfo.level;
    this.dom.xpLabel.textContent = `${Math.floor(player.levelInfo.xpIntoLevel)} / ${player.levelInfo.nextLevelXp} XP`;
    this.dom.xpBar.style.width = `${player.levelInfo.progress * 100}%`;
    this.dom.rodName.textContent = player.selectedRodData.name;
    this.dom.baitName.textContent = player.selectedBaitData.name;
    this.dom.worldConditions.textContent = `${player.conditions.weather} / ${player.conditions.season}`;
    const ability = player.selectedRodData.ability;
    this.dom.abilityButton.textContent = `${ability.name} ${fishingState.abilityCooldown > 0 ? Math.ceil(fishingState.abilityCooldown) + "s" : "Ready"}`;
    this.dom.abilityButton.disabled = fishingState.mode !== "reeling" || fishingState.abilityCooldown > 0;
    this.dom.statusText.textContent = fishingState.status;

    this.updatePrimaryButton(fishingState.mode);
    this.updateMeters(fishingState);
    this.renderLocations(player);
    this.renderInventory(player);

    if (this.dom.shopModal.classList.contains("open")) {
      this.renderShop(player);
    }

    if (this.dom.dexModal.classList.contains("open")) {
      this.renderDex(player);
    }

    if (this.dom.npcModal.classList.contains("open")) {
      this.renderNpc(player);
    }

    if (this.dom.blackjackModal?.classList.contains("open")) {
      this.renderBlackjack(player);
    }

    if (this.dom.aquariumModal?.classList.contains("open")) {
      this.renderAquarium(player);
    }

    if (this.dom.journalModal?.classList.contains("open")) {
      this.renderJournal(player);
    }

    if (this.dom.shipModal.classList.contains("open")) {
      this.renderShip(player);
    }

    if (this.weatherSystem && this.dom.weatherBadge) {
      const w = this.weatherSystem.getStatus();
      if (this.dom.weatherIcon) this.dom.weatherIcon.textContent = w.weather === "rain" ? "🌧️" : "☀️";
      if (this.dom.weatherName) this.dom.weatherName.textContent = w.label;
      if (this.dom.weatherTimer) this.dom.weatherTimer.textContent = w.timerText;
      if (w.weather === "rain") {
        this.dom.weatherBadge.classList.add("rain-active");
      } else {
        this.dom.weatherBadge.classList.remove("rain-active");
      }
    }
  }

  setInteractionPrompt(text) {
    if (!this.dom.interactionPrompt) return;
    if (text) {
      this.dom.interactionPrompt.textContent = text;
      this.dom.interactionPrompt.hidden = false;
    } else {
      this.dom.interactionPrompt.hidden = true;
    }
  }

  setMerchantAccess(canSell) {
    const nextValue = Boolean(canSell);
    if (this.canSellAtMerchant === nextValue) return;
    this.canSellAtMerchant = nextValue;
    this.renderKeys.delete("inventory");
    this.renderKeys.delete("npc");
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = enabled;
    this.dom.soundButton.textContent = enabled ? "Sound" : "Muted";
    this.dom.soundButton.setAttribute("aria-pressed", String(!enabled));
  }

  openModal(id) {
    const modal = this.dom[id];
    if (!modal) {
      return;
    }

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    const player = this.playerStore.snapshot();

    if (id === "shopModal") {
      this.renderKeys.delete("shop");
      this.renderShop(player);
    } else if (id === "dexModal") {
      this.renderKeys.delete("dex");
      this.renderDex(player);
    } else if (id === "npcModal") {
      this.renderKeys.delete("npc");
      this.renderNpc(player);
    } else if (id === "blackjackModal") {
      this.renderBlackjack(player);
    } else if (id === "shipModal") {
      this.renderKeys.delete("shipModal");
      this.renderShip(player);
    } else if (id === "aquariumModal") {
      this.renderKeys.delete("aquarium");
      this.renderAquarium(player);
    } else if (id === "journalModal") {
      this.renderKeys.delete("journal");
      this.renderJournal(player);
    } else if (id === "cheatModal") {
      this.dom.cheatOutput.replaceChildren();
      this.appendCheatLine("Tidebound developer console. Введи help для списку команд.");
      requestAnimationFrame(() => this.dom.cheatInput?.focus());
    }
  }

  closeModal(id) {
    const modal = this.dom[id];
    if (!modal) {
      return;
    }

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  appendCheatLine(text, tone = "") {
    const line = document.createElement("div");
    line.className = `cheat-line ${tone}`;
    line.textContent = text;
    this.dom.cheatOutput.append(line);
    this.dom.cheatOutput.scrollTop = this.dom.cheatOutput.scrollHeight;
  }

  showCatchResult(catchItem, levelResult) {
    const fish = getFishById(catchItem.fishId) ?? catchItem;
    const rarity = RARITY_META[catchItem.rarity] ?? RARITY_META.Common;
    const rarityClass = catchItem.rarity.toLowerCase();
    const levelText = levelResult.levelUp ? `<div class="catch-levelup-tag">Level ${levelResult.level} reached!</div>` : "";
    const displayFish = { ...fish, ...catchItem, id: fish.id, name: catchItem.name };
    const fishSvg = getFishSvg(displayFish, {
      width: 180,
      height: 115,
      animated: true,
      animation: "caught",
      seed: catchItem.catchId,
    });

    this.dom.resultToast.className = `catch-toast ${rarityClass}`;
    this.dom.resultToast.innerHTML = `
      <div class="catch-toast-header">
        <span class="catch-toast-kicker">You Caught</span>
        <span class="${rarity.className} catch-rarity-badge">${escapeHtml(catchItem.rarity)}</span>
      </div>
      <div class="catch-image-wrap ${rarityClass}">
        <div class="catch-ambient-glow"></div>
        ${fishSvg}
      </div>
      <h2 class="catch-fish-name">${escapeHtml(catchItem.name)}</h2>
      ${catchItem.description ? `<p class="catch-description">${escapeHtml(catchItem.description)}</p>` : ""}
      <div class="catch-metrics">
        <div class="catch-metric-chip">
          <span>Weight</span>
          <strong>${catchItem.weight.toFixed(2)} kg</strong>
        </div>
        <div class="catch-metric-chip">
          <span>Value</span>
          <strong>${catchItem.price} coins</strong>
        </div>
        <div class="catch-metric-chip">
          <span>XP</span>
          <strong>+${catchItem.xp} XP</strong>
        </div>
      </div>
      ${levelText}
    `;
    this.dom.resultToast.hidden = false;

    clearTimeout(this.resultTimer);
    this.resultTimer = setTimeout(() => {
      this.dom.resultToast.hidden = true;
    }, 4500);
  }

  showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    this.dom.toastStack.append(toast);

    setTimeout(() => {
      toast.remove();
    }, 2800);
  }

  updatePrimaryButton(mode) {
    const labels = {
      idle: "Cast",
      charging: "Release",
      casting: "Casting",
      waiting: "Waiting",
      bite: "Hook",
      reeling: "Reel",
    };
    const disabled = mode === "casting" || mode === "waiting";
    this.dom.primaryButton.textContent = labels[mode] ?? "Cast";
    this.dom.primaryButton.disabled = disabled;
  }

  updateMeters(fishingState) {
    const isCharging = fishingState.mode === "charging";
    this.dom.castMeter.hidden = !isCharging;
    this.dom.castFill.style.width = `${(fishingState.charge ?? 0) * 100}%`;

    const isReeling = fishingState.mode === "reeling" && fishingState.reel;
    this.dom.reelPanel.hidden = !isReeling;

    if (!isReeling) {
      return;
    }

    const reel = fishingState.reel;
    const zoneLeft = (reel.zoneCenter - reel.greenSize / 2) * 100;
    this.dom.reelZone.style.left = `${zoneLeft}%`;
    this.dom.reelZone.style.width = `${reel.greenSize * 100}%`;
    this.dom.reelMarker.style.left = `calc(${reel.indicator * 100}% - 5px)`;
    this.dom.reelProgress.style.width = `${reel.progress * 100}%`;
    this.dom.lineHealth.style.width = `${reel.line * 100}%`;
    this.dom.lineLabel.textContent = `${Math.round(reel.line * 100)}%`;
  }

  renderLocations(player) {
    const key = `${player.currentLocation}|${player.ownedBoats.join(",")}`;
    if (this.renderKeys.get("locations") === key) {
      return;
    }

    this.renderKeys.set("locations", key);
    this.dom.locationTabs.innerHTML = Object.values(LOCATION_META)
      .map((location) => {
        const unlocked = isLocationUnlocked(player, location.id);
        const active = player.currentLocation === location.id;
        const classNames = [active ? "active" : "", unlocked ? "" : "locked"].filter(Boolean).join(" ");
        const label = unlocked ? location.name : `${location.name} locked`;
        return `<button class="${classNames}" type="button" data-location="${location.id}">${escapeHtml(label)}</button>`;
      })
      .join("");
  }

  renderInventory(player) {
    const key = `${this.canSellAtMerchant}|${player.inventory.map((item) => `${item.catchId}:${item.price}`).join("|")}`;
    this.dom.inventoryCount.textContent = `${player.inventory.length} fish`;
    this.dom.sellAllButton.disabled = player.inventory.length === 0 || !this.canSellAtMerchant;

    if (this.renderKeys.get("inventory") === key) {
      return;
    }

    this.renderKeys.set("inventory", key);

    if (player.inventory.length === 0) {
      this.dom.inventoryList.innerHTML = `<div class="inventory-empty">Bag is empty.</div>`;
      return;
    }

    this.dom.inventoryList.innerHTML = player.inventory
      .map((item) => {
        const fish = getFishById(item.fishId) ?? item;
        const rarity = RARITY_META[item.rarity] ?? RARITY_META.Common;
        const fishThumb = getFishInventoryIcon(
          { ...fish, ...item, id: fish.id, name: item.name },
          { size: 44, seed: item.catchId },
        );
        return `
          <article class="inventory-item">
            <div class="inventory-item-lead">
              ${fishThumb}
              <div>
                <h3 class="${rarity.className}">${escapeHtml(item.name)}</h3>
                <p>${item.weight.toFixed(2)} kg - ${item.price} coins</p>
              </div>
            </div>
            <div class="inventory-actions">
              <button type="button" data-keep-catch="${escapeHtml(item.catchId)}">Keep</button>
              <button type="button" data-sell-catch="${escapeHtml(item.catchId)}" ${this.canSellAtMerchant ? "" : "disabled"}>Sell</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  renderShop(player) {
    const key = [
      player.coins,
      player.selectedRod,
      player.selectedBait,
      player.currentLocation,
      player.ownedRods.join(","),
      player.ownedBaits.join(","),
      player.ownedBoats.join(","),
    ].join("|");

    if (this.renderKeys.get("shop") === key) {
      return;
    }

    this.renderKeys.set("shop", key);
    this.dom.shopContent.innerHTML = `
      ${renderShopSection("Rods", RODS, player, "rod")}
      ${renderShopSection("Bait", BAITS, player, "bait")}
      ${renderShopSection("Boats", BOATS, player, "boat")}
    `;
  }

  renderDex(player) {
    const key = Object.entries(player.dex)
      .map(([fishId, entry]) => `${fishId}:${entry.count}:${entry.bestWeight}`)
      .join("|");

    if (this.renderKeys.get("dex") === key) {
      return;
    }

    this.renderKeys.set("dex", key);
    this.dom.dexContent.innerHTML = fishDatabase
      .map((fish) => {
        const entry = player.dex[fish.id];
        const rarity = RARITY_META[fish.rarity] ?? RARITY_META.Common;
        const caught = Boolean(entry?.count);
        const locationNames = fish.locations
          .map((locationId) => LOCATION_META[locationId]?.name ?? locationId)
          .join(", ");
        const fishPreview = getFishSvg(fish, {
          width: 72,
          height: 46,
          animated: false,
          className: caught ? "" : "dex-silhouette",
          seed: fish.id,
        });

        return `
          <article class="fish-card ${caught ? "" : "locked"}">
            <div class="fish-card-visual ${rarity.className}">
              ${fishPreview}
            </div>
            <div>
              <span class="${rarity.className}">${escapeHtml(fish.rarity)}</span>
              <h3>${escapeHtml(caught ? fish.name : "Unknown fish")}</h3>
              <p>${
                caught
                  ? `${entry.count} caught - best ${Number(entry.bestWeight).toFixed(2)} kg - ${entry.bestPrice} coins`
                  : `${escapeHtml(locationNames)} - undiscovered`
              }</p>
            </div>
          </article>
        `;
      })
      .join("");
  }

  renderNpc(player) {
    const key = `${this.canSellAtMerchant}|${player.inventory.map((i) => i.catchId).join(",")}|${player.coins}`;
    if (this.renderKeys.get("npc") === key) return;
    this.renderKeys.set("npc", key);

    const baseVal = player.inventory.reduce((sum, item) => sum + item.price, 0);
    const bonusVal = Math.round(baseVal * 1.15);
    const count = player.inventory.length;

    let fishListHtml = "";
    if (count > 0) {
      fishListHtml = `
        <div class="npc-sell-summary">
          <div class="npc-bonus-badge">
            <strong>+15% бонус від Марко</strong> за продаж риби на Острові!
          </div>
          <button type="button" class="accent-button npc-sell-all-btn" data-npc-sell-all ${this.canSellAtMerchant ? "" : "disabled"}>
            Продати весь улов (${count} шт.) за ${bonusVal} монет
          </button>
        </div>
        <div class="npc-fish-grid">
          ${player.inventory
            .map((item) => {
              const fish = getFishById(item.fishId) ?? item;
              const rarity = RARITY_META[item.rarity] ?? RARITY_META.Common;
              const bonusPrice = Math.round(item.price * 1.15);
              const fishSvg = getFishInventoryIcon(
                { ...fish, ...item, id: fish.id, name: item.name },
                { size: 50, seed: item.catchId },
              );
              return `
                <article class="npc-fish-card">
                  ${fishSvg}
                  <div class="npc-fish-info">
                    <h4 class="${rarity.className}">${escapeHtml(item.name)}</h4>
                    <p>${item.weight.toFixed(2)} kg - <span class="npc-price">+${bonusPrice} монет</span></p>
                  </div>
                  <button type="button" data-npc-sell-catch="${escapeHtml(item.catchId)}" ${this.canSellAtMerchant ? "" : "disabled"}>Продати</button>
                </article>
              `;
            })
            .join("")}
        </div>
      `;
    } else {
      fishListHtml = `
        <div class="npc-empty-box">
          <p>Ваш садок порожній. Зловіть рибу на Причалі та повертайтесь сюди для продажу!</p>
        </div>
      `;
    }

    this.dom.npcContent.innerHTML = `
      <div class="npc-dialogue-hero">
        <div class="npc-avatar">👨‍🦳</div>
        <div class="npc-dialogue-bubble">
          <h3>Старий Марко, Торговець рибою на Острові</h3>
          <p>«Вітаю на Острові! Я викуповую будь-який улов за <strong>найкращими цінами (+15% бонус)</strong>. Продавай по одній або здавай увесь садок одразу!»</p>
          <div class="npc-price-tiers">
            <span>Цінові категорії за рідкістю:</span>
            <span class="rarity-common">Звичайні: 5–10+</span> • 
            <span class="rarity-rare">Рідкісні: 20–40+</span> • 
            <span class="rarity-epic">Епічні: 50–100+ монет</span>
          </div>
        </div>
      </div>
      <section class="quest-board">
        <h3>Квести та замовлення</h3>
        <div class="quest-list">
          ${QUESTS.map((quest) => {
            const progress = player.quests.find((item) => item.id === quest.id);
            return `<article class="quest-card ${progress?.completed ? "complete" : ""}">
              <div><strong>${escapeHtml(quest.title)}</strong><p>${escapeHtml(quest.description)}</p></div>
              <span>${progress?.completed ? "Готово" : `${progress?.progress ?? 0}/${quest.target}`}</span>
            </article>`;
          }).join("")}
        </div>
      </section>
      ${fishListHtml}
    `;
  }

  renderBlackjack(player = this.playerStore.snapshot()) {
    if (!this.blackjackGame || !this.dom.blackjackContent) return;
    const snap = this.blackjackGame.getSnapshot();
    const handKey = [...snap.dealerHand, ...snap.playerHand]
      .map((card) => `${card.id}:${card.hidden ? 1 : 0}`)
      .join(",");
    const resultKey = snap.result ? `${snap.result.outcome}:${snap.result.message}:${snap.result.payout}` : "";
    const renderKey = `${player.coins}|${snap.status}|${snap.currentBet}|${handKey}|${resultKey}`;
    if (this.renderKeys.get("blackjack") === renderKey) return;
    this.renderKeys.set("blackjack", renderKey);

    const isBetting = snap.status === "betting";
    const isPlaying = snap.status === "playing";
    const isEnded = snap.status === "ended";

    const renderCard = (card) => {
      if (card.hidden) {
        return `
          <div class="playing-card card-back" aria-label="Закрита карта">
            <div class="card-inner-pattern">🂠</div>
          </div>
        `;
      }
      return `
        <div class="playing-card ${card.isRed ? "red-card" : "black-card"}">
          <div class="card-corner top-left">
            <span class="card-rank">${escapeHtml(card.rank)}</span>
            <span class="card-suit">${escapeHtml(card.suit)}</span>
          </div>
          <div class="card-center-suit">${escapeHtml(card.suit)}</div>
          <div class="card-corner bottom-right">
            <span class="card-rank">${escapeHtml(card.rank)}</span>
            <span class="card-suit">${escapeHtml(card.suit)}</span>
          </div>
        </div>
      `;
    };

    let resultHtml = "";
    if (snap.result) {
      const outcomeClass =
        snap.result.outcome === "win" || snap.result.outcome === "blackjack" || snap.result.outcome === "dealer_bust"
          ? "bj-result-win"
          : snap.result.outcome === "push"
            ? "bj-result-push"
            : "bj-result-loss";
      resultHtml = `
        <div class="bj-result-banner ${outcomeClass}">
          <strong>${escapeHtml(snap.result.message)}</strong>
        </div>
      `;
    }

    let controlsHtml = "";
    if (isBetting) {
      controlsHtml = `
        <div class="bj-bet-controls">
          <div class="bj-chips-strip">
            <span>Вибір ставки (фішки):</span>
            <div class="bj-chips">
              <button type="button" class="bj-chip chip-5" data-bj-chip="5">5</button>
              <button type="button" class="bj-chip chip-10" data-bj-chip="10">10</button>
              <button type="button" class="bj-chip chip-25" data-bj-chip="25">25</button>
              <button type="button" class="bj-chip chip-50" data-bj-chip="50">50</button>
              <button type="button" class="bj-chip chip-100" data-bj-chip="100">100</button>
            </div>
          </div>
          <div class="bj-deal-row">
            <div class="bj-input-box">
              <label for="bjBetInput">Ставка (монет):</label>
              <input id="bjBetInput" type="number" min="5" max="${Math.max(5, player.coins)}" value="${Math.min(player.coins, snap.currentBet || 10)}" />
            </div>
            <button type="button" class="accent-button bj-deal-btn" data-bj-deal ${player.coins < 5 ? "disabled" : ""}>
              Роздати карти (Deal) 🃏
            </button>
          </div>
        </div>
      `;
    } else if (isPlaying) {
      controlsHtml = `
        <div class="bj-action-controls">
          <button type="button" class="accent-button bj-hit-btn" data-bj-hit>
            Взяти карту (Hit) 🂡
          </button>
          <button type="button" class="ghost-button bj-stand-btn" data-bj-stand>
            Досить (Stand) ✋
          </button>
        </div>
      `;
    } else if (isEnded) {
      controlsHtml = `
        <div class="bj-ended-controls">
          <button type="button" class="accent-button bj-new-btn" data-bj-new-round>
            Зіграти ще раунд 🔄
          </button>
        </div>
      `;
    }

    const dealerScoreText =
      isPlaying && snap.dealerHand.length > 1 && snap.dealerHand[1]?.hidden ? "?" : snap.dealerScore;

    this.dom.blackjackContent.innerHTML = `
      <div class="casino-table">
        <div class="casino-header-ribbon">
          <div class="casino-rules-tag">
            <span>Правила столу:</span> Блекджек виплачує 3:2 (2.5x) • Перемога 1:1 (2x) • Дилер бере до 17 • Туз = 1 або 11
          </div>
          <div class="casino-purse">
            <span>Ваш баланс:</span> <strong>${player.coins} монет</strong>
          </div>
        </div>

        <div class="bj-hand-section dealer-section">
          <div class="bj-hand-header">
            <h4>Дилер (Круп'є)</h4>
            <span class="bj-score-badge">Очки: ${dealerScoreText}</span>
          </div>
          <div class="bj-cards-row">
            ${snap.dealerHand.length > 0 ? snap.dealerHand.map(renderCard).join("") : '<div class="bj-empty-slot">Очікування ставки...</div>'}
          </div>
        </div>

        ${resultHtml}

        <div class="bj-hand-section player-section">
          <div class="bj-hand-header">
            <h4>Ваша рука</h4>
            <span class="bj-score-badge ${snap.playerScore === 21 ? "bj-21-badge" : ""}">
              Очки: ${snap.playerScore} ${snap.playerBlackjack ? "🔥 Блекджек!" : ""}
            </span>
          </div>
          <div class="bj-cards-row">
            ${snap.playerHand.length > 0 ? snap.playerHand.map(renderCard).join("") : '<div class="bj-empty-slot">Очікування роздачі...</div>'}
          </div>
        </div>

        ${controlsHtml}
      </div>
    `;
  }

  renderAquarium(player) {
    const key = player.aquarium.map((item) => `${item.catchId}:${item.feedCount}:${item.displayed}`).join("|");
    if (this.renderKeys.get("aquarium") === key) return;
    this.renderKeys.set("aquarium", key);
    this.dom.aquariumContent.innerHTML = player.aquarium.length
      ? `<div class="aquarium-tank">${player.aquarium.filter((item) => item.displayed).map((item) => `<span>${escapeHtml(item.name)}</span>`).join("") || "Вітрина чекає на рибу"}</div>
         <div class="aquarium-grid">${player.aquarium.map((item) => {
           const fish = getFishById(item.fishId) ?? item;
           return `<article class="aquarium-fish-card">${getFishInventoryIcon({ ...fish, ...item, id: fish.id }, { size: 72, seed: item.catchId })}<strong>${escapeHtml(item.name)}</strong><small>Годували: ${item.feedCount ?? 0}</small><div><button type="button" data-feed-fish="${escapeHtml(item.catchId)}">Годувати</button><button type="button" data-display-fish="${escapeHtml(item.catchId)}">${item.displayed ? "Прибрати" : "Виставити"}</button></div></article>`;
         }).join("")}</div>`
      : `<div class="npc-empty-box"><p>Залиш рибу живою через кнопку Keep у садку, щоб заселити акваріум.</p></div>`;
  }

  renderJournal(player) {
    const key = `${player.levelInfo.level}|${player.coins}|${player.combo}|${player.rodDurability}|${player.daily.progress}|${player.weekly.progress}|${player.theme}|${player.achievements.map((item) => `${item.id}:${item.progress}:${item.completed}`).join(",")}`;
    if (this.renderKeys.get("journal") === key) return;
    this.renderKeys.set("journal", key);
    this.dom.journalContent.innerHTML = `
      <section class="journal-section tutorial-section">
        <h3>Як грати</h3>
        <p>Утримуй Cast, відпусти для закидання, натисни Hook на клювання, а під час виважування тримай маркер у зеленій зоні.</p>
        <p>Вночі з’являються рідкісні види, дощ допомагає ловити вугрів. Рибу можна продати або залишити живою в акваріумі.</p>
      </section>
      <section class="journal-section">
        <div class="journal-section-header"><h3>${escapeHtml(DAILY_CHALLENGE.title)}</h3><span>${player.daily.completed ? "✓" : `${player.daily.progress}/${DAILY_CHALLENGE.target}`}</span></div>
        <p>${escapeHtml(DAILY_CHALLENGE.description)}: ${player.daily.progress}/${DAILY_CHALLENGE.target}</p>
        <div class="progress-track"><i style="width:${Math.min(100, player.daily.progress / DAILY_CHALLENGE.target * 100)}%"></i></div>
        <div class="journal-section-header"><h3>${escapeHtml(WEEKLY_CHALLENGE.title)}</h3><span>${player.weekly.completed ? "✓" : `${player.weekly.progress}/${WEEKLY_CHALLENGE.target}`}</span></div>
        <p>${escapeHtml(WEEKLY_CHALLENGE.description)}: ${player.weekly.progress}/${WEEKLY_CHALLENGE.target}</p>
        <div class="progress-track"><i style="width:${Math.min(100, player.weekly.progress / WEEKLY_CHALLENGE.target * 100)}%"></i></div>
      </section>
      <section class="journal-section journal-stats">
        <h3>Екіпірування та колекції</h3>
        <p>Комбо: <strong>x${player.combo}</strong> · Рекорд: ${player.maxCombo} · Рідкісні жетони: ${player.rareTokens}</p>
        <p>Міцність вудилища: <strong>${Math.round(player.rodDurability)}%</strong></p>
        <button type="button" data-repair-rod ${player.rodDurability >= 100 ? "disabled" : ""}>Полагодити снасті</button>
        <p>Артефакти: ${player.artifacts.length}</p>
        <button type="button" data-theme-toggle>Тема: ${player.theme === "dark" ? "темна" : "світла"}</button>
      </section>
      <section class="journal-section">
        <div class="journal-section-header"><h3>Досягнення</h3><span>${player.achievements.filter((item) => item.completed).length}/${ACHIEVEMENTS.length}</span></div>
        <div class="achievement-list">${player.achievements.map((item) => `<article class="achievement-card ${item.completed ? "complete" : ""}"><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description)}</p></div><span>${item.completed ? "✓" : `${Math.floor(item.progress ?? 0)}/${item.target}`}</span></article>`).join("")}</div>
      </section>
      <section class="journal-section save-tools">
        <h3>Сейв</h3>
        <p>Перенеси прогрес на інший пристрій через JSON-файл.</p>
        <button type="button" data-export-save>Експортувати сейв</button>
        <button type="button" data-import-save>Імпортувати сейв</button>
      </section>
    `;
  }
  renderShip(player) {
    const key = `${player.currentLocation}|${player.coins}|${player.levelInfo.level}`;
    if (this.renderKeys.get("shipModal") === key) return;
    this.renderKeys.set("shipModal", key);

    const locations = Object.values(LOCATION_META);
    this.dom.shipContent.innerHTML = `
      <div class="ship-dialogue-hero">
        <div class="ship-avatar">🚢</div>
        <div class="ship-dialogue-bubble">
          <h3>Капітан Барнабі (Шкіпер «Мандрівника Хвиль»)</h3>
          <p>«Вітаю на борту! Мій корабель доставить тебе до будь-якої точки світу за чесну плату. Обирай пункт призначення!»</p>
        </div>
      </div>
      <div class="ship-routes-grid">
        ${locations
          .map((loc) => {
            const isCurrent = player.currentLocation === loc.id;
            const levelLocked = loc.requiredLevel && player.levelInfo.level < loc.requiredLevel;
            const fare = loc.travelCost ?? 0;
            const canAfford = player.coins >= fare;
            const disabled = isCurrent || levelLocked || !canAfford;

            let buttonText = "Відплисти";
            if (isCurrent) buttonText = "Поточна локація";
            else if (levelLocked) buttonText = `Потрібен ${loc.requiredLevel} рівень`;
            else if (!canAfford) buttonText = `Потрібно ${fare} монет`;
            else if (fare === 0) buttonText = "Безкоштовно";
            else buttonText = `Квиток: ${fare} монет`;

            return `
              <article class="ship-route-card ${isCurrent ? "current" : ""} ${levelLocked ? "locked" : ""}">
                <div class="route-header">
                  <span class="route-tag">${escapeHtml(loc.tag)}</span>
                  <h4>${escapeHtml(loc.name)}</h4>
                </div>
                <p class="route-desc">${escapeHtml(loc.description)}</p>
                <div class="route-footer">
                  <div class="route-cost">
                    <span>Плата за проїзд:</span>
                    <strong>${fare === 0 ? "Безкоштовно" : `${fare} монет`}</strong>
                  </div>
                  <button 
                    type="button" 
                    class="${!isCurrent && !levelLocked && canAfford ? "sail-ready" : ""}" 
                    data-sail-destination="${escapeHtml(loc.id)}" 
                    data-fare="${fare}"
                    ${disabled ? "disabled" : ""}
                  >
                    ${escapeHtml(buttonText)}
                  </button>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }
}

function renderShopSection(title, items, player, type) {
  const visibleItems = items.filter((item) => !item.cheatOnly);
  return `
    <section class="shop-section">
      <h3>${escapeHtml(title)}</h3>
      <div class="shop-grid">
        ${visibleItems.map((item) => renderShopCard(item, player, type)).join("")}
      </div>
    </section>
  `;
}

function renderShopCard(item, player, type) {
  const owned =
    type === "rod"
      ? player.ownedRods.includes(item.id)
      : type === "bait"
        ? player.ownedBaits.includes(item.id)
        : player.ownedBoats.includes(item.id);
  const selected =
    (type === "rod" && player.selectedRod === item.id) ||
    (type === "bait" && player.selectedBait === item.id) ||
    (type === "boat" && player.currentLocation === item.unlocksLocation);
  const afford = player.coins >= item.price;
  const action = `${owned ? "select" : "buy"}-${type}`;
  const disabled = selected || (!owned && !afford);
  const label = selected
    ? type === "boat"
      ? "Current"
      : "Equipped"
    : owned
      ? type === "boat"
        ? "Go"
        : "Equip"
      : afford
        ? `${item.price} coins`
        : `Need ${item.price - player.coins}`;
  const stats = getItemStats(item, type);

  return `
    <article class="shop-card">
      <div>
        <span>${type}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        <p>${escapeHtml(stats)}</p>
      </div>
      <button
        class="${!owned && afford ? "buyable" : ""}"
        type="button"
        data-shop-action="${action}"
        data-item-id="${escapeHtml(item.id)}"
        ${disabled ? "disabled" : ""}
      >${escapeHtml(label)}</button>
    </article>
  `;
}

function getItemStats(item, type) {
  if (type === "rod") {
    return `Cast x${item.castMultiplier.toFixed(2)} - Reel x${item.reelSpeed.toFixed(2)}`;
  }

  if (type === "bait") {
    return `Bite x${item.biteMultiplier.toFixed(2)} - Luck +${Math.round(item.luckBonus * 100)}%`;
  }

  const location = LOCATION_META[item.unlocksLocation];
  return `Route: ${location?.name ?? item.unlocksLocation}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function isTypingTarget(target) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable;
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

