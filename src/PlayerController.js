import { 
  Vector3, 
  Quaternion, 
  PhysicsRaycastResult,
  ParticleSystem,
  Texture,
  Color4,
  MeshBuilder,
  StandardMaterial,
  Color3
} from '@babylonjs/core'
import { WeaponSystem } from './WeaponSystem'

export class PlayerController {
  constructor(mesh, camera, scene) {
    this.mesh = mesh
    this.camera = camera
    this.scene = scene
    this.body = mesh.physicsBody
    this.physicsEngine = scene.getPhysicsEngine()
    
    // Variables públicas para tunear
    this.moveSpeed = 8
    this.jumpForce = 12
    
    // Configuración del jugador
    this.playerHeight = 2  // Altura de la cápsula
    this.playerRadius = 0.5
    
    // Estado interno
    this.inputMap = {}
    this.isGrounded = false
    this.wasGrounded = false // Para detectar aterrizaje
    
    // ===== COYOTE TIME =====
    this.coyoteTime = 0.12 // Segundos de gracia después de caer
    this.coyoteTimer = 0
    
    // ===== JUMP BUFFER =====
    this.jumpBufferTime = 0.15 // Segundos que recuerda el input de salto
    this.jumpBufferTimer = 0
    
    // ===== VARIABLE JUMP =====
    this.jumpCutMultiplier = 0.5 // Cuánto reduce la velocidad al soltar
    this.jumpKeyReleased = true  // Para detectar cuando suelta la tecla
    
    // ===== DASH =====
    this.dashSpeed = 25
    this.dashDuration = 0.18 // Segundos que dura el dash
    this.dashCooldown = 0.6  // Cooldown entre dashes
    this.dashTimer = 0
    this.dashCooldownTimer = 0
    this.isDashing = false
    this.dashDirection = Vector3.Zero()
    this.lastFacingDirection = new Vector3(0, 0, 1) // Dirección por defecto
    
    // ===== ROTACIÓN VISUAL =====
    this.rotationSpeed = 12 // Velocidad del Slerp
    this.targetRotation = Quaternion.Identity()
    
    // ===== SQUASH & STRETCH =====
    this.originalScale = new Vector3(1, 1, 1)
    this.targetScale = new Vector3(1, 1, 1)
    this.scaleSpeed = 10 // Velocidad de interpolación
    
    // ===== PARTÍCULAS =====
    this.dustParticles = null
    this.dashParticles = null
    
    // ===== RAYCAST =====
    this.raycastResult = new PhysicsRaycastResult()
    
    // ===== WEAPON SYSTEM =====
    this.weaponSystem = null
    
    this.setupInput()
    this.setupPhysics()
    this.setupParticles()
    this.setupWeaponSystem()
    this.setupUpdate()
  }
  
  setupWeaponSystem() {
    // Crear sistema de armas
    this.weaponSystem = new WeaponSystem(this, this.scene, {
      damage: 1,
      attackDuration: 0.15,
      attackCooldown: 0.35,
      debug: true // Cambiar a false para ocultar la hitbox
    })
    
    console.log('WeaponSystem inicializado')
  }
  
