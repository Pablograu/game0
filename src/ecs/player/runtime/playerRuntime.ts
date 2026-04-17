import {
  AnimationGroup,
  Axis,
  type Camera,
  Mesh,
  type Scene,
  Skeleton,
  type TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { CameraShaker } from '../../../CameraShaker.ts';
import type { WeaponSystem } from '../../../WeaponSystem.ts';
import { Ragdoll } from '../../../ragdoll_copy.js';
import type { PlayerAnimationRegistry } from './PlayerAnimations.ts';

/** Bone-name matchers for the two animation layers */
// Lower: only drives legs/feet — no Hips or Spine so the entire torso parent chain
// is owned by the upper (aim) group, keeping Spine1/Spine2 local rotations correct.
const LOWER_BODY_BONE_RE = /UpLeg|(?<!\w)Leg|Foot|Toe/i;
const UPPER_BODY_BONE_RE =
  /Hips|Spine|Shoulder|Arm|ForeArm|Hand|Neck|Head|Finger/i;

/**
 * Creates a new AnimationGroup that only contains targeted animations whose
 * target node name matches `nameMatcher`. Useful for building upper/lower-body
 * masked copies of a full-body animation group.
 */
function createMaskedAnimationGroup(
  scene: Scene,
  sourceGroup: AnimationGroup,
  nameMatcher: RegExp,
  newName: string,
): AnimationGroup {
  const masked = new AnimationGroup(newName, scene);
  for (const ta of sourceGroup.targetedAnimations) {
    const targetName: string = (ta.target as { name?: string }).name ?? '';
    if (nameMatcher.test(targetName)) {
      masked.addTargetedAnimation(ta.animation, ta.target);
    }
  }
  return masked;
}

export interface PlayerGameplayConfig {
  moveSpeed: number;
  jumpForce: number;
  jumpCutMultiplier: number;
  coyoteTime: number;
  jumpBufferTime: number;
  dashSpeed: number;
  dashDuration: number;
  dashCooldown: number;
  rotationSpeed: number;
  scaleSpeed: number;
  recoilForce: number;
  recoilDecay: number;
  pogoForce: number;
  damageKnockbackForce: number;
  knockbackDuration: number;
  playerHeight: number;
  playerRadius: number;
  maxHealth: number;
  invulnerabilityDuration: number;
  respawnDelay: number;
  punchSpeed: number;
  attackMoveSpeedMultiplier: number;
  punchHitboxDelay: number;
  magnetismRange: number;
  magnetismLungeSpeed: number;
  maxAttackQueue: number;
  blendingSpeed: number;
  minAirTime: number;
  fallingAnimDelay: number;
  groundLostGrace: number;
}

export interface PlayerBootstrapRuntime {
  scene: Scene;
  playerMesh: Mesh;
  camera?: Camera | null;
  cameraShaker?: CameraShaker | null;
  shoulderAnchor?: TransformNode | null;
  playerAnimations: PlayerAnimationRegistry;
  weaponSystem?: WeaponSystem | null;
  spawnPoint?: Vector3 | null;
  ragdollSkeleton?: Skeleton | null;
  ragdollArmatureNode?: Mesh | null;
  gameplayConfig?: Partial<PlayerGameplayConfig>;
}

export const DEFAULT_PLAYER_GAMEPLAY_CONFIG: PlayerGameplayConfig = {
  moveSpeed: 8,
  jumpForce: 15,
  jumpCutMultiplier: 0.2,
  coyoteTime: 0.12,
  jumpBufferTime: 0.15,
  dashSpeed: 17,
  dashDuration: 0.7,
  dashCooldown: 0.6,
  rotationSpeed: 12,
  scaleSpeed: 10,
  recoilForce: 8,
  recoilDecay: 10,
  pogoForce: 14,
  damageKnockbackForce: 12,
  knockbackDuration: 0.3,
  playerHeight: 2,
  playerRadius: 0.5,
  maxHealth: 10,
  invulnerabilityDuration: 1.5,
  respawnDelay: 2,
  punchSpeed: 2,
  attackMoveSpeedMultiplier: 0.1,
  punchHitboxDelay: 0.8,
  magnetismRange: 4,
  magnetismLungeSpeed: 6,
  maxAttackQueue: 1,
  blendingSpeed: 0.1,
  minAirTime: 0.15,
  fallingAnimDelay: 0.15,
  groundLostGrace: 0.08,
};

export function resolvePlayerGameplayConfig(
  overrides?: Partial<PlayerGameplayConfig>,
): PlayerGameplayConfig {
  return {
    ...DEFAULT_PLAYER_GAMEPLAY_CONFIG,
    ...overrides,
  };
}

export function initializePlayerAnimationGroups(
  playerAnimations: PlayerAnimationRegistry,
  blendingSpeed: number,
  scene: Scene,
): Map<string, AnimationGroup> {
  const animationGroups = new Map<string, AnimationGroup>();

  for (const [animationName, animationEntry] of Object.entries(
    playerAnimations,
  )) {
    if (!animationEntry) {
      continue;
    }

    const animationGroup = animationEntry.animationGroup;
    animationGroup.enableBlending = true;
    animationGroup.blendingSpeed = blendingSpeed;
    animationGroup.normalize(0, animationGroup.to);
    animationGroups.set(animationName, animationGroup);
  }

  // Build masked (partial-skeleton) groups for the aim+walk layered blend.
  const walkGroup = animationGroups.get('walk');
  const aimGroup = animationGroups.get('aim_assault_rifle');

  if (walkGroup) {
    const walkLower = createMaskedAnimationGroup(
      scene,
      walkGroup,
      LOWER_BODY_BONE_RE,
      'walk_lower',
    );
    walkLower.enableBlending = true;
    walkLower.blendingSpeed = blendingSpeed;
    walkLower.normalize(0, walkGroup.to);
    animationGroups.set('walk_lower', walkLower);
  }

  if (aimGroup) {
    const aimUpper = createMaskedAnimationGroup(
      scene,
      aimGroup,
      UPPER_BODY_BONE_RE,
      'aim_assault_rifle_upper',
    );
    aimUpper.enableBlending = true;
    aimUpper.blendingSpeed = blendingSpeed;
    aimUpper.normalize(0, aimGroup.to);
    animationGroups.set('aim_assault_rifle_upper', aimUpper);
  }

  return animationGroups;
}

export function createPlayerRagdoll(
  skeleton: Skeleton | null,
  armatureNode: Mesh | null,
): Ragdoll | null {
  if (!skeleton || !armatureNode) {
    return null;
  }

  armatureNode.scaling = new Vector3(0.017, 0.017, 0.017);

  const config = [
    { bones: ['mixamorig:Hips'], size: 0.42, boxOffset: 0.01 },
    {
      bones: ['mixamorig:Spine2'],
      width: 0.34,
      depth: 0.24,
      height: 0.48,
      boxOffset: 0.08,
      boneOffsetAxis: Axis.Z,
      min: -20,
      max: 20,
      rotationAxis: Axis.Z,
      jointDamping: 0.05,
      jointFriction: 0.03,
    },
    {
      bones: ['mixamorig:LeftArm', 'mixamorig:RightArm'],
      depth: 0.14,
      height: 0.14,
      width: 0.38,
      rotationAxis: Axis.Z,
      min: -35,
      max: 35,
      boxOffset: 0.16,
      boneOffsetAxis: Axis.Y,
      jointDamping: 0.04,
      jointFriction: 0.02,
    },
    {
      bones: ['mixamorig:LeftForeArm', 'mixamorig:RightForeArm'],
      depth: 0.12,
      height: 0.12,
      width: 0.36,
      rotationAxis: Axis.Y,
      min: -30,
      max: 30,
      boxOffset: 0.16,
      boneOffsetAxis: Axis.Y,
      jointDamping: 0.04,
      jointFriction: 0.02,
    },
    {
      bones: ['mixamorig:LeftUpLeg', 'mixamorig:RightUpLeg'],
      depth: 0.18,
      width: 0.18,
      height: 0.56,
      rotationAxis: Axis.Z,
      min: -40,
      max: 40,
      boxOffset: 0.2,
      boneOffsetAxis: Axis.Y,
      jointDamping: 0.05,
      jointFriction: 0.03,
    },
    {
      bones: ['mixamorig:LeftLeg', 'mixamorig:RightLeg'],
      depth: 0.16,
      width: 0.16,
      height: 0.48,
      rotationAxis: Axis.X,
      min: -5,
      max: 90,
      boxOffset: 0.18,
      boneOffsetAxis: Axis.Y,
      jointDamping: 0.04,
      jointFriction: 0.02,
    },
    {
      bones: ['mixamorig:Head'],
      size: 0.3,
      boxOffset: 0.02,
      boneOffsetAxis: Axis.Y,
      min: -45,
      max: 45,
      rotationAxis: Axis.Z,
      jointDamping: 0.04,
      jointFriction: 0.02,
    },
    {
      bones: ['mixamorig:LeftFoot', 'mixamorig:RightFoot'],
      depth: 0.28,
      width: 0.22,
      height: 0.1,
      rotationAxis: Axis.X,
      min: 1,
      max: 1,
      boxOffset: 0.08,
      boneOffsetAxis: Axis.Y,
      jointDamping: 0.08,
      jointFriction: 0.05,
    },
  ];

  const colRagdoll = 0x0004;
  const colEnvironment = 0x0001;
  const ragdoll = new Ragdoll(skeleton, armatureNode, config);
  ragdoll.init();

  if (ragdoll.rootBoneIndex < 0 || ragdoll.getAggregates().length === 0) {
    ragdoll.dispose();
    return null;
  }

  for (const aggregate of ragdoll.getAggregates()) {
    if (aggregate.shape) {
      aggregate.shape.filterMembershipMask = colRagdoll;
      aggregate.shape.filterCollideMask = colEnvironment;
    }
  }

  return ragdoll;
}
