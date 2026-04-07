import GUI from "lil-gui";
import type { Scene } from "@babylonjs/core";
import type { PlayerDebugApi } from "./ecs/player/api.ts";
import { gripConfig } from "./ecs/player/systems/WeaponEquipSystem.ts";

export class DebugGUI {
  gui: GUI;
  playerFolder: any;
  modelFolder: any;

  constructor() {
    this.gui = new GUI();
    this.gui.title("Debug Controls");
    // cerrar todos los folders por defecto
    this.closeAllFolders();
  }

  /**
   * Configurar controles para el jugador
   */
  setupPlayerControls(playerDebug: PlayerDebugApi) {
    this.playerFolder = this.gui.addFolder("Player");

    // Velocidades
    this.playerFolder
      .add(playerDebug, "moveSpeed", 1, 20, 0.5)
      .name("Move Speed");
    this.playerFolder
      .add(playerDebug, "jumpForce", 5, 20, 0.5)
      .name("Jump Force");
    this.playerFolder
      .add(playerDebug, "dashSpeed", 10, 40, 1)
      .name("Dash Speed");

    // Rotación del mesh principal
    const rotationFolder = this.playerFolder.addFolder("Rotation");
    rotationFolder
      .add(playerDebug.mesh.rotation, "x", -Math.PI, Math.PI, 0.01)
      .name("Capsule X");
    rotationFolder
      .add(playerDebug.mesh.rotation, "y", -Math.PI, Math.PI, 0.01)
      .name("Capsule Y");
    rotationFolder
      .add(playerDebug.mesh.rotation, "z", -Math.PI, Math.PI, 0.01)
      .name("Capsule Z");
    rotationFolder
      .add(playerDebug, "targetAngle", -Math.PI, Math.PI, 0.01)
      .name("Target Angle")
      .listen();
    rotationFolder.close();

    // Animation Handler
    if (playerDebug.animationHandler) {
      const animFolder = this.playerFolder.addFolder("Animation Blending");

      // Controles de blending
      const blendConfig = { blendDuration: 0.25 };
      animFolder
        .add(blendConfig, "blendDuration", 0, 1, 0.05)
        .name("Blend Duration (s)")
        .onChange((value: number) => {
          playerDebug.animationHandler.setBlendDuration(value);
        });

      // Forzar cambio de animación manual
      const animControls = {
        currentAnim: "idle",
        forcePlay: () => {
          playerDebug.animationHandler.play(animControls.currentAnim, {
            loop: true,
          });
        },
      };
      animFolder
        .add(animControls, "currentAnim", ["idle", "run", "jump"])
        .name("Manual Animation");
      animFolder.add(animControls, "forcePlay").name("Force Play");
      animFolder.close();
    }

    // Salud
    const healthFolder = this.playerFolder.addFolder("Health");
    healthFolder
      .add(playerDebug, "currentHealth", 0, playerDebug.maxHealth, 1)
      .name("HP")
      .listen();
    healthFolder.add(playerDebug, "maxHealth", 1, 10, 1).name("Max HP");
    healthFolder
      .add(playerDebug, "isInvulnerable")
      .name("Invulnerable")
      .listen();
    healthFolder.close();

    // Weapon Grip
    const weaponFolder = this.playerFolder.addFolder("Weapon Grip");
    weaponFolder.add(gripConfig, "positionX", -0.5, 0.5, 0.001).name("Pos X");
    weaponFolder.add(gripConfig, "positionY", -0.5, 0.5, 0.001).name("Pos Y");
    weaponFolder.add(gripConfig, "positionZ", -0.5, 0.5, 0.001).name("Pos Z");
    weaponFolder
      .add(gripConfig, "rotationX", -Math.PI, Math.PI, 0.01)
      .name("Rot X");
    weaponFolder
      .add(gripConfig, "rotationY", -Math.PI, Math.PI, 0.01)
      .name("Rot Y");
    weaponFolder
      .add(gripConfig, "rotationZ", -Math.PI, Math.PI, 0.01)
      .name("Rot Z");
    weaponFolder.close();

    this.playerFolder.close();
  }

