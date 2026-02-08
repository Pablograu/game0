import {
  Vector3,
  Quaternion,
  PhysicsRaycastResult,
  ParticleSystem,
  Texture,
  Color4,
} from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock, Control } from '@babylonjs/gui';
import { WeaponSystem } from './WeaponSystem.ts';
import { EffectManager } from './EffectManager.ts';
import { AnimationHandler } from './AnimationHandler.ts';

export class PlayerController {
  blinkInterval: any;
  body: any;
  camera: any;
  cameraShaker: any;
  coyoteTime: number;
  coyoteTimer: number;
  currentHealth: number;
  damageKnockbackForce: number;
  dashCooldown: number;
  dashCooldownTimer: number;
  dashDirection: Vector3;
  dashDuration: number;
  dashParticles: ParticleSystem | null;
  dashSpeed: number;
  dashTimer: number;
  dustParticles: ParticleSystem | null;
  healthText: TextBlock | null;
  healthUI: AdvancedDynamicTexture | null;
  inputMap: Record<string, boolean>;
  invulnerabilityDuration: number;
  invulnerabilityTimer: number;
  isAttacking: boolean = false;
  isAttackingDown: boolean;
  isDashing: boolean;
  isGrounded: boolean;
  isInvulnerable: boolean;
  isMoving: boolean = false;
  jumpBufferTime: number;
  jumpBufferTimer: number;
  jumpCutMultiplier: number;
  jumpForce: number;
  jumpKeyReleased: boolean;
  lastFacingDirection: Vector3;
  maxHealth: number;
  mesh: any;
  moveSpeed: number;
  originalScale: Vector3;
  physicsEngine: any;
  playerHeight: number;
  playerRadius: number;
  pogoForce: number;
  raycastResult: PhysicsRaycastResult;
  recoilDecay: number;
  recoilForce: number;
  recoilVelocity: Vector3;
  rotationSpeed: number;
  scaleSpeed: number;
  scene: any;
  spawnPoint: Vector3;
  targetAngle: number = 0;
  targetRotation: Quaternion;
  targetScale: Vector3;
  wasGrounded: boolean;
  weaponSystem: WeaponSystem | null;
  animationHandler: AnimationHandler | null;

  // ===== SISTEMA DE COMBO =====
  comboStep: number = 0; // 0 = sin combo, 1 = después de punch_L, 2 reservado para expansión
  comboResetTimer: number = 0;
  comboWindowTime: number = 0.8; // Segundos permitidos para continuar el combo
  isAttackAnimationPlaying: boolean = false;
  normalMoveSpeed: number = 8; // Guardar velocidad normal
  attackMoveSpeedMultiplier: number = 0.1; // Reducción de velocidad durante ataque (10%)
  punchHitboxDelay: number = 0.4; // Porcentaje de la animación para activar hitbox (40%)
  animationGroups: Map<string, any> = new Map(); // Mapa de animation groups
  currentPlayingAnimation: string = 'idle'; // Animación actualmente en reproducción
  blendingSpeed: number = 0.1; // Velocidad de blending global (alta = rápida pero suave)

  constructor(mesh: any, camera: any, scene: any, cameraShaker: any = null) {
    this.mesh = mesh;
    this.camera = camera;
    this.scene = scene;
    this.body = mesh.physicsBody;
    this.physicsEngine = scene.getPhysicsEngine();
    this.cameraShaker = cameraShaker;

    // Variables públicas para tunear
    this.moveSpeed = 8;
    this.jumpForce = 12;

    // Configuración del jugador
    this.playerHeight = 2; // Altura de la cápsula
    this.playerRadius = 0.5;

    // Estado interno
    this.inputMap = {};
    this.isGrounded = false;
    this.wasGrounded = false; // Para detectar aterrizaje

    // ===== COYOTE TIME =====
    this.coyoteTime = 0.12; // Segundos de gracia después de caer
    this.coyoteTimer = 0;

    // ===== JUMP BUFFER =====
    this.jumpBufferTime = 0.15; // Segundos que recuerda el input de salto
    this.jumpBufferTimer = 0;

    // ===== VARIABLE JUMP =====
    this.jumpCutMultiplier = 0.5; // Cuánto reduce la velocidad al soltar
    this.jumpKeyReleased = true; // Para detectar cuando suelta la tecla

    // ===== DASH =====
    this.dashSpeed = 25;
    this.dashDuration = 0.18; // Segundos que dura el dash
    this.dashCooldown = 0.6; // Cooldown entre dashes
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.isDashing = false;
    this.dashDirection = Vector3.Zero();
    this.lastFacingDirection = new Vector3(0, 0, 1); // Dirección por defecto

    // ===== ROTACIÓN VISUAL =====
    this.rotationSpeed = 12; // Velocidad del Slerp
    this.targetRotation = Quaternion.Identity();

    // ===== SQUASH & STRETCH =====
    this.originalScale = new Vector3(1, 1, 1);
    this.targetScale = new Vector3(1, 1, 1);
    this.scaleSpeed = 10; // Velocidad de interpolación

    // ===== PARTÍCULAS =====
    this.dustParticles = null;
    this.dashParticles = null;

    // ===== RAYCAST =====
    this.raycastResult = new PhysicsRaycastResult();

    // ===== RECOIL (RETROCESO) =====
    this.recoilForce = 8; // Fuerza de retroceso horizontal al golpear
    this.pogoForce = 14; // Fuerza del rebote hacia arriba (pogo)
    this.isAttackingDown = false; // Flag para detectar ataque hacia abajo
    this.recoilVelocity = Vector3.Zero(); // Velocidad de recoil actual
    this.recoilDecay = 10; // Qué tan rápido decae el recoil

    // ===== SISTEMA DE SALUD =====
    this.maxHealth = 3;
    this.currentHealth = this.maxHealth;
    this.isInvulnerable = false;
    this.invulnerabilityDuration = 1.5; // Segundos de invulnerabilidad tras daño
    this.invulnerabilityTimer = 0;
    this.blinkInterval = null;
    this.damageKnockbackForce = 6; // Fuerza de knockback al recibir daño

    // ===== SPAWN POINT =====
    this.spawnPoint = mesh.position.clone(); // Guardar posición inicial

    // ===== UI =====
    this.healthUI = null;
    this.healthText = null;

    // ===== WEAPON SYSTEM =====
    this.weaponSystem = null;

    // ===== ANIMATION HANDLER =====
    this.animationHandler = null;

    // ===== INICIALIZAR COMBO =====
    this.comboStep = 0;
    this.comboResetTimer = 0;
    this.isAttackAnimationPlaying = false;
    this.normalMoveSpeed = this.moveSpeed;

    this.setupInput();
    this.setupPhysics();
    this.setupParticles();
    this.setupWeaponSystem();
    this.setupHealthUI();
    this.setupAnimationHandler(); // Intentar inicializar (funcionará si los modelos ya están)
    this.setupUpdate();
  }

