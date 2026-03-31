import type { Camera, Mesh, Scene } from '@babylonjs/core';
import type { PlayerController } from '../../player/PlayerController.ts';
import type { EntityId } from '../core/Entity.ts';
import { World } from '../core/World.ts';
import {
  createPlayerEntity,
  PlayerControllerBridgeSystem,
  PlayerDashSystem,
  PlayerGroundProbeSystem,
  PlayerInputSystem,
  PlayerJumpSystem,
  PlayerMovementSystem,
} from '../player/index.ts';

export interface BootstrapGameEcsOptions {
  scene: Scene;
  playerController?: PlayerController | null;
  playerMesh?: Mesh | null;
  camera?: Camera | null;
}

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

  if (options.playerController && options.playerMesh) {
    playerEntityId = createPlayerEntity({
      world,
      scene: options.scene,
      playerController: options.playerController,
      playerMesh: options.playerMesh,
      camera: options.camera ?? null,
    });

    options.playerController.enableEcsLocomotionFacade();

    world.registerSystem(new PlayerInputSystem());
    world.registerSystem(new PlayerGroundProbeSystem());
    world.registerSystem(new PlayerDashSystem());
    world.registerSystem(new PlayerJumpSystem());
    world.registerSystem(new PlayerMovementSystem());
    world.registerSystem(new PlayerControllerBridgeSystem());
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
