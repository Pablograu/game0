import { createComponentType } from '../../core/Component.ts';
import type { PlayerGameplayConfig } from '../runtime/playerRuntime.ts';

export type PlayerGameplayConfigComponent = PlayerGameplayConfig;

export const PlayerGameplayConfigComponent =
  createComponentType<PlayerGameplayConfigComponent>(
    'PlayerGameplayConfigComponent',
  );
