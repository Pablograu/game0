import type { Scene } from '@babylonjs/core';
import type { EntityId } from '../core/Entity.ts';
import { World } from '../core/World.ts';
import {
  EnemyAnimationSystem,
  EnemyAttackSystem,
  EnemyContactDamageSystem,
  EnemyDamageSystem,
  EnemyDespawnSystem,
  EnemyDecisionSystem,
  EnemyLootSystem,
  EnemyMovementSystem,
  EnemyStuckSystem,
  EnemySurvivabilitySystem,
} from '../enemy/index.ts';
import {
  createGameFlowControllerApi,
  createGameFlowEntity,
  GameFlowInputGateSystem,
  GameFlowRuntimeSystem,
  GameFlowStateSystem,
  GameFlowUiSystem,
  type GameFlowControllerApi,
  type GameFlowEngineControl,
} from '../game/index.ts';
import {
  createPlayerEntity,
  PlayerAnimationSystem,
  PlayerCameraAimSystem,
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
  WeaponEquipSystem,
  WeaponPickupSystem,
  WeaponProximitySystem,
  WeaponShootSystem,
} from '../player/index.ts';
import type { PlayerBootstrapRuntime } from '../player/runtime/playerRuntime.ts';

export interface BootstrapGameEcsOptions extends PlayerBootstrapRuntime {
  engine?: GameFlowEngineControl | null;
  reloadGame?: (() => void) | null;
}

export interface GameEcsRuntime {
  readonly world: World;
  readonly playerEntityId: EntityId | null;
  readonly gameFlowEntityId: EntityId | null;
  readonly gameFlow: GameFlowControllerApi | null;
  dispose(): void;
}

export function bootstrapGameEcs(
  options: BootstrapGameEcsOptions,
): GameEcsRuntime {
  const world = new World();
  const gameFlowEntityId = createGameFlowEntity({
    world,
    engine: options.engine ?? null,
    reloadGame: options.reloadGame ?? null,
  });
  const gameFlow = createGameFlowControllerApi(world, gameFlowEntityId);
  let playerEntityId: EntityId | null = null;

  world.registerSystem(new GameFlowStateSystem());
  world.registerSystem(new GameFlowInputGateSystem());
  world.registerSystem(new GameFlowRuntimeSystem());
  world.registerSystem(new GameFlowUiSystem());
  world.registerSystem(new EnemyDecisionSystem());
  world.registerSystem(new EnemyStuckSystem());
  world.registerSystem(new EnemyMovementSystem());
  world.registerSystem(new EnemyContactDamageSystem());
  world.registerSystem(new EnemyDamageSystem());
  world.registerSystem(new EnemyAttackSystem());
  world.registerSystem(new EnemySurvivabilitySystem());
  world.registerSystem(new EnemyLootSystem());
  world.registerSystem(new EnemyDespawnSystem());
  world.registerSystem(new EnemyAnimationSystem());

  if (options.playerMesh) {
    playerEntityId = createPlayerEntity({
      world,
      ...options,
    });

    world.registerSystem(new PlayerInputSystem());
    world.registerSystem(new WeaponProximitySystem());
    world.registerSystem(new WeaponPickupSystem());
    world.registerSystem(new WeaponEquipSystem());
    world.registerSystem(new PlayerDamageSystem());
    world.registerSystem(new PlayerSurvivabilitySystem());
    world.registerSystem(new PlayerGameOverSystem());
    world.registerSystem(new PlayerGroundProbeSystem());
    world.registerSystem(new PlayerCombatSystem());
    world.registerSystem(new WeaponShootSystem());
    world.registerSystem(new PlayerDashSystem());
    world.registerSystem(new PlayerJumpSystem());
    world.registerSystem(new PlayerMovementSystem());
    world.registerSystem(new PlayerWeaponHitSystem());
    world.registerSystem(new PlayerAnimationSystem());
    world.registerSystem(new PlayerCameraAimSystem());
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
    gameFlowEntityId,
    gameFlow,
    dispose() {
      options.scene.onBeforeRenderObservable.remove(updateObserver);
    },
  };
}
