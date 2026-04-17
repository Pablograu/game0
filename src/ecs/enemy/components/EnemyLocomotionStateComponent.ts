import type { Vector3 } from '@babylonjs/core';
import { createComponentType } from '../../core/Component.ts';

export interface EnemyLocomotionStateComponent {
  overrideDirection: Vector3 | null;
  overrideTimer: number;
  knockbackTimer: number;
}

export const EnemyLocomotionStateComponent =
  createComponentType<EnemyLocomotionStateComponent>(
    'EnemyLocomotionStateComponent',
  );
