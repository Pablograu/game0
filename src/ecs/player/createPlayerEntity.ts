import { PhysicsRaycastResult, Quaternion, Vector3 } from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import type { WeaponSystem } from '../../WeaponSystem.ts';
import { PlayerTagComponent } from '../components/PlayerTagComponent.ts';
import type { EntityId } from '../core/Entity.ts';
import type { World } from '../core/World.ts';
import {
  createPlayerRagdoll,
  initializePlayerAnimationGroups,
  resolvePlayerGameplayConfig,
  type PlayerBootstrapRuntime,
} from '../../player/playerRuntime.ts';
import { PlayerSurvivabilityRequestComponent } from './components/PlayerSurvivabilityRequestComponent.ts';
import {
  PlayerAnimationStateComponent,
  PlayerCombatStateComponent,
  PlayerControlStateComponent,
  PlayerGameOverHandlerComponent,
  PlayerGameplayConfigComponent,
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

export interface CreatePlayerEntityOptions extends PlayerBootstrapRuntime {
  world: World;
}

export function createPlayerEntity(
  options: CreatePlayerEntityOptions,
): EntityId {
  const { world, scene } = options;
  const playerMesh = options.playerMesh;
  const weaponSystem = options.weaponSystem ?? null;
  const gameplayConfig = resolvePlayerGameplayConfig(options.gameplayConfig);
  const animationGroups = initializePlayerAnimationGroups(
    options.playerAnimations,
    gameplayConfig.blendingSpeed,
  );
  const ragdoll = createPlayerRagdoll(
    options.ragdollSkeleton ?? null,
    options.ragdollArmatureNode ?? null,
  );
  const entityId = world.createEntity();

  weaponSystem?.enableExternalControl();

  world.addComponent(entityId, PlayerTagComponent, {
    kind: 'player',
  });

  world.addComponent(entityId, PlayerGameplayConfigComponent, {
    ...gameplayConfig,
  });

  world.addComponent(entityId, PlayerGameOverHandlerComponent, {
    handler: options.gameOverHandler ?? null,
  });

  world.addComponent(entityId, PlayerControlStateComponent, {
    inputEnabled: true,
    inputMap: {},
    moveInputX: 0,
    moveInputZ: 0,
    jumpKeyReleased: true,
    dashRequested: false,
    attackRequested: false,
    danceToggleRequested: false,
    jumpBufferTime: gameplayConfig.jumpBufferTime,
    jumpBufferTimer: 0,
  });

  world.addComponent(entityId, PlayerPhysicsViewRefsComponent, {
    scene,
    mesh: playerMesh,
    body: playerMesh.physicsBody ?? null,
    camera: options.camera ?? null,
    cameraShaker: options.cameraShaker ?? null,
    physicsEngine:
      scene.getPhysicsEngine() as unknown as PlayerPhysicsViewRefsComponent['physicsEngine'],
  });

  world.addComponent(entityId, PlayerLocomotionStateComponent, {
    mode: PlayerLocomotionMode.IDLE,
    isMoving: false,
    isDashing: false,
    isKnockedBack: false,
    moveDirection: Vector3.Zero(),
    moveSpeed: gameplayConfig.moveSpeed,
    normalMoveSpeed: gameplayConfig.moveSpeed,
    dashSpeed: gameplayConfig.dashSpeed,
    dashDuration: gameplayConfig.dashDuration,
    dashTimer: 0,
    dashCooldown: gameplayConfig.dashCooldown,
    dashCooldownTimer: 0,
    dashDirection: Vector3.Zero(),
    lastFacingDirection: new Vector3(0, 0, 1),
    lastKnockbackDir: Vector3.Zero(),
    targetAngle: 0,
    targetRotation: Quaternion.Identity(),
    targetScale: playerMesh.scaling.clone(),
    originalScale: playerMesh.scaling.clone(),
    rotationSpeed: gameplayConfig.rotationSpeed,
    scaleSpeed: gameplayConfig.scaleSpeed,
    recoilForce: gameplayConfig.recoilForce,
    recoilVelocity: Vector3.Zero(),
    recoilDecay: gameplayConfig.recoilDecay,
    pogoForce: gameplayConfig.pogoForce,
    damageKnockbackForce: gameplayConfig.damageKnockbackForce,
    knockbackDuration: gameplayConfig.knockbackDuration,
  });

  world.addComponent(entityId, PlayerGroundingStateComponent, {
    isGrounded: false,
    wasGrounded: false,
    jumpPhase: PlayerJumpPhaseState.GROUNDED,
    jumpForce: gameplayConfig.jumpForce,
    jumpCutMultiplier: gameplayConfig.jumpCutMultiplier,
    coyoteTime: gameplayConfig.coyoteTime,
    coyoteTimer: 0,
    jumpBufferTime: gameplayConfig.jumpBufferTime,
    jumpBufferTimer: 0,
    airTime: 0,
    minAirTime: gameplayConfig.minAirTime,
    fallingAnimDelay: gameplayConfig.fallingAnimDelay,
    groundLostTimer: 0,
    groundLostGrace: gameplayConfig.groundLostGrace,
    playerHeight: gameplayConfig.playerHeight,
    playerRadius: gameplayConfig.playerRadius,
    raycastResult: new PhysicsRaycastResult(),
  });

  world.addComponent(entityId, PlayerCombatStateComponent, {
    mode: PlayerCombatMode.IDLE,
    isAttacking: false,
    isDancing: false,
    useLeftPunch: true,
    punchSpeed: gameplayConfig.punchSpeed,
    attackMoveSpeedMultiplier: gameplayConfig.attackMoveSpeedMultiplier,
    punchHitboxDelay: gameplayConfig.punchHitboxDelay,
    magnetismRange: gameplayConfig.magnetismRange,
    magnetismLungeSpeed: gameplayConfig.magnetismLungeSpeed,
    attackQueue: [],
    maxAttackQueue: gameplayConfig.maxAttackQueue,
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
    lifeState: PlayerLifeState.ALIVE,
    currentHealth: gameplayConfig.maxHealth,
    maxHealth: gameplayConfig.maxHealth,
    isInvulnerable: false,
    invulnerabilityDuration: gameplayConfig.invulnerabilityDuration,
    invulnerabilityTimer: 0,
    blinkActive: false,
    blinkTimer: 0,
    blinkInterval: 0.1,
    respawnDelay: gameplayConfig.respawnDelay,
    respawnTimer: 0,
    healthUI: options.healthUI ?? null,
    healthText: options.healthText ?? null,
  });

  world.addComponent(entityId, PlayerAnimationStateComponent, {
    currentAnimation: 'idle',
    blendingSpeed: gameplayConfig.blendingSpeed,
    activeSpeedRatio: 1,
    animationGroups,
    animationRegistry: options.playerAnimations,
    overrideAnimation: null,
    overrideLoop: false,
    overrideForceReset: false,
    overrideSpeedRatio: 1,
    overrideTimer: 0,
  });

  world.addComponent(entityId, PlayerSpawnStateComponent, {
    spawnPoint: (options.spawnPoint ?? playerMesh.position).clone(),
  });

  world.addComponent(entityId, PlayerRagdollStateComponent, {
    mode: ragdoll ? PlayerRagdollMode.READY : PlayerRagdollMode.UNINITIALIZED,
    ragdoll,
    ragdollSkeleton: options.ragdollSkeleton ?? null,
    ragdollArmatureNode: options.ragdollArmatureNode ?? null,
    lastKnockbackDir: Vector3.Zero(),
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

  return entityId;
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
