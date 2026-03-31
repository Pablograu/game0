import type { HitboxSystem } from '../../../HitboxSystem.ts';
import { createComponentType } from '../../core/Component.ts';

export interface EnemyAttackStateComponent {
  hitbox: HitboxSystem | null;
  hitboxActivationDelay: number;
  hitboxOffsetDistance: number;
  hitboxSize: {
    x: number;
    y: number;
    z: number;
  };
  attackAnimationSpeed: number;
  attackElapsedTime: number;
  attackDuration: number;
  attackInProgress: boolean;
  hitboxActive: boolean;
  hasHitPlayerThisAttack: boolean;
}

export const EnemyAttackStateComponent =
  createComponentType<EnemyAttackStateComponent>('EnemyAttackStateComponent');
