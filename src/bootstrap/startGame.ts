import "@babylonjs/core/Cameras/Inputs";
import "@babylonjs/loaders/glTF";
import { preloadDroppedWeaponAssets } from "../ecs/weapons/createDroppedWeaponEntity.ts";
import { createGameFlowUi } from "./createGameFlowUi.ts";
import "@babylonjs/core/Cameras/Inputs";
import "@babylonjs/loaders/glTF";
import "@babylonjs/inspector";
import { KeyboardEventTypes, Vector3, type Scene } from "@babylonjs/core";
import { EnemySpawner, EnemyUiManager } from "../ecs/index.ts";
import {
  bootstrapPlayerEcsRuntime,
  loadPlayerCharacter,
} from "./playerBootstrap.ts";
import {
  createFollowCamera,
  createSceneRuntime,
  createWorldEnvironment,
} from "./sceneRuntime.ts";

const ENEMY_MODEL_PATH = "/models/ladron.glb";
const ENEMY_COUNT = 20;
const ENEMY_MIN_DISTANCE = 5;
const ENEMY_MAX_DISTANCE = 25;

function generateEnemyPositions(count: number): Vector3[] {
  const positions: Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance =
      ENEMY_MIN_DISTANCE +
      Math.random() * (ENEMY_MAX_DISTANCE - ENEMY_MIN_DISTANCE);
    positions.push(
      new Vector3(Math.cos(angle) * distance, 40, Math.sin(angle) * distance),
    );
  }
  return positions;
}
const INITIAL_ENEMY_CONFIG = {
  hp: 1,
  mass: 2,
  knockbackForce: 5,
  contactDamage: 1,
  patrolSpeed: 2,
  chaseSpeed: 4,
  visionRange: 8,
  chaseGiveUpRange: 14,
  attackRange: 2,
  attackCooldown: 1.5,
  displayName: "Bandit",
  debug: true,
};

export async function startGame() {
  const { engine, scene } = await createSceneRuntime();
  const enemyUi = new EnemyUiManager(scene);

  scene.onDisposeObservable.add(() => {
    enemyUi.dispose();
  });

  await Promise.all([
    EnemySpawner.preload(ENEMY_MODEL_PATH, scene),
    preloadDroppedWeaponAssets(scene),
  ]);

  const { playerAnimations, playerMesh, shoulderAnchor } =
    await loadPlayerCharacter(scene);
  const camera = createFollowCamera(scene, shoulderAnchor);
  const { ecsRuntime } = bootstrapPlayerEcsRuntime({
    camera,
    enemyUi,
    engine,
    playerAnimations,
    playerMesh,
    scene,
    shoulderAnchor,
  });

  const enemies = EnemySpawner.spawnMultiple(
    ecsRuntime.world,
    ENEMY_MODEL_PATH,
    scene,
    generateEnemyPositions(ENEMY_COUNT),
    INITIAL_ENEMY_CONFIG,
  );

  await createWorldEnvironment(
    scene,
    playerMesh,
    enemies.flatMap((enemy) => enemy.meshes),
  );

  createGameFlowUi(scene, ecsRuntime.gameFlow);
  setupInspectorToggle(scene);

  engine.runRenderLoop(() => {
    scene.render();
  });

  window.addEventListener("resize", () => {
    engine.resize();
  });
}

function setupInspectorToggle(scene: Scene) {
  let toggleInFlight = false;

  const keyboardObserver = scene.onKeyboardObservable.add(
    async (keyboardInfo) => {
      if (keyboardInfo.type !== KeyboardEventTypes.KEYDOWN) {
        return;
      }

      const event = keyboardInfo.event as KeyboardEvent;
      const key = event.key.toLowerCase();

      if (
        key !== "i" ||
        !event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.repeat ||
        shouldIgnoreInspectorHotkeyTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();

      if (toggleInFlight) {
        return;
      }

      toggleInFlight = true;

      try {
        if (scene.debugLayer.isVisible()) {
          scene.debugLayer.hide();
          return;
        }

        await scene.debugLayer.show();
      } catch (error) {
        console.error(
          "Failed to open Babylon Inspector. Restart the Vite dev server so it can rebuild optimized dependencies for the inspector bundle.",
          error,
        );
      } finally {
        toggleInFlight = false;
      }
    },
  );

  scene.onDisposeObservable.add(() => {
    if (keyboardObserver) {
      scene.onKeyboardObservable.remove(keyboardObserver);
    }
  });
}

function shouldIgnoreInspectorHotkeyTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}
