import { createComponentType } from '../../core/Component.ts';

export interface GameFlowEngineControl {
  enterPointerlock?(): void;
}

export interface GameFlowCameraControl {
  attachControl?(): void;
  detachControl?(): void;
}

export interface GameFlowRuntimeRefsComponent {
  engine: GameFlowEngineControl | null;
  camera: GameFlowCameraControl | null;
  reloadGame: (() => void) | null;
  cameraInputAttached: boolean;
  cameraSyncPending: boolean;
}

export const GameFlowRuntimeRefsComponent =
  createComponentType<GameFlowRuntimeRefsComponent>(
    'GameFlowRuntimeRefsComponent',
  );
