import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  EnemyAttackStateComponent,
  EnemyLifecycleRequestComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyRagdollStateComponent,
  EnemySpawnStateComponent,
} from '../components/index.ts';
import { EnemyRagdollMode, EnemySpawnState } from '../EnemyStateEnums.ts';
import { isEnemyGameplayPaused } from './enemyRuntimeUtils.ts';

export class EnemyDespawnSystem implements EcsSystem {
  readonly name = 'EnemyDespawnSystem';
  readonly order = 20;

  update(world: World, deltaTime: number): void {
    if (isEnemyGameplayPaused(world)) {
      return;
    }

    const entityIds = world.query(
      EnemyAttackStateComponent,
      EnemyLifecycleRequestComponent,
      EnemyPhysicsViewRefsComponent,
      EnemyRagdollStateComponent,
      EnemySpawnStateComponent,
    );

    for (const entityId of entityIds) {
      const attack = world.getComponent(entityId, EnemyAttackStateComponent);
      const requests = world.getComponent(
        entityId,
        EnemyLifecycleRequestComponent,
      );
      const refs = world.getComponent(entityId, EnemyPhysicsViewRefsComponent);
      const ragdoll = world.getComponent(entityId, EnemyRagdollStateComponent);
      const spawn = world.getComponent(entityId, EnemySpawnStateComponent);

      if (
        !attack ||
        !requests ||
        !refs ||
        !ragdoll ||
        !spawn ||
        !requests.despawnRequested
      ) {
        continue;
      }

      spawn.despawnTimer = Math.max(0, spawn.despawnTimer - deltaTime);

      if (spawn.despawnTimer > 0 || spawn.state === EnemySpawnState.DESPAWNED) {
        continue;
      }

      for (const mesh of refs.meshes) {
        mesh.isVisible = false;
      }

      refs.root.setEnabled(false);
      attack.hitbox?.dispose();
      refs.debugVisionCircle?.dispose();
      refs.physicsAggregate?.dispose();
      refs.root.dispose();

      if (
        ragdoll.ragdoll &&
        typeof ragdoll.ragdoll === 'object' &&
        'dispose' in ragdoll.ragdoll
      ) {
        (ragdoll.ragdoll as { dispose(): void }).dispose();
      }

      ragdoll.mode = EnemyRagdollMode.DISPOSED;
      spawn.state = EnemySpawnState.DESPAWNED;
      requests.despawnRequested = false;
      world.destroyEntity(entityId);
    }
  }
}
