import { 
  Vector3, 
  StandardMaterial, 
  Color3,
  PhysicsAggregate,
  PhysicsShapeType
} from '@babylonjs/core'

export class EnemyDummy {
  constructor(mesh, scene, options = {}) {
    this.mesh = mesh
    this.scene = scene
    
    // Configuración
    this.maxHP = options.hp || 3
    this.hp = this.maxHP
    this.knockbackForce = options.knockbackForce || 15
    
    // Estado
    this.isDead = false
    this.isHitFlashing = false
    
    // Guardar color original
    this.originalColor = null
    this.hitColor = new Color3(1, 1, 1) // Blanco brillante
    
    // Configurar física y material
    this.setupPhysics(options)
    this.setupMaterial()
    
    // Tag para identificar enemigos
    this.mesh.metadata = { type: 'enemy', instance: this }
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
    
    // Configurar inercia para que no rote tanto
    this.body.setMassProperties({
      mass: options.mass || 2,
      inertia: new Vector3(5, 5, 5)
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
  
  reset() {
    this.hp = this.maxHP
    this.isDead = false
    if (this.mesh.material) {
      this.mesh.material.diffuseColor = this.originalColor.clone()
      this.mesh.material.emissiveColor = new Color3(0, 0, 0)
    }
  }
}
