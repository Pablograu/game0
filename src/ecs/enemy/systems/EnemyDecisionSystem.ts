import { AudioManager } from '../../../AudioManager.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  EnemyAiStateComponent,
  EnemyAttackStateComponent,
  EnemyCombatStateComponent,
  EnemyPatrolStateComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyStatsComponent,
} from '../components/index.ts';
import { EnemyBehaviorState, EnemyLifeState } from '../EnemyStateEnums.ts';
import {
  computeEnemyDistanceToPlayer,
  pickEnemyPatrolTarget,
  transitionEnemyBehavior,
  isEnemyGameplayPaused,
} from './enemyRuntimeUtils.ts';

export class EnemyDecisionSystem implements EcsSystem {
  readonly name = 'EnemyDecisionSystem';
  readonly order = 12;

  update(world: World, deltaTime: number): void {
    if (isEnemyGameplayPaused(world)) {
      return;
    }

    const entityIds = world.query(
      EnemyAiStateComponent,
      EnemyAttackStateComponent,
      EnemyCombatStateComponent,
      EnemyPatrolStateComponent,
      EnemyPhysicsViewRefsComponent,
      EnemyStatsComponent,
    );

    for (const entityId of entityIds) {
      const ai = world.getComponent(entityId, EnemyAiStateComponent);
      const attack = world.getComponent(entityId, EnemyAttackStateComponent);
      const combat = world.getComponent(entityId, EnemyCombatStateComponent);
      const patrol = world.getComponent(entityId, EnemyPatrolStateComponent);
      const refs = world.getComponent(entityId, EnemyPhysicsViewRefsComponent);
      const stats = world.getComponent(entityId, EnemyStatsComponent);

      if (!ai || !attack || !combat || !patrol || !refs || !stats) {
        continue;
      }

      ai.stateElapsedTime += deltaTime;
      ai.distanceToPlayer = computeEnemyDistanceToPlayer(refs);

      combat.attackCooldownTimer = Math.max(
        0,
        combat.attackCooldownTimer - deltaTime,
      );
      combat.damageCooldownTimer = Math.max(
        0,
        combat.damageCooldownTimer - deltaTime,
      );

      if (combat.damageCooldownTimer <= 0) {
        combat.canDamagePlayer = true;
      }

      if (stats.lifeState !== EnemyLifeState.ALIVE) {
        transitionEnemyBehavior(ai, combat, EnemyBehaviorState.DEAD);
        continue;
      }

      if (ai.current === EnemyBehaviorState.HIT) {
        combat.stunTimer = Math.max(0, combat.stunTimer - deltaTime);
        if (combat.stunTimer <= 0) {
          transitionEnemyBehavior(ai, combat, EnemyBehaviorState.CHASE);
        }
        continue;
      }

      if (ai.current === EnemyBehaviorState.ATTACK && attack.attackInProgress) {
        continue;
      }

      if (
        ai.current === EnemyBehaviorState.PATROL &&
        patrol.patrolTarget.subtract(refs.mesh.position).length() <=
          patrol.targetReachDistance
      ) {
        patrol.patrolTarget = pickEnemyPatrolTarget(
          refs.mesh.position,
          patrol.patrolRadius,
        );
      }

      if (ai.distanceToPlayer < stats.visionRange) {
        const changed = transitionEnemyBehavior(
          ai,
          combat,
          ai.distanceToPlayer <= stats.attackRange &&
            combat.attackCooldownTimer <= 0
            ? EnemyBehaviorState.ATTACK
            : EnemyBehaviorState.CHASE,
        );

        if (
          changed &&
          ai.current === EnemyBehaviorState.CHASE &&
          ai.previous === EnemyBehaviorState.PATROL
        ) {
          AudioManager.play('enemy_alert');
        }

        continue;
      }

      if (
        ai.current === EnemyBehaviorState.CHASE &&
        ai.distanceToPlayer > patrol.chaseGiveUpRange
      ) {
        transitionEnemyBehavior(ai, combat, EnemyBehaviorState.PATROL);
        patrol.patrolTarget = pickEnemyPatrolTarget(
          refs.mesh.position,
          patrol.patrolRadius,
        );
        continue;
      }

      if (ai.current !== EnemyBehaviorState.PATROL) {
        transitionEnemyBehavior(ai, combat, EnemyBehaviorState.PATROL);
        patrol.patrolTarget = pickEnemyPatrolTarget(
          refs.mesh.position,
          patrol.patrolRadius,
        );
      }
    }
  }
}
