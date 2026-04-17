import {
  Axis,
  Logger,
  Matrix,
  Physics6DoFConstraint,
  PhysicsAggregate,
  PhysicsConstraintAxis,
  PhysicsMotionType,
  PhysicsShapeType,
  Quaternion,
  Space,
  TransformNode,
  Vector3,
} from '@babylonjs/core';

const DEFAULT_LINEAR_DAMPING = 0.05;
const DEFAULT_ANGULAR_DAMPING = 0.25;
const MIN_AXIS_EPSILON = 1e-6;

function cloneVector3(value) {
  return value?.clone?.() ?? new Vector3(value.x, value.y, value.z);
}

function cloneQuaternion(value) {
  return value?.clone?.() ?? Quaternion.Identity();
}

function ensureRotationQuaternion(node) {
  if (!node.rotationQuaternion) {
    node.rotationQuaternion = Quaternion.FromEulerAngles(
      node.rotation.x,
      node.rotation.y,
      node.rotation.z,
    );
  }

  return node.rotationQuaternion;
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function createPerpendicularAxis(axis) {
  const normalizedAxis = cloneVector3(axis).normalize();
  const referenceAxis =
    Math.abs(Vector3.Dot(normalizedAxis, Axis.Y)) > 0.95 ? Axis.Z : Axis.Y;

  let perpendicularAxis = Vector3.Cross(normalizedAxis, referenceAxis);
  if (perpendicularAxis.lengthSquared() <= MIN_AXIS_EPSILON) {
    perpendicularAxis = Vector3.Cross(normalizedAxis, Axis.X);
  }

  return perpendicularAxis.normalize();
}

/**
 * Ragdoll bone properties
 * @experimental
 */
export class RagdollBoneProperties {}

/**
 * Ragdoll for Physics V2
 * @experimental
 */
export class Ragdoll {
  constructor(
    skeleton,
    rootTransformNode,
    config,
    jointCollisions = false,
    showBoxes = false,
    mainPivotSphereSize = 0,
    disableBoxBoneSync = false,
  ) {
    this._skeleton = skeleton;
    this._scene = skeleton.getScene();
    this._rootTransformNode = rootTransformNode;
    this._initialRootPosition = rootTransformNode.position.clone();
    this._initialRootRotation = cloneQuaternion(
      ensureRotationQuaternion(rootTransformNode),
    );
    this._config = config;
    this._boxConfigs = [];
    this._constraints = [];
    this._bones = [];
    this._initialRotation = [];
    this._boneNames = [];
    this._linkedTransformNodes = [];
    this._transforms = [];
    this._aggregates = [];
    this._beforeRenderObserver = null;
    this._initialized = false;
    this._ragdollMode = false;

    this.pauseSync = false;
    this.showBoxes = showBoxes;
    this.boxVisibility = 0.6;
    this.mainPivotSphereSize = mainPivotSphereSize;
    this.disableBoxBoneSync = disableBoxBoneSync;
    this.jointCollisions = jointCollisions;
    this.rootBoneName = '';
    this.rootBoneIndex = -1;
    this.mass = 1;
    this.restitution = 0;
    this.linearDamping = DEFAULT_LINEAR_DAMPING;
    this.angularDamping = DEFAULT_ANGULAR_DAMPING;
    this.putBoxesInBoneCenter = false;
    this.defaultJointMin = -90;
    this.defaultJointMax = 90;
    this.boneOffsetAxis = Axis.Y;
  }

  get ragdollMode() {
    return this._ragdollMode;
  }

  getConstraints() {
    return this._constraints;
  }

  getTransformNode() {
    return this._rootTransformNode;
  }

  getAggregates() {
    return this._aggregates;
  }

  getAggregate(index) {
    if (index < 0 || index >= this._aggregates.length) {
      return this._aggregates[this.rootBoneIndex] ?? null;
    }

    return this._aggregates[index];
  }

  getClosestAggregate(point) {
    if (!point || this._aggregates.length === 0) {
      return this.getAggregate(-1);
    }

    let closestIndex = -1;
    let closestDistanceSquared = Number.POSITIVE_INFINITY;

    for (let i = 0; i < this._transforms.length; i++) {
      const distanceSquared = Vector3.DistanceSquared(
        this._transforms[i].position,
        point,
      );

      if (distanceSquared < closestDistanceSquared) {
        closestDistanceSquared = distanceSquared;
        closestIndex = i;
      }
    }

    return this.getAggregate(closestIndex);
  }

  init() {
    if (this._initialized) {
      return;
    }

    this._createColliders();

    if (!this._defineRootBone()) {
      return;
    }

    this._initJoints();
    this._beforeRenderObserver = this._scene.onBeforeRenderObservable.add(
      () => {
        this._syncBonesAndBoxes();
      },
    );

    if (!this.disableBoxBoneSync) {
      this._syncTransformsToBones();
    }

    this._initialized = true;
  }

  _createColliders() {
    this._rootTransformNode.computeWorldMatrix(true);
    this._skeleton.computeAbsoluteMatrices(true);
    this._skeleton.prepare(true);

    for (let i = 0; i < this._config.length; i++) {
      const boneNames =
        this._config[i].bone !== undefined
          ? [this._config[i].bone]
          : this._config[i].bones;

      for (const boneName of boneNames) {
        const currentBone =
          this._skeleton.bones[this._skeleton.getBoneIndexByName(boneName)];

        if (!currentBone) {
          Logger.Warn(`Bone ${boneName} does not exist.`);
          continue;
        }

        const currentBoxProps = {
          width: this._config[i].width ?? this._config[i].size,
          depth: this._config[i].depth ?? this._config[i].size,
          height: this._config[i].height ?? this._config[i].size,
          size: this._config[i].size,
          rotationAxis: cloneVector3(this._config[i].rotationAxis ?? Axis.X),
        };

        currentBoxProps.min = this._config[i].min ?? this.defaultJointMin;
        currentBoxProps.max = this._config[i].max ?? this.defaultJointMax;

        let boxOffset = 0;
        if (
          (this._config[i].putBoxInBoneCenter ?? false) ||
          this.putBoxesInBoneCenter
        ) {
          if (currentBone.length === undefined) {
            Logger.Warn(
              `The length property is not defined for bone ${currentBone.name}.`,
            );
          }

          boxOffset = (currentBone.length ?? 0) / 2;
        } else if (this._config[i].boxOffset !== undefined) {
          boxOffset = this._config[i].boxOffset;
        }

        currentBoxProps.boxOffset = boxOffset;
        currentBoxProps.boneOffsetAxis = cloneVector3(
          this._config[i].boneOffsetAxis ?? this.boneOffsetAxis,
        );

        const transform = new TransformNode(
          `${currentBone.name}_ragdoll`,
          this._scene,
        );
        transform.rotationQuaternion = Quaternion.Identity();

        const boneDirection = currentBone.getDirection(
          currentBoxProps.boneOffsetAxis,
          this._rootTransformNode,
        );
        transform.position.copyFrom(
          currentBone
            .getAbsolutePosition(this._rootTransformNode)
            .add(boneDirection.scale(boxOffset)),
        );

        const aggregate = new PhysicsAggregate(
          transform,
          PhysicsShapeType.BOX,
          {
            mass: this._config[i].mass ?? this.mass,
            restitution: this._config[i].restitution ?? this.restitution,
            friction: this._config[i].friction ?? 0.8,
            extents: new Vector3(
              currentBoxProps.width,
              currentBoxProps.height,
              currentBoxProps.depth,
            ),
          },
          this._scene,
        );

        aggregate.body.setCollisionCallbackEnabled(true);
        aggregate.body.disablePreStep = false;
        aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
        aggregate.body.setLinearDamping(
          this._config[i].linearDamping ?? this.linearDamping,
        );
        aggregate.body.setAngularDamping(
          this._config[i].angularDamping ?? this.angularDamping,
        );

        this._bones.push(currentBone);
        this._boneNames.push(currentBone.name);
        this._linkedTransformNodes.push(
          currentBone.getTransformNode?.() ?? null,
        );
        this._transforms.push(transform);
        this._aggregates.push(aggregate);
        this._boxConfigs.push(currentBoxProps);
        this._initialRotation.push(
          cloneQuaternion(
            currentBone.getRotationQuaternion(
              Space.WORLD,
              this._rootTransformNode,
            ),
          ),
        );
      }
    }
  }

  _initJoints() {
    this._rootTransformNode.computeWorldMatrix(true);

    for (let i = 0; i < this._bones.length; i++) {
      if (i === this.rootBoneIndex) {
        continue;
      }

      const nearestParent = this._findNearestParent(i);
      if (!nearestParent) {
        Logger.Warn(
          `Couldn't find a nearest parent bone in the configs for bone ${this._boneNames[i]}.`,
        );
        continue;
      }

      const parentIndex = this._boneNames.indexOf(nearestParent.name);
      if (parentIndex < 0) {
        continue;
      }

      const childBoneAbsPosition = this._bones[i].getAbsolutePosition(
        this._rootTransformNode,
      );
      const parentWorldMatrix =
        this._transforms[parentIndex].computeWorldMatrix(true);
      const invertedParentWorldMatrix = Matrix.Invert(parentWorldMatrix);
      const mainPivot = Vector3.TransformCoordinates(
        childBoneAbsPosition,
        invertedParentWorldMatrix,
      );
      const connectedPivot = childBoneAbsPosition.subtract(
        this._transforms[i].position,
      );

      const primaryAxis = cloneVector3(this._boxConfigs[i].rotationAxis);
      const perpendicularAxis = createPerpendicularAxis(primaryAxis);
      const limits = [
        { axis: PhysicsConstraintAxis.LINEAR_X, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.LINEAR_Y, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.LINEAR_Z, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_Y, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_Z, minLimit: 0, maxLimit: 0 },
      ];

      if (
        Number.isFinite(this._boxConfigs[i].min) &&
        Number.isFinite(this._boxConfigs[i].max)
      ) {
        limits.push({
          axis: PhysicsConstraintAxis.ANGULAR_X,
          minLimit: degreesToRadians(this._boxConfigs[i].min),
          maxLimit: degreesToRadians(this._boxConfigs[i].max),
          damping: this._boxConfigs[i].jointDamping ?? 0.06,
          stiffness: this._boxConfigs[i].jointStiffness ?? 0,
        });
      }

      const constraint = new Physics6DoFConstraint(
        {
          pivotA: mainPivot,
          pivotB: connectedPivot,
          axisA: primaryAxis,
          axisB: primaryAxis,
          perpAxisA: perpendicularAxis,
          perpAxisB: perpendicularAxis,
          collision: this.jointCollisions,
        },
        limits,
        this._scene,
      );

      this._aggregates[parentIndex].body.addConstraint(
        this._aggregates[i].body,
        constraint,
      );
      constraint.isEnabled = false;
      constraint.isCollisionsEnabled = this.jointCollisions;
      constraint.setAxisFriction(
        PhysicsConstraintAxis.ANGULAR_X,
        this._boxConfigs[i].jointFriction ?? 0.04,
      );
      this._constraints.push(constraint);
    }
  }

  _defineRootBone() {
    const skeletonRoots = this._skeleton.getChildren();
    if (skeletonRoots.length !== 1) {
      Logger.Warn(
        'Ragdoll creation failed: there can only be one root in the skeleton.',
      );
      return false;
    }

    this.rootBoneName = skeletonRoots[0].name;
    this.rootBoneIndex = this._boneNames.indexOf(this.rootBoneName);

    if (this.rootBoneIndex === -1) {
      Logger.Warn(
        `Ragdoll creation failed: the config does not include the root bone ${this.rootBoneName}.`,
      );
      return false;
    }

    return true;
  }

  _findNearestParent(boneIndex) {
    let nearestParent = this._bones[boneIndex].getParent();

    while (nearestParent) {
      if (this._boneNames.includes(nearestParent.name)) {
        return nearestParent;
      }

      nearestParent = nearestParent.getParent();
    }

    return null;
  }

  _syncTransformToBone(boneIndex, rotationAdjust = null) {
    const bone = this._bones[boneIndex];
    const transform = this._transforms[boneIndex];
    const body = this._aggregates[boneIndex].body;
    const boxConfig = this._boxConfigs[boneIndex];

    const boneDirection = bone.getDirection(
      boxConfig.boneOffsetAxis,
      this._rootTransformNode,
    );
    transform.position.copyFrom(
      bone
        .getAbsolutePosition(this._rootTransformNode)
        .add(boneDirection.scale(boxConfig.boxOffset ?? 0)),
    );

    const boneRotation = cloneQuaternion(
      bone.getRotationQuaternion(Space.WORLD, this._rootTransformNode),
    );
    const targetRotation = rotationAdjust
      ? boneRotation.multiply(rotationAdjust)
      : boneRotation;

    ensureRotationQuaternion(transform).copyFrom(targetRotation);
    transform.computeWorldMatrix(true);
    body.setLinearVelocity(Vector3.Zero());
    body.setAngularVelocity(Vector3.Zero());
  }

  _syncTransformsToBones() {
    this._rootTransformNode.computeWorldMatrix(true);
    this._skeleton.computeAbsoluteMatrices(true);

    for (let i = 0; i < this._bones.length; i++) {
      this._syncTransformToBone(i);
    }
  }

  _addImpostorRotationToBone(boneIndex) {
    const bodyRotation = cloneQuaternion(
      ensureRotationQuaternion(this._transforms[boneIndex]),
    );
    const newRotation = bodyRotation.multiply(this._initialRotation[boneIndex]);
    this._bones[boneIndex].setRotationQuaternion(
      newRotation,
      Space.WORLD,
      this._rootTransformNode,
    );
  }

  _syncBonesAndBoxes() {
    if (this.pauseSync) {
      return;
    }

    this._rootTransformNode.computeWorldMatrix(true);
    this._skeleton.computeAbsoluteMatrices(true);

    if (this._ragdollMode) {
      const rootBoxConfig = this._boxConfigs[this.rootBoneIndex];
      const rootBone = this._bones[this.rootBoneIndex];
      const rootBoneDirection = rootBone.getDirection(
        rootBoxConfig.boneOffsetAxis,
        this._rootTransformNode,
      );
      const rootBoneOffsetPosition = rootBone
        .getAbsolutePosition(this._rootTransformNode)
        .add(rootBoneDirection.scale(rootBoxConfig.boxOffset ?? 0));

      this._addImpostorRotationToBone(this.rootBoneIndex);

      const offsetToRootBody = rootBoneOffsetPosition.subtract(
        this._transforms[this.rootBoneIndex].position,
      );
      this._rootTransformNode.setAbsolutePosition(
        this._rootTransformNode
          .getAbsolutePosition()
          .subtract(offsetToRootBody),
      );
      this._rootTransformNode.computeWorldMatrix(true);

      for (let i = 0; i < this._bones.length; i++) {
        if (i === this.rootBoneIndex) {
          continue;
        }

        this._addImpostorRotationToBone(i);
      }

      return;
    }

    if (this.disableBoxBoneSync) {
      return;
    }

    this._syncTransformsToBones();
  }

  ragdoll() {
    if (!this._initialized) {
      this.init();
    }

    if (this._ragdollMode || this.rootBoneIndex < 0) {
      return;
    }

    for (let i = 0; i < this._bones.length; i++) {
      if (this._linkedTransformNodes[i]) {
        this._bones[i].linkTransformNode(null);
      }

      const rotationAdjust = Quaternion.Inverse(this._initialRotation[i]);
      this._syncTransformToBone(i, rotationAdjust);
    }

    for (const constraint of this._constraints) {
      constraint.isEnabled = true;
    }

    for (const aggregate of this._aggregates) {
      aggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
      aggregate.body.setLinearVelocity(Vector3.Zero());
      aggregate.body.setAngularVelocity(Vector3.Zero());
    }

    this._ragdollMode = true;
  }

  dispose() {
    if (this._beforeRenderObserver) {
      this._scene.onBeforeRenderObservable.remove(this._beforeRenderObserver);
      this._beforeRenderObserver = null;
    }

    this._rootTransformNode.position.copyFrom(this._initialRootPosition);
    ensureRotationQuaternion(this._rootTransformNode).copyFrom(
      this._initialRootRotation,
    );
    this._rootTransformNode.computeWorldMatrix(true);

    for (let i = 0; i < this._bones.length; i++) {
      if (this._linkedTransformNodes[i]) {
        this._bones[i].linkTransformNode(this._linkedTransformNodes[i]);
      }
    }

    for (const constraint of this._constraints) {
      constraint.dispose();
    }
    this._constraints.length = 0;

    for (const aggregate of this._aggregates) {
      aggregate.dispose();
    }
    this._aggregates.length = 0;

    for (const transform of this._transforms) {
      transform.dispose();
    }
    this._transforms.length = 0;

    this._boxConfigs.length = 0;
    this._bones.length = 0;
    this._boneNames.length = 0;
    this._linkedTransformNodes.length = 0;
    this._initialRotation.length = 0;
    this._initialized = false;
    this._ragdollMode = false;
    this.rootBoneName = '';
    this.rootBoneIndex = -1;
  }
}
