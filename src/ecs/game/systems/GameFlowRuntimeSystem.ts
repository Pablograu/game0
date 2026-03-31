import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  GameFlowRequestComponent,
  GameFlowRuntimeRefsComponent,
  GameFlowStateComponent,
} from '../components/index.ts';
import { GameFlowState } from '../GameFlowState.ts';

export class GameFlowRuntimeSystem implements EcsSystem {
  readonly name = 'GameFlowRuntimeSystem';
  readonly order = 5;

  update(world: World): void {
    const entityIds = world.query(
      GameFlowRequestComponent,
      GameFlowRuntimeRefsComponent,
      GameFlowStateComponent,
    );

    for (const entityId of entityIds) {
      const requests = world.getComponent(entityId, GameFlowRequestComponent);
      const runtime = world.getComponent(
        entityId,
        GameFlowRuntimeRefsComponent,
      );
      const state = world.getComponent(entityId, GameFlowStateComponent);

      if (!requests || !runtime || !state) {
        continue;
      }

      const shouldRunGameplay = state.current === GameFlowState.PLAYING;

      if (
        runtime.cameraSyncPending ||
        runtime.cameraInputAttached !== shouldRunGameplay
      ) {
        if (shouldRunGameplay) {
          runtime.camera?.attachControl?.();
        } else {
          runtime.camera?.detachControl?.();
        }

        runtime.cameraInputAttached = shouldRunGameplay;
        runtime.cameraSyncPending = false;
      }

      if (
        runtime.enemySyncPending ||
        runtime.enemyUpdatesEnabled !== shouldRunGameplay
      ) {
        for (const enemy of runtime.enemies) {
          if (shouldRunGameplay) {
            enemy.enableUpdate?.();
          } else {
            enemy.disableUpdate?.();
          }
        }

        runtime.enemyUpdatesEnabled = shouldRunGameplay;
        runtime.enemySyncPending = false;
      }

      if (!shouldRunGameplay) {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }

        requests.pointerLockRequestPending = false;
      } else if (requests.pointerLockRequestPending) {
        try {
          runtime.engine?.enterPointerlock?.();
        } finally {
          requests.pointerLockRequestPending = false;
        }
      }

      if (requests.restartRequested) {
        requests.restartRequested = false;
        runtime.reloadGame?.();
      }
    }
  }
}
