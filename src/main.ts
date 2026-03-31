import './style.css';
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
  StandardMaterial,
  Color3,
  ShadowGenerator,
  DirectionalLight,
} from '@babylonjs/core';
import { ImportMeshAsync } from '@babylonjs/core/Loading';
import '@babylonjs/core/Cameras/Inputs';
import '@babylonjs/loaders/glTF';
import HavokPhysics from '@babylonjs/havok';
import { WeaponSystem } from './WeaponSystem.ts';
import {
  createPlayerAnimationRegistry,
  PlayerAnimationRegistry,
} from './player/PlayerAnimations.ts';
import {
  DEFAULT_PLAYER_GAMEPLAY_CONFIG,
  createPlayerHealthUi,
} from './player/playerRuntime.ts';
import { EffectManager } from './EffectManager.ts';
import { CameraShaker } from './CameraShaker.ts';
import { GameManager } from './GameManager.ts';
import { DebugGUI } from './DebugGUI.ts';
import { AudioManager } from './AudioManager.ts';
import {
  bootstrapGameEcs,
  EnemySpawner,
  createPlayerDebugApi,
  type GameEcsRuntime,
  type PlayerDebugApi,
} from './ecs/index.ts';

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
  playerDebugApi: PlayerDebugApi | null = null;
  playerAnimations: PlayerAnimationRegistry = {};
  enemies: any[] = [];
  debugGUI: DebugGUI | null = null;
  gameManager: GameManager | null = null;
  ecsRuntime: GameEcsRuntime | null = null;

  constructor() {
    this.canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
    this.engine = new Engine(this.canvas, true);

    this.init();
  }

  async init() {
    await this.initHavok();
    EffectManager.init(this.scene);
    await AudioManager.init();
    await this.preloadEnemyAssets();
    this.player = await this.createPlayer();
    this.camera = this.createCamera();
    this.setupPlayerRuntime();
    await this.createEnemies();
    await this.loadEnvironment();
    this.createLighting();
    this.setupGameManager();
    this.startRenderLoop();
    this.setupResize();
    // this.setupDebugGUI();
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
    console.log('Física Havok inicializada');
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
      'camera',
      -Math.PI / 2, // Alpha (rotación horizontal inicial)
      Math.PI / 2.5, // Beta (ángulo vertical)
      25, // Radio (distancia inicial)
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

    console.log('Cámara de tercera persona creada con colisiones');
    return camera;
  }

  setupPlayerRuntime() {
    // Configurar la cámara para seguir al jugador
    if (this.camera && this.player) {
      this.camera.lockedTarget = this.player;
    }

    this.cameraShaker = new CameraShaker(this.camera, this.scene);

    const healthUi = createPlayerHealthUi(
      this.scene,
      DEFAULT_PLAYER_GAMEPLAY_CONFIG.maxHealth,
    );

    const weaponSystem = new WeaponSystem(
      {
        mesh: this.player,
        body: this.player.physicsBody,
        targetRotation: Quaternion.Identity(),
      },
      this.scene,
      {
        damage: 1,
        attackDuration: 0.15,
        attackCooldown: 0,
        debug: true,
        cameraShaker: this.cameraShaker,
        hitboxOffset: 1.8,
      },
    );

    this.ecsRuntime = bootstrapGameEcs({
      scene: this.scene,
      engine: this.engine,
      reloadGame: () => location.reload(),
      playerMesh: this.player,
      camera: this.camera,
      cameraShaker: this.cameraShaker,
      playerAnimations: this.playerAnimations,
      weaponSystem,
      healthUI: healthUi.healthUI,
      healthText: healthUi.healthText,
      spawnPoint: this.player.position.clone(),
      ragdollSkeleton: this.player.skeleton ?? null,
      ragdollArmatureNode: this.player.armatureNode ?? null,
      gameplayConfig: {
        moveSpeed: 8,
        jumpForce: 12,
      },
    });

    if (!this.ecsRuntime.playerEntityId) {
      throw new Error('Failed to create player ECS entity.');
    }

    this.playerDebugApi = createPlayerDebugApi(
      this.ecsRuntime.world,
      this.ecsRuntime.playerEntityId,
    );

    console.log('Player runtime initialized');
  }

  setupGameManager() {
    // Crear el GameManager para controlar el flujo de la partida
    this.gameManager = new GameManager(this.scene, this.engine);
    this.gameManager.attachGameFlow(this.ecsRuntime?.gameFlow ?? null);

    // Asignar referencias
    this.gameManager.setEnemies(this.enemies);
    this.gameManager.setCamera(this.camera);

    console.log('GameManager inicializado');
  }

  createLighting() {
    // ===== HDR ENVIRONMENT (iluminación + skybox) =====
    const hdrTexture = new HDRCubeTexture(
      '/hdr/skybox.hdr',
      this.scene,
      1024, // resolución (128, 256, 512, 1024)
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
      'light',
      new Vector3(0, 1, 0),
      this.scene,
    );
    light.intensity = 0.3;

    console.log('HDR skybox cargado: /hdr/skybox.hdr');
  }

  loadEnvironment() {
    // create simple ground
    const ground = MeshBuilder.CreateGround(
      'ground',
      { width: 500, height: 500 },
      this.scene,
    );
    ground.position.y = 0;
    ground.checkCollisions = true;

    // make ground green
    const groundMat = new StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = new Color3(0.2, 0.8, 0.2);
    ground.material = groundMat;
    ground.receiveShadows = true;

    // add ground physics
    new PhysicsAggregate(
      ground,
      PhysicsShapeType.BOX,
      {
        mass: 0,
        restitution: 0.1,
        friction: 0.5,
      },
      this.scene,
    );

    const sun = new DirectionalLight(
      'sun',
      new Vector3(-1, -2, -1),
      this.scene,
    );
    sun.position = new Vector3(20, 40, 20);
    sun.intensity = 0.5;

    const shadowGenerator = new ShadowGenerator(1024, sun);
    shadowGenerator.addShadowCaster(this.player);
    this.enemies.forEach((enemy) =>
      enemy.meshes.forEach((m: any) => shadowGenerator.addShadowCaster(m)),
    );
    shadowGenerator.useExponentialShadowMap = true;

    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.05;
  }

  async createPlayer() {
    console.log('Loading animated character...');

    const result = await ImportMeshAsync('/models/player.glb', this.scene);
    const rootMesh = result.meshes[0];
    const skeleton = result.skeletons[0];
    const armatureNode = result.transformNodes.find(
      (node) => node.name === 'Armature',
    );
    const animationGroups = result.animationGroups;

    // ===== CREATE CAPSULE & SET UP HIERARCHY BEFORE RAGDOLL =====
    const physicsCapsule = MeshBuilder.CreateCapsule(
      'player',
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

    // Store for ECS player bootstrap helpers
    physicsCapsule.skeleton = skeleton;
    (physicsCapsule as any).armatureNode = armatureNode;

    // Encontrar animaciones por nombre
    console.log(
      'Animation groups found:',
      animationGroups.map((ag) => ag.name),
    );

    const idleAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'idle',
    );
    const runAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'run',
    );
    const jumpAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'jump',
    );
    const punchLAnim = animationGroups.find((ag) => ag.name === 'punch_L');
    const punchRAnim = animationGroups.find((ag) => ag.name === 'punch_R');
    const dancingAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'macarena',
    );

    const dashAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'dash',
    );

    const deadAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'dead',
    );

    const fallingAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'falling',
    );

    const hitAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'hit',
    );

    const landingAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'land',
    );

    const walkAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'walk',
    );

    const flyingKick = animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'flying_kick',
    );

    const stumbleBack = animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'stumble_back',
    );

    const playerAnimations = [
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
    ];

    if (playerAnimations.some((anim) => !anim)) {
      console.error(
        'No se encontraron todas las animaciones necesarias. Animaciones encontradas:',
        playerAnimations.map((anim) => (anim ? anim.name : 'missing')),
      );
    }

    this.playerAnimations = createPlayerAnimationRegistry(rootMesh, {
      idle: idleAnim,
      run: runAnim,
      jump: jumpAnim,
      punch_L: punchLAnim,
      punch_R: punchRAnim,
      macarena: dancingAnim,
      dash: dashAnim,
      dead: deadAnim,
      falling: fallingAnim,
      hit: hitAnim,
      land: landingAnim,
      walk: walkAnim,
      flying_kick: flyingKick,
      stumble_back: stumbleBack,
    });

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

    return physicsCapsule;
  }

  async preloadEnemyAssets() {
    await EnemySpawner.preload('/models/ladron.glb', this.scene);
    console.log('Enemy assets precargados');
  }

  async createEnemies() {
    const LADRON_PATH = '/models/ladron.glb';

    const enemyPositions = [
      new Vector3(3, 40, 13),
      new Vector3(-3, 40, 15),
      new Vector3(0, 40, -15),
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

    this.enemies = EnemySpawner.spawnMultiple(
      this.ecsRuntime!.world,
      LADRON_PATH,
      this.scene,
      enemyPositions,
      enemyConfig,
    );

    console.log(`${this.enemies.length} enemigos creados con EnemySpawner`);
  }

  setupDebugGUI() {
    this.debugGUI = new DebugGUI();
    if (this.playerDebugApi) {
      this.debugGUI.setupPlayerControls(this.playerDebugApi);
      this.debugGUI.addLogButton(this.playerDebugApi);
    }
    this.debugGUI.setupModelControls(this.player);
    this.debugGUI.setupEnemyControls(this.enemies);
    this.debugGUI.setupCameraControls(this.camera);
    console.log('Debug GUI initialized');
  }

  startRenderLoop() {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  setupResize() {
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }
}

// Inicializar el juego
new Game();
