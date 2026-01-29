import './style.css'
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
} from '@babylonjs/core'
import '@babylonjs/core/Cameras/Inputs'
import HavokPhysics from '@babylonjs/havok'
import { PlayerController } from './PlayerController'

class Game {
  constructor() {
    this.canvas = document.getElementById('renderCanvas')
    this.engine = new Engine(this.canvas, true)
    this.scene = null
    
    this.init()
  }

  async init() {
    await this.initHavok()
    this.createLighting()
    this.createGround()
    this.player = this.createPlayer()
    this.camera = this.createCamera()
    this.setupPlayerController()
    this.createDynamicObstacles()
    this.createStaticObstacles()
    this.startRenderLoop()
    this.setupResize()
  }

  async initHavok() {
    // Inicializar física Havok
    const havokInstance = await HavokPhysics()
    const havokPlugin = new HavokPlugin(true, havokInstance)
    this.scene = new Scene(this.engine)
    this.scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin)
    
    // Habilitar colisiones en la escena
    this.scene.collisionsEnabled = true
    
    console.log('Física Havok inicializada')
  }

  createCamera() {
    // Crear cámara de tercera persona (ArcRotate)
    const camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 2, // Alpha (rotación horizontal inicial)
      Math.PI / 3,  // Beta (ángulo vertical)
      10,           // Radio (distancia inicial)
      Vector3.Zero(),
      this.scene
    )
    
    // Target al jugador
    camera.lockedTarget = this.player
    
    // Habilitar controles
    camera.attachControl()
    
    // Configurar límites de zoom
    camera.lowerRadiusLimit = 3  // No puede acercarse más de 3 unidades
    camera.upperRadiusLimit = 20 // No puede alejarse más de 20 unidades
    
    // Habilitar colisiones de cámara
    camera.checkCollisions = true
    camera.collisionRadius = new Vector3(0.5, 0.5, 0.5) // Elipsoide de colisión
    
    console.log('Cámara de tercera persona creada con colisiones')
    return camera
  }

  setupPlayerController() {
    // Instanciar el controlador con la cámara ya creada
    this.playerController = new PlayerController(this.player, this.camera, this.scene)
    
    // Tunear valores
    this.playerController.setMoveSpeed(8)
    this.playerController.setJumpForce(12)
    
    console.log('PlayerController inicializado')
  }

  createLighting() {
    // Crear iluminación hemisférica
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), this.scene)
    light.intensity = 0.7
  }

  createGround() {
    // Crear suelo estático con física
    const ground = MeshBuilder.CreateGround('ground', {
      width: 50,
      height: 50
    }, this.scene)
    
    // Material del suelo
    const groundMaterial = new StandardMaterial('groundMat', this.scene)
    groundMaterial.diffuseColor = new Color3(0.3, 0.6, 0.3)
    ground.material = groundMaterial
    
    // Habilitar colisiones para la cámara
    ground.checkCollisions = true
    
    // Agregar física al suelo usando PhysicsAggregate
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { 
      mass: 0, // masa 0 = estático
      restitution: 0.3,
      friction: 0.5
    }, this.scene)
    
    console.log('Suelo creado con física')
  }

  createPlayer() {
    // Crear mesh del jugador (cápsula)
    const player = MeshBuilder.CreateCapsule('player', {
      height: 2,
      radius: 0.5
    }, this.scene)
    
    // Posición inicial
    player.position = new Vector3(0, 3, 0)
    
    // Material del jugador
    const playerMaterial = new StandardMaterial('playerMat', this.scene)
    playerMaterial.diffuseColor = new Color3(0.8, 0.2, 0.2)
    player.material = playerMaterial
    
    // Habilitar colisiones para la cámara
    player.checkCollisions = true
    
    // Agregar física al jugador (dinámico)
    new PhysicsAggregate(player, PhysicsShapeType.CAPSULE, {
      mass: 1,
      restitution: 0,
      friction: 0.5
    }, this.scene)
    
    console.log('Jugador creado')
    return player
  }

  createDynamicObstacles() {
    // Crear 2 cubos rojos empujables (dinámicos)
    const positions = [
      new Vector3(5, 2, 5),
      new Vector3(-5, 2, -5)
    ]
    
    positions.forEach((pos, index) => {
      const box = MeshBuilder.CreateBox(`dynamicBox${index}`, {
        width: 2,
        height: 2,
        depth: 2
      }, this.scene)
      
      box.position = pos
      
      // Material rojo
      const material = new StandardMaterial(`dynamicBoxMat${index}`, this.scene)
      material.diffuseColor = new Color3(0.9, 0.1, 0.1)
      box.material = material
      
      // Habilitar colisiones para la cámara
      box.checkCollisions = true
      
      // Física dinámica (empujable)
      new PhysicsAggregate(box, PhysicsShapeType.BOX, {
        mass: 10,
        restitution: 0.2,
        friction: 0.8
      }, this.scene)
    })
    
    console.log('Obstáculos dinámicos creados')
  }

  createStaticObstacles() {
    // Crear 2 cubos grandes estáticos (edificios/muros)
    const positions = [
      new Vector3(10, 3, 0),
      new Vector3(-10, 3, 0)
    ]
    
    positions.forEach((pos, index) => {
      const wall = MeshBuilder.CreateBox(`staticWall${index}`, {
        width: 3,
        height: 6,
        depth: 3
      }, this.scene)
      
      wall.position = pos
      
      // Material gris oscuro
      const material = new StandardMaterial(`wallMat${index}`, this.scene)
      material.diffuseColor = new Color3(0.3, 0.3, 0.3)
      wall.material = material
      
      // Habilitar colisiones para la cámara
      wall.checkCollisions = true
      
      // Física estática (no se mueve)
      new PhysicsAggregate(wall, PhysicsShapeType.BOX, {
        mass: 0,
        restitution: 0.3,
        friction: 0.5
      }, this.scene)
    })
    
    console.log('Obstáculos estáticos creados')
  }

  startRenderLoop() {
    this.engine.runRenderLoop(() => {
      this.scene.render()
    })
  }

  setupResize() {
    window.addEventListener('resize', () => {
      this.engine.resize()
    })
  }
}

// Inicializar el juego
new Game()
