import {
  ArcRotateCamera,
  DirectionalLight,
  Engine,
  HavokPlugin,
  HDRCubeTexture,
  HemisphericLight,
  Material,
  Mesh,
  PhysicsAggregate,
  PhysicsShapeType,
  Scene,
  ImportMeshAsync,
  ShadowGenerator,
  type AbstractMesh,
  type TransformNode,
  Vector3,
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import { AudioManager } from "../AudioManager.ts";
import { EffectManager } from "../EffectManager.ts";

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
  canvasId: string = "renderCanvas",
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
    "camera",
    -Math.PI / 2,
    Math.PI / 2.5,
    100,
    Vector3.Zero(),
    scene,
  );

  camera.lockedTarget = target as unknown as AbstractMesh;
  camera.attachControl();
  camera.minZ = 0.05;
  camera.maxZ = 500;
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 140;
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = Math.PI / 2 + 0.2;
  camera.checkCollisions = true;
  camera.collisionRadius = new Vector3(0.5, 0.5, 0.5);

  return camera;
}

export async function createWorldEnvironment(
  scene: Scene,
  playerMesh: Mesh,
  enemyMeshes: AbstractMesh[],
) {
  const hdrTexture = new HDRCubeTexture("/hdr/skybox.hdr", scene, 1024);
  scene.environmentTexture = hdrTexture;
  scene.environmentIntensity = 1;
  scene.createDefaultSkybox(hdrTexture, true, 1000, 0);

  const ambientLight = new HemisphericLight(
    "light",
    new Vector3(0, 1, 0),
    scene,
  );
  ambientLight.intensity = 0.3;

  // Load town environment model
  const result = await ImportMeshAsync("/models/misty-town.glb", scene);
  const importedMeshes = result.meshes;
  const townRoot = result.meshes[0];
  townRoot.name = "misty-town-root";
  townRoot.position = Vector3.Zero();
  // Adjust scale if the town appears too large or too small at runtime
  townRoot.scaling = new Vector3(1.5, 1.5, 1.5);

  // Force world matrices to propagate the scale before we freeze/merge
  townRoot.computeWorldMatrix(true);

  for (const mesh of importedMeshes) {
    mesh.alwaysSelectAsActiveMesh = mesh.getTotalVertices() === 0;
    mesh.computeWorldMatrix(true);
  }

  const importedMaterials = new Set<NonNullable<AbstractMesh["material"]>>();

  for (const mesh of importedMeshes) {
    if (!mesh.material) {
      continue;
    }

    importedMaterials.add(mesh.material);

    if (
      "subMaterials" in mesh.material &&
      Array.isArray(mesh.material.subMaterials)
    ) {
      for (const subMaterial of mesh.material.subMaterials) {
        if (subMaterial) {
          importedMaterials.add(subMaterial);
        }
      }
    }
  }

  for (const material of importedMaterials) {
    if (!material) {
      continue;
    }

    const materialName = material.name.toLowerCase();
    const isGlassMaterial = materialName.includes("glass");
    const isCutoutMaterial = false;
    // materialName.includes("grass") ||
    // materialName.includes("tree") ||
    // materialName.includes("flower") ||
    // materialName.includes("leaf") ||
    // materialName.includes("bush") ||
    // materialName.includes("decal") ||
    // materialName.includes("sign");

    material.needDepthPrePass = isGlassMaterial || isCutoutMaterial;
    material.separateCullingPass = false;
    material.backFaceCulling = false;

    if ("transparencyMode" in material) {
      if (isGlassMaterial) {
        material.transparencyMode = Material.MATERIAL_ALPHABLEND;
      } else if (isCutoutMaterial) {
        material.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
      } else {
        material.transparencyMode = Material.MATERIAL_OPAQUE;
      }
    }

    if (isCutoutMaterial) {
      material.forceDepthWrite = true;
    }

    if (isGlassMaterial) {
      if ("useAlphaFromAlbedoTexture" in material) {
        material.useAlphaFromAlbedoTexture = true;
      }

      if ("useAlphaFromDiffuseTexture" in material) {
        material.useAlphaFromDiffuseTexture = true;
      }
    }

    if ("twoSidedLighting" in material) {
      material.twoSidedLighting = isGlassMaterial || isCutoutMaterial;
    }
  }

  const geometryMeshes = importedMeshes.filter(
    (m) => m.getTotalVertices() > 0,
  ) as Mesh[];

  // Freeze all static town meshes to prevent per-frame transform + bounding recomputes,
  // then give each its own static Havok shape (reliable, no merge failures).
  for (const mesh of geometryMeshes) {
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.receiveShadows = false;
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(true, true);
    mesh.freezeWorldMatrix();
    mesh.material?.freeze();

    new PhysicsAggregate(
      mesh,
      PhysicsShapeType.MESH,
      { mass: 0, restitution: 0.1, friction: 0.7 },
      scene,
    );
  }

  const sun = new DirectionalLight("sun", new Vector3(-1, -2, -1), scene);
  sun.position = new Vector3(20, 40, 20);
  sun.intensity = 0.5;

  const shadowGenerator = new ShadowGenerator(1024, sun);
  shadowGenerator.addShadowCaster(playerMesh);
  enemyMeshes.forEach((mesh) => shadowGenerator.addShadowCaster(mesh));
  shadowGenerator.useExponentialShadowMap = true;

  // scene.fogMode = Scene.FOGMODE_EXP;
  // scene.fogDensity = 0.02;
  // scene.fogColor = new Color3(0, 0, 0);
}
