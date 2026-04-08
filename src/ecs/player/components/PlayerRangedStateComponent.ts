import { createComponentType } from '../../core/Component.ts';

export interface PlayerRangedStateComponent {
  isAiming: boolean;
  fireRequested: boolean;
  fireTimer: number;
  shootTimer: number;
  isReloading: boolean;
  reloadTimer: number;
  currentAmmo: number;
}

export const PlayerRangedStateComponent =
  createComponentType<PlayerRangedStateComponent>('PlayerRangedStateComponent');
