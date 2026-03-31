import { createComponentType } from '../../core/Component.ts';

export interface GameFlowEngineControl {
  enterPointerlock?(): void;
}

export interface GameFlowCameraControl {
  attachControl?(): void;
  detachControl?(): void;
}

export interface GameFlowEnemyUpdateTarget {
  enableUpdate?(): void;
  disableUpdate?(): void;
}

export interface GameFlowRuntimeRefsComponent {
  engine: GameFlowEngineControl | null;
  camera: GameFlowCameraControl | null;
  enemies: GameFlowEnemyUpdateTarget[];
  reloadGame: (() => void) | null;
  cameraInputAttached: boolean;
  enemyUpdatesEnabled: boolean;
  cameraSyncPending: boolean;
  enemySyncPending: boolean;
}

export const GameFlowRuntimeRefsComponent =
  createComponentType<GameFlowRuntimeRefsComponent>(
    'GameFlowRuntimeRefsComponent',
  );
