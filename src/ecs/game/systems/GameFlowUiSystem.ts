import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  GameFlowStateComponent,
  GameFlowUiRefsComponent,
} from '../components/index.ts';
import { GameFlowState } from '../GameFlowState.ts';

export class GameFlowUiSystem implements EcsSystem {
  readonly name = 'GameFlowUiSystem';
  readonly order = 6;

  update(world: World): void {
    const entityIds = world.query(
      GameFlowStateComponent,
      GameFlowUiRefsComponent,
    );

    for (const entityId of entityIds) {
      const state = world.getComponent(entityId, GameFlowStateComponent);
      const ui = world.getComponent(entityId, GameFlowUiRefsComponent);

      if (!state || !ui) {
        continue;
      }

      if (ui.startPanel) {
        ui.startPanel.isVisible = state.current === GameFlowState.START;
      }

      if (ui.pausePanel) {
        ui.pausePanel.isVisible = state.current === GameFlowState.PAUSED;
      }

      if (ui.deadPanel) {
        ui.deadPanel.isVisible = state.current === GameFlowState.DEAD;
      }

      if (ui.deadStatsText) {
        ui.deadStatsText.text = `Enemies Defeated: ${state.enemyDefeatedCount}`;
      }
    }
  }
}
