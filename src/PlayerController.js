import { Vector3 } from '@babylonjs/core'

export class PlayerController {
  constructor(mesh, camera, scene) {
    this.mesh = mesh
    this.camera = camera
    this.scene = scene
    this.body = mesh.physicsBody
    
    // Variables públicas para tunear
    this.moveSpeed = 8
    this.jumpForce = 12
    
    // Estado interno
    this.inputMap = {}
    this.isGrounded = false
    
    this.setupInput()
    this.setupPhysics()
    this.setupUpdate()
  }
  
  setupInput() {
    // Capturar input del teclado
    this.scene.onKeyboardObservable.add((kbInfo) => {
      const key = kbInfo.event.key.toLowerCase()
      
      if (kbInfo.type === 1) { // KEYDOWN
        this.inputMap[key] = true
      } else if (kbInfo.type === 2) { // KEYUP
        this.inputMap[key] = false
      }
    })
  }
  
  setupPhysics() {
    if (!this.body) {
      console.error('El mesh del jugador necesita un PhysicsBody')
      return
    }
    
    // Bloquear rotación angular para evitar volcarse
    this.body.setAngularVelocity(new Vector3(0, 0, 0))
    this.body.disablePreStep = false
    
    // Configurar propiedades físicas
    this.body.setMassProperties({
      mass: 1,
      inertia: new Vector3(0, 0, 0) // Evitar rotación
    })
  }
  
  setupUpdate() {
    // Update loop - se ejecuta antes de cada frame
    this.scene.onBeforeRenderObservable.add(() => {
      this.update()
    })
  }
  
  update() {
    if (!this.body) return
    
    // Obtener velocidad actual
    const currentVelocity = this.body.getLinearVelocity()
    
    // Calcular dirección de movimiento relativa a la cámara
    const moveDirection = this.getMoveDirection()
    
    // Crear nueva velocidad (mantener Y para respetar gravedad)
    const newVelocity = new Vector3(
      moveDirection.x * this.moveSpeed,
      currentVelocity.y, // Mantener velocidad vertical (gravedad)
      moveDirection.z * this.moveSpeed
    )
    
    // Aplicar velocidad directamente (movimiento snappy)
    this.body.setLinearVelocity(newVelocity)
    
    // Forzar rotación angular a cero (evitar volcarse)
    this.body.setAngularVelocity(new Vector3(0, 0, 0))
    
    // Salto
    this.handleJump(currentVelocity)
    
    // Detectar si está en el suelo (simple check de velocidad Y)
    this.isGrounded = Math.abs(currentVelocity.y) < 0.1
  }
  
  getMoveDirection() {
    // Obtener vectores forward y right de la cámara
    const forward = this.camera.getDirection(Vector3.Forward())
    const right = this.camera.getDirection(Vector3.Right())
    
    // Proyectar al plano horizontal (ignorar componente Y)
    forward.y = 0
    right.y = 0
    forward.normalize()
    right.normalize()
    
    // Calcular dirección basada en input
    let direction = Vector3.Zero()
    
    if (this.inputMap['w']) {
      direction.addInPlace(forward)
    }
    if (this.inputMap['s']) {
      direction.addInPlace(forward.scale(-1))
    }
    if (this.inputMap['d']) {
      direction.addInPlace(right)
    }
    if (this.inputMap['a']) {
      direction.addInPlace(right.scale(-1))
    }
    
    // Normalizar para movimiento diagonal consistente
    if (direction.length() > 0) {
      direction.normalize()
    }
    
    return direction
  }
  
  handleJump(currentVelocity) {
    // Salto solo si está en el suelo y presiona espacio
    if (this.inputMap[' '] && this.isGrounded) {
      // Aplicar impulso vertical instantáneo
      const jumpVelocity = new Vector3(
        currentVelocity.x,
        this.jumpForce,
        currentVelocity.z
      )
      this.body.setLinearVelocity(jumpVelocity)
      
      // Pequeño delay para evitar doble salto
      this.inputMap[' '] = false
    }
  }
  
  // Método público para cambiar velocidad de movimiento
  setMoveSpeed(speed) {
    this.moveSpeed = speed
  }
  
  // Método público para cambiar fuerza de salto
  setJumpForce(force) {
    this.jumpForce = force
  }
}
