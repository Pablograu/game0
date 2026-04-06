import { Quaternion, Vector3 } from "@babylonjs/core";
import type { EntityId } from "../../core/Entity.ts";
import type { EcsSystem } from "../../core/System.ts";
import type { World } from "../../core/World.ts";
import { spawnEquippedWeaponNode } from "../../weapons/createDroppedWeaponEntity.ts";
import { CarriedWeaponType } from "../../weapons/WeaponDefinitions.ts";
import { PlayerInventoryComponent } from "../components/PlayerInventoryComponent.ts";
import { PlayerPhysicsViewRefsComponent } from "../components/PlayerPhysicsViewRefsComponent.ts";

const HAND_BONE_NAME = "mixamorig:RightHand";
const GRIP_POSITION = new Vector3(0, 0.05, 0.0);
const GRIP_ROTATION_EULER = new Vector3(0, Math.PI / 2, 0);

export class WeaponEquipSystem implements EcsSystem {
  readonly name = "WeaponEquipSystem";
  readonly order = 14;

  private readonly prevWeaponType = new Map<EntityId, CarriedWeaponType>();

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

      const curr = inv.activeWeaponType;
      const prev = this.prevWeaponType.get(playerId) ?? CarriedWeaponType.NONE;

      if (curr === prev) continue;

      this.prevWeaponType.set(playerId, curr);

      // ── Unequip existing node ──
      if (inv.equippedWeaponNode) {
        inv.equippedWeaponNode.dispose();
        inv.equippedWeaponNode = null;
      }

      // ── Equip new weapon ──
      if (curr === CarriedWeaponType.NONE) continue;

      const skeleton = refs.mesh.skeleton;
      if (!skeleton) continue;

      const bone = skeleton.bones.find((b) => b.name === HAND_BONE_NAME);
      const handTN = bone?.getTransformNode();
      if (!handTN) continue;

      const weaponNode = spawnEquippedWeaponNode();
      if (!weaponNode) continue;

      weaponNode.parent = handTN;
      weaponNode.position.copyFrom(GRIP_POSITION);
      weaponNode.rotationQuaternion =
        Quaternion.FromEulerVector(GRIP_ROTATION_EULER);

      inv.equippedWeaponNode = weaponNode;
    }
  }
}
