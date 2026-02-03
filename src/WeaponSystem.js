import { 
  Vector3, 
  MeshBuilder,
  StandardMaterial,
  Color3
} from '@babylonjs/core'
import { EffectManager } from './EffectManager'

export class WeaponSystem {
  constructor(playerController, scene, options = {}) {
    this.player = playerController
    this.playerMesh = playerController.mesh
    this.playerBody = playerController.body
    this.scene = scene
    
    // Configuración del ataque
    this.damage = options.damage || 1
    this.attackDuration = options.attackDuration || 0.2  // Segundos que dura la hitbox
    this.attackCooldown = options.attackCooldown || 0.4  // Cooldown entre ataques
    this.hitboxSize = options.hitboxSize || new Vector3(1.5, 1, 1.5) // Tamaño de la hitbox
    this.hitboxOffset = options.hitboxOffset || 1.2 // Distancia frente al jugador
    this.playerKnockback = options.playerKnockback || 3 // Retroceso del jugador al golpear
    
    // Estado
    this.isAttacking = false
    this.attackTimer = 0
    this.cooldownTimer = 0
    this.hitbox = null
    this.hitEnemiesThisSwing = new Set() // Para evitar golpear al mismo enemigo múltiples veces
    this.hitObjectsThisSwing = new Set() // Para objetos inanimados
    
    // Lista de enemigos en la escena (se debe poblar externamente)
    this.enemies = []
    
    // Referencia al motor de física para raycast
    this.physicsEngine = scene.getPhysicsEngine()
    
    // CameraShaker (opcional)
    this.cameraShaker = options.cameraShaker || null
    
    // Debug: mostrar hitbox
    this.debugMode = options.debug || false
    
    this.createHitbox()
    this.setupInput()
    this.setupUpdate()
  }
  
  createHitbox() {
    // Crear mesh de hitbox (inicialmente invisible)
    this.hitbox = MeshBuilder.CreateBox('weaponHitbox', {
      width: this.hitboxSize.x,
      height: this.hitboxSize.y,
      depth: this.hitboxSize.z
    }, this.scene)
    
    // Posicionar frente al jugador
    this.hitbox.position = new Vector3(0, 0, this.hitboxOffset)
    
    // Hacer hijo del jugador para que rote con él
    this.hitbox.parent = this.playerMesh
    
    // Material (semi-transparente para debug, invisible en producción)
    const hitboxMat = new StandardMaterial('hitboxMat', this.scene)
    if (this.debugMode) {
      hitboxMat.diffuseColor = new Color3(1, 0.3, 0.3)
      hitboxMat.alpha = 0.3
    } else {
      hitboxMat.alpha = 0
    }
    this.hitbox.material = hitboxMat
    
    // Desactivar colisiones físicas (solo es un sensor)
    this.hitbox.isPickable = false
    this.hitbox.checkCollisions = false
    
    // Inicialmente invisible/desactivada
    this.hitbox.setEnabled(false)
  }
  
  setupInput() {
    // Click izquierdo
    this.scene.onPointerObservable.add((pointerInfo) => {
      // Tipo 1 = POINTERDOWN
      if (pointerInfo.type === 1 && pointerInfo.event.button === 0) {
        this.tryAttack()
      }
    })
    
    // Tecla K
    this.scene.onKeyboardObservable.add((kbInfo) => {
      if (kbInfo.type === 1 && kbInfo.event.key.toLowerCase() === 'k') {
        this.tryAttack()
      }
    })
  }
  
  setupUpdate() {
    this.scene.onBeforeRenderObservable.add(() => {
      this.update()
    })
  }
  
  update() {
    const deltaTime = this.scene.getEngine().getDeltaTime() / 1000
    
    // Actualizar cooldown
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= deltaTime
    }
    
