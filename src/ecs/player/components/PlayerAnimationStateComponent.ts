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
  /** Tracks the active lower-body group key when in layered mode (null if not layered). */
  currentLayerLower: string | null;
  /** Tracks the active upper-body group key when in layered mode (null if not layered). */
  currentLayerUpper: string | null;
}

export const PlayerAnimationStateComponent =
  createComponentType<PlayerAnimationStateComponent>(
    'PlayerAnimationStateComponent',
  );
