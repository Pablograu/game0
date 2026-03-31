import type { AnimationGroup } from '@babylonjs/core';
import type { PlayerAnimationRegistry } from '../../../player/PlayerAnimations.ts';
import { createComponentType } from '../../core/Component.ts';

export interface PlayerAnimationStateComponent {
  currentAnimation: string;
  blendingSpeed: number;
  animationGroups: Map<string, AnimationGroup>;
  animationRegistry: PlayerAnimationRegistry;
}

export const PlayerAnimationStateComponent =
  createComponentType<PlayerAnimationStateComponent>(
    'PlayerAnimationStateComponent',
  );
