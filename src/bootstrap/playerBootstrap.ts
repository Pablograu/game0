import {
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  Quaternion,
  TransformNode,
  Vector3,
  type ArcRotateCamera,
  type Engine,
  type Mesh,
  type Scene,
  type Skeleton,
} from '@babylonjs/core';
import { ImportMeshAsync } from '@babylonjs/core/Loading';
import { CameraShaker } from '../CameraShaker.ts';
import { WeaponSystem } from '../WeaponSystem.ts';
import {
  bootstrapGameEcs,
  createPlayerDebugApi,
  type EnemyUiApi,
  type GameEcsRuntime,
  type PlayerDebugApi,
} from '../ecs/index.ts';
import {
  createPlayerAnimationRegistry,
  type PlayerAnimationRegistry,
} from '../ecs/player/runtime/PlayerAnimations.ts';
import { DEFAULT_PLAYER_GAMEPLAY_CONFIG } from '../ecs/player/runtime/playerRuntime.ts';
import { COL_ENEMY, COL_ENVIRONMENT, COL_PLAYER } from './sceneRuntime.ts';
import { HudManager } from '../HudManager.ts';

export type RuntimePlayerMesh = Mesh & {
  animationModels?: PlayerAnimationRegistry;
  armatureNode?: Mesh | null;
  skeleton?: Skeleton;
};

export interface LoadedPlayerCharacter {
  playerAnimations: PlayerAnimationRegistry;
  playerMesh: RuntimePlayerMesh;
  shoulderAnchor: TransformNode;
}

export interface PlayerEcsBootstrap {
  cameraShaker: CameraShaker;
  ecsRuntime: GameEcsRuntime;
  playerDebugApi: PlayerDebugApi;
}

export async function loadPlayerCharacter(
  scene: Scene,
): Promise<LoadedPlayerCharacter> {
  const result = await ImportMeshAsync('/models/player.glb', scene);
  const rootMesh = result.meshes[0];
  const skeleton = result.skeletons[0];
  const armatureNode = result.transformNodes.find(
    (node) => node.name === 'Armature',
  ) as Mesh | undefined;
  const animationGroups = result.animationGroups;
  const physicsCapsule = MeshBuilder.CreateCapsule(
    'player',
    {
      height: 2.2,
      radius: 0.5,
    },
    scene,
  ) as RuntimePlayerMesh;

  physicsCapsule.position = new Vector3(0, 4, 0);
  physicsCapsule.isVisible = false;
  physicsCapsule.checkCollisions = true;
  physicsCapsule.scaling = new Vector3(1, 1, 1);
  physicsCapsule.rotationQuaternion = Quaternion.FromEulerAngles(0, Math.PI, 0);

  rootMesh.parent = physicsCapsule;
  rootMesh.position = new Vector3(0, -1.1, 0);

  physicsCapsule.skeleton = skeleton;
  physicsCapsule.armatureNode = armatureNode ?? null;

  const animationRegistry = createPlayerAnimationRegistry(rootMesh, {
    idle: animationGroups.find((ag) => ag.name.toLowerCase() === 'idle'),
    run: animationGroups.find((ag) => ag.name.toLowerCase() === 'run'),
    jump: animationGroups.find((ag) => ag.name.toLowerCase() === 'jump'),
    punch_L: animationGroups.find((ag) => ag.name === 'punch_L'),
    punch_R: animationGroups.find((ag) => ag.name === 'punch_R'),
    macarena: animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'macarena',
    ),
    dash: animationGroups.find((ag) => ag.name.toLowerCase() === 'dash'),
    dead: animationGroups.find((ag) => ag.name.toLowerCase() === 'dead'),
    falling: animationGroups.find((ag) => ag.name.toLowerCase() === 'falling'),
    hit: animationGroups.find((ag) => ag.name.toLowerCase() === 'hit'),
    land: animationGroups.find((ag) => ag.name.toLowerCase() === 'land'),
    walk: animationGroups.find((ag) => ag.name.toLowerCase() === 'walk'),
    flying_kick: animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'flying_kick',
    ),
    stumble_back: animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'stumble_back',
    ),
    idle_assault_rifle: animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'idle_assault_rifle',
    ),
    run_assault_rifle: animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'run_assault_rifle',
    ),
    aim_assault_rifle: animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'aim_assault_rifle',
    ),
    shoot_assault_rifle: animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'assault_rifle',
    ),
    reload: animationGroups.find((ag) => ag.name.toLowerCase() === 'reload'),
  });

  if (Object.keys(animationRegistry).length === 0) {
    console.error('Player animation registry is empty.');
  }

  physicsCapsule.animationModels = animationRegistry;

  const capsuleAggregate = new PhysicsAggregate(
    physicsCapsule,
    PhysicsShapeType.CAPSULE,
    {
      mass: 1,
      restitution: 0,
      friction: 0.5,
    },
    scene,
  );

  // Lock all angular axes so Havok contact resolution can't tip the capsule.
  // Visual facing direction is driven by PlayerPresentationSystem, with aim yaw snapping to camera forward.
  capsuleAggregate.body.setMassProperties({
    mass: 1,
    inertia: new Vector3(0, 0, 0),
  });

  if (capsuleAggregate.shape) {
    capsuleAggregate.shape.filterMembershipMask = COL_PLAYER;
    capsuleAggregate.shape.filterCollideMask = COL_ENVIRONMENT | COL_ENEMY;
  }

  const shoulderAnchor = new TransformNode('shoulderAnchor', scene);
  // Keep the OTS pivot on the same visual root that receives yaw updates.
  shoulderAnchor.parent = rootMesh;
  shoulderAnchor.position = new Vector3(0.5, 1.5 - rootMesh.position.y, 0);

  return {
    playerAnimations: animationRegistry,
    playerMesh: physicsCapsule,
    shoulderAnchor,
  };
}

