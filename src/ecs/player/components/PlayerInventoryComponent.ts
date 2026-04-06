import type { TransformNode } from "@babylonjs/core";
import { createComponentType } from "../../core/Component.ts";
import type { EntityId } from "../../core/Entity.ts";
import {
  CarriedWeaponType,
  type WeaponDefinition,
} from "../../weapons/WeaponDefinitions.ts";

export interface PlayerInventoryComponent {
  activeWeaponType: CarriedWeaponType;
  slots: Partial<Record<CarriedWeaponType, WeaponDefinition>>;
  currentAmmo: number;
  isReloading: boolean;
  reloadTimer: number;
  isAiming: boolean;
  fireTimer: number;
  fireRequested: boolean;
  nearbyWeaponEntityId: EntityId | null;
  pickupRequested: boolean;
  dropRequested: boolean;
  equippedWeaponNode: TransformNode | null;
}

export const PlayerInventoryComponent =
  createComponentType<PlayerInventoryComponent>("PlayerInventoryComponent");