  /**
   * Configurar controles para los modelos 3D del jugador
   */
  setupModelControls(playerMesh: any) {
    if (!playerMesh.animationModels) return;

    this.modelFolder = this.gui.addFolder("3D Models");

    const models = playerMesh.animationModels;

    // Idle Model
    if (models.idle?.root) {
      const idleFolder = this.modelFolder.addFolder("Idle Model");
      idleFolder
        .add(models.idle.root.position, "x", -2, 2, 0.1)
        .name("Position X");
      idleFolder
        .add(models.idle.root.position, "y", -2, 2, 0.1)
        .name("Position Y");
      idleFolder
        .add(models.idle.root.position, "z", -2, 2, 0.1)
        .name("Position Z");
      idleFolder
        .add(models.idle.root.rotation, "x", -Math.PI, Math.PI, 0.01)
        .name("Rotation X")
        .onChange(() => {
          models.idle.root.rotationQuaternion = null; // Eliminar quaternion para usar Euler
        });
      idleFolder
        .add(models.idle.root.rotation, "y", -Math.PI, Math.PI, 0.01)
        .name("Rotation Y")
        .onChange(() => {
          models.idle.root.rotationQuaternion = null;
        });
      idleFolder
        .add(models.idle.root.rotation, "z", -Math.PI, Math.PI, 0.01)
        .name("Rotation Z")
        .onChange(() => {
          models.idle.root.rotationQuaternion = null;
        });
      idleFolder
        .add(models.idle.root.scaling, "x", 0.1, 2, 0.1)
        .name("Scale X");
      idleFolder
        .add(models.idle.root.scaling, "y", 0.1, 2, 0.1)
        .name("Scale Y");
      idleFolder
        .add(models.idle.root.scaling, "z", 0.1, 2, 0.1)
        .name("Scale Z");
      idleFolder.close();
    }

    // Run Model
    if (models.run?.root) {
      const runFolder = this.modelFolder.addFolder("Run Model");
      runFolder
        .add(models.run.root.position, "x", -2, 2, 0.1)
        .name("Position X");
      runFolder
        .add(models.run.root.position, "y", -2, 2, 0.1)
        .name("Position Y");
      runFolder
        .add(models.run.root.position, "z", -2, 2, 0.1)
        .name("Position Z");
      runFolder
        .add(models.run.root.rotation, "x", -Math.PI, Math.PI, 0.01)
        .name("Rotation X")
        .onChange(() => {
          models.run.root.rotationQuaternion = null;
        });
      runFolder
        .add(models.run.root.rotation, "y", -Math.PI, Math.PI, 0.01)
        .name("Rotation Y")
        .onChange(() => {
          models.run.root.rotationQuaternion = null;
        });
      runFolder
        .add(models.run.root.rotation, "z", -Math.PI, Math.PI, 0.01)
        .name("Rotation Z")
        .onChange(() => {
          models.run.root.rotationQuaternion = null;
        });
      runFolder.add(models.run.root.scaling, "x", 0.1, 2, 0.1).name("Scale X");
      runFolder.add(models.run.root.scaling, "y", 0.1, 2, 0.1).name("Scale Y");
      runFolder.add(models.run.root.scaling, "z", 0.1, 2, 0.1).name("Scale Z");
      runFolder.close();
    }

    // Jump Model
    if (models.jump?.root) {
      const jumpFolder = this.modelFolder.addFolder("Jump Model");
      jumpFolder
        .add(models.jump.root.position, "x", -2, 2, 0.1)
        .name("Position X");
      jumpFolder
        .add(models.jump.root.position, "y", -2, 2, 0.1)
        .name("Position Y");
      jumpFolder
        .add(models.jump.root.position, "z", -2, 2, 0.1)
        .name("Position Z");
      jumpFolder
        .add(models.jump.root.rotation, "x", -Math.PI, Math.PI, 0.01)
        .name("Rotation X")
        .onChange(() => {
          models.jump.root.rotationQuaternion = null;
        });
      jumpFolder
        .add(models.jump.root.rotation, "y", -Math.PI, Math.PI, 0.01)
        .name("Rotation Y")
        .onChange(() => {
          models.jump.root.rotationQuaternion = null;
        });
      jumpFolder
        .add(models.jump.root.rotation, "z", -Math.PI, Math.PI, 0.01)
        .name("Rotation Z")
        .onChange(() => {
          models.jump.root.rotationQuaternion = null;
        });
      jumpFolder
        .add(models.jump.root.scaling, "x", 0.1, 2, 0.1)
        .name("Scale X");
      jumpFolder
        .add(models.jump.root.scaling, "y", 0.1, 2, 0.1)
        .name("Scale Y");
      jumpFolder
        .add(models.jump.root.scaling, "z", 0.1, 2, 0.1)
        .name("Scale Z");
      jumpFolder.close();
    }

    this.modelFolder.close();
  }

