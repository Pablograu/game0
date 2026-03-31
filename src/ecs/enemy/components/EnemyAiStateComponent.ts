import { createComponentType } from '../../core/Component.ts';
import { EnemyBehaviorState } from '../EnemyStateEnums.ts';

export interface EnemyAiStateComponent {
  current: EnemyBehaviorState;
  previous: EnemyBehaviorState | null;
  distanceToPlayer: number;
  targetYAngle: number;
  rotationSpeed: number;
  stateElapsedTime: number;
  alertAudioPlayed: boolean;
}

export const EnemyAiStateComponent = createComponentType<EnemyAiStateComponent>(
  'EnemyAiStateComponent',
);
