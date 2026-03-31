import type { TransformNode } from '@babylonjs/core';
import { LegacyPlayerRefsComponent } from '../../components/LegacyPlayerRefsComponent.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  PlayerGroundingStateComponent,
  PlayerPhysicsViewRefsComponent,
} from '../components/index.ts';

const COL_ENVIRONMENT = 0x0001;

export class PlayerGroundProbeSystem implements EcsSystem {
  readonly name = 'PlayerGroundProbeSystem';
  readonly order = 20;

  update(world: World, deltaTime: number): void {
    const entityIds = world.query(
      LegacyPlayerRefsComponent,
      PlayerGroundingStateComponent,
      PlayerPhysicsViewRefsComponent,
    );

    for (const entityId of entityIds) {
      const refs = world.getComponent(entityId, LegacyPlayerRefsComponent);
      const grounding = world.getComponent(
        entityId,
        PlayerGroundingStateComponent,
      );
      const physicsRefs = world.getComponent(
        entityId,
        PlayerPhysicsViewRefsComponent,
      );

      if (!refs || !grounding || !physicsRefs.physicsEngine) {
        continue;
      }

      grounding.jumpForce = refs.controller.jumpForce;
      grounding.jumpCutMultiplier = refs.controller.jumpCutMultiplier;
      grounding.coyoteTime = refs.controller.coyoteTime;
      grounding.jumpBufferTime = refs.controller.jumpBufferTime;

      grounding.wasGrounded = grounding.isGrounded;

      const playerPos = physicsRefs.mesh.position.clone();
      const rayStart = playerPos.clone();
      const rayEnd = playerPos.clone();
      rayEnd.y -= grounding.playerHeight / 2 + 0.55;

      physicsRefs.physicsEngine.raycastToRef(
        rayStart,
        rayEnd,
        grounding.raycastResult,
      );

      if (grounding.raycastResult.hasHit) {
        const hitBody = grounding.raycastResult.body;

        if (hitBody && this.isSurface(hitBody.transformNode)) {
          grounding.isGrounded = true;
          grounding.groundLostTimer = 0;
        } else {
          grounding.groundLostTimer += deltaTime;
          if (grounding.groundLostTimer >= grounding.groundLostGrace) {
            grounding.isGrounded = false;
          }
        }
      } else {
        grounding.groundLostTimer += deltaTime;
        if (grounding.groundLostTimer >= grounding.groundLostGrace) {
          grounding.isGrounded = false;
        }
      }

      if (grounding.isGrounded) {
        grounding.coyoteTimer = grounding.coyoteTime;
      } else if (grounding.coyoteTimer > 0) {
        grounding.coyoteTimer = Math.max(0, grounding.coyoteTimer - deltaTime);
      }
    }
  }

  private isSurface(node: TransformNode | null | undefined): boolean {
    const body = node?.physicsBody;
    const shape = body?.shape;

    if (!shape) {
      return false;
    }

    return (shape.filterMembershipMask & COL_ENVIRONMENT) !== 0;
  }
}
