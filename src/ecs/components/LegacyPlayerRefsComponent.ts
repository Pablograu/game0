import type { Camera, Mesh, Scene } from '@babylonjs/core';
import type { PlayerController } from '../../player/PlayerController.ts';
import { createComponentType } from '../core/Component.ts';

export interface LegacyPlayerRefsComponent {
  readonly scene: Scene;
  readonly mesh: Mesh;
  readonly camera: Camera | null;
  readonly controller: PlayerController;
}

export const LegacyPlayerRefsComponent =
  createComponentType<LegacyPlayerRefsComponent>('LegacyPlayerRefsComponent');
