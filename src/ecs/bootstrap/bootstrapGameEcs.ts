import type { Scene } from '@babylonjs/core';
import type { EntityId } from '../core/Entity.ts';
import { World } from '../core/World.ts';
import {
  createPlayerEntity,
  PlayerAnimationSystem,
  PlayerCombatSystem,
  PlayerDashSystem,
  PlayerDamageSystem,
  PlayerGameOverSystem,
  PlayerGroundProbeSystem,
  PlayerInputSystem,
  PlayerJumpSystem,
  PlayerMovementSystem,
  PlayerPresentationSystem,
  PlayerSurvivabilitySystem,
  PlayerUiSyncSystem,
  PlayerWeaponHitSystem,
} from '../player/index.ts';
import type { PlayerBootstrapRuntime } from '../../player/playerRuntime.ts';

export interface BootstrapGameEcsOptions extends PlayerBootstrapRuntime {}

export interface GameEcsRuntime {
  readonly world: World;
  readonly playerEntityId: EntityId | null;
  dispose(): void;
}

export function bootstrapGameEcs(
  options: BootstrapGameEcsOptions,
): GameEcsRuntime {
  const world = new World();
  let playerEntityId: EntityId | null = null;

  if (options.playerMesh) {
    playerEntityId = createPlayerEntity({
      world,
      ...options,
    });

    world.registerSystem(new PlayerInputSystem());
    world.registerSystem(new PlayerDamageSystem());
    world.registerSystem(new PlayerSurvivabilitySystem());
    world.registerSystem(new PlayerGameOverSystem());
    world.registerSystem(new PlayerGroundProbeSystem());
    world.registerSystem(new PlayerCombatSystem());
    world.registerSystem(new PlayerDashSystem());
    world.registerSystem(new PlayerJumpSystem());
    world.registerSystem(new PlayerMovementSystem());
    world.registerSystem(new PlayerWeaponHitSystem());
    world.registerSystem(new PlayerAnimationSystem());
    world.registerSystem(new PlayerPresentationSystem());
    world.registerSystem(new PlayerUiSyncSystem());
  }

  const updateObserver = options.scene.onBeforeRenderObservable.add(() => {
    const deltaTime = options.scene.getEngine().getDeltaTime() / 1000;
    world.update(deltaTime);
  });

  return {
    world,
    playerEntityId,
    dispose() {
      options.scene.onBeforeRenderObservable.remove(updateObserver);
    },
  };
}
