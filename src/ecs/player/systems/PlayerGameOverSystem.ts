import { LegacyPlayerRefsComponent } from '../../components/LegacyPlayerRefsComponent.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { PlayerSurvivabilityRequestComponent } from '../components/index.ts';

export class PlayerGameOverSystem implements EcsSystem {
  readonly name = 'PlayerGameOverSystem';
  readonly order = 19;

  update(world: World): void {
    const entityIds = world.query(
      LegacyPlayerRefsComponent,
      PlayerSurvivabilityRequestComponent,
    );

    for (const entityId of entityIds) {
      const refs = world.getComponent(entityId, LegacyPlayerRefsComponent);
      const requests = world.getComponent(
        entityId,
        PlayerSurvivabilityRequestComponent,
      );

      if (!refs || !requests || !requests.gameOverRequested) {
        continue;
      }

      if (!requests.autoSignalGameOver || !refs.controller.gameManager) {
        continue;
      }

      refs.controller.gameManager.gameOver();
      requests.gameOverRequested = false;
      requests.gameOverReason = null;
    }
  }
}
