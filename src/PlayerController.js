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
import { AdvancedDynamicTexture, TextBlock, Control } from '@babylonjs/gui'
import { WeaponSystem } from './WeaponSystem'
import { EffectManager } from './EffectManager'

export class PlayerController {
  constructor(mesh, camera, scene, cameraShaker = null) {
    this.mesh = mesh
    this.camera = camera
    this.scene = scene
    this.body = mesh.physicsBody
    this.physicsEngine = scene.getPhysicsEngine()
    this.cameraShaker = cameraShaker
    
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
    
    // ===== RECOIL (RETROCESO) =====
    this.recoilForce = 8      // Fuerza de retroceso horizontal al golpear
    this.pogoForce = 14       // Fuerza del rebote hacia arriba (pogo)
    this.isAttackingDown = false // Flag para detectar ataque hacia abajo
    this.recoilVelocity = Vector3.Zero() // Velocidad de recoil actual
    this.recoilDecay = 10     // Qué tan rápido decae el recoil
    
    // ===== SISTEMA DE SALUD =====
    this.maxHealth = 3
    this.currentHealth = this.maxHealth
    this.isInvulnerable = false
    this.invulnerabilityDuration = 1.5 // Segundos de invulnerabilidad tras daño
    this.invulnerabilityTimer = 0
    this.blinkInterval = null
    this.damageKnockbackForce = 6 // Fuerza de knockback al recibir daño
    
    // ===== SPAWN POINT =====
    this.spawnPoint = mesh.position.clone() // Guardar posición inicial
    
    // ===== UI =====
    this.healthUI = null
    this.healthText = null
    
    // ===== WEAPON SYSTEM =====
    this.weaponSystem = null
    
    this.setupInput()
    this.setupPhysics()
    this.setupParticles()
    this.setupWeaponSystem()
    this.setupHealthUI()
    this.setupUpdate()
  }
  
  setupHealthUI() {
    // Crear textura de UI en pantalla completa
    this.healthUI = AdvancedDynamicTexture.CreateFullscreenUI('healthUI', true, this.scene)
    
    // Crear texto de vidas
    this.healthText = new TextBlock('healthText')
    this.healthText.text = `Vidas: ${this.currentHealth}`
    this.healthText.color = 'white'
    this.healthText.fontSize = 32
    this.healthText.fontFamily = 'Arial'
    this.healthText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
    this.healthText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
    this.healthText.left = '20px'
    this.healthText.top = '20px'
    this.healthText.outlineWidth = 2
    this.healthText.outlineColor = 'black'
    
    this.healthUI.addControl(this.healthText)
    
    console.log('Health UI inicializada')
  }
  
  updateHealthUI() {
    if (this.healthText) {
      this.healthText.text = `Vidas: ${this.currentHealth}`
      
      // Cambiar color según salud
      if (this.currentHealth <= 1) {
        this.healthText.color = 'red'
      } else if (this.currentHealth <= 2) {
        this.healthText.color = 'orange'
      } else {
        this.healthText.color = 'white'
      }
    }
  }
  
