import type { AbstractMesh, Animatable, Scene } from "@babylonjs/core";
import { createComponentType } from "../../core/Component.ts";

export interface DroppedWeaponMeshComponent {
  mesh: AbstractMesh;
  scene: Scene;
  floatAnimatable: Animatable | null;
}

export const DroppedWeaponMeshComponent =
  createComponentType<DroppedWeaponMeshComponent>("DroppedWeaponMeshComponent");
