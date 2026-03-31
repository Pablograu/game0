import { createComponentType } from '../../core/Component.ts';
import { PlayerCombatMode } from '../PlayerStateEnums.ts';

export interface PlayerCombatStateComponent {
  mode: PlayerCombatMode;
  isAttacking: boolean;
  isDancing: boolean;
  useLeftPunch: boolean;
  punchSpeed: number;
  attackMoveSpeedMultiplier: number;
  punchHitboxDelay: number;
  magnetismRange: number;
  magnetismLungeSpeed: number;
  attackQueue: string[];
  maxAttackQueue: number;
  activeAttackAnimation: string | null;
  activeAttackElapsed: number;
  activeAttackDuration: number;
  hitboxStartTime: number;
  hitboxEndTime: number;
}

export const PlayerCombatStateComponent =
  createComponentType<PlayerCombatStateComponent>('PlayerCombatStateComponent');
