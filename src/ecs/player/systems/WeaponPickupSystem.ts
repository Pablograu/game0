import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { DroppedWeaponDataComponent } from '../../weapons/components/DroppedWeaponDataComponent.ts';
import { DroppedWeaponMeshComponent } from '../../weapons/components/DroppedWeaponMeshComponent.ts';
import { HudManager } from '../../../HudManager.ts';
import { PlayerInventoryComponent } from '../components/PlayerInventoryComponent.ts';
import { PlayerRangedStateComponent } from '../components/PlayerRangedStateComponent.ts';
import { createWeaponInventoryItem } from '../inventory/InventoryItemDefinitions.ts';
import {
  addInventoryItem,
  setActiveWeaponItemId,
} from '../inventory/inventoryHelpers.ts';

export class WeaponPickupSystem implements EcsSystem {
  readonly name = 'WeaponPickupSystem';
  readonly order = 13;

  update(world: World): void {
    const players = world.query(PlayerInventoryComponent);

    for (const playerId of players) {
      const inv = world.getComponent(playerId, PlayerInventoryComponent)!;
      const ranged = world.getComponent(playerId, PlayerRangedStateComponent);

      // ── Pickup ──
      if (inv.pickupRequested) {
        const nearId = inv.nearbyPickupEntityId;
        if (nearId !== null && world.hasEntity(nearId)) {
          const meshComp = world.getComponent(
            nearId,
            DroppedWeaponMeshComponent,
          )!;
          const dataComp = world.getComponent(
            nearId,
            DroppedWeaponDataComponent,
          )!;
          const def = dataComp.definition;
          const pickupItem = createWeaponInventoryItem(def.type, def.maxAmmo);
          const storedItem = addInventoryItem(inv, pickupItem);

          if (storedItem) {
            meshComp.floatAnimatable?.stop();
            meshComp.node.dispose();
            setActiveWeaponItemId(inv, storedItem.id);
            HudManager.setWeapon(def.type);
            if (ranged) {
              ranged.currentAmmo = pickupItem.currentAmmo;
              ranged.fireTimer = 0;
              ranged.isReloading = false;
              ranged.reloadTimer = 0;
              HudManager.setAmmo(ranged.currentAmmo);
            }
            world.destroyEntity(nearId);
            inv.nearbyPickupEntityId = null;
          }
        }
        inv.pickupRequested = false;
      }
    }
  }
}
