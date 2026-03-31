import type { Vector3 } from '@babylonjs/core';
import type { EnemyConfig, EnemyController } from '../../EnemyController.ts';
import type { PlayerCombatTargetApi } from '../../player/PlayerFacade.ts';
import type { EntityId } from '../core/Entity.ts';
import type { World } from '../core/World.ts';
import {
  EnemyCombatStateComponent,
  EnemyLifecycleRequestComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyStatsComponent,
} from './components/index.ts';
import { EnemyLifeState } from './EnemyStateEnums.ts';

export class EnemyRuntimeFacade {
  constructor(
    private readonly world: World,
    private readonly entityId: EntityId,
    private readonly controller: EnemyController,
  ) {}

  get mesh() {
    return this.controller.mesh;
  }

  get meshes() {
    return this.controller.meshes;
  }

  get hp() {
    return this.getStats()?.currentHp ?? 0;
  }

  get maxHP() {
    return this.getStats()?.maxHp ?? 0;
  }

  get patrolSpeed() {
    return this.getStats()?.patrolSpeed ?? this.controller.patrolSpeed;
  }

  set patrolSpeed(value: number) {
    const stats = this.getStats();
    if (stats) {
      stats.patrolSpeed = value;
    }
    this.controller.patrolSpeed = value;
  }

  get chaseSpeed() {
    return this.getStats()?.chaseSpeed ?? this.controller.chaseSpeed;
  }

  set chaseSpeed(value: number) {
    const stats = this.getStats();
    if (stats) {
      stats.chaseSpeed = value;
    }
    this.controller.chaseSpeed = value;
  }

  get visionRange() {
    return this.getStats()?.visionRange ?? this.controller.visionRange;
  }

  set visionRange(value: number) {
    this.setVisionRange(value);
  }

  get debugMode() {
    return this.getStats()?.debugEnabled ?? this.controller.debugMode;
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

  setPlayerTarget(player: PlayerCombatTargetApi | null) {
    const refs = this.world.getComponent(
      this.entityId,
      EnemyPhysicsViewRefsComponent,
    );
    if (refs) {
      refs.playerTarget = player;
    }
    this.controller.setPlayerTarget(player);
  }

  setPlayerRef(player: PlayerCombatTargetApi | null) {
    this.setPlayerTarget(player);
  }

  isAlive() {
    return this.getStats()?.lifeState === EnemyLifeState.ALIVE;
  }

  getState() {
    return this.controller.getState();
  }

  getPosition() {
    const refs = this.world.getComponent(
      this.entityId,
      EnemyPhysicsViewRefsComponent,
    );

    if (refs) {
      return refs.mesh.getAbsolutePosition().clone();
    }

    return this.controller.getPosition();
  }

  enableUpdate() {
    const combat = this.world.getComponent(
      this.entityId,
      EnemyCombatStateComponent,
    );
    if (combat) {
      combat.updatesEnabled = true;
    }
    this.controller.enableUpdate();
  }

  disableUpdate() {
    const combat = this.world.getComponent(
      this.entityId,
      EnemyCombatStateComponent,
    );
    if (combat) {
      combat.updatesEnabled = false;
    }
    this.controller.disableUpdate();
  }

  setVisionRange(range: number) {
    const stats = this.getStats();
    if (stats) {
      stats.visionRange = range;
    }
    this.controller.setVisionRange(range);
  }

  setDebugMode(enabled: boolean) {
    const stats = this.getStats();
    if (stats) {
      stats.debugEnabled = enabled;
    }
    this.controller.setDebugMode(enabled);
  }

  dispose() {
    this.controller.dispose();
  }

  getEntityId() {
    return this.entityId;
  }

  getController() {
    return this.controller;
  }

  getConfig(): Required<EnemyConfig> {
    return this.controller.config;
  }

  private getStats() {
    return this.world.getComponent(this.entityId, EnemyStatsComponent);
  }
}
