import type { Vector3 } from '@babylonjs/core';
import { AudioManager } from '../../../AudioManager.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  PlayerJumpPhaseState,
  PlayerLifeState,
  PlayerRagdollMode,
} from '../PlayerStateEnums.ts';
import { CarriedWeaponType } from '../../weapons/WeaponDefinitions.ts';
import {
  PlayerAnimationStateComponent,
  PlayerCombatStateComponent,
  PlayerGroundingStateComponent,
  PlayerHealthStateComponent,
  PlayerInventoryComponent,
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerRagdollStateComponent,
  PlayerRangedStateComponent,
} from '../components/index.ts';
import { getActiveWeaponType } from '../inventory/inventoryHelpers.ts';

// ---------------------------------------------------------------------------
// Discriminated union for animation playback
// ---------------------------------------------------------------------------

interface SingleAnimSpec {
  name: string;
  loop: boolean;
  speedRatio: number;
}

type AnimPlayback =
  | {
      mode: 'single';
      name: string;
      loop: boolean;
      forceReset: boolean;
      speedRatio: number;
    }
  | { mode: 'layered'; lower: SingleAnimSpec; upper: SingleAnimSpec };

// ---------------------------------------------------------------------------

export class PlayerAnimationSystem implements EcsSystem {
  readonly name = 'PlayerAnimationSystem';
  readonly order = 60;

  update(world: World, deltaTime: number): void {
    const entityIds = world.query(
      PlayerAnimationStateComponent,
      PlayerCombatStateComponent,
      PlayerGroundingStateComponent,
      PlayerHealthStateComponent,
      PlayerInventoryComponent,
      PlayerLocomotionStateComponent,
      PlayerPhysicsViewRefsComponent,
      PlayerRagdollStateComponent,
      PlayerRangedStateComponent,
    );

    for (const entityId of entityIds) {
      const animation = world.getComponent(
        entityId,
        PlayerAnimationStateComponent,
      );
      const combat = world.getComponent(entityId, PlayerCombatStateComponent);
      const grounding = world.getComponent(
        entityId,
        PlayerGroundingStateComponent,
      );
      const health = world.getComponent(entityId, PlayerHealthStateComponent);
      const locomotion = world.getComponent(
        entityId,
        PlayerLocomotionStateComponent,
      );
      const physicsRefs = world.getComponent(
        entityId,
        PlayerPhysicsViewRefsComponent,
      );
      const ragdoll = world.getComponent(entityId, PlayerRagdollStateComponent);
      const inventory = world.getComponent(entityId, PlayerInventoryComponent);
      const ranged = world.getComponent(entityId, PlayerRangedStateComponent);

      if (
        !animation ||
        !combat ||
        !grounding ||
        !health ||
        !locomotion ||
        !physicsRefs ||
        !ragdoll ||
        !inventory ||
        !ranged
      ) {
        continue;
      }

      const velocity =
        physicsRefs.body?.getLinearVelocity() ?? locomotion.recoilVelocity;
      this.updateJumpPhase(
        animation,
        grounding,
        locomotion,
        velocity.y,
        deltaTime,
      );

      if (animation.overrideAnimation && animation.overrideTimer > 0) {
        animation.overrideTimer = Math.max(
          0,
          animation.overrideTimer - deltaTime,
        );
        if (animation.overrideTimer <= 0) {
          animation.overrideAnimation = null;
          animation.overrideForceReset = false;
        }
      }

      const playback = this.resolvePlayback(
        animation,
        combat,
        grounding,
        health,
        locomotion,
        ragdoll,
        velocity,
        inventory,
        ranged,
      );

      this.applyPlayback(animation, playback);

      const isRunning =
        playback.mode === 'single' &&
        playback.name === 'run' &&
        grounding.isGrounded;
      if (isRunning) {
        AudioManager.playLoop('player_walk');
      } else {
        AudioManager.stopLoop('player_walk');
      }
    }
  }

