import {
  Vector3,
  Scene,
  Mesh,
  MeshBuilder,
  TransformNode,
  PhysicsAggregate,
  PhysicsShapeType,
  BallAndSocketConstraint,
  Skeleton,
  Bone,
  AbstractMesh,
  StandardMaterial,
  Color3,
  Space,
} from '@babylonjs/core';

// ===== COLLISION GROUPS =====
export const COLLISION_GROUP = {
  ENVIRONMENT: 0x0001,
  PLAYER: 0x0002,
  ENEMY_ALIVE: 0x0004,
  RAGDOLL: 0x0008,
};

// ===== BONE CONFIG =====
interface BoneBodyConfig {
  boneName: string;
  parentBoneName: string | null;
  shapeType: 'box' | 'capsule' | 'sphere';
  size: Vector3; // box: half-extents, capsule: (radius, halfHeight, 0), sphere: (radius, 0, 0)
  mass: number;
}

// ===== RUNTIME BODY ENTRY =====
interface RagdollBodyEntry {
  bone: Bone;
  mesh: Mesh;
  aggregate: PhysicsAggregate;
  constraint: BallAndSocketConstraint | null;
}

/**
 * RagdollSystem — Per-bone physics ragdoll.
 *
 * Bodies are created lazily in enable() using bone.getAbsolutePosition(skinnedMesh)
 * so that world positions are always correct regardless of the parent chain.
 * Each frame during simulation, physics body transforms are written back to
 * the skeleton bones via bone.setAbsolutePosition / setRotationQuaternion.
 */
export class RagdollSystem {
  private _scene: Scene;
  private _rootTransform: TransformNode;
  private _skeleton: Skeleton | null = null;
  private _skinnedMesh: AbstractMesh | null = null;
  private _modelScale: number;
  private _debug: boolean;
  private _active: boolean = false;
  private _disposed: boolean = false;

  private _bodies: Map<string, RagdollBodyEntry> = new Map();
  private _syncObserver: any = null;

  // 7-bone ragdoll: hips, spine, head, 2 arms, 2 legs
  private static readonly BONE_CONFIGS: BoneBodyConfig[] = [
    { boneName: 'mixamorig7:Hips', parentBoneName: null, shapeType: 'box', size: new Vector3(0.15, 0.1, 0.1), mass: 4 },
    { boneName: 'mixamorig7:Spine', parentBoneName: 'mixamorig7:Hips', shapeType: 'box', size: new Vector3(0.15, 0.15, 0.1), mass: 3 },
    { boneName: 'mixamorig7:Head', parentBoneName: 'mixamorig7:Spine', shapeType: 'sphere', size: new Vector3(0.12, 0, 0), mass: 1.5 },
    { boneName: 'mixamorig7:LeftArm', parentBoneName: 'mixamorig7:Spine', shapeType: 'capsule', size: new Vector3(0.05, 0.3, 0), mass: 1 },
    { boneName: 'mixamorig7:RightArm', parentBoneName: 'mixamorig7:Spine', shapeType: 'capsule', size: new Vector3(0.05, 0.3, 0), mass: 1 },
    { boneName: 'mixamorig7:LeftUpLeg', parentBoneName: 'mixamorig7:Hips', shapeType: 'capsule', size: new Vector3(0.06, 0.35, 0), mass: 2 },
    { boneName: 'mixamorig7:RightUpLeg', parentBoneName: 'mixamorig7:Hips', shapeType: 'capsule', size: new Vector3(0.06, 0.35, 0), mass: 2 },
  ];

  constructor(
    rootTransform: TransformNode,
    scene: Scene,
    config: { modelScale?: number; debug?: boolean } = {},
  ) {
    this._scene = scene;
    this._rootTransform = rootTransform;
    this._modelScale = config.modelScale ?? 1.6;
    this._debug = config.debug ?? false;
  }

