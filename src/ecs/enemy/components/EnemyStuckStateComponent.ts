import type { Vector3 } from '@babylonjs/core';
import { createComponentType } from '../../core/Component.ts';

export interface EnemyStuckStateComponent {
  lastPosition: Vector3;
  stuckTimer: number;
  stuckThreshold: number;
  minMovementDistance: number;
}

export const EnemyStuckStateComponent =
  createComponentType<EnemyStuckStateComponent>('EnemyStuckStateComponent');
