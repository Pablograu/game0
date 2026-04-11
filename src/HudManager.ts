/**
 * HudManager — DOM-based HUD singleton.
 * No AdvancedDynamicTexture. Pure HTML/CSS overlay.
 *
 * Layout:
 *  - Top-left : player portrait + animated health bar
 *  - Bottom-right : weapon image + ammo counter (current/∞)
 */

const WEAPON_IMAGE_MAP: Record<string, string> = {
  none: "/hud/weapons/fist.png",
  "assault-rifle": "/hud/weapons/assault-rifle.png",
};

/** Derives the image-map key from a CarriedWeaponType enum value, e.g. "ASSAULT_RIFLE" → "assault-rifle". */
function weaponEnumToKey(enumValue: string): string {
  return enumValue.toLowerCase().replace(/_/g, "-");
}

class HudManagerClass {
  private root: HTMLDivElement | null = null;
  private healthBar: HTMLDivElement | null = null;
  private ammoText: HTMLDivElement | null = null;
  private weaponImg: HTMLImageElement | null = null;

  init(maxHealth: number, initialWeaponEnum: string): void {
    if (this.root) {
      this.destroy();
    }

    // ── Root overlay ───────────────────────────────────────────────
    const root = document.createElement("div");
    root.id = "game-hud";
    this.root = root;

    // ── Player panel (top-left) ────────────────────────────────────
    const playerPanel = document.createElement("div");
    playerPanel.id = "hud-player-panel";

    const portrait = document.createElement("img");
    portrait.id = "hud-portrait";
    portrait.src = "/hud/player/player.png";
    portrait.alt = "Player";

    const barWrap = document.createElement("div");
    barWrap.id = "hud-health-bar-wrap";

    const bar = document.createElement("div");
    bar.id = "hud-health-bar";
    this.healthBar = bar;

    barWrap.appendChild(bar);
    playerPanel.appendChild(portrait);
    playerPanel.appendChild(barWrap);

    // ── Weapon panel (bottom-right) ────────────────────────────────
    const weaponPanel = document.createElement("div");
    weaponPanel.id = "hud-weapon-panel";

    const weaponImg = document.createElement("img");
    weaponImg.id = "hud-weapon-img";
    weaponImg.alt = "Weapon";
    this.weaponImg = weaponImg;

    const ammoText = document.createElement("div");
    ammoText.id = "hud-ammo-text";
    ammoText.textContent = "—";
    this.ammoText = ammoText;

    weaponPanel.appendChild(weaponImg);
    weaponPanel.appendChild(ammoText);

    root.appendChild(playerPanel);
    root.appendChild(weaponPanel);
    document.body.appendChild(root);

    // Initial state
    this.setHealth(maxHealth, maxHealth);
    this.setWeapon(initialWeaponEnum);
  }

  setHealth(current: number, max: number): void {
    if (!this.healthBar) return;

    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
    this.healthBar.style.width = `${pct}%`;

    // Color thresholds
    this.healthBar.classList.remove("hud-health--orange", "hud-health--red");
    if (pct <= 25) {
      this.healthBar.classList.add("hud-health--red");
    } else if (pct <= 50) {
      this.healthBar.classList.add("hud-health--orange");
    }
  }

  setAmmo(currentAmmo: number): void {
    if (!this.ammoText) return;
    this.ammoText.textContent = `${currentAmmo}/∞`;
  }

  setWeapon(weaponEnum: string): void {
    if (!this.weaponImg || !this.ammoText) return;

    const key = weaponEnumToKey(weaponEnum);
    const src = WEAPON_IMAGE_MAP[key] ?? WEAPON_IMAGE_MAP["none"];
    this.weaponImg.src = src;
    this.weaponImg.style.display = "";

    if (weaponEnum === "NONE") {
      this.ammoText.textContent = "";
    }
  }

  destroy(): void {
    this.root?.remove();
    this.root = null;
    this.healthBar = null;
    this.ammoText = null;
    this.weaponImg = null;
  }
}

export const HudManager = new HudManagerClass();