  setupHealthUI() {
    // Crear textura de UI en pantalla completa
    this.healthUI = AdvancedDynamicTexture.CreateFullscreenUI(
      'healthUI',
      true,
      this.scene,
    );

    // Crear texto de vidas
    this.healthText = new TextBlock('healthText');
    this.healthText.text = `Vidas: ${this.currentHealth}`;
    this.healthText.color = 'white';
    this.healthText.fontSize = 32;
    this.healthText.fontFamily = 'Arial';
    this.healthText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.healthText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.healthText.left = '20px';
    this.healthText.top = '20px';
    this.healthText.outlineWidth = 2;
    this.healthText.outlineColor = 'black';

    this.healthUI.addControl(this.healthText);

    console.log('Health UI inicializada');
  }

  updateHealthUI() {
    if (this.healthText) {
      this.healthText.text = `Vidas: ${this.currentHealth}`;

      // Cambiar color según salud
      if (this.currentHealth <= 1) {
        this.healthText.color = 'red';
      } else if (this.currentHealth <= 2) {
        this.healthText.color = 'orange';
      } else {
        this.healthText.color = 'white';
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
      cameraShaker: this.cameraShaker, // Pasar referencia al shake
    });

    console.log('WeaponSystem inicializado');
  }

  // ===== SISTEMA DE COMBO DE 2 GOLPES =====

  /**
   * ===== REPRODUCCIÓN SUAVE DE ANIMACIONES =====
   * Maneja el blending correctamente deteniendo animaciones previas
   * @param name - Nombre de la animación
   * @param loop - Si debe hacer loop
   * @param forceReset - Forzar reinicio desde frame 0
   */
  playSmoothAnimation(
    name: string,
    loop: boolean = true,
    forceReset: boolean = false,
  ) {
    const animGroup = this.animationGroups.get(name);

    if (!animGroup) {
      console.warn(`Animación '${name}' no encontrada en animationGroups`);
      return;
    }

    // Si ya está reproduciendo esta animación y es loop, no hacer nada
    if (
      this.currentPlayingAnimation === name &&
      loop &&
      animGroup.isPlaying &&
      !forceReset
    ) {
      // console.log(`Ya reproduciendo ${name}, skip`);
      return;
    }

    console.log(
      `🎬 Reproduciendo: ${name} (loop: ${loop}, forceReset: ${forceReset})`,
    );

    // ===== DETENER OTRAS ANIMACIONES CON BLENDING =====
    // El blending funciona DURANTE la transición, pero debemos detener las anteriores
    this.animationGroups.forEach((otherAnimGroup, otherName) => {
      if (otherName !== name && otherAnimGroup.isPlaying) {
        // Detener con blending (el último parámetro true activa el fade out)
        otherAnimGroup.stop();
      }
    });

    // Configurar loop
    animGroup.loopAnimation = loop;

    // Iniciar la nueva animación con blending
    // El enableBlending = true hace que el fade-in sea suave
    animGroup.start(loop, 1.0, animGroup.from, animGroup.to, true);

    // Actualizar estado
    this.currentPlayingAnimation = name;

    // Actualizar AnimationHandler también
    if (this.animationHandler) {
      (this.animationHandler as any).currentAnimation = name;
    }
  }

  /**
   * Actualiza el timer del combo - resetea si pasa demasiado tiempo
   */
  updateComboTimer(deltaTime: number) {
    if (this.comboStep > 0 && !this.isAttackAnimationPlaying) {
      this.comboResetTimer -= deltaTime;
      if (this.comboResetTimer <= 0) {
        this.resetCombo();
      }
    }
  }

  /**
   * Resetea el combo a estado inicial
   */
  resetCombo() {
    this.comboStep = 0;
    this.comboResetTimer = 0;
    console.log('Combo reseteado');
  }

  /**
   * Intenta ejecutar un ataque del combo con blending suave
   */
  tryComboAttack() {
    // No atacar si ya hay una animación de ataque en progreso
    if (this.isAttackAnimationPlaying) {
      console.log('⚔️ Ataque bloqueado - animación en progreso');
      return;
    }

    // Verificar que las animaciones estén configuradas
    if (this.animationGroups.size === 0) {
      console.warn('AnimationGroups no configurados');
      return;
    }

    if (this.comboStep === 0) {
      // ===== PRIMER GOLPE: punch_l =====
      console.log('💥 Combo Step 0 -> Ejecutando punch_l');
      this.executePunch('punch_l', 1);
    } else if (this.comboStep === 1 && this.comboResetTimer > 0) {
      // ===== SEGUNDO GOLPE: punch_r (dentro de la ventana de tiempo) =====
      console.log('💥💥 Combo Step 1 -> Ejecutando punch_r (COMBO!)');
      this.executePunch('punch_r', 0); // Resetea a 0 después del segundo golpe
    } else {
      // Ventana expirada, empezar nuevo combo
      console.log('⏰ Ventana expirada, reiniciando combo');
      this.resetCombo();
      this.executePunch('punch_l', 1);
    }
  }

