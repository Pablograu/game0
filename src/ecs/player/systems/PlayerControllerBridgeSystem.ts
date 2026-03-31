import { LegacyPlayerRefsComponent } from '../../components/LegacyPlayerRefsComponent.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { PlayerJumpPhaseState } from '../PlayerStateEnums.ts';
import {
  PlayerCombatStateComponent,
  PlayerControlStateComponent,
  PlayerGroundingStateComponent,
  PlayerLocomotionStateComponent,
  PlayerWeaponStateComponent,
} from '../components/index.ts';

interface PlayerEcsBridgeSnapshot {
  jumpPhase: string;
  airTime: number;
  minAirTime: number;
  fallingAnimDelay: number;
  groundLostTimer: number;
  groundLostGrace: number;
}

export class PlayerControllerBridgeSystem implements EcsSystem {
  readonly name = 'PlayerControllerBridgeSystem';
  readonly order = 60;

  update(world: World, deltaTime: number): void {
    const entityIds = world.query(
      LegacyPlayerRefsComponent,
      PlayerControlStateComponent,
      PlayerCombatStateComponent,
      PlayerGroundingStateComponent,
      PlayerLocomotionStateComponent,
      PlayerWeaponStateComponent,
    );

    for (const entityId of entityIds) {
      const refs = world.getComponent(entityId, LegacyPlayerRefsComponent);
      const control = world.getComponent(entityId, PlayerControlStateComponent);
      const combat = world.getComponent(entityId, PlayerCombatStateComponent);
      const grounding = world.getComponent(
        entityId,
        PlayerGroundingStateComponent,
      );
      const locomotion = world.getComponent(
        entityId,
        PlayerLocomotionStateComponent,
      );
      const weapon = world.getComponent(entityId, PlayerWeaponStateComponent);

      if (
        !refs ||
        !control ||
        !combat ||
        !grounding ||
        !locomotion ||
        !weapon
      ) {
        continue;
      }

      const controller = refs.controller;
      controller.inputEnabled = control.inputEnabled;
      controller.inputMap = { ...control.inputMap };
      controller.jumpKeyReleased = control.jumpKeyReleased;
      controller.jumpBufferTimer = grounding.jumpBufferTimer;
      controller.jumpBufferTime = grounding.jumpBufferTime;
      controller.isGrounded = grounding.isGrounded;
      controller.wasGrounded = grounding.wasGrounded;
      controller.coyoteTimer = grounding.coyoteTimer;
      controller.coyoteTime = grounding.coyoteTime;
      controller.isDashing = locomotion.isDashing;
      controller.isMoving = locomotion.isMoving;
      controller.dashDirection = locomotion.dashDirection.clone();
      controller.dashTimer = locomotion.dashTimer;
      controller.dashCooldownTimer = locomotion.dashCooldownTimer;
      controller.lastFacingDirection = locomotion.lastFacingDirection.clone();
      controller.targetRotation = locomotion.targetRotation.clone();
      controller.targetScale = locomotion.targetScale.clone();
      controller.recoilVelocity = locomotion.recoilVelocity.clone();
      controller.syncEcsCombatState({
        isAttacking: combat.isAttacking,
        isDancing: combat.isDancing,
        useLeftPunch: combat.useLeftPunch,
        punchSpeed: combat.punchSpeed,
        attackMoveSpeedMultiplier: combat.attackMoveSpeedMultiplier,
        punchHitboxDelay: combat.punchHitboxDelay,
        magnetismRange: combat.magnetismRange,
        magnetismLungeSpeed: combat.magnetismLungeSpeed,
        attackQueue: combat.attackQueue,
      });
      controller.applyEcsBridgeSnapshot({
        jumpPhase: grounding.jumpPhase,
        airTime: grounding.airTime,
        groundLostTimer: grounding.groundLostTimer,
      });

      if (weapon.weaponSystem) {
        weapon.weaponSystem.damage = weapon.damage;
        weapon.weaponSystem.attackDuration = weapon.attackDuration;
        weapon.weaponSystem.attackCooldown = weapon.attackCooldown;
        weapon.weaponSystem.cooldownTimer = weapon.cooldownTimer;
        weapon.weaponSystem.attackTimer = weapon.hitboxActive
          ? Math.max(0, combat.hitboxEndTime - combat.activeAttackElapsed)
          : 0;
        weapon.weaponSystem.isAttacking = weapon.hitboxActive;
        weapon.weaponSystem.hitEnemiesThisSwing = new Set(
          weapon.hitEnemiesThisSwing,
        );
      }

      controller.runLegacyPostEcsUpdate(locomotion.moveDirection, deltaTime);

      const snapshot =
        controller.getEcsBridgeSnapshot() as PlayerEcsBridgeSnapshot;
      grounding.jumpPhase = snapshot.jumpPhase as PlayerJumpPhaseState;
      grounding.airTime = snapshot.airTime;
      grounding.minAirTime = snapshot.minAirTime;
      grounding.fallingAnimDelay = snapshot.fallingAnimDelay;
      grounding.groundLostTimer = snapshot.groundLostTimer;
      grounding.groundLostGrace = snapshot.groundLostGrace;
      control.jumpKeyReleased = controller.jumpKeyReleased;
    }
  }
}
