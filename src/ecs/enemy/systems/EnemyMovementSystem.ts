import { Quaternion, Vector3 } from '@babylonjs/core';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  EnemyAiStateComponent,
  EnemyAttackStateComponent,
  EnemyCombatStateComponent,
  EnemyLocomotionStateComponent,
  EnemyPatrolStateComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyStatsComponent,
} from '../components/index.ts';
import { EnemyBehaviorState, EnemyLifeState } from '../EnemyStateEnums.ts';
import {
  isEnemyGameplayPaused,
  resolveEnemyPlayerCombatContext,
  rotateEnemyTowardTarget,
} from './enemyRuntimeUtils.ts';

export class EnemyMovementSystem implements EcsSystem {
  readonly name = 'EnemyMovementSystem';
  readonly order = 14;

  update(world: World, deltaTime: number): void {
    if (isEnemyGameplayPaused(world)) {
      return;
    }

    const player = resolveEnemyPlayerCombatContext(world);

    const entityIds = world.query(
      EnemyAiStateComponent,
      EnemyAttackStateComponent,
      EnemyCombatStateComponent,
      EnemyLocomotionStateComponent,
      EnemyPatrolStateComponent,
      EnemyPhysicsViewRefsComponent,
      EnemyStatsComponent,
    );

    for (const entityId of entityIds) {
      const ai = world.getComponent(entityId, EnemyAiStateComponent);
      const attack = world.getComponent(entityId, EnemyAttackStateComponent);
      const combat = world.getComponent(entityId, EnemyCombatStateComponent);
      const locomotion = world.getComponent(
        entityId,
        EnemyLocomotionStateComponent,
      );
      const patrol = world.getComponent(entityId, EnemyPatrolStateComponent);
      const refs = world.getComponent(entityId, EnemyPhysicsViewRefsComponent);
      const stats = world.getComponent(entityId, EnemyStatsComponent);

      if (
        !ai ||
        !attack ||
        !combat ||
        !locomotion ||
        !patrol ||
        !refs ||
        !stats
      ) {
        continue;
      }

      const body = refs.body;
      if (!body) {
        continue;
      }

      body.setAngularVelocity(Vector3.Zero());

      if (!refs.root.rotationQuaternion) {
        refs.root.rotationQuaternion = Quaternion.Identity();
      }

      if (
        stats.lifeState !== EnemyLifeState.ALIVE ||
        ai.current === EnemyBehaviorState.DEAD ||
        ai.current === EnemyBehaviorState.HIT ||
        ai.current === EnemyBehaviorState.ATTACK
      ) {
        this.stopHorizontalMovement(body);
        rotateEnemyTowardTarget(refs, ai, deltaTime);
        continue;
      }

      let direction: Vector3 | null =
        locomotion.overrideDirection?.clone() ?? null;
      let speed =
        ai.current === EnemyBehaviorState.CHASE
          ? stats.chaseSpeed
          : stats.patrolSpeed;

      if (!direction) {
        if (ai.current === EnemyBehaviorState.PATROL) {
          direction = patrol.patrolTarget.subtract(refs.mesh.position);
          direction.y = 0;
        } else if (ai.current === EnemyBehaviorState.CHASE && player) {
          const playerPosition = player.position;
          direction = new Vector3(
            playerPosition.x - refs.mesh.position.x,
            0,
            playerPosition.z - refs.mesh.position.z,
          );
        }
      }

      if (!direction || direction.lengthSquared() <= 0.0001) {
        this.stopHorizontalMovement(body);
        rotateEnemyTowardTarget(refs, ai, deltaTime);
        continue;
      }

      direction.normalize();
      ai.targetYAngle = Math.atan2(direction.x, direction.z);

      const currentVelocity = body.getLinearVelocity();
      body.setLinearVelocity(
        new Vector3(
          direction.x * speed,
          currentVelocity.y,
          direction.z * speed,
        ),
      );

      rotateEnemyTowardTarget(refs, ai, deltaTime);
    }
  }

  private stopHorizontalMovement(
    body: NonNullable<EnemyPhysicsViewRefsComponent['body']>,
  ) {
    const currentVelocity = body.getLinearVelocity();
    body.setLinearVelocity(new Vector3(0, currentVelocity.y, 0));
  }
}
