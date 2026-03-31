import type { Vector3 } from '@babylonjs/core';
import { createComponentType } from '../../core/Component.ts';

export interface EnemyDamageRequest {
  amount: number;
  damageSourcePosition: Vector3 | null;
}

export interface EnemyLifecycleRequestComponent {
  damageRequests: EnemyDamageRequest[];
  deathRequested: boolean;
  lootRequested: boolean;
  despawnRequested: boolean;
  deathPosition: Vector3 | null;
}

export const EnemyLifecycleRequestComponent =
  createComponentType<EnemyLifecycleRequestComponent>(
    'EnemyLifecycleRequestComponent',
  );
