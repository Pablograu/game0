import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  EnemyAiStateComponent,
  EnemyIdentityComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyStatsComponent,
  EnemyUiPresentationComponent,
} from '../components/index.ts';
import { EnemyBehaviorState, EnemyLifeState } from '../EnemyStateEnums.ts';
import type { EnemyUiApi } from '../ui/EnemyUiManager.ts';

export class EnemyUiSyncSystem implements EcsSystem {
  readonly name = 'EnemyUiSyncSystem';
  readonly order = 22;

  constructor(private readonly enemyUi: EnemyUiApi) {}

  update(world: World, deltaTime: number): void {
    this.enemyUi.beginFrame();

    const entityIds = world.query(
      EnemyAiStateComponent,
      EnemyIdentityComponent,
      EnemyPhysicsViewRefsComponent,
      EnemyStatsComponent,
      EnemyUiPresentationComponent,
    );

    for (const entityId of entityIds) {
      const ai = world.getComponent(entityId, EnemyAiStateComponent);
      const identity = world.getComponent(entityId, EnemyIdentityComponent);
      const refs = world.getComponent(entityId, EnemyPhysicsViewRefsComponent);
      const stats = world.getComponent(entityId, EnemyStatsComponent);
      const ui = world.getComponent(entityId, EnemyUiPresentationComponent);

      if (!ai || !identity || !refs || !stats || !ui) {
        continue;
      }

      if (stats.lifeState !== EnemyLifeState.ALIVE) {
        continue;
      }

      this.enemyUi.syncEnemy({
        entityId,
        mesh: refs.mesh,
        displayName: identity.displayName,
        linkOffsetY: ui.linkOffsetY,
        baseScale: ui.baseScale,
        maxVisibleDistance: ui.maxVisibleDistance,
        damageRevealDuration: ui.damageRevealDuration,
        currentHealth: stats.currentHp,
        maxHealth: stats.maxHp,
        distanceToPlayer: ai.distanceToPlayer,
        isEngaged:
          ai.current === EnemyBehaviorState.CHASE ||
          ai.current === EnemyBehaviorState.ATTACK,
      });
    }

    this.enemyUi.update(deltaTime);
    this.enemyUi.endFrame();
  }
}
