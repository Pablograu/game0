import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  EnemyAiStateComponent,
  EnemyCombatStateComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyStatsComponent,
} from '../components/index.ts';
import { EnemyBehaviorState, EnemyLifeState } from '../EnemyStateEnums.ts';
import { isEnemyGameplayPaused } from './enemyRuntimeUtils.ts';

export class EnemyContactDamageSystem implements EcsSystem {
  readonly name = 'EnemyContactDamageSystem';
  readonly order = 15;

  update(world: World): void {
    if (isEnemyGameplayPaused(world)) {
      return;
    }

    const entityIds = world.query(
      EnemyAiStateComponent,
      EnemyCombatStateComponent,
      EnemyPhysicsViewRefsComponent,
      EnemyStatsComponent,
    );

    for (const entityId of entityIds) {
      const ai = world.getComponent(entityId, EnemyAiStateComponent);
      const combat = world.getComponent(entityId, EnemyCombatStateComponent);
      const refs = world.getComponent(entityId, EnemyPhysicsViewRefsComponent);
      const stats = world.getComponent(entityId, EnemyStatsComponent);

      if (!ai || !combat || !refs || !stats || !refs.playerTarget) {
        continue;
      }

      if (
        stats.lifeState !== EnemyLifeState.ALIVE ||
        !combat.canDamagePlayer ||
        ai.current === EnemyBehaviorState.DEAD ||
        ai.current === EnemyBehaviorState.HIT
      ) {
        continue;
      }

      const playerMesh = refs.playerTarget.getCollisionMesh();
      if (!playerMesh) {
        continue;
      }

      if (!refs.mesh.intersectsMesh(playerMesh, false)) {
        continue;
      }

      refs.playerTarget.takeDamage(
        stats.contactDamage,
        refs.mesh.getAbsolutePosition(),
      );
      combat.canDamagePlayer = false;
      combat.damageCooldownTimer = combat.contactDamageCooldown;
    }
  }
}
