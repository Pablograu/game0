import { Quaternion, Vector3 } from '@babylonjs/core';
import type { EntityId } from '../../core/Entity.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { spawnEquippedWeaponNode } from '../../weapons/createDroppedWeaponEntity.ts';
import { CarriedWeaponType } from '../../weapons/WeaponDefinitions.ts';
import { PlayerInventoryComponent } from '../components/PlayerInventoryComponent.ts';
import { PlayerPhysicsViewRefsComponent } from '../components/PlayerPhysicsViewRefsComponent.ts';

const HAND_BONE_NAME = 'mixamorig:RightHand';

export const gripConfig = {
  positionX: 0,
  positionY: 0.05,
  positionZ: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: Math.PI / 2,
};

export class WeaponEquipSystem implements EcsSystem {
  readonly name = 'WeaponEquipSystem';
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

      // Apply grip offset every frame so debug slider changes take effect immediately
      if (inv.equippedWeaponNode) {
        inv.equippedWeaponNode.position.set(
          gripConfig.positionX,
          gripConfig.positionY,
          gripConfig.positionZ,
        );
        inv.equippedWeaponNode.rotationQuaternion = Quaternion.FromEulerAngles(
          gripConfig.rotationX,
          gripConfig.rotationY,
          gripConfig.rotationZ,
        );
      }

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

      // For GLTF/Mixamo rigs, animation groups drive TransformNodes (one per
      // bone) that live as children of the loaded hierarchy. Find the hand
      // node by name rather than going through the Skeleton API.
      const allChildTNs = refs.mesh.getChildTransformNodes(false);
      const handTN = allChildTNs.find((n) => n.name === HAND_BONE_NAME);

      if (!handTN) {
        console.warn(
          `[WeaponEquipSystem] TransformNode "${HAND_BONE_NAME}" not found.`,
          'Available names:',
          allChildTNs.map((n) => n.name),
        );
        continue;
      }

      const weaponNode = spawnEquippedWeaponNode();
      if (!weaponNode) {
        console.warn(
          '[WeaponEquipSystem] spawnEquippedWeaponNode returned null — assets not preloaded?',
        );
        continue;
      }

      weaponNode.parent = handTN;

      // The bone's world matrix may include accumulated scale from the armature
      // (GLTF/Blender rigs often export with 0.01 scale for cm→m conversion).
      // Decompose the hand's world matrix and apply the inverse so the weapon
      // renders at proper world size regardless of the rig's inherited scale.
      handTN.computeWorldMatrix(true);

      const handWorldScale = new Vector3();
      const handWorldRot = new Quaternion();
      const handWorldPos = new Vector3();

      handTN
        .getWorldMatrix()
        .decompose(handWorldScale, handWorldRot, handWorldPos);

      weaponNode.scaling = new Vector3(
        0.5 / handWorldScale.x,
        0.5 / handWorldScale.y,
        0.5 / handWorldScale.z,
      );

      inv.equippedWeaponNode = weaponNode;
    }
  }
}
