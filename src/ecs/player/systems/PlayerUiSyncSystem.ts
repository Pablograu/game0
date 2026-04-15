import { HudManager } from '../../../HudManager.ts';
import { CarriedWeaponType } from '../../weapons/WeaponDefinitions.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  PlayerHealthStateComponent,
  PlayerInventoryComponent,
} from '../components/index.ts';
import { getActiveWeaponType } from '../inventory/inventoryHelpers.ts';

export class PlayerUiSyncSystem implements EcsSystem {
  readonly name = 'PlayerUiSyncSystem';
  readonly order = 70;

  private lastWeaponType: CarriedWeaponType = CarriedWeaponType.NONE;

  update(world: World): void {
    const entityIds = world.query(
      PlayerHealthStateComponent,
      PlayerInventoryComponent,
    );

    for (const entityId of entityIds) {
      const health = world.getComponent(entityId, PlayerHealthStateComponent);
      const inv = world.getComponent(entityId, PlayerInventoryComponent);
      if (!health || !inv) continue;

      HudManager.setHealth(health.currentHealth, health.maxHealth);

      const activeWeaponType = getActiveWeaponType(inv);

      if (activeWeaponType !== this.lastWeaponType) {
        this.lastWeaponType = activeWeaponType;
        HudManager.setWeapon(activeWeaponType);
      }
    }
  }
}
