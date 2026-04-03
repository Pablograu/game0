import { AudioManager } from "../../../AudioManager.ts";
import type { EcsSystem } from "../../core/System.ts";
import type { World } from "../../core/World.ts";
import {
  PlayerJumpPhaseState,
  PlayerLifeState,
  PlayerRagdollMode,
} from "../PlayerStateEnums.ts";
import {
  PlayerAnimationStateComponent,
  PlayerCombatStateComponent,
  PlayerGroundingStateComponent,
  PlayerHealthStateComponent,
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerRagdollStateComponent,
} from "../components/index.ts";

export class PlayerAnimationSystem implements EcsSystem {
  readonly name = "PlayerAnimationSystem";
  readonly order = 60;

  update(world: World, deltaTime: number): void {
    const entityIds = world.query(
      PlayerAnimationStateComponent,
      PlayerCombatStateComponent,
      PlayerGroundingStateComponent,
      PlayerHealthStateComponent,
      PlayerLocomotionStateComponent,
      PlayerPhysicsViewRefsComponent,
      PlayerRagdollStateComponent,
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

      if (
        !animation ||
        !combat ||
        !grounding ||
        !health ||
        !locomotion ||
        !physicsRefs ||
        !ragdoll
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
        velocity.y,
      );

      this.playAnimation(
        animation,
        playback.name,
        playback.loop,
        playback.forceReset,
        playback.speedRatio,
      );

      if (playback.name === "run" && grounding.isGrounded) {
        AudioManager.playLoop("player_walk");
      } else {
        AudioManager.stopLoop("player_walk");
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
        animation.overrideAnimation !== "land"
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

  private resolvePlayback(
    animation: PlayerAnimationStateComponent,
    combat: PlayerCombatStateComponent,
    grounding: PlayerGroundingStateComponent,
    health: PlayerHealthStateComponent,
    locomotion: PlayerLocomotionStateComponent,
    ragdoll: PlayerRagdollStateComponent,
    velocityY: number,
  ) {
    if (ragdoll.mode === PlayerRagdollMode.ACTIVE) {
      return { name: "dead", loop: false, forceReset: false, speedRatio: 1 };
    }

    if (animation.overrideAnimation) {
      return {
        name: animation.overrideAnimation,
        loop: animation.overrideLoop,
        forceReset: animation.overrideForceReset,
        speedRatio: animation.overrideSpeedRatio,
      };
    }

    if (combat.isAttacking && combat.activeAttackAnimation) {
      return {
        name: combat.activeAttackAnimation,
        loop: false,
        forceReset: false,
        speedRatio: combat.punchSpeed,
      };
    }

    if (locomotion.isDashing) {
      return { name: "dash", loop: false, forceReset: false, speedRatio: 1.5 };
    }

    if (health.lifeState !== PlayerLifeState.ALIVE) {
      return { name: "dead", loop: false, forceReset: false, speedRatio: 1 };
    }

    if (grounding.jumpPhase === PlayerJumpPhaseState.RISING) {
      return {
        name: "jump",
        loop: true,
        forceReset: false,
        speedRatio: Math.max(
          0.5,
          (velocityY / Math.max(grounding.jumpForce, 0.01)) * 1.2,
        ),
      };
    }

    if (grounding.jumpPhase === PlayerJumpPhaseState.FALLING) {
      if (grounding.airTime >= grounding.fallingAnimDelay) {
        return {
          name: "falling",
          loop: true,
          forceReset: false,
          speedRatio: Math.min(1, Math.abs(velocityY) / 10),
        };
      }

      return { name: "jump", loop: true, forceReset: false, speedRatio: 0.3 };
    }

    if (locomotion.isMoving) {
      return { name: "run", loop: true, forceReset: false, speedRatio: 1 };
    }

    if (combat.isDancing) {
      return { name: "macarena", loop: true, forceReset: false, speedRatio: 1 };
    }

    return { name: "idle", loop: true, forceReset: false, speedRatio: 1 };
  }

  private playAnimation(
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
    }

    animationGroup.speedRatio = speedRatio;
    animation.activeSpeedRatio = speedRatio;
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
