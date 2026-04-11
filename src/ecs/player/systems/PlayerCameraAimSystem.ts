import { ArcRotateCamera, Scalar } from "@babylonjs/core";
import type { EcsSystem } from "../../core/System.ts";
import type { World } from "../../core/World.ts";
import { PlayerPhysicsViewRefsComponent } from "../components/index.ts";
import { PlayerRangedStateComponent } from "../components/index.ts";

const IDLE_RADIUS = 4.0;
const IDLE_FOV = 1.2;
const IDLE_PIVOT_X = 0.5;

const AIM_RADIUS = 1.5;
const AIM_FOV = 0.8;
const AIM_PIVOT_X = 1.2;

const LERP_SPEED = 10;

export class PlayerCameraAimSystem implements EcsSystem {
  readonly name = "PlayerCameraAimSystem";
  readonly order = 62;

  update(world: World, deltaTime: number): void {
    const entityIds = world.query(
      PlayerPhysicsViewRefsComponent,
      PlayerRangedStateComponent,
    );

    for (const entityId of entityIds) {
      const refs = world.getComponent(
        entityId,
        PlayerPhysicsViewRefsComponent,
      )!;
      const ranged = world.getComponent(entityId, PlayerRangedStateComponent)!;

      if (!refs.camera || !refs.shoulderAnchor) continue;

      const camera = refs.camera as ArcRotateCamera;
      const t = Scalar.Clamp(LERP_SPEED * deltaTime, 0, 1);
      const targeting = ranged.isAiming;

      const targetRadius = targeting ? AIM_RADIUS : IDLE_RADIUS;
      const targetFov = targeting ? AIM_FOV : IDLE_FOV;
      const targetPivotX = targeting ? AIM_PIVOT_X : IDLE_PIVOT_X;

      camera.radius = Scalar.Lerp(camera.radius, targetRadius, t);
      camera.fov = Scalar.Lerp(camera.fov, targetFov, t);
      refs.shoulderAnchor.position.x = Scalar.Lerp(
        refs.shoulderAnchor.position.x,
        targetPivotX,
        t,
      );
    }
  }
}
