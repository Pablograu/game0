import type { AnimationGroup } from '@babylonjs/core';
import { createComponentType } from '../../core/Component.ts';

export interface EnemyAnimationStateComponent {
  currentAnimation: string;
  animationGroups: Map<string, AnimationGroup>;
  blendingSpeed: number;
}

export const EnemyAnimationStateComponent =
  createComponentType<EnemyAnimationStateComponent>(
    'EnemyAnimationStateComponent',
  );
