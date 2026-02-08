import './style.css';
import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  ArcRotateCamera,
  MeshBuilder,
  StandardMaterial,
  Color3,
  HavokPlugin,
  PhysicsAggregate,
  PhysicsShapeType,
  Quaternion,
} from '@babylonjs/core';
import { ImportMeshAsync } from '@babylonjs/core/Loading';
import '@babylonjs/core/Cameras/Inputs';
import '@babylonjs/loaders/glTF';
import HavokPhysics from '@babylonjs/havok';
import { PlayerController } from './PlayerController.ts';
import { EnemyDummy } from './EnemyDummy.ts';
import { EffectManager } from './EffectManager.ts';
import { CameraShaker } from './CameraShaker.ts';
import { DebugGUI } from './DebugGUI.ts';

class Game {
  canvas: any;
  engine: Engine;
  scene!: Scene;
  player: any;
  camera: ArcRotateCamera | null = null;
  cameraShaker: any;
  playerController: any;
  enemies: any[] = [];
  debugGUI: DebugGUI | null = null;

  constructor() {
    this.canvas = document.getElementById('renderCanvas');
    this.engine = new Engine(this.canvas, true);

    this.init();
  }

  async init() {
    await this.initHavok();
    this.createLighting();
    this.createGround();
    this.player = await this.createPlayer();
    this.camera = this.createCamera();
    this.setupPlayerController();
    this.createDynamicObstacles();
    this.createStaticObstacles();
    this.createEnemies();
    this.setupDebugGUI();
    this.startRenderLoop();
    this.setupResize();
  }

  async initHavok() {
    // Inicializar física Havok
    const havokInstance = await HavokPhysics();
    const havokPlugin = new HavokPlugin(true, havokInstance);
    this.scene = new Scene(this.engine);
    this.scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin);

    // Habilitar colisiones en la escena
    this.scene.collisionsEnabled = true;

    // Inicializar EffectManager
    EffectManager.init(this.scene);

