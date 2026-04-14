import { ArcRotateCamera, Quaternion, Scalar, Vector3 } from '@babylonjs/core';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import { PlayerPhysicsViewRefsComponent } from '../components/index.ts';
import { PlayerLocomotionStateComponent } from '../components/index.ts';
import { PlayerRangedStateComponent } from '../components/index.ts';

const IDLE_RADIUS = 4.0;
const IDLE_FOV = 1.2;
const IDLE_PIVOT_X = 0.5;

const AIM_RADIUS = 3.5;
const AIM_FOV = 0.8;
const AIM_PIVOT_X = 1.5;

const LERP_SPEED = 10;

export class PlayerCameraAimSystem implements EcsSystem {
  readonly name = 'PlayerCameraAimSystem';
  readonly order = 62;

  update(world: World, deltaTime: number): void {
    const entityIds = world.query(
      PlayerLocomotionStateComponent,
      PlayerPhysicsViewRefsComponent,
      PlayerRangedStateComponent,
    );

    for (const entityId of entityIds) {
      const locomotion = world.getComponent(
        entityId,
        PlayerLocomotionStateComponent,
      )!;
      const refs = world.getComponent(
        entityId,
        PlayerPhysicsViewRefsComponent,
      )!;
      const ranged = world.getComponent(entityId, PlayerRangedStateComponent)!;

      if (!refs.camera || !refs.shoulderAnchor) continue;

      const camera = refs.camera as ArcRotateCamera;
      // t stands for "transition". It represents how far along we are in transitioning from idle to aiming (or vice versa).
      const transition = Scalar.Clamp(LERP_SPEED * deltaTime, 0, 1);
      const targeting = ranged.isAiming;

      const targetRadius = targeting ? AIM_RADIUS : IDLE_RADIUS;
      const targetFov = targeting ? AIM_FOV : IDLE_FOV;
      const targetPivotX = targeting ? AIM_PIVOT_X : IDLE_PIVOT_X;

      camera.radius = Scalar.Lerp(camera.radius, targetRadius, transition);
      camera.fov = Scalar.Lerp(camera.fov, targetFov, transition);
      refs.shoulderAnchor.position.x = Scalar.Lerp(
        refs.shoulderAnchor.position.x,
        targetPivotX,
        transition,
      );

      if (!targeting) {
        continue;
      }

      const forward = camera.getDirection(Vector3.Forward());
      forward.y = 0;

      if (forward.lengthSquared() <= 0.0001) {
        continue;
      }

      forward.normalize();

      const aimYaw = Math.atan2(forward.x, forward.z);
      locomotion.targetAngle = aimYaw;
      locomotion.targetRotation = Quaternion.FromEulerAngles(0, aimYaw, 0);
      locomotion.lastFacingDirection.copyFrom(forward);
    }
  }
}
