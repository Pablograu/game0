import type { Vector3 } from '@babylonjs/core';
import type { WeaponSystem } from '../../../WeaponSystem.ts';
import { createComponentType } from '../../core/Component.ts';
import { PlayerWeaponPhase } from '../PlayerStateEnums.ts';

export interface PlayerWeaponStateComponent {
  phase: PlayerWeaponPhase;
  weaponSystem: WeaponSystem | null;
  damage: number;
  attackDuration: number;
  attackCooldown: number;
  attackTimer: number;
  cooldownTimer: number;
  hitboxSize: Vector3 | null;
  hitboxOffset: number;
  playerKnockback: number;
  registeredEnemyCount: number;
  hitEnemiesThisSwingCount: number;
  hitObjectsThisSwingCount: number;
  hitboxActive: boolean;
  hitEnemiesThisSwing: Set<unknown>;
}

export const PlayerWeaponStateComponent =
  createComponentType<PlayerWeaponStateComponent>('PlayerWeaponStateComponent');
