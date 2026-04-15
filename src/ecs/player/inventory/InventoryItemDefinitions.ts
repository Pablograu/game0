import {
  CarriedWeaponType,
  WEAPON_DEFINITIONS,
} from '../../weapons/WeaponDefinitions.ts';

export const PLAYER_INVENTORY_CAPACITY = 20;

export type InventoryItemKind = 'weapon' | 'consumable';

export enum InventoryConsumableType {
  SMALL_MEDKIT = 'SMALL_MEDKIT',
}

export interface InventoryItemBase {
  id: string;
  kind: InventoryItemKind;
  label: string;
  shortLabel: string;
  quantity: number;
  stackable: boolean;
}

export interface InventoryWeaponItem extends InventoryItemBase {
  kind: 'weapon';
  weaponType: CarriedWeaponType;
  currentAmmo: number;
}

export interface InventoryConsumableItem extends InventoryItemBase {
  kind: 'consumable';
  consumableType: InventoryConsumableType;
  healAmount: number;
}

export type InventoryItem = InventoryWeaponItem | InventoryConsumableItem;

export interface InventoryActionRequest {
  kind: 'use' | 'drop';
  itemId: string;
}

interface ConsumableDefinition {
  label: string;
  shortLabel: string;
  healAmount: number;
  stackable: boolean;
}

const CONSUMABLE_DEFINITIONS: Record<
  InventoryConsumableType,
  ConsumableDefinition
> = {
  [InventoryConsumableType.SMALL_MEDKIT]: {
    label: 'Med Kit',
    shortLabel: 'MED',
    healAmount: 4,
    stackable: true,
  },
};

const WEAPON_LABELS: Record<
  CarriedWeaponType,
  { label: string; shortLabel: string }
> = {
  [CarriedWeaponType.NONE]: {
    label: 'Unarmed',
    shortLabel: 'NONE',
  },
  [CarriedWeaponType.PISTOL]: {
    label: 'Pistol',
    shortLabel: 'PST',
  },
  [CarriedWeaponType.ASSAULT_RIFLE]: {
    label: 'Assault Rifle',
    shortLabel: 'AR',
  },
};

function createInventoryItemId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createWeaponInventoryItem(
  weaponType: CarriedWeaponType,
  currentAmmo?: number,
): InventoryWeaponItem {
  const definition = WEAPON_DEFINITIONS[weaponType];

  if (!definition) {
    throw new Error(`No weapon definition found for ${weaponType}.`);
  }

  const labels = WEAPON_LABELS[weaponType];

  return {
    id: createInventoryItemId(),
    kind: 'weapon',
    label: labels.label,
    shortLabel: labels.shortLabel,
    quantity: 1,
    stackable: false,
    weaponType,
    currentAmmo: currentAmmo ?? definition.maxAmmo,
  };
}

export function createConsumableInventoryItem(
  consumableType: InventoryConsumableType,
  quantity = 1,
): InventoryConsumableItem {
  const definition = CONSUMABLE_DEFINITIONS[consumableType];

  return {
    id: createInventoryItemId(),
    kind: 'consumable',
    label: definition.label,
    shortLabel: definition.shortLabel,
    quantity,
    stackable: definition.stackable,
    consumableType,
    healAmount: definition.healAmount,
  };
}

export function createStarterInventory(): InventoryItem[] {
  return [
    createConsumableInventoryItem(InventoryConsumableType.SMALL_MEDKIT, 2),
  ];
}

export function isInventoryWeaponItem(
  item: InventoryItem | null | undefined,
): item is InventoryWeaponItem {
  return item?.kind === 'weapon';
}

export function isInventoryConsumableItem(
  item: InventoryItem | null | undefined,
): item is InventoryConsumableItem {
  return item?.kind === 'consumable';
}
