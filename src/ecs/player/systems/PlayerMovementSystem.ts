import { Vector3 } from '@babylonjs/core';
import { LegacyPlayerRefsComponent } from '../../components/LegacyPlayerRefsComponent.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { PlayerLifeState, PlayerLocomotionMode } from '../PlayerStateEnums.ts';
import {
  PlayerCombatStateComponent,
  PlayerControlStateComponent,
  PlayerGroundingStateComponent,
  PlayerHealthStateComponent,
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
} from '../components/index.ts';

export class PlayerMovementSystem implements EcsSystem {
  readonly name = 'PlayerMovementSystem';
  readonly order = 50;

  update(world: World, deltaTime: number): void {
    const entityIds = world.query(
      LegacyPlayerRefsComponent,
      PlayerControlStateComponent,
      PlayerCombatStateComponent,
      PlayerGroundingStateComponent,
      PlayerHealthStateComponent,
      PlayerLocomotionStateComponent,
      PlayerPhysicsViewRefsComponent,
    );

    for (const entityId of entityIds) {
      const refs = world.getComponent(entityId, LegacyPlayerRefsComponent);
      const control = world.getComponent(entityId, PlayerControlStateComponent);
      const combat = world.getComponent(entityId, PlayerCombatStateComponent);
      const grounding = world.getComponent(
        entityId,
        PlayerGroundingStateComponent,
      );
      const health = world.getComponent(entityId, PlayerHealthStateComponent);
      const locomotion = world.getComponent(
        entityId,
        PlayerLocomotionStateComponent,
      );
      const physicsRefs = world.getComponent(
        entityId,
        PlayerPhysicsViewRefsComponent,
      );

      if (
        !refs ||
        !control ||
        !combat ||
        !grounding ||
        !health ||
        !locomotion ||
        !physicsRefs.body
      ) {
        continue;
      }

      locomotion.moveSpeed = refs.controller.moveSpeed;
      locomotion.normalMoveSpeed = refs.controller.normalMoveSpeed;
      locomotion.rotationSpeed = refs.controller.rotationSpeed;
      locomotion.recoilForce = refs.controller.recoilForce;
      locomotion.recoilDecay = refs.controller.recoilDecay;
      locomotion.pogoForce = refs.controller.pogoForce;
      locomotion.damageKnockbackForce = refs.controller.damageKnockbackForce;
      locomotion.originalScale = refs.controller.originalScale.clone();

      const moveDirection = this.getMoveDirection(
        physicsRefs.camera,
        control.inputEnabled ? control.moveInputX : 0,
        control.inputEnabled ? control.moveInputZ : 0,
      );

      locomotion.moveDirection.copyFrom(moveDirection);

      if (moveDirection.length() > 0.1) {
        locomotion.lastFacingDirection = moveDirection.clone();
      }

      if (locomotion.isDashing || health.lifeState !== PlayerLifeState.ALIVE) {
        continue;
      }

      if (locomotion.isKnockedBack) {
        locomotion.knockbackDuration = Math.max(
          0,
          locomotion.knockbackDuration - deltaTime,
        );

        if (locomotion.knockbackDuration <= 0) {
          locomotion.isKnockedBack = false;
        }

        locomotion.mode = PlayerLocomotionMode.KNOCKBACK;
        physicsRefs.body.setAngularVelocity(Vector3.Zero());
        continue;
      }

      if (
        combat.isAttacking &&
        !grounding.isGrounded &&
        moveDirection.length() > 0.1
      ) {
        continue;
      }

      if (locomotion.recoilVelocity.length() > 0.1) {
        locomotion.recoilVelocity = locomotion.recoilVelocity.scale(
          1 - locomotion.recoilDecay * deltaTime,
        );
      } else {
        locomotion.recoilVelocity = Vector3.Zero();
      }

      const currentVelocity = physicsRefs.body.getLinearVelocity();
      const effectiveMoveSpeed = combat.isAttacking
        ? refs.controller.moveSpeed * combat.attackMoveSpeedMultiplier
        : refs.controller.moveSpeed;

      physicsRefs.body.setLinearVelocity(
        new Vector3(
          moveDirection.x * effectiveMoveSpeed + locomotion.recoilVelocity.x,
          currentVelocity.y,
          moveDirection.z * effectiveMoveSpeed + locomotion.recoilVelocity.z,
        ),
      );
      physicsRefs.body.setAngularVelocity(Vector3.Zero());

      refs.controller.updateRotation(moveDirection, deltaTime);
      locomotion.targetRotation = refs.controller.targetRotation.clone();
      locomotion.targetAngle = Math.atan2(moveDirection.x, moveDirection.z);
      locomotion.isMoving = moveDirection.length() > 0.1;
      locomotion.mode = locomotion.isMoving
        ? PlayerLocomotionMode.MOVING
        : PlayerLocomotionMode.IDLE;
    }
  }

  private getMoveDirection(
    camera: PlayerPhysicsViewRefsComponent['camera'],
    moveInputX: number,
    moveInputZ: number,
  ) {
    if (!camera) {
      return Vector3.Zero();
    }

    const forward = camera.getDirection(Vector3.Forward());
    const right = camera.getDirection(Vector3.Right());

    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    const direction = Vector3.Zero();
    direction.addInPlace(forward.scale(moveInputZ));
    direction.addInPlace(right.scale(moveInputX));

    if (direction.length() > 0) {
      direction.normalize();
    }

    return direction;
  }
}
