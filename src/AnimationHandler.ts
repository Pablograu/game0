import { AnimationGroup, Mesh, Quaternion, Vector3 } from '@babylonjs/core'

interface AnimationModel {
  root: Mesh
  animations: AnimationGroup[]
}

interface AnimationModels {
  [key: string]: AnimationModel
}

interface AnimationConfig {
  loop: boolean
  speed?: number
  onComplete?: () => void
}

/**
 * AnimationHandler - Sistema profesional de animaciones con blending suave
 * 
 * Características:
 * - Transiciones suaves entre animaciones (blending 0.25s)
 * - Fix automático de root motion (mantiene modelo en 0,0,0)
 * - Limpieza apropiada de animaciones anteriores
 * - Soporte para animaciones one-shot (ataques, etc.)
 * - Preservación de rotación entre cambios de animación
 */
export class AnimationHandler {
  private models: AnimationModels
  private currentAnimation: string
  private blendDuration: number = 0.25 // Duración del blending en segundos
  private physicsBody: Mesh // Referencia a la cápsula física
  private defaultSpeed: number = 1.0
  private isPlayingOneShot: boolean = false
  private queuedAnimation: string | null = null
  private rootMotionAnimations: Set<string> = new Set(['breakdance']) // Animaciones que usan root motion
  private lastRootPosition: Vector3 = Vector3.Zero() // Para trackear delta de movimiento

  constructor(models: AnimationModels, physicsBody: Mesh, initialAnimation: string = 'idle') {
    this.models = models
    this.physicsBody = physicsBody
    this.currentAnimation = ''

    // Configurar todas las animaciones con blending
    this.setupAnimations()
    
    // Iniciar la animación inicial (forzar para que se active correctamente)
    this.play(initialAnimation, { loop: true })
  }

  /**
   * Configurar propiedades de blending y root motion fix
   */
  private setupAnimations() {
    // Detectar si todas las animaciones usan el mismo root
    const roots = new Set(Object.values(this.models).map(m => m.root))
    const isSingleMesh = roots.size === 1
    
    if (isSingleMesh) {
      console.log('AnimationHandler: Modo single mesh detectado')
    }

    Object.keys(this.models).forEach(animName => {
      const model = this.models[animName]
      
      if (!model || !model.animations) return

      model.animations.forEach(animGroup => {
        // Habilitar blending para transiciones suaves
        animGroup.enableBlending = true
        animGroup.blendingSpeed = 1 / this.blendDuration // Blend speed = 1/duration

        // Normalizar el grupo (asegura que todos los animatables estén sincronizados)
        animGroup.normalize(0, animGroup.to)
        
        // Fix para root motion: Prevenir que la animación mueva el root
        animGroup.onAnimationGroupLoopObservable.add(() => {
          this.fixRootMotion(model.root)
        })

        animGroup.onAnimationGroupEndObservable.add(() => {
          this.fixRootMotion(model.root)
        })
        
        // Detener todas las animaciones inicialmente
        animGroup.stop()
      })
    })
    
    // Activar el root si es single mesh (siempre visible)
    if (isSingleMesh) {
      const firstModel = Object.values(this.models)[0]
      if (firstModel?.root) {
        firstModel.root.setEnabled(true)
      }
    }
  }

  /**
   * Fix root motion: Fuerza el root del modelo a permanecer en (0, -1, 0) relativo a la cápsula
   * Esto previene que animaciones de Mixamo muevan el personaje
   * Para animaciones con root motion habilitado, aplica el delta a la cápsula física
   */
  private fixRootMotion(root: Mesh) {
    // Si la animación actual usa root motion, aplicar el delta a la cápsula
    if (this.rootMotionAnimations.has(this.currentAnimation)) {
      const currentPos = root.position.clone()
      const delta = currentPos.subtract(this.lastRootPosition)
      
      // Solo aplicar movimiento horizontal (X y Z)
      if (delta.length() > 0.001) {
        // Convertir delta local a global usando la rotación del mesh
        const globalDelta = Vector3.TransformCoordinates(
          new Vector3(delta.x, 0, delta.z),
          this.physicsBody.getWorldMatrix()
        )
        const physicsPos = this.physicsBody.position
        this.physicsBody.position = new Vector3(
          globalDelta.x,
          physicsPos.y,
          globalDelta.z
        )
      }
      
      // Resetear el root para el siguiente frame
      root.position.x = 0
      root.position.z = 0
      root.position.y = -1
      this.lastRootPosition = Vector3.Zero()
      return
    }
    
    // Resetear posición local del root (relativo al parent que es la cápsula)
    root.position.x = 0
    root.position.z = 0
    // Mantener Y en -1 para alinear los pies con el suelo
    root.position.y = -1
  }

  /**
   * Cambiar a una nueva animación con blending suave
   */
  play(animationName: string, config: AnimationConfig = { loop: true }) {
    // Si está reproduciendo un one-shot (ataque), encolar la nueva animación
    if (this.isPlayingOneShot) {
      this.queuedAnimation = animationName
      return
    }

    this.playAnimation(animationName, config)
  }

