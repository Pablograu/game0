import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  type Vector3,
} from '@babylonjs/core';
import type { EntityId } from '../core/Entity.ts';
import type { World } from '../core/World.ts';
import type { EnemyConfig } from './EnemySpawner.ts';
import {
  EnemyAiStateComponent,
  EnemyAttackStateComponent,
  EnemyCombatStateComponent,
  EnemyLifecycleRequestComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyStatsComponent,
} from './components/index.ts';
import { EnemyBehaviorState, EnemyLifeState } from './EnemyStateEnums.ts';

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

  get hp() {
    return this.getStats()?.currentHp ?? 0;
  }

  get maxHP() {
    return this.getStats()?.maxHp ?? 0;
  }

  get patrolSpeed() {
    return this.getStats()?.patrolSpeed ?? 0;
  }

  set patrolSpeed(value: number) {
    const stats = this.getStats();
    if (stats) {
      stats.patrolSpeed = value;
    }
  }

  get chaseSpeed() {
    return this.getStats()?.chaseSpeed ?? 0;
  }

  set chaseSpeed(value: number) {
    const stats = this.getStats();
    if (stats) {
      stats.chaseSpeed = value;
    }
  }

  get visionRange() {
    return this.getStats()?.visionRange ?? 0;
  }

  set visionRange(value: number) {
    this.setVisionRange(value);
  }

  get debugMode() {
    return this.getStats()?.debugEnabled ?? false;
  }

  set debugMode(value: boolean) {
    this.setDebugMode(value);
  }

  takeDamage(amount: number, damageSourcePosition?: Vector3 | null): boolean {
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

  enableUpdate() {
    const combat = this.world.getComponent(
      this.entityId,
      EnemyCombatStateComponent,
    );
    if (combat) {
      combat.updatesEnabled = true;
    }
  }

  disableUpdate() {
    const combat = this.world.getComponent(
      this.entityId,
      EnemyCombatStateComponent,
    );
    if (combat) {
      combat.updatesEnabled = false;
    }
  }

  setVisionRange(range: number) {
    const stats = this.getStats();
    if (stats) {
      stats.visionRange = range;
    }
    this.syncDebugVisionCircle();
  }

  setDebugMode(enabled: boolean) {
    const stats = this.getStats();
    if (stats) {
      stats.debugEnabled = enabled;
    }

    const attack = this.world.getComponent(
      this.entityId,
      EnemyAttackStateComponent,
    );
    attack?.hitbox?.setDebugMode(enabled);
    this.syncDebugVisionCircle();
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
    const stats = this.getStats();

    return {
      attackCooldown: stats?.attackCooldown ?? 1.5,
      attackRange: stats?.attackRange ?? 2,
      chaseGiveUpRange: 14,
      chaseSpeed: stats?.chaseSpeed ?? 5,
      contactDamage: stats?.contactDamage ?? 1,
      debug: stats?.debugEnabled ?? false,
      hp: stats?.maxHp ?? 3,
      knockbackForce: stats?.knockbackForce ?? 15,
      mass: stats?.mass ?? 2,
      modelOffsetY: -1.25,
      modelScale: 1.6,
      patrolSpeed: stats?.patrolSpeed ?? 2,
      stunDuration: stats?.stunDuration ?? 0.5,
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

  private syncDebugVisionCircle() {
    const refs = this.getRefs();
    const stats = this.getStats();

    if (!refs || !stats) {
      return;
    }

    if (refs.debugVisionCircle) {
      refs.debugVisionCircle.dispose();
      refs.debugVisionCircle = null;
    }

    if (!stats.debugEnabled) {
      return;
    }

    const circle = MeshBuilder.CreateDisc(
      `visionRange_${this.entityId}`,
      { radius: stats.visionRange, tessellation: 32 },
      refs.scene,
    );
    const material = new StandardMaterial(
      `visionMat_${this.entityId}`,
      refs.scene,
    );

    material.diffuseColor = new Color3(1, 1, 0);
    material.alpha = 0.15;
    material.backFaceCulling = false;

    circle.material = material;
    circle.rotation.x = Math.PI / 2;
    circle.position.y = 0.05;
    circle.parent = refs.mesh;
    circle.isPickable = false;
    circle.checkCollisions = false;
    refs.debugVisionCircle = circle;
  }
}
