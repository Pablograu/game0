import type { Skeleton, TransformNode, Vector3 } from '@babylonjs/core';
import { createComponentType } from '../../core/Component.ts';
import { EnemyRagdollMode } from '../EnemyStateEnums.ts';

export interface EnemyRagdollStateComponent {
  mode: EnemyRagdollMode;
  ragdoll: unknown | null;
  ragdollSkeleton: Skeleton | null;
  ragdollArmatureNode: TransformNode | null;
  lastKnockbackDir: Vector3;
  pendingImpulse: Vector3 | null;
  pendingImpulseDelay: number;
}

export const EnemyRagdollStateComponent =
  createComponentType<EnemyRagdollStateComponent>('EnemyRagdollStateComponent');