  /**
   * ===== EJECUTAR PUÑETAZO CON BLENDING =====
   * Usa playSmoothAnimation para transición fluida
   * @param animationName - Nombre de la animación ('punch_l' o 'punch_r')
   * @param nextComboStep - Siguiente paso del combo después de este golpe
   */
  executePunch(animationName: string, nextComboStep: number) {
    console.log(`👊 Ejecutando: ${animationName}`);

    // Marcar que estamos atacando (reduce velocidad de movimiento)
    this.isAttackAnimationPlaying = true;
    this.isAttacking = true;

    // Obtener el animation group
    const animGroup = this.animationGroups.get(animationName);

    if (!animGroup) {
      console.warn(`❌ Animación '${animationName}' no encontrada`);
      this.isAttackAnimationPlaying = false;
      this.isAttacking = false;
      return;
    }

    // ===== REPRODUCIR CON BLENDING SUAVE =====
    // forceReset = true para que el golpe empiece desde el frame 0
    this.playSmoothAnimation(animationName, false, true);

    // Calcular duración de la animación para sincronizar el daño
    const frameRate =
      animGroup.targetedAnimations[0]?.animation.framePerSecond || 30;
    const animationDuration = (animGroup.to - animGroup.from) / frameRate;

    // Programar activación de hitbox al 40% de la animación
    const hitboxActivationTime =
      animationDuration * this.punchHitboxDelay * 1000; // ms

    setTimeout(() => {
      if (this.isAttackAnimationPlaying && this.weaponSystem) {
        this.activateHitbox();
      }
    }, hitboxActivationTime);

    // ===== CALLBACK DE FINALIZACIÓN =====
    // Limpiar listeners previos para evitar duplicados
    animGroup.onAnimationGroupEndObservable.clear();

    // Configurar callback para cuando termine la animación
    animGroup.onAnimationGroupEndObservable.addOnce(() => {
      this.onPunchAnimationEnd(nextComboStep);
    });

    // Actualizar AnimationHandler state
    if (this.animationHandler) {
      (this.animationHandler as any).isPlayingOneShot = true;
    }

    console.log(
      `✓ ${animationName} iniciada - Duración: ${animationDuration.toFixed(2)}s, Hitbox: ${hitboxActivationTime.toFixed(0)}ms`,
    );
  }

  /**
   * Activa la hitbox para detectar impactos
   */
  activateHitbox() {
    if (!this.weaponSystem) return;

    console.log('¡Hitbox activada!');

    // Activar el sistema de detección de golpes del WeaponSystem
    this.weaponSystem.isAttacking = true;
    this.weaponSystem.attackTimer = this.weaponSystem.attackDuration;
    this.weaponSystem.hitEnemiesThisSwing.clear();
    this.weaponSystem.hitObjectsThisSwing.clear();

    // Activar hitbox visual
    if (this.weaponSystem.hitbox) {
      this.weaponSystem.hitbox.setEnabled(true);
      if (this.weaponSystem.debugMode) {
        this.weaponSystem.hitbox.material.alpha = 0.5;
      }
    }
  }

  /**
   * Callback cuando termina la animación de puñetazo
   * @param nextComboStep - El siguiente paso del combo
   */
  onPunchAnimationEnd(nextComboStep: number) {
    console.log('Animación de puñetazo terminada');

    // Desactivar hitbox
    if (this.weaponSystem) {
      this.weaponSystem.isAttacking = false;
      if (this.weaponSystem.hitbox) {
        this.weaponSystem.hitbox.setEnabled(false);
      }
    }

    // Restaurar estado
    this.isAttackAnimationPlaying = false;
    this.isAttacking = false;

    // Actualizar combo step
    this.comboStep = nextComboStep;

    // Iniciar timer de ventana de combo (solo si hay siguiente paso)
    if (nextComboStep > 0) {
      this.comboResetTimer = this.comboWindowTime;
      console.log(
        `Combo step: ${this.comboStep} - Ventana de ${this.comboWindowTime}s`,
      );
    } else {
      this.resetCombo();
    }

    // Actualizar AnimationHandler
    if (this.animationHandler) {
      (this.animationHandler as any).isPlayingOneShot = false;
    }

    // Volver a animación de idle/run basada en el estado actual
    this.returnToIdleOrRun();
  }

  /**
   * ===== VOLVER A IDLE/RUN CON BLENDING =====
   * Después de un ataque, transición suave según el estado de movimiento
   */
  returnToIdleOrRun() {
    if (this.animationGroups.size === 0) return;

    const moveDirection = this.getMoveDirection();
    const targetAnim = moveDirection.length() > 0.1 ? 'run' : 'idle';

    console.log(`🔄 Volviendo a: ${targetAnim}`);

    // Usar playSmoothAnimation para transición fluida
    this.playSmoothAnimation(targetAnim, true, false);
  }

  setupAnimationHandler() {
    // Solo inicializar si los modelos ya están cargados
    if (this.mesh.animationModels) {
      this.animationHandler = new AnimationHandler(
        this.mesh.animationModels,
        this.mesh,
        'idle',
      );

      // Configurar blending en todos los animation groups
      this.setupAnimations();

      console.log('AnimationHandler inicializado con éxito');
    } else {
      console.warn(
        'setupAnimationHandler: No hay animationModels disponibles aún',
      );
    }
  }

