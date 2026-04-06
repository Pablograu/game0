import { createComponentType } from "../../core/Component.ts";
import type { WeaponDefinition } from "../WeaponDefinitions.ts";

export interface DroppedWeaponDataComponent {
  definition: WeaponDefinition;
  ttl: number; // seconds before auto-despawn, e.g. 30
  elapsed: number;
}

export const DroppedWeaponDataComponent =
  createComponentType<DroppedWeaponDataComponent>("DroppedWeaponDataComponent");
