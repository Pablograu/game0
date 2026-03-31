import type { Vector3 } from '@babylonjs/core';
import { createComponentType } from '../../core/Component.ts';

export interface PlayerDamageRequest {
  amount: number;
  damageSourcePosition: Vector3 | null;
}

export interface PlayerSurvivabilityRequestComponent {
  damageRequests: PlayerDamageRequest[];
  deathRequested: boolean;
  respawnRequested: boolean;
  gameOverRequested: boolean;
  gameOverReason: string | null;
  autoSignalGameOver: boolean;
}

export const PlayerSurvivabilityRequestComponent =
  createComponentType<PlayerSurvivabilityRequestComponent>(
    'PlayerSurvivabilityRequestComponent',
  );