export function bootstrapPlayerEcsRuntime(options: {
  camera: ArcRotateCamera;
  enemyUi?: EnemyUiApi | null;
  engine: Engine;
  playerAnimations: PlayerAnimationRegistry;
  playerMesh: RuntimePlayerMesh;
  scene: Scene;
  shoulderAnchor: TransformNode;
}): PlayerEcsBootstrap {
  const cameraShaker = new CameraShaker(options.camera, options.scene);

  HudManager.init(DEFAULT_PLAYER_GAMEPLAY_CONFIG.maxHealth, 'NONE');

  const weaponSystem = new WeaponSystem(
    {
      mesh: options.playerMesh,
      body: options.playerMesh.physicsBody,
      targetRotation: Quaternion.Identity(),
    },
    options.scene,
    {
      damage: 1,
      attackDuration: 0.15,
      attackCooldown: 0,
      debug: true,
      cameraShaker,
      hitboxOffset: 1.8,
    },
  );

  const ecsRuntime = bootstrapGameEcs({
    scene: options.scene,
    engine: options.engine,
    enemyUi: options.enemyUi ?? null,
    reloadGame: () => location.reload(),
    playerMesh: options.playerMesh,
    camera: options.camera,
    cameraShaker,
    playerAnimations: options.playerAnimations,
    weaponSystem,
    spawnPoint: options.playerMesh.position.clone(),
    ragdollSkeleton: options.playerMesh.skeleton ?? null,
    ragdollArmatureNode: options.playerMesh.armatureNode ?? null,
    shoulderAnchor: options.shoulderAnchor,
    gameplayConfig: {
      moveSpeed: 8,
      jumpForce: 12,
    },
  });

  if (!ecsRuntime.playerEntityId) {
    throw new Error('Failed to create player ECS entity.');
  }

  const playerDebugApi = createPlayerDebugApi(
    ecsRuntime.world,
    ecsRuntime.playerEntityId,
  );

  return {
    cameraShaker,
    ecsRuntime,
    playerDebugApi,
  };
}
