import { AudioManager } from '../../../AudioManager.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  EnemyAiStateComponent,
  EnemyAnimationStateComponent,
  EnemyAttackStateComponent,
  EnemyCombatStateComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyStatsComponent,
} from '../components/index.ts';
import { EnemyBehaviorState, EnemyLifeState } from '../EnemyStateEnums.ts';
import {
  getEnemyAnimationDuration,
  getEnemyForwardDirection,
  isEnemyGameplayPaused,
  queueDamageToPlayer,
  resolveEnemyPlayerCombatContext,
  transitionEnemyBehavior,
} from './enemyRuntimeUtils.ts';

export class EnemyAttackSystem implements EcsSystem {
  readonly name = 'EnemyAttackSystem';
  readonly order = 17;

  update(world: World, deltaTime: number): void {
    if (isEnemyGameplayPaused(world)) {
      return;
    }

    const player = resolveEnemyPlayerCombatContext(world);

    const entityIds = world.query(
      EnemyAiStateComponent,
      EnemyAnimationStateComponent,
      EnemyAttackStateComponent,
      EnemyCombatStateComponent,
      EnemyPhysicsViewRefsComponent,
      EnemyStatsComponent,
    );

    for (const entityId of entityIds) {
      const ai = world.getComponent(entityId, EnemyAiStateComponent);
      const animation = world.getComponent(
        entityId,
        EnemyAnimationStateComponent,
      );
      const attack = world.getComponent(entityId, EnemyAttackStateComponent);
      const combat = world.getComponent(entityId, EnemyCombatStateComponent);
      const refs = world.getComponent(entityId, EnemyPhysicsViewRefsComponent);
      const stats = world.getComponent(entityId, EnemyStatsComponent);

      if (!ai || !animation || !attack || !combat || !refs || !stats) {
        continue;
      }

      if (ai.current !== EnemyBehaviorState.ATTACK || !player) {
        this.stopAttack(attack);
        continue;
      }

      if (stats.lifeState !== EnemyLifeState.ALIVE) {
        this.stopAttack(attack);
        continue;
      }

      if (!attack.attackInProgress) {
        attack.attackInProgress = true;
        attack.attackElapsedTime = 0;
        attack.hasHitPlayerThisAttack = false;
        attack.hitboxActive = false;
        attack.hitbox?.setEnabled(false);
        attack.attackDuration = Math.max(
          getEnemyAnimationDuration(
            animation,
            'attack',
            attack.attackAnimationSpeed,
          ),
          0.4,
        );
        AudioManager.play('enemy_attack');
      }

      attack.attackElapsedTime += deltaTime;

      if (
        !attack.hitboxActive &&
        attack.attackElapsedTime >= attack.hitboxActivationDelay
      ) {
        attack.hitbox?.setEnabled(true);
        attack.hitboxActive = true;
      }

      if (attack.hitboxActive && attack.hitbox) {
        const forwardDirection = getEnemyForwardDirection(refs);
        attack.hitbox.setPosition(
          refs.mesh.position,
          attack.hitboxOffsetDistance,
          forwardDirection,
        );
        attack.hitbox.setRotation(refs.root.rotationQuaternion);

        if (!attack.hasHitPlayerThisAttack) {
          if (attack.hitbox.intersectsMesh(player.physicsRefs.mesh, false)) {
            attack.hasHitPlayerThisAttack = true;
            queueDamageToPlayer(
              player,
              stats.contactDamage,
              refs.mesh.getAbsolutePosition(),
            );
          }
        }
      }

      if (attack.attackElapsedTime < attack.attackDuration) {
        continue;
      }

      this.stopAttack(attack);
      combat.attackCooldownTimer = stats.attackCooldown;
      transitionEnemyBehavior(ai, combat, EnemyBehaviorState.CHASE);
    }
  }

  private stopAttack(attack: EnemyAttackStateComponent) {
    attack.attackInProgress = false;
    attack.attackElapsedTime = 0;
    attack.attackDuration = 0;
    attack.hitboxActive = false;
    attack.hitbox?.setEnabled(false);
  }
}
