import { createComponentType } from '../../core/Component.ts';

export interface EnemyUiPresentationComponent {
  linkOffsetY: number;
  baseScale: number;
  maxVisibleDistance: number;
  damageRevealDuration: number;
}

export const EnemyUiPresentationComponent =
  createComponentType<EnemyUiPresentationComponent>(
    'EnemyUiPresentationComponent',
  );
