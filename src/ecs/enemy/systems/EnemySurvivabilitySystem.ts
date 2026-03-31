import { Vector3 } from '@babylonjs/core';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  EnemyCombatStateComponent,
  EnemyLifecycleRequestComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyRagdollStateComponent,
  EnemySpawnStateComponent,
  EnemyStatsComponent,
} from '../components/index.ts';
import {
  EnemyCombatMode,
  EnemyLifeState,
  EnemyRagdollMode,
  EnemySpawnState,
} from '../EnemyStateEnums.ts';

interface EcsEnemyRagdollApi {
  ragdoll(): void;
  getAggregates(): Array<{
    body?: {
      applyImpulse(impulse: Vector3, contactPoint: Vector3): void;
    };
  }>;
}

export class EnemySurvivabilitySystem implements EcsSystem {
  readonly name = 'EnemySurvivabilitySystem';
  readonly order = 18;

  update(world: World, deltaTime: number): void {
    const entityIds = world.query(
      EnemyCombatStateComponent,
      EnemyLifecycleRequestComponent,
      EnemyPhysicsViewRefsComponent,
      EnemyRagdollStateComponent,
      EnemySpawnStateComponent,
      EnemyStatsComponent,
    );

    for (const entityId of entityIds) {
      const combat = world.getComponent(entityId, EnemyCombatStateComponent);
      const requests = world.getComponent(
        entityId,
        EnemyLifecycleRequestComponent,
      );
      const refs = world.getComponent(entityId, EnemyPhysicsViewRefsComponent);
      const ragdoll = world.getComponent(entityId, EnemyRagdollStateComponent);
      const spawn = world.getComponent(entityId, EnemySpawnStateComponent);
      const stats = world.getComponent(entityId, EnemyStatsComponent);

      if (!combat || !requests || !refs || !ragdoll || !spawn || !stats) {
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

        refs.controller?.onLifecycleDeath();

        for (const mesh of refs.meshes) {
          mesh.checkCollisions = false;
          mesh.isPickable = false;
        }

        if (ragdoll.mode === EnemyRagdollMode.READY && ragdoll.ragdoll) {
          const ragdollApi = ragdoll.ragdoll as EcsEnemyRagdollApi;
          ragdollApi.ragdoll();
          ragdoll.mode = EnemyRagdollMode.ACTIVE;
          ragdoll.pendingImpulse = ragdoll.lastKnockbackDir.scale(
            stats.knockbackForce * 15,
          );
          ragdoll.pendingImpulseDelay = Math.max(deltaTime, 1 / 60);
        } else if (refs.body) {
          const currentVel = refs.body.getLinearVelocity();
          refs.body.setMassProperties({
            mass: stats.mass,
            inertia: new Vector3(0.4, 0.1, 0.4),
          });
          const toppleAxis = new Vector3(-currentVel.z, 0, currentVel.x);
          if (toppleAxis.length() > 0.01) {
            toppleAxis.normalize();
          } else {
            toppleAxis
              .set(Math.random() - 0.5, 0, Math.random() - 0.5)
              .normalize();
          }
          refs.body.setAngularVelocity(toppleAxis.scale(6));
          refs.body.applyImpulse(
            new Vector3(0, 20, 0),
            refs.mesh.getAbsolutePosition(),
          );
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

          for (const aggregate of ragdollApi?.getAggregates() ?? []) {
            aggregate.body?.applyImpulse(ragdoll.pendingImpulse, appPoint);
          }

          ragdoll.pendingImpulse = null;
        }
      }
    }
  }
}
