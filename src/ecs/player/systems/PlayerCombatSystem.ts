import { Quaternion, Vector3 } from '@babylonjs/core';
import { AudioManager } from '../../../AudioManager.ts';
import { LegacyPlayerRefsComponent } from '../../components/LegacyPlayerRefsComponent.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  PlayerCombatMode,
  PlayerLifeState,
  PlayerWeaponPhase,
} from '../PlayerStateEnums.ts';
import {
  PlayerAnimationStateComponent,
  PlayerCombatStateComponent,
  PlayerControlStateComponent,
  PlayerGroundingStateComponent,
  PlayerHealthStateComponent,
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerWeaponStateComponent,
} from '../components/index.ts';

export class PlayerCombatSystem implements EcsSystem {
  readonly name = 'PlayerCombatSystem';
  readonly order = 25;

  update(world: World, deltaTime: number): void {
    const entityIds = world.query(
      LegacyPlayerRefsComponent,
      PlayerAnimationStateComponent,
      PlayerCombatStateComponent,
      PlayerControlStateComponent,
      PlayerGroundingStateComponent,
      PlayerHealthStateComponent,
      PlayerLocomotionStateComponent,
      PlayerPhysicsViewRefsComponent,
      PlayerWeaponStateComponent,
    );

    for (const entityId of entityIds) {
      const refs = world.getComponent(entityId, LegacyPlayerRefsComponent);
      const animation = world.getComponent(
        entityId,
        PlayerAnimationStateComponent,
      );
      const combat = world.getComponent(entityId, PlayerCombatStateComponent);
      const control = world.getComponent(entityId, PlayerControlStateComponent);
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
      const weapon = world.getComponent(entityId, PlayerWeaponStateComponent);

      if (
        !refs ||
        !animation ||
        !combat ||
        !control ||
        !grounding ||
        !health ||
        !locomotion ||
        !physicsRefs.body ||
        !weapon
      ) {
        continue;
      }

      weapon.damage = weapon.weaponSystem?.damage ?? weapon.damage;
      weapon.attackDuration =
        weapon.weaponSystem?.attackDuration ?? weapon.attackDuration;
      weapon.attackCooldown =
        weapon.weaponSystem?.attackCooldown ?? weapon.attackCooldown;
      weapon.hitboxOffset =
        weapon.weaponSystem?.hitboxOffset ?? weapon.hitboxOffset;
      weapon.hitboxSize =
        weapon.weaponSystem?.hitboxSize?.clone() ?? weapon.hitboxSize;
      weapon.playerKnockback =
        weapon.weaponSystem?.playerKnockback ?? weapon.playerKnockback;
      weapon.registeredEnemyCount = weapon.weaponSystem?.enemies?.length ?? 0;

      if (weapon.cooldownTimer > 0) {
        weapon.cooldownTimer = Math.max(0, weapon.cooldownTimer - deltaTime);
      }

      if (health.lifeState !== PlayerLifeState.ALIVE) {
        this.endAttack(combat, weapon, refs, true);
        control.attackRequested = false;
        continue;
      }

      if (control.attackRequested) {
        this.queueAttack(combat, grounding.isGrounded);
        control.attackRequested = false;
      }

      if (locomotion.isDashing) {
        continue;
      }

      if (!combat.isAttacking) {
        if (weapon.cooldownTimer <= 0 && combat.attackQueue.length > 0) {
          this.startQueuedAttack(
            combat,
            animation,
            locomotion,
            physicsRefs,
            weapon,
            refs,
          );
        }

        continue;
      }

      combat.activeAttackElapsed += deltaTime;

      const shouldActivateHitbox =
        !weapon.hitboxActive &&
        combat.activeAttackElapsed >= combat.hitboxStartTime &&
        combat.activeAttackElapsed < combat.hitboxEndTime;

      if (shouldActivateHitbox) {
        weapon.hitboxActive = true;
        weapon.phase = PlayerWeaponPhase.ATTACKING;
        weapon.hitEnemiesThisSwing.clear();
        weapon.hitEnemiesThisSwingCount = 0;
        weapon.weaponSystem?.activateHitbox();
      }

      const shouldDeactivateHitbox =
        weapon.hitboxActive &&
        combat.activeAttackElapsed >= combat.hitboxEndTime;

      if (shouldDeactivateHitbox) {
        weapon.hitboxActive = false;
        weapon.weaponSystem?.deactivateHitbox();
        weapon.phase = PlayerWeaponPhase.IDLE;
      }

      if (combat.activeAttackElapsed >= combat.activeAttackDuration) {
        this.endAttack(combat, weapon, refs, false);
      }
    }
  }

  private queueAttack(combat: PlayerCombatStateComponent, isGrounded: boolean) {
    if (combat.attackQueue.length >= combat.maxAttackQueue) {
      return;
    }

    if (!isGrounded) {
      combat.attackQueue.push('flying_kick');
      return;
    }

    const attackAnimation = combat.useLeftPunch ? 'punch_L' : 'punch_R';
    combat.useLeftPunch = !combat.useLeftPunch;
    combat.attackQueue.push(attackAnimation);
  }

