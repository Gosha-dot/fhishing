import { fishDatabase, getFishById, LOCATION_META, RARITY_META } from "./fishDatabase.js";
import { BAITS, BOATS, RODS } from "./shop.js";
import { isLocationUnlocked } from "./player.js";
import { getFishInventoryIcon, getFishSvg } from "./fishArt.js";

// DOM adapter for HUD, panels, modals, inventory, and input. Rendering is keyed
// so frequently updated meters do not rebuild large panels every frame.
export class UIController {
  constructor({ playerStore }) {
    this.playerStore = playerStore;
    this.renderKeys = new Map();
    this.resultTimer = null;
    this.soundEnabled = true;
    this.dom = {
      coinAmount: document.querySelector("#coinAmount"),
      levelBadge: document.querySelector("#levelBadge"),
      xpLabel: document.querySelector("#xpLabel"),
      xpBar: document.querySelector("#xpBar"),
      statusText: document.querySelector("#statusText"),
      rodName: document.querySelector("#rodName"),
      baitName: document.querySelector("#baitName"),
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
      shipButton: document.querySelector("#shipButton"),
      soundButton: document.querySelector("#soundButton"),
      shopModal: document.querySelector("#shopModal"),
      dexModal: document.querySelector("#dexModal"),
      npcModal: document.querySelector("#npcModal"),
      shipModal: document.querySelector("#shipModal"),
      shopContent: document.querySelector("#shopContent"),
      dexContent: document.querySelector("#dexContent"),
      npcContent: document.querySelector("#npcContent"),
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

      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        handlers.primaryDown();
      } else if (event.code === "KeyA" || event.code === "ArrowLeft") {
        handlers.walkLeftDown?.();
      } else if (event.code === "KeyD" || event.code === "ArrowRight") {
        handlers.walkRightDown?.();
      } else if (event.code === "KeyE" || event.code === "Enter") {
        handlers.interactAction?.();
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
    this.dom.shipButton?.addEventListener("click", () => this.openModal("shipModal"));
    this.dom.soundButton?.addEventListener("click", () => handlers.toggleSound());
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
    });

    this.dom.shipContent?.addEventListener("click", (event) => {
      const sailBtn = event.target.closest("[data-sail-destination]");
      if (sailBtn) {
        const dest = sailBtn.dataset.sailDestination;
        const fare = Number(sailBtn.dataset.fare || 0);
        handlers.sailTo?.(dest, fare);
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

    if (this.dom.shipModal.classList.contains("open")) {
      this.renderShip(player);
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
    } else if (id === "shipModal") {
      this.renderKeys.delete("shipModal");
      this.renderShip(player);
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
    const key = player.inventory.map((item) => `${item.catchId}:${item.price}`).join("|");
    this.dom.inventoryCount.textContent = `${player.inventory.length} fish`;
    this.dom.sellAllButton.disabled = player.inventory.length === 0;

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
            <button type="button" data-sell-catch="${escapeHtml(item.catchId)}">Sell</button>
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
    const key = player.inventory.map((i) => i.catchId).join(",") + "|" + player.coins;
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
            <strong>+15% fishmonger bonus</strong> for selling through Marco.
          </div>
          <button type="button" class="accent-button npc-sell-all-btn" data-npc-sell-all>
            Sell all ${count} fish for ${bonusVal} coins
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
                    <p>${item.weight.toFixed(2)} kg - <span class="npc-price">+${bonusPrice} coins</span></p>
                  </div>
                  <button type="button" data-npc-sell-catch="${escapeHtml(item.catchId)}">Sell</button>
                </article>
              `;
            })
            .join("")}
        </div>
      `;
    } else {
      fishListHtml = `
        <div class="npc-empty-box">
          <p>Your bag is empty. Catch a fish, then come back to sell it here.</p>
        </div>
      `;
    }

    this.dom.npcContent.innerHTML = `
      <div class="npc-dialogue-hero">
        <div class="npc-avatar">$</div>
        <div class="npc-dialogue-bubble">
          <h3>Old Marco, Fishmonger</h3>
          <p>I buy fresh catches for <strong>15% above regular value</strong>. Sell one fish or cash out the whole bag.</p>
        </div>
      </div>
      ${fishListHtml}
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
  return `
    <section class="shop-section">
      <h3>${escapeHtml(title)}</h3>
      <div class="shop-grid">
        ${items.map((item) => renderShopCard(item, player, type)).join("")}
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

