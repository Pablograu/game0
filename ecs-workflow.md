# ECS Architecture — How it Works in this Project

## What is ECS?

ECS stands for **Entity–Component–System**. It is an architecture pattern that separates _what something is_ (its identity), _what data it holds_ (its state), and _what logic runs on it_ (its behavior).

| Concept       | Role                                           | Analogy                                       |
| ------------- | ---------------------------------------------- | --------------------------------------------- |
| **Entity**    | A unique ID, nothing more                      | A database row ID                             |
| **Component** | A bag of data attached to an entity            | A column in that row                          |
| **System**    | Logic that reads/writes components every frame | A query + function that runs on matching rows |
| **World**     | The container that owns all of the above       | The database itself                           |

The key insight: **entities have no behavior**. **Components have no logic**. Only **systems do work**.

---

## The Three Pillars in This Project

### 1. Entity — just a number

```ts
// src/ecs/core/Entity.ts
export type EntityId = number;
```

An entity is literally an integer. The `World` assigns one and tracks it. Every in-game object (the player, each enemy, the game-flow controller) is an entity.

---

### 2. Component — pure data

```ts
// src/ecs/player/components/PlayerCombatStateComponent.ts
export interface PlayerCombatStateComponent {
  mode: PlayerCombatMode; // enum: IDLE | ATTACKING | DANCING
  isAttacking: boolean;
  attackQueue: string[]; // buffered input
  activeAttackAnimation: string | null;
  hitboxStartTime: number;
  hitboxEndTime: number;
  // ...
}

export const PlayerCombatStateComponent =
  createComponentType<PlayerCombatStateComponent>('PlayerCombatStateComponent');
```

A component type is created with `createComponentType()`, which gives it a unique `Symbol` key so the `World` can store and retrieve it efficiently. The interface is the data shape; the const is the lookup key.

The player entity has ~10 components, each owning its slice of state:

| Component                        | Owns                                          |
| -------------------------------- | --------------------------------------------- |
| `PlayerControlStateComponent`    | Raw key/mouse input, jump buffer              |
| `PlayerLocomotionStateComponent` | Move direction, speed, dash timer, knockback  |
| `PlayerCombatStateComponent`     | Attack queue, active animation, hitbox timing |
| `PlayerGroundingStateComponent`  | Is grounded, raycast result                   |
| `PlayerHealthStateComponent`     | HP, life state (ALIVE / DEAD)                 |
| `PlayerAnimationStateComponent`  | Refs to Babylon AnimationGroups               |
| `PlayerPhysicsViewRefsComponent` | Refs to Babylon Mesh, PhysicsBody             |

---

### 3. System — all the logic

```ts
// src/ecs/core/System.ts
export interface EcsSystem {
  readonly name: string;
  readonly order?: number; // determines execution order
  update(world: World, deltaTime: number): void;
}
```

A system:

1. Queries the `World` for entities that have a specific set of components.
2. Fetches those components.
3. Reads and writes their data.

```ts
// src/ecs/player/systems/PlayerMovementSystem.ts
export class PlayerMovementSystem implements EcsSystem {
  readonly name = 'PlayerMovementSystem';
  readonly order = 50; // runs after input (10) and combat (25)

  update(world: World, deltaTime: number): void {
    // Ask the World: "give me all entities that have ALL of these components"
    const entityIds = world.query(
      PlayerControlStateComponent,
      PlayerLocomotionStateComponent,
      PlayerPhysicsViewRefsComponent,
      // ...
    );

    for (const entityId of entityIds) {
      const control = world.getComponent(entityId, PlayerControlStateComponent);
      const locomotion = world.getComponent(
        entityId,
        PlayerLocomotionStateComponent,
      );
      const physicsRefs = world.getComponent(
        entityId,
        PlayerPhysicsViewRefsComponent,
      );

      // read input from control, write velocity to physicsRefs.body
      // everything delta-time scaled
    }
  }
}
```

---

## The World — the database

```ts
// src/ecs/core/World.ts
export class World {
  createEntity(): EntityId { ... }
  destroyEntity(entityId: EntityId) { ... }

  addComponent<T>(entityId, componentType, data): T { ... }
  getComponent<T>(entityId, componentType): T | undefined { ... }
  removeComponent<T>(entityId, componentType) { ... }

  query(...componentTypes): EntityId[] { ... }   // find matching entities

  registerSystem(system: EcsSystem) { ... }
  update(deltaTime: number) { ... }              // tick all systems in order
}
```

The `World` is the central hub. It owns every entity, every piece of component data, and drives all system updates each frame.

---

## How a Game Object is Born — the Player

Everything is wired in `bootstrapGameEcs.ts`. Here is the condensed flow:

### Step 1 — Create a World

```ts
const world = new World();
```

### Step 2 — Create the player entity and attach components

```ts
// src/ecs/player/createPlayerEntity.ts
const entityId = world.createEntity();   // returns e.g. 1

world.addComponent(entityId, PlayerTagComponent,           { kind: 'player' });
world.addComponent(entityId, PlayerControlStateComponent,  { inputEnabled: true, inputMap: {}, ... });
world.addComponent(entityId, PlayerLocomotionStateComponent, { mode: PlayerLocomotionMode.IDLE, ... });
world.addComponent(entityId, PlayerCombatStateComponent,   { mode: PlayerCombatMode.IDLE, attackQueue: [], ... });
world.addComponent(entityId, PlayerHealthStateComponent,   { hp: 100, lifeState: PlayerLifeState.ALIVE, ... });
world.addComponent(entityId, PlayerPhysicsViewRefsComponent, { mesh, body, ... });
// ...more components
```

The entity `1` is now a row in the database. Its columns are all the components above.

### Step 3 — Register systems in order

