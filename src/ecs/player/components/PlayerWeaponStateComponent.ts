import type { Vector3 } from '@babylonjs/core';
import { createComponentType } from '../../core/Component.ts';
import type { EntityId } from '../../core/Entity.ts';
import type { HitboxSystem } from '../../../HitboxSystem.ts';
import { PlayerWeaponPhase } from '../PlayerStateEnums.ts';

export interface PlayerWeaponStateComponent {
  phase: PlayerWeaponPhase;
  hitbox: HitboxSystem | null;
  damage: number;
  attackDuration: number;
  attackCooldown: number;
  cooldownTimer: number;
  hitboxSize: Vector3 | null;
  hitboxOffset: number;
  playerKnockback: number;
  registeredEnemyCount: number;
  hitEnemiesThisSwingCount: number;
  hitboxActive: boolean;
  hitEnemiesThisSwing: Set<EntityId>;
}

export const PlayerWeaponStateComponent =
  createComponentType<PlayerWeaponStateComponent>('PlayerWeaponStateComponent');
