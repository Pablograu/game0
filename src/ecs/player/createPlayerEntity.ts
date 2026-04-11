import { PhysicsRaycastResult, Quaternion, Vector3 } from "@babylonjs/core";
import { PlayerTagComponent } from "../components/PlayerTagComponent.ts";
import type { EntityId } from "../core/Entity.ts";
import type { World } from "../core/World.ts";
import { CarriedWeaponType } from "../weapons/WeaponDefinitions.ts";
import {
  createPlayerRagdoll,
  initializePlayerAnimationGroups,
  resolvePlayerGameplayConfig,
  type PlayerBootstrapRuntime,
} from "./runtime/playerRuntime.ts";
import { PlayerSurvivabilityRequestComponent } from "./components/PlayerSurvivabilityRequestComponent.ts";
import {
  PlayerAnimationStateComponent,
  PlayerCombatStateComponent,
  PlayerControlStateComponent,
  PlayerGameplayConfigComponent,
  PlayerGroundingStateComponent,
  PlayerHealthStateComponent,
  PlayerInventoryComponent,
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerRagdollStateComponent,
  PlayerRangedStateComponent,
  PlayerSpawnStateComponent,
  PlayerWeaponStateComponent,
} from "./components/index.ts";
import {
  PlayerCombatMode,
  PlayerJumpPhaseState,
  PlayerLifeState,
  PlayerLocomotionMode,
  PlayerRagdollMode,
  PlayerWeaponPhase,
} from "./PlayerStateEnums.ts";

export interface CreatePlayerEntityOptions extends PlayerBootstrapRuntime {
  world: World;
}

export function createPlayerEntity(
  options: CreatePlayerEntityOptions,
): EntityId {
  const { world, scene } = options;
  const playerMesh = options.playerMesh;
  const weaponSystem = options.weaponSystem ?? null;
  const weaponHitbox = weaponSystem?.hitboxSystem ?? null;
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

  weaponHitbox?.setEnabled(false);

  world.addComponent(entityId, PlayerTagComponent, {
    kind: "player",
  });

  world.addComponent(entityId, PlayerGameplayConfigComponent, {
    ...gameplayConfig,
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
      scene.getPhysicsEngine() as unknown as PlayerPhysicsViewRefsComponent["physicsEngine"],
    shoulderAnchor: options.shoulderAnchor ?? null,
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
    phase: PlayerWeaponPhase.IDLE,
    hitbox: weaponHitbox,
    damage: weaponSystem?.damage ?? 1,
    attackDuration: weaponSystem?.attackDuration ?? 0.15,
    attackCooldown: weaponSystem?.attackCooldown ?? 0,
    cooldownTimer: 0,
    hitboxSize: weaponSystem?.hitboxSize?.clone() ?? null,
    hitboxOffset: weaponSystem?.hitboxOffset ?? 1.8,
    playerKnockback: weaponSystem?.playerKnockback ?? 3,
    registeredEnemyCount: 0,
    hitEnemiesThisSwingCount: 0,
    hitboxActive: false,
    hitEnemiesThisSwing: new Set(),
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
  });

  world.addComponent(entityId, PlayerAnimationStateComponent, {
    currentAnimation: "idle",
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
    autoSignalGameOver: true,
  });

  world.addComponent(entityId, PlayerInventoryComponent, {
    activeWeaponType: CarriedWeaponType.NONE,
    slots: {},
    nearbyWeaponEntityId: null,
    pickupRequested: false,
    dropRequested: false,
    equippedWeaponNode: null,
  });

  world.addComponent(entityId, PlayerRangedStateComponent, {
    isAiming: false,
    fireRequested: false,
    fireTimer: 0,
    shootTimer: 0,
    isReloading: false,
    reloadTimer: 0,
    currentAmmo: 0,
  });

  return entityId;
}
