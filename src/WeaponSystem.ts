import { Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { HitboxSystem } from './HitboxSystem';

export class WeaponSystem {
  attackCooldown: number;
  attackDuration: number;
  damage: number;
  debugMode: boolean;
  hitboxOffset: number;
  hitboxSize: Vector3;
  hitboxSystem: HitboxSystem | null = null;
  playerKnockback: number;
  scene: Scene;

  constructor(_playerController: unknown, scene: Scene, options: any = {}) {
    this.scene = scene;

    this.damage = options.damage || 1;
    this.attackDuration = options.attackDuration || 0.2;
    this.attackCooldown = options.attackCooldown || 0.4;
    this.hitboxSize = options.hitboxSize || new Vector3(1.5, 1, 1.5);
    this.hitboxOffset = options.hitboxOffset || 1.2;
    this.playerKnockback = options.playerKnockback || 3;
    this.debugMode = options.debug || false;

    this.createHitbox();
    this.setHitboxEnabled(false);
  }

  createHitbox() {
    this.hitboxSystem = new HitboxSystem(
      'playerWeaponHitbox',
      this.hitboxSize,
      this.scene,
      this.debugMode,
    );
  }
  setHitboxEnabled(enabled: boolean) {
    this.hitboxSystem?.setEnabled(enabled);
  }

  setDebugMode(enabled: boolean) {
    this.debugMode = enabled;
    this.hitboxSystem?.setDebugMode(enabled);
  }

  dispose() {
    if (this.hitboxSystem) {
      this.hitboxSystem.dispose();
      this.hitboxSystem = null;
    }
  }

  // Getter de compatibilidad (por si algo accede a WeaponSystem.hitbox directamente)
  get hitbox() {
    return this.hitboxSystem?.getMesh() || null;
  }
}