    // Actualizar ataque activo
    if (this.isAttacking) {
      this.attackTimer -= deltaTime
      
      // Detectar colisiones con enemigos
      this.checkHits()
      
      // Terminar ataque
      if (this.attackTimer <= 0) {
        this.endAttack()
      }
    }
  }
  
  tryAttack() {
    // No atacar si está en cooldown o ya atacando
    if (this.cooldownTimer > 0 || this.isAttacking) {
      return false
    }
    
    this.startAttack()
    return true
  }
  
  startAttack() {
    this.isAttacking = true
    this.attackTimer = this.attackDuration
    this.cooldownTimer = this.attackCooldown
    this.hitEnemiesThisSwing.clear()
    this.hitObjectsThisSwing.clear()
    
    // Activar hitbox
    this.hitbox.setEnabled(true)
    if (this.debugMode) {
      this.hitbox.material.alpha = 0.5
    }
    
    // Feedback visual: escalar hitbox rápidamente (efecto "slash")
    this.animateHitbox()
    
    console.log('Attack started!')
  }
  
  animateHitbox() {
    // Animación simple de escala para el "swing"
    const startScale = new Vector3(0.5, 0.5, 0.5)
    const endScale = new Vector3(1, 1, 1)
    const duration = this.attackDuration * 1000 // ms
    const startTime = Date.now()
    
    const animate = () => {
      if (!this.isAttacking) return
      
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3)
      
      this.hitbox.scaling = Vector3.Lerp(startScale, endScale, eased)
      
      if (progress < 1 && this.isAttacking) {
        requestAnimationFrame(animate)
      }
    }
    
    animate()
  }
  
  checkHits() {
    // Iterar sobre todos los enemigos registrados
    for (const enemy of this.enemies) {
      // Saltar si ya fue golpeado en este swing o está muerto
      if (this.hitEnemiesThisSwing.has(enemy) || !enemy.isAlive()) {
        continue
      }
      
      // Verificar intersección con el mesh del enemigo
      if (this.hitbox.intersectsMesh(enemy.mesh, false)) {
        this.onHitEnemy(enemy)
      }
    }
    
    // También verificar colisión con objetos estáticos/inanimados
    this.checkObjectHits()
  }
  
  checkObjectHits() {
    // Obtener todos los meshes de la escena
    const meshes = this.scene.meshes
    
    for (const mesh of meshes) {
      // Saltar meshes que no deben ser golpeados
      if (!mesh.isEnabled()) continue
      if (mesh === this.hitbox) continue
      if (mesh === this.playerMesh) continue
      if (mesh.name === 'ground') continue // Ignorar el suelo
      if (mesh.name.includes('visionRange')) continue // Ignorar debug circles
      if (mesh.name.includes('Particle')) continue
      if (this.hitObjectsThisSwing.has(mesh)) continue
      
      // Verificar si es un enemigo (ya manejado arriba)
      if (mesh.metadata?.type === 'enemy') continue
      
      // Verificar si tiene física (es un objeto sólido)
      if (!mesh.physicsBody) continue
      
      // Verificar intersección
      if (this.hitbox.intersectsMesh(mesh, false)) {
        this.onHitObject(mesh)
      }
    }
  }
  
  onHitObject(mesh) {
    // Marcar como golpeado
    this.hitObjectsThisSwing.add(mesh)
    
    // Calcular posición del impacto
    const playerPos = this.playerMesh.getAbsolutePosition()
    const objectPos = mesh.getAbsolutePosition()
    
    // Punto de impacto (más cerca del objeto)
    const hitPosition = Vector3.Lerp(playerPos, objectPos, 0.7)
    
    // ===== EFECTO VISUAL: HitSpark (más pequeño para objetos) =====
    EffectManager.showHitSpark(hitPosition, {
      count: 15,
      duration: 0.2,
      speed: { min: 5, max: 10 },
      size: { min: 0.03, max: 0.12 }
    })
    
    // Pequeño hitstop (menos que con enemigos)
    this.hitstop(25)
    
    // ===== CAMERA SHAKE SUAVE =====
    if (this.cameraShaker) {
      this.cameraShaker.shake(0.08, 0.12) // Muy suave para objetos
    }
    
    console.log('Hit object:', mesh.name)
  }
  
  onHitEnemy(enemy) {
    // Marcar como golpeado en este swing
    this.hitEnemiesThisSwing.add(enemy)
    
    // Calcular dirección del knockback (del jugador hacia el enemigo)
    const playerPos = this.playerMesh.getAbsolutePosition()
    const enemyPos = enemy.mesh.getAbsolutePosition()
    const knockbackDir = enemyPos.subtract(playerPos).normalize()
    
    // ===== EFECTO VISUAL: HitSpark =====
    // Posición del impacto (punto medio entre jugador y enemigo)
    const hitPosition = Vector3.Lerp(playerPos, enemyPos, 0.6)
    hitPosition.y = enemyPos.y // Ajustar a la altura del enemigo
    EffectManager.showHitSpark(hitPosition)
    
    console.log('onHitEnemy called!')
    console.log('knockbackDir:', knockbackDir)
    console.log('this.player:', this.player)
    console.log('applyRecoil exists:', typeof this.player?.applyRecoil)
    
    // Aplicar daño al enemigo
    enemy.takeDamage(this.damage, knockbackDir)
    
    // Aplicar recoil al jugador (usa el método del PlayerController)
    if (this.player && this.player.applyRecoil) {
      console.log('Calling applyRecoil...')
      this.player.applyRecoil(knockbackDir, enemyPos)
    } else {
      console.error('applyRecoil not found on player!')
    }
    
    // Feedback: pequeño "hitstop" (congelar brevemente)
    this.hitstop()
    
    // ===== CAMERA SHAKE MEDIO =====
    if (this.cameraShaker) {
      this.cameraShaker.shakeMedium()
    }
    
    console.log('Hit enemy!')
  }
  
  hitstop(durationMs = 50) {
    // Efecto de "hitstop": pausar brevemente la física
    // Esto da sensación de impacto pesado
    const physicsEngine = this.scene.getPhysicsEngine()
    
    if (physicsEngine) {
      // Guardar el time step actual
      const originalTimeStep = physicsEngine.getTimeStep()
      
      // Ralentizar la física dramáticamente
      physicsEngine.setTimeStep(originalTimeStep * 0.1)
      
      setTimeout(() => {
        // Volver a velocidad normal
        physicsEngine.setTimeStep(originalTimeStep)
      }, durationMs)
    }
  }
  
  endAttack() {
    this.isAttacking = false
    this.hitbox.setEnabled(false)
    this.hitbox.scaling = Vector3.One()
    
    console.log('Attack ended!')
  }
  
  // ===== MÉTODOS PÚBLICOS =====
  
  /**
   * Registra un enemigo para la detección de colisiones
   * @param {EnemyDummy} enemy 
   */
  registerEnemy(enemy) {
    if (!this.enemies.includes(enemy)) {
      this.enemies.push(enemy)
    }
  }
  
  /**
   * Elimina un enemigo del registro
   * @param {EnemyDummy} enemy 
   */
  unregisterEnemy(enemy) {
    const index = this.enemies.indexOf(enemy)
    if (index > -1) {
      this.enemies.splice(index, 1)
    }
  }
  
  /**
   * Limpia todos los enemigos muertos del registro
   */
  cleanupDeadEnemies() {
    this.enemies = this.enemies.filter(e => e.isAlive())
  }
  
  setDamage(damage) {
    this.damage = damage
  }
  
  setDebugMode(enabled) {
    this.debugMode = enabled
    this.hitbox.material.alpha = enabled ? 0.3 : 0
  }
  
  isOnCooldown() {
    return this.cooldownTimer > 0
  }
  
  getCooldownProgress() {
    return Math.max(0, this.cooldownTimer / this.attackCooldown)
  }
}
