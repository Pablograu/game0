import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { queueGameOverRequest } from '../../game/index.ts';
import {
  PlayerGameOverHandlerComponent,
  PlayerSurvivabilityRequestComponent,
} from '../components/index.ts';

export class PlayerGameOverSystem implements EcsSystem {
  readonly name = 'PlayerGameOverSystem';
  readonly order = 19;

  update(world: World): void {
    const entityIds = world.query(PlayerSurvivabilityRequestComponent);

    for (const entityId of entityIds) {
      const requests = world.getComponent(
        entityId,
        PlayerSurvivabilityRequestComponent,
      );

      if (
        !requests ||
        !requests.gameOverRequested ||
        !requests.autoSignalGameOver
      ) {
        continue;
      }

      const queued = queueGameOverRequest(
        world,
        requests.gameOverReason ?? 'player-death',
      );

      if (!queued) {
        const gameOver = world.getComponent(
          entityId,
          PlayerGameOverHandlerComponent,
        );

        if (!gameOver?.handler) {
          continue;
        }

        gameOver.handler.gameOver();
      }

      requests.gameOverRequested = false;
      requests.gameOverReason = null;
    }
  }
}
