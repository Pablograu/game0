import type { Mesh, Skeleton, Vector3 } from '@babylonjs/core';
import type { World } from '../core/World.ts';
import type { EntityId } from '../core/Entity.ts';
import {
  PlayerCombatStateComponent,
  PlayerControlStateComponent,
  PlayerGameplayConfigComponent,
  PlayerGroundingStateComponent,
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerRagdollStateComponent,
  PlayerSurvivabilityRequestComponent,
} from './components/index.ts';
import { PlayerRagdollMode } from './PlayerStateEnums.ts';

export interface PlayerCombatTargetApi {
  takeDamage(amount: number, damageSourcePosition?: Vector3 | null): void;
  getCollisionMesh(): Mesh;
  getWorldPosition(): Vector3;
}

export function createPlayerCombatTargetApi(
  world: World,
  entityId: EntityId,
): PlayerCombatTargetApi {
  const getPhysicsRefs = () => {
    const component = world.getComponent(
      entityId,
      PlayerPhysicsViewRefsComponent,
    );

    if (!component) {
      throw new Error(
        `PlayerPhysicsViewRefsComponent is missing from player entity ${entityId}.`,
      );
    }

    return component;
  };

  const getRequests = () => {
    const component = world.getComponent(
      entityId,
      PlayerSurvivabilityRequestComponent,
    );

    if (!component) {
      throw new Error(
        `PlayerSurvivabilityRequestComponent is missing from player entity ${entityId}.`,
      );
    }

    return component;
  };

  return {
    takeDamage(amount: number, damageSourcePosition: Vector3 | null = null) {
      getRequests().damageRequests.push({
        amount,
        damageSourcePosition: damageSourcePosition?.clone() ?? null,
      });
    },
    getCollisionMesh() {
      return getPhysicsRefs().mesh;
    },
    getWorldPosition() {
      return getPhysicsRefs().mesh.getAbsolutePosition().clone();
    },
  };
}

export function initializePlayerRagdoll(
  world: World,
  entityId: EntityId,
  skeleton: Skeleton,
  armatureNode: Mesh,
) {
  const ragdoll = world.getComponent(entityId, PlayerRagdollStateComponent);

  if (!ragdoll) {
    throw new Error(
      `PlayerRagdollStateComponent is missing from player entity ${entityId}.`,
    );
  }

  disposeRagdoll(ragdoll.ragdoll);
  ragdoll.ragdollSkeleton = skeleton;
  ragdoll.ragdollArmatureNode = armatureNode;
  ragdoll.ragdoll = null;
  ragdoll.mode = PlayerRagdollMode.DEFERRED;
}

export function configurePlayerTuning(
  world: World,
  entityId: EntityId,
  config: {
    moveSpeed?: number;
    jumpForce?: number;
    dashSpeed?: number;
    magnetismRange?: number;
    coyoteTime?: number;
  },
) {
  const gameplay = world.getComponent(entityId, PlayerGameplayConfigComponent);
  const locomotion = world.getComponent(
    entityId,
    PlayerLocomotionStateComponent,
  );
  const grounding = world.getComponent(entityId, PlayerGroundingStateComponent);
  const combat = world.getComponent(entityId, PlayerCombatStateComponent);

  if (!gameplay || !locomotion || !grounding || !combat) {
    throw new Error(
      `Player tuning components are missing from entity ${entityId}.`,
    );
  }

  if (config.moveSpeed !== undefined) {
    gameplay.moveSpeed = config.moveSpeed;
    locomotion.moveSpeed = config.moveSpeed;
    locomotion.normalMoveSpeed = config.moveSpeed;
  }

  if (config.jumpForce !== undefined) {
    gameplay.jumpForce = config.jumpForce;
    grounding.jumpForce = config.jumpForce;
  }

  if (config.dashSpeed !== undefined) {
    gameplay.dashSpeed = config.dashSpeed;
    locomotion.dashSpeed = config.dashSpeed;
  }

  if (config.magnetismRange !== undefined) {
    gameplay.magnetismRange = config.magnetismRange;
    combat.magnetismRange = config.magnetismRange;
  }

  if (config.coyoteTime !== undefined) {
    gameplay.coyoteTime = config.coyoteTime;
    grounding.coyoteTime = config.coyoteTime;
  }
}

export function pausePlayerInput(world: World, entityId: EntityId) {
  const control = world.getComponent(entityId, PlayerControlStateComponent);
  const locomotion = world.getComponent(
    entityId,
    PlayerLocomotionStateComponent,
  );

  if (!control || !locomotion) {
    throw new Error(
      `Player input components are missing from entity ${entityId}.`,
    );
  }

  control.inputEnabled = false;
  control.inputMap = {};
  control.moveInputX = 0;
  control.moveInputZ = 0;
  control.dashRequested = false;
  control.attackRequested = false;
  control.danceToggleRequested = false;
  locomotion.isDashing = false;
}

export function resumePlayerInput(world: World, entityId: EntityId) {
  const control = world.getComponent(entityId, PlayerControlStateComponent);

  if (!control) {
    throw new Error(
      `PlayerControlStateComponent is missing from entity ${entityId}.`,
    );
  }

  control.inputEnabled = true;
}

function disposeRagdoll(ragdoll: unknown | null) {
  if (!ragdoll || typeof ragdoll !== 'object' || !('dispose' in ragdoll)) {
    return;
  }

  (ragdoll as { dispose(): void }).dispose();
}
