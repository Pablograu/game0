import type { PhysicsRaycastResult } from '@babylonjs/core';
import { createComponentType } from '../../core/Component.ts';
import { PlayerJumpPhaseState } from '../PlayerStateEnums.ts';

export interface PlayerGroundingStateComponent {
  isGrounded: boolean;
  wasGrounded: boolean;
  jumpPhase: PlayerJumpPhaseState;
  jumpForce: number;
  jumpCutMultiplier: number;
  coyoteTime: number;
  coyoteTimer: number;
  jumpBufferTime: number;
  jumpBufferTimer: number;
  airTime: number;
  minAirTime: number;
  fallingAnimDelay: number;
  groundLostTimer: number;
  groundLostGrace: number;
  playerHeight: number;
  playerRadius: number;
  raycastResult: PhysicsRaycastResult;
}

export const PlayerGroundingStateComponent =
  createComponentType<PlayerGroundingStateComponent>(
    'PlayerGroundingStateComponent',
  );
