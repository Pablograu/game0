import { 
  Vector3, 
  StandardMaterial, 
  Color3,
  PhysicsAggregate,
  PhysicsShapeType,
  PhysicsRaycastResult,
  RayHelper,
  Ray
} from '@babylonjs/core'

export class EnemyDummy {
  constructor(mesh, scene, options = {}) {
    this.mesh = mesh
    this.scene = scene
    this.physicsEngine = scene.getPhysicsEngine()
    
    // Configuración de combate
    this.maxHP = options.hp || 3
    this.hp = this.maxHP
    this.knockbackForce = options.knockbackForce || 15
    
    // ===== CONFIGURACIÓN DE PATRULLA =====
    this.patrolSpeed = options.patrolSpeed || 3
    this.patrolDirection = options.patrolDirection || 1 // 1 = adelante, -1 = atrás
    this.detectionDistance = options.detectionDistance || 1.5 // Distancia para detectar paredes
    this.edgeDetectionOffset = options.edgeDetectionOffset || 0.8 // Offset frontal para detección de bordes
    
    // ===== ESTADO =====
    this.isDead = false
    this.isHitFlashing = false
    this.isStunned = false
    this.stunTimer = 0
    this.stunDuration = options.stunDuration || 0.5 // Segundos de stun tras recibir daño
    
    // ===== DAÑO AL JUGADOR =====
    this.contactDamage = options.contactDamage || 1 // Daño al tocar al jugador
    this.playerRef = null // Referencia al PlayerController (se asigna externamente)
    this.canDamagePlayer = true
    this.damageCooldown = 0.5 // Cooldown entre daños
    this.damageCooldownTimer = 0
    
    // ===== DEBUG =====
    this.debugMode = options.debug || false
    this.rayHelperEdge = null
    this.rayHelperWall = null
    
    // Guardar color original
    this.originalColor = null
    this.hitColor = new Color3(1, 1, 1) // Blanco brillante
    
    // Dimensiones del enemigo (para raycast)
    this.enemyHeight = options.height || 2
    this.enemyWidth = options.width || 1.2
    
    // Resultados de raycast (reutilizables para performance)
    this.edgeRayResult = new PhysicsRaycastResult()
    this.wallRayResult = new PhysicsRaycastResult()
    
    // Configurar física y material
    this.setupPhysics(options)
    this.setupMaterial()
    this.setupUpdate()
    
    // Tag para identificar enemigos
    this.mesh.metadata = { type: 'enemy', instance: this }
    
    console.log('EnemyDummy creado con patrulla')
  }
  
  setupPhysics(options) {
    // Física dinámica para que pueda ser empujado
    this.physicsAggregate = new PhysicsAggregate(
      this.mesh, 
      PhysicsShapeType.BOX, 
      {
        mass: options.mass || 2,
        restitution: 0.2,
        friction: 0.8
      }, 
      this.scene
    )
    
    this.body = this.mesh.physicsBody
    
    // Bloquear rotación para que no ruede
    this.body.setMassProperties({
      mass: options.mass || 2,
      inertia: new Vector3(0, 0, 0) // Sin rotación
    })
  }
  
  setupMaterial() {
    // Crear material si no tiene
    if (!this.mesh.material) {
      const mat = new StandardMaterial('enemyMat', this.scene)
      mat.diffuseColor = new Color3(0.8, 0.2, 0.8) // Púrpura por defecto
      this.mesh.material = mat
    }
    
    // Guardar color original
    this.originalColor = this.mesh.material.diffuseColor.clone()
    this.mesh.material.emissiveColor = new Color3(0, 0, 0)
  }
  
  setupUpdate() {
    // Update loop
    this.scene.onBeforeRenderObservable.add(() => {
      this.update()
    })
  }
  
  update() {
    if (this.isDead || !this.body) return
    
    const deltaTime = this.scene.getEngine().getDeltaTime() / 1000
    
    // Actualizar cooldown de daño al jugador
    if (this.damageCooldownTimer > 0) {
      this.damageCooldownTimer -= deltaTime
      if (this.damageCooldownTimer <= 0) {
        this.canDamagePlayer = true
      }
    }
    
    // Detectar colisión con jugador
    this.checkPlayerCollision()
    
    // Actualizar stun
    if (this.isStunned) {
      this.stunTimer -= deltaTime
      if (this.stunTimer <= 0) {
        this.isStunned = false
        console.log('Enemy recovered from stun')
      }
      // Durante el stun, mantener rotación bloqueada pero no patrullar
      this.body.setAngularVelocity(Vector3.Zero())
      return
    }
    
    // ===== PATRULLA =====
    this.patrol()
    
    // Bloquear rotación angular siempre
    this.body.setAngularVelocity(Vector3.Zero())
  }
  
