import { Vector3 } from '@babylonjs/core';
import type { Camera, Mesh, Scene } from '@babylonjs/core';
import type { WeaponSystem } from '../../WeaponSystem.ts';
import type { PlayerController } from '../../player/PlayerController.ts';
import { LegacyPlayerRefsComponent } from '../components/LegacyPlayerRefsComponent.ts';
import { PlayerTagComponent } from '../components/PlayerTagComponent.ts';
import type { EntityId } from '../core/Entity.ts';
import type { World } from '../core/World.ts';
import { PlayerSurvivabilityRequestComponent } from './components/PlayerSurvivabilityRequestComponent.ts';
import {
  PlayerAnimationStateComponent,
  PlayerCombatStateComponent,
  PlayerControlStateComponent,
  PlayerGroundingStateComponent,
  PlayerHealthStateComponent,
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerRagdollStateComponent,
  PlayerSpawnStateComponent,
  PlayerWeaponStateComponent,
} from './components/index.ts';
import {
  PlayerCombatMode,
  PlayerJumpPhaseState,
  PlayerLifeState,
  PlayerLocomotionMode,
  PlayerRagdollMode,
  PlayerWeaponPhase,
} from './PlayerStateEnums.ts';

export interface CreatePlayerEntityOptions {
  world: World;
  scene: Scene;
  playerController: PlayerController;
  playerMesh?: Mesh | null;
  camera?: Camera | null;
}

type PlayerControllerSnapshot = {
  jumpPhase?: PlayerJumpPhaseState;
  airTime?: number;
  minAirTime?: number;
  fallingAnimDelay?: number;
  groundLostTimer?: number;
  groundLostGrace?: number;
  magnetismRange?: number;
  magnetismLungeSpeed?: number;
  attackQueue?: string[];
  MAX_ATTACK_QUEUE?: number;
};

