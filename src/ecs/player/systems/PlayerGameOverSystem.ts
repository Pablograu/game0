import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  PlayerGameOverHandlerComponent,
  PlayerSurvivabilityRequestComponent,
} from '../components/index.ts';

export class PlayerGameOverSystem implements EcsSystem {
  readonly name = 'PlayerGameOverSystem';
  readonly order = 19;

  update(world: World): void {
    const entityIds = world.query(
      PlayerGameOverHandlerComponent,
      PlayerSurvivabilityRequestComponent,
    );

    for (const entityId of entityIds) {
      const gameOver = world.getComponent(
        entityId,
        PlayerGameOverHandlerComponent,
      );
      const requests = world.getComponent(
        entityId,
        PlayerSurvivabilityRequestComponent,
      );

      if (!gameOver || !requests || !requests.gameOverRequested) {
        continue;
      }

      if (!requests.autoSignalGameOver || !gameOver.handler) {
        continue;
      }

      gameOver.handler.gameOver();
      requests.gameOverRequested = false;
      requests.gameOverReason = null;
    }
  }
}
