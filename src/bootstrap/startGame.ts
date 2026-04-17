import '@babylonjs/core/Cameras/Inputs';
import '@babylonjs/loaders/glTF';
import { Vector3 } from '@babylonjs/core';
import {
  EnemySpawner,
  EnemyUiManager,
  type PlayerDebugApi,
} from '../ecs/index.ts';
import { preloadDroppedWeaponAssets } from '../ecs/weapons/createDroppedWeaponEntity.ts';
import type { EnemyRuntimeFacade } from '../ecs/enemy/EnemyRuntimeFacade.ts';
import type { RuntimePlayerMesh } from './playerBootstrap.ts';
import { createGameFlowUi } from './createGameFlowUi.ts';
import {
  bootstrapPlayerEcsRuntime,
  loadPlayerCharacter,
} from './playerBootstrap.ts';
import {
  createFollowCamera,
  createSceneRuntime,
  createWorldEnvironment,
  showPhysicsBodies,
} from './sceneRuntime.ts';

const ENEMY_MODEL_PATH = '/models/ladron.glb';
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
  displayName: 'Bandit',
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
  const { ecsRuntime, playerDebugApi } = bootstrapPlayerEcsRuntime({
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

  createWorldEnvironment(
    scene,
    playerMesh,
    enemies.flatMap((enemy) => enemy.meshes),
  );

  createGameFlowUi(scene, ecsRuntime.gameFlow);
  await setupOptionalDebugTools(playerDebugApi, playerMesh, enemies, camera);

  engine.runRenderLoop(() => {
    scene.render();
  });

  window.addEventListener('resize', () => {
    engine.resize();
  });
}

async function setupOptionalDebugTools(
  playerDebugApi: PlayerDebugApi,
  playerMesh: RuntimePlayerMesh,
  enemies: EnemyRuntimeFacade[],
  camera: ReturnType<typeof createFollowCamera>,
) {
  const searchParams = new URLSearchParams(window.location.search);

  if (!searchParams.has('debug')) {
    return;
  }

  const [{ DebugGUI }] = await Promise.all([import('../DebugGUI.ts')]);

  const debugGui = new DebugGUI();
  debugGui.setupPlayerControls(playerDebugApi);
  debugGui.addLogButton(playerDebugApi);
  debugGui.setupModelControls(playerMesh);
  debugGui.setupEnemyControls(enemies);
  debugGui.setupCameraControls(camera);
  debugGui.setupSceneControls(camera.getScene());

  if (searchParams.has('physics')) {
    showPhysicsBodies(camera.getScene());
  }
}
