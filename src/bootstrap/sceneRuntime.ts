import {
  ArcRotateCamera,
  Color3,
  DirectionalLight,
  Engine,
  HavokPlugin,
  HDRCubeTexture,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  type AbstractMesh,
  type TransformNode,
  Vector3,
} from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { AudioManager } from '../AudioManager.ts';
import { EffectManager } from '../EffectManager.ts';

export const COL_ENVIRONMENT = 0x0001;
export const COL_PLAYER = 0x0002;
export const COL_RAGDOLL = 0x0004;
export const COL_ENEMY = 0x0008;

export interface SceneRuntime {
  canvas: HTMLCanvasElement;
  engine: Engine;
  scene: Scene;
}

export async function createSceneRuntime(
  canvasId: string = 'renderCanvas',
): Promise<SceneRuntime> {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;

  if (!canvas) {
    throw new Error(`Canvas '#${canvasId}' was not found.`);
  }

  const engine = new Engine(canvas, true);
  const havokInstance = await HavokPhysics();
  const havokPlugin = new HavokPlugin(true, havokInstance);
  const scene = new Scene(engine);

  scene.enablePhysics(new Vector3(0, -15, 0), havokPlugin);
  scene.collisionsEnabled = true;

  EffectManager.init(scene);
  await AudioManager.init();

  return {
    canvas,
    engine,
    scene,
  };
}

export function createFollowCamera(scene: Scene, target: TransformNode) {
  const camera = new ArcRotateCamera(
    'camera',
    -Math.PI / 2,
    Math.PI / 2.5,
    20,
    Vector3.Zero(),
    scene,
  );

  camera.lockedTarget = target as unknown as AbstractMesh;
  camera.attachControl();
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 20;
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = Math.PI / 2 + 0.2;
  camera.checkCollisions = true;
  camera.collisionRadius = new Vector3(0.5, 0.5, 0.5);

  return camera;
}

export function createWorldEnvironment(
  scene: Scene,
  playerMesh: Mesh,
  enemyMeshes: AbstractMesh[],
) {
  const hdrTexture = new HDRCubeTexture('/hdr/skybox.hdr', scene, 1024);
  scene.environmentTexture = hdrTexture;
  scene.environmentIntensity = 1;
  scene.createDefaultSkybox(hdrTexture, true, 1000, 0);

  // get player bone names
  console.log(
    scene.getMeshByName('player').skeleton.bones.map((bone) => {
      return bone.name;
    }),
  );

  const ambientLight = new HemisphericLight(
    'light',
    new Vector3(0, 1, 0),
    scene,
  );
  ambientLight.intensity = 0.3;

  const ground = MeshBuilder.CreateGround(
    'ground',
    { width: 500, height: 500 },
    scene,
  );
  ground.position.y = 0;
  ground.checkCollisions = true;
  ground.receiveShadows = true;

  const groundMaterial = new StandardMaterial('groundMat', scene);
  groundMaterial.diffuseColor = new Color3(0.2, 0.8, 0.2);
  ground.material = groundMaterial;

  new PhysicsAggregate(
    ground,
    PhysicsShapeType.BOX,
    {
      mass: 0,
      restitution: 0.1,
      friction: 0.5,
    },
    scene,
  );

  const sun = new DirectionalLight('sun', new Vector3(-1, -2, -1), scene);
  sun.position = new Vector3(20, 40, 20);
  sun.intensity = 0.5;

  const shadowGenerator = new ShadowGenerator(1024, sun);
  shadowGenerator.addShadowCaster(playerMesh);
  enemyMeshes.forEach((mesh) => shadowGenerator.addShadowCaster(mesh));
  shadowGenerator.useExponentialShadowMap = true;

  scene.fogMode = Scene.FOGMODE_EXP;
  scene.fogDensity = 0.02;
  // for color white
  scene.fogColor = new Color3(0, 0, 0);
}

export function showPhysicsBodies(scene: Scene) {
  const nodes: Array<Mesh | TransformNode> = [
    ...scene.meshes,
    ...scene.transformNodes,
  ];

  void import('@babylonjs/core').then(({ PhysicsViewer }) => {
    const viewer = new PhysicsViewer(scene);

    nodes.forEach((node) => {
      if (node.physicsBody) {
        viewer.showBody(node.physicsBody);
      }
    });
  });
}
