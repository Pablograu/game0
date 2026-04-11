import { Scene, Vector3 } from "@babylonjs/core";
import type { World } from "./ecs/core/World.ts";
import { createDroppedWeaponEntity } from "./ecs/weapons/createDroppedWeaponEntity.ts";
import { CarriedWeaponType } from "./ecs/weapons/WeaponDefinitions.ts";

const DROPPABLE_WEAPON_TYPES = [
  CarriedWeaponType.PISTOL,
  CarriedWeaponType.ASSAULT_RIFLE,
] as const;

class LootManager {
  private scene!: Scene;
  private world: World | null = null;
  isInitialized = false;

  init(scene: Scene, world?: World) {
    if (this.isInitialized) {
      return;
    }
    this.scene = scene;
    this.world = world ?? null;
    this.isInitialized = true;
  }

  spawnLoot(position: Vector3) {
    if (!this.isInitialized || !this.world) {
      return;
    }

    const weaponType =
      DROPPABLE_WEAPON_TYPES[
        Math.floor(Math.random() * DROPPABLE_WEAPON_TYPES.length)
      ];

    createDroppedWeaponEntity(this.world, this.scene, position, weaponType);
  }
}

export default LootManager;
