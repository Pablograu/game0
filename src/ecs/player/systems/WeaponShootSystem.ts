import { CreateLines, type LinesMesh, Vector3 } from '@babylonjs/core';
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
const TRACER_LIFETIME = 0.08; // seconds

interface Tracer {
  lines: LinesMesh;
  timer: number;
}

export class WeaponShootSystem implements EcsSystem {
  readonly name = 'WeaponShootSystem';
  readonly order = 27;

  private tracers: Tracer[] = [];

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
      const engine = scene.getEngine();
      const w = engine.getRenderWidth();
      const h = engine.getRenderHeight();

      const ray = scene.createPickingRay(w / 2, h / 2, null, refs.camera);

      const playerMesh = refs.mesh;
      const hit = scene.pickWithRay(
        ray,
        (mesh) => mesh !== playerMesh && !mesh.isDescendantOf(playerMesh),
      );

      const hitPoint =
        hit?.pickedPoint ??
        ray.origin.add(ray.direction.scale(MAX_RAY_DISTANCE));

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
}
