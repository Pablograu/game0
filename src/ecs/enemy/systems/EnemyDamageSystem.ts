import { Vector3 } from '@babylonjs/core';
import { AudioManager } from '../../../AudioManager.ts';
import { EffectManager } from '../../../EffectManager.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  EnemyAiStateComponent,
  EnemyCombatStateComponent,
  EnemyLifecycleRequestComponent,
  EnemyLocomotionStateComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyRagdollStateComponent,
  EnemyStatsComponent,
} from '../components/index.ts';
import { EnemyBehaviorState, EnemyLifeState } from '../EnemyStateEnums.ts';
import {
  isEnemyGameplayPaused,
  transitionEnemyBehavior,
} from './enemyRuntimeUtils.ts';

interface EcsEnemyRagdollApi {
  getAggregate(index: number): {
    body?: {
      applyImpulse(impulse: Vector3, contactPoint: Vector3): void;
    };
  } | null;
  getClosestAggregate(point: Vector3): {
    body?: {
      applyImpulse(impulse: Vector3, contactPoint: Vector3): void;
    };
  } | null;
}

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
      EnemyLocomotionStateComponent,
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
      const locomotion = world.getComponent(
        entityId,
        EnemyLocomotionStateComponent,
      );
      const refs = world.getComponent(entityId, EnemyPhysicsViewRefsComponent);
      const ragdoll = world.getComponent(entityId, EnemyRagdollStateComponent);
      const stats = world.getComponent(entityId, EnemyStatsComponent);

      if (
        !ai ||
        !combat ||
        !requests ||
        !locomotion ||
        !refs ||
        !ragdoll ||
        !stats
      ) {
        continue;
      }

      const pendingRequests = requests.damageRequests.splice(
        0,
        requests.damageRequests.length,
      );

      for (const request of pendingRequests) {
        const enemyPos = refs.mesh.getAbsolutePosition();
        const impactPoint = request.impactPoint?.clone() ?? enemyPos.clone();
        let knockbackDir = Vector3.Zero();

        if (request.damageSourcePosition) {
          knockbackDir = impactPoint.subtract(request.damageSourcePosition);
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
        }

        if (stats.lifeState !== EnemyLifeState.ALIVE) {
          if (
            ragdoll.mode === 'ACTIVE' &&
            ragdoll.ragdoll &&
            knockbackDir.lengthSquared() > 0.0001
          ) {
            const ragdollApi = ragdoll.ragdoll as EcsEnemyRagdollApi;
            const corpseImpulse = new Vector3(
              knockbackDir.x * stats.knockbackForce * 6,
              0.45,
              knockbackDir.z * stats.knockbackForce * 6,
            );

            ragdollApi
              .getClosestAggregate(impactPoint)
              ?.body?.applyImpulse(corpseImpulse, impactPoint);

            ragdollApi
              .getAggregate(-1)
              ?.body?.applyImpulse(corpseImpulse.scale(0.2), impactPoint);
          }

          continue;
        }

        if (request.damageSourcePosition) {
          if (refs.body) {
            const currentVelocity = refs.body.getLinearVelocity();
            const knockbackSpeed = Math.max(2.5, stats.knockbackForce * 4.5);
            refs.body.setLinearVelocity(
              new Vector3(
                knockbackDir.x * knockbackSpeed,
                Math.max(currentVelocity.y, 1.1),
                knockbackDir.z * knockbackSpeed,
              ),
            );

            const impulse = new Vector3(
              knockbackDir.x * stats.knockbackForce * 2.5,
              0.35,
              knockbackDir.z * stats.knockbackForce * 2.5,
            );
            refs.body.applyImpulse(impulse, impactPoint);
            locomotion.knockbackTimer = Math.max(
              locomotion.knockbackTimer,
              0.2,
            );
          }
        }

        const bloodPos = impactPoint.clone();

        EffectManager.showBloodSplash(bloodPos, {
          intensity: stats.currentHp - request.amount <= 0 ? 'death' : 'hit',
          direction: knockbackDir.length() > 0.01 ? knockbackDir : undefined,
        });

        stats.currentHp = Math.max(0, stats.currentHp - request.amount);

        if (stats.currentHp <= 0) {
          stats.lifeState = EnemyLifeState.DEAD;
          requests.deathRequested = true;
          requests.deathPosition = impactPoint.clone();
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