```ts
// src/ecs/bootstrap/bootstrapGameEcs.ts
world.registerSystem(new PlayerInputSystem()); // order 10
world.registerSystem(new PlayerDamageSystem()); // order 15
world.registerSystem(new PlayerCombatSystem()); // order 25
world.registerSystem(new PlayerDashSystem()); // order ~30
world.registerSystem(new PlayerGroundProbeSystem()); // order ~35
world.registerSystem(new PlayerJumpSystem()); // order ~40
world.registerSystem(new PlayerMovementSystem()); // order 50
world.registerSystem(new PlayerWeaponHitSystem()); // order ~55
world.registerSystem(new PlayerAnimationSystem()); // order 60
world.registerSystem(new PlayerUiSyncSystem()); // order ~70
```

The `SystemRunner` sorts them by `order` and runs them all every frame.

---

## The Frame Loop — data flowing through systems

Every frame, `world.update(deltaTime)` fires. The systems run in order, each one reading what the previous ones wrote:

```
FRAME START
│
├─ PlayerInputSystem (order 10)
│    Reads: Keyboard/Mouse events
│    Writes: control.inputMap, control.attackRequested, control.dashRequested
│
├─ PlayerDamageSystem (order 15)
│    Reads: requests.pendingDamage (set by enemy contact damage system)
│    Writes: health.hp, health.lifeState, locomotion.isKnockedBack
│
├─ PlayerCombatSystem (order 25)
│    Reads: control.attackRequested, combat.attackQueue
│    Writes: combat.mode (→ ATTACKING), combat.activeAttackAnimation
│
├─ PlayerMovementSystem (order 50)
│    Reads: control.moveInputX/Z, locomotion.mode, combat.mode
│    Writes: physicsRefs.body velocity (actual Havok physics call)
│
├─ PlayerAnimationSystem (order 60)
│    Reads: locomotion.mode, combat.mode, health.lifeState
│    Writes: plays/blends the matching Babylon AnimationGroup
│
└─ PlayerUiSyncSystem (order ~70)
     Reads: health.hp
     Writes: DOM healthbar element
│
FRAME END
```

No system reaches into another system. They only communicate through **shared component data**.

---

## Enemies use the exact same pattern

Every spawned enemy is also just an entity with components:

```ts
// Each enemy entity gets components like:
world.addComponent(enemyId, EnemyAiStateComponent,  { current: EnemyBehaviorState.PATROL, distanceToPlayer: 0, ... });
world.addComponent(enemyId, EnemyStatsComponent,    { hp: 30, maxHp: 30, lifeState: EnemyLifeState.ALIVE, ... });
world.addComponent(enemyId, EnemyPhysicsViewRefsComponent, { mesh, body, ... });
// ...
```

And the same enemy systems run on ALL enemy entities at once per frame:

```ts
// EnemyDecisionSystem — runs for EVERY enemy
const entityIds = world.query(EnemyAiStateComponent, EnemyStatsComponent, ...);

for (const entityId of entityIds) {
  const ai = world.getComponent(entityId, EnemyAiStateComponent);
  // decide: patrol? chase? attack?
  // write ai.current = EnemyBehaviorState.CHASE
}
```

You never need a loop that says "update all enemies". The query does it automatically because every enemy has the same components.

---

## The Query — how systems find their entities

`world.query(...componentTypes)` returns only entities that have **all** of the listed components. This is the filter.

```ts
// This returns only entities that are players (they are the only ones
// with PlayerCombatStateComponent + PlayerControlStateComponent + ...)
const entityIds = world.query(
  PlayerCombatStateComponent,
  PlayerControlStateComponent,
);

// This returns all enemy entities
const enemyIds = world.query(EnemyAiStateComponent, EnemyStatsComponent);
```

A system that queries for `PlayerControlStateComponent` will never accidentally process an enemy, and vice versa, because enemies never get player components added to them.

---

## Enums and State Machines

Instead of booleans like `isAttacking = true`, states are expressed as enums. This prevents impossible combinations (`isAttacking && isDead && isJumping`).

```ts
// src/ecs/player/PlayerStateEnums.ts
enum PlayerLocomotionMode {
  IDLE,
  MOVING,
  DASHING,
  KNOCKBACK,
}
enum PlayerCombatMode {
  IDLE,
  ATTACKING,
  DANCING,
}
enum PlayerLifeState {
  ALIVE,
  DEAD,
}
```

A system checks `locomotion.mode === PlayerLocomotionMode.DASHING` and acts accordingly. The enum is the single source of truth for that state.

---

## Big Picture Summary

```
World
├── Entity 1  (Player)
│   ├── PlayerControlStateComponent    ← input
│   ├── PlayerLocomotionStateComponent ← movement state
│   ├── PlayerCombatStateComponent     ← attack state
│   ├── PlayerHealthStateComponent     ← HP / life state
│   ├── PlayerAnimationStateComponent  ← animation refs
│   └── PlayerPhysicsViewRefsComponent ← Babylon mesh + body
│
├── Entity 2  (Enemy #1)
│   ├── EnemyAiStateComponent
│   ├── EnemyStatsComponent
│   └── EnemyPhysicsViewRefsComponent
│
├── Entity 3  (Enemy #2) — same components, different data
│   └── ...
│
└── Systems (run in order every frame)
    ├── PlayerInputSystem    → writes to control component
    ├── PlayerCombatSystem   → reads control, writes combat
    ├── EnemyDecisionSystem  → reads ai, writes ai.current
    ├── PlayerMovementSystem → reads control+combat, calls physics
    └── PlayerAnimationSystem → reads all state, plays animation
```

Each box is independent. Adding a new behavior means adding a new system and possibly a new component — no existing code needs to change.
