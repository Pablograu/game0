import {
  CreateLines,
  Matrix,
  Ray,
  type LinesMesh,
  Vector3,
  Viewport,
} from '@babylonjs/core';
import { AdvancedDynamicTexture, Control, Ellipse } from '@babylonjs/gui';
import {
  EnemyLifecycleRequestComponent,
  EnemyPhysicsViewRefsComponent,
} from '../../enemy/components/index.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  CarriedWeaponType,
  WEAPON_DEFINITIONS,
} from '../../weapons/WeaponDefinitions.ts';
import {
  PlayerHealthStateComponent,
  PlayerInventoryComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerRangedStateComponent,
} from '../components/index.ts';
import { PlayerLifeState } from '../PlayerStateEnums.ts';

const MAX_RAY_DISTANCE = 200;
const TRACER_LIFETIME = 5; // seconds
const DOT_HALF_SIZE = 6; // half of 12px
// Offset above the player center used only for crosshair projection.
// Higher = crosshair appears further in front, better for top-down aiming feel.
const CROSSHAIR_EYE_HEIGHT = 10;

interface Tracer {
  lines: LinesMesh;
  timer: number;
}

export class WeaponShootSystem implements EcsSystem {
  readonly name = 'WeaponShootSystem';
  readonly order = 27;

  private tracers: Tracer[] = [];
  private crosshairAdt: AdvancedDynamicTexture | null = null;
  private crosshair: Ellipse | null = null;