  // ==========================================================
  //  INIT: Just store refs. Bodies are created lazily in enable()
  // ==========================================================
  init(skeleton: Skeleton, skinnedMesh: AbstractMesh) {
    this._skeleton = skeleton;
    this._skinnedMesh = skinnedMesh;
    console.log('[RagdollSystem] Initialized (multi-body deferred mode)', { skeleton, skinnedMesh });
  }

  // ==========================================================
  //  ENABLE: Compute correct bone positions → create bodies →
  //          unparent root → start sync loop
  // ==========================================================
  enable(
    knockbackVelocity: Vector3 = Vector3.Zero(),
    deathWorldPos: Vector3,
    modelOffsetY: number,
  ) {
    if (this._active || this._disposed || !this._skeleton || !this._skinnedMesh) return;
    this._active = true;

    const skeleton = this._skeleton;
    const skinnedMesh = this._skinnedMesh;
    const scale = this._modelScale;

    // 1. Ensure matrices are current (root still parented to capsule mesh)
    skinnedMesh.computeWorldMatrix(true);
    skeleton.computeAbsoluteMatrices();

    // 2. Create physics bodies at correct bone WORLD positions
    for (const config of RagdollSystem.BONE_CONFIGS) {
      const bone = skeleton.bones.find((b) => b.name === config.boneName);
      if (!bone) {
        console.warn(`[RagdollSystem] Bone '${config.boneName}' not found`);
        continue;
      }

      // This correctly accounts for the full parent chain + mesh world matrix
      const worldPos = bone.getAbsolutePosition(skinnedMesh);

      const mesh = this._createShapeMesh(config, scale);
      mesh.position.copyFrom(worldPos);

      const shapeType =
        config.shapeType === 'sphere'
          ? PhysicsShapeType.SPHERE
          : config.shapeType === 'capsule'
            ? PhysicsShapeType.CAPSULE
            : PhysicsShapeType.BOX;

      const aggregate = new PhysicsAggregate(
        mesh,
        shapeType,
        { mass: config.mass, restitution: 0.05, friction: 0.8 },
        this._scene,
      );

      const body = aggregate.body;
      body.disablePreStep = false;
      body.setMassProperties({
        mass: config.mass,
        inertia: new Vector3(0.05, 0.05, 0.05),
      });
      body.setLinearDamping(0.5);
      body.setAngularDamping(3.0);

      if (aggregate.shape) {
        aggregate.shape.filterMembershipMask = COLLISION_GROUP.RAGDOLL;
        aggregate.shape.filterCollideMask = COLLISION_GROUP.ENVIRONMENT;
      }

      this._bodies.set(config.boneName, {
        bone,
        mesh,
        aggregate,
        constraint: null,
      });
    }

    // 3. Create ball-and-socket constraints
    this._createConstraints(skinnedMesh);

    // 4. Unparent root from capsule and reposition in world space
    this._rootTransform.parent = null;
    this._rootTransform.position.copyFrom(
      deathWorldPos.add(new Vector3(0, modelOffsetY, 0)),
    );
    this._rootTransform.computeWorldMatrix(true);
    skinnedMesh.computeWorldMatrix(true);

    // 5. Apply knockback impulse to hips
    const hipsEntry = this._bodies.get('mixamorig7:Hips');
    if (hipsEntry && knockbackVelocity.length() > 0.1) {
      const impulse = knockbackVelocity.scale(1.5);
      impulse.y = Math.max(impulse.y, 3);
      hipsEntry.aggregate.body.applyImpulse(impulse, hipsEntry.mesh.position);
    }

    // 6. Start sync: physics bodies → skeleton bones each frame
    this._syncObserver = this._scene.onBeforeRenderObservable.add(() => {
      this._syncPhysicsToSkeleton();
    });

    console.log(
      `[RagdollSystem] Ragdoll ENABLED with ${this._bodies.size} bodies at (${deathWorldPos.x.toFixed(1)}, ${deathWorldPos.y.toFixed(1)}, ${deathWorldPos.z.toFixed(1)})`,
    );
  }