  /**
   * Configurar controles para enemigos
   */
  setupEnemyControls(enemies: any[]) {
    const enemiesFolder = this.gui.addFolder("Enemies");

    enemies.forEach((enemy, index) => {
      const enemyFolder = enemiesFolder.addFolder(`Enemy ${index + 1}`);
      enemyFolder.add(enemy, "hp", 0, enemy.maxHP, 1).name("HP").listen();
      enemyFolder.add(enemy, "patrolSpeed", 0, 10, 0.5).name("Patrol Speed");
      enemyFolder.add(enemy, "chaseSpeed", 0, 15, 0.5).name("Chase Speed");
      enemyFolder
        .add(enemy, "visionRange", 1, 20, 0.5)
        .name("Vision Range")
        .onChange((value: number) => {
          enemy.setVisionRange(value);
        });
      enemyFolder
        .add(enemy, "debugMode")
        .name("Debug Mode")
        .onChange((value: boolean) => {
          enemy.setDebugMode(value);
        });
      enemyFolder.close();
    });
    enemiesFolder.close();
  }

  /**
   * Configurar controles para la cámara
   */
  setupCameraControls(camera: any) {
    const cameraFolder = this.gui.addFolder("Camera");
    cameraFolder
      .add(camera, "alpha", -Math.PI * 2, Math.PI * 2, 0.01)
      .name("Alpha (H Rotation)");
    cameraFolder.add(camera, "beta", 0, Math.PI, 0.01).name("Beta (V Angle)");
    cameraFolder.add(camera, "radius", 3, 20, 0.5).name("Radius (Distance)");
    cameraFolder.close();
  }

  /**
   * Botón para imprimir valores actuales en consola
   */
  addLogButton(playerDebug: PlayerDebugApi) {
    const actions = {
      logRotation: () => {
        console.log("=== PLAYER ROTATION DEBUG ===");
        console.log("Capsule rotation:", playerDebug.mesh.rotation);
        console.log("Target angle:", playerDebug.targetAngle);
        console.log("Target rotation:", playerDebug.targetRotation);

        if (playerDebug.mesh.animationModels) {
          const models = playerDebug.mesh.animationModels;
          console.log("Idle rotation:", models.idle?.root.rotation);
          console.log("Run rotation:", models.run?.root.rotation);
          console.log("Jump rotation:", models.jump?.root.rotation);

          if (models.idle?.root.rotationQuaternion) {
            console.log(
              "Idle quaternion:",
              models.idle.root.rotationQuaternion,
            );
          }
          if (models.run?.root.rotationQuaternion) {
            console.log("Run quaternion:", models.run.root.rotationQuaternion);
          }
          if (models.jump?.root.rotationQuaternion) {
            console.log(
              "Jump quaternion:",
              models.jump.root.rotationQuaternion,
            );
          }
        }
        console.log("=============================");
      },
    };

    this.gui.add(actions, "logRotation").name("🔍 Log Rotation Values");
  }

  /**
   * Wireframe toggle for all scene meshes + physics bodies viewer
   */
  setupSceneControls(scene: Scene) {
    const sceneFolder = this.gui.addFolder("Scene");

    const state = { wireframe: false };

    sceneFolder
      .add(state, "wireframe")
      .name("Wireframe")
      .onChange((enabled: boolean) => {
        scene.meshes.forEach((mesh) => {
          if (mesh.material) {
            mesh.material.wireframe = enabled;
          }
        });
      });

    const physicsAction = {
      showPhysicsBodies: () => {
        void import("@babylonjs/core").then(({ PhysicsViewer }) => {
          const viewer = new PhysicsViewer(scene);
          [...scene.meshes, ...scene.transformNodes].forEach((node) => {
            if (node.physicsBody) viewer.showBody(node.physicsBody);
          });
        });
      },
    };

    sceneFolder
      .add(physicsAction, "showPhysicsBodies")
      .name("Show Physics Bodies");
    sceneFolder.close();
  }

  // close all folders
  closeAllFolders() {
    this.gui.folders &&
      Object.values(this.gui.folders).forEach((folder: any) => folder.close());
  }

  /**
   * Limpiar y destruir el GUI
   */
  dispose() {
    this.gui.destroy();
  }
}
