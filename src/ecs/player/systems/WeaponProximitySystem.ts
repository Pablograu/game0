import { Vector3 } from "@babylonjs/core";
import type { EntityId } from "../../core/Entity.ts";
import type { EcsSystem } from "../../core/System.ts";
import type { World } from "../../core/World.ts";
import { DroppedWeaponDataComponent } from "../../weapons/components/DroppedWeaponDataComponent.ts";
import { DroppedWeaponMeshComponent } from "../../weapons/components/DroppedWeaponMeshComponent.ts";
import { PlayerInventoryComponent } from "../components/PlayerInventoryComponent.ts";
import { PlayerPhysicsViewRefsComponent } from "../components/PlayerPhysicsViewRefsComponent.ts";

const PICKUP_RADIUS = 2.0;

export class WeaponProximitySystem implements EcsSystem {
  readonly name = "WeaponProximitySystem";
  readonly order = 12;

  update(world: World, deltaTime: number): void {
    // ── TTL tick — collect expired, dispose, then destroy after loop ──
    const weaponIds = world.query(
      DroppedWeaponDataComponent,
      DroppedWeaponMeshComponent,
    );
    const toDestroy: EntityId[] = [];

    for (const id of weaponIds) {
      const data = world.getComponent(id, DroppedWeaponDataComponent)!;
      const meshComp = world.getComponent(id, DroppedWeaponMeshComponent)!;
      data.elapsed += deltaTime;
      if (data.elapsed >= data.ttl) {
        meshComp.floatAnimatable?.stop();
        meshComp.node.dispose();
        toDestroy.push(id);
      }
    }

    for (const id of toDestroy) {
      world.destroyEntity(id);
    }

    // ── Proximity detection ──
    const survivors = world.query(
      DroppedWeaponDataComponent,
      DroppedWeaponMeshComponent,
    );
    const players = world.query(
      PlayerInventoryComponent,
      PlayerPhysicsViewRefsComponent,
    );

    for (const playerId of players) {
      const inventory = world.getComponent(playerId, PlayerInventoryComponent)!;
      const refs = world.getComponent(
        playerId,
        PlayerPhysicsViewRefsComponent,
      )!;

      const playerPos = refs.mesh.getAbsolutePosition();
      let closestId: EntityId | null = null;
      let closestDist = PICKUP_RADIUS;

      for (const wid of survivors) {
        const meshComp = world.getComponent(wid, DroppedWeaponMeshComponent)!;
        const d = Vector3.Distance(
          playerPos,
          meshComp.node.getAbsolutePosition(),
        );
        if (d < closestDist) {
          closestDist = d;
          closestId = wid;
        }
      }

      inventory.nearbyWeaponEntityId = closestId;
    }
  }
}