  update(world: World, deltaTime: number): void {
    // Tick and dispose expired tracers
    this.tracers = this.tracers.filter((t) => {
      t.timer -= deltaTime;
      if (t.timer <= 0) {
        t.lines.dispose();
        return false;
      }
      return true;
    });

    const entityIds = world.query(
      PlayerHealthStateComponent,
      PlayerInventoryComponent,
      PlayerPhysicsViewRefsComponent,
      PlayerRangedStateComponent,
    );

    for (const entityId of entityIds) {
      const health = world.getComponent(entityId, PlayerHealthStateComponent)!;
      const inv = world.getComponent(entityId, PlayerInventoryComponent)!;
      const refs = world.getComponent(
        entityId,
        PlayerPhysicsViewRefsComponent,
      )!;
      const ranged = world.getComponent(entityId, PlayerRangedStateComponent)!;

      // Lazy-create crosshair anchored top-left so we can pixel-position it
      if (!this.crosshairAdt) {
        this.crosshairAdt = AdvancedDynamicTexture.CreateFullscreenUI(
          'crosshairUI',
          true,
          refs.scene,
        );
        const dot = new Ellipse('crosshair');
        dot.width = `${DOT_HALF_SIZE * 2}px`;
        dot.height = `${DOT_HALF_SIZE * 2}px`;
        dot.color = 'rgba(255,60,60,0.9)';
        dot.background = 'rgba(255,60,60,0.75)';
        dot.thickness = 1.5;
        dot.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        dot.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        dot.isVisible = false;
        this.crosshairAdt.addControl(dot);
        this.crosshair = dot;
      }

      const armed = inv.activeWeaponType !== CarriedWeaponType.NONE;
      const showCrosshair =
        armed && ranged.isAiming && health.lifeState === PlayerLifeState.ALIVE;

      // Always compute the aim target point so the shoot ray can reuse it.
      let aimTargetPoint: Vector3 | null = null;
      if (refs.camera) {
        const aimScene = refs.scene;
        const aimRay = this.buildAimRay(refs.mesh, refs.camera, aimScene);
        const aimHit = aimScene.pickWithRay(
          aimRay,
          (mesh) => mesh !== refs.mesh && !mesh.isDescendantOf(refs.mesh),
        );
        aimTargetPoint =
          aimHit?.pickedPoint ??
          aimRay.origin.add(aimRay.direction.scale(MAX_RAY_DISTANCE));
      }

      // Update crosshair position every frame while aiming
      if (showCrosshair && this.crosshair && aimTargetPoint) {
        const aimScene = refs.scene;
        const aimEngine = aimScene.getEngine();
        const aimW = aimEngine.getRenderWidth();
        const aimH = aimEngine.getRenderHeight();

        const projected = Vector3.Project(
          aimTargetPoint,
          Matrix.Identity(),
          aimScene.getTransformMatrix(),
          new Viewport(0, 0, aimW, aimH),
        );

        if (projected.z >= 0 && projected.z <= 1) {
          this.crosshair.isVisible = true;
          this.crosshair.left = `${projected.x - DOT_HALF_SIZE}px`;
          this.crosshair.top = `${projected.y - DOT_HALF_SIZE}px`;
        } else {
          this.crosshair.isVisible = false;
        }
      } else if (this.crosshair) {
        this.crosshair.isVisible = false;
      }

      if (health.lifeState !== PlayerLifeState.ALIVE) {
        ranged.fireRequested = false;
        continue;
      }

      // Tick fire cooldown
      if (ranged.fireTimer > 0) {
        ranged.fireTimer = Math.max(0, ranged.fireTimer - deltaTime);
      }

      // Tick reload
      if (ranged.isReloading) {
        ranged.reloadTimer = Math.max(0, ranged.reloadTimer - deltaTime);
        if (ranged.reloadTimer <= 0) {
          const weaponDef = inv.slots[inv.activeWeaponType];
          ranged.currentAmmo = weaponDef?.maxAmmo ?? 0;
          ranged.isReloading = false;
        }
      }

      // Auto-reload when dry
      if (
        !ranged.isReloading &&
        ranged.currentAmmo <= 0 &&
        inv.activeWeaponType !== CarriedWeaponType.NONE
      ) {
        const weaponDef = inv.slots[inv.activeWeaponType];
        if (weaponDef) {
          ranged.isReloading = true;
          ranged.reloadTimer = weaponDef.reloadTime;
        }
      }

      if (!ranged.fireRequested) {
        continue;
      }
      ranged.fireRequested = false;

      // Guard: must be aiming, armed, loaded, and cooled down
      if (
        !ranged.isAiming ||
        ranged.isReloading ||
        ranged.currentAmmo <= 0 ||
        ranged.fireTimer > 0 ||
        inv.activeWeaponType === CarriedWeaponType.NONE
      ) {
        continue;
      }

      const weaponDef =
        inv.slots[inv.activeWeaponType] ??
        WEAPON_DEFINITIONS[inv.activeWeaponType];

      if (!weaponDef || !refs.camera) {
        continue;
      }

      const scene = refs.scene;

      // Shoot from the player's chest toward the aim target point so the ray
      // travels roughly horizontally regardless of how steep the camera angle is.
      const playerMesh = refs.mesh;
      const chestOrigin = playerMesh
        .getAbsolutePosition()
        .add(new Vector3(0, 1.1, 0));
      const shootTarget =
        aimTargetPoint ??
        chestOrigin.add(playerMesh.forward.scale(MAX_RAY_DISTANCE));
      const shootDir = shootTarget.subtract(chestOrigin).normalize();
      const shootRay = new Ray(chestOrigin, shootDir, MAX_RAY_DISTANCE);

      const hit = scene.pickWithRay(
        shootRay,
        (mesh) => mesh !== playerMesh && !mesh.isDescendantOf(playerMesh),
      );

      const hitPoint =
        hit?.pickedPoint ??
        shootRay.origin.add(shootRay.direction.scale(MAX_RAY_DISTANCE));

      // Muzzle origin: weapon node if available, else player position offset
      const muzzleOrigin = inv.equippedWeaponNode
        ? inv.equippedWeaponNode.getAbsolutePosition()
        : playerMesh.getAbsolutePosition().add(new Vector3(0, 1.4, 0));

      // Spawn tracer line
      const tracer = CreateLines(
        'tracer',
        { points: [muzzleOrigin.clone(), hitPoint.clone()], updatable: false },
        scene,
      );
      tracer.color.set(1, 0.9, 0.5);
      tracer.isPickable = false;
      this.tracers.push({ lines: tracer, timer: TRACER_LIFETIME });

      // Consume ammo and set fire cooldown
      ranged.currentAmmo -= 1;
      ranged.fireTimer = 1 / weaponDef.fireRate;

      // Damage enemy if hit
      if (!hit?.pickedMesh) {
        continue;
      }

      const enemyIds = world.query(
        EnemyLifecycleRequestComponent,
        EnemyPhysicsViewRefsComponent,
      );

      for (const enemyId of enemyIds) {
        const enemyRefs = world.getComponent(
          enemyId,
          EnemyPhysicsViewRefsComponent,
        )!;
        const enemyMesh = enemyRefs.mesh;

        if (
          hit.pickedMesh !== enemyMesh &&
          !hit.pickedMesh.isDescendantOf(enemyMesh)
        ) {
          continue;
        }

        const lifecycle = world.getComponent(
          enemyId,
          EnemyLifecycleRequestComponent,
        )!;
        lifecycle.damageRequests.push({
          amount: weaponDef.damage,
          damageSourcePosition: playerMesh.getAbsolutePosition().clone(),
        });
        break;
      }
    }
  }
  /**
   * Aim ray used ONLY for crosshair projection. Originates above the player
   * so the projected hit point appears naturally in front from a top-down camera.
   */
  private buildAimRay(
    playerMesh: PlayerPhysicsViewRefsComponent['mesh'],
    camera: NonNullable<PlayerPhysicsViewRefsComponent['camera']>,
    scene: PlayerPhysicsViewRefsComponent['scene'],
  ): Ray {
    const engine = scene.getEngine();
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    const cameraRay = scene.createPickingRay(w / 2, h / 2, null, camera);
    const dir = cameraRay.direction.normalize();
    const origin = playerMesh
      .getAbsolutePosition()
      .add(new Vector3(0, CROSSHAIR_EYE_HEIGHT, 0));
    return new Ray(origin, dir, MAX_RAY_DISTANCE);
  }
}
