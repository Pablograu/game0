import { Quaternion, Vector3 } from '@babylonjs/core';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  PlayerAnimationStateComponent,
  PlayerCombatStateComponent,
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
} from '../components/index.ts';

export class PlayerPresentationSystem implements EcsSystem {
  readonly name = 'PlayerPresentationSystem';
  readonly order = 65;

  update(world: World, deltaTime: number): void {
    const entityIds = world.query(
      PlayerAnimationStateComponent,
      PlayerCombatStateComponent,
      PlayerLocomotionStateComponent,
      PlayerPhysicsViewRefsComponent,
    );

    for (const entityId of entityIds) {
      const animation = world.getComponent(
        entityId,
        PlayerAnimationStateComponent,
      );
      const combat = world.getComponent(entityId, PlayerCombatStateComponent);
      const locomotion = world.getComponent(
        entityId,
        PlayerLocomotionStateComponent,
      );
      const physicsRefs = world.getComponent(
        entityId,
        PlayerPhysicsViewRefsComponent,
      );

      if (!animation || !combat || !locomotion || !physicsRefs) {
        continue;
      }

      this.applyRotation(animation, physicsRefs, locomotion, deltaTime);
      this.applyScale(physicsRefs, locomotion, deltaTime);
      this.applyArmScale(physicsRefs, combat);
    }
  }

  private applyRotation(
    animation: PlayerAnimationStateComponent,
    physicsRefs: PlayerPhysicsViewRefsComponent,
    locomotion: PlayerLocomotionStateComponent,
    deltaTime: number,
  ) {
    if (locomotion.moveDirection.length() <= 0.1) {
      return;
    }

    const animationEntry =
      animation.animationRegistry[
        animation.currentAnimation as keyof typeof animation.animationRegistry
      ];
    const rotationTarget = locomotion.targetRotation;
    const rotationRoot = animationEntry?.root ?? physicsRefs.mesh;

    if (!rotationRoot.rotationQuaternion) {
      rotationRoot.rotationQuaternion = Quaternion.Identity();
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
