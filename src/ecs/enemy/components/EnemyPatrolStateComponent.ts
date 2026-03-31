import type { Vector3 } from '@babylonjs/core';
import { createComponentType } from '../../core/Component.ts';

export interface EnemyPatrolStateComponent {
  patrolTarget: Vector3;
  patrolRadius: number;
  targetReachDistance: number;
  chaseGiveUpRange: number;
}

export const EnemyPatrolStateComponent =
  createComponentType<EnemyPatrolStateComponent>('EnemyPatrolStateComponent');
