import { Vector3 } from '@babylonjs/core';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  EnemyAiStateComponent,
  EnemyCombatStateComponent,
  EnemyLocomotionStateComponent,
  EnemyPatrolStateComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyStatsComponent,
  EnemyStuckStateComponent,
} from '../components/index.ts';
import { EnemyBehaviorState, EnemyLifeState } from '../EnemyStateEnums.ts';
import {
  isEnemyGameplayPaused,
  pickEnemyPatrolTarget,
  resolveEnemyPlayerCombatContext,
} from './enemyRuntimeUtils.ts';

export class EnemyStuckSystem implements EcsSystem {
  readonly name = 'EnemyStuckSystem';
  readonly order = 13;

  update(world: World, deltaTime: number): void {
    if (isEnemyGameplayPaused(world)) {
      return;
    }

    const player = resolveEnemyPlayerCombatContext(world);

    const entityIds = world.query(
      EnemyAiStateComponent,
      EnemyCombatStateComponent,
      EnemyLocomotionStateComponent,
      EnemyPatrolStateComponent,
      EnemyPhysicsViewRefsComponent,
      EnemyStatsComponent,
      EnemyStuckStateComponent,
    );

    for (const entityId of entityIds) {
      const ai = world.getComponent(entityId, EnemyAiStateComponent);
      const combat = world.getComponent(entityId, EnemyCombatStateComponent);
      const locomotion = world.getComponent(
        entityId,
        EnemyLocomotionStateComponent,
      );
      const patrol = world.getComponent(entityId, EnemyPatrolStateComponent);
      const refs = world.getComponent(entityId, EnemyPhysicsViewRefsComponent);
      const stats = world.getComponent(entityId, EnemyStatsComponent);
      const stuck = world.getComponent(entityId, EnemyStuckStateComponent);

      if (
        !ai ||
        !combat ||
        !locomotion ||
        !patrol ||
        !refs ||
        !stats ||
        !stuck
      ) {
        continue;
      }

      locomotion.overrideTimer = Math.max(
        0,
        locomotion.overrideTimer - deltaTime,
      );
      if (locomotion.overrideTimer <= 0) {
        locomotion.overrideDirection = null;
      }

      if (stats.lifeState !== EnemyLifeState.ALIVE) {
        stuck.lastPosition.copyFrom(refs.mesh.position);
        stuck.stuckTimer = 0;
        continue;
      }

      if (
        ai.current !== EnemyBehaviorState.PATROL &&
        ai.current !== EnemyBehaviorState.CHASE
      ) {
        stuck.lastPosition.copyFrom(refs.mesh.position);
        stuck.stuckTimer = 0;
        continue;
      }

      const position = refs.mesh.position;
      const deltaX = position.x - stuck.lastPosition.x;
      const deltaZ = position.z - stuck.lastPosition.z;
      const movedDistance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);

      if (movedDistance < stuck.minMovementDistance) {
        stuck.stuckTimer += deltaTime;
      } else {
        stuck.stuckTimer = 0;
      }

      stuck.lastPosition.copyFrom(position);

      if (stuck.stuckTimer < stuck.stuckThreshold) {
        continue;
      }

      stuck.stuckTimer = 0;

      if (ai.current === EnemyBehaviorState.PATROL) {
        patrol.patrolTarget = pickEnemyPatrolTarget(
          position,
          patrol.patrolRadius,
        );
        continue;
      }

      if (!player) {
        continue;
      }

      const playerPosition = player.position;
      const toPlayer = new Vector3(
        playerPosition.x - position.x,
        0,
        playerPosition.z - position.z,
      );

      if (toPlayer.lengthSquared() <= 0.0001) {
        continue;
      }

      toPlayer.normalize();
      const side = Math.random() > 0.5 ? 1 : -1;
      locomotion.overrideDirection = new Vector3(
        -toPlayer.z * side,
        0,
        toPlayer.x * side,
      ).normalize();
      locomotion.overrideTimer = 0.2;
      ai.targetYAngle = Math.atan2(
        locomotion.overrideDirection.x,
        locomotion.overrideDirection.z,
      );
    }
  }
}