  // ==========================================================
  //  Create a visual/physics mesh for a bone body
  // ==========================================================
  private _createShapeMesh(config: BoneBodyConfig, scale: number): Mesh {
    const meshName = `ragdoll_${config.boneName}`;
    let mesh: Mesh;

    switch (config.shapeType) {
      case 'sphere':
        mesh = MeshBuilder.CreateSphere(
          meshName,
          { diameter: config.size.x * 2 * scale },
          this._scene,
        );
        break;
      case 'capsule':
        mesh = MeshBuilder.CreateCapsule(
          meshName,
          { radius: config.size.x * scale, height: config.size.y * 2 * scale },
          this._scene,
        );
        break;
      case 'box':
      default:
        mesh = MeshBuilder.CreateBox(
          meshName,
          {
            width: config.size.x * 2 * scale,
            height: config.size.y * 2 * scale,
            depth: config.size.z * 2 * scale,
          },
          this._scene,
        );
        break;
    }

    mesh.isVisible = this._debug;
    mesh.isPickable = false;
    mesh.checkCollisions = false;

    if (this._debug) {
      const mat = new StandardMaterial(
        `ragdollMat_${config.boneName}`,
        this._scene,
      );
      mat.diffuseColor = new Color3(1, 0.2, 0.2);
      mat.alpha = 0.4;
      mesh.material = mat;
    }

    return mesh;
  }

  // ==========================================================
  //  Create constraints between parent/child bone bodies.
  //  Joint pivot = child bone world position.
  // ==========================================================
  private _createConstraints(skinnedMesh: AbstractMesh) {
    for (const config of RagdollSystem.BONE_CONFIGS) {
      if (!config.parentBoneName) continue;

      const childEntry = this._bodies.get(config.boneName);
      const parentEntry = this._bodies.get(config.parentBoneName);
      if (!childEntry || !parentEntry) continue;

      // Joint in world space = child bone position
      const jointWorldPos = childEntry.bone.getAbsolutePosition(skinnedMesh);

      // Convert to each body's local space
      const parentPivot = jointWorldPos.subtract(parentEntry.mesh.position);
      const childPivot = Vector3.Zero(); // Body is centered at bone

      const constraint = new BallAndSocketConstraint(
        parentPivot,
        childPivot,
        new Vector3(0, 1, 0),
        new Vector3(0, 1, 0),
        this._scene,
      );

      parentEntry.aggregate.body.addConstraint(
        childEntry.aggregate.body,
        constraint,
      );
      childEntry.constraint = constraint;
    }
  }

  // ==========================================================
  //  SYNC: Write physics body transforms → skeleton bones
  //  Runs every frame while ragdoll is active.
  // ==========================================================
  private _syncPhysicsToSkeleton() {
    if (!this._active || !this._skinnedMesh || !this._skeleton) return;

    const skinnedMesh = this._skinnedMesh;

    for (const entry of this._bodies.values()) {
      // Position: set bone world position from physics body
      const bodyWorldPos = entry.mesh.getAbsolutePosition();
      entry.bone.setAbsolutePosition(bodyWorldPos, skinnedMesh);

      // Rotation: set bone world rotation from physics body
      if (entry.mesh.rotationQuaternion) {
        entry.bone.setRotationQuaternion(
          entry.mesh.rotationQuaternion.clone(),
          Space.WORLD,
          skinnedMesh,
        );
      }
    }
  }

  // ==========================================================
  //  STATE QUERIES
  // ==========================================================
  isActive(): boolean {
    return this._active;
  }

  isDisposed(): boolean {
    return this._disposed;
  }

  // ==========================================================
  //  DISPOSE
  // ==========================================================
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._active = false;

    if (this._syncObserver) {
      this._scene.onBeforeRenderObservable.remove(this._syncObserver);
      this._syncObserver = null;
    }

    for (const entry of this._bodies.values()) {
      if (entry.constraint) entry.constraint.dispose();
      entry.aggregate.dispose();
      entry.mesh.dispose();
    }

    this._bodies.clear();
    this._skeleton = null;
    this._skinnedMesh = null;

    console.log('[RagdollSystem] Disposed');
  }
}