import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  EnemyAiStateComponent,
  EnemyAnimationStateComponent,
  EnemyAttackStateComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyStatsComponent,
} from '../components/index.ts';
import { EnemyBehaviorState, EnemyLifeState } from '../EnemyStateEnums.ts';
import {
  findEnemyAnimationGroup,
  isEnemyGameplayPaused,
} from './enemyRuntimeUtils.ts';

export class EnemyAnimationSystem implements EcsSystem {
  readonly name = 'EnemyAnimationSystem';
  readonly order = 21;

  update(world: World): void {
    const paused = isEnemyGameplayPaused(world);
    const entityIds = world.query(
      EnemyAiStateComponent,
      EnemyAnimationStateComponent,
      EnemyAttackStateComponent,
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
      const refs = world.getComponent(entityId, EnemyPhysicsViewRefsComponent);
      const stats = world.getComponent(entityId, EnemyStatsComponent);

      if (!ai || !animation || !attack || !refs || !stats) {
        continue;
      }

      if (
        stats.lifeState !== EnemyLifeState.ALIVE ||
        ai.current === EnemyBehaviorState.DEAD
      ) {
        for (const [, group] of animation.animationGroups) {
          if (group.isPlaying) {
            group.stop();
          }
        }
        animation.currentAnimation = 'dead';
        continue;
      }

      const playback = this.resolvePlayback(ai.current, attack);

      if (paused) {
        for (const [, group] of animation.animationGroups) {
          if (group.isPlaying) {
            group.speedRatio = 0;
          }
        }
        continue;
      }

      console.log('animation', animation);
      console.log('playback.name', playback.name);

      this.playAnimation(
        animation,
        playback.name,
        playback.loop,
        playback.speedRatio,
      );
    }
  }

  private resolvePlayback(
    behaviorState: EnemyBehaviorState,
    attack: EnemyAttackStateComponent,
  ) {
    switch (behaviorState) {
      case EnemyBehaviorState.ATTACK:
        return {
          name: 'attack',
          loop: false,
          speedRatio: attack.attackAnimationSpeed,
        };
      case EnemyBehaviorState.HIT:
        return { name: 'hit', loop: false, speedRatio: 1 };
      case EnemyBehaviorState.CHASE:
        return { name: 'running', loop: true, speedRatio: 1 };
      case EnemyBehaviorState.PATROL:
        return { name: 'walking', loop: true, speedRatio: 1 };
      default:
        return { name: 'idle', loop: true, speedRatio: 1 };
    }
  }

  private playAnimation(
    animation: EnemyAnimationStateComponent,
    name: string,
    loop: boolean,
    speedRatio: number,
  ) {
    const animationGroup = findEnemyAnimationGroup(animation, name);
    if (!animationGroup) {
      return;
    }

    if (
      animation.currentAnimation !== name ||
      (!animationGroup.isPlaying && animation.currentAnimation !== name)
    ) {
      for (const [otherName, otherGroup] of animation.animationGroups) {
        if (
          otherName !== animationGroup.name.toLowerCase() &&
          otherGroup.isPlaying
        ) {
          otherGroup.stop();
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

    if (
      !loop &&
      animation.currentAnimation === name &&
      !animationGroup.isPlaying
    ) {
      return;
    }

    animationGroup.speedRatio = speedRatio;
  }
}
