import { Vector3, type TransformNode } from '@babylonjs/core';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  PlayerGameplayConfigComponent,
  PlayerGroundingStateComponent,
  PlayerPhysicsViewRefsComponent,
} from '../components/index.ts';

const COL_ENVIRONMENT = 0x0001;
const GROUND_PROBE_MARGIN = 0.2;
const GROUND_PROBE_RADIUS_SCALE = 0.6;
const GROUND_PROBE_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export class PlayerGroundProbeSystem implements EcsSystem {
  readonly name = 'PlayerGroundProbeSystem';
  readonly order = 20;

  update(world: World, deltaTime: number): void {
    const entityIds = world.query(
      PlayerGameplayConfigComponent,
      PlayerGroundingStateComponent,
      PlayerPhysicsViewRefsComponent,
    );

    for (const entityId of entityIds) {
      const config = world.getComponent(
        entityId,
        PlayerGameplayConfigComponent,
      );
      const grounding = world.getComponent(
        entityId,
        PlayerGroundingStateComponent,
      );
      const physicsRefs = world.getComponent(
        entityId,
        PlayerPhysicsViewRefsComponent,
      );

      if (!config || !grounding || !physicsRefs.physicsEngine) {
        continue;
      }

      grounding.jumpForce = config.jumpForce;
      grounding.jumpCutMultiplier = config.jumpCutMultiplier;
      grounding.coyoteTime = config.coyoteTime;
      grounding.jumpBufferTime = config.jumpBufferTime;

      grounding.wasGrounded = grounding.isGrounded;

      const hasGroundHit = this.detectGroundHit(physicsRefs, grounding);

      if (hasGroundHit) {
        grounding.isGrounded = true;
        grounding.groundLostTimer = 0;
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

  private detectGroundHit(
    physicsRefs: PlayerPhysicsViewRefsComponent,
    grounding: PlayerGroundingStateComponent,
  ): boolean {
    const playerPos = physicsRefs.mesh.getAbsolutePosition();
    const probeRadius = Math.max(
      0.1,
      grounding.playerRadius * GROUND_PROBE_RADIUS_SCALE,
    );
    const probeLength =
      grounding.playerHeight / 2 + grounding.playerRadius + GROUND_PROBE_MARGIN;

    for (const [xScale, zScale] of GROUND_PROBE_POINTS) {
      const rayStart = new Vector3(
        playerPos.x + xScale * probeRadius,
        playerPos.y,
        playerPos.z + zScale * probeRadius,
      );
      const rayEnd = new Vector3(rayStart.x, rayStart.y - probeLength, rayStart.z);

      physicsRefs.physicsEngine?.raycastToRef(
        rayStart,
        rayEnd,
        grounding.raycastResult,
        {
          collideWith: COL_ENVIRONMENT,
          ignoreBody: physicsRefs.body ?? undefined,
        },
      );

      if (this.isGroundHit(physicsRefs, grounding)) {
        return true;
      }
    }

    return false;
  }

  private isGroundHit(
    physicsRefs: PlayerPhysicsViewRefsComponent,
    grounding: PlayerGroundingStateComponent,
  ): boolean {
    if (!grounding.raycastResult.hasHit) {
      return false;
    }

    const hitBody = grounding.raycastResult.body;
    if (!hitBody || hitBody === physicsRefs.body) {
      return false;
    }

    return this.isSurface(hitBody.transformNode);
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