  checkPlayerCollision() {
    if (!this.playerRef || !this.canDamagePlayer) return
    
    const playerMesh = this.playerRef.mesh
    if (!playerMesh) return
    
    // Verificar intersección de meshes
    if (this.mesh.intersectsMesh(playerMesh, false)) {
      // Dañar al jugador
      const enemyPos = this.mesh.getAbsolutePosition()
      this.playerRef.takeDamage(this.contactDamage, enemyPos)
      
      // Iniciar cooldown
      this.canDamagePlayer = false
      this.damageCooldownTimer = this.damageCooldown
      
      console.log('Enemy touched player!')
    }
  }
  
  patrol() {
    const pos = this.mesh.position.clone()
    
    // ===== DETECCIÓN DE BORDES (Raycast hacia abajo desde el frente) =====
    const edgeDetected = this.checkEdge(pos)
    
    // ===== DETECCIÓN DE PAREDES (Raycast frontal) =====
    const wallDetected = this.checkWall(pos)
    
    // Si detecta borde o pared, girar
    if (edgeDetected || wallDetected) {
      this.turnAround()
    }
    
    // Aplicar movimiento de patrulla
    const currentVelocity = this.body.getLinearVelocity()
    const patrolVelocity = new Vector3(
      this.patrolDirection * this.patrolSpeed,
      currentVelocity.y, // Mantener gravedad
      0 // Patrulla solo en eje X por ahora
    )
    
    this.body.setLinearVelocity(patrolVelocity)
  }
  
  checkEdge(pos) {
    // Punto de inicio: frente del enemigo, a la altura de los pies
    const frontOffset = this.patrolDirection * this.edgeDetectionOffset
    const rayStart = new Vector3(
      pos.x + frontOffset,
      pos.y - (this.enemyHeight / 2) + 0.1, // Ligeramente por encima de los pies
      pos.z
    )
    
    // Punto final: hacia abajo
    const rayLength = 1.5 // Longitud del rayo hacia abajo
    const rayEnd = new Vector3(
      rayStart.x,
      rayStart.y - rayLength,
      rayStart.z
    )
    
    // Realizar raycast
    this.physicsEngine.raycastToRef(rayStart, rayEnd, this.edgeRayResult)
    
    // Debug: mostrar rayo
    if (this.debugMode) {
      this.debugDrawRay(rayStart, rayEnd, !this.edgeRayResult.hasHit)
    }
    
    // Si NO hay hit, hay un borde/abismo
    if (!this.edgeRayResult.hasHit) {
      return true // Borde detectado
    }
    
    // Verificar que no sea el propio mesh
    if (this.edgeRayResult.body === this.body) {
      return true // Tratarlo como borde para evitar problemas
    }
    
    return false
  }
  
  checkWall(pos) {
    // Punto de inicio: centro del enemigo
    const rayStart = new Vector3(
      pos.x,
      pos.y, // A la altura del centro
      pos.z
    )
    
    // Punto final: hacia adelante en la dirección de patrulla
    const rayEnd = new Vector3(
      pos.x + (this.patrolDirection * this.detectionDistance),
      pos.y,
      pos.z
    )
    
    // Realizar raycast
    this.physicsEngine.raycastToRef(rayStart, rayEnd, this.wallRayResult)
    
    // Debug: mostrar rayo
    if (this.debugMode) {
      this.debugDrawRay(rayStart, rayEnd, this.wallRayResult.hasHit)
    }
    
    // Si hay hit Y no es el propio mesh
    if (this.wallRayResult.hasHit && this.wallRayResult.body !== this.body) {
      return true // Pared detectada
    }
    
    return false
  }
  
  turnAround() {
    // Invertir dirección
    this.patrolDirection *= -1
    
    // Visual feedback: voltear el mesh en X para que "mire" hacia donde va
    this.mesh.scaling.x = this.patrolDirection * Math.abs(this.mesh.scaling.x)
    
    console.log('Enemy turned around, new direction:', this.patrolDirection)
  }
  
