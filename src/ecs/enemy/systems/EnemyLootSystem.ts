import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  EnemyLifecycleRequestComponent,
  EnemyPhysicsViewRefsComponent,
} from '../components/index.ts';

export class EnemyLootSystem implements EcsSystem {
  readonly name = 'EnemyLootSystem';
  readonly order = 19;

  update(world: World): void {
    const entityIds = world.query(
      EnemyLifecycleRequestComponent,
      EnemyPhysicsViewRefsComponent,
    );

    for (const entityId of entityIds) {
      const requests = world.getComponent(
        entityId,
        EnemyLifecycleRequestComponent,
      );
      const refs = world.getComponent(entityId, EnemyPhysicsViewRefsComponent);

      if (
        !requests ||
        !refs ||
        !requests.lootRequested ||
        !requests.deathPosition
      ) {
        continue;
      }

      refs.lootManager?.spawnLoot(requests.deathPosition);
      requests.lootRequested = false;
    }
  }
}
