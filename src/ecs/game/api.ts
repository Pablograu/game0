import type {
  AdvancedDynamicTexture,
  Button,
  Control,
  TextBlock,
} from '@babylonjs/gui';
import type { EntityId } from '../core/Entity.ts';
import type { World } from '../core/World.ts';
import {
  GameFlowRequestComponent,
  GameFlowRuntimeRefsComponent,
  GameFlowStateComponent,
  GameFlowUiRefsComponent,
  type GameFlowCameraControl,
  type GameFlowEnemyUpdateTarget,
  type GameFlowEngineControl,
} from './components/index.ts';
import { GameFlowState } from './GameFlowState.ts';

export interface GameFlowUiRefs {
  uiTexture?: AdvancedDynamicTexture | null;
  startPanel?: Control | null;
  pausePanel?: Control | null;
  deadPanel?: Control | null;
  titleText?: TextBlock | null;
  startButton?: Button | null;
  deadStatsText?: TextBlock | null;
}

export interface GameFlowControllerApi {
  attachUiRefs(refs: GameFlowUiRefs): void;
  setCamera(camera: GameFlowCameraControl | null): void;
  setEnemies(enemies: GameFlowEnemyUpdateTarget[]): void;
  setEngine(engine: GameFlowEngineControl | null): void;
  requestStartFromGesture(): void;
  requestPause(): void;
  requestResumeFromGesture(): void;
  requestTogglePauseFromGesture(): void;
  requestRestart(): void;
  requestGameOver(reason?: string | null): void;
  onEnemyDefeated(): void;
  resetEnemyDefeatedCount(): void;
  getEnemyDefeatedCount(): number;
  getState(): GameFlowState;
}

export function getGameFlowEntityId(world: World): EntityId | null {
  const entityIds = world.query(
    GameFlowStateComponent,
    GameFlowRequestComponent,
  );
  return entityIds[0] ?? null;
}

export function queueGameOverRequest(
  world: World,
  reason: string | null = null,
): boolean {
  const entityId = getGameFlowEntityId(world);

  if (entityId === null) {
    return false;
  }

  const requests = world.getComponent(entityId, GameFlowRequestComponent);

  if (!requests) {
    return false;
  }

  requests.gameOverRequested = true;
  requests.gameOverReason = reason ?? requests.gameOverReason ?? 'player-death';
  return true;
}

export function createGameFlowControllerApi(
  world: World,
  entityId: EntityId,
): GameFlowControllerApi {
  const getStateComponent = () => {
    const component = world.getComponent(entityId, GameFlowStateComponent);

    if (!component) {
      throw new Error(
        'GameFlowStateComponent is missing from the game-flow entity.',
      );
    }

    return component;
  };

  const getRequestComponent = () => {
    const component = world.getComponent(entityId, GameFlowRequestComponent);

    if (!component) {
      throw new Error(
        'GameFlowRequestComponent is missing from the game-flow entity.',
      );
    }

    return component;
  };

  const getRuntimeComponent = () => {
    const component = world.getComponent(
      entityId,
      GameFlowRuntimeRefsComponent,
    );

    if (!component) {
      throw new Error(
        'GameFlowRuntimeRefsComponent is missing from the game-flow entity.',
      );
    }

    return component;
  };

  const getUiComponent = () => {
    const component = world.getComponent(entityId, GameFlowUiRefsComponent);

    if (!component) {
      throw new Error(
        'GameFlowUiRefsComponent is missing from the game-flow entity.',
      );
    }

    return component;
  };

  const requestPointerLockFromGesture = () => {
    const runtime = getRuntimeComponent();
    const requests = getRequestComponent();
    requests.pointerLockRequestPending = true;

    try {
      runtime.engine?.enterPointerlock?.();
    } catch {
      // Browser gesture gating is handled opportunistically here and retried in the runtime system.
    }
  };

  return {
    attachUiRefs(refs) {
      const ui = getUiComponent();

      if ('uiTexture' in refs) {
        ui.uiTexture = refs.uiTexture ?? null;
      }

      if ('startPanel' in refs) {
        ui.startPanel = refs.startPanel ?? null;
      }

      if ('pausePanel' in refs) {
        ui.pausePanel = refs.pausePanel ?? null;
      }

      if ('deadPanel' in refs) {
        ui.deadPanel = refs.deadPanel ?? null;
      }

      if ('titleText' in refs) {
        ui.titleText = refs.titleText ?? null;
      }

      if ('startButton' in refs) {
        ui.startButton = refs.startButton ?? null;
      }

      if ('deadStatsText' in refs) {
        ui.deadStatsText = refs.deadStatsText ?? null;
      }
    },
    setCamera(camera) {
      const runtime = getRuntimeComponent();
      runtime.camera = camera;
      runtime.cameraSyncPending = true;
    },
    setEnemies(enemies) {
      const runtime = getRuntimeComponent();
      runtime.enemies = enemies;
      runtime.enemySyncPending = true;
    },
    setEngine(engine) {
      const runtime = getRuntimeComponent();
      runtime.engine = engine;
    },
    requestStartFromGesture() {
      const requests = getRequestComponent();
      requests.startRequested = true;
      requestPointerLockFromGesture();
    },
    requestPause() {
      getRequestComponent().pauseRequested = true;
    },
    requestResumeFromGesture() {
      const requests = getRequestComponent();
      requests.resumeRequested = true;
      requestPointerLockFromGesture();
    },
    requestTogglePauseFromGesture() {
      const state = getStateComponent().current;

      if (state === GameFlowState.PAUSED) {
        this.requestResumeFromGesture();
        return;
      }

      if (state === GameFlowState.PLAYING) {
        this.requestPause();
      }
    },
    requestRestart() {
      getRequestComponent().restartRequested = true;
    },
    requestGameOver(reason = null) {
      const requests = getRequestComponent();
      requests.gameOverRequested = true;
      requests.gameOverReason =
        reason ?? requests.gameOverReason ?? 'game-over';
    },
    onEnemyDefeated() {
      getStateComponent().enemyDefeatedCount += 1;
    },
    resetEnemyDefeatedCount() {
      getStateComponent().enemyDefeatedCount = 0;
    },
    getEnemyDefeatedCount() {
      return getStateComponent().enemyDefeatedCount;
    },
    getState() {
      return getStateComponent().current;
    },
  };
}
