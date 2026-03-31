import { Vector3 } from '@babylonjs/core';
import { createPlayerRagdoll } from '../../../player/playerRuntime.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  PlayerCombatMode,
  PlayerLifeState,
  PlayerLocomotionMode,
  PlayerRagdollMode,
  PlayerWeaponPhase,
} from '../PlayerStateEnums.ts';
import {
  PlayerCombatStateComponent,
  PlayerControlStateComponent,
  PlayerHealthStateComponent,
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerRagdollStateComponent,
  PlayerSpawnStateComponent,
  PlayerSurvivabilityRequestComponent,
  PlayerWeaponStateComponent,
} from '../components/index.ts';

interface EcsRagdollApi {
  ragdoll(): void;
  getAggregates(): Array<{
    body?: {
      applyImpulse(impulse: Vector3, contactPoint: Vector3): void;
    };
  }>;
}

export class PlayerSurvivabilitySystem implements EcsSystem {
  readonly name = 'PlayerSurvivabilitySystem';
  readonly order = 18;

  update(world: World, deltaTime: number): void {
    const entityIds = world.query(
      PlayerCombatStateComponent,
      PlayerControlStateComponent,
      PlayerHealthStateComponent,
      PlayerLocomotionStateComponent,
      PlayerPhysicsViewRefsComponent,
      PlayerRagdollStateComponent,
      PlayerSpawnStateComponent,
      PlayerSurvivabilityRequestComponent,
      PlayerWeaponStateComponent,
    );

    for (const entityId of entityIds) {
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
      const spawn = world.getComponent(entityId, PlayerSpawnStateComponent);
      const requests = world.getComponent(
        entityId,
        PlayerSurvivabilityRequestComponent,
      );
      const weapon = world.getComponent(entityId, PlayerWeaponStateComponent);

      if (
        !combat ||
        !control ||
        !health ||
        !locomotion ||
        !physicsRefs ||
        !ragdoll ||
        !spawn ||
        !requests ||
        !weapon
      ) {
        continue;
      }

      this.updateInvulnerability(physicsRefs.mesh, health, deltaTime);

      if (health.lifeState === PlayerLifeState.ALIVE) {
        requests.respawnRequested = false;
        continue;
      }

      control.inputEnabled = false;
      control.inputMap = {};
      control.moveInputX = 0;
      control.moveInputZ = 0;
      control.dashRequested = false;
      control.attackRequested = false;
      control.danceToggleRequested = false;
      combat.isAttacking = false;
      combat.isDancing = false;
      combat.attackQueue = [];
      combat.mode = PlayerCombatMode.IDLE;
      locomotion.isMoving = false;
      locomotion.isDashing = false;
      locomotion.dashTimer = 0;
      locomotion.mode = PlayerLocomotionMode.IDLE;
      weapon.hitboxActive = false;
      weapon.phase = PlayerWeaponPhase.IDLE;
      weapon.hitbox?.setEnabled(false);

      if (health.blinkActive || health.isInvulnerable) {
        health.blinkActive = false;
        health.isInvulnerable = false;
        health.invulnerabilityTimer = 0;
        health.blinkTimer = 0;
        physicsRefs.mesh.visibility = 1;
      }

      if (ragdoll.mode === PlayerRagdollMode.READY && ragdoll.ragdoll) {
        const ragdollApi = ragdoll.ragdoll as EcsRagdollApi;
        ragdollApi.ragdoll();
        ragdoll.mode = PlayerRagdollMode.ACTIVE;
        ragdoll.pendingImpulse = ragdoll.lastKnockbackDir.scale(
          locomotion.damageKnockbackForce * 5,
        );
        ragdoll.pendingImpulseDelay = Math.max(deltaTime, 1 / 60);
      }

      if (ragdoll.mode === PlayerRagdollMode.ACTIVE && ragdoll.pendingImpulse) {
        ragdoll.pendingImpulseDelay = Math.max(
          0,
          ragdoll.pendingImpulseDelay - deltaTime,
        );

        if (ragdoll.pendingImpulseDelay <= 0) {
          const ragdollApi = ragdoll.ragdoll as EcsRagdollApi | null;
          const appPoint = physicsRefs.mesh.getAbsolutePosition();

          for (const aggregate of ragdollApi?.getAggregates() ?? []) {
            aggregate.body?.applyImpulse(ragdoll.pendingImpulse, appPoint);
          }

          ragdoll.pendingImpulse = null;
        }
      }

      if (requests.respawnRequested) {
        health.respawnTimer = 0;
      } else if (health.respawnTimer > 0) {
        health.respawnTimer = Math.max(0, health.respawnTimer - deltaTime);
      }

      if (requests.respawnRequested || health.respawnTimer <= 0) {
        this.respawnPlayer(
          control,
          combat,
          health,
          locomotion,
          physicsRefs,
          ragdoll,
          spawn,
          requests,
          weapon,
        );
      }
    }
  }

