import { type Vector3 } from '@babylonjs/core';
import type { EntityId } from '../core/Entity.ts';
import type { World } from '../core/World.ts';
import type { EnemyConfig } from './EnemySpawner.ts';
import {
  EnemyAiStateComponent,
  EnemyAttackStateComponent,
  EnemyIdentityComponent,
  EnemyLifecycleRequestComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyStatsComponent,
  EnemyUiPresentationComponent,
} from './components/index.ts';
import { EnemyLifeState } from './EnemyStateEnums.ts';

export class EnemyRuntimeFacade {
  constructor(
    private readonly world: World,
    private readonly entityId: EntityId,
  ) {}

  get mesh() {
    return this.getRefs()?.mesh ?? null;
  }

  get meshes() {
    return this.getRefs()?.meshes ?? [];
  }

  takeDamage(
    amount: number,
    damageSourcePosition?: Vector3 | null,
    impactPoint?: Vector3 | null,
  ): boolean {
    const requests = this.world.getComponent(
      this.entityId,
      EnemyLifecycleRequestComponent,
    );
    const stats = this.getStats();

    if (!requests || !stats || stats.lifeState !== EnemyLifeState.ALIVE) {
      return false;
    }

    requests.damageRequests.push({
      amount,
      damageSourcePosition: damageSourcePosition ?? null,
      impactPoint: impactPoint ?? null,
    });

    return true;
  }

  isAlive() {
    return this.getStats()?.lifeState === EnemyLifeState.ALIVE;
  }

  getState() {
    return this.world.getComponent(this.entityId, EnemyAiStateComponent)
      ?.current;
  }

  getPosition() {
    const refs = this.world.getComponent(
      this.entityId,
      EnemyPhysicsViewRefsComponent,
    );

    if (refs) {
      return refs.mesh.getAbsolutePosition().clone();
    }

    return null;
  }

  dispose() {
    const refs = this.getRefs();
    const attack = this.world.getComponent(
      this.entityId,
      EnemyAttackStateComponent,
    );

    attack?.hitbox?.dispose();
    refs?.debugVisionCircle?.dispose();
    refs?.physicsAggregate?.dispose();
    refs?.root.dispose();
    this.world.destroyEntity(this.entityId);
  }

  getEntityId() {
    return this.entityId;
  }

  getConfig(): Required<EnemyConfig> {
    const identity = this.getIdentity();
    const stats = this.getStats();
    const ui = this.getUiPresentation();

    return {
      attackCooldown: stats?.attackCooldown ?? 1.5,
      attackRange: stats?.attackRange ?? 2,
      chaseGiveUpRange: 14,
      chaseSpeed: stats?.chaseSpeed ?? 5,
      contactDamage: stats?.contactDamage ?? 1,
      debug: stats?.debugEnabled ?? false,
      displayName: identity?.displayName ?? 'Enemy',
      hp: stats?.maxHp ?? 3,
      knockbackForce: stats?.knockbackForce ?? 15,
      mass: stats?.mass ?? 2,
      modelOffsetY: -1.25,
      modelScale: 1.6,
      patrolSpeed: stats?.patrolSpeed ?? 2,
      stunDuration: stats?.stunDuration ?? 0.5,
      uiBaseScale: ui?.baseScale ?? 1,
      uiDamageRevealDuration: ui?.damageRevealDuration ?? 1.75,
      uiLinkOffsetY: ui?.linkOffsetY ?? -120,
      uiMaxVisibleDistance: ui?.maxVisibleDistance ?? 16,
      visionRange: stats?.visionRange ?? 8,
    };
  }

  private getStats() {
    return this.world.getComponent(this.entityId, EnemyStatsComponent);
  }

  private getRefs() {
    return this.world.getComponent(
      this.entityId,
      EnemyPhysicsViewRefsComponent,
    );
  }

  private getIdentity() {
    return this.world.getComponent(this.entityId, EnemyIdentityComponent);
  }

  private getUiPresentation() {
    return this.world.getComponent(this.entityId, EnemyUiPresentationComponent);
  }
}
