import { Quaternion, TransformNode, Vector3 } from '@babylonjs/core';
import type { EntityId } from '../../core/Entity.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { spawnEquippedWeaponNode } from '../../weapons/createDroppedWeaponEntity.ts';
import { CarriedWeaponType } from '../../weapons/WeaponDefinitions.ts';
import { PlayerInventoryComponent } from '../components/PlayerInventoryComponent.ts';
import { PlayerPhysicsViewRefsComponent } from '../components/PlayerPhysicsViewRefsComponent.ts';
import { getActiveWeaponType } from '../inventory/inventoryHelpers.ts';

const HAND_BONE_NAME = 'mixamorig:RightHand';

export const gripConfig = {
  position: new Vector3(0.1, 0.4237878620624542, -0.2691417634487152),

  rotation: Quaternion.FromEulerAngles(0, 0, 1.3),
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

      // Grip offset is baked at equip time onto the visual child node — nothing to reapply per frame.

      const curr = getActiveWeaponType(inv);
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

      // The GLB root is just a scale-compensation container. The actual model
      // lives one level below. Apply grip offset/rotation to that visual node
      // so the inspector values (which are relative to the root) match exactly.
      const visualNode =
        (weaponNode.getChildTransformNodes(true)[0] as
          | TransformNode
          | undefined) ?? weaponNode;
      visualNode.position.copyFrom(gripConfig.position);
      visualNode.rotationQuaternion = gripConfig.rotation.clone();

      console.log('arma?? ', visualNode);

      inv.equippedWeaponNode = weaponNode;
    }
  }
}
