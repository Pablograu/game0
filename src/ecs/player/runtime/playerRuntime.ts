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
import { AdvancedDynamicTexture, Control, TextBlock } from '@babylonjs/gui';
import type { CameraShaker } from '../../../CameraShaker.ts';
import type { WeaponSystem } from '../../../WeaponSystem.ts';
import { Ragdoll } from '../../../ragdoll_copy.js';
import type { PlayerAnimationRegistry } from './PlayerAnimations.ts';

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

export interface PlayerUiRefs {
  healthUI: AdvancedDynamicTexture | null;
  healthText: TextBlock | null;
}

export interface PlayerBootstrapRuntime {
  scene: Scene;
  playerMesh: Mesh;
  camera?: Camera | null;
  cameraShaker?: CameraShaker | null;
  shoulderAnchor?: TransformNode | null;
  playerAnimations: PlayerAnimationRegistry;
  weaponSystem?: WeaponSystem | null;
  healthUI?: AdvancedDynamicTexture | null;
  healthText?: TextBlock | null;
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
  maxHealth: 1000,
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

export function createPlayerHealthUi(
  scene: Scene,
  initialHealth: number,
): PlayerUiRefs {
  const healthUI = AdvancedDynamicTexture.CreateFullscreenUI(
    'healthUI',
    true,
    scene,
  );

  const healthText = new TextBlock('healthText');
  healthText.text = `Vidas: ${initialHealth}`;
  healthText.color = 'white';
  healthText.fontSize = 32;
  healthText.fontFamily = 'Arial';
  healthText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  healthText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  healthText.left = '20px';
  healthText.top = '20px';
  healthText.outlineWidth = 2;
  healthText.outlineColor = 'black';

  healthUI.addControl(healthText);

  return {
    healthUI,
    healthText,
  };
}

export function initializePlayerAnimationGroups(
  playerAnimations: PlayerAnimationRegistry,
  blendingSpeed: number,
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
    { bones: ['mixamorig:Hips'], size: 0.45, boxOffset: 0.01 },
    {
      bones: ['mixamorig:Spine2'],
      size: 0.4,
      height: 0.6,
      boxOffset: 0.05,
      boneOffsetAxis: Axis.Z,
      min: -1,
      max: 1,
      rotationAxis: Axis.Z,
    },
    {
      bones: ['mixamorig:LeftArm', 'mixamorig:RightArm'],
      depth: 0.1,
      size: 0.1,
      width: 0.5,
      rotationAxis: Axis.Y,
      boxOffset: 0.1,
      boneOffsetAxis: Axis.Y,
    },
    {
      bones: ['mixamorig:LeftForeArm', 'mixamorig:RightForeArm'],
      depth: 0.1,
      size: 0.1,
      width: 0.5,
      rotationAxis: Axis.Y,
      min: -1,
      max: 1,
      boxOffset: 0.12,
      boneOffsetAxis: Axis.Y,
    },
    {
      bones: ['mixamorig:LeftUpLeg', 'mixamorig:RightUpLeg'],
      depth: 0.1,
      size: 0.2,
      width: 0.08,
      height: 0.7,
      rotationAxis: Axis.Y,
      min: -1,
      max: 1,
      boxOffset: 0.2,
      boneOffsetAxis: Axis.Y,
    },
    {
      bones: ['mixamorig:LeftLeg', 'mixamorig:RightLeg'],
      depth: 0.08,
      size: 0.3,
      width: 0.1,
      height: 0.4,
      rotationAxis: Axis.Y,
      min: -1,
      max: 1,
      boxOffset: 0.2,
      boneOffsetAxis: Axis.Y,
    },
    {
      bones: ['mixamorig:LeftHand', 'mixamorig:RightHand'],
      depth: 0.2,
      size: 0.2,
      width: 0.2,
      rotationAxis: Axis.Y,
      min: -1,
      max: 1,
      boxOffset: 0.1,
      boneOffsetAxis: Axis.Y,
    },
    {
      bones: ['mixamorig:Head'],
      size: 0.4,
      boxOffset: 0,
      boneOffsetAxis: Axis.Y,
      min: -1,
      max: 1,
      rotationAxis: Axis.Z,
    },
    {
      bones: ['mixamorig:LeftFoot', 'mixamorig:RightFoot'],
      depth: 0.1,
      size: 0.1,
      width: 0.2,
      rotationAxis: Axis.Y,
      min: -1,
      max: 1,
      boxOffset: 0.05,
      boneOffsetAxis: Axis.Y,
    },
  ];

  const colRagdoll = 0x0004;
  const colEnvironment = 0x0001;
  const ragdoll = new Ragdoll(skeleton, armatureNode, config);

  for (const aggregate of ragdoll.getAggregates()) {
    if (aggregate.shape) {
      aggregate.shape.filterMembershipMask = colRagdoll;
      aggregate.shape.filterCollideMask = colEnvironment;
    }
  }

  return ragdoll;
}
