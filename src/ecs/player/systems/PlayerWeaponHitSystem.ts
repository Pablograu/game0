import { Matrix, Quaternion, Vector3 } from '@babylonjs/core';
import { AudioManager } from '../../../AudioManager.ts';
import { LegacyPlayerRefsComponent } from '../../components/LegacyPlayerRefsComponent.ts';
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
      LegacyPlayerRefsComponent,
      PlayerLocomotionStateComponent,
      PlayerPhysicsViewRefsComponent,
      PlayerWeaponStateComponent,
    );

    for (const entityId of entityIds) {
      const refs = world.getComponent(entityId, LegacyPlayerRefsComponent);
      const locomotion = world.getComponent(
        entityId,
        PlayerLocomotionStateComponent,
      );
      const physicsRefs = world.getComponent(
        entityId,
        PlayerPhysicsViewRefsComponent,
      );
      const weapon = world.getComponent(entityId, PlayerWeaponStateComponent);

      if (!refs || !locomotion || !physicsRefs.mesh || !weapon?.weaponSystem) {
        continue;
      }

      const hitboxSystem = weapon.weaponSystem.hitboxSystem;

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

      const enemies = weapon.weaponSystem.enemies ?? [];
      weapon.registeredEnemyCount = enemies.length;

      for (const enemy of enemies) {
        if (!enemy?.mesh || !enemy?.isAlive?.()) {
          continue;
        }

        if (weapon.hitEnemiesThisSwing.has(enemy)) {
          continue;
        }

        if (!hitboxSystem.intersectsMesh(enemy.mesh, false)) {
          continue;
        }

        weapon.hitEnemiesThisSwing.add(enemy);
        weapon.hitEnemiesThisSwingCount = weapon.hitEnemiesThisSwing.size;

        AudioManager.play('player_punch');

        if (enemy.takeDamage) {
          enemy.takeDamage(
            weapon.damage,
            physicsRefs.mesh.getAbsolutePosition(),
          );
        }

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
