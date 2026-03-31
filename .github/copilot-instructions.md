# Project Context

You are a Senior Game Developer expert in **Babylon.js v9** and modern **TypeScript**.
We are building a 3D third-person Hack & Slash game.

## Engine & Physics Rules

- **Engine:** Babylon.js v9. Use ES6 imports (e.g., `import { Vector3 } from '@babylonjs/core'`). Avoid legacy `BABYLON` namespace.
- **Physics:** Use **Havok Physics**. Interact via `PhysicsBody` and `PhysicsShape`. Use `setLinearVelocity` and `setAngularVelocity` for movement. Avoid Ammo.js/Cannon.js.
- **DeltaTime:** All time-dependent logic (movement, timers, buffers) MUST be scaled by `scene.getEngine().getDeltaTime() / 1000`.

## Architecture Direction

- The project is moving toward a lightweight **ECS-style architecture**.
- Prefer **data-only components**, **behavior-owning systems**, and a **single authoritative update flow**.
- Avoid monolithic controllers that own input, movement, combat, animation, UI, health, and death logic all at once.
- New gameplay logic should be added as **components + systems** unless there is a strong reason not to.
- Keep Babylon-specific scene objects as references in components or thin services, not as the place where gameplay state lives.

## ECS Rules

1. **Components Are Data:** Components should primarily store state and references. Avoid putting gameplay orchestration methods inside components.
2. **Systems Own Behavior:** Movement, combat, animation selection, damage, death, loot, UI sync, and similar logic should live in systems.
3. **Single Source of Truth:** Do not duplicate gameplay state across multiple classes. If attack state exists, it should have one authoritative owner.
4. **One Update Order:** Prefer one central update pipeline with explicit system order over many scattered `onBeforeRenderObservable` registrations.
5. **Enums Over Booleans:** Use enums for mutually exclusive states such as locomotion, combat, life/death, and AI.
6. **Compatibility First:** During refactors, preserve existing gameplay and public integration points through thin facades or adapters until migration is complete.

## Event-Driven Gameplay

- Prefer a lightweight **domain event queue / event bus** for cross-system communication.
- **Systems** may emit and consume events. **Components should not subscribe to events**.
- Use events for decoupled gameplay reactions such as:
  - `EnemyDiedEvent`
  - `PlayerDiedEvent`
  - `AttackHitEvent`
  - `DamageAppliedEvent`
  - `LootSpawnRequestedEvent`
  - `GameOverRequestedEvent`
- Example: enemy death should emit an event that a loot system reacts to, instead of spawning loot directly inside enemy death code.

## Migration Strategy

- Prefer **incremental refactors** over full rewrites.
- Each migration step should leave the project compiling and the game still playable.
- Before replacing old code, inspect current dependencies in `main.ts`, `GameManager`, enemies, combat, and debug tooling.
- Keep legacy APIs temporarily if external code still depends on them.
- Remove old code only after the replacement path is fully wired and verified.

## Gameplay Architecture

1. **State Machines:** All entities (`PlayerController`, `EnemyController`) must use Enums for states (e.g., `IDLE`, `ATTACK`, `DASH`). Avoid boolean-heavy logic.
2. **Performance:** NEVER load `.glb` files in loops. Load once into an `AssetContainer` and use `instantiateModelsToScene()` for cloning enemies.
3. **Animations:** Use **Animation Group Blending**. Set `enableBlending = true` and `blendingSpeed` (0.05 - 0.1) for smooth transitions.
4. **Combat System:** - Implement **Input Buffering** (queueing inputs during active animations).
   - Implement **Animation Canceling** (Dash overrides Attack).
   - Use **Hitboxes** parented to weapon bones for collision detection, not simple distance checks.
5. **Game Feel:** Include logic for **Hit Stop** (frame pausing), **Knockback** (Havok impulse), and **Hit Flash** (material emissive swap).

## System Design Guidance

- Split player and enemy logic into focused systems such as input, locomotion, grounding, combat, weapon hit detection, animation, damage, death, loot, and UI sync.
- Keep manager classes thin. A manager should coordinate systems or high-level flow, not accumulate gameplay rules.
- Services such as audio, effects, camera shake, and loot spawning helpers may remain non-ECS, but gameplay decisions should come from systems.
- Prefer explicit request/event flow over direct deep cross-class calls.
- Avoid hidden timing through `setTimeout` for gameplay state when it can be modeled with delta-time-driven timers.

## Coding Style

- Prefer small, modular classes or systems (e.g., `AnimationSystem`, `CombatSystem`, `DamageSystem`).
- Keep components small and focused.
- Favor composition over inheritance.
- Use thin facades/adapters when bridging old controller APIs to new ECS-backed behavior.
- Use _Early Returns_ for cleaner logic.
- Be concise. Provide production-ready code for `scene.onBeforeRenderObservable`.
