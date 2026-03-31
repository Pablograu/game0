import type {
  Camera,
  Mesh,
  PhysicsBody,
  PhysicsRaycastResult,
  Scene,
  Vector3,
} from '@babylonjs/core';
import type { CameraShaker } from '../../../CameraShaker.ts';
import { createComponentType } from '../../core/Component.ts';

interface PhysicsEngineRaycastApi {
  raycastToRef(from: Vector3, to: Vector3, result: PhysicsRaycastResult): void;
}

export interface PlayerPhysicsViewRefsComponent {
  scene: Scene;
  mesh: Mesh;
  body: PhysicsBody | null;
  camera: Camera | null;
  cameraShaker: CameraShaker | null;
  physicsEngine: PhysicsEngineRaycastApi | null;
}

export const PlayerPhysicsViewRefsComponent =
  createComponentType<PlayerPhysicsViewRefsComponent>(
    'PlayerPhysicsViewRefsComponent',
  );
