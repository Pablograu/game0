export enum EnemyLifeState {
  ALIVE = 'ALIVE',
  DEAD = 'DEAD',
}

export enum EnemyBehaviorState {
  PATROL = 'PATROL',
  CHASE = 'CHASE',
  ATTACK = 'ATTACK',
  HIT = 'HIT',
  DEAD = 'DEAD',
}

export enum EnemyCombatMode {
  IDLE = 'IDLE',
  ATTACK = 'ATTACK',
  HIT = 'HIT',
  DEAD = 'DEAD',
}

export enum EnemyRagdollMode {
  UNINITIALIZED = 'UNINITIALIZED',
  READY = 'READY',
  ACTIVE = 'ACTIVE',
  DISPOSED = 'DISPOSED',
}

export enum EnemySpawnState {
  SPAWNED = 'SPAWNED',
  DESPAWN_QUEUED = 'DESPAWN_QUEUED',
  DESPAWNED = 'DESPAWNED',
}