  /**
   * ===== CONFIGURACIÓN GLOBAL DE BLENDING =====
   * Configura todos los animation groups para transiciones suaves
   */
  setupAnimations() {
    if (!this.mesh.animationModels) {
      console.warn('No hay animationModels disponibles para configurar');
      return;
    }

    console.log('🎬 Configurando blending en todas las animaciones...');

    // Iterar sobre todos los modelos de animación
    Object.keys(this.mesh.animationModels).forEach((animName) => {
      const animModel = this.mesh.animationModels[animName];

      if (animModel?.animations && animModel.animations.length > 0) {
        const animGroup = animModel.animations[0];

        // ===== CONFIGURACIÓN CRÍTICA DE BLENDING =====
        animGroup.enableBlending = true;
        animGroup.blendingSpeed = this.blendingSpeed;

        // Normalizar el grupo para sincronización
        animGroup.normalize(0, animGroup.to);

        // Guardar referencia para acceso rápido
        this.animationGroups.set(animName, animGroup);

        console.log(
          `  ✓ ${animName}: blending=${animGroup.enableBlending}, speed=${animGroup.blendingSpeed}`,
        );
      }
    });

    console.log(
      `🎬 Blending configurado en ${this.animationGroups.size} animaciones`,
    );
  }

  setupInput() {
    // Capturar input del teclado
    this.scene.onKeyboardObservable.add((kbInfo: any) => {
      const key = kbInfo.event.key.toLowerCase();

      if (kbInfo.type === 1) {
        // KEYDOWN
        this.inputMap[key] = true;

        // Jump Buffer: al presionar salto, iniciar el timer
        if (key === ' ') {
          this.jumpBufferTimer = this.jumpBufferTime;
          this.jumpKeyReleased = false;
        }

        // Dash input (Shift)
        if (key === 'shift' && this.dashCooldownTimer <= 0 && !this.isDashing) {
          this.startDash();
        }

        // Ataque con tecla K
        if (key === 'k') {
          this.tryComboAttack();
        }
      } else if (kbInfo.type === 2) {
        // KEYUP
        this.inputMap[key] = false;

        // Variable Jump: detectar cuando suelta la tecla
        if (key === ' ') {
          this.jumpKeyReleased = true;
        }
      }
    });

    // Click izquierdo para atacar
    this.scene.onPointerObservable.add((pointerInfo: any) => {
      // Tipo 1 = POINTERDOWN
      if (pointerInfo.type === 1 && pointerInfo.event.button === 0) {
        this.tryComboAttack();
      }
    });
  }

  setupPhysics() {
    if (!this.body) {
      console.error('El mesh del jugador necesita un PhysicsBody');
      return;
    }

    // Bloquear rotación angular para evitar volcarse
    this.body.setAngularVelocity(new Vector3(0, 0, 0));
    this.body.disablePreStep = false;

    // Configurar propiedades físicas
    this.body.setMassProperties({
      mass: 1,
      inertia: new Vector3(0, 0, 0), // Evitar rotación
    });
  }

  setupParticles() {
    // ===== PARTÍCULAS DE POLVO (salto/aterrizaje) =====
    this.dustParticles = new ParticleSystem('dustParticles', 50, this.scene);

    // Crear textura procedural para las partículas (cuadradito)
    const dustTexture = this.createParticleTexture();
    this.dustParticles.particleTexture = dustTexture;

    // Emisor en la posición del jugador
    this.dustParticles.emitter = this.mesh;
    this.dustParticles.minEmitBox = new Vector3(-0.3, -1, -0.3);
    this.dustParticles.maxEmitBox = new Vector3(0.3, -0.9, 0.3);

    // Colores (gris/marrón)
    this.dustParticles.color1 = new Color4(0.6, 0.5, 0.4, 0.8);
    this.dustParticles.color2 = new Color4(0.4, 0.35, 0.3, 0.6);
    this.dustParticles.colorDead = new Color4(0.3, 0.25, 0.2, 0);

    // Tamaño
    this.dustParticles.minSize = 0.05;
    this.dustParticles.maxSize = 0.15;

    // Vida
    this.dustParticles.minLifeTime = 0.2;
    this.dustParticles.maxLifeTime = 0.4;

    // Velocidad
    this.dustParticles.direction1 = new Vector3(-1, 0.5, -1);
    this.dustParticles.direction2 = new Vector3(1, 1, 1);
    this.dustParticles.minEmitPower = 1;
    this.dustParticles.maxEmitPower = 2;

    // Gravedad de partículas
    this.dustParticles.gravity = new Vector3(0, -5, 0);

    // Rate
    this.dustParticles.emitRate = 0; // Empezamos sin emitir
    this.dustParticles.manualEmitCount = 0;
    this.dustParticles.start();

    // ===== PARTÍCULAS DE DASH =====
    this.dashParticles = new ParticleSystem('dashParticles', 100, this.scene);
    this.dashParticles.particleTexture = dustTexture;
    this.dashParticles.emitter = this.mesh;
    this.dashParticles.minEmitBox = new Vector3(-0.2, -0.5, -0.2);
    this.dashParticles.maxEmitBox = new Vector3(0.2, 0.5, 0.2);

    // Color cyan/azul para el dash
    this.dashParticles.color1 = new Color4(0.3, 0.8, 1, 0.9);
    this.dashParticles.color2 = new Color4(0.5, 0.9, 1, 0.7);
    this.dashParticles.colorDead = new Color4(0.2, 0.5, 0.8, 0);

    this.dashParticles.minSize = 0.08;
    this.dashParticles.maxSize = 0.2;
    this.dashParticles.minLifeTime = 0.15;
    this.dashParticles.maxLifeTime = 0.3;

    this.dashParticles.direction1 = new Vector3(-0.5, -0.5, -0.5);
    this.dashParticles.direction2 = new Vector3(0.5, 0.5, 0.5);
    this.dashParticles.minEmitPower = 0.5;
    this.dashParticles.maxEmitPower = 1.5;

    this.dashParticles.emitRate = 0;
    this.dashParticles.start();
  }

