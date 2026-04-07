import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { DroppedWeaponDataComponent } from '../../weapons/components/DroppedWeaponDataComponent.ts';
import { DroppedWeaponMeshComponent } from '../../weapons/components/DroppedWeaponMeshComponent.ts';
import { createDroppedWeaponEntity } from '../../weapons/createDroppedWeaponEntity.ts';
import { CarriedWeaponType } from '../../weapons/WeaponDefinitions.ts';
import { PlayerInventoryComponent } from '../components/PlayerInventoryComponent.ts';
import { PlayerPhysicsViewRefsComponent } from '../components/PlayerPhysicsViewRefsComponent.ts';
import { PlayerRangedStateComponent } from '../components/PlayerRangedStateComponent.ts';

export class WeaponPickupSystem implements EcsSystem {
  readonly name = 'WeaponPickupSystem';
  readonly order = 13;

  update(world: World): void {
    const players = world.query(
      PlayerInventoryComponent,
      PlayerPhysicsViewRefsComponent,
    );

    for (const playerId of players) {
      const inv = world.getComponent(playerId, PlayerInventoryComponent)!;
      const refs = world.getComponent(
        playerId,
        PlayerPhysicsViewRefsComponent,
      )!;
      const ranged = world.getComponent(playerId, PlayerRangedStateComponent);

      // ── Pickup ──
      if (inv.pickupRequested) {
        const nearId = inv.nearbyWeaponEntityId;
        if (nearId !== null && world.hasEntity(nearId)) {
          const meshComp = world.getComponent(
            nearId,
            DroppedWeaponMeshComponent,
          )!;
          const dataComp = world.getComponent(
            nearId,
            DroppedWeaponDataComponent,
          )!;
          meshComp.floatAnimatable?.stop();
          meshComp.node.dispose();
          const def = dataComp.definition;
          inv.slots[def.type] = def;
          inv.activeWeaponType = def.type;
          if (ranged) {
            ranged.currentAmmo = def.maxAmmo;
            ranged.fireTimer = 0;
            ranged.isReloading = false;
            ranged.reloadTimer = 0;
          }
          world.destroyEntity(nearId);
          inv.nearbyWeaponEntityId = null;
        }
        inv.pickupRequested = false;
      }

      // ── Drop ──
      if (inv.dropRequested) {
        if (inv.activeWeaponType !== CarriedWeaponType.NONE) {
          createDroppedWeaponEntity(
            world,
            refs.scene,
            refs.mesh.getAbsolutePosition(),
            inv.activeWeaponType,
          );
          delete inv.slots[inv.activeWeaponType];
          inv.activeWeaponType = CarriedWeaponType.NONE;
          if (ranged) {
            ranged.currentAmmo = 0;
            ranged.isAiming = false;
          }
        }
        inv.dropRequested = false;
      }
    }
  }
}