  private updateJumpPhase(
    animation: PlayerAnimationStateComponent,
    grounding: PlayerGroundingStateComponent,
    locomotion: PlayerLocomotionStateComponent,
    velocityY: number,
    deltaTime: number,
  ) {
    if (grounding.isGrounded && !grounding.wasGrounded) {
      grounding.airTime = 0;
      grounding.jumpPhase = PlayerJumpPhaseState.PRE_LANDING;

      return;
    }

    if (grounding.isGrounded) {
      grounding.airTime = 0;
      if (
        grounding.jumpPhase !== PlayerJumpPhaseState.PRE_LANDING ||
        animation.overrideAnimation !== 'land'
      ) {
        grounding.jumpPhase = PlayerJumpPhaseState.GROUNDED;
      }

      return;
    }

    grounding.airTime += deltaTime;

    if (grounding.jumpPhase === PlayerJumpPhaseState.GROUNDED) {
      grounding.jumpPhase = PlayerJumpPhaseState.FALLING;
      return;
    }

    if (grounding.jumpPhase === PlayerJumpPhaseState.RISING) {
      if (velocityY <= 0 && grounding.airTime > grounding.minAirTime) {
        grounding.jumpPhase = PlayerJumpPhaseState.FALLING;
      }
      return;
    }

    if (
      grounding.jumpPhase === PlayerJumpPhaseState.FALLING &&
      velocityY < -0.5 &&
      grounding.raycastResult.hasHit &&
      locomotion.moveDirection.length() <= 0.1
    ) {
      grounding.jumpPhase = PlayerJumpPhaseState.PRE_LANDING;
      return;
    }

    if (
      grounding.jumpPhase === PlayerJumpPhaseState.PRE_LANDING &&
      !animation.overrideAnimation
    ) {
      grounding.jumpPhase = grounding.isGrounded
        ? PlayerJumpPhaseState.GROUNDED
        : PlayerJumpPhaseState.FALLING;
    }
  }

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  private static single(
    name: string,
    loop: boolean,
    forceReset = false,
    speedRatio = 1,
  ): AnimPlayback {
    return { mode: 'single', name, loop, forceReset, speedRatio };
  }

  // ---------------------------------------------------------------------------
  // Playback resolution
  // ---------------------------------------------------------------------------

  private resolvePlayback(
    animation: PlayerAnimationStateComponent,
    combat: PlayerCombatStateComponent,
    grounding: PlayerGroundingStateComponent,
    health: PlayerHealthStateComponent,
    locomotion: PlayerLocomotionStateComponent,
    ragdoll: PlayerRagdollStateComponent,
    velocity: Vector3,
    inventory: PlayerInventoryComponent,
    ranged: PlayerRangedStateComponent,
  ): AnimPlayback {
    // s stands
    const s = PlayerAnimationSystem.single;
    const velocityY = velocity.y;
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    const armed = getActiveWeaponType(inventory) !== CarriedWeaponType.NONE;
    const hasMoveIntent = locomotion.moveDirection.length() > 0.1;
    const isLayeredAimWalkActive =
      animation.currentLayerLower === 'walk_lower' &&
      animation.currentLayerUpper === 'aim_assault_rifle_upper';
    const shouldUseAimWalkLayer =
      armed &&
      ranged.isAiming &&
      !ranged.isReloading &&
      ranged.shootTimer <= 0 &&
      hasMoveIntent &&
      this.canMaintainAimWalkLayer(
        grounding,
        velocityY,
        horizontalSpeed,
        isLayeredAimWalkActive,
      );

    if (ragdoll.mode === PlayerRagdollMode.ACTIVE) {
      return s('dead', false);
    }

    if (animation.overrideAnimation) {
      return s(
        animation.overrideAnimation,
        animation.overrideLoop,
        animation.overrideForceReset,
        animation.overrideSpeedRatio,
      );
    }

    if (combat.isAttacking && combat.activeAttackAnimation) {
      return s(combat.activeAttackAnimation, false, false, combat.punchSpeed);
    }

    if (locomotion.isDashing) {
      return s('dash', false, false, 1.5);
    }

    if (health.lifeState !== PlayerLifeState.ALIVE) {
      return s('dead', false);
    }

    if (shouldUseAimWalkLayer) {
      return {
        mode: 'layered',
        lower: { name: 'walk_lower', loop: true, speedRatio: 1 },
        upper: { name: 'aim_assault_rifle_upper', loop: true, speedRatio: 1 },
      };
    }

    if (grounding.jumpPhase === PlayerJumpPhaseState.RISING) {
      return s(
        'jump',
        true,
        false,
        Math.max(0.5, (velocityY / Math.max(grounding.jumpForce, 0.01)) * 1.2),
      );
    }

    if (grounding.jumpPhase === PlayerJumpPhaseState.FALLING) {
      if (grounding.airTime >= grounding.fallingAnimDelay) {
        return s('falling', true, false, Math.min(1, Math.abs(velocityY) / 10));
      }
      return s('jump', true, false, 0.3);
    }

    if (armed && ranged.shootTimer > 0) {
      return s('shoot_assault_rifle', false);
    }

    if (armed && ranged.isReloading) {
      return s('reload', false);
    }

    // Aim standing still → full-body aim
    if (armed && ranged.isAiming) {
      return s('aim_assault_rifle', true);
    }

    if (armed && locomotion.isMoving) {
      return s('run_assault_rifle', true);
    }

    if (armed) {
      return s('idle_assault_rifle', true);
    }

    if (locomotion.isMoving) {
      return s('run', true);
    }

    if (combat.isDancing) {
      return s('macarena', true);
    }

    return s('idle', true);
  }

