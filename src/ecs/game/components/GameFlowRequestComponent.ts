import { createComponentType } from '../../core/Component.ts';

export interface GameFlowRequestComponent {
  startRequested: boolean;
  pauseRequested: boolean;
  resumeRequested: boolean;
  togglePauseRequested: boolean;
  restartRequested: boolean;
  gameOverRequested: boolean;
  gameOverReason: string | null;
  openInventoryRequested: boolean;
  closeInventoryRequested: boolean;
  pointerLockRequestPending: boolean;
}

export const GameFlowRequestComponent =
  createComponentType<GameFlowRequestComponent>('GameFlowRequestComponent');
