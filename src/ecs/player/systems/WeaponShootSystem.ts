import {
  CreateLines,
  Matrix,
  Ray,
  type LinesMesh,
  Vector3,
} from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Ellipse } from "@babylonjs/gui";
import {
  EnemyLifecycleRequestComponent,
  EnemyPhysicsViewRefsComponent,
} from "../../enemy/components/index.ts";
import type { EcsSystem } from "../../core/System.ts";
import type { World } from "../../core/World.ts";
import {
  CarriedWeaponType,
  WEAPON_DEFINITIONS,
} from "../../weapons/WeaponDefinitions.ts";
import {
  PlayerHealthStateComponent,
  PlayerInventoryComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerRangedStateComponent,
} from "../components/index.ts";
import { AudioManager } from "../../../AudioManager.ts";
import { HudManager } from "../../../HudManager.ts";
import { PlayerLifeState } from "../PlayerStateEnums.ts";

const MAX_RAY_DISTANCE = 200;
const TRACER_LIFETIME = 5; // seconds
const DOT_HALF_SIZE = 6;

interface Tracer {
  lines: LinesMesh;
  timer: number;
}

export class WeaponShootSystem implements EcsSystem {
  readonly name = "WeaponShootSystem";
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

      // 1. CROSSHAIR ESTÁTICO (En el centro de la pantalla)
      if (!this.crosshairAdt) {
        this.crosshairAdt = AdvancedDynamicTexture.CreateFullscreenUI(
          "crosshairUI",
          true,
          refs.scene,
        );
        const dot = new Ellipse("crosshair");
        dot.width = `${DOT_HALF_SIZE * 2}px`;
        dot.height = `${DOT_HALF_SIZE * 2}px`;
        dot.color = "rgba(255,60,60,0.9)";
        dot.background = "rgba(255,60,60,0.75)";
        dot.thickness = 1.5;
        // Centrado absoluto
        dot.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        dot.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        dot.isVisible = false;
        this.crosshairAdt.addControl(dot);
        this.crosshair = dot;
      }

      const armed = inv.activeWeaponType !== CarriedWeaponType.NONE;
      const isAlive = health.lifeState === PlayerLifeState.ALIVE;

      if (this.crosshair) {
        this.crosshair.isVisible = armed && ranged.isAiming && isAlive;
      }

      if (!isAlive) {
        ranged.fireRequested = false;
        continue;
      }

      // Tick timers (Cooldown & Reload)
      if (ranged.fireTimer > 0)
        ranged.fireTimer = Math.max(0, ranged.fireTimer - deltaTime);

      if (ranged.shootTimer > 0)
        ranged.shootTimer = Math.max(0, ranged.shootTimer - deltaTime);

      if (ranged.isReloading) {
        ranged.reloadTimer = Math.max(0, ranged.reloadTimer - deltaTime);
        if (ranged.reloadTimer <= 0) {
          const weaponDef = inv.slots[inv.activeWeaponType];
          ranged.currentAmmo = weaponDef?.maxAmmo ?? 0;
          ranged.isReloading = false;
          HudManager.setAmmo(ranged.currentAmmo);
        }
      }
      // Auto-reload
      if (!ranged.isReloading && ranged.currentAmmo <= 0 && armed) {
        const weaponDef =
          inv.slots[inv.activeWeaponType] ??
          WEAPON_DEFINITIONS[inv.activeWeaponType];

        console.log("weaponDef :>> ", weaponDef);

        if (weaponDef) {
          ranged.isReloading = true;
          ranged.reloadTimer = weaponDef.reloadTime;
          AudioManager.play("weapon_reload");
        }
      }

      if (!ranged.fireRequested) continue;
      ranged.fireRequested = false;

      if (
        !ranged.isAiming ||
        ranged.isReloading ||
        ranged.currentAmmo <= 0 ||
        ranged.fireTimer > 0 ||
        !armed
      ) {
        continue;
      }

      const weaponDef =
        inv.slots[inv.activeWeaponType] ??
        WEAPON_DEFINITIONS[inv.activeWeaponType];
      if (!weaponDef || !refs.camera) continue;

      const scene = refs.scene;
      const playerMesh = refs.mesh;

      // 2. RAYCAST PURO DESDE LA CÁMARA (El objetivo real)
      const aimRay = this.buildAimRay(refs.camera, scene);
      const aimHit = scene.pickWithRay(
        aimRay,
        (mesh) =>
          mesh.isPickable &&
          mesh !== playerMesh &&
          !mesh.isDescendantOf(playerMesh),
      );
      // Si no golpea nada, el objetivo es un punto lejano en el horizonte
      const hitPoint =
        aimHit?.pickedPoint ??
        aimRay.origin.add(aimRay.direction.scale(MAX_RAY_DISTANCE));

      // 3. EL ARMA DISPARA HACIA EL OBJETIVO DE LA CÁMARA
      const muzzleOrigin = inv.equippedWeaponNode
        ? inv.equippedWeaponNode.getAbsolutePosition()
        : playerMesh.getAbsolutePosition().add(new Vector3(0, 1.4, 0)); // Altura del hombro aprox.

      // Spawn tracer line (Desde el arma hasta donde miraba la cámara)
      const tracer = CreateLines(
        "tracer",
        { points: [muzzleOrigin.clone(), hitPoint.clone()], updatable: false },
        scene,
      );
      tracer.color.set(1, 0.9, 0.5);
      tracer.isPickable = false;
      this.tracers.push({ lines: tracer, timer: TRACER_LIFETIME });

      // Consume ammo and set fire cooldown
      ranged.currentAmmo -= 1;
      HudManager.setAmmo(ranged.currentAmmo);
      ranged.fireTimer = 1 / weaponDef.fireRate;
      ranged.shootTimer = 0.2;
      AudioManager.play("weapon_shoot");

      // Damage logic
      if (!aimHit?.pickedMesh) continue;

      const enemyIds = world.query(
        EnemyLifecycleRequestComponent,
        EnemyPhysicsViewRefsComponent,
      );
      for (const enemyId of enemyIds) {
        const enemyRefs = world.getComponent(
          enemyId,
          EnemyPhysicsViewRefsComponent,
        )!;
        if (
          aimHit.pickedMesh !== enemyRefs.mesh &&
          !aimHit.pickedMesh.isDescendantOf(enemyRefs.mesh)
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
   * Genera un rayo perfecto desde el centro matemático de la cámara hacia el mundo.
   * Esto garantiza que donde esté el punto de mira de la UI (centro de pantalla), irá la bala.
   */
  private buildAimRay(
    camera: NonNullable<PlayerPhysicsViewRefsComponent["camera"]>,
    scene: PlayerPhysicsViewRefsComponent["scene"],
  ): Ray {
    const engine = scene.getEngine();
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    // Crea el rayo exactamente desde el centro (w/2, h/2) de la vista de la cámara
    return scene.createPickingRay(w / 2, h / 2, Matrix.Identity(), camera);
  }
}
