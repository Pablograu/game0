import { Vector3 } from '@babylonjs/core';
import { AudioManager } from '../../../AudioManager.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  EnemyAiStateComponent,
  EnemyAttackStateComponent,
  EnemyCombatStateComponent,
  EnemyLifecycleRequestComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyRagdollStateComponent,
  EnemySpawnStateComponent,
  EnemyStatsComponent,
} from '../components/index.ts';
import {
  EnemyBehaviorState,
  EnemyCombatMode,
  EnemyLifeState,
  EnemyRagdollMode,
  EnemySpawnState,
} from '../EnemyStateEnums.ts';
import {
  isEnemyGameplayPaused,
  transitionEnemyBehavior,
} from './enemyRuntimeUtils.ts';

interface EcsEnemyRagdollApi {
  ragdoll(): void;
  getAggregate(index: number): {
    body?: {
      applyImpulse(impulse: Vector3, contactPoint: Vector3): void;
      setLinearVelocity?(velocity: Vector3): void;
      setAngularVelocity?(velocity: Vector3): void;
    };
  } | null;
}

export class EnemySurvivabilitySystem implements EcsSystem {
  readonly name = 'EnemySurvivabilitySystem';
  readonly order = 18;

  update(world: World, deltaTime: number): void {
    if (isEnemyGameplayPaused(world)) {
      return;
    }

    const entityIds = world.query(
      EnemyAiStateComponent,
      EnemyAttackStateComponent,
      EnemyCombatStateComponent,
      EnemyLifecycleRequestComponent,
      EnemyPhysicsViewRefsComponent,
      EnemyRagdollStateComponent,
      EnemySpawnStateComponent,
      EnemyStatsComponent,
    );

    for (const entityId of entityIds) {
      const ai = world.getComponent(entityId, EnemyAiStateComponent);
      const attack = world.getComponent(entityId, EnemyAttackStateComponent);
      const combat = world.getComponent(entityId, EnemyCombatStateComponent);
      const requests = world.getComponent(
        entityId,
        EnemyLifecycleRequestComponent,
      );
      const refs = world.getComponent(entityId, EnemyPhysicsViewRefsComponent);
      const ragdoll = world.getComponent(entityId, EnemyRagdollStateComponent);
      const spawn = world.getComponent(entityId, EnemySpawnStateComponent);
      const stats = world.getComponent(entityId, EnemyStatsComponent);

      if (
        !ai ||
        !attack ||
        !combat ||
        !requests ||
        !refs ||
        !ragdoll ||
        !spawn ||
        !stats
      ) {
        continue;
      }

      if (requests.deathRequested) {
        requests.deathRequested = false;
        requests.lootRequested = true;
        requests.despawnRequested = true;

        spawn.state = EnemySpawnState.DESPAWN_QUEUED;
        spawn.despawnTimer = spawn.despawnDelay;
        combat.mode = EnemyCombatMode.DEAD;
        stats.lifeState = EnemyLifeState.DEAD;
        transitionEnemyBehavior(ai, combat, EnemyBehaviorState.DEAD);
        attack.hitbox?.setEnabled(false);
        attack.attackInProgress = false;
        attack.hitboxActive = false;
        AudioManager.play('enemy_death');

        for (const mesh of refs.meshes) {
          mesh.checkCollisions = false;
          mesh.isPickable = false;
        }

        if (ragdoll.mode === EnemyRagdollMode.READY && ragdoll.ragdoll) {
          const ragdollApi = ragdoll.ragdoll as EcsEnemyRagdollApi;
          ragdollApi.ragdoll();
          ragdoll.mode = EnemyRagdollMode.ACTIVE;
          refs.body?.setLinearVelocity(Vector3.Zero());
          refs.body?.setAngularVelocity(Vector3.Zero());

          const rootAggregate = ragdollApi.getAggregate(-1);
          rootAggregate?.body?.setLinearVelocity?.(Vector3.Zero());
          rootAggregate?.body?.setAngularVelocity?.(Vector3.Zero());

          ragdoll.pendingImpulse =
            ragdoll.lastKnockbackDir.lengthSquared() > 0.0001
              ? ragdoll.lastKnockbackDir.scale(stats.knockbackForce * 0.35)
              : null;
          ragdoll.pendingImpulseDelay = Math.max(deltaTime, 1 / 60);
        } else if (refs.body) {
          refs.body.setLinearVelocity(Vector3.Zero());
          refs.body.setAngularVelocity(Vector3.Zero());
        }
      }

      if (ragdoll.mode === EnemyRagdollMode.ACTIVE && ragdoll.pendingImpulse) {
        ragdoll.pendingImpulseDelay = Math.max(
          0,
          ragdoll.pendingImpulseDelay - deltaTime,
        );

        if (ragdoll.pendingImpulseDelay <= 0) {
          const ragdollApi = ragdoll.ragdoll as EcsEnemyRagdollApi | null;
          const appPoint = refs.mesh.getAbsolutePosition();

          ragdollApi
            ?.getAggregate(-1)
            ?.body?.applyImpulse(ragdoll.pendingImpulse, appPoint);

          ragdoll.pendingImpulse = null;
        }
      }
    }
  }
}
