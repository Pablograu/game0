import { Vector3 } from '@babylonjs/core';
import { AudioManager } from '../../../AudioManager.ts';
import { EffectManager } from '../../../EffectManager.ts';
import { LegacyPlayerRefsComponent } from '../../components/LegacyPlayerRefsComponent.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { PlayerJumpPhaseState } from '../PlayerStateEnums.ts';
import {
  PlayerControlStateComponent,
  PlayerGroundingStateComponent,
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
} from '../components/index.ts';

export class PlayerJumpSystem implements EcsSystem {
  readonly name = 'PlayerJumpSystem';
  readonly order = 40;

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

      if (grounding.jumpBufferTimer > 0) {
        grounding.jumpBufferTimer = Math.max(
          0,
          grounding.jumpBufferTimer - deltaTime,
        );
      }

      control.jumpBufferTime = grounding.jumpBufferTime;
      control.jumpBufferTimer = grounding.jumpBufferTimer;

      if (locomotion.isDashing || refs.controller.currentHealth <= 0) {
        continue;
      }

      const currentVelocity = physicsRefs.body.getLinearVelocity();
      const canJump = grounding.isGrounded || grounding.coyoteTimer > 0;
      const shouldJump =
        control.inputEnabled && grounding.jumpBufferTimer > 0 && canJump;

      if (shouldJump) {
        physicsRefs.body.setLinearVelocity(
          new Vector3(
            currentVelocity.x,
            grounding.jumpForce,
            currentVelocity.z,
          ),
        );
        grounding.jumpBufferTimer = 0;
        control.jumpBufferTimer = 0;
        grounding.coyoteTimer = 0;
        grounding.jumpPhase = PlayerJumpPhaseState.RISING;
        grounding.airTime = 0;

        AudioManager.play('player_jump');

        const dustPosition = physicsRefs.mesh.getAbsolutePosition().clone();
        dustPosition.y -= grounding.playerHeight / 2;
        EffectManager.showDust(dustPosition, {
          count: 12,
          duration: 0.35,
          direction: 'up',
        });
      }

      const velocityAfterJump = physicsRefs.body.getLinearVelocity();

      if (
        control.jumpKeyReleased &&
        velocityAfterJump.y > 0 &&
        !grounding.isGrounded
      ) {
        physicsRefs.body.setLinearVelocity(
          new Vector3(
            velocityAfterJump.x,
            velocityAfterJump.y * grounding.jumpCutMultiplier,
            velocityAfterJump.z,
          ),
        );
        control.jumpKeyReleased = false;
      }
    }
  }
}