  setupWeaponSystem() {
    // Crear sistema de armas
    this.weaponSystem = new WeaponSystem(this, this.scene, {
      damage: 1,
      attackDuration: 0.15,
      attackCooldown: 0.35,
      debug: true, // Cambiar a false para ocultar la hitbox
      cameraShaker: this.cameraShaker // Pasar referencia al shake
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
    
    // ===== INVULNERABILIDAD UPDATE =====
    this.updateInvulnerability(deltaTime)
    
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
    
    // Decaer el recoil con el tiempo
    if (this.recoilVelocity.length() > 0.1) {
      this.recoilVelocity = this.recoilVelocity.scale(1 - this.recoilDecay * deltaTime)
    } else {
      this.recoilVelocity = Vector3.Zero()
    }
    
    // Crear nueva velocidad (mantener Y para respetar gravedad) + RECOIL
    const newVelocity = new Vector3(
      moveDirection.x * this.moveSpeed + this.recoilVelocity.x,
      currentVelocity.y, // Mantener velocidad vertical (gravedad)
      moveDirection.z * this.moveSpeed + this.recoilVelocity.z
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
      
      // Partículas de polvo al saltar con EffectManager
      const dustPos = this.mesh.getAbsolutePosition().clone()
      dustPos.y -= this.playerHeight / 2
      EffectManager.showDust(dustPos, {
        count: 12,
        duration: 0.35,
        direction: 'up'
      })
      
      // Partículas locales también
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
    
    // Partículas de polvo con EffectManager
    const dustPos = this.mesh.getAbsolutePosition().clone()
    dustPos.y -= this.playerHeight / 2 // A los pies
    EffectManager.showDust(dustPos, {
      count: 20,
      duration: 0.5,
      direction: 'radial'
    })
    
    // También emitir las partículas locales
    this.emitDust(20)
    
    // Camera shake suave
    if (this.cameraShaker) {
      this.cameraShaker.shakeSoft()
    }
    
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
  
  setRecoilForce(force) {
    console.log('Recoil force set to:', force)
    this.recoilForce = force
  }
  
  setPogoForce(force) {
    this.pogoForce = force
  }
  
  // ===== COMBAT SYSTEM =====
  
  /**
   * Aplica recoil (retroceso) al jugador cuando golpea a un enemigo
   * @param {Vector3} hitDirection - Dirección hacia el enemigo
   * @param {Vector3} enemyPosition - Posición del enemigo golpeado
   */
  applyRecoil(hitDirection, enemyPosition) {
    if (!this.body) return

    const currentVelocity = this.body.getLinearVelocity()
    const playerPos = this.mesh.getAbsolutePosition()
    
    // Detectar si es un ataque hacia abajo (pogo)
    // El enemigo está debajo del jugador Y el jugador está en el aire
    const isPogoHit = !this.isGrounded && enemyPosition.y < playerPos.y - 0.5
    
    if (isPogoHit) {
      // ===== POGO: Rebote hacia arriba =====
      console.log('¡POGO!')
      
      // Aplicar fuerza hacia arriba, cancelando velocidad negativa
      const pogoVelocity = new Vector3(
        currentVelocity.x * 0.5, // Reducir velocidad horizontal ligeramente
        this.pogoForce,          // Fuerza de pogo hacia arriba
        currentVelocity.z * 0.5
      )
      
      this.body.setLinearVelocity(pogoVelocity)
      
      // Feedback visual: pequeño squash
      this.targetScale = new Vector3(0.9, 1.15, 0.9)
      setTimeout(() => {
        this.targetScale = this.originalScale.clone()
      }, 80)
      
    } else {
      // ===== RECOIL HORIZONTAL: Retroceso normal =====
      console.log('Recoil! force:', this.recoilForce)
      
      // Dirección opuesta al golpe (alejarse del enemigo)
      const recoilDirection = hitDirection.scale(-1)
      recoilDirection.y = 0 // Mantener horizontal
      recoilDirection.normalize()
      
      // Aplicar recoil como velocidad adicional que decae
      this.recoilVelocity = new Vector3(
        recoilDirection.x * this.recoilForce,
        0,
        recoilDirection.z * this.recoilForce
      )
      
    }
  }
  
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
  
  // ===== SISTEMA DE DAÑO =====
  
  /**
   * El jugador recibe daño
   * @param {number} amount - Cantidad de daño
   * @param {Vector3} damageSourcePosition - Posición de la fuente de daño (para knockback)
   */
  takeDamage(amount, damageSourcePosition = null) {
    // Ignorar si es invulnerable o está muerto
    if (this.isInvulnerable || this.currentHealth <= 0) {
      console.log('Damage ignored (invulnerable or dead)')
      return
    }
    
    // Restar salud
    this.currentHealth -= amount
    console.log(`Player hit! Health: ${this.currentHealth}/${this.maxHealth}`)
    
    // Actualizar UI
    this.updateHealthUI()
    
    // Verificar muerte
    if (this.currentHealth <= 0) {
      this.die()
      return
    }
    
    // ===== KNOCKBACK =====
    if (damageSourcePosition && this.body) {
      const playerPos = this.mesh.getAbsolutePosition()
      const knockbackDir = playerPos.subtract(damageSourcePosition).normalize()
      knockbackDir.y = 0.3 // Pequeño impulso hacia arriba
      
      this.recoilVelocity = new Vector3(
        knockbackDir.x * this.damageKnockbackForce,
        0,
        knockbackDir.z * this.damageKnockbackForce
      )
      
      // También aplicar impulso vertical
      const currentVel = this.body.getLinearVelocity()
      this.body.setLinearVelocity(new Vector3(
        currentVel.x,
        this.damageKnockbackForce * 0.5,
        currentVel.z
      ))
    }
    
    // ===== INVULNERABILIDAD TEMPORAL =====
    this.startInvulnerability()
    
    // ===== CAMERA SHAKE FUERTE =====
    if (this.cameraShaker) {
      this.cameraShaker.shakeHard()
    }
  }
  
  startInvulnerability() {
    this.isInvulnerable = true
    this.invulnerabilityTimer = this.invulnerabilityDuration
    
    // Iniciar parpadeo visual
    this.startBlinking()
    
    console.log('Invulnerability started!')
  }
  
  startBlinking() {
    // Parpadear rápidamente (cada 100ms)
    let visible = true
    this.blinkInterval = setInterval(() => {
      visible = !visible
      this.mesh.visibility = visible ? 1 : 0.3
    }, 100)
  }
  
  stopBlinking() {
    if (this.blinkInterval) {
      clearInterval(this.blinkInterval)
      this.blinkInterval = null
    }
    // Restaurar visibilidad completa
    this.mesh.visibility = 1
  }
  
  updateInvulnerability(deltaTime) {
    if (!this.isInvulnerable) return
    
    this.invulnerabilityTimer -= deltaTime
    
    if (this.invulnerabilityTimer <= 0) {
      this.isInvulnerable = false
      this.stopBlinking()
      console.log('Invulnerability ended!')
    }
  }
  
  die() {
    console.log('Player died!')
    
    // Detener cualquier estado activo
    this.stopBlinking()
    this.isDashing = false
    this.recoilVelocity = Vector3.Zero()
    
    // Pequeña pausa dramática
    setTimeout(() => {
      this.respawn()
    }, 500)
  }
  
  respawn() {
    console.log('Respawning...')
    
    // Restaurar salud
    this.currentHealth = this.maxHealth
    this.updateHealthUI()
    
    // Teletransportar al spawn point
    this.mesh.position = this.spawnPoint.clone()
    
    // Resetear velocidad
    if (this.body) {
      this.body.setLinearVelocity(Vector3.Zero())
      this.body.setAngularVelocity(Vector3.Zero())
    }
    
    // Pequeña invulnerabilidad post-respawn
    this.startInvulnerability()
    
    console.log('Player respawned!')
  }
  
  setSpawnPoint(position) {
    this.spawnPoint = position.clone()
  }
  
  getHealth() {
    return this.currentHealth
  }
  
  getMaxHealth() {
    return this.maxHealth
  }
  
  isAlive() {
    return this.currentHealth > 0
  }
}
