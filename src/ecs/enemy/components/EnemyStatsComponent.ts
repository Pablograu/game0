import { createComponentType } from '../../core/Component.ts';
import { EnemyLifeState } from '../EnemyStateEnums.ts';

export interface EnemyStatsComponent {
  currentHp: number;
  maxHp: number;
  patrolSpeed: number;
  chaseSpeed: number;
  visionRange: number;
  attackRange: number;
  attackCooldown: number;
  contactDamage: number;
  knockbackForce: number;
  mass: number;
  stunDuration: number;
  debugEnabled: boolean;
  lifeState: EnemyLifeState;
}

export const EnemyStatsComponent = createComponentType<EnemyStatsComponent>(
  'EnemyStatsComponent',
);
