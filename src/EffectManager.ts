import { 
  Vector3, 
  ParticleSystem,
  Color4,
  DynamicTexture
} from '@babylonjs/core'

/**
 * EffectManager - Singleton para gestionar efectos visuales de partículas
 * Uso: EffectManager.init(scene) una vez, luego EffectManager.showHitSpark(position)
 */
class EffectManagerClass {
  scene: any = null
  sparkTexture: any = null
  dustTexture: any = null
  isInitialized: boolean = false

  constructor() {}

  /**
   * Inicializa el EffectManager con la escena
   * @param {Scene} scene - La escena de Babylon.js
   */
  init(scene: any) {
    if (this.isInitialized) return
    
    this.scene = scene
    this.createTextures()
    this.isInitialized = true
    
    console.log('EffectManager initialized')
  }

  /**
   * Crea texturas procedurales para las partículas
   */
  createTextures() {
    // ===== TEXTURA CIRCULAR BRILLANTE (para chispas) =====
    this.sparkTexture = this.createCircleTexture('sparkTexture', 64, true)
    
    // ===== TEXTURA CUADRADA SUAVE (para polvo) =====
    this.dustTexture = this.createSquareTexture('dustTexture', 32)
  }

  /**
   * Crea una textura circular con gradiente radial
   */
  createCircleTexture(name: string, size: number, glow: boolean = false) {
    const dynamicTexture = new DynamicTexture(name, size, this.scene, false)
    const ctx = dynamicTexture.getContext()
    
    const center = size / 2
    const radius = size / 2 - 2
    
    // Crear gradiente radial (centro brillante, bordes suaves)
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius)
    
    if (glow) {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')    // Centro: blanco puro
      gradient.addColorStop(0.3, 'rgba(255, 255, 200, 0.9)') // Amarillo claro
      gradient.addColorStop(0.7, 'rgba(255, 200, 100, 0.5)') // Naranja
      gradient.addColorStop(1, 'rgba(255, 100, 50, 0)')      // Borde: transparente
    } else {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    }
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.fill()
    