  sdebugDrawRay(start, end, isAlert) {
    // Crear un rayo visual temporal para debug
    const ray = new Ray(start, end.subtract(start).normalize(), Vector3.Distance(start, end))
    const rayHelper = RayHelper.CreateAndShow(ray, this.scene, isAlert ? new Color3(1, 0, 0) : new Color3(0, 1, 0))
    
    // Eliminar después de un frame
    setTimeout(() => {
      rayHelper.dispose()
    }, 16)
  }
  
  /**
   * Recibe daño y aplica knockback
   * @param {number} amount - Cantidad de daño
   * @param {Vector3} knockbackDirection - Dirección del golpe (normalizada)
   * @returns {boolean} - True si el enemigo murió
   */
  takeDamage(amount, knockbackDirection) {
    if (this.isDead) return false
    
    // Restar vida
    this.hp -= amount
    console.log(`Enemy hit! HP: ${this.hp}/${this.maxHP}`)
    
    // ===== STUN: Detener patrulla brevemente =====
    this.isStunned = true
    this.stunTimer = this.stunDuration
    
    // ===== VISUAL FEEDBACK: Flash blanco =====
    this.flashHit()
    
    // ===== PHYSICS FEEDBACK: Knockback =====
    if (knockbackDirection && this.body) {
      // Normalizar y aplicar fuerza
      const knockback = knockbackDirection.normalize().scale(this.knockbackForce)
      // Añadir componente vertical para que "despegue" un poco
      knockback.y = this.knockbackForce * 0.3
      
      // Aplicar impulso
      this.body.applyImpulse(
        knockback,
        this.mesh.getAbsolutePosition()
      )
    }
    
    // Verificar muerte
    if (this.hp <= 0) {
      this.die()
      return true
    }
    
    return false
  }
  
  flashHit() {
    if (this.isHitFlashing) return
    this.isHitFlashing = true
    
    const material = this.mesh.material
    
    // Cambiar a blanco brillante
    material.diffuseColor = this.hitColor.clone()
    material.emissiveColor = this.hitColor.clone()
    
    // Volver al color original después de 100ms
    setTimeout(() => {
      if (!this.isDead && material) {
        material.diffuseColor = this.originalColor.clone()
        material.emissiveColor = new Color3(0, 0, 0)
      }
      this.isHitFlashing = false
    }, 100)
  }
  
  die() {
    this.isDead = true
    console.log('Enemy defeated!')
    
    // Detener movimiento
    if (this.body) {
      this.body.setLinearVelocity(Vector3.Zero())
    }
    
    // Efecto de muerte: escalar hacia abajo y desaparecer
    const deathDuration = 300 // ms
    const startTime = Date.now()
    const originalScale = this.mesh.scaling.clone()
    
    const deathAnimation = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / deathDuration, 1)
      
      // Escalar hacia abajo
      const scale = 1 - progress
      this.mesh.scaling = originalScale.scale(scale)
      
      // Rotar mientras muere
      this.mesh.rotation.y += 0.2
      this.mesh.rotation.x += 0.1
      
      if (progress < 1) {
        requestAnimationFrame(deathAnimation)
      } else {
        // Limpiar
        this.dispose()
      }
    }
    
    deathAnimation()
  }
  
  dispose() {
    // Eliminar física
    if (this.physicsAggregate) {
      this.physicsAggregate.dispose()
    }
    
    // Eliminar mesh
    if (this.mesh) {
      this.mesh.dispose()
    }
    
    console.log('Enemy disposed')
  }
  
  // ===== MÉTODOS PÚBLICOS =====
  
  isAlive() {
    return !this.isDead && this.hp > 0
  }
  
  getHP() {
    return this.hp
  }
  
  getMaxHP() {
    return this.maxHP
  }
  
  setPatrolSpeed(speed) {
    this.patrolSpeed = speed
  }
  
  setDebugMode(enabled) {
    this.debugMode = enabled
  }
  
  /**
   * Asigna la referencia al PlayerController para poder dañarlo
   * @param {PlayerController} player 
   */
  setPlayerRef(player) {
    this.playerRef = player
  }
  
  reset() {
    this.hp = this.maxHP
    this.isDead = false
    this.isStunned = false
    this.stunTimer = 0
    this.canDamagePlayer = true
    this.damageCooldownTimer = 0
    if (this.mesh.material) {
      this.mesh.material.diffuseColor = this.originalColor.clone()
      this.mesh.material.emissiveColor = new Color3(0, 0, 0)
    }
  }
}
