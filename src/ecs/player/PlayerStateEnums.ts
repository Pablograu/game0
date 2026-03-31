export enum PlayerLocomotionMode {
  IDLE = 'IDLE',
  MOVING = 'MOVING',
  DASHING = 'DASHING',
  KNOCKBACK = 'KNOCKBACK',
}

export enum PlayerJumpPhaseState {
  GROUNDED = 'GROUNDED',
  RISING = 'RISING',
  FALLING = 'FALLING',
  PRE_LANDING = 'PRE_LANDING',
}

export enum PlayerCombatMode {
  IDLE = 'IDLE',
  ATTACKING = 'ATTACKING',
  DANCING = 'DANCING',
}

export enum PlayerWeaponPhase {
  IDLE = 'IDLE',
  ATTACKING = 'ATTACKING',
  COOLDOWN = 'COOLDOWN',
}

export enum PlayerLifeState {
  ALIVE = 'ALIVE',
  DEAD = 'DEAD',
}

export enum PlayerRagdollMode {
  UNINITIALIZED = 'UNINITIALIZED',
  READY = 'READY',
  ACTIVE = 'ACTIVE',
}
