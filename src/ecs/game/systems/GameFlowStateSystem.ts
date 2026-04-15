import { AudioManager } from '../../../AudioManager.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  GameFlowRequestComponent,
  GameFlowStateComponent,
} from '../components/index.ts';
import { GameFlowState } from '../GameFlowState.ts';

export class GameFlowStateSystem implements EcsSystem {
  readonly name = 'GameFlowStateSystem';
  readonly order = 1;

  update(world: World): void {
    const entityIds = world.query(
      GameFlowStateComponent,
      GameFlowRequestComponent,
    );

    for (const entityId of entityIds) {
      const state = world.getComponent(entityId, GameFlowStateComponent);
      const requests = world.getComponent(entityId, GameFlowRequestComponent);

      if (!state || !requests) {
        continue;
      }

      const nextState = this.resolveNextState(state.current, requests);

      if (nextState !== state.current) {
        const previousState = state.current;
        state.previous = previousState;
        state.current = nextState;
        state.transitionCount += 1;

        if (nextState === GameFlowState.DEAD) {
          state.gameOverReason =
            requests.gameOverReason ?? state.gameOverReason;
        } else if (nextState !== GameFlowState.PAUSED) {
          state.gameOverReason = null;
        }

        this.playTransitionAudio(previousState, nextState);
      }

      requests.startRequested = false;
      requests.pauseRequested = false;
      requests.resumeRequested = false;
      requests.openInventoryRequested = false;
      requests.closeInventoryRequested = false;
      requests.togglePauseRequested = false;
      requests.gameOverRequested = false;

      if (state.current !== GameFlowState.PLAYING) {
        requests.pointerLockRequestPending = false;
      }

      if (state.current !== GameFlowState.DEAD) {
        requests.gameOverReason = null;
      }
    }
  }

  private resolveNextState(
    currentState: GameFlowState,
    requests: GameFlowRequestComponent,
  ): GameFlowState {
    if (requests.gameOverRequested && currentState !== GameFlowState.DEAD) {
      return GameFlowState.DEAD;
    }

    if (currentState === GameFlowState.START && requests.startRequested) {
      return GameFlowState.PLAYING;
    }

    if (
      currentState === GameFlowState.PLAYING &&
      (requests.pauseRequested || requests.togglePauseRequested)
    ) {
      return GameFlowState.PAUSED;
    }

    if (
      currentState === GameFlowState.PLAYING &&
      requests.openInventoryRequested
    ) {
      return GameFlowState.INVENTORY;
    }

    if (
      currentState === GameFlowState.INVENTORY &&
      requests.closeInventoryRequested
    ) {
      return GameFlowState.PLAYING;
    }

    if (
      currentState === GameFlowState.PAUSED &&
      (requests.resumeRequested || requests.togglePauseRequested)
    ) {
      return GameFlowState.PLAYING;
    }

    return currentState;
  }

  private playTransitionAudio(
    previousState: GameFlowState,
    nextState: GameFlowState,
  ) {
    if (nextState === GameFlowState.DEAD) {
      AudioManager.play('ui_game_over');
      return;
    }

    if (nextState === GameFlowState.PAUSED) {
      AudioManager.play('ui_pause');
      return;
    }

    if (
      nextState === GameFlowState.PLAYING &&
      previousState === GameFlowState.PAUSED
    ) {
      AudioManager.play('ui_resume');
      return;
    }

    if (
      nextState === GameFlowState.PLAYING &&
      previousState === GameFlowState.START
    ) {
      AudioManager.play('ui_start');
    }
  }
}
