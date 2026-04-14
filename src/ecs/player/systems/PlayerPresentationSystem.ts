import { Quaternion, Vector3 } from '@babylonjs/core';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  PlayerAnimationStateComponent,
  PlayerCombatStateComponent,
  PlayerInventoryComponent,
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerRangedStateComponent,
} from '../components/index.ts';
import { CarriedWeaponType } from '../../weapons/WeaponDefinitions.ts';

export class PlayerPresentationSystem implements EcsSystem {
  readonly name = 'PlayerPresentationSystem';
  readonly order = 65;

  update(world: World, deltaTime: number): void {
    const entityIds = world.query(
      PlayerAnimationStateComponent,
      PlayerCombatStateComponent,
      PlayerInventoryComponent,
      PlayerLocomotionStateComponent,
      PlayerPhysicsViewRefsComponent,
      PlayerRangedStateComponent,
    );

    for (const entityId of entityIds) {
      const animation = world.getComponent(
        entityId,
        PlayerAnimationStateComponent,
      );
      const combat = world.getComponent(entityId, PlayerCombatStateComponent);
      const inventory = world.getComponent(entityId, PlayerInventoryComponent);
      const locomotion = world.getComponent(
        entityId,
        PlayerLocomotionStateComponent,
      );
      const physicsRefs = world.getComponent(
        entityId,
        PlayerPhysicsViewRefsComponent,
      );
      const ranged = world.getComponent(entityId, PlayerRangedStateComponent);

      if (
        !animation ||
        !combat ||
        !inventory ||
        !locomotion ||
        !physicsRefs ||
        !ranged
      ) {
        continue;
      }

      this.applyRotation(
        animation,
        physicsRefs,
        locomotion,
        ranged,
        inventory,
        deltaTime,
      );
      this.applyScale(physicsRefs, locomotion, deltaTime);
      this.applyArmScale(physicsRefs, combat);
    }
  }

  private applyRotation(
    animation: PlayerAnimationStateComponent,
    physicsRefs: PlayerPhysicsViewRefsComponent,
    locomotion: PlayerLocomotionStateComponent,
    ranged: PlayerRangedStateComponent,
    inventory: PlayerInventoryComponent,
    deltaTime: number,
  ) {
    const isArmedAndAiming =
      inventory.activeWeaponType !== CarriedWeaponType.NONE && ranged.isAiming;

    if (!isArmedAndAiming && locomotion.moveDirection.length() <= 0.1) {
      return;
    }

    // '__layered__' has no registry entry; fall back to any entry to get the shared character root node
    const animationEntry =
      animation.animationRegistry[
        animation.currentAnimation as keyof typeof animation.animationRegistry
      ] ?? Object.values(animation.animationRegistry).find(Boolean);
    const rotationRoot = animationEntry?.root ?? physicsRefs.mesh;

    if (!rotationRoot.rotationQuaternion) {
      rotationRoot.rotationQuaternion = Quaternion.Identity();
    }

    let rotationTarget = locomotion.targetRotation;

    if (isArmedAndAiming && physicsRefs.camera) {
      const forward = physicsRefs.camera.getDirection(Vector3.Forward());
      forward.y = 0;
      if (forward.length() > 0.01) {
        forward.normalize();
        const aimAngle = Math.atan2(forward.x, forward.z);
        rotationTarget = Quaternion.FromEulerAngles(0, aimAngle, 0);
      }
    }

    const slerpFactor = Math.min(1, locomotion.rotationSpeed * deltaTime);
    rotationRoot.rotationQuaternion = Quaternion.Slerp(
      rotationRoot.rotationQuaternion,
      rotationTarget,
      slerpFactor,
    );
  }

  private applyScale(
    physicsRefs: PlayerPhysicsViewRefsComponent,
    locomotion: PlayerLocomotionStateComponent,
    deltaTime: number,
  ) {
    const lerpFactor = Math.min(1, locomotion.scaleSpeed * deltaTime);
    physicsRefs.mesh.scaling = Vector3.Lerp(
      physicsRefs.mesh.scaling,
      locomotion.targetScale,
      lerpFactor,
    );
  }

  private applyArmScale(
    physicsRefs: PlayerPhysicsViewRefsComponent,
    combat: PlayerCombatStateComponent,
  ) {
    const skeleton = physicsRefs.mesh.skeleton;
    if (!skeleton) {
      return;
    }

    const scale = combat.isAttacking ? 1.5 : 1;
    for (const bone of skeleton.bones.filter((candidate) =>
      /arm/i.test(candidate.name),
    )) {
      const transformNode = bone.getTransformNode();
      transformNode?.scaling.setAll(scale);
    }
  }
}
