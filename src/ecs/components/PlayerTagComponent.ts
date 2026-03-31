import { createComponentType } from '../core/Component.ts';

export interface PlayerTagComponent {
  readonly kind: 'player';
}

export const PlayerTagComponent =
  createComponentType<PlayerTagComponent>('PlayerTagComponent');