    dynamicTexture.update()
    return dynamicTexture
  }

  /**
   * Crea una textura cuadrada con bordes suaves
   */
  createSquareTexture(name: string, size: number) {
    const dynamicTexture = new DynamicTexture(name, size, this.scene, false)
    const ctx = dynamicTexture.getContext()
    
    // Gradiente radial suave
    const center = size / 2
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    
    dynamicTexture.update()
    return dynamicTexture
  }

  // ==========================================================
  // EFECTO: HIT SPARK (Chispas de golpe)
  // ==========================================================
  
  /**
   * Muestra chispas de impacto en una posición
   * @param {Vector3} position - Posición donde aparecen las chispas
   * @param {Object} options - Opciones de personalización
   */
  showHitSpark(position: any, options: any = {}) {
    if (!this.isInitialized) {
      console.warn('EffectManager not initialized! Call EffectManager.init(scene) first.')
      return
    }
    
    console.log('showHitSpark called at:', position.toString())

    const {
      count = 30,           // Cantidad de partículas
      duration = 0.25,      // Duración del efecto
      size = { min: 0.05, max: 0.2 },
      speed = { min: 8, max: 15 },
      spread = 1,           // Radio de dispersión inicial
      colorStart = new Color4(1, 1, 1, 1),         // Blanco
      colorEnd = new Color4(1, 0.5, 0.1, 0),       // Naranja transparente
      stretch = true        // Estirar partículas en dirección del movimiento
    } = options

    // Crear sistema de partículas temporal
    const sparks = new ParticleSystem('hitSpark', count, this.scene)
    
    // Configuración básica
    sparks.particleTexture = this.sparkTexture
    sparks.emitter = position.clone()
    
    // Área de emisión (pequeña esfera)
    sparks.minEmitBox = new Vector3(-0.1, -0.1, -0.1)
    sparks.maxEmitBox = new Vector3(0.1, 0.1, 0.1)
    
    // ===== COLORES (degradado de blanco a naranja/rojo) =====
    sparks.color1 = colorStart.clone()
    sparks.color2 = new Color4(1, 0.9, 0.5, 1) // Amarillo claro
    sparks.colorDead = colorEnd.clone()
    
    // ===== TAMAÑO =====
    sparks.minSize = size.min
    sparks.maxSize = size.max
    
    // Escalar en una dirección para efecto de "estela" (stretch)
    if (stretch) {
      sparks.minScaleX = 1
      sparks.maxScaleX = 3    // Estirar horizontalmente
      sparks.minScaleY = 0.3
      sparks.maxScaleY = 0.8
    }
    
    // ===== VIDA MUY CORTA (feedback instantáneo) =====
    sparks.minLifeTime = duration * 0.5
    sparks.maxLifeTime = duration
    
    // ===== VELOCIDAD ALTA (explosión) =====
    // Dirección esférica
    sparks.direction1 = new Vector3(-spread, -spread, -spread)
    sparks.direction2 = new Vector3(spread, spread, spread)
    sparks.minEmitPower = speed.min
    sparks.maxEmitPower = speed.max
    
    // ===== RESISTENCIA ALTA (frenar rápido) =====
    sparks.gravity = new Vector3(0, -15, 0)  // Gravedad fuerte
    
    // Factor de arrastre para que frenen
    sparks.addDragGradient(0, 0)
    sparks.addDragGradient(0.3, 0.5)
    sparks.addDragGradient(1, 0.9)
    
    // ===== TRANSPARENCIA =====
    sparks.addColorGradient(0, colorStart)
    sparks.addColorGradient(0.3, new Color4(1, 0.8, 0.3, 0.9))
    sparks.addColorGradient(0.7, new Color4(1, 0.5, 0.2, 0.5))
    sparks.addColorGradient(1, colorEnd)
    
    // ===== EMISIÓN =====
    sparks.emitRate = 0  // No emitir continuamente
    sparks.manualEmitCount = count  // Emitir todas de una vez
    
    // ===== AUTO-LIMPIEZA =====
    // NO usar disposeOnStop porque puede causar problemas
    // En su lugar, limpiar manualmente después de la duración
    sparks.disposeOnStop = false
    
    // Blending aditivo para que brillen
    sparks.blendMode = ParticleSystem.BLENDMODE_ADD
    
    // ¡Arrancar!
    sparks.start()
    
    // Detener y limpiar después de la duración
    const cleanupDelay = (duration * 1000) + 100
    setTimeout(() => {
      if (sparks) {
        sparks.stop()
        sparks.dispose()
      }
    }, cleanupDelay)
  }

  // ==========================================================
  // EFECTO: DUST (Polvo al saltar/aterrizar)
  // ==========================================================
  
  /**
   * Muestra partículas de polvo
   * @param {Vector3} position - Posición donde aparece el polvo
   * @param {Object} options - Opciones de personalización
   */
  showDust(position: any, options: any = {}) {
    if (!this.isInitialized) {
      console.warn('EffectManager not initialized!')
      return
    }

    const {
      count = 15,
      duration = 0.4,
      size = { min: 0.08, max: 0.2 },
      speed = { min: 1, max: 3 },
      color = new Color4(0.6, 0.5, 0.4, 0.8),  // Gris/marrón
      direction = 'up'  // 'up', 'left', 'right', 'radial'
    } = options

    const dust = new ParticleSystem('dust', count, this.scene)
    
    dust.particleTexture = this.dustTexture
    dust.emitter = position.clone()
    
    // Área de emisión horizontal
    dust.minEmitBox = new Vector3(-0.4, 0, -0.4)
    dust.maxEmitBox = new Vector3(0.4, 0.1, 0.4)
    
    // ===== COLORES =====
    dust.color1 = color.clone()
    dust.color2 = new Color4(color.r * 0.8, color.g * 0.8, color.b * 0.8, color.a * 0.8)
    dust.colorDead = new Color4(color.r * 0.5, color.g * 0.5, color.b * 0.5, 0)
    
    // ===== TAMAÑO =====
    dust.minSize = size.min
    dust.maxSize = size.max
    
    // Crecer ligeramente
    dust.addSizeGradient(0, 0.8)
    dust.addSizeGradient(0.5, 1)
    dust.addSizeGradient(1, 0.6)
    
    // ===== VIDA =====
    dust.minLifeTime = duration * 0.6
    dust.maxLifeTime = duration
    
    // ===== DIRECCIÓN según el tipo =====
    switch (direction) {
      case 'up':
        dust.direction1 = new Vector3(-0.5, 0.5, -0.5)
        dust.direction2 = new Vector3(0.5, 1.5, 0.5)
        break
      case 'left':
        dust.direction1 = new Vector3(-1.5, 0.3, -0.3)
        dust.direction2 = new Vector3(-0.5, 0.8, 0.3)
        break
      case 'right':
        dust.direction1 = new Vector3(0.5, 0.3, -0.3)
        dust.direction2 = new Vector3(1.5, 0.8, 0.3)
        break
      case 'radial':
      default:
        dust.direction1 = new Vector3(-1, 0.2, -1)
        dust.direction2 = new Vector3(1, 1, 1)
    }
    
    dust.minEmitPower = speed.min
    dust.maxEmitPower = speed.max
    
    // ===== GRAVEDAD SUAVE (sube y luego baja) =====
    dust.gravity = new Vector3(0, -2, 0)
    
    // ===== TRANSPARENCIA GRADUAL =====
    dust.addColorGradient(0, color)
    dust.addColorGradient(0.5, new Color4(color.r, color.g, color.b, color.a * 0.6))
    dust.addColorGradient(1, new Color4(color.r * 0.5, color.g * 0.5, color.b * 0.5, 0))
    
    // ===== EMISIÓN =====
    dust.emitRate = 0
    dust.manualEmitCount = count
    
    // ===== AUTO-LIMPIEZA =====
    dust.disposeOnStop = false
    
    // Blending standard
    dust.blendMode = ParticleSystem.BLENDMODE_STANDARD
    
    dust.start()
    
    const cleanupDelay = (duration * 1000) + 100
    setTimeout(() => {
      if (dust) {
        dust.stop()
        dust.dispose()
      }
    }, cleanupDelay)
  }

  // ==========================================================
  // EFECTO: DASH TRAIL (Estela de dash)
  // ==========================================================
  
  /**
   * Muestra estela de dash
   * @param {Vector3} position - Posición inicial
   * @param {Vector3} direction - Dirección del dash
   */
  showDashTrail(position: any, direction: any, options: any = {}) {
    if (!this.isInitialized) return

    const {
      count = 20,
      duration = 0.3,
      color = new Color4(0.3, 0.8, 1, 0.9)  // Cyan
    } = options

    const trail = new ParticleSystem('dashTrail', count, this.scene)
    
    trail.particleTexture = this.sparkTexture
    trail.emitter = position.clone()
    
    trail.minEmitBox = new Vector3(-0.2, -0.5, -0.2)
    trail.maxEmitBox = new Vector3(0.2, 0.5, 0.2)
    
    // Color cyan/azul
    trail.color1 = color.clone()
    trail.color2 = new Color4(color.r * 1.2, color.g * 1.1, color.b, color.a * 0.8)
    trail.colorDead = new Color4(color.r * 0.5, color.g * 0.8, color.b, 0)
    
    trail.minSize = 0.1
    trail.maxSize = 0.25
    
    trail.minLifeTime = duration * 0.5
    trail.maxLifeTime = duration
    
    // Dirección opuesta al movimiento
    const oppositeDir = direction.scale(-1)
    trail.direction1 = new Vector3(
      oppositeDir.x - 0.3,
      oppositeDir.y - 0.3,
      oppositeDir.z - 0.3
    )
    trail.direction2 = new Vector3(
      oppositeDir.x + 0.3,
      oppositeDir.y + 0.3,
      oppositeDir.z + 0.3
    )
    
    trail.minEmitPower = 2
    trail.maxEmitPower = 4
    
    trail.gravity = Vector3.Zero()
    
    trail.emitRate = 0
    trail.manualEmitCount = count
    
    trail.disposeOnStop = false
    
    trail.blendMode = ParticleSystem.BLENDMODE_ADD
    
    trail.start()
    
    const cleanupDelay = (duration * 1000) + 100
    setTimeout(() => {
      if (trail) {
        trail.stop()
        trail.dispose()
      }
    }, cleanupDelay)
  }

  // ==========================================================
  // LIMPIEZA
  // ==========================================================
  
  dispose() {
    if (this.sparkTexture) {
      this.sparkTexture.dispose()
    }
    if (this.dustTexture) {
      this.dustTexture.dispose()
    }
    this.isInitialized = false
    console.log('EffectManager disposed')
  }
}

// Exportar instancia singleton
export const EffectManager = new EffectManagerClass()
