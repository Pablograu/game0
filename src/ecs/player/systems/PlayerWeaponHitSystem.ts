import { Matrix, Quaternion, Vector3 } from '@babylonjs/core';
import { AudioManager } from '../../../AudioManager.ts';
import {
  EnemyLifecycleRequestComponent,
  EnemyPhysicsViewRefsComponent,
  EnemyStatsComponent,
} from '../../enemy/components/index.ts';
import { EnemyLifeState } from '../../enemy/EnemyStateEnums.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerWeaponStateComponent,
} from '../components/index.ts';

export class PlayerWeaponHitSystem implements EcsSystem {
  readonly name = 'PlayerWeaponHitSystem';
  readonly order = 55;

  update(world: World): void {
    const entityIds = world.query(
      PlayerLocomotionStateComponent,
      PlayerPhysicsViewRefsComponent,
      PlayerWeaponStateComponent,
    );

    for (const entityId of entityIds) {
      const locomotion = world.getComponent(
        entityId,
        PlayerLocomotionStateComponent,
      );
      const physicsRefs = world.getComponent(
        entityId,
        PlayerPhysicsViewRefsComponent,
      );
      const weapon = world.getComponent(entityId, PlayerWeaponStateComponent);

      if (!locomotion || !physicsRefs.mesh || !weapon?.hitbox) {
        continue;
      }

      const hitboxSystem = weapon.hitbox;

      if (!hitboxSystem || !weapon.hitboxActive) {
        continue;
      }

      const rotation = this.resolveRotation(locomotion);
      const forwardDirection = this.resolveForwardDirection(rotation);
      const playerPosition = physicsRefs.mesh.getAbsolutePosition();

      hitboxSystem.setPosition(
        new Vector3(playerPosition.x, playerPosition.y + 1, playerPosition.z),
        weapon.hitboxOffset,
        forwardDirection,
      );
      hitboxSystem.setRotation(rotation);

      const enemyIds = world.query(
        EnemyLifecycleRequestComponent,
        EnemyPhysicsViewRefsComponent,
        EnemyStatsComponent,
      );
      weapon.registeredEnemyCount = enemyIds.length;

      for (const enemyId of enemyIds) {
        const enemyRefs = world.getComponent(
          enemyId,
          EnemyPhysicsViewRefsComponent,
        );
        const enemyStats = world.getComponent(enemyId, EnemyStatsComponent);
        const enemyLifecycle = world.getComponent(
          enemyId,
          EnemyLifecycleRequestComponent,
        );

        if (
          !enemyRefs ||
          !enemyStats ||
          !enemyLifecycle ||
          enemyStats.lifeState !== EnemyLifeState.ALIVE
        ) {
          continue;
        }

        if (weapon.hitEnemiesThisSwing.has(enemyId)) {
          continue;
        }

        if (!hitboxSystem.intersectsMesh(enemyRefs.mesh, false)) {
          continue;
        }

        weapon.hitEnemiesThisSwing.add(enemyId);
        weapon.hitEnemiesThisSwingCount = weapon.hitEnemiesThisSwing.size;

        AudioManager.play('player_punch');

        enemyLifecycle.damageRequests.push({
          amount: weapon.damage,
          damageSourcePosition: physicsRefs.mesh.getAbsolutePosition().clone(),
          impactPoint: enemyRefs.mesh.getAbsolutePosition().clone(),
        });

        physicsRefs.cameraShaker?.shakeMedium();
      }
    }
  }

  private resolveRotation(locomotion: PlayerLocomotionStateComponent) {
    if (locomotion.targetRotation) {
      return locomotion.targetRotation.clone();
    }

    const direction = locomotion.lastFacingDirection.clone();
    direction.y = 0;

    if (direction.length() <= 0.01) {
      return Quaternion.Identity();
    }

    direction.normalize();
    return Quaternion.FromEulerAngles(
      0,
      Math.atan2(direction.x, direction.z),
      0,
    );
  }

  private resolveForwardDirection(rotation: Quaternion) {
    const rotationMatrix = new Matrix();
    rotation.toRotationMatrix(rotationMatrix);
    return Vector3.TransformCoordinates(new Vector3(0, 0, 1), rotationMatrix);
  }
}
