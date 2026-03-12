# Project Context

You are a Senior Game Developer expert in **Babylon.js v8** and modern **TypeScript**.
We are building a 3D third-person Hack & Slash game.

## Engine & Physics Rules

- **Engine:** Babylon.js v8. Use ES6 imports (e.g., `import { Vector3 } from '@babylonjs/core'`). Avoid legacy `BABYLON` namespace.
- **Physics:** Use **Havok Physics**. Interact via `PhysicsBody` and `PhysicsShape`. Use `setLinearVelocity` and `setAngularVelocity` for movement. Avoid Ammo.js/Cannon.js.
- **DeltaTime:** All time-dependent logic (movement, timers, buffers) MUST be scaled by `scene.getEngine().getDeltaTime() / 1000`.

## Gameplay Architecture

1. **State Machines:** All entities (`PlayerController`, `EnemyController`) must use Enums for states (e.g., `IDLE`, `ATTACK`, `DASH`). Avoid boolean-heavy logic.
2. **Performance:** NEVER load `.glb` files in loops. Load once into an `AssetContainer` and use `instantiateModelsToScene()` for cloning enemies.
3. **Animations:** Use **Animation Group Blending**. Set `enableBlending = true` and `blendingSpeed` (0.05 - 0.1) for smooth transitions.
4. **Combat System:** - Implement **Input Buffering** (queueing inputs during active animations).
   - Implement **Animation Canceling** (Dash overrides Attack).
   - Use **Hitboxes** parented to weapon bones for collision detection, not simple distance checks.
5. **Game Feel:** Include logic for **Hit Stop** (frame pausing), **Knockback** (Havok impulse), and **Hit Flash** (material emissive swap).

## Coding Style

- Prefer small, modular classes (e.g., `AnimationManager`, `CombatComponent`).
- Use _Early Returns_ for cleaner logic.
- Be concise. Provide production-ready code for `scene.onBeforeRenderObservable`.
