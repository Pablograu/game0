import './style.css'
import { 
  Engine, 
  Scene, 
  Vector3, 
  HemisphericLight, 
  FreeCamera, 
  MeshBuilder, 
  StandardMaterial, 
  Color3, 
  HavokPlugin, 
  PhysicsAggregate, 
  PhysicsShapeType, 
} from '@babylonjs/core'
import '@babylonjs/core/Cameras/Inputs'
import HavokPhysics from '@babylonjs/havok'

class Game {
  constructor() {
    this.canvas = document.getElementById('renderCanvas')
    this.engine = new Engine(this.canvas, true)
    this.scene = null
    
    this.init()
  }

  async init() {
    await this.initHavok()
    this.createCamera()
    this.createLighting()
    this.createGround()
    this.startRenderLoop()
    this.setupResize()
  }

  async initHavok() {
    // Inicializar física Havok
    const havokInstance = await HavokPhysics()
    const havokPlugin = new HavokPlugin(true, havokInstance)
    this.scene = new Scene(this.engine)
    this.scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin)
    console.log('Física Havok inicializada')
  }

  createCamera() {
    // Crear cámara libre
    const camera = new FreeCamera('camera', new Vector3(0, 5, -30), this.scene)
    camera.attachControl()
    camera.setTarget(Vector3.Zero())
  }

  createLighting() {
    // Crear iluminación hemisférica
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), this.scene)
    light.intensity = 0.7
  }

  createGround() {
    // Crear suelo estático con física
    const ground = MeshBuilder.CreateGround('ground', {
      width: 20,
      height: 20
    }, this.scene)
    
    // Material del suelo
    const groundMaterial = new StandardMaterial('groundMat', this.scene)
    groundMaterial.diffuseColor = new Color3(0.3, 0.6, 0.3)
    ground.material = groundMaterial
    
    // Agregar física al suelo usando PhysicsAggregate
    const groundAggregate = new PhysicsAggregate(ground, PhysicsShapeType.BOX, { 
      mass: 0, // masa 0 = estático
      restitution: 0.3,
      friction: 0.5
    }, this.scene)
    
    console.log('Suelo creado con física')
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
