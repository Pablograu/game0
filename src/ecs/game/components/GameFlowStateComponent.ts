import { createComponentType } from '../../core/Component.ts';
import { GameFlowState } from '../GameFlowState.ts';

export interface GameFlowStateComponent {
  current: GameFlowState;
  previous: GameFlowState | null;
  transitionCount: number;
  gameOverReason: string | null;
  enemyDefeatedCount: number;
}

export const GameFlowStateComponent =
  createComponentType<GameFlowStateComponent>('GameFlowStateComponent');
