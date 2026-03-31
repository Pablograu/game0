import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  PlayerControlStateComponent,
  PlayerHealthStateComponent,
  PlayerLocomotionStateComponent,
} from '../../player/components/index.ts';
import { PlayerLifeState } from '../../player/PlayerStateEnums.ts';
import { GameFlowStateComponent } from '../components/index.ts';
import { GameFlowState } from '../GameFlowState.ts';

export class GameFlowInputGateSystem implements EcsSystem {
  readonly name = 'GameFlowInputGateSystem';
  readonly order = 4;

  update(world: World): void {
    const [gameFlowEntityId] = world.query(GameFlowStateComponent);

    if (!gameFlowEntityId) {
      return;
    }

    const gameFlow = world.getComponent(
      gameFlowEntityId,
      GameFlowStateComponent,
    );

    if (!gameFlow) {
      return;
    }

    const entityIds = world.query(
      PlayerControlStateComponent,
      PlayerHealthStateComponent,
      PlayerLocomotionStateComponent,
    );

    for (const entityId of entityIds) {
      const control = world.getComponent(entityId, PlayerControlStateComponent);
      const health = world.getComponent(entityId, PlayerHealthStateComponent);
      const locomotion = world.getComponent(
        entityId,
        PlayerLocomotionStateComponent,
      );

      if (!control || !health || !locomotion) {
        continue;
      }

      const shouldEnableInput =
        gameFlow.current === GameFlowState.PLAYING &&
        health.lifeState === PlayerLifeState.ALIVE;

      if (shouldEnableInput) {
        control.inputEnabled = true;
        continue;
      }

      control.inputEnabled = false;
      control.inputMap = {};
      control.moveInputX = 0;
      control.moveInputZ = 0;
      control.dashRequested = false;
      control.attackRequested = false;
      control.danceToggleRequested = false;
      locomotion.isDashing = false;
    }
  }
}
