import type { Vector3 } from '@babylonjs/core';
import { createComponentType } from '../../core/Component.ts';

export interface PlayerSpawnStateComponent {
  spawnPoint: Vector3;
}

export const PlayerSpawnStateComponent =
  createComponentType<PlayerSpawnStateComponent>('PlayerSpawnStateComponent');
