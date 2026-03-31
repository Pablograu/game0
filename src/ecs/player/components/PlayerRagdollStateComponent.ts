import type { Vector3 } from '@babylonjs/core';
import { createComponentType } from '../../core/Component.ts';
import { PlayerRagdollMode } from '../PlayerStateEnums.ts';

export interface PlayerRagdollStateComponent {
  mode: PlayerRagdollMode;
  ragdoll: unknown | null;
  lastKnockbackDir: Vector3;
  pendingImpulse: Vector3 | null;
  pendingImpulseDelay: number;
}

export const PlayerRagdollStateComponent =
  createComponentType<PlayerRagdollStateComponent>(
    'PlayerRagdollStateComponent',
  );
