import type {
  AbstractMesh,
  AnimationGroup,
  Mesh,
  PhysicsAggregate,
  PhysicsEngine,
  Scene,
  Skeleton,
  TransformNode,
} from '@babylonjs/core';
import type { EnemyController } from '../../../EnemyController.ts';
import type LootManager from '../../../LootManager.ts';
import { createComponentType } from '../../core/Component.ts';

export interface EnemyPhysicsViewRefsComponent {
  scene: Scene;
  controller: EnemyController | null;
  root: TransformNode;
  meshes: AbstractMesh[];
  mesh: Mesh;
  body: Mesh['physicsBody'] | null;
  physicsAggregate: PhysicsAggregate | null;
  physicsEngine: PhysicsEngine | null;
  animationGroups: AnimationGroup[];
  skeleton: Skeleton | null;
  armatureNode: TransformNode | null;
  lootManager: LootManager | null;
}

export const EnemyPhysicsViewRefsComponent =
  createComponentType<EnemyPhysicsViewRefsComponent>(
    'EnemyPhysicsViewRefsComponent',
  );
