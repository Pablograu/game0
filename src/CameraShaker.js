import { Vector3 } from '@babylonjs/core'

/**
 * CameraShaker - Sistema de sacudida de cámara para feedback de impacto
 * Aplica vibración temporal a la cámara con decay gradual
 */
export class CameraShaker {
  constructor(camera, scene) {
    this.camera = camera
    this.scene = scene
    
    // Estado de la vibración
    this.isShaking = false
    this.intensity = 0
    this.duration = 0
    this.elapsed = 0
    this.maxIntensity = 0 // Para el decay
    
    // Offset aplicado a la cámara
    this.offset = Vector3.Zero()
    
    // Frecuencia de la vibración (Hz)
    this.frequency = 30 // Vibraciones por segundo
    
    // Setup del update loop
    this.setupUpdate()
    
    console.log('CameraShaker initialized')
  }
  
  setupUpdate() {
    // Registrar en el loop de renderizado
    this.scene.onBeforeRenderObservable.add(() => {
      this.update()
    })
  }
  
  /**
   * Inicia una sacudida de cámara
   * @param {number} intensity - Intensidad del shake (0.0 - 1.0 recomendado)
   * @param {number} duration - Duración en segundos
   */
  shake(intensity, duration) {
    console.log(`Camera shake: intensity=${intensity}, duration=${duration}s`)
    
    // Si ya está temblando, sumar intensidad (acumulativo)
    if (this.isShaking) {
      this.intensity = Math.max(this.intensity, intensity)
      this.maxIntensity = Math.max(this.maxIntensity, intensity)
      // Extender duración si la nueva es mayor
      this.duration = Math.max(this.duration, duration)
      this.elapsed = 0 // Reset el timer
    } else {
      // Nueva sacudida
      this.isShaking = true
      this.intensity = intensity
      this.maxIntensity = intensity
      this.duration = duration
      this.elapsed = 0
      
      // NO tocar lockedTarget - dejarlo activo para que siga al jugador
      // Solo vamos a añadir offsets aleatorios cada frame
    }
  }
  
  update() {
    if (!this.isShaking) return
    
    const deltaTime = this.scene.getEngine().getDeltaTime() / 1000
    
    // Incrementar tiempo
    this.elapsed += deltaTime
    
    // Calcular progreso (0 a 1)
    const progress = Math.min(this.elapsed / this.duration, 1)
    
    // ===== DECAY (desvanecimiento suave) =====
    // Usar ease-out quad para suavizar
    const decayFactor = 1 - (progress * progress)
    this.intensity = this.maxIntensity * decayFactor
    
    // ===== GENERAR OFFSET ALEATORIO =====
    if (this.intensity > 0.001) {
      // Vibración aleatoria en ángulos de la cámara
      // Multiplicadores más grandes para que sea visible
      const randomAlpha = (Math.random() - 0.5) * 2 * this.intensity
      const randomBeta = (Math.random() - 0.5) * 2 * this.intensity
      const randomRadius = (Math.random() - 0.5) * 2 * this.intensity * 2
      
      // ===== APLICAR OFFSET A LA CÁMARA =====
      // Añadir el offset directamente (lockedTarget sigue funcionando)
      this.camera.alpha += randomAlpha
      this.camera.beta += randomBeta
      this.camera.radius += randomRadius
      
      console.log(`Shake offset - alpha: ${randomAlpha.toFixed(3)}, beta: ${randomBeta.toFixed(3)}, intensity: ${this.intensity.toFixed(3)}`)
    }
    
    // ===== FINALIZAR SHAKE =====
    if (progress >= 1) {
      this.stopShake()
    }
  }
  
  stopShake() {
    console.log('Camera shake stopped')
    
    this.isShaking = false
    this.intensity = 0
    this.elapsed = 0
    this.offset = Vector3.Zero()
    
    // No necesitamos restaurar nada - lockedTarget nunca se desactivó
    // La cámara volverá automáticamente a su comportamiento normal
  }
  
  // ===== MÉTODOS DE CONVENIENCIA =====
  
  /**
   * Shake suave (saltar/aterrizar)
   */
  shakeSoft() {
    this.shake(0.05, 0.15)
  }
  
  /**
   * Shake medio (golpear enemigo)
   */
  shakeMedium() {
    this.shake(0.15, 0.2)
  }
  
  /**
   * Shake fuerte (recibir daño)
   */
  shakeHard() {
    this.shake(0.3, 0.3)
  }
  
  /**
   * Shake muy fuerte (muerte, explosión)
   */
  shakeVeryHard() {
    this.shake(0.5, 0.4)
  }
  
  /**
   * Configura la frecuencia de vibración
   * @param {number} hz - Vibraciones por segundo
   */
  setFrequency(hz) {
    this.frequency = hz
  }
  
  /**
   * Detiene inmediatamente cualquier shake
   */
  forceStop() {
    if (this.isShaking) {
      this.stopShake()
    }
  }
  
  /**
   * Verifica si está vibrando
   */
  isCurrentlyShaking() {
    return this.isShaking
  }
}