export function createPlayerEntity(
  options: CreatePlayerEntityOptions,
): EntityId {
  const { world, scene, playerController } = options;
  const source = playerController as unknown as PlayerControllerSnapshot;
  const playerMesh = options.playerMesh ?? playerController.mesh;
  const weaponSystem = playerController.weaponSystem as WeaponSystem | null;
  const entityId = world.createEntity();

  weaponSystem?.enableExternalControl();

  world.addComponent(entityId, PlayerTagComponent, {
    kind: 'player',
  });

  world.addComponent(entityId, LegacyPlayerRefsComponent, {
    scene,
    mesh: playerMesh,
    camera: options.camera ?? null,
    controller: playerController,
  });

  world.addComponent(entityId, PlayerControlStateComponent, {
    inputEnabled: playerController.inputEnabled,
    inputMap: { ...playerController.inputMap },
    moveInputX: 0,
    moveInputZ: 0,
    jumpKeyReleased: playerController.jumpKeyReleased,
    dashRequested: false,
    attackRequested: false,
    danceToggleRequested: false,
    jumpBufferTime: playerController.jumpBufferTime,
    jumpBufferTimer: playerController.jumpBufferTimer,
  });

  world.addComponent(entityId, PlayerPhysicsViewRefsComponent, {
    scene,
    mesh: playerMesh,
    body: playerController.body ?? null,
    camera: options.camera ?? playerController.camera ?? null,
    cameraShaker: playerController.cameraShaker,
    physicsEngine: playerController.physicsEngine,
  });

  world.addComponent(entityId, PlayerLocomotionStateComponent, {
    mode: resolveLocomotionMode(playerController),
    isMoving: playerController.isMoving,
    isDashing: playerController.isDashing,
    isKnockedBack: playerController.isKnockedBack,
    moveDirection: Vector3.Zero(),
    moveSpeed: playerController.moveSpeed,
    normalMoveSpeed: playerController.normalMoveSpeed,
    dashSpeed: playerController.dashSpeed,
    dashDuration: playerController.dashDuration,
    dashTimer: playerController.dashTimer,
    dashCooldown: playerController.dashCooldown,
    dashCooldownTimer: playerController.dashCooldownTimer,
    dashDirection: playerController.dashDirection.clone(),
    lastFacingDirection: playerController.lastFacingDirection.clone(),
    lastKnockbackDir: playerController.lastKnockbackDir.clone(),
    targetAngle: playerController.targetAngle,
    targetRotation: playerController.targetRotation.clone(),
    targetScale: playerController.targetScale.clone(),
    originalScale: playerController.originalScale.clone(),
    rotationSpeed: playerController.rotationSpeed,
    scaleSpeed: playerController.scaleSpeed,
    recoilForce: playerController.recoilForce,
    recoilVelocity: playerController.recoilVelocity.clone(),
    recoilDecay: playerController.recoilDecay,
    pogoForce: playerController.pogoForce,
    damageKnockbackForce: playerController.damageKnockbackForce,
    knockbackDuration: playerController.knockbackDuration,
  });

  world.addComponent(entityId, PlayerGroundingStateComponent, {
    isGrounded: playerController.isGrounded,
    wasGrounded: playerController.wasGrounded,
    jumpPhase: source.jumpPhase ?? PlayerJumpPhaseState.GROUNDED,
    jumpForce: playerController.jumpForce,
    jumpCutMultiplier: playerController.jumpCutMultiplier,
    coyoteTime: playerController.coyoteTime,
    coyoteTimer: playerController.coyoteTimer,
    jumpBufferTime: playerController.jumpBufferTime,
    jumpBufferTimer: playerController.jumpBufferTimer,
    airTime: source.airTime ?? 0,
    minAirTime: source.minAirTime ?? 0,
    fallingAnimDelay: source.fallingAnimDelay ?? 0,
    groundLostTimer: source.groundLostTimer ?? 0,
    groundLostGrace: source.groundLostGrace ?? 0,
    playerHeight: playerController.playerHeight,
    playerRadius: playerController.playerRadius,
    raycastResult: playerController.raycastResult,
  });

  world.addComponent(entityId, PlayerCombatStateComponent, {
    mode: resolveCombatMode(playerController),
    isAttacking: playerController.isAttacking,
    isDancing: playerController.isDancing,
    useLeftPunch: playerController.useLeftPunch,
    punchSpeed: playerController.punchSpeed,
    attackMoveSpeedMultiplier: playerController.attackMoveSpeedMultiplier,
    punchHitboxDelay: playerController.punchHitboxDelay,
    magnetismRange: source.magnetismRange ?? 0,
    magnetismLungeSpeed: source.magnetismLungeSpeed ?? 0,
    attackQueue: [...(source.attackQueue ?? [])],
    maxAttackQueue: source.MAX_ATTACK_QUEUE ?? 0,
    activeAttackAnimation: null,
    activeAttackElapsed: 0,
    activeAttackDuration: 0,
    hitboxStartTime: 0,
    hitboxEndTime: 0,
  });

  world.addComponent(entityId, PlayerWeaponStateComponent, {
    phase: resolveWeaponPhase(weaponSystem),
    weaponSystem,
    damage: weaponSystem?.damage ?? 0,
    attackDuration: weaponSystem?.attackDuration ?? 0,
    attackCooldown: weaponSystem?.attackCooldown ?? 0,
    attackTimer: weaponSystem?.attackTimer ?? 0,
    cooldownTimer: weaponSystem?.cooldownTimer ?? 0,
    hitboxSize: weaponSystem?.hitboxSize?.clone() ?? null,
    hitboxOffset: weaponSystem?.hitboxOffset ?? 0,
    playerKnockback: weaponSystem?.playerKnockback ?? 0,
    registeredEnemyCount: weaponSystem?.enemies?.length ?? 0,
    hitEnemiesThisSwingCount: weaponSystem?.hitEnemiesThisSwing?.size ?? 0,
    hitObjectsThisSwingCount: weaponSystem?.hitObjectsThisSwing?.size ?? 0,
    hitboxActive: weaponSystem?.hitboxSystem?.isEnabled() ?? false,
    hitEnemiesThisSwing: new Set(weaponSystem?.hitEnemiesThisSwing ?? []),
  });

  world.addComponent(entityId, PlayerHealthStateComponent, {
    lifeState:
      playerController.currentHealth > 0
        ? PlayerLifeState.ALIVE
        : PlayerLifeState.DEAD,
    currentHealth: playerController.currentHealth,
    maxHealth: playerController.maxHealth,
    isInvulnerable: playerController.isInvulnerable,
    invulnerabilityDuration: playerController.invulnerabilityDuration,
    invulnerabilityTimer: playerController.invulnerabilityTimer,
    blinkActive: !!playerController.blinkInterval,
    blinkTimer: 0,
    blinkInterval: 0.1,
    respawnDelay: 2,
    respawnTimer: 0,
    healthUI: playerController.healthUI,
    healthText: playerController.healthText,
  });

  world.addComponent(entityId, PlayerAnimationStateComponent, {
    currentAnimation: playerController.currentPlayingAnimation,
    blendingSpeed: playerController.blendingSpeed,
    animationGroups: new Map(playerController.animationGroups),
    animationRegistry: playerController.playerAnimations,
  });

  world.addComponent(entityId, PlayerSpawnStateComponent, {
    spawnPoint: playerController.spawnPoint.clone(),
  });

  world.addComponent(entityId, PlayerRagdollStateComponent, {
    mode: resolveRagdollMode(playerController),
    ragdoll: playerController.ragdoll,
    lastKnockbackDir: playerController.lastKnockbackDir.clone(),
    pendingImpulse: null,
    pendingImpulseDelay: 0,
  });

  world.addComponent(entityId, PlayerSurvivabilityRequestComponent, {
    damageRequests: [],
    deathRequested: false,
    respawnRequested: false,
    gameOverRequested: false,
    gameOverReason: null,
    autoSignalGameOver: false,
  });

  playerController.attachEcsSurvivabilityFacade(world, entityId);

  return entityId;
}

