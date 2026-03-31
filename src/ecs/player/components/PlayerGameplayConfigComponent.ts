import { createComponentType } from '../../core/Component.ts';
import type { PlayerGameplayConfig } from '../../../player/playerRuntime.ts';

export type PlayerGameplayConfigComponent = PlayerGameplayConfig;

export const PlayerGameplayConfigComponent =
  createComponentType<PlayerGameplayConfigComponent>(
    'PlayerGameplayConfigComponent',
  );
