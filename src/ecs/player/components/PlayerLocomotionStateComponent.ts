import type { Quaternion, Vector3 } from '@babylonjs/core';
import { createComponentType } from '../../core/Component.ts';
import { PlayerLocomotionMode } from '../PlayerStateEnums.ts';

export interface PlayerLocomotionStateComponent {
  mode: PlayerLocomotionMode;
  isMoving: boolean;
  isDashing: boolean;
  isKnockedBack: boolean;
  moveDirection: Vector3;
  moveSpeed: number;
  normalMoveSpeed: number;
  dashSpeed: number;
  dashDuration: number;
  dashTimer: number;
  dashCooldown: number;
  dashCooldownTimer: number;
  dashDirection: Vector3;
  lastFacingDirection: Vector3;
  lastKnockbackDir: Vector3;
  targetAngle: number;
  targetRotation: Quaternion;
  targetScale: Vector3;
  originalScale: Vector3;
  rotationSpeed: number;
  scaleSpeed: number;
  recoilForce: number;
  recoilVelocity: Vector3;
  recoilDecay: number;
  pogoForce: number;
  damageKnockbackForce: number;
  knockbackDuration: number;
}

export const PlayerLocomotionStateComponent =
  createComponentType<PlayerLocomotionStateComponent>(
    'PlayerLocomotionStateComponent',
  );
