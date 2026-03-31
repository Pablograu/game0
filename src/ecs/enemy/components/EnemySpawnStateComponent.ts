import type { Vector3 } from '@babylonjs/core';
import { createComponentType } from '../../core/Component.ts';
import { EnemySpawnState } from '../EnemyStateEnums.ts';

export interface EnemySpawnStateComponent {
  spawnPoint: Vector3;
  state: EnemySpawnState;
  despawnDelay: number;
  despawnTimer: number;
}

export const EnemySpawnStateComponent =
  createComponentType<EnemySpawnStateComponent>('EnemySpawnStateComponent');
