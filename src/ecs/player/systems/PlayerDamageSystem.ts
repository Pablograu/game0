import { Vector3 } from '@babylonjs/core';
import { AudioManager } from '../../../AudioManager.ts';
import { EffectManager } from '../../../EffectManager.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { PlayerLifeState } from '../PlayerStateEnums.ts';
import {
  PlayerAnimationStateComponent,
  PlayerCombatStateComponent,
  PlayerControlStateComponent,
  PlayerHealthStateComponent,
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerRagdollStateComponent,
  PlayerSurvivabilityRequestComponent,
} from '../components/index.ts';

export class PlayerDamageSystem implements EcsSystem {
  readonly name = 'PlayerDamageSystem';
  readonly order = 15;

  update(world: World): void {
    const entityIds = world.query(
      PlayerAnimationStateComponent,
      PlayerCombatStateComponent,
      PlayerControlStateComponent,
      PlayerHealthStateComponent,
      PlayerLocomotionStateComponent,
      PlayerPhysicsViewRefsComponent,
      PlayerRagdollStateComponent,
      PlayerSurvivabilityRequestComponent,
    );

    for (const entityId of entityIds) {
      const animation = world.getComponent(
        entityId,
        PlayerAnimationStateComponent,
      );
      const combat = world.getComponent(entityId, PlayerCombatStateComponent);
      const control = world.getComponent(entityId, PlayerControlStateComponent);
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
      const requests = world.getComponent(
        entityId,
        PlayerSurvivabilityRequestComponent,
      );

      if (
        !animation ||
        !combat ||
        !control ||
        !health ||
        !locomotion ||
        !physicsRefs ||
        !ragdoll ||
        !requests
      ) {
        continue;
      }

      if (requests.deathRequested) {
        requests.deathRequested = false;

        if (health.lifeState === PlayerLifeState.ALIVE) {
          health.currentHealth = 0;
          health.lifeState = PlayerLifeState.DEAD;
          health.respawnTimer = health.respawnDelay;
          requests.gameOverRequested = true;
          requests.gameOverReason = 'player-death';
        }
      }

      const pendingRequests = requests.damageRequests.splice(
        0,
        requests.damageRequests.length,
      );

      for (const request of pendingRequests) {
        const playerPos = physicsRefs.mesh.getAbsolutePosition();
        const knockbackDir = request.damageSourcePosition
          ? playerPos.subtract(request.damageSourcePosition).normalize()
          : Vector3.Zero();

        if (request.damageSourcePosition && physicsRefs.body) {
          locomotion.lastKnockbackDir = knockbackDir.clone();
          ragdoll.lastKnockbackDir = knockbackDir.clone();
          physicsRefs.body.applyImpulse(
            knockbackDir.scale(locomotion.damageKnockbackForce),
            playerPos,
          );
          locomotion.recoilVelocity = Vector3.Zero();
          locomotion.isKnockedBack = true;
          locomotion.knockbackDuration = 0.5;
        }

        const torsoPos = playerPos.clone();
        torsoPos.y += 1;

        EffectManager.showBloodSplash(torsoPos, {
          intensity: 'hit',
          direction: knockbackDir.length() > 0.01 ? knockbackDir : undefined,
        });

        this.startOverride(animation, 'stumble_back', false, 1, true);

        if (
          health.isInvulnerable ||
          health.lifeState !== PlayerLifeState.ALIVE ||
          health.currentHealth <= 0
        ) {
          continue;
        }

        AudioManager.play('player_take_damage');
        health.currentHealth = Math.max(
          0,
          health.currentHealth - request.amount,
        );

        if (health.currentHealth <= 0) {
          health.lifeState = PlayerLifeState.DEAD;
          health.respawnTimer = health.respawnDelay;
          requests.gameOverRequested = true;
          requests.gameOverReason = 'player-death';
          continue;
        }

        health.isInvulnerable = true;
        health.invulnerabilityTimer = health.invulnerabilityDuration;
        health.blinkActive = true;
        health.blinkTimer = 0;

        if (physicsRefs.cameraShaker) {
          physicsRefs.cameraShaker.shakeHard();
        }
      }
    }
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
    animation.overrideAnimation = animationName;
    animation.overrideLoop = loop;
    animation.overrideForceReset = forceReset;
    animation.overrideSpeedRatio = speedRatio;
    animation.overrideTimer =
      (animationGroup.to - animationGroup.from) /
      frameRate /
      Math.max(speedRatio, 0.01);
  }
}
