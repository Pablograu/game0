import type { Camera, Mesh, PhysicsBody, Scene } from '@babylonjs/core';
import type { CameraShaker } from '../../../CameraShaker.ts';
import { createComponentType } from '../../core/Component.ts';

export interface PlayerPhysicsViewRefsComponent {
  scene: Scene;
  mesh: Mesh;
  body: PhysicsBody | null;
  camera: Camera | null;
  cameraShaker: CameraShaker | null;
  physicsEngine: unknown;
}

export const PlayerPhysicsViewRefsComponent =
  createComponentType<PlayerPhysicsViewRefsComponent>(
    'PlayerPhysicsViewRefsComponent',
  );
