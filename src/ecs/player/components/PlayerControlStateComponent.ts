import { createComponentType } from '../../core/Component.ts';

export interface PlayerControlStateComponent {
  inputEnabled: boolean;
  inputMap: Record<string, boolean>;
  moveInputX: number;
  moveInputZ: number;
  jumpKeyReleased: boolean;
  dashRequested: boolean;
  attackRequested: boolean;
  danceToggleRequested: boolean;
  jumpBufferTime: number;
  jumpBufferTimer: number;
}

export const PlayerControlStateComponent =
  createComponentType<PlayerControlStateComponent>(
    'PlayerControlStateComponent',
  );
