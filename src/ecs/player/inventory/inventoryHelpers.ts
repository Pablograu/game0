import {
  CarriedWeaponType,
  WEAPON_DEFINITIONS,
  type WeaponDefinition,
} from '../../weapons/WeaponDefinitions.ts';
import type { PlayerInventoryComponent } from '../components/PlayerInventoryComponent.ts';
import {
  isInventoryConsumableItem,
  isInventoryWeaponItem,
  type InventoryConsumableItem,
  type InventoryItem,
  type InventoryWeaponItem,
} from './InventoryItemDefinitions.ts';

export function markInventoryDirty(
  inventory: Pick<PlayerInventoryComponent, 'isDirty'>,
) {
  inventory.isDirty = true;
}

export function getInventoryItemById(
  inventory: Pick<PlayerInventoryComponent, 'backpack'>,
  itemId: string | null,
): InventoryItem | null {
  if (!itemId) {
    return null;
  }

  return inventory.backpack.find((item) => item.id === itemId) ?? null;
}

export function getActiveWeaponItem(
  inventory: Pick<PlayerInventoryComponent, 'activeWeaponItemId' | 'backpack'>,
): InventoryWeaponItem | null {
  const item = getInventoryItemById(inventory, inventory.activeWeaponItemId);
  return isInventoryWeaponItem(item) ? item : null;
}

export function getActiveWeaponType(
  inventory: Pick<PlayerInventoryComponent, 'activeWeaponItemId' | 'backpack'>,
): CarriedWeaponType {
  return getActiveWeaponItem(inventory)?.weaponType ?? CarriedWeaponType.NONE;
}

export function getActiveWeaponDefinition(
  inventory: Pick<PlayerInventoryComponent, 'activeWeaponItemId' | 'backpack'>,
): WeaponDefinition | null {
  const item = getActiveWeaponItem(inventory);
  return item ? WEAPON_DEFINITIONS[item.weaponType] : null;
}

export function addInventoryItem(
  inventory: Pick<
    PlayerInventoryComponent,
    'backpack' | 'capacity' | 'isDirty'
  >,
  item: InventoryItem,
): InventoryItem | null {
  if (isInventoryConsumableItem(item) && item.stackable) {
    const existing = inventory.backpack.find(
      (entry): entry is InventoryConsumableItem =>
        isInventoryConsumableItem(entry) &&
        entry.consumableType === item.consumableType,
    );

    if (existing) {
      existing.quantity += item.quantity;
      markInventoryDirty(inventory);
      return existing;
    }
  }

  if (inventory.backpack.length >= inventory.capacity) {
    return null;
  }

  inventory.backpack.push(item);
  markInventoryDirty(inventory);
  return item;
}

export function removeInventoryItem(
  inventory: Pick<
    PlayerInventoryComponent,
    'activeWeaponItemId' | 'backpack' | 'isDirty'
  >,
  itemId: string,
): InventoryItem | null {
  const itemIndex = inventory.backpack.findIndex((item) => item.id === itemId);

  if (itemIndex < 0) {
    return null;
  }

  const [removed] = inventory.backpack.splice(itemIndex, 1);

  if (inventory.activeWeaponItemId === removed.id) {
    inventory.activeWeaponItemId = null;
  }

  markInventoryDirty(inventory);
  return removed;
}

export function setActiveWeaponItemId(
  inventory: Pick<
    PlayerInventoryComponent,
    'activeWeaponItemId' | 'backpack' | 'isDirty'
  >,
  itemId: string | null,
) {
  if (itemId === null) {
    if (inventory.activeWeaponItemId !== null) {
      inventory.activeWeaponItemId = null;
      markInventoryDirty(inventory);
    }
    return;
  }

  const item = inventory.backpack.find((entry) => entry.id === itemId);

  if (!isInventoryWeaponItem(item)) {
    return;
  }

  if (inventory.activeWeaponItemId === item.id) {
    return;
  }

  inventory.activeWeaponItemId = item.id;
  markInventoryDirty(inventory);
}
