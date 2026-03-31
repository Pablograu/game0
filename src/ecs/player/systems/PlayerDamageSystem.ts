import { Vector3 } from '@babylonjs/core';
import { AudioManager } from '../../../AudioManager.ts';
import { EffectManager } from '../../../EffectManager.ts';
import { LegacyPlayerRefsComponent } from '../../components/LegacyPlayerRefsComponent.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { PlayerLifeState } from '../PlayerStateEnums.ts';
import {
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
      LegacyPlayerRefsComponent,
      PlayerCombatStateComponent,
      PlayerControlStateComponent,
      PlayerHealthStateComponent,
      PlayerLocomotionStateComponent,
      PlayerPhysicsViewRefsComponent,
      PlayerRagdollStateComponent,
      PlayerSurvivabilityRequestComponent,
    );

    for (const entityId of entityIds) {
      const refs = world.getComponent(entityId, LegacyPlayerRefsComponent);
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
        !refs ||
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
          this.updateHealthUi(health);
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

        refs.controller.playSmoothAnimation('stumble_back', false, true);

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
        this.updateHealthUi(health);

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

  private updateHealthUi(health: PlayerHealthStateComponent) {
    if (!health.healthText) {
      return;
    }

    health.healthText.text = `Vidas: ${health.currentHealth}`;

    if (health.currentHealth <= 1) {
      health.healthText.color = 'red';
    } else if (health.currentHealth <= 2) {
      health.healthText.color = 'orange';
    } else {
      health.healthText.color = 'white';
    }
  }
}
