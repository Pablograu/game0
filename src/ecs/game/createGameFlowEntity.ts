import type { EntityId } from '../core/Entity.ts';
import type { World } from '../core/World.ts';
import {
  GameFlowRequestComponent,
  GameFlowRuntimeRefsComponent,
  GameFlowStateComponent,
  GameFlowUiRefsComponent,
  type GameFlowEngineControl,
} from './components/index.ts';
import { GameFlowState } from './GameFlowState.ts';

export interface CreateGameFlowEntityOptions {
  world: World;
  engine?: GameFlowEngineControl | null;
  reloadGame?: (() => void) | null;
}

export function createGameFlowEntity(
  options: CreateGameFlowEntityOptions,
): EntityId {
  const entityId = options.world.createEntity();

  options.world.addComponent(entityId, GameFlowStateComponent, {
    current: GameFlowState.START,
    previous: null,
    transitionCount: 0,
    gameOverReason: null,
    enemyDefeatedCount: 0,
  });

  options.world.addComponent(entityId, GameFlowRequestComponent, {
    startRequested: false,
    pauseRequested: false,
    resumeRequested: false,
    togglePauseRequested: false,
    restartRequested: false,
    gameOverRequested: false,
    gameOverReason: null,
    openInventoryRequested: false,
    closeInventoryRequested: false,
    pointerLockRequestPending: false,
  });

  options.world.addComponent(entityId, GameFlowRuntimeRefsComponent, {
    engine: options.engine ?? null,
    camera: null,
    reloadGame: options.reloadGame ?? null,
    cameraInputAttached: false,
    cameraSyncPending: true,
  });

  options.world.addComponent(entityId, GameFlowUiRefsComponent, {
    uiTexture: null,
    startPanel: null,
    pausePanel: null,
    deadPanel: null,
    titleText: null,
    startButton: null,
    deadStatsText: null,
  });

  return entityId;
}
