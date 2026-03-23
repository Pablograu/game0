import "./style.css";
import {
  ArcRotateCamera,
  Engine,
  HavokPlugin,
  HDRCubeTexture,
  HemisphericLight,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  Quaternion,
  Scene,
  Vector3,
  PhysicsViewer,
  Mesh,
} from "@babylonjs/core";
import { ImportMeshAsync } from "@babylonjs/core/Loading";
import "@babylonjs/core/Cameras/Inputs";
import "@babylonjs/loaders/glTF";
import HavokPhysics from "@babylonjs/havok";
import { PlayerController } from "./PlayerController.ts";
import { EnemyFactory } from "./EnemyFactory.ts";
import { EffectManager } from "./EffectManager.ts";
import { CameraShaker } from "./CameraShaker.ts";
import { GameManager } from "./GameManager.ts";
import { DebugGUI } from "./DebugGUI.ts";
import { AudioManager } from "./AudioManager.ts";

// Collision filter bitmasks
const COL_ENVIRONMENT = 0x0001;
const COL_PLAYER = 0x0002;
const COL_RAGDOLL = 0x0004;
const COL_ENEMY = 0x0008;

class Game {
  canvas: HTMLCanvasElement;
  engine: Engine;
  scene!: Scene;
  player: any;
  camera: ArcRotateCamera | null = null;
  cameraShaker: CameraShaker | null = null;
  playerController: PlayerController | null = null;
  enemies: any[] = [];
  debugGUI: DebugGUI | null = null;
  gameManager: GameManager | null = null;

  constructor() {
    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.engine = new Engine(this.canvas, true);

    this.init();
  }

  async init() {
    await this.initHavok();
    // Inicializar EffectManager
    EffectManager.init(this.scene);
    // Inicializar AudioManager (async — preloads all sounds)
    await AudioManager.init();
    this.createLighting();
    await this.loadEnvironment(); // Cargar oldtown.glb
    await this.preloadEnemyAssets(); // Precargar modelo del ladrón
    this.player = await this.createPlayer();
    this.camera = this.createCamera();
    this.setupPlayerController();
    await this.createEnemies();
    this.setupGameManager();
    // this.setupDebugGUI();
    this.startRenderLoop();
    this.setupResize();
    // this.setupPhysicsVisualizer();
  }

  async initHavok() {
    // Inicializar física Havok
    const havokInstance = await HavokPhysics();
    const havokPlugin = new HavokPlugin(true, havokInstance);
    this.scene = new Scene(this.engine);
    this.scene.enablePhysics(new Vector3(0, -15, 0), havokPlugin);

    // Habilitar colisiones en la escena
    this.scene.collisionsEnabled = true;
    console.log("Física Havok inicializada");
  }

  setupPhysicsVisualizer() {
    const viewer = new PhysicsViewer(this.scene);

    // Meshes carry physics bodies (capsule, ground, environment, etc.)
    this.scene.meshes.forEach((mesh) => {
      if (mesh.physicsBody) {
        viewer.showBody(mesh.physicsBody);
      }
    });

    // Transform nodes (ragdoll bones, etc.)
    this.scene.transformNodes.forEach((node) => {
      if (node.physicsBody) {
        viewer.showBody(node.physicsBody);
      }
    });
  }

  createCamera() {
    // Crear cámara de tercera persona (ArcRotate)
    const camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2, // Alpha (rotación horizontal inicial)
      Math.PI / 3, // Beta (ángulo vertical)
      10, // Radio (distancia inicial)
      Vector3.Zero(),
      this.scene,
    );

    // Target al jugador
    camera.lockedTarget = this.player;

    // Habilitar controles
    camera.attachControl();

    // Configurar límites de zoom
    camera.lowerRadiusLimit = 3; // No puede acercarse más de 3 unidades
    camera.upperRadiusLimit = 20; // No puede alejarse más de 20 unidades

    // Habilitar colisiones de cámara
    camera.checkCollisions = true;
    camera.collisionRadius = new Vector3(0.5, 0.5, 0.5); // Elipsoide de colisión

