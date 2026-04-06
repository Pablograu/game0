import type { Animatable, Scene, TransformNode } from "@babylonjs/core";
import { createComponentType } from "../../core/Component.ts";

export interface DroppedWeaponMeshComponent {
  node: TransformNode;
  scene: Scene;
  floatAnimatable: Animatable | null;
}

export const DroppedWeaponMeshComponent =
  createComponentType<DroppedWeaponMeshComponent>("DroppedWeaponMeshComponent");
