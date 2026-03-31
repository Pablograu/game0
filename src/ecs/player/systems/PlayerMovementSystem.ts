import { Vector3 } from '@babylonjs/core';
import { LegacyPlayerRefsComponent } from '../../components/LegacyPlayerRefsComponent.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { PlayerLocomotionMode } from '../PlayerStateEnums.ts';
import {
  PlayerControlStateComponent,
  PlayerGroundingStateComponent,
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
      PlayerGroundingStateComponent,
      PlayerLocomotionStateComponent,
      PlayerPhysicsViewRefsComponent,
    );

    for (const entityId of entityIds) {
      const refs = world.getComponent(entityId, LegacyPlayerRefsComponent);
      const control = world.getComponent(entityId, PlayerControlStateComponent);
      const grounding = world.getComponent(
        entityId,
        PlayerGroundingStateComponent,
      );
      const locomotion = world.getComponent(
        entityId,
        PlayerLocomotionStateComponent,
      );
      const physicsRefs = world.getComponent(
        entityId,
        PlayerPhysicsViewRefsComponent,
      );

      if (!refs || !control || !grounding || !locomotion || !physicsRefs.body) {
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

      if (locomotion.isDashing || refs.controller.currentHealth <= 0) {
        continue;
      }

      locomotion.isKnockedBack = refs.controller.isKnockedBack;
      locomotion.knockbackDuration = refs.controller.knockbackDuration;

      if (refs.controller.isKnockedBack) {
        refs.controller.knockbackDuration = Math.max(
          0,
          refs.controller.knockbackDuration - deltaTime,
        );

        if (refs.controller.knockbackDuration <= 0) {
          refs.controller.isKnockedBack = false;
        }

        locomotion.isKnockedBack = refs.controller.isKnockedBack;
        locomotion.knockbackDuration = refs.controller.knockbackDuration;
        locomotion.mode = PlayerLocomotionMode.KNOCKBACK;
        physicsRefs.body.setAngularVelocity(Vector3.Zero());
        continue;
      }

      if (
        refs.controller.isAttacking &&
        !grounding.isGrounded &&
        moveDirection.length() > 0.1
      ) {
        continue;
      }

      locomotion.recoilVelocity.copyFrom(refs.controller.recoilVelocity);

      if (locomotion.recoilVelocity.length() > 0.1) {
        locomotion.recoilVelocity = locomotion.recoilVelocity.scale(
          1 - locomotion.recoilDecay * deltaTime,
        );
      } else {
        locomotion.recoilVelocity = Vector3.Zero();
      }

      refs.controller.recoilVelocity = locomotion.recoilVelocity.clone();

      const currentVelocity = physicsRefs.body.getLinearVelocity();
      const effectiveMoveSpeed = refs.controller.isAttacking
        ? refs.controller.moveSpeed * refs.controller.attackMoveSpeedMultiplier
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
