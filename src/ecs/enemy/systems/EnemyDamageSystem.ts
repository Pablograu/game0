import { Vector3 } from '@babylonjs/core';
import { AudioManager } from '../../../AudioManager.ts';
import { EffectManager } from '../../../EffectManager.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  EnemyAiStateComponent,
  EnemyCombatStateComponent,
  EnemyLifecycleRequestComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyRagdollStateComponent,
  EnemyStatsComponent,
} from '../components/index.ts';
import { EnemyBehaviorState, EnemyLifeState } from '../EnemyStateEnums.ts';
import {
  isEnemyGameplayPaused,
  transitionEnemyBehavior,
} from './enemyRuntimeUtils.ts';

export class EnemyDamageSystem implements EcsSystem {
  readonly name = 'EnemyDamageSystem';
  readonly order = 16;

  update(world: World): void {
    if (isEnemyGameplayPaused(world)) {
      return;
    }

    const entityIds = world.query(
      EnemyAiStateComponent,
      EnemyCombatStateComponent,
      EnemyLifecycleRequestComponent,
      EnemyPhysicsViewRefsComponent,
      EnemyRagdollStateComponent,
      EnemyStatsComponent,
    );

    for (const entityId of entityIds) {
      const ai = world.getComponent(entityId, EnemyAiStateComponent);
      const combat = world.getComponent(entityId, EnemyCombatStateComponent);
      const requests = world.getComponent(
        entityId,
        EnemyLifecycleRequestComponent,
      );
      const refs = world.getComponent(entityId, EnemyPhysicsViewRefsComponent);
      const ragdoll = world.getComponent(entityId, EnemyRagdollStateComponent);
      const stats = world.getComponent(entityId, EnemyStatsComponent);

      if (!ai || !combat || !requests || !refs || !ragdoll || !stats) {
        continue;
      }

      const pendingRequests = requests.damageRequests.splice(
        0,
        requests.damageRequests.length,
      );

      for (const request of pendingRequests) {
        if (stats.lifeState !== EnemyLifeState.ALIVE) {
          continue;
        }

        const enemyPos = refs.mesh.getAbsolutePosition();
        let knockbackDir = Vector3.Zero();

        if (request.damageSourcePosition) {
          knockbackDir = enemyPos.subtract(request.damageSourcePosition);
          knockbackDir.y = 0;

          if (knockbackDir.length() < 0.01) {
            knockbackDir = new Vector3(
              Math.random() - 0.5,
              0,
              Math.random() - 0.5,
            );
          }

          knockbackDir.normalize();
          ragdoll.lastKnockbackDir = knockbackDir.clone();

          if (refs.body) {
            const impulse = knockbackDir.scale(stats.knockbackForce);
            impulse.y = stats.knockbackForce;
            refs.body.applyImpulse(impulse, enemyPos);
          }
        }

        const bloodPos = enemyPos.clone();
        bloodPos.y += 0.8;

        EffectManager.showBloodSplash(bloodPos, {
          intensity: stats.currentHp - request.amount <= 0 ? 'death' : 'hit',
          direction: knockbackDir.length() > 0.01 ? knockbackDir : undefined,
        });

        stats.currentHp = Math.max(0, stats.currentHp - request.amount);

        if (stats.currentHp <= 0) {
          stats.lifeState = EnemyLifeState.DEAD;
          requests.deathRequested = true;
          requests.deathPosition = enemyPos.clone();
          transitionEnemyBehavior(ai, combat, EnemyBehaviorState.DEAD);
          continue;
        }

        combat.stunTimer = stats.stunDuration;
        transitionEnemyBehavior(ai, combat, EnemyBehaviorState.HIT);
        AudioManager.play('enemy_hit');
      }
    }
  }
}