  private startQueuedAttack(
    combat: PlayerCombatStateComponent,
    animation: PlayerAnimationStateComponent,
    locomotion: PlayerLocomotionStateComponent,
    physicsRefs: PlayerPhysicsViewRefsComponent,
    weapon: PlayerWeaponStateComponent,
    refs: LegacyPlayerRefsComponent,
  ) {
    const nextAttack = combat.attackQueue.shift() ?? null;

    if (!nextAttack) {
      return;
    }

    const animationGroup = animation.animationGroups.get(nextAttack);

    if (!animationGroup) {
      refs.controller.returnToIdleOrRun();
      return;
    }

    this.applyAutoAim(
      nextAttack,
      animation,
      locomotion,
      physicsRefs,
      combat,
      weapon,
    );

    AudioManager.play('player_punch');
    refs.controller.playSmoothAnimation(
      nextAttack,
      false,
      true,
      combat.punchSpeed,
    );

    const frameRate =
      animationGroup.targetedAnimations[0]?.animation.framePerSecond || 30;
    const baseDuration = (animationGroup.to - animationGroup.from) / frameRate;
    const attackDuration = baseDuration / combat.punchSpeed;
    const hitboxStartTime = attackDuration * combat.punchHitboxDelay;
    const hitboxEndTime = Math.min(
      attackDuration,
      hitboxStartTime + weapon.attackDuration,
    );

    combat.mode = PlayerCombatMode.ATTACKING;
    combat.isAttacking = true;
    combat.activeAttackAnimation = nextAttack;
    combat.activeAttackElapsed = 0;
    combat.activeAttackDuration = attackDuration;
    combat.hitboxStartTime = hitboxStartTime;
    combat.hitboxEndTime = hitboxEndTime;

    weapon.phase = PlayerWeaponPhase.IDLE;
    weapon.hitboxActive = false;
    weapon.hitEnemiesThisSwing.clear();
    weapon.hitEnemiesThisSwingCount = 0;
  }

  private applyAutoAim(
    attackAnimation: string,
    animation: PlayerAnimationStateComponent,
    locomotion: PlayerLocomotionStateComponent,
    physicsRefs: PlayerPhysicsViewRefsComponent,
    combat: PlayerCombatStateComponent,
    weapon: PlayerWeaponStateComponent,
  ) {
    const target = this.getClosestAliveEnemy(
      weapon.weaponSystem?.enemies ?? [],
      physicsRefs.mesh.getAbsolutePosition(),
      combat.magnetismRange,
    );

    if (!target) {
      return;
    }

    const playerPos = physicsRefs.mesh.getAbsolutePosition();
    const enemyPos = target.getPosition();
    const direction = enemyPos.subtract(playerPos);
    direction.y = 0;

    const distance = direction.length();

    if (distance <= 0.01) {
      return;
    }

    direction.normalize();
    const angle = Math.atan2(direction.x, direction.z);
    locomotion.targetRotation = Quaternion.FromEulerAngles(0, angle, 0);
    locomotion.lastFacingDirection = direction.clone();

    const animationEntry =
      animation.animationRegistry[
        attackAnimation as keyof typeof animation.animationRegistry
      ];
    const modelRoot = animationEntry?.root;
    if (modelRoot) {
      if (!modelRoot.rotationQuaternion) {
        modelRoot.rotationQuaternion = locomotion.targetRotation.clone();
      }
      modelRoot.rotationQuaternion.copyFrom(locomotion.targetRotation);
    }

    const currentVelocity = physicsRefs.body.getLinearVelocity();
    physicsRefs.body.setLinearVelocity(
      new Vector3(
        direction.x * combat.magnetismLungeSpeed,
        currentVelocity.y,
        direction.z * combat.magnetismLungeSpeed,
      ),
    );
  }

  private getClosestAliveEnemy(
    enemies: any[],
    playerPosition: { x: number; z: number },
    maxRange: number,
  ) {
    let closestEnemy: any | null = null;
    let closestDistance = maxRange;

    for (const enemy of enemies) {
      if (!enemy?.isAlive?.()) {
        continue;
      }

      const enemyPosition = enemy.getPosition();
      const dx = enemyPosition.x - playerPosition.x;
      const dz = enemyPosition.z - playerPosition.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance > closestDistance) {
        continue;
      }

      closestDistance = distance;
      closestEnemy = enemy;
    }

    return closestEnemy;
  }

  private endAttack(
    combat: PlayerCombatStateComponent,
    weapon: PlayerWeaponStateComponent,
    refs: LegacyPlayerRefsComponent,
    preserveCooldown: boolean,
  ) {
    combat.activeAttackAnimation = null;
    combat.activeAttackElapsed = 0;
    combat.activeAttackDuration = 0;
    combat.hitboxStartTime = 0;
    combat.hitboxEndTime = 0;
    combat.isAttacking = false;
    combat.mode = combat.isDancing
      ? PlayerCombatMode.DANCING
      : PlayerCombatMode.IDLE;

    weapon.hitboxActive = false;
    weapon.hitEnemiesThisSwing.clear();
    weapon.hitEnemiesThisSwingCount = 0;
    weapon.weaponSystem?.deactivateHitbox();

    if (!preserveCooldown) {
      weapon.cooldownTimer = weapon.attackCooldown;
    }

    weapon.phase =
      weapon.cooldownTimer > 0
        ? PlayerWeaponPhase.COOLDOWN
        : PlayerWeaponPhase.IDLE;

    if (combat.attackQueue.length === 0) {
      refs.controller.returnToIdleOrRun();
    }
  }
}