  private updateInvulnerability(
    mesh: PlayerPhysicsViewRefsComponent['mesh'],
    health: PlayerHealthStateComponent,
    deltaTime: number,
  ) {
    if (!health.isInvulnerable) {
      if (mesh.visibility !== 1) {
        mesh.visibility = 1;
      }
      return;
    }

    health.invulnerabilityTimer = Math.max(
      0,
      health.invulnerabilityTimer - deltaTime,
    );

    if (health.blinkActive) {
      health.blinkTimer += deltaTime;

      if (health.blinkTimer >= health.blinkInterval) {
        health.blinkTimer = 0;
        mesh.visibility = mesh.visibility >= 1 ? 0.3 : 1;
      }
    }

    if (health.invulnerabilityTimer > 0) {
      return;
    }

    health.isInvulnerable = false;
    health.blinkActive = false;
    health.blinkTimer = 0;
    mesh.visibility = 1;
  }

  private respawnPlayer(
    control: PlayerControlStateComponent,
    combat: PlayerCombatStateComponent,
    health: PlayerHealthStateComponent,
    locomotion: PlayerLocomotionStateComponent,
    physicsRefs: PlayerPhysicsViewRefsComponent,
    ragdoll: PlayerRagdollStateComponent,
    spawn: PlayerSpawnStateComponent,
    requests: PlayerSurvivabilityRequestComponent,
    weapon: PlayerWeaponStateComponent,
  ) {
    physicsRefs.mesh.position.copyFrom(spawn.spawnPoint);
    physicsRefs.mesh.visibility = 1;

    physicsRefs.body?.setLinearVelocity(Vector3.Zero());
    physicsRefs.body?.setAngularVelocity(Vector3.Zero());

    this.disposeRagdoll(ragdoll.ragdoll);
    ragdoll.ragdoll = createPlayerRagdoll(
      ragdoll.ragdollSkeleton,
      ragdoll.ragdollArmatureNode,
    );
    ragdoll.mode = ragdoll.ragdoll
      ? PlayerRagdollMode.READY
      : PlayerRagdollMode.UNINITIALIZED;
    ragdoll.pendingImpulse = null;
    ragdoll.pendingImpulseDelay = 0;

    health.currentHealth = health.maxHealth;
    health.lifeState = PlayerLifeState.ALIVE;
    health.isInvulnerable = true;
    health.invulnerabilityTimer = health.invulnerabilityDuration;
    health.blinkActive = true;
    health.blinkTimer = 0;
    health.respawnTimer = 0;

    control.inputEnabled = true;
    combat.isAttacking = false;
    combat.attackQueue = [];
    combat.mode = PlayerCombatMode.IDLE;
    locomotion.isMoving = false;
    locomotion.isDashing = false;
    locomotion.isKnockedBack = false;
    locomotion.knockbackDuration = 0;
    locomotion.recoilVelocity = Vector3.Zero();
    locomotion.mode = PlayerLocomotionMode.IDLE;
    weapon.hitboxActive = false;
    weapon.phase = PlayerWeaponPhase.IDLE;
    weapon.hitbox?.setEnabled(false);
    requests.respawnRequested = false;
    requests.gameOverRequested = false;
    requests.gameOverReason = null;
  }

  private disposeRagdoll(ragdoll: unknown | null) {
    if (!ragdoll || typeof ragdoll !== 'object' || !('dispose' in ragdoll)) {
      return;
    }

    (ragdoll as { dispose(): void }).dispose();
  }
}
