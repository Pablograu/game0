import type { AdvancedDynamicTexture, TextBlock } from '@babylonjs/gui';
import { createComponentType } from '../../core/Component.ts';
import { PlayerLifeState } from '../PlayerStateEnums.ts';

export interface PlayerHealthStateComponent {
  lifeState: PlayerLifeState;
  currentHealth: number;
  maxHealth: number;
  isInvulnerable: boolean;
  invulnerabilityDuration: number;
  invulnerabilityTimer: number;
  blinkActive: boolean;
  healthUI: AdvancedDynamicTexture | null;
  healthText: TextBlock | null;
}

export const PlayerHealthStateComponent =
  createComponentType<PlayerHealthStateComponent>('PlayerHealthStateComponent');