    console.log("Cámara de tercera persona creada con colisiones");
    return camera;
  }

  setupPlayerController() {
    // Configurar la cámara para seguir al jugador
    if (this.camera && this.player) {
      this.camera.lockedTarget = this.player;
    }
    // Inicializar CameraShaker
    this.cameraShaker = new CameraShaker(this.camera, this.scene);

    // Instanciar el controlador con la cámara ya creada
    this.playerController = new PlayerController(
      this.player,
      this.camera,
      this.scene,
      this.cameraShaker,
    );

    // Tunear valores
    this.playerController.setMoveSpeed(8);
    this.playerController.setJumpForce(12);

    // Inicializar AnimationHandler ahora que los modelos están cargados
    this.playerController.setupAnimationHandler();
    this.playerController.initRagdoll(
      this.player.skeleton,
      this.player.armatureNode,
    );

    console.log("PlayerController inicializado");
  }

  setupGameManager() {
    // Crear el GameManager para controlar el flujo de la partida
    this.gameManager = new GameManager(this.scene, this.engine);

    // Asignar referencias
    this.gameManager.setPlayerController(this.playerController);
    this.gameManager.setEnemies(this.enemies);
    this.gameManager.setCamera(this.camera);

    // Asignar GameManager al PlayerController para que pueda notificarlo de muerte
    this.playerController.setGameManager(this.gameManager);

    console.log("GameManager inicializado");
  }

  createLighting() {
    // ===== HDR ENVIRONMENT (iluminación + skybox) =====
    const hdrTexture = new HDRCubeTexture(
      "/hdr/skybox.hdr",
      this.scene,
      512, // resolución (128, 256, 512, 1024)
    );

    // Usar el HDR como iluminación ambiental de la escena
    this.scene.environmentTexture = hdrTexture;
    this.scene.environmentIntensity = 1.0; // Ajusta intensidad (0.0 - 2.0)

    // Crear skybox visible a partir del mismo HDR
    this.scene.createDefaultSkybox(
      hdrTexture,
      true, // pbr = true para calidad alta
      1000, // tamaño del skybox
      0.0, // blur (0 = nítido, 1 = muy difuminado)
    );

    // Luz hemisférica de respaldo (por si el HDR es muy oscuro)
    const light = new HemisphericLight(
      "light",
      new Vector3(0, 1, 0),
      this.scene,
    );
    light.intensity = 0.3;

    console.log("HDR skybox cargado: /hdr/skybox.hdr");
  }

  async loadEnvironment() {
    // Cargar el modelo oldtown.glb como entorno
    console.log("Cargando entorno oldtown.glb...");

    const result = await ImportMeshAsync("/models/oldtown.glb", this.scene);

    console.log("Entorno cargado:", result.meshes.length, "meshes");

    // Obtener el root del modelo
    const root = result.meshes[0];

    // ===== AJUSTAR TAMAÑO Y POSICIÓN AQUÍ =====
    root.position = new Vector3(0, 0, 0); // Ajusta X, Y, Z
    root.scaling = new Vector3(0.1, 0.1, 0.1); // Ajusta escala (1 = tamaño original)
    // ==========================================

    // Configurar colisiones para todos los meshes del entorno
    result.meshes.forEach((mesh) => {
      if (mesh.name !== "__root__") {
        mesh.checkCollisions = true;

        // Añadir física estática a los meshes sólidos
        if (mesh.getTotalVertices() > 0) {
          const envAggregate = new PhysicsAggregate(
            mesh,
            PhysicsShapeType.MESH,
            {
              mass: 0, // Estático
              restitution: 0.3,
              friction: 0.5,
            },
            this.scene,
          );
          // Environment collides with everything
          if (envAggregate.shape) {
            envAggregate.shape.filterMembershipMask = COL_ENVIRONMENT;
            envAggregate.shape.filterCollideMask =
              COL_PLAYER | COL_RAGDOLL | COL_ENEMY;
          }
        }
      }
    });

    console.log("Entorno oldtown.glb configurado con física");
  }

  async createPlayer() {
    // ===== CARGAR MODELO CON TODAS LAS ANIMACIONES =====
    console.log("Loading animated character...");

    const result = await ImportMeshAsync("/models/player.glb", this.scene);
    const rootMesh = result.meshes[0];
    const skeleton = result.skeletons[0];
    const armatureNode = result.transformNodes.find(
      (node) => node.name === "Armature",
    );
    const animationGroups = result.animationGroups;

    // ===== CREATE CAPSULE & SET UP HIERARCHY BEFORE RAGDOLL =====
    const physicsCapsule = MeshBuilder.CreateCapsule(
      "player",
      {
        height: 2.2,
        radius: 0.5,
      },
      this.scene,
    );

    physicsCapsule.position = new Vector3(0, 4, 0);
    physicsCapsule.isVisible = false;
    physicsCapsule.checkCollisions = true;
    physicsCapsule.scaling = new Vector3(1, 1, 1);
    physicsCapsule.rotationQuaternion = Quaternion.FromEulerAngles(
      0,
      Math.PI,
      0,
    );

    rootMesh.parent = physicsCapsule;
    rootMesh.position = new Vector3(0, -1.1, 0);

    // Store for ragdoll init in PlayerController
    (physicsCapsule as any).skeleton = skeleton;
    (physicsCapsule as any).armatureNode = armatureNode;

    // Encontrar animaciones por nombre
    console.log(
      "Animation groups found:",
      animationGroups.map((ag) => ag.name),
    );

    const idleAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === "idle",
    );
    const runAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === "run",
    );
    const jumpAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === "jump",
    );
    const punchLAnim = animationGroups.find((ag) => ag.name === "punch_L");
    const punchRAnim = animationGroups.find((ag) => ag.name === "punch_R");
    const dancingAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === "macarena",
    );

    const dashAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === "dash",
    );

    const deadAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === "dead",
    );

    const fallingAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === "falling",
    );

    const hitAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === "hit",
    );

    const landingAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === "land",
    );

    const walkAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === "walk",
    );

    const flyingKick = animationGroups.find(
      (ag) => ag.name.toLowerCase() === "flying_kick",
    );

    const stumbleBack = animationGroups.find(
      (ag) => ag.name.toLowerCase() === "stumble_back",
    );

    if (
      [
        idleAnim,
        runAnim,
        jumpAnim,
        punchLAnim,
        punchRAnim,
        dancingAnim,
        dashAnim,
        deadAnim,
        fallingAnim,
        hitAnim,
        landingAnim,
        walkAnim,
        flyingKick,
        stumbleBack,
      ].some((anim) => !anim)
    ) {
      console.error(
        "No se encontraron todas las animaciones necesarias. Animaciones encontradas:",
      );
    }

    // Detener todas las animaciones inicialmente
    for (const ag of animationGroups) {
      ag.stop();
    }

    // Add physics to the capsule
    const capsuleAggregate = new PhysicsAggregate(
      physicsCapsule,
      PhysicsShapeType.CAPSULE,
      {
        mass: 1,
        restitution: 0,
        friction: 0.5,
      },
      this.scene,
    );

    // Capsule is PLAYER — collides with ENVIRONMENT + ENEMY, NOT with RAGDOLL bones
    if (capsuleAggregate.shape) {
      capsuleAggregate.shape.filterMembershipMask = COL_PLAYER;
      capsuleAggregate.shape.filterCollideMask = COL_ENVIRONMENT | COL_ENEMY;
    }

    // Guardar referencias de animaciones en la cápsula
    physicsCapsule.animationModels = {
      idle: { root: rootMesh, animations: idleAnim ? [idleAnim] : [] },
      run: { root: rootMesh, animations: runAnim ? [runAnim] : [] },
      jump: { root: rootMesh, animations: jumpAnim ? [jumpAnim] : [] },
      punch_L: { root: rootMesh, animations: punchLAnim ? [punchLAnim] : [] },
      punch_R: { root: rootMesh, animations: punchRAnim ? [punchRAnim] : [] },
      macarena: {
        root: rootMesh,
        animations: dancingAnim ? [dancingAnim] : [],
      },
      dash: { root: rootMesh, animations: dashAnim ? [dashAnim] : [] },
      dead: { root: rootMesh, animations: deadAnim ? [deadAnim] : [] },
      falling: { root: rootMesh, animations: fallingAnim ? [fallingAnim] : [] },
      hit: { root: rootMesh, animations: hitAnim ? [hitAnim] : [] },
      land: { root: rootMesh, animations: landingAnim ? [landingAnim] : [] },
      walk: { root: rootMesh, animations: walkAnim ? [walkAnim] : [] },
      flying_kick: {
        root: rootMesh,
        animations: flyingKick ? [flyingKick] : [],
      },
      stumble_back: {
        root: rootMesh,
        animations: stumbleBack ? [stumbleBack] : [],
      },
    };

    return physicsCapsule;
  }

  async preloadEnemyAssets() {
    await EnemyFactory.preload("/models/ladron.glb", this.scene);
    console.log("Enemy assets precargados");
  }

  async createEnemies() {
    const LADRON_PATH = "/models/ladron.glb";

    const enemyPositions = [
      new Vector3(3, 5, 13),
      new Vector3(-3, 5, 15),
      new Vector3(0, 5, -15),
    ];

    const enemyConfig = {
      hp: 3,
      mass: 2,
      knockbackForce: 5,
      contactDamage: 1,
      patrolSpeed: 2,
      chaseSpeed: 4,
      visionRange: 8,
      chaseGiveUpRange: 14,
      attackRange: 2,
      attackCooldown: 1.5,
      debug: true,
    };

    this.enemies = EnemyFactory.spawnMultiple(
      LADRON_PATH,
      this.scene,
      enemyPositions,
      enemyConfig,
    );

    // Asignar referencia al player y registrar en WeaponSystem
    for (const enemy of this.enemies) {
      enemy.setPlayerRef(this.playerController);
    }
    this.playerController.registerEnemies(this.enemies);

    console.log(`${this.enemies.length} enemigos creados con EnemyFactory`);
  }

  setupDebugGUI() {
    this.debugGUI = new DebugGUI();
    this.debugGUI.setupPlayerControls(this.playerController);
    this.debugGUI.setupModelControls(this.player);
    this.debugGUI.setupEnemyControls(this.enemies);
    this.debugGUI.setupCameraControls(this.camera);
    this.debugGUI.addLogButton(this.playerController);
    console.log("Debug GUI initialized");
  }

  startRenderLoop() {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  setupResize() {
    window.addEventListener("resize", () => {
      this.engine.resize();
    });
  }
}

// Inicializar el juego
new Game();