    console.log('Física Havok inicializada');
  }

  createCamera() {
    // Crear cámara de tercera persona (ArcRotate)
    const camera = new ArcRotateCamera(
      'camera',
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

    console.log('Cámara de tercera persona creada con colisiones');
    return camera;
  }

  setupPlayerController() {
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

    console.log('PlayerController inicializado');
  }

  createLighting() {
    // Crear iluminación hemisférica
    const light = new HemisphericLight(
      'light',
      new Vector3(0, 1, 0),
      this.scene,
    );
    light.intensity = 0.7;
  }

  createGround() {
    // Crear suelo estático con física
    const ground = MeshBuilder.CreateGround(
      'ground',
      {
        width: 50,
        height: 50,
      },
      this.scene,
    );

    // Material del suelo
    const groundMaterial = new StandardMaterial('groundMat', this.scene);
    groundMaterial.diffuseColor = new Color3(0.3, 0.6, 0.3);
    ground.material = groundMaterial;

    // Habilitar colisiones para la cámara
    ground.checkCollisions = true;

    // Agregar física al suelo usando PhysicsAggregate
    new PhysicsAggregate(
      ground,
      PhysicsShapeType.BOX,
      {
        mass: 0, // masa 0 = estático
        restitution: 0.3,
        friction: 0.5,
      },
      this.scene,
    );

    console.log('Suelo creado con física');
  }

  async createPlayer() {
    // Crear cápsula invisible para la física
    const physicsBody = MeshBuilder.CreateCapsule(
      'player',
      {
        height: 2,
        radius: 0.5,
      },
      this.scene,
    );

    // Posición inicial
    physicsBody.position = new Vector3(0, 3, 0);

    // Hacer invisible (solo para física)
    physicsBody.isVisible = false;

    // Habilitar colisiones para la cámara
    physicsBody.checkCollisions = true;

    // Agregar física a la cápsula
    new PhysicsAggregate(
      physicsBody,
      PhysicsShapeType.CAPSULE,
      {
        mass: 1,
        restitution: 0,
        friction: 0.5,
      },
      this.scene,
    );

    // ===== CARGAR MODELO CON TODAS LAS ANIMACIONES =====
    console.log('Loading animated character...');

    const result = await ImportMeshAsync(
      '/models/animations_test.glb',
      this.scene,
    );
    console.log('<<<char', result);

    const modelRoot = result.meshes[0]!;
    modelRoot.parent = physicsBody;
    modelRoot.position = new Vector3(0, -1, 0);
    modelRoot.scaling = new Vector3(1.5, 1.5, 1.5);
    modelRoot.rotationQuaternion = Quaternion.FromEulerAngles(0, 0, 0);

    // Encontrar animaciones por nombre
    const animationGroups = result.animationGroups;
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
    const punchLAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'punch_l',
    );
    const punchRAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'punch_r',
    );
    const breakdanceAnim = animationGroups.find(
      (ag) => ag.name.toLowerCase() === 'breakdance',
    );

    if (!idleAnim || !runAnim || !jumpAnim) {
      console.error('No se encontraron todas las animaciones requeridas');
      console.error('Idle:', idleAnim?.name);
      console.error('Run:', runAnim?.name);
      console.error('Jump:', jumpAnim?.name);
    }

    // Detener todas las animaciones inicialmente
    for (const ag of animationGroups) {
      ag.stop();
    }

    // Guardar referencias - ahora todas usan el mismo root
    (physicsBody as any).animationModels = {
      idle: { root: modelRoot, animations: idleAnim ? [idleAnim] : [] },
      run: { root: modelRoot, animations: runAnim ? [runAnim] : [] },
      jump: { root: modelRoot, animations: jumpAnim ? [jumpAnim] : [] },
      punch_l: { root: modelRoot, animations: punchLAnim ? [punchLAnim] : [] },
      punch_r: { root: modelRoot, animations: punchRAnim ? [punchRAnim] : [] },
      breakdance: {
        root: modelRoot,
        animations: breakdanceAnim ? [breakdanceAnim] : [],
      },
    };

    return physicsBody;
  }

  createDynamicObstacles() {
    // Crear 2 cubos rojos empujables (dinámicos)
    const positions = [new Vector3(5, 2, 5), new Vector3(-5, 2, -5)];

    positions.forEach((pos, index) => {
      const box = MeshBuilder.CreateBox(
        `dynamicBox${index}`,
        {
          width: 2,
          height: 2,
          depth: 2,
        },
        this.scene,
      );

      box.position = pos;

      // Material rojo
      const material = new StandardMaterial(
        `dynamicBoxMat${index}`,
        this.scene,
      );
      material.diffuseColor = new Color3(0.9, 0.1, 0.1);
      box.material = material;

      // Habilitar colisiones para la cámara
      box.checkCollisions = true;

      // Física dinámica (empujable)
      new PhysicsAggregate(
        box,
        PhysicsShapeType.BOX,
        {
          mass: 10,
          restitution: 0.2,
          friction: 0.8,
        },
        this.scene,
      );
    });

    console.log('Obstáculos dinámicos creados');
  }

  createStaticObstacles() {
    // Crear 2 cubos grandes estáticos (edificios/muros)
    const positions = [new Vector3(10, 3, 0), new Vector3(-10, 3, 0)];

    positions.forEach((pos, index) => {
      const wall = MeshBuilder.CreateBox(
        `staticWall${index}`,
        {
          width: 3,
          height: 6,
          depth: 3,
        },
        this.scene,
      );

      wall.position = pos;

      // Material gris oscuro
      const material = new StandardMaterial(`wallMat${index}`, this.scene);
      material.diffuseColor = new Color3(0.3, 0.3, 0.3);
      wall.material = material;

      // Habilitar colisiones para la cámara
      wall.checkCollisions = true;

      // Física estática (no se mueve)
      new PhysicsAggregate(
        wall,
        PhysicsShapeType.BOX,
        {
          mass: 0,
          restitution: 0.3,
          friction: 0.5,
        },
        this.scene,
      );
    });

    console.log('Obstáculos estáticos creados');
  }

  createEnemies() {
    // Crear enemigos de prueba (sacos de boxeo)
    this.enemies = [];

    const enemyPositions = [
      new Vector3(3, 1.5, 3),
      new Vector3(-3, 1.5, 5),
      new Vector3(0, 1.5, -5),
    ];

    enemyPositions.forEach((pos, index) => {
      // Crear mesh del enemigo (cubo)
      const enemyMesh = MeshBuilder.CreateBox(
        `enemy${index}`,
        {
          width: 1.2,
          height: 2,
          depth: 1.2,
        },
        this.scene,
      );

      enemyMesh.position = pos;

      // Material púrpura
      const material = new StandardMaterial(`enemyMat${index}`, this.scene);
      material.diffuseColor = new Color3(0.6, 0.1, 0.6);
      enemyMesh.material = material;

      // Habilitar colisiones para la cámara
      enemyMesh.checkCollisions = true;

      // Crear instancia de EnemyDummy (configura física internamente)
      const enemy = new EnemyDummy(enemyMesh, this.scene, {
        hp: 3,
        mass: 3,
        knockbackForce: 12,
        contactDamage: 1,
        patrolSpeed: 2,
        chaseSpeed: 4,
        visionRange: 2,
        chaseGiveUpRange: 12,
        debug: true, // Mostrar círculo de visión
      });

      // Asignar referencia al player para que pueda dañarlo
      enemy.setPlayerRef(this.playerController);

      this.enemies.push(enemy);
    });

    // Registrar enemigos en el PlayerController para que el WeaponSystem los detecte
    this.playerController.registerEnemies(this.enemies);

    console.log(`${this.enemies.length} enemigos creados`);
  }

  setupDebugGUI() {
    console.log('<<< player', this.player);

    this.debugGUI = new DebugGUI();
    this.debugGUI.setupPlayerControls(this.playerController);
    this.debugGUI.setupModelControls(this.player);
    this.debugGUI.setupEnemyControls(this.enemies);
    this.debugGUI.setupCameraControls(this.camera);
    this.debugGUI.addLogButton(this.playerController);
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
