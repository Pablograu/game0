import {
  Vector3,
  Quaternion,
  PhysicsRaycastResult,
  Scene,
} from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock, Control } from '@babylonjs/gui';
import { WeaponSystem } from './WeaponSystem.ts';
import { EffectManager } from './EffectManager.ts';

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
  dashSpeed: number;
  dashTimer: number;
  gameManager: any = null; // Referencia al GameManager
  healthText: TextBlock | null;
  healthUI: AdvancedDynamicTexture | null;
  inputEnabled: boolean = true; // Flag para pausar input
  inputMap: Record<string, boolean>;
  invulnerabilityDuration: number;
  invulnerabilityTimer: number;
  isAttacking: boolean = false;
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
  scene: Scene;
  spawnPoint: Vector3;
  targetAngle: number = 0;
  targetRotation: Quaternion;
  targetScale: Vector3;
  wasGrounded: boolean;
  weaponSystem: WeaponSystem | null;

  // ===== SISTEMA DE PUÑOS RÁPIDOS =====
  useLeftPunch: boolean = true; // Alternar entre puño izquierdo y derecho
  punchSpeed: number = 2.5; // Velocidad de reproducción de las animaciones de puño (más alto = más rápido)
  normalMoveSpeed: number = 8; // Guardar velocidad normal
  attackMoveSpeedMultiplier: number = 0.1; // Reducción de velocidad durante ataque (10%)
  punchHitboxDelay: number = 0.15; // Porcentaje de la animación para activar hitbox (15% para puños rápidos)
  animationGroups: Map<string, any> = new Map(); // Mapa de animation groups
  currentPlayingAnimation: string = 'idle'; // Animación actualmente en reproducción
  blendingSpeed: number = 0.1; // Velocidad de blending global (alta = rápida pero suave)

  constructor(mesh: any, camera: any, scene: Scene, cameraShaker: any = null) {
    this.mesh = mesh;
    this.camera = camera;
    this.scene = scene;
    this.body = mesh.physicsBody;
    this.physicsEngine = scene.getPhysicsEngine();
    this.cameraShaker = cameraShaker;

    // Variables públicas para tunear
    this.moveSpeed = 8;
    this.jumpForce = 15;

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
    this.jumpCutMultiplier = 0.2; // Corte agresivo al soltar (30% de velocidad restante)
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

    // Partículas manejadas por EffectManager

    // ===== RAYCAST =====
    this.raycastResult = new PhysicsRaycastResult();

    // ===== RECOIL (RETROCESO) =====
    this.recoilForce = 8;
    this.pogoForce = 14;
    this.recoilVelocity = Vector3.Zero();
    this.recoilDecay = 10;

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

    // ===== INICIALIZAR PUÑOS RÁPIDOS =====
    this.useLeftPunch = true;
    this.normalMoveSpeed = this.moveSpeed;

    this.setupInput();
    this.setupPhysics();
    this.setupWeaponSystem();
    this.setupHealthUI();
    this.setupAnimationHandler();
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
      attackCooldown: 0,
      debug: true, // Cambiar a false para ocultar la hitbox
      cameraShaker: this.cameraShaker, // Pasar referencia al shake
    });

    console.log('WeaponSystem inicializado');
  }

  // ===== SISTEMA DE PUÑOS SPAM =====

  /**
   * ===== REPRODUCCIÓN SUAVE DE ANIMACIONES =====
   * Maneja el blending correctamente deteniendo animaciones previas
   * @param name - Nombre de la animación
   * @param loop - Si debe hacer loop
   * @param forceReset - Forzar reinicio desde frame 0
   * @param speedRatio - Velocidad de reproducción (1.0 = normal, 2.0 = doble velocidad)
   */
  playSmoothAnimation(
    name: string,
    loop: boolean = true,
    forceReset: boolean = false,
    speedRatio: number = 1.0,
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

    // Iniciar la nueva animación con blending y velocidad customizada
    // El enableBlending = true hace que el fade-in sea suave
    animGroup.start(loop, speedRatio, animGroup.from, animGroup.to, true);

    // Actualizar estado
    this.currentPlayingAnimation = name;
  }

  /**
   * Ejecuta un puñetazo rápido alternando izquierda/derecha
   * Sin cooldown, puro spam
   */
  tryFastPunch() {
    // Verificar que las animaciones estén configuradas
    if (this.animationGroups.size === 0) {
      console.warn('AnimationGroups no configurados');
      return;
    }

    // Alternar entre puño izquierdo y derecho
    // Usar la variable y actualizarla INMEDIATAMENTE para evitar race conditions con spam
    const punchAnimation = this.useLeftPunch ? 'punch_l' : 'punch_r';

    // Alternar para el próximo golpe ANTES de ejecutar (crítico para spam)
    this.useLeftPunch = !this.useLeftPunch;

    console.log(`👊 Ejecutando: ${punchAnimation}`);

    // Ejecutar el puñetazo
    this.executeFastPunch(punchAnimation);
  }

  /**
   * ===== EJECUTAR PUÑETAZO RÁPIDO =====
   * Puños rápidos sin bloqueo, puro spam
   * @param animationName - Nombre de la animación ('punch_l' o 'punch_r')
   */
  executeFastPunch(animationName: string) {
    // Marcar que estamos atacando
    this.isAttacking = true;

    // Obtener el animation group
    const animGroup = this.animationGroups.get(animationName);

    if (!animGroup) {
      console.warn(`❌ Animación '${animationName}' no encontrada`);
      this.isAttacking = false;
      return;
    }

    // ===== REPRODUCIR CON VELOCIDAD RÁPIDA =====
    // forceReset = true para que el golpe empiece desde el frame 0
    // punchSpeed hace que la animación sea más rápida
    this.playSmoothAnimation(animationName, false, true, this.punchSpeed);

    // Calcular duración de la animación para sincronizar el daño
    const frameRate =
      animGroup.targetedAnimations[0]?.animation.framePerSecond || 30;
    const baseDuration = (animGroup.to - animGroup.from) / frameRate;
    const animationDuration = baseDuration / this.punchSpeed; // Ajustar por velocidad

    // Programar activación de hitbox al inicio de la animación (más rápido)
    const hitboxActivationTime =
      animationDuration * this.punchHitboxDelay * 1000; // ms

    setTimeout(() => {
      if (this.isAttacking && this.weaponSystem) {
        this.activateHitbox();
      }
    }, hitboxActivationTime);

    // ===== CALLBACK DE FINALIZACIÓN =====
    // Limpiar listeners previos para evitar duplicados
    animGroup.onAnimationGroupEndObservable.clear();

    // Configurar callback para cuando termine la animación
    animGroup.onAnimationGroupEndObservable.addOnce(() => {
      this.onFastPunchEnd();
    });
  }

  /**
   * Activa la hitbox para detectar impactos
   */
  activateHitbox() {
    if (!this.weaponSystem) {
      return;
    }

    console.log('¡Hitbox activada!');

    // Activar el sistema de detección de golpes del WeaponSystem
    this.weaponSystem.activateHitbox();
  }

  /**
   * Callback cuando termina la animación de puñetazo rápido
   */
  onFastPunchEnd() {
    // Desactivar hitbox
    if (this.weaponSystem) {
      this.weaponSystem.deactivateHitbox();
    }

    // Restaurar estado
    this.isAttacking = false;

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

  /**
   * Inicializa el sistema de animaciones
   * Configura blending en todos los AnimationGroups
   */
  setupAnimationHandler() {
    if (this.mesh.animationModels) {
      this.setupAnimations();
      console.log('Sistema de animaciones inicializado');
    } else {
      console.warn('AnimationModels no disponibles');
    }
  }

  /**
   * Configura blending en todos los AnimationGroups para transiciones suaves
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
      if (!this.inputEnabled) {
        return; // Ignorar input si está pausado
      }

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
          this.tryFastPunch();
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

    // Click izquierdo para atacar (spam permitido)
    this.scene.onPointerObservable.add((pointerInfo: any) => {
      if (!this.inputEnabled) {
        return; // Ignorar input si está pausado
      }

      // Tipo 1 = POINTERDOWN
      if (pointerInfo.type === 1 && pointerInfo.event.button === 0) {
        this.tryFastPunch();
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

  // Partículas ahora manejadas completamente por EffectManager

  setupUpdate() {
    // Update loop - se ejecuta antes de cada frame
    this.scene.onBeforeRenderObservable.add(() => {
      this.update();
    });
  }

  update() {
    if (!this.body) return;
    const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

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
    const effectiveMoveSpeed = this.isAttacking
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

  /**
   * Sistema de animaciones con blending
   * Actualiza la animación según el estado del jugador
   */
  updateAnimation(moveDirection: any, velocity: any) {
    if (this.animationGroups.size === 0) return;

    // No interrumpir animaciones de ataque
    if (this.isAttacking) return;

    let targetAnimation = 'idle';
    let animSpeed = 1.0;

    // Determinar animación según estado
    if (!this.isGrounded && velocity.y > 0.5) {
      // Saltando (subiendo)
      targetAnimation = 'jump';
      animSpeed = Math.max(0.5, (velocity.y / this.jumpForce) * 1.2);
    } else if (!this.isGrounded && velocity.y < -0.5) {
      // Cayendo - velocidad proporcional a la caída
      targetAnimation = 'jump';
      animSpeed = Math.min(1.0, Math.abs(velocity.y) / 10);
    } else if (!this.isGrounded) {
      // En el aire cerca del pico del salto
      targetAnimation = 'jump';
      animSpeed = 0.3;
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

      // Partículas de polvo al saltar
      const dustPos = this.mesh.getAbsolutePosition().clone();
      dustPos.y -= this.playerHeight / 2;
      EffectManager.showDust(dustPos, {
        count: 12,
        duration: 0.35,
        direction: 'up',
      });
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
    if (moveDirection.length() <= 0.1) return;

    const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);
    this.targetRotation = Quaternion.FromEulerAngles(0, targetAngle, 0);

    // Obtener modelo actual directamente
    const modelRoot =
      this.mesh.animationModels?.[this.currentPlayingAnimation]?.root;

    if (modelRoot) {
      if (!modelRoot.rotationQuaternion) {
        modelRoot.rotationQuaternion = Quaternion.Identity();
      }
      const slerpFactor = Math.min(1, this.rotationSpeed * deltaTime);
      modelRoot.rotationQuaternion = Quaternion.Slerp(
        modelRoot.rotationQuaternion,
        this.targetRotation,
        slerpFactor,
      );
    } else {
      // Fallback: rotar cápsula si no hay modelo
      if (!this.mesh.rotationQuaternion) {
        this.mesh.rotationQuaternion = Quaternion.Identity();
      }
      const slerpFactor = Math.min(1, this.rotationSpeed * deltaTime);
      this.mesh.rotationQuaternion = Quaternion.Slerp(
        this.mesh.rotationQuaternion,
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

    const moveDir = this.getMoveDirection();
    this.dashDirection =
      moveDir.length() > 0.1
        ? moveDir.normalize()
        : this.lastFacingDirection.clone().normalize();

    this.targetScale = new Vector3(0.7, 1.3, 0.7);

    // Partículas de dash con EffectManager
    const dashPos = this.mesh.getAbsolutePosition();
    EffectManager.showDust(dashPos, {
      count: 30,
      duration: 0.3,
      direction: 'radial',
    });
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
    const currentVel = this.body.getLinearVelocity();
    this.body.setLinearVelocity(new Vector3(0, currentVel.y, 0));
    this.targetScale = this.originalScale.clone();
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
    this.applyLandSquash();

    // Partículas de polvo con EffectManager
    const dustPos = this.mesh.getAbsolutePosition().clone();
    dustPos.y -= this.playerHeight / 2;
    EffectManager.showDust(dustPos, {
      count: 20,
      duration: 0.5,
      direction: 'radial',
    });

    if (this.cameraShaker) {
      this.cameraShaker.shakeSoft();
    }
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

    // Notificar al GameManager
    if (this.gameManager && this.gameManager.gameOver) {
      setTimeout(() => {
        this.gameManager.gameOver();
      }, 500);
    } else {
      // Fallback si no hay GameManager
      setTimeout(() => {
        this.respawn();
      }, 500);
    }
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

  /**
   * ===== GAME STATE CONTROL =====
   * Métodos para pausar/reanudar el input y movimiento del jugador
   */
  public setGameManager(gameManager: any) {
    this.gameManager = gameManager;
  }

  public enableInput() {
    this.inputEnabled = true;
    // No es necesario re-attachar camera controls, el GameManager lo hace
  }

  public detachControl() {
    this.inputEnabled = false;
    // Limpiar inputs activos
    this.inputMap = {};
    this.isDashing = false;
    // El GameManager se encarga de detach/attach camera
  }
}
