import { Vector3 } from '@babylonjs/core';
import { AudioManager } from '../../../AudioManager.ts';
import { EffectManager } from '../../../EffectManager.ts';
import { LegacyPlayerRefsComponent } from '../../components/LegacyPlayerRefsComponent.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { PlayerLocomotionMode } from '../PlayerStateEnums.ts';
import {
  PlayerCombatStateComponent,
  PlayerControlStateComponent,
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerWeaponStateComponent,
} from '../components/index.ts';
import { PlayerCombatMode, PlayerWeaponPhase } from '../PlayerStateEnums.ts';

export class PlayerDashSystem implements EcsSystem {
  readonly name = 'PlayerDashSystem';
  readonly order = 30;

  update(world: World, deltaTime: number): void {
    const entityIds = world.query(
      LegacyPlayerRefsComponent,
      PlayerControlStateComponent,
      PlayerCombatStateComponent,
      PlayerLocomotionStateComponent,
      PlayerPhysicsViewRefsComponent,
      PlayerWeaponStateComponent,
    );

    for (const entityId of entityIds) {
      const refs = world.getComponent(entityId, LegacyPlayerRefsComponent);
      const control = world.getComponent(entityId, PlayerControlStateComponent);
      const combat = world.getComponent(entityId, PlayerCombatStateComponent);
      const locomotion = world.getComponent(
        entityId,
        PlayerLocomotionStateComponent,
      );
      const physicsRefs = world.getComponent(
        entityId,
        PlayerPhysicsViewRefsComponent,
      );
      const weapon = world.getComponent(entityId, PlayerWeaponStateComponent);

      if (
        !refs ||
        !control ||
        !combat ||
        !locomotion ||
        !physicsRefs.body ||
        !weapon
      ) {
        continue;
      }

      locomotion.dashSpeed = refs.controller.dashSpeed;
      locomotion.dashDuration = refs.controller.dashDuration;
      locomotion.dashCooldown = refs.controller.dashCooldown;

      if (locomotion.dashCooldownTimer > 0) {
        locomotion.dashCooldownTimer = Math.max(
          0,
          locomotion.dashCooldownTimer - deltaTime,
        );
      }

      if (refs.controller.currentHealth <= 0) {
        locomotion.isDashing = false;
        control.dashRequested = false;
        this.cancelAttack(control, combat, weapon, refs);
        continue;
      }

      if (locomotion.isDashing) {
        const dashVelocity = new Vector3(
          locomotion.dashDirection.x * locomotion.dashSpeed,
          -10,
          locomotion.dashDirection.z * locomotion.dashSpeed,
        );

        physicsRefs.body.setLinearVelocity(dashVelocity);
        physicsRefs.body.setAngularVelocity(Vector3.Zero());
        locomotion.mode = PlayerLocomotionMode.DASHING;
        locomotion.dashTimer -= deltaTime;

        if (locomotion.dashTimer <= 0) {
          locomotion.isDashing = false;
          locomotion.dashTimer = 0;
          locomotion.targetScale = locomotion.originalScale.clone();
          const currentVelocity = physicsRefs.body.getLinearVelocity();
          physicsRefs.body.setLinearVelocity(
            new Vector3(0, currentVelocity.y, 0),
          );
        }

        control.dashRequested = false;
        continue;
      }

      if (
        control.dashRequested &&
        control.inputEnabled &&
        locomotion.dashCooldownTimer <= 0
      ) {
        const animationName = 'dash';
        if (refs.controller.animationGroups.get(animationName)) {
          refs.controller.playSmoothAnimation(animationName, false, true, 1.5);
        }

        const dashDirection = this.getMoveDirection(
          physicsRefs.camera,
          control.moveInputX,
          control.moveInputZ,
        );
        const resolvedDashDirection =
          dashDirection.length() > 0.1
            ? dashDirection.clone().normalize()
            : locomotion.lastFacingDirection.clone().normalize();

        locomotion.isDashing = true;
        locomotion.mode = PlayerLocomotionMode.DASHING;
        locomotion.dashTimer = locomotion.dashDuration;
        locomotion.dashCooldownTimer = locomotion.dashCooldown;
        locomotion.dashDirection =
          resolvedDashDirection.length() > 0
            ? resolvedDashDirection
            : new Vector3(0, 0, 1);
        locomotion.targetScale = new Vector3(0.7, 1.3, 0.7);

        this.cancelAttack(control, combat, weapon, refs);

        AudioManager.play('player_dash');
        EffectManager.showDust(physicsRefs.mesh.getAbsolutePosition(), {
          count: 30,
          duration: 0.3,
          direction: 'radial',
        });
      }

      control.dashRequested = false;
    }
  }

  private cancelAttack(
    control: PlayerControlStateComponent,
    combat: PlayerCombatStateComponent,
    weapon: PlayerWeaponStateComponent,
    refs: LegacyPlayerRefsComponent,
  ) {
    control.attackRequested = false;
    combat.attackQueue = [];
    combat.activeAttackAnimation = null;
    combat.activeAttackElapsed = 0;
    combat.activeAttackDuration = 0;
    combat.hitboxStartTime = 0;
    combat.hitboxEndTime = 0;
    combat.isAttacking = false;
    combat.mode = combat.isDancing
      ? PlayerCombatMode.DANCING
      : PlayerCombatMode.IDLE;
    weapon.phase =
      weapon.cooldownTimer > 0
        ? PlayerWeaponPhase.COOLDOWN
        : PlayerWeaponPhase.IDLE;
    weapon.hitboxActive = false;
    weapon.hitEnemiesThisSwing.clear();
    weapon.hitEnemiesThisSwingCount = 0;
    weapon.weaponSystem?.deactivateHitbox();
  }

  private getMoveDirection(
    camera: PlayerPhysicsViewRefsComponent['camera'],
    moveInputX: number,
    moveInputZ: number,
  ) {
    if (!camera) {
      return Vector3.Zero();
    }

    const forward = camera.getDirection(Vector3.Forward());
    const right = camera.getDirection(Vector3.Right());

    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    const direction = Vector3.Zero();
    direction.addInPlace(forward.scale(moveInputZ));
    direction.addInPlace(right.scale(moveInputX));

    if (direction.length() > 0) {
      direction.normalize();
    }

    return direction;
  }
}
