import { createComponentType } from '../../core/Component.ts';

export interface PlayerControlStateComponent {
  inputEnabled: boolean;
  inputMap: Record<string, boolean>;
  jumpKeyReleased: boolean;
  jumpBufferTime: number;
  jumpBufferTimer: number;
}

export const PlayerControlStateComponent =
  createComponentType<PlayerControlStateComponent>(
    'PlayerControlStateComponent',
  );