  /**
   * Reproducir una animación one-shot (sin loop) y volver a otra al terminar
   */
  playOneShot(animationName: string, returnTo: string = 'idle', speed: number = 1.0) {
    if (!this.models[animationName]) {
      console.warn(`Animation "${animationName}" not found`)
      return
    }

    this.isPlayingOneShot = true
    this.playAnimation(animationName, {
      loop: false,
      speed,
      onComplete: () => {
        this.isPlayingOneShot = false
        
        // Si hay una animación encolada, reproducirla
        if (this.queuedAnimation) {
          const queued = this.queuedAnimation
          this.queuedAnimation = null
          this.play(queued, { loop: true })
        } else {
          // Sino, volver a la animación especificada
          this.play(returnTo, { loop: true })
        }
      }
    })
  }

  /**
   * Lógica interna para reproducir una animación
   */
  private playAnimation(animationName: string, config: AnimationConfig) {
    // Si ya está reproduciendo esta animación, no hacer nada
    if (animationName === this.currentAnimation && !this.isPlayingOneShot) {
      return
    }

    const newModel = this.models[animationName]
    if (!newModel) {
      console.warn(`Animation model "${animationName}" not found`)
      return
    }

    const oldModel = this.currentAnimation ? this.models[this.currentAnimation] : null
    
    // Verificar si es single mesh (mismo root)
    const isSingleMesh = oldModel && newModel.root === oldModel.root
    
    // Guardar rotación actual para preservarla
    let currentRotation: Quaternion | null = null
    if (newModel.root?.rotationQuaternion) {
      currentRotation = newModel.root.rotationQuaternion.clone()
    }

    // Hacer fade-out de la animación anterior
    if (oldModel && !isSingleMesh) {
      // Solo ocultar root si son meshes diferentes
      this.fadeOutAnimation(oldModel)
    } else if (oldModel) {
      // Mismo mesh: solo detener la animación anterior
      oldModel.animations.forEach(animGroup => {
        if (animGroup.isPlaying) {
          animGroup.stop()
        }
      })
    }

    // Activar nuevo modelo (solo si no es single mesh)
    if (!isSingleMesh) {
      newModel.root.setEnabled(true)
    }
    
    // Restaurar rotación
    if (currentRotation) {
      newModel.root.rotationQuaternion = currentRotation
    } else if (!newModel.root.rotationQuaternion) {
      newModel.root.rotationQuaternion = Quaternion.FromEulerAngles(0, 0, 0)
    }

    // Fix root motion antes de empezar
    this.fixRootMotion(newModel.root)

    // Reproducir animación con configuración
    if (newModel.animations.length > 0) {
      const animGroup = newModel.animations[0]!
      const speed = config.speed || this.defaultSpeed
      
      // Configurar loop
      animGroup.loopAnimation = config.loop

      // Si es one-shot, configurar callback de finalización
      if (!config.loop && config.onComplete) {
        // Remover listeners anteriores
        animGroup.onAnimationGroupEndObservable.clear()
        
        // Agregar nuevo listener
        animGroup.onAnimationGroupEndObservable.addOnce(() => {
          config.onComplete!()
        })
      }

      // Iniciar animación
      // start(loop, speedRatio, from, to, enableBlending)
      animGroup.start(config.loop, speed, animGroup.from, animGroup.to, false)
      
      console.log(`Playing animation: ${animationName} (loop: ${config.loop}, speed: ${speed})${isSingleMesh ? ' [Single Mesh Mode]' : ''}`)
    }

    this.currentAnimation = animationName
  }

  /**
   * Hacer fade-out suave de una animación
   */
  private fadeOutAnimation(model: AnimationModel) {
    if (!model || !model.animations) return

    // Ocultar inmediatamente - el blending ocurre en el AnimationGroup interno
    model.root.setEnabled(false)
    
    // Detener animaciones
    model.animations.forEach(animGroup => {
      if (animGroup.isPlaying) {
        animGroup.stop()
      }
    })
  }

  /**
   * Obtener animación actual
   */
  getCurrentAnimation(): string {
    return this.currentAnimation
  }

  /**
   * Verificar si está reproduciendo una animación one-shot
   */
  isPlayingOneShotAnimation(): boolean {
    return this.isPlayingOneShot
  }

  /**
   * Update loop - llamar cada frame para mantener root motion fix
   */
  update() {
    const currentModel = this.models[this.currentAnimation]
    if (currentModel?.root) {
      this.fixRootMotion(currentModel.root)
    }
  }

  /**
   * Configurar duración del blending
   */
  setBlendDuration(duration: number) {
    this.blendDuration = duration
    
    // Actualizar todos los animation groups
    Object.values(this.models).forEach(model => {
      model.animations.forEach(animGroup => {
        animGroup.blendingSpeed = 1 / duration
      })
    })
  }

  /**
   * Limpiar recursos
   */
  dispose() {
    Object.values(this.models).forEach(model => {
      model.animations.forEach(animGroup => {
        animGroup.stop()
        animGroup.dispose()
      })
    })
  }
}
