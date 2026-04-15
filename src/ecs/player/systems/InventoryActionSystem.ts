import { HudManager } from '../../../HudManager.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { createDroppedWeaponEntity } from '../../weapons/createDroppedWeaponEntity.ts';
import { CarriedWeaponType } from '../../weapons/WeaponDefinitions.ts';
import {
  PlayerHealthStateComponent,
  PlayerInventoryComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerRangedStateComponent,
} from '../components/index.ts';
import {
  isInventoryConsumableItem,
  isInventoryWeaponItem,
} from '../inventory/InventoryItemDefinitions.ts';
import {
  getInventoryItemById,
  removeInventoryItem,
  setActiveWeaponItemId,
} from '../inventory/inventoryHelpers.ts';
import { PlayerLifeState } from '../PlayerStateEnums.ts';

export class InventoryActionSystem implements EcsSystem {
  readonly name = 'InventoryActionSystem';
  readonly order = 13.5;

  update(world: World): void {
    const entityIds = world.query(
      PlayerHealthStateComponent,
      PlayerInventoryComponent,
      PlayerPhysicsViewRefsComponent,
      PlayerRangedStateComponent,
    );

    for (const entityId of entityIds) {
      const health = world.getComponent(entityId, PlayerHealthStateComponent);
      const inventory = world.getComponent(entityId, PlayerInventoryComponent);
      const refs = world.getComponent(entityId, PlayerPhysicsViewRefsComponent);
      const ranged = world.getComponent(entityId, PlayerRangedStateComponent);

      if (
        !health ||
        !inventory ||
        !refs ||
        !ranged ||
        !inventory.actionRequest
      ) {
        continue;
      }

      const request = inventory.actionRequest;
      inventory.actionRequest = null;

      const item = getInventoryItemById(inventory, request.itemId);

      if (!item) {
        continue;
      }

      if (request.kind === 'use') {
        if (isInventoryWeaponItem(item)) {
          setActiveWeaponItemId(inventory, item.id);
          ranged.currentAmmo = item.currentAmmo;
          ranged.fireTimer = 0;
          ranged.shootTimer = 0;
          ranged.isReloading = false;
          ranged.reloadTimer = 0;
          HudManager.setWeapon(item.weaponType);
          HudManager.setAmmo(ranged.currentAmmo);
        }

        if (isInventoryConsumableItem(item)) {
          if (
            health.lifeState !== PlayerLifeState.ALIVE ||
            health.currentHealth >= health.maxHealth
          ) {
            continue;
          }

          health.currentHealth = Math.min(
            health.maxHealth,
            health.currentHealth + item.healAmount,
          );

          if (item.quantity > 1) {
            item.quantity -= 1;
            inventory.isDirty = true;
          } else {
            removeInventoryItem(inventory, item.id);
          }
        }

        continue;
      }

      const removedItem = removeInventoryItem(inventory, item.id);

      if (!removedItem || !isInventoryWeaponItem(removedItem)) {
        continue;
      }

      createDroppedWeaponEntity(
        world,
        refs.scene,
        refs.mesh.getAbsolutePosition(),
        removedItem.weaponType,
      );

      if (inventory.activeWeaponItemId !== null) {
        continue;
      }

      ranged.currentAmmo = 0;
      ranged.isAiming = false;
      ranged.isReloading = false;
      ranged.reloadTimer = 0;
      HudManager.setWeapon(CarriedWeaponType.NONE);
      HudManager.setAmmo(0);
    }
  }
}
