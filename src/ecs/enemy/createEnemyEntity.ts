import {
  Axis,
  type AnimationGroup,
  type AbstractMesh,
  type Mesh,
  type PhysicsAggregate,
  type Scene,
  type Skeleton,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { EnemyConfig } from './EnemySpawner.ts';
import LootManager from '../../LootManager.ts';
import { Ragdoll } from '../../ragdoll_copy.js';
import type { EntityId } from '../core/Entity.ts';
import type { World } from '../core/World.ts';
import {
  EnemyAiStateComponent,
  EnemyAnimationStateComponent,
  EnemyAttackStateComponent,
  EnemyCombatStateComponent,
  EnemyIdentityComponent,
  EnemyLifecycleRequestComponent,
  EnemyLocomotionStateComponent,
  EnemyPatrolStateComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyRagdollStateComponent,
  EnemySpawnStateComponent,
  EnemyStatsComponent,
  EnemyStuckStateComponent,
} from './components/index.ts';
import {
  EnemyBehaviorState,
  EnemyCombatMode,
  EnemyLifeState,
  EnemyRagdollMode,
  EnemySpawnState,
} from './EnemyStateEnums.ts';
import { HitboxSystem } from '../../HitboxSystem.ts';

export interface CreateEnemyEntityOptions {
  world: World;
  scene: Scene;
  modelPath: string;
  debugLabel: string;
  config: Required<EnemyConfig>;
  root: TransformNode;
  meshes: AbstractMesh[];
  mesh: Mesh;
  physicsAggregate: PhysicsAggregate | null;
  animationGroups: AnimationGroup[];
  skeleton: Skeleton | null;
  armatureNode: TransformNode | null;
  lootManager?: LootManager | null;
}

export function createEnemyEntity(options: CreateEnemyEntityOptions): EntityId {
  const entityId = options.world.createEntity();
  const lootManager = options.lootManager ?? new LootManager();
  const attackHitbox = new HitboxSystem(
    `enemyAttackHitbox_${Math.random().toString(36).slice(2, 11)}`,
    new Vector3(1.5, 1.5, 1.5),
    options.scene,
    options.config.debug,
  );
  lootManager.init(options.scene);

  options.world.addComponent(entityId, EnemyIdentityComponent, {
    kind: 'enemy',
    modelPath: options.modelPath,
    debugLabel: options.debugLabel,
  });

  options.world.addComponent(entityId, EnemyPhysicsViewRefsComponent, {
    scene: options.scene,
    root: options.root,
    meshes: options.meshes,
    mesh: options.mesh,
    body: options.mesh.physicsBody ?? null,
    physicsAggregate: options.physicsAggregate,
    physicsEngine:
      options.scene.getPhysicsEngine() as unknown as EnemyPhysicsViewRefsComponent['physicsEngine'],
    animationGroups: options.animationGroups,
    skeleton: options.skeleton,
    armatureNode: options.armatureNode,
    lootManager,
    debugVisionCircle: null,
  });

  options.world.addComponent(entityId, EnemyAnimationStateComponent, {
    currentAnimation: 'walking',
    animationGroups: initializeEnemyAnimationGroups(options.animationGroups),
    blendingSpeed: 4,
  });

  options.world.addComponent(entityId, EnemyAiStateComponent, {
    current: EnemyBehaviorState.PATROL,
    previous: null,
    distanceToPlayer: Number.POSITIVE_INFINITY,
    targetYAngle: 0,
    rotationSpeed: 8,
    stateElapsedTime: 0,
    alertAudioPlayed: false,
  });

  options.world.addComponent(entityId, EnemyPatrolStateComponent, {
    patrolTarget: options.mesh.position.clone(),
    patrolRadius: 6,
    targetReachDistance: 1,
    chaseGiveUpRange: options.config.chaseGiveUpRange,
  });

  options.world.addComponent(entityId, EnemyStuckStateComponent, {
    lastPosition: options.mesh.position.clone(),
    stuckTimer: 0,
    stuckThreshold: 0.4,
    minMovementDistance: 0.05,
  });

  options.world.addComponent(entityId, EnemyLocomotionStateComponent, {
    overrideDirection: null,
    overrideTimer: 0,
  });

  options.world.addComponent(entityId, EnemyStatsComponent, {
    currentHp: options.config.hp,
    maxHp: options.config.hp,
    patrolSpeed: options.config.patrolSpeed,
    chaseSpeed: options.config.chaseSpeed,
    visionRange: options.config.visionRange,
    attackRange: options.config.attackRange,
    attackCooldown: options.config.attackCooldown,
    contactDamage: options.config.contactDamage,
    knockbackForce: options.config.knockbackForce,
    mass: options.config.mass,
    stunDuration: options.config.stunDuration,
    debugEnabled: options.config.debug,
    lifeState: EnemyLifeState.ALIVE,
  });

  options.world.addComponent(entityId, EnemyCombatStateComponent, {
    mode: EnemyCombatMode.IDLE,
    attackCooldownTimer: 0,
    contactDamageCooldown: 0.8,
    damageCooldownTimer: 0,
    stunTimer: 0,
    canDamagePlayer: true,
  });

  options.world.addComponent(entityId, EnemyAttackStateComponent, {
    hitbox: attackHitbox,
    hitboxActivationDelay: 1,
    hitboxOffsetDistance: 1.2,
    hitboxSize: { x: 1.5, y: 1.5, z: 1.5 },
    attackAnimationSpeed: 1.2,
    attackElapsedTime: 0,
    attackDuration: 0,
    attackInProgress: false,
    hitboxActive: false,
    hasHitPlayerThisAttack: false,
  });

  options.world.addComponent(entityId, EnemyRagdollStateComponent, {
    mode:
      options.skeleton && options.armatureNode
        ? EnemyRagdollMode.READY
        : EnemyRagdollMode.UNINITIALIZED,
    ragdoll: createEnemyRagdoll(options.skeleton, options.armatureNode),
    ragdollSkeleton: options.skeleton,
    ragdollArmatureNode: options.armatureNode,
    lastKnockbackDir: Vector3.Zero(),
    pendingImpulse: null,
    pendingImpulseDelay: 0,
  });

  options.world.addComponent(entityId, EnemySpawnStateComponent, {
    spawnPoint: options.mesh.position.clone(),
    state: EnemySpawnState.SPAWNED,
    despawnDelay: 4,
    despawnTimer: 0,
  });

  options.world.addComponent(entityId, EnemyLifecycleRequestComponent, {
    damageRequests: [],
    deathRequested: false,
    lootRequested: false,
    despawnRequested: false,
    deathPosition: null,
  });

  return entityId;
}

function initializeEnemyAnimationGroups(animationGroups: AnimationGroup[]) {
  const groups = new Map<string, AnimationGroup>();

  for (const group of animationGroups) {
    const key = group.name.toLowerCase();
    group.enableBlending = true;
    group.blendingSpeed = 4;
    groups.set(key, group);
  }

  return groups;
}

function createEnemyRagdoll(
  skeleton: Skeleton | null,
  armatureNode: TransformNode | null,
): Ragdoll | null {
  if (!skeleton || !armatureNode) {
    return null;
  }

  armatureNode.scaling = new Vector3(0.017, 0.017, 0.017);

  const ragdoll = new Ragdoll(skeleton, armatureNode, [
    { bones: ['mixamorig7:Hips'], size: 0.45, boxOffset: 0.01 },
    {
      bones: ['mixamorig7:Spine2'],
      size: 0.4,
      height: 0.6,
      boxOffset: 0.05,
      boneOffsetAxis: Axis.Z,
      min: -1,
      max: 1,
    },
    {
      bones: ['mixamorig7:LeftArm', 'mixamorig7:RightArm'],
      depth: 0.1,
      size: 0.1,
      width: 0.5,
      boxOffset: 0.1,
      boneOffsetAxis: Axis.Y,
    },
    {
      bones: ['mixamorig7:LeftForeArm', 'mixamorig7:RightForeArm'],
      depth: 0.1,
      size: 0.1,
      width: 0.5,
      min: -1,
      max: 1,
      boxOffset: 0.12,
      boneOffsetAxis: Axis.Y,
    },
    {
      bones: ['mixamorig7:LeftUpLeg', 'mixamorig7:RightUpLeg'],
      depth: 0.1,
      size: 0.2,
      width: 0.08,
      height: 0.7,
      min: -1,
      max: 1,
      boxOffset: 0.2,
    },
    {
      bones: ['mixamorig7:LeftLeg', 'mixamorig7:RightLeg'],
      depth: 0.08,
      size: 0.3,
      width: 0.1,
      height: 0.4,
      min: -1,
      max: 1,
      boxOffset: 0.2,
      boneOffsetAxis: Axis.Y,
    },
    {
      bones: ['mixamorig7:LeftHand', 'mixamorig7:RightHand'],
      depth: 0.2,
      size: 0.2,
      width: 0.2,
      min: -1,
      max: 1,
      boxOffset: 0.1,
      boneOffsetAxis: Axis.Y,
    },
    {
      bones: ['mixamorig7:Head'],
      size: 0.4,
      boxOffset: 0,
      boneOffsetAxis: Axis.Y,
      min: -1,
      max: 1,
    },
    {
      bones: ['mixamorig7:LeftFoot', 'mixamorig7:RightFoot'],
      depth: 0.1,
      size: 0.1,
      width: 0.2,
      min: -1,
      max: 1,
      boxOffset: 0.05,
    },
  ]);

  for (const aggregate of ragdoll.getAggregates()) {
    if (aggregate.shape) {
      aggregate.shape.filterMembershipMask = 0x0004;
      aggregate.shape.filterCollideMask = 0x0001;
    }
  }

  return ragdoll;
}
