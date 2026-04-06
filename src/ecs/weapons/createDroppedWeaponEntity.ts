import {
  Animation,
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Scene,
} from "@babylonjs/core";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading";
import type { EntityId } from "../core/Entity.ts";
import type { World } from "../core/World.ts";
import { DroppedWeaponDataComponent } from "./components/DroppedWeaponDataComponent.ts";
import { DroppedWeaponMeshComponent } from "./components/DroppedWeaponMeshComponent.ts";
import { CarriedWeaponType, WEAPON_DEFINITIONS } from "./WeaponDefinitions.ts";

const ASSAULT_RIFLE_PATH = "/models/assault-rifle1.glb";

type LoadedContainer = Awaited<ReturnType<typeof LoadAssetContainerAsync>>;
let rifleContainer: LoadedContainer | null = null;

export async function preloadDroppedWeaponAssets(scene: Scene): Promise<void> {
  if (rifleContainer) return;
  rifleContainer = await LoadAssetContainerAsync(ASSAULT_RIFLE_PATH, scene);
}

export function spawnEquippedWeaponNode(): TransformNode | null {
  if (!rifleContainer) return null;

  const instance = rifleContainer.instantiateModelsToScene(
    (name) =>
      `${name}_equipped_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    false,
  );
  for (const ag of instance.animationGroups) {
    ag.stop();
  }
  const root = instance.rootNodes[0] as TransformNode;
  root.scaling = new Vector3(1, 1, 1);
  return root;
}

function spawnWeaponNode(scene: Scene, position: Vector3): TransformNode {
  if (rifleContainer) {
    const instance = rifleContainer.instantiateModelsToScene(
      (name) =>
        `${name}_drop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      false,
    );
    // Stop embedded animations — position.y is driven by our own Animation
    for (const ag of instance.animationGroups) {
      ag.stop();
    }
    const root = instance.rootNodes[0] as TransformNode;
    root.position = position.clone().addInPlace(new Vector3(0, 0.5, 0));
    root.scaling = new Vector3(2, 2, 2);
    return root;
  }

  // Fallback box when preload hasn't run yet
  const box = MeshBuilder.CreateBox(
    `droppedWeapon_box_${Math.random().toString(36).slice(2, 7)}`,
    { width: 0.2, height: 1.5, depth: 0.2 },
    scene,
  );
  box.position = position.clone().addInPlace(new Vector3(0, 1, 0));
  const mat = new StandardMaterial("droppedWeaponMat_fallback", scene);
  mat.diffuseColor = new Color3(0.3, 0.3, 0.85);
  box.material = mat;
  return box;
}

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

  const node = spawnWeaponNode(scene, position);

  // Floating bob animation on the root node
  const anim = new Animation(
    "droppedWeaponFloat",
    "position.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  const baseY = node.position.y;
  anim.setKeys([
    { frame: 0, value: baseY },
    { frame: 30, value: baseY + 0.4 },
    { frame: 60, value: baseY },
  ]);
  node.animations = [anim];
  const floatAnimatable = scene.beginAnimation(node, 0, 60, true);

  const entityId = world.createEntity();

  world.addComponent(entityId, DroppedWeaponMeshComponent, {
    node,
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
