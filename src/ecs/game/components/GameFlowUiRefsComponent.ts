import type {
  AdvancedDynamicTexture,
  Button,
  Control,
  TextBlock,
} from '@babylonjs/gui';
import { createComponentType } from '../../core/Component.ts';

export interface GameFlowUiRefsComponent {
  uiTexture: AdvancedDynamicTexture | null;
  startPanel: Control | null;
  pausePanel: Control | null;
  deadPanel: Control | null;
  titleText: TextBlock | null;
  startButton: Button | null;
  deadStatsText: TextBlock | null;
}

export const GameFlowUiRefsComponent =
  createComponentType<GameFlowUiRefsComponent>('GameFlowUiRefsComponent');