  setupInput() {
    // Capturar input del teclado
    this.scene.onKeyboardObservable.add((kbInfo) => {
      const key = kbInfo.event.key.toLowerCase()
      
      if (kbInfo.type === 1) { // KEYDOWN
        this.inputMap[key] = true
        
        // Jump Buffer: al presionar salto, iniciar el timer
        if (key === ' ') {
          this.jumpBufferTimer = this.jumpBufferTime
          this.jumpKeyReleased = false
        }
        
        // Dash input (Shift)
        if (key === 'shift' && this.dashCooldownTimer <= 0 && !this.isDashing) {
          this.startDash()
        }
      } else if (kbInfo.type === 2) { // KEYUP
        this.inputMap[key] = false
        
        // Variable Jump: detectar cuando suelta la tecla
        if (key === ' ') {
          this.jumpKeyReleased = true
        }
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
  
  setupParticles() {
    // ===== PARTÍCULAS DE POLVO (salto/aterrizaje) =====
    this.dustParticles = new ParticleSystem("dustParticles", 50, this.scene)
    
    // Crear textura procedural para las partículas (cuadradito)
    const dustTexture = this.createParticleTexture()
    this.dustParticles.particleTexture = dustTexture
    
    // Emisor en la posición del jugador
    this.dustParticles.emitter = this.mesh
    this.dustParticles.minEmitBox = new Vector3(-0.3, -1, -0.3)
    this.dustParticles.maxEmitBox = new Vector3(0.3, -0.9, 0.3)
    
    // Colores (gris/marrón)
    this.dustParticles.color1 = new Color4(0.6, 0.5, 0.4, 0.8)
    this.dustParticles.color2 = new Color4(0.4, 0.35, 0.3, 0.6)
    this.dustParticles.colorDead = new Color4(0.3, 0.25, 0.2, 0)
    
    // Tamaño
    this.dustParticles.minSize = 0.05
    this.dustParticles.maxSize = 0.15
    
    // Vida
    this.dustParticles.minLifeTime = 0.2
    this.dustParticles.maxLifeTime = 0.4
    
    // Velocidad
    this.dustParticles.direction1 = new Vector3(-1, 0.5, -1)
    this.dustParticles.direction2 = new Vector3(1, 1, 1)
    this.dustParticles.minEmitPower = 1
    this.dustParticles.maxEmitPower = 2
    
    // Gravedad de partículas
    this.dustParticles.gravity = new Vector3(0, -5, 0)
    
    // Rate
    this.dustParticles.emitRate = 0 // Empezamos sin emitir
    this.dustParticles.manualEmitCount = 0
    this.dustParticles.start()
    
    // ===== PARTÍCULAS DE DASH =====
    this.dashParticles = new ParticleSystem("dashParticles", 100, this.scene)
    this.dashParticles.particleTexture = dustTexture
    this.dashParticles.emitter = this.mesh
    this.dashParticles.minEmitBox = new Vector3(-0.2, -0.5, -0.2)
    this.dashParticles.maxEmitBox = new Vector3(0.2, 0.5, 0.2)
    
    // Color cyan/azul para el dash
    this.dashParticles.color1 = new Color4(0.3, 0.8, 1, 0.9)
    this.dashParticles.color2 = new Color4(0.5, 0.9, 1, 0.7)
    this.dashParticles.colorDead = new Color4(0.2, 0.5, 0.8, 0)
    
    this.dashParticles.minSize = 0.08
    this.dashParticles.maxSize = 0.2
    this.dashParticles.minLifeTime = 0.15
    this.dashParticles.maxLifeTime = 0.3
    
    this.dashParticles.direction1 = new Vector3(-0.5, -0.5, -0.5)
    this.dashParticles.direction2 = new Vector3(0.5, 0.5, 0.5)
    this.dashParticles.minEmitPower = 0.5
    this.dashParticles.maxEmitPower = 1.5
    
    this.dashParticles.emitRate = 0
    this.dashParticles.start()
  }
  
  createParticleTexture() {
    // Crear una textura procedural simple (cuadrado blanco)
    const size = 32
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    
    // Dibujar un cuadrado con bordes suaves
    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.roundRect(4, 4, size - 8, size - 8, 4)
    ctx.fill()
    
    const texture = new Texture(canvas.toDataURL(), this.scene)
    return texture
  }
  
  setupUpdate() {
    // Update loop - se ejecuta antes de cada frame
    this.scene.onBeforeRenderObservable.add(() => {
      this.update()
    })
  }
  
  update() {
    if (!this.body) return
    const deltaTime = this.scene.getEngine().getDeltaTime() / 1000
    
    // Guardar estado anterior de grounded
    this.wasGrounded = this.isGrounded
    
    // ===== GROUND CHECK CON RAYCAST =====
    this.checkGrounded()
    
    // ===== COYOTE TIME UPDATE =====
    this.updateCoyoteTime(deltaTime)
    
    // ===== JUMP BUFFER UPDATE =====
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= deltaTime
    }
    
    // ===== DASH COOLDOWN UPDATE =====
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= deltaTime
    }
    
    // ===== DASH UPDATE =====
    if (this.isDashing) {
      this.updateDash(deltaTime)
      return // Durante el dash, no procesar movimiento normal
    }
    
    // Obtener velocidad actual
    const currentVelocity = this.body.getLinearVelocity()
    
    // Calcular dirección de movimiento relativa a la cámara
    const moveDirection = this.getMoveDirection()
    
    // Guardar última dirección para el dash
    if (moveDirection.length() > 0.1) {
      this.lastFacingDirection = moveDirection.clone()
    }
    
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
    
    // ===== ROTACIÓN VISUAL =====
    this.updateRotation(moveDirection, deltaTime)
    
    // ===== SALTO (con Coyote Time y Jump Buffer) =====
    this.handleJump(currentVelocity)
    
    // ===== VARIABLE JUMP (cortar salto al soltar) =====
    this.handleVariableJump()
    
    // ===== SQUASH & STRETCH =====
    this.updateSquashStretch(deltaTime)
    
    // ===== DETECTAR ATERRIZAJE =====
    if (this.isGrounded && !this.wasGrounded) {
      this.onLand()
    }
  }
  
  // ===== GROUND CHECK CON RAYCAST =====
  checkGrounded() {
    const playerPos = this.mesh.position.clone()
    
    // Punto de inicio del rayo (centro del jugador)
    const rayStart = new Vector3(playerPos.x, playerPos.y, playerPos.z)
    
    // Punto final del rayo (hacia abajo)
    // Longitud = mitad de altura + un poco de margen
    const rayLength = (this.playerHeight / 2) + 0.15
    const rayEnd = new Vector3(playerPos.x, playerPos.y - rayLength, playerPos.z)
    
    // Realizar el raycast usando el motor de física
    this.physicsEngine.raycastToRef(rayStart, rayEnd, this.raycastResult)
    
    // Si el rayo golpea algo Y no es el propio jugador
    if (this.raycastResult.hasHit) {
      const hitBody = this.raycastResult.body
      
      // Filtrar para que no detecte al propio jugador
      if (hitBody && hitBody !== this.body) {
        this.isGrounded = true
        return
      }
    }
    
    this.isGrounded = false
  }
  
  // ===== COYOTE TIME =====
  updateCoyoteTime(deltaTime) {
    if (this.isGrounded) {
      // Resetear el timer cuando está en el suelo
      this.coyoteTimer = this.coyoteTime
    } else {
      // Decrementar el timer cuando está en el aire
      if (this.coyoteTimer > 0) {
        this.coyoteTimer -= deltaTime
      }
    }
  }
  
  // ===== PUEDE SALTAR (considera Coyote Time) =====
  canJump() {
    // Puede saltar si está en el suelo O si el coyote timer > 0
    return this.isGrounded || this.coyoteTimer > 0
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
    // Usar Jump Buffer: saltar si hay buffer Y puede saltar
    const shouldJump = this.jumpBufferTimer > 0 && this.canJump()
    
    if (shouldJump) {
      // Aplicar impulso vertical instantáneo
      const jumpVelocity = new Vector3(
        currentVelocity.x,
        this.jumpForce,
        currentVelocity.z
      )
      this.body.setLinearVelocity(jumpVelocity)
      
      // Consumir el buffer y el coyote time
      this.jumpBufferTimer = 0
      this.coyoteTimer = 0
      
      // Feedback visual: estirar al saltar
      this.applyJumpStretch()
      
      // Partículas de polvo al saltar
      this.emitDust(15)
    }
  }
  
  // ===== VARIABLE JUMP (cortar altura al soltar) =====
  handleVariableJump() {
    const currentVelocity = this.body.getLinearVelocity()
    
    // Si el jugador soltó la tecla mientras sube
    if (this.jumpKeyReleased && currentVelocity.y > 0 && !this.isGrounded) {
      // Cortar la velocidad vertical
      const cutVelocity = new Vector3(
        currentVelocity.x,
        currentVelocity.y * this.jumpCutMultiplier,
        currentVelocity.z
      )
      this.body.setLinearVelocity(cutVelocity)
      
      // Solo cortar una vez por salto
      this.jumpKeyReleased = false
    }
  }
  
  // ===== ROTACIÓN VISUAL SUAVE =====
  updateRotation(moveDirection, deltaTime) {
    if (moveDirection.length() > 0.1) {
      // Calcular el ángulo hacia la dirección de movimiento
      const targetAngle = Math.atan2(moveDirection.x, moveDirection.z)
      this.targetRotation = Quaternion.FromEulerAngles(0, targetAngle, 0)
    }
    
    // Interpolar suavemente hacia la rotación objetivo (Slerp)
    const currentRotation = this.mesh.rotationQuaternion || Quaternion.Identity()
    
    // Asegurarse de que el mesh usa quaternion
    if (!this.mesh.rotationQuaternion) {
      this.mesh.rotationQuaternion = Quaternion.Identity()
    }
    
    // Slerp hacia la rotación objetivo
    const slerpFactor = Math.min(1, this.rotationSpeed * deltaTime)
    this.mesh.rotationQuaternion = Quaternion.Slerp(
      currentRotation,
      this.targetRotation,
      slerpFactor
    )
  }
  
  // ===== DASH =====
  startDash() {
    this.isDashing = true
    this.dashTimer = this.dashDuration
    this.dashCooldownTimer = this.dashCooldown
    
    // Dirección del dash: hacia donde mira o la última dirección de movimiento
    const moveDir = this.getMoveDirection()
    if (moveDir.length() > 0.1) {
      this.dashDirection = moveDir.normalize()
    } else {
      this.dashDirection = this.lastFacingDirection.clone().normalize()
    }
    
    // Feedback: estirar horizontalmente
    this.targetScale = new Vector3(0.7, 1.3, 0.7)
    
    // Activar partículas de dash
    this.dashParticles.emitRate = 150
    
    console.log('Dash iniciado!')
  }
  
  updateDash(deltaTime) {
    // Aplicar velocidad de dash (sin gravedad)
    const dashVelocity = new Vector3(
      this.dashDirection.x * this.dashSpeed,
      0, // Sin gravedad durante el dash
      this.dashDirection.z * this.dashSpeed
    )
    this.body.setLinearVelocity(dashVelocity)
    
    // Decrementar timer
    this.dashTimer -= deltaTime
    
    // Finalizar dash
    if (this.dashTimer <= 0) {
      this.endDash()
    }
  }
  
  endDash() {
    this.isDashing = false
    
    // Frenar en seco
    const currentVel = this.body.getLinearVelocity()
    this.body.setLinearVelocity(new Vector3(0, currentVel.y, 0))
    
    // Feedback: volver a escala normal
    this.targetScale = this.originalScale.clone()
    
    // Desactivar partículas de dash
    this.dashParticles.emitRate = 0
    
    console.log('Dash terminado!')
  }
  
  // ===== SQUASH & STRETCH =====
  applyJumpStretch() {
    // Estirar verticalmente al saltar
    this.targetScale = new Vector3(0.8, 1.2, 0.8)
    
    // Volver a normal después de un momento
    setTimeout(() => {
      this.targetScale = this.originalScale.clone()
    }, 100)
  }
  
  applyLandSquash() {
    // Aplastar al aterrizar
    this.targetScale = new Vector3(1.2, 0.8, 1.2)
    
    // Volver a normal
    setTimeout(() => {
      this.targetScale = this.originalScale.clone()
    }, 100)
  }
  
  updateSquashStretch(deltaTime) {
    // Interpolar suavemente hacia la escala objetivo
    const lerpFactor = Math.min(1, this.scaleSpeed * deltaTime)
    
    this.mesh.scaling.x += (this.targetScale.x - this.mesh.scaling.x) * lerpFactor
    this.mesh.scaling.y += (this.targetScale.y - this.mesh.scaling.y) * lerpFactor
    this.mesh.scaling.z += (this.targetScale.z - this.mesh.scaling.z) * lerpFactor
  }
  
  // ===== EVENTOS =====
  onLand() {
    // Feedback visual al aterrizar
    this.applyLandSquash()
    
    // Partículas de polvo
    this.emitDust(20)
    
    console.log('Aterrizaje!')
  }
  
  emitDust(amount) {
    // Emitir una ráfaga de partículas
    this.dustParticles.manualEmitCount = amount
  }
  
  // ===== MÉTODOS PÚBLICOS =====
  setMoveSpeed(speed) {
    this.moveSpeed = speed
  }
  
  setJumpForce(force) {
    this.jumpForce = force
  }
  
  setDashSpeed(speed) {
    this.dashSpeed = speed
  }
  
  setCoyoteTime(time) {
    this.coyoteTime = time
  }
  
  setJumpBufferTime(time) {
    this.jumpBufferTime = time
  }
  
  // ===== COMBAT SYSTEM =====
  
  /**
   * Registra un enemigo para que el WeaponSystem lo detecte
   * @param {EnemyDummy} enemy 
   */
  registerEnemy(enemy) {
    if (this.weaponSystem) {
      this.weaponSystem.registerEnemy(enemy)
    }
  }
  
  /**
   * Registra múltiples enemigos
   * @param {EnemyDummy[]} enemies 
   */
  registerEnemies(enemies) {
    enemies.forEach(e => this.registerEnemy(e))
  }
  
  getWeaponSystem() {
    return this.weaponSystem
  }
}