  private canMaintainAimWalkLayer(
    grounding: PlayerGroundingStateComponent,
    velocityY: number,
    horizontalSpeed: number,
    isLayeredAimWalkActive: boolean,
  ): boolean {
    if (grounding.jumpPhase === PlayerJumpPhaseState.RISING) {
      return false;
    }

    if (grounding.isGrounded) {
      return true;
    }

    const withinGroundGrace =
      grounding.groundLostTimer < grounding.groundLostGrace && velocityY > -1;

    if (withinGroundGrace) {
      return true;
    }

    return (
      isLayeredAimWalkActive &&
      grounding.jumpPhase === PlayerJumpPhaseState.FALLING &&
      grounding.airTime < grounding.fallingAnimDelay &&
      horizontalSpeed > 0.35 &&
      velocityY > -1.5
    );
  }

  // ---------------------------------------------------------------------------
  // Playback application
  // ---------------------------------------------------------------------------

  private applyPlayback(
    animation: PlayerAnimationStateComponent,
    playback: AnimPlayback,
  ) {
    if (playback.mode === 'layered') {
      this.applyLayeredPlayback(animation, playback);
    } else {
      this.applySinglePlayback(
        animation,
        playback.name,
        playback.loop,
        playback.forceReset,
        playback.speedRatio,
      );
    }
  }

  private applySinglePlayback(
    animation: PlayerAnimationStateComponent,
    name: string,
    loop: boolean,
    forceReset: boolean,
    speedRatio: number,
  ) {
    const animationGroup = animation.animationGroups.get(name);
    if (!animationGroup) {
      return;
    }

    if (
      animation.currentAnimation !== name ||
      forceReset ||
      !animationGroup.isPlaying
    ) {
      // Stop every group except the target, including any active layered groups
      for (const [
        otherName,
        otherAnimationGroup,
      ] of animation.animationGroups) {
        if (otherName !== name && otherAnimationGroup.isPlaying) {
          otherAnimationGroup.stop();
        }
      }

      animationGroup.loopAnimation = loop;
      animationGroup.start(
        loop,
        speedRatio,
        animationGroup.from,
        animationGroup.to,
        true,
      );
      animation.currentAnimation = name;
      animation.currentLayerLower = null;
      animation.currentLayerUpper = null;
    }

    animationGroup.speedRatio = speedRatio;
    animation.activeSpeedRatio = speedRatio;
  }

  private applyLayeredPlayback(
    animation: PlayerAnimationStateComponent,
    playback: Extract<AnimPlayback, { mode: 'layered' }>,
  ) {
    const { lower, upper } = playback;
    const lowerGroup = animation.animationGroups.get(lower.name);
    const upperGroup = animation.animationGroups.get(upper.name);

    if (!lowerGroup || !upperGroup) {
      return;
    }

    const keepKeys = new Set([lower.name, upper.name]);

    // Layered aim-walk must be authoritative while active.
    for (const [key, group] of animation.animationGroups) {
      if (!keepKeys.has(key) && group.isPlaying) {
        group.stop();
      }
    }

    animation.currentAnimation = '__layered__';
    animation.currentLayerLower = lower.name;
    animation.currentLayerUpper = upper.name;

    // Always ensure both groups are playing — Babylon briefly sets isPlaying=false
    // at each loop boundary, which would leave the pair stopped on frames where
    // layerChanged is false. Restart them unconditionally if they have stopped.
    if (!lowerGroup.isPlaying) {
      lowerGroup.loopAnimation = lower.loop;
      lowerGroup.start(
        lower.loop,
        lower.speedRatio,
        lowerGroup.from,
        lowerGroup.to,
        true,
      );
    }

    if (!upperGroup.isPlaying) {
      upperGroup.loopAnimation = upper.loop;
      upperGroup.start(
        upper.loop,
        upper.speedRatio,
        upperGroup.from,
        upperGroup.to,
        true,
      );
    }

    lowerGroup.speedRatio = lower.speedRatio;
    upperGroup.speedRatio = upper.speedRatio;
    animation.activeSpeedRatio = Math.max(lower.speedRatio, upper.speedRatio);
  }

  private startOverride(
    animation: PlayerAnimationStateComponent,
    animationName: string,
    loop: boolean,
    speedRatio: number,
    forceReset: boolean,
  ) {
    const animationGroup = animation.animationGroups.get(animationName);
    if (!animationGroup) {
      return;
    }

    const frameRate =
      animationGroup.targetedAnimations[0]?.animation.framePerSecond ?? 30;
    const duration =
      (animationGroup.to - animationGroup.from) /
      frameRate /
      Math.max(speedRatio, 0.01);

    animation.overrideAnimation = animationName;
    animation.overrideLoop = loop;
    animation.overrideSpeedRatio = speedRatio;
    animation.overrideForceReset = forceReset;
    animation.overrideTimer = duration;
  }
}
