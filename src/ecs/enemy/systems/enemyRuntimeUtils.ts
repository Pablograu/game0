import {
  Matrix,
  Quaternion,
  Vector3,
  type AnimationGroup,
} from '@babylonjs/core';
import type { World } from '../../core/World.ts';
import { GameFlowStateComponent } from '../../game/components/index.ts';
import { GameFlowState } from '../../game/GameFlowState.ts';
import {
  PlayerHealthStateComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerSurvivabilityRequestComponent,
} from '../../player/components/index.ts';
import { PlayerLifeState } from '../../player/PlayerStateEnums.ts';
import type {
  EnemyAiStateComponent,
  EnemyAnimationStateComponent,
  EnemyCombatStateComponent,
  EnemyPhysicsViewRefsComponent,
} from '../components/index.ts';
import { EnemyBehaviorState, EnemyCombatMode } from '../EnemyStateEnums.ts';

export function isEnemyGameplayPaused(world: World): boolean {
  const entityIds = world.query(GameFlowStateComponent);

  for (const entityId of entityIds) {
    const state = world.getComponent(entityId, GameFlowStateComponent);
    if (!state) {
      continue;
    }

    return state.current !== GameFlowState.PLAYING;
  }

  return false;
}

export function transitionEnemyBehavior(
  ai: EnemyAiStateComponent,
  combat: EnemyCombatStateComponent,
  next: EnemyBehaviorState,
) {
  if (ai.current === next) {
    return false;
  }

  ai.previous = ai.current;
  ai.current = next;
  ai.stateElapsedTime = 0;

  switch (next) {
    case EnemyBehaviorState.ATTACK:
      combat.mode = EnemyCombatMode.ATTACK;
      break;
    case EnemyBehaviorState.HIT:
      combat.mode = EnemyCombatMode.HIT;
      break;
    case EnemyBehaviorState.DEAD:
      combat.mode = EnemyCombatMode.DEAD;
      break;
    default:
      combat.mode = EnemyCombatMode.IDLE;
      break;
  }

  return true;
}

export interface EnemyPlayerCombatContext {
  physicsRefs: PlayerPhysicsViewRefsComponent;
  health: PlayerHealthStateComponent;
  requests: PlayerSurvivabilityRequestComponent;
  position: Vector3;
}

export function resolveEnemyPlayerCombatContext(
  world: World,
): EnemyPlayerCombatContext | null {
  const playerIds = world.query(
    PlayerHealthStateComponent,
    PlayerPhysicsViewRefsComponent,
    PlayerSurvivabilityRequestComponent,
  );

  for (const playerId of playerIds) {
    const physicsRefs = world.getComponent(
      playerId,
      PlayerPhysicsViewRefsComponent,
    );
    const health = world.getComponent(playerId, PlayerHealthStateComponent);
    const requests = world.getComponent(
      playerId,
      PlayerSurvivabilityRequestComponent,
    );

    if (!physicsRefs || !health || !requests) {
      continue;
    }

    return {
      physicsRefs,
      health,
      requests,
      position: physicsRefs.mesh.getAbsolutePosition().clone(),
    };
  }

  return null;
}

export function computeEnemyDistanceToPlayer(
  player: EnemyPlayerCombatContext | null,
  refs: EnemyPhysicsViewRefsComponent,
): number {
  if (!player) {
    return Number.POSITIVE_INFINITY;
  }

  const enemyPosition = refs.mesh.getAbsolutePosition();
  const playerPosition = player.position;
  const deltaX = playerPosition.x - enemyPosition.x;
  const deltaZ = playerPosition.z - enemyPosition.z;
  return Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
}

export function queueDamageToPlayer(
  player: EnemyPlayerCombatContext | null,
  amount: number,
  damageSourcePosition: Vector3,
) {
  if (!player || player.health.lifeState !== PlayerLifeState.ALIVE) {
    return false;
  }

  player.requests.damageRequests.push({
    amount,
    damageSourcePosition: damageSourcePosition.clone(),
  });

  return true;
}

export function pickEnemyPatrolTarget(position: Vector3, patrolRadius: number) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 3 + Math.random() * patrolRadius;
  return new Vector3(
    position.x + Math.cos(angle) * radius,
    position.y,
    position.z + Math.sin(angle) * radius,
  );
}

export function findEnemyAnimationGroup(
  animation: EnemyAnimationStateComponent,
  name: string,
): AnimationGroup | null {
  const lowerName = name.toLowerCase();
  const exact = animation.animationGroups.get(lowerName);

  if (exact) {
    return exact;
  }

  for (const [key, group] of animation.animationGroups) {
    if (key.includes(lowerName) || lowerName.includes(key)) {
      return group;
    }
  }

  return null;
}

export function getEnemyAnimationDuration(
  animation: EnemyAnimationStateComponent,
  name: string,
  speedRatio: number,
) {
  const animationGroup = findEnemyAnimationGroup(animation, name);
  if (!animationGroup) {
    return 0;
  }

  const frameRate =
    animationGroup.targetedAnimations[0]?.animation.framePerSecond ?? 30;

  return (
    (animationGroup.to - animationGroup.from) /
    frameRate /
    Math.max(speedRatio, 0.01)
  );
}

export function getEnemyForwardDirection(
  refs: EnemyPhysicsViewRefsComponent,
): Vector3 {
  let forwardDirection = new Vector3(0, 0, 1);

  if (refs.root.rotationQuaternion) {
    const rotationMatrix = new Matrix();
    refs.root.rotationQuaternion.toRotationMatrix(rotationMatrix);
    forwardDirection = Vector3.TransformCoordinates(
      new Vector3(0, 0, 1),
      rotationMatrix,
    );
  }

  forwardDirection.y = 0;

  if (forwardDirection.lengthSquared() <= 0.0001) {
    return new Vector3(0, 0, 1);
  }

  return forwardDirection.normalize();
}

export function rotateEnemyTowardTarget(
  refs: EnemyPhysicsViewRefsComponent,
  ai: EnemyAiStateComponent,
  deltaTime: number,
) {
  if (!refs.root.rotationQuaternion) {
    refs.root.rotationQuaternion = Quaternion.Identity();
  }

  const targetQuaternion = Quaternion.FromEulerAngles(0, ai.targetYAngle, 0);
  Quaternion.SlerpToRef(
    refs.root.rotationQuaternion,
    targetQuaternion,
    Math.min(1, ai.rotationSpeed * deltaTime),
    refs.root.rotationQuaternion,
  );
}
