import { createComponentType } from '../../core/Component.ts';
import { EnemyCombatMode } from '../EnemyStateEnums.ts';

export interface EnemyCombatStateComponent {
  mode: EnemyCombatMode;
  attackCooldownTimer: number;
  contactDamageCooldown: number;
  damageCooldownTimer: number;
  stunTimer: number;
  canDamagePlayer: boolean;
}

export const EnemyCombatStateComponent =
  createComponentType<EnemyCombatStateComponent>('EnemyCombatStateComponent');
