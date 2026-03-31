import { createComponentType } from '../../core/Component.ts';
import type { PlayerGameOverHandler } from '../../../player/PlayerFacade.ts';

export interface PlayerGameOverHandlerComponent {
  handler: PlayerGameOverHandler | null;
}

export const PlayerGameOverHandlerComponent =
  createComponentType<PlayerGameOverHandlerComponent>(
    'PlayerGameOverHandlerComponent',
  );
