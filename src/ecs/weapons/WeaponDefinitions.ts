export enum CarriedWeaponType {
  NONE = "NONE",
  PISTOL = "PISTOL",
  ASSAULT_RIFLE = "ASSAULT_RIFLE",
}

export interface WeaponDefinition {
  type: CarriedWeaponType;
  damage: number;
  fireRate: number; // shots per second
  maxAmmo: number;
  reloadTime: number; // seconds
  projectileSpeed: number;
}

export const WEAPON_DEFINITIONS: Record<
  CarriedWeaponType,
  WeaponDefinition | null
> = {
  [CarriedWeaponType.NONE]: null,
  [CarriedWeaponType.PISTOL]: {
    type: CarriedWeaponType.PISTOL,
    damage: 5,
    fireRate: 2,
    maxAmmo: 12,
    reloadTime: 1.5,
    projectileSpeed: 40,
  },
  [CarriedWeaponType.ASSAULT_RIFLE]: {
    type: CarriedWeaponType.ASSAULT_RIFLE,
    damage: 2,
    fireRate: 10,
    maxAmmo: 30,
    reloadTime: 2.5,
    projectileSpeed: 50,
  },
};
