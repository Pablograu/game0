import type { AnimationGroup } from '@babylonjs/core';
import type { PlayerAnimationRegistry } from '../runtime/PlayerAnimations.ts';
import { createComponentType } from '../../core/Component.ts';

export interface PlayerAnimationStateComponent {
  currentAnimation: string;
  blendingSpeed: number;
  activeSpeedRatio: number;
  animationGroups: Map<string, AnimationGroup>;
  animationRegistry: PlayerAnimationRegistry;
  overrideAnimation: string | null;
  overrideLoop: boolean;
  overrideForceReset: boolean;
  overrideSpeedRatio: number;
  overrideTimer: number;
}

export const PlayerAnimationStateComponent =
  createComponentType<PlayerAnimationStateComponent>(
    'PlayerAnimationStateComponent',
  );
