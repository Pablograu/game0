import {
  type AbstractMesh,
  type AnimationGroup,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  type Scene,
  type Skeleton,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading';
import type { World } from '../core/World.ts';
import { createEnemyEntity } from './createEnemyEntity.ts';
import { EnemyRuntimeFacade } from './EnemyRuntimeFacade.ts';

export interface EnemyConfig {
  attackCooldown?: number;
  attackRange?: number;
  chaseGiveUpRange?: number;
  chaseSpeed?: number;
  contactDamage?: number;
  debug?: boolean;
  displayName?: string;
  hp?: number;
  knockbackForce?: number;
  mass?: number;
  modelOffsetY?: number;
  modelScale?: number;
  patrolSpeed?: number;
  stunDuration?: number;
  uiBaseScale?: number;
  uiDamageRevealDuration?: number;
  uiLinkOffsetY?: number;
  uiMaxVisibleDistance?: number;
  visionRange?: number;
}

export const DEFAULT_ENEMY_CONFIG: Required<EnemyConfig> = {
  attackCooldown: 1.5,
  attackRange: 2,
  chaseGiveUpRange: 14,
  chaseSpeed: 5,
  contactDamage: 1,
  debug: false,
  displayName: 'Enemy',
  hp: 3,
  knockbackForce: 15,
  mass: 2,
  modelOffsetY: -1.25,
  modelScale: 1.6,
  patrolSpeed: 2,
  stunDuration: 0.5,
  uiBaseScale: 1,
  uiDamageRevealDuration: 1.75,
  uiLinkOffsetY: -120,
  uiMaxVisibleDistance: 16,
  visionRange: 8,
};

export function resolveEnemyConfig(
  config: EnemyConfig = {},
): Required<EnemyConfig> {
  return {
    ...DEFAULT_ENEMY_CONFIG,
    ...config,
  };
}

export class EnemySpawner {
  private static containers: Map<
    string,
    Awaited<ReturnType<typeof LoadAssetContainerAsync>>
  > = new Map();

  static async preload(path: string, scene: Scene): Promise<void> {
    if (this.containers.has(path)) {
      return;
    }

    console.log(`[EnemySpawner] Precargando: ${path}`);
    const container = await LoadAssetContainerAsync(path, scene);
    this.containers.set(path, container);

    console.log(
      `[EnemySpawner] Container listo: ${container.meshes.length} meshes, ` +
        `${container.animationGroups.length} animation groups ` +
        `(${container.animationGroups.map((ag: AnimationGroup) => ag.name).join(', ')})`,
    );
  }

  static spawn(
    world: World,
    path: string,
    scene: Scene,
    position: Vector3,
    config: EnemyConfig = {},
  ): EnemyRuntimeFacade {
    const container = this.containers.get(path);
    if (!container) {
      throw new Error(
        `[EnemySpawner] Container para '${path}' no precargado. Llama a EnemySpawner.preload() primero.`,
      );
    }

    const resolvedConfig = resolveEnemyConfig(config);
    const originalAnimNames = container.animationGroups.map(
      (ag: AnimationGroup) => ag.name,
    );
    const instance = container.instantiateModelsToScene(
      (name: string) =>
        `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      false,
    );

    for (let i = 0; i < instance.animationGroups.length; i += 1) {
      if (i < originalAnimNames.length) {
        instance.animationGroups[i].name = originalAnimNames[i];
      }
    }

    const root = instance.rootNodes[0] as TransformNode;
    root.position = position.clone();

    const meshes: AbstractMesh[] = [];
    root.getChildMeshes(false).forEach((mesh: AbstractMesh) => {
      meshes.push(mesh);
    });

    const animGroups: AnimationGroup[] = instance.animationGroups;

    console.log(
      `[EnemySpawner] Spawned en (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}) — ` +
        `${meshes.length} meshes, ${animGroups.length} anims: [${animGroups.map((ag) => ag.name).join(', ')}]`,
    );

    const physicsCapsule = this.createPhysicsCapsule(
      scene,
      root.position,
      resolvedConfig.mass,
    );

    root.parent = physicsCapsule;
    root.position = new Vector3(0, resolvedConfig.modelOffsetY, 0);

    root.scaling = new Vector3(1, 1, 1);

    physicsCapsule.metadata = { type: 'enemy' };
    for (const mesh of meshes) {
      mesh.metadata = { type: 'enemy' };
    }

    const skeleton = instance.skeletons?.[0] ?? null;
    const armatureNode =
      root
        .getChildTransformNodes(false)
        .find((node) => node.id.includes('Clone of ladron')) ?? null;

    root.scaling = new Vector3(1, 1, 1);
    if (armatureNode) {
      armatureNode.scaling = new Vector3(0.017, 0.017, 0.017);
    }

    const entityId = createEnemyEntity({
      world,
      scene,
      modelPath: path,
      debugLabel: root.name,
      config: resolvedConfig,
      root,
      meshes,
      mesh: physicsCapsule,
      physicsAggregate: physicsCapsule.metadata
        ?.physicsAggregate as PhysicsAggregate | null,
      animationGroups: animGroups,
      skeleton,
      armatureNode,
    });

    return new EnemyRuntimeFacade(world, entityId);
  }

  static spawnMultiple(
    world: World,
    path: string,
    scene: Scene,
    positions: Vector3[],
    config: EnemyConfig = {},
  ): EnemyRuntimeFacade[] {
    return positions.map((position) =>
      this.spawn(world, path, scene, position, config),
    );
  }

  static disposeContainer(path: string) {
    const container = this.containers.get(path);
    if (!container) {
      return;
    }

    container.dispose();
    this.containers.delete(path);
  }

  static disposeAll() {
    for (const container of this.containers.values()) {
      container.dispose();
    }

    this.containers.clear();
  }

  private static createPhysicsCapsule(
    scene: Scene,
    position: Vector3,
    mass: number,
  ) {
    const capsule = MeshBuilder.CreateCapsule(
      'enemyCapsule',
      { height: 2.5, radius: 0.5 },
      scene,
    );

    capsule.isVisible = false;
    capsule.position = position.clone();
    capsule.checkCollisions = true;

    const aggregate = new PhysicsAggregate(
      capsule,
      PhysicsShapeType.CAPSULE,
      {
        mass,
        restitution: 0.1,
        friction: 0.8,
      },
      scene,
    ) as PhysicsAggregate;

    capsule.physicsBody!.setMassProperties({
      mass,
      inertia: new Vector3(0, 0, 0),
    });

    if (aggregate.shape) {
      aggregate.shape.filterMembershipMask = 0x0008;
      aggregate.shape.filterCollideMask = 0x0001;
    }

    capsule.metadata = {
      ...(capsule.metadata ?? {}),
      physicsAggregate: aggregate,
    };

    return capsule;
  }
}
