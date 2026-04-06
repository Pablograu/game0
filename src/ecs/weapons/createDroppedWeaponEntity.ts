import {
  Animation,
  Color3,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Scene,
} from "@babylonjs/core";
import type { EntityId } from "../core/Entity.ts";
import type { World } from "../core/World.ts";
import { DroppedWeaponDataComponent } from "./components/DroppedWeaponDataComponent.ts";
import { DroppedWeaponMeshComponent } from "./components/DroppedWeaponMeshComponent.ts";
import { CarriedWeaponType, WEAPON_DEFINITIONS } from "./WeaponDefinitions.ts";

const WEAPON_COLORS: Record<CarriedWeaponType, Color3 | null> = {
  [CarriedWeaponType.NONE]: null,
  [CarriedWeaponType.PISTOL]: new Color3(1, 0.84, 0), // gold
  [CarriedWeaponType.MACHINE_GUN]: new Color3(0.3, 0.3, 0.85), // blue-steel
};

export function createDroppedWeaponEntity(
  world: World,
  scene: Scene,
  position: Vector3,
  weaponType: CarriedWeaponType,
): EntityId {
  const definition = WEAPON_DEFINITIONS[weaponType];
  if (!definition) {
    throw new Error(
      `createDroppedWeaponEntity: no definition for ${weaponType}`,
    );
  }

  // Build a simple placeholder mesh — replace with a real model later
  const mesh = MeshBuilder.CreateBox(
    `droppedWeapon_${weaponType}_${Math.random().toString(36).slice(2, 7)}`,
    { width: 0.2, height: 1.5, depth: 0.2 },
    scene,
  );
  mesh.position = position.clone().addInPlace(new Vector3(0, 1, 0));

  const mat = new StandardMaterial(`droppedWeaponMat_${weaponType}`, scene);
  mat.diffuseColor = WEAPON_COLORS[weaponType] ?? new Color3(1, 0.84, 0);
  mesh.material = mat;

  // Floating bob animation
  const anim = new Animation(
    "droppedWeaponFloat",
    "position.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  const baseY = mesh.position.y;
  anim.setKeys([
    { frame: 0, value: baseY },
    { frame: 30, value: baseY + 0.4 },
    { frame: 60, value: baseY },
  ]);
  mesh.animations = [anim];
  const floatAnimatable = scene.beginAnimation(mesh, 0, 60, true);

  const entityId = world.createEntity();

  world.addComponent(entityId, DroppedWeaponMeshComponent, {
    mesh,
    scene,
    floatAnimatable,
  });

  world.addComponent(entityId, DroppedWeaponDataComponent, {
    definition,
    ttl: 30,
    elapsed: 0,
  });

  return entityId;
}
