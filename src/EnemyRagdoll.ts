import {
  Skeleton,
  TransformNode,
  Vector3,
  Axis,
  Ragdoll,
  RagdollBoneProperties,
} from '@babylonjs/core';
import { PhysicsConstraintType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';

type InternalRagdollBoneConfig = RagdollBoneProperties & {
  bone?: string;
  bones?: string[];
  mass?: number;
  restitution?: number;
  putBoxInBoneCenter?: boolean;
};

const DEFAULT_BONE_MASS = 0.12;
const DEFAULT_BONE_RESTITUTION = 0.0;
const DEFAULT_LINEAR_DAMPING = 0.9;
const DEFAULT_ANGULAR_DAMPING = 0.98;

const LADRON_RAGDOLL_CONFIG: InternalRagdollBoneConfig[] = [
  {
    bone: 'mixamorig7:Hips',
    width: 0.18,
    height: 0.16,
    depth: 0.14,
    boneOffsetAxis: Axis.Y,
    putBoxInBoneCenter: true,
    joint: PhysicsConstraintType.BALL_AND_SOCKET,
  },
  {
    bone: 'mixamorig7:Spine2',
    width: 0.16,
    height: 0.18,
    depth: 0.12,
    boneOffsetAxis: Axis.Y,
    putBoxInBoneCenter: true,
    joint: PhysicsConstraintType.HINGE,
    rotationAxis: Axis.Z,
    min: -0.45,
    max: 0.45,
  },
  {
    bone: 'mixamorig7:Head',
    width: 0.14,
    height: 0.14,
    depth: 0.14,
    boxOffset: 0.03,
    boneOffsetAxis: Axis.Y,
    joint: PhysicsConstraintType.BALL_AND_SOCKET,
  },
  {
    bones: ['mixamorig7:LeftUpLeg', 'mixamorig7:RightUpLeg'],
    depth: 0.1,
    height: 0.22,
    width: 0.1,
    joint: PhysicsConstraintType.HINGE,
    rotationAxis: Axis.Y,
    min: -1.0,
    max: 0.7,
    boneOffsetAxis: Axis.Y,
    putBoxInBoneCenter: true,
  },
  {
    bones: ['mixamorig7:LeftLeg', 'mixamorig7:RightLeg'],
    depth: 0.09,
    height: 0.2,
    width: 0.09,
    joint: PhysicsConstraintType.HINGE,
    rotationAxis: Axis.Y,
    min: -1.2,
    max: 0.15,
    boneOffsetAxis: Axis.Y,
    putBoxInBoneCenter: true,
  },
];

export class EnemyRagdoll {
  private ragdoll: Ragdoll | null = null;
  private active: boolean = false;
  private ready: boolean = false;
  private config: InternalRagdollBoneConfig[] = [];
  private aggregateCount: number = 0;

  constructor(
    private readonly skeleton: Skeleton,
    private readonly root: TransformNode,
    private readonly enemyLabel: string,
  ) {
    this._prepareConfig();
  }

  static create(
    skeleton: Skeleton | null | undefined,
    root: TransformNode | null | undefined,
    enemyLabel: string,
  ): EnemyRagdoll | null {
    if (!skeleton || !root) {
      return null;
    }
    console.log('<<<', { root, skeleton, config: LADRON_RAGDOLL_CONFIG });

    const ragdoll = new EnemyRagdoll(skeleton, root, enemyLabel);
    if (!ragdoll.isReady()) {
      ragdoll.dispose();
      return null;
    }

    return ragdoll;
  }

  isReady(): boolean {
    return this.ready;
  }

  isActive(): boolean {
    return this.active;
  }

  activate(impactVelocity?: Vector3): boolean {
    if (!this.ready || this.active) {
      return false;
    }

    if (!this.ragdoll && !this._createRuntimeRagdoll()) {
      return false;
    }

    if (!this.ragdoll) {
      return false;
    }

    this.ragdoll.ragdoll();
    this.active = true;
    this._applyBodyDamping();

    const rootAggregate = this.ragdoll.getAggregate(-1);
    if (rootAggregate?.body) {
      const impulse = this._computeDeathImpulse(impactVelocity);
      rootAggregate.body.applyImpulse(
        impulse,
        rootAggregate.transformNode.getAbsolutePosition(),
      );
    }

    return true;
  }

  dispose() {
    if (this.ragdoll) {
      this.ragdoll.dispose();
      this.ragdoll = null;
    }
    this.ready = false;
    this.active = false;
  }

  private _prepareConfig() {
    this.config = this._buildConfigForSkeleton();
    this.aggregateCount = this._countAggregates(this.config);
    if (this.config.length < 2) {
      console.warn(
        `[EnemyRagdoll] Not enough bones for ragdoll on ${this.enemyLabel}. Falling back to capsule collapse.`,
      );
      this.ready = false;
      return;
    }

    this.ready = true;
  }

  private _createRuntimeRagdoll(): boolean {
    if (!this.ready) {
      return false;
    }

    try {
      this.ragdoll = new Ragdoll(
        this.skeleton,
        this.root,
        this.config as unknown as RagdollBoneProperties[],
      );

      const rootAggregate = this.ragdoll.getAggregate(-1);
      if (!rootAggregate?.body) {
        console.warn(
          `[EnemyRagdoll] Root aggregate missing for ${this.enemyLabel}. Falling back to capsule collapse.`,
        );
        this.ragdoll.dispose();
        this.ragdoll = null;
        return false;
      }

      return true;
    } catch (error) {
      console.warn(
        `[EnemyRagdoll] Failed to initialize on ${this.enemyLabel}. Falling back to capsule collapse.`,
        error,
      );
      this.ragdoll = null;
      return false;
    }
  }

  private _buildConfigForSkeleton(): InternalRagdollBoneConfig[] {
    const availableBones = new Set(
      this.skeleton.bones.map((bone) => bone.name),
    );
    const filtered: InternalRagdollBoneConfig[] = [];

    for (const entry of LADRON_RAGDOLL_CONFIG) {
      if (entry.bone) {
        if (availableBones.has(entry.bone)) {
          filtered.push(this._withStabilityDefaults({ ...entry }));
        }
        continue;
      }

      if (entry.bones && entry.bones.length > 0) {
        const matchedBones = entry.bones.filter((name) =>
          availableBones.has(name),
        );
        if (matchedBones.length > 0) {
          filtered.push(
            this._withStabilityDefaults({ ...entry, bones: matchedBones }),
          );
        }
      }
    }

    const rootBone = this.skeleton.getChildren()[0];
    if (!rootBone) {
      console.warn(
        `[EnemyRagdoll] Skeleton has no root bone on ${this.enemyLabel}.`,
      );
      return [];
    }

    const hasRoot = this._configContainsBone(filtered, rootBone.name);
    if (!hasRoot && availableBones.has(rootBone.name)) {
      filtered.unshift(
        this._withStabilityDefaults({
          bone: rootBone.name,
          size: 0.17,
          boxOffset: 0.01,
          boneOffsetAxis: new Vector3(0, 1, 0),
          rotationAxis: new Vector3(0, 0, 1),
          min: -0.8,
          max: 0.8,
        }),
      );
    }

    return filtered;
  }

  private _withStabilityDefaults(
    entry: InternalRagdollBoneConfig,
  ): InternalRagdollBoneConfig {
    return {
      mass: DEFAULT_BONE_MASS,
      restitution: DEFAULT_BONE_RESTITUTION,
      ...entry,
    };
  }

  private _countAggregates(config: InternalRagdollBoneConfig[]): number {
    let count = 0;
    for (const entry of config) {
      if (entry.bone) {
        count += 1;
      } else if (entry.bones && entry.bones.length > 0) {
        count += entry.bones.length;
      }
    }
    return count;
  }

  private _configContainsBone(
    config: InternalRagdollBoneConfig[],
    boneName: string,
  ): boolean {
    for (const entry of config) {
      if (entry.bone === boneName) {
        return true;
      }
      if (entry.bones?.includes(boneName)) {
        return true;
      }
    }
    return false;
  }

  private _computeDeathImpulse(impactVelocity?: Vector3): Vector3 {
    const impulse = new Vector3(0, 0.2, 0);

    if (!impactVelocity || impactVelocity.lengthSquared() < 0.0001) {
      return impulse;
    }

    const horizontal = new Vector3(impactVelocity.x, 0, impactVelocity.z);
    if (horizontal.lengthSquared() > 0.0001) {
      horizontal.normalize();
      impulse.x = horizontal.x * 0.18;
      impulse.z = horizontal.z * 0.18;
    }

    impulse.y = 0.2 + Math.min(0.08, Math.abs(impactVelocity.y) * 0.01);
    return impulse;
  }

  private _applyBodyDamping() {
    if (!this.ragdoll) {
      return;
    }

    for (let i = 0; i < this.aggregateCount; i++) {
      const aggregate = this.ragdoll.getAggregate(i);
      if (!aggregate?.body) {
        continue;
      }

      aggregate.body.setLinearDamping(DEFAULT_LINEAR_DAMPING);
      aggregate.body.setAngularDamping(DEFAULT_ANGULAR_DAMPING);
      aggregate.body.setLinearVelocity(Vector3.Zero());
      aggregate.body.setAngularVelocity(Vector3.Zero());
    }
  }
}
