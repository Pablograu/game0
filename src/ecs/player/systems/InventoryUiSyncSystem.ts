import { HudManager } from '../../../HudManager.ts';
import { InventoryUiManager } from '../../../InventoryUiManager.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { GameFlowStateComponent } from '../../game/components/index.ts';
import { GameFlowState } from '../../game/GameFlowState.ts';
import { WEAPON_DEFINITIONS } from '../../weapons/WeaponDefinitions.ts';
import { PlayerInventoryComponent } from '../components/index.ts';
import { isInventoryWeaponItem } from '../inventory/InventoryItemDefinitions.ts';

export class InventoryUiSyncSystem implements EcsSystem {
  readonly name = 'InventoryUiSyncSystem';
  readonly order = 71;

  private wasVisible = false;

  constructor(private readonly inventoryUi: InventoryUiManager) {}

  update(world: World): void {
    const [gameFlowEntityId] = world.query(GameFlowStateComponent);
    const [playerEntityId] = world.query(PlayerInventoryComponent);
    const gameFlow = gameFlowEntityId
      ? world.getComponent(gameFlowEntityId, GameFlowStateComponent)
      : null;
    const inventory = playerEntityId
      ? world.getComponent(playerEntityId, PlayerInventoryComponent)
      : null;
    const isVisible = gameFlow?.current === GameFlowState.INVENTORY;

    if (!inventory) {
      if (this.wasVisible) {
        this.inventoryUi.setVisible(false);
        HudManager.setVisible(true);
        this.wasVisible = false;
      }
      return;
    }

    if (isVisible !== this.wasVisible) {
      this.wasVisible = isVisible;
      this.inventoryUi.setVisible(isVisible);
      HudManager.setVisible(!isVisible);

      if (isVisible) {
        inventory.isDirty = true;
      }
    }

    if (!isVisible || !inventory.isDirty) {
      return;
    }

    this.inventoryUi.syncInventoryUi({
      capacity: inventory.capacity,
      items: inventory.backpack.map((item) => {
        const weaponDefinition = isInventoryWeaponItem(item)
          ? WEAPON_DEFINITIONS[item.weaponType]
          : null;

        return {
          id: item.id,
          label: item.shortLabel,
          meta: isInventoryWeaponItem(item)
            ? `${item.currentAmmo}/${weaponDefinition?.maxAmmo ?? item.currentAmmo}`
            : `x${item.quantity}`,
          detail: item.label,
          kind: item.kind,
          isActive: inventory.activeWeaponItemId === item.id,
        };
      }),
    });
    inventory.isDirty = false;
  }
}