  createParticleTexture() {
    // Crear una textura procedural simple (cuadrado blanco)
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new Texture('', this.scene);

    // Dibujar un cuadrado con bordes suaves
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.roundRect(4, 4, size - 8, size - 8, 4);
    ctx.fill();

    const texture = new Texture(canvas.toDataURL(), this.scene);
    return texture;
  }

  setupUpdate() {
    // Update loop - se ejecuta antes de cada frame
    this.scene.onBeforeRenderObservable.add(() => {
      this.update();
    });
  }

  update() {
    if (!this.body) return;
    const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

    // ===== COMBO TIMER UPDATE =====
    this.updateComboTimer(deltaTime);

    // ===== INVULNERABILIDAD UPDATE ====
    this.updateInvulnerability(deltaTime);

    // Guardar estado anterior de grounded
    this.wasGrounded = this.isGrounded;

    // ===== GROUND CHECK CON RAYCAST =====
    this.checkGrounded();

    // ===== COYOTE TIME UPDATE =====
    this.updateCoyoteTime(deltaTime);

    // ===== JUMP BUFFER UPDATE =====
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= deltaTime;
    }

    // ===== DASH COOLDOWN UPDATE =====
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= deltaTime;
    }

    // ===== DASH UPDATE =====
    if (this.isDashing) {
      this.updateDash(deltaTime);
      return; // Durante el dash, no procesar movimiento normal
    }

    // Obtener velocidad actual
    const currentVelocity = this.body.getLinearVelocity();

    // Calcular dirección de movimiento relativa a la cámara
    const moveDirection = this.getMoveDirection();

    // Guardar última dirección para el dash
    if (moveDirection.length() > 0.1) {
      this.lastFacingDirection = moveDirection.clone();
    }

    // Decaer el recoil con el tiempo
    if (this.recoilVelocity.length() > 0.1) {
      this.recoilVelocity = this.recoilVelocity.scale(
        1 - this.recoilDecay * deltaTime,
      );
    } else {
      this.recoilVelocity = Vector3.Zero();
    }

    // ===== REDUCIR VELOCIDAD DURANTE ATAQUE (ROOTING) =====
    const effectiveMoveSpeed = this.isAttackAnimationPlaying
      ? this.moveSpeed * this.attackMoveSpeedMultiplier
      : this.moveSpeed;

    // Crear nueva velocidad (mantener Y para respetar gravedad) + RECOIL
    const newVelocity = new Vector3(
      moveDirection.x * effectiveMoveSpeed + this.recoilVelocity.x,
      currentVelocity.y, // Mantener velocidad vertical (gravedad)
      moveDirection.z * effectiveMoveSpeed + this.recoilVelocity.z,
    );

    // Aplicar velocidad directamente (movimiento snappy)
    this.body.setLinearVelocity(newVelocity);

    // Forzar rotación angular a cero (evitar volcarse)
    this.body.setAngularVelocity(new Vector3(0, 0, 0));

    // ===== ROTACIÓN VISUAL =====
    this.updateRotation(moveDirection, deltaTime);

    // ===== SALTO (con Coyote Time y Jump Buffer) =====
    this.handleJump(currentVelocity);

    // ===== VARIABLE JUMP (cortar salto al soltar) =====
    this.handleVariableJump();

    // ===== SQUASH & STRETCH =====
    this.updateSquashStretch(deltaTime);

    // ===== DETECTAR ATERRIZAJE =====
    if (this.isGrounded && !this.wasGrounded) {
      this.onLand();
    }

    // ===== ACTUALIZAR ANIMACIONES =====
    this.updateAnimation(moveDirection, currentVelocity);
  }

  // ===== SISTEMA DE ANIMACIONES CON BLENDING =====
  updateAnimation(moveDirection: any, velocity: any) {
    // Inicializar AnimationHandler si aún no existe y hay modelos
    if (!this.animationHandler && this.mesh.animationModels) {
      this.setupAnimationHandler();
    }

    // Si no hay animation groups configurados, salir
    if (this.animationGroups.size === 0) return;

    // ===== NO INTERRUMPIR ANIMACIONES DE ATAQUE =====
    if (this.isAttackAnimationPlaying) {
      // Durante el ataque, NO cambiar de animación
      // El sistema de combo manejará la transición cuando termine
      return;
    }

    let targetAnimation = 'idle';
    let animSpeed = 1.0;

    // Determinar animación según estado
    if (!this.isGrounded && velocity.y > 0.5) {
      // Saltando (subiendo)
      targetAnimation = 'jump';
      animSpeed = Math.max(0.3, (velocity.y / this.jumpForce) * 0.8);
    } else if (!this.isGrounded && velocity.y < -0.5) {
      // Cayendo
      targetAnimation = 'jump';
      animSpeed = 0.2;
    } else if (!this.isGrounded) {
      // En el aire cerca del pico del salto
      targetAnimation = 'jump';
      animSpeed = 0.15;
    } else if (this.isGrounded && moveDirection.length() > 0.1) {
      // Corriendo
      targetAnimation = 'run';
      animSpeed = 1.0;
    } else {
      // Idle
      targetAnimation = 'idle';
      animSpeed = 1.0;
    }

    // ===== CAMBIAR ANIMACIÓN CON BLENDING SUAVE =====
    if (this.currentPlayingAnimation !== targetAnimation) {
      this.playSmoothAnimation(targetAnimation, true, false);
    }

    // Actualizar velocidad de la animación si es necesario
    const currentAnimGroup = this.animationGroups.get(targetAnimation);
    if (currentAnimGroup && currentAnimGroup.isPlaying) {
      currentAnimGroup.speedRatio = animSpeed;
    }

    // Update del handler (fix root motion cada frame)
    if (this.animationHandler) {
      this.animationHandler.update();
    }
  }

  // Método legacy para compatibilidad
  switchAnimation(newAnimation: string) {
    this.playSmoothAnimation(newAnimation, true, false);
  }

  // ===== GROUND CHECK CON RAYCAST =====
  checkGrounded() {
    const playerPos = this.mesh.position.clone();

    // Punto de inicio del rayo (centro del jugador)
    const rayStart = new Vector3(playerPos.x, playerPos.y, playerPos.z);

    // Punto final del rayo (hacia abajo)
    // Longitud = mitad de altura + un poco de margen
    const rayLength = this.playerHeight / 2 + 0.15;
    const rayEnd = new Vector3(
      playerPos.x,
      playerPos.y - rayLength,
      playerPos.z,
    );

    // Realizar el raycast usando el motor de física
    this.physicsEngine.raycastToRef(rayStart, rayEnd, this.raycastResult);

    // Si el rayo golpea algo Y no es el propio jugador
    if (this.raycastResult.hasHit) {
      const hitBody = this.raycastResult.body;

      // Filtrar para que no detecte al propio jugador
      if (hitBody && hitBody !== this.body) {
        this.isGrounded = true;
        return;
      }
    }

    this.isGrounded = false;
  }

  // ===== COYOTE TIME =====
  updateCoyoteTime(deltaTime: number) {
    if (this.isGrounded) {
      // Resetear el timer cuando está en el suelo
      this.coyoteTimer = this.coyoteTime;
    } else {
      // Decrementar el timer cuando está en el aire
      if (this.coyoteTimer > 0) {
        this.coyoteTimer -= deltaTime;
      }
    }
  }

  // ===== PUEDE SALTAR (considera Coyote Time) =====
  canJump() {
    // Puede saltar si está en el suelo O si el coyote timer > 0
    return this.isGrounded || this.coyoteTimer > 0;
  }

  getMoveDirection() {
    // Obtener vectores forward y right de la cámara
    const forward = this.camera.getDirection(Vector3.Forward());
    const right = this.camera.getDirection(Vector3.Right());

    // Proyectar al plano horizontal (ignorar componente Y)
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    // Calcular dirección basada en input
    let direction = Vector3.Zero();

    if (this.inputMap['w']) {
      direction.addInPlace(forward);
    }
    if (this.inputMap['s']) {
      direction.addInPlace(forward.scale(-1));
    }
    if (this.inputMap['d']) {
      direction.addInPlace(right);
    }
    if (this.inputMap['a']) {
      direction.addInPlace(right.scale(-1));
    }

    // Normalizar para movimiento diagonal consistente
    if (direction.length() > 0) {
      direction.normalize();
    }

    return direction;
  }

  handleJump(currentVelocity: any) {
    // Usar Jump Buffer: saltar si hay buffer Y puede saltar
    const shouldJump = this.jumpBufferTimer > 0 && this.canJump();

    if (shouldJump) {
      // Aplicar impulso vertical instantáneo
      const jumpVelocity = new Vector3(
        currentVelocity.x,
        this.jumpForce,
        currentVelocity.z,
      );
      this.body.setLinearVelocity(jumpVelocity);

      // Consumir el buffer y el coyote time
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;

      // Feedback visual: estirar al saltar
      this.applyJumpStretch();

      // Partículas de polvo al saltar con EffectManager
      const dustPos = this.mesh.getAbsolutePosition().clone();
      dustPos.y -= this.playerHeight / 2;
      EffectManager.showDust(dustPos, {
        count: 12,
        duration: 0.35,
        direction: 'up',
      });

      // Partículas locales también
      this.emitDust(15);
    }
  }

  // ===== VARIABLE JUMP (cortar altura al soltar) =====
  handleVariableJump() {
    const currentVelocity = this.body.getLinearVelocity();

    // Si el jugador soltó la tecla mientras sube
    if (this.jumpKeyReleased && currentVelocity.y > 0 && !this.isGrounded) {
      // Cortar la velocidad vertical
      const cutVelocity = new Vector3(
        currentVelocity.x,
        currentVelocity.y * this.jumpCutMultiplier,
        currentVelocity.z,
      );
      this.body.setLinearVelocity(cutVelocity);

      // Solo cortar una vez por salto
      this.jumpKeyReleased = false;
    }
  }

  // ===== ROTACIÓN VISUAL SUAVE =====
  updateRotation(moveDirection: any, deltaTime: number) {
    // Solo rotar cuando hay movimiento activo
    if (moveDirection.length() <= 0.1) return;

    // Calcular el ángulo hacia la dirección de movimiento
    const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);
    this.targetRotation = Quaternion.FromEulerAngles(0, targetAngle, 0);

    // Obtener el modelo actual desde AnimationHandler
    let currentModel = null;
    if (this.animationHandler) {
      const currentAnimName = this.animationHandler.getCurrentAnimation();
      currentModel = this.mesh.animationModels?.[currentAnimName];
    } else if (this.mesh.animationModels && this.mesh.currentAnimation) {
      // Fallback legacy
      currentModel = this.mesh.animationModels[this.mesh.currentAnimation];
    }

    if (currentModel?.root) {
      // Asegurarse de que el modelo usa quaternion
      if (!currentModel.root.rotationQuaternion) {
        currentModel.root.rotationQuaternion = Quaternion.FromEulerAngles(
          0,
          0,
          0,
        );
      }

      // Slerp hacia la rotación objetivo (sin offset)
      const currentRotation = currentModel.root.rotationQuaternion;
      const slerpFactor = Math.min(1, this.rotationSpeed * deltaTime);

      currentModel.root.rotationQuaternion = Quaternion.Slerp(
        currentRotation,
        this.targetRotation,
        slerpFactor,
      );
    } else {
      // Fallback: rotar la cápsula si no hay modelos cargados
      if (!this.mesh.rotationQuaternion) {
        this.mesh.rotationQuaternion = Quaternion.Identity();
      }

      const currentRotation = this.mesh.rotationQuaternion;
      const slerpFactor = Math.min(1, this.rotationSpeed * deltaTime);
      this.mesh.rotationQuaternion = Quaternion.Slerp(
        currentRotation,
        this.targetRotation,
        slerpFactor,
      );
    }
  }

  // ===== DASH =====
  startDash() {
    this.isDashing = true;
    this.dashTimer = this.dashDuration;
    this.dashCooldownTimer = this.dashCooldown;

    // Dirección del dash: hacia donde mira o la última dirección de movimiento
    const moveDir = this.getMoveDirection();
    if (moveDir.length() > 0.1) {
      this.dashDirection = moveDir.normalize();
    } else {
      this.dashDirection = this.lastFacingDirection.clone().normalize();
    }

    // Feedback: estirar horizontalmente
    this.targetScale = new Vector3(0.7, 1.3, 0.7);

    // Activar partículas de dash
    if (this.dashParticles) this.dashParticles.emitRate = 150;

    console.log('Dash iniciado!');
  }

  updateDash(deltaTime: number) {
    // Aplicar velocidad de dash (sin gravedad)
    const dashVelocity = new Vector3(
      this.dashDirection.x * this.dashSpeed,
      0, // Sin gravedad durante el dash
      this.dashDirection.z * this.dashSpeed,
    );
    this.body.setLinearVelocity(dashVelocity);

    // Decrementar timer
    this.dashTimer -= deltaTime;

    // Finalizar dash
    if (this.dashTimer <= 0) {
      this.endDash();
    }
  }

  endDash() {
    this.isDashing = false;

    // Frenar en seco
    const currentVel = this.body.getLinearVelocity();
    this.body.setLinearVelocity(new Vector3(0, currentVel.y, 0));

    // Feedback: volver a escala normal
    this.targetScale = this.originalScale.clone();

    // Desactivar partículas de dash
    if (this.dashParticles) this.dashParticles.emitRate = 0;

    console.log('Dash terminado!');
  }

  // ===== SQUASH & STRETCH =====
  applyJumpStretch() {
    // Estirar verticalmente al saltar
    this.targetScale = new Vector3(0.8, 1.2, 0.8);

    // Volver a normal después de un momento
    setTimeout(() => {
      this.targetScale = this.originalScale.clone();
    }, 100);
  }

  applyLandSquash() {
    // Aplastar al aterrizar
    this.targetScale = new Vector3(1.2, 0.8, 1.2);

    // Volver a normal
    setTimeout(() => {
      this.targetScale = this.originalScale.clone();
    }, 100);
  }

  updateSquashStretch(deltaTime: number) {
    // Interpolar suavemente hacia la escala objetivo
    const lerpFactor = Math.min(1, this.scaleSpeed * deltaTime);

    this.mesh.scaling.x +=
      (this.targetScale.x - this.mesh.scaling.x) * lerpFactor;
    this.mesh.scaling.y +=
      (this.targetScale.y - this.mesh.scaling.y) * lerpFactor;
    this.mesh.scaling.z +=
      (this.targetScale.z - this.mesh.scaling.z) * lerpFactor;
  }

  // ===== EVENTOS =====
  onLand() {
    // Feedback visual al aterrizar
    this.applyLandSquash();

    // Partículas de polvo con EffectManager
    const dustPos = this.mesh.getAbsolutePosition().clone();
    dustPos.y -= this.playerHeight / 2; // A los pies
    EffectManager.showDust(dustPos, {
      count: 20,
      duration: 0.5,
      direction: 'radial',
    });

    // También emitir las partículas locales
    this.emitDust(20);

    // Camera shake suave
    if (this.cameraShaker) {
      this.cameraShaker.shakeSoft();
    }

    console.log('Aterrizaje!');
  }

  emitDust(amount: number) {
    // Emitir una ráfaga de partículas
    if (this.dustParticles) this.dustParticles.manualEmitCount = amount;
  }

  // ===== MÉTODOS PÚBLICOS =====
  setMoveSpeed(speed: number) {
    this.moveSpeed = speed;
  }

  setJumpForce(force: number) {
    this.jumpForce = force;
  }

  setDashSpeed(speed: number) {
    this.dashSpeed = speed;
  }

  setCoyoteTime(time: number) {
    this.coyoteTime = time;
  }

  setJumpBufferTime(time: number) {
    this.jumpBufferTime = time;
  }

  setRecoilForce(force: number) {
    console.log('Recoil force set to:', force);
    this.recoilForce = force;
  }

  setPogoForce(force: number) {
    this.pogoForce = force;
  }

  // ===== COMBAT SYSTEM =====

  /**
   * Aplica recoil (retroceso) al jugador cuando golpea a un enemigo
   * @param {Vector3} hitDirection - Dirección hacia el enemigo
   * @param {Vector3} enemyPosition - Posición del enemigo golpeado
   */
  applyRecoil(hitDirection: any, enemyPosition: any) {
    if (!this.body) return;

    const currentVelocity = this.body.getLinearVelocity();
    const playerPos = this.mesh.getAbsolutePosition();

    // Detectar si es un ataque hacia abajo (pogo)
    // El enemigo está debajo del jugador Y el jugador está en el aire
    const isPogoHit = !this.isGrounded && enemyPosition.y < playerPos.y - 0.5;

    if (isPogoHit) {
      // ===== POGO: Rebote hacia arriba =====
      console.log('¡POGO!');

      // Aplicar fuerza hacia arriba, cancelando velocidad negativa
      const pogoVelocity = new Vector3(
        currentVelocity.x * 0.5, // Reducir velocidad horizontal ligeramente
        this.pogoForce, // Fuerza de pogo hacia arriba
        currentVelocity.z * 0.5,
      );

      this.body.setLinearVelocity(pogoVelocity);

      // Feedback visual: pequeño squash
      this.targetScale = new Vector3(0.9, 1.15, 0.9);
      setTimeout(() => {
        this.targetScale = this.originalScale.clone();
      }, 80);
    } else {
      // ===== RECOIL HORIZONTAL: Retroceso normal =====
      console.log('Recoil! force:', this.recoilForce);

      // Dirección opuesta al golpe (alejarse del enemigo)
      const recoilDirection = hitDirection.scale(-1);
      recoilDirection.y = 0; // Mantener horizontal
      recoilDirection.normalize();

      // Aplicar recoil como velocidad adicional que decae
      this.recoilVelocity = new Vector3(
        recoilDirection.x * this.recoilForce,
        0,
        recoilDirection.z * this.recoilForce,
      );
    }
  }

  /**
   * Registra un enemigo para que el WeaponSystem lo detecte
   * @param {EnemyDummy} enemy
   */
  registerEnemy(enemy: any) {
    if (this.weaponSystem) {
      this.weaponSystem.registerEnemy(enemy);
    }
  }

  /**
   * Registra múltiples enemigos
   * @param {EnemyDummy[]} enemies
   */
  registerEnemies(enemies: any[]) {
    enemies.forEach((e: any) => this.registerEnemy(e));
  }

  getWeaponSystem() {
    return this.weaponSystem;
  }

  // ===== SISTEMA DE DAÑO =====

  /**
   * El jugador recibe daño
   * @param {number} amount - Cantidad de daño
   * @param {Vector3} damageSourcePosition - Posición de la fuente de daño (para knockback)
   */
  takeDamage(amount: number, damageSourcePosition: any = null) {
    // Ignorar si es invulnerable o está muerto
    if (this.isInvulnerable || this.currentHealth <= 0) {
      console.log('Damage ignored (invulnerable or dead)');
      return;
    }

    // Restar salud
    this.currentHealth -= amount;
    console.log(`Player hit! Health: ${this.currentHealth}/${this.maxHealth}`);

    // Actualizar UI
    this.updateHealthUI();

    // Verificar muerte
    if (this.currentHealth <= 0) {
      this.die();
      return;
    }

    // ===== KNOCKBACK =====
    if (damageSourcePosition && this.body) {
      const playerPos = this.mesh.getAbsolutePosition();
      const knockbackDir = playerPos.subtract(damageSourcePosition).normalize();
      knockbackDir.y = 0.3; // Pequeño impulso hacia arriba

      this.recoilVelocity = new Vector3(
        knockbackDir.x * this.damageKnockbackForce,
        0,
        knockbackDir.z * this.damageKnockbackForce,
      );

      // También aplicar impulso vertical
      const currentVel = this.body.getLinearVelocity();
      this.body.setLinearVelocity(
        new Vector3(
          currentVel.x,
          this.damageKnockbackForce * 0.5,
          currentVel.z,
        ),
      );
    }

    // ===== INVULNERABILIDAD TEMPORAL =====
    this.startInvulnerability();

    // ===== CAMERA SHAKE FUERTE =====
    if (this.cameraShaker) {
      this.cameraShaker.shakeHard();
    }
  }

  startInvulnerability() {
    this.isInvulnerable = true;
    this.invulnerabilityTimer = this.invulnerabilityDuration;

    // Iniciar parpadeo visual
    this.startBlinking();

    console.log('Invulnerability started!');
  }

  startBlinking() {
    // Parpadear rápidamente (cada 100ms)
    let visible = true;
    this.blinkInterval = setInterval(() => {
      visible = !visible;
      this.mesh.visibility = visible ? 1 : 0.3;
    }, 100);
  }

  stopBlinking() {
    if (this.blinkInterval) {
      clearInterval(this.blinkInterval);
      this.blinkInterval = null;
    }
    // Restaurar visibilidad completa
    this.mesh.visibility = 1;
  }

  updateInvulnerability(deltaTime: number) {
    if (!this.isInvulnerable) return;

    this.invulnerabilityTimer -= deltaTime;

    if (this.invulnerabilityTimer <= 0) {
      this.isInvulnerable = false;
      this.stopBlinking();
      console.log('Invulnerability ended!');
    }
  }

  die() {
    console.log('Player died!');

    // Detener cualquier estado activo
    this.stopBlinking();
    this.isDashing = false;
    this.recoilVelocity = Vector3.Zero();

    // Pequeña pausa dramática
    setTimeout(() => {
      this.respawn();
    }, 500);
  }

  respawn() {
    console.log('Respawning...');

    // Restaurar salud
    this.currentHealth = this.maxHealth;
    this.updateHealthUI();

    // Teletransportar al spawn point
    this.mesh.position = this.spawnPoint.clone();

    // Resetear velocidad
    if (this.body) {
      this.body.setLinearVelocity(Vector3.Zero());
      this.body.setAngularVelocity(Vector3.Zero());
    }

    // Pequeña invulnerabilidad post-respawn
    this.startInvulnerability();

    console.log('Player respawned!');
  }

  setSpawnPoint(position: any) {
    this.spawnPoint = position.clone();
  }

  getHealth() {
    return this.currentHealth;
  }

  getMaxHealth() {
    return this.maxHealth;
  }

  isAlive() {
    return this.currentHealth > 0;
  }
}
