import type { Camera, Mesh, Scene } from '@babylonjs/core';
import type { PlayerController } from '../../player/PlayerController.ts';
import type { EntityId } from '../core/Entity.ts';
import { World } from '../core/World.ts';
import { createPlayerEntity } from '../player/index.ts';

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
