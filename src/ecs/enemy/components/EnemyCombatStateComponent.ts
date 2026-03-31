import { createComponentType } from '../../core/Component.ts';
import { EnemyCombatMode } from '../EnemyStateEnums.ts';

export interface EnemyCombatStateComponent {
  mode: EnemyCombatMode;
  attackCooldownTimer: number;
  contactDamageCooldown: number;
  damageCooldownTimer: number;
  canDamagePlayer: boolean;
  updatesEnabled: boolean;
}

export const EnemyCombatStateComponent =
  createComponentType<EnemyCombatStateComponent>('EnemyCombatStateComponent');