function resolveLocomotionMode(
  playerController: PlayerController,
): PlayerLocomotionMode {
  if (playerController.isKnockedBack) {
    return PlayerLocomotionMode.KNOCKBACK;
  }

  if (playerController.isDashing) {
    return PlayerLocomotionMode.DASHING;
  }

  if (playerController.isMoving) {
    return PlayerLocomotionMode.MOVING;
  }

  return PlayerLocomotionMode.IDLE;
}

function resolveCombatMode(
  playerController: PlayerController,
): PlayerCombatMode {
  if (playerController.isDancing) {
    return PlayerCombatMode.DANCING;
  }

  if (playerController.isAttacking) {
    return PlayerCombatMode.ATTACKING;
  }

  return PlayerCombatMode.IDLE;
}

function resolveWeaponPhase(
  weaponSystem: WeaponSystem | null,
): PlayerWeaponPhase {
  if (!weaponSystem) {
    return PlayerWeaponPhase.IDLE;
  }

  if (weaponSystem.isAttacking) {
    return PlayerWeaponPhase.ATTACKING;
  }

  if (weaponSystem.cooldownTimer > 0) {
    return PlayerWeaponPhase.COOLDOWN;
  }

  return PlayerWeaponPhase.IDLE;
}

function resolveRagdollMode(
  playerController: PlayerController,
): PlayerRagdollMode {
  if (!playerController.ragdoll) {
    return PlayerRagdollMode.UNINITIALIZED;
  }

  if (playerController.currentHealth <= 0) {
    return PlayerRagdollMode.ACTIVE;
  }

  return PlayerRagdollMode.READY;
}
