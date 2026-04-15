import type { TransformNode } from '@babylonjs/core';
import { createComponentType } from '../../core/Component.ts';
import type { EntityId } from '../../core/Entity.ts';
import type {
  InventoryActionRequest,
  InventoryItem,
} from '../inventory/InventoryItemDefinitions.ts';

export interface PlayerInventoryComponent {
  backpack: InventoryItem[];
  capacity: number;
  activeWeaponItemId: string | null;
  nearbyPickupEntityId: EntityId | null;
  pickupRequested: boolean;
  actionRequest: InventoryActionRequest | null;
  equippedWeaponNode: TransformNode | null;
  isDirty: boolean;
}

export const PlayerInventoryComponent =
  createComponentType<PlayerInventoryComponent>('PlayerInventoryComponent');
