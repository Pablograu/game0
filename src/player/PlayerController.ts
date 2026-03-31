import {
  Axis,
  Vector3,
  Quaternion,
  PhysicsRaycastResult,
  Scene,
  Camera,
  Mesh,
  KeyboardInfo,
  PointerInfo,
  Skeleton,
  AnimationGroup,
  type Observer,
  PhysicsBody,
  TransformNode,
} from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock, Control } from '@babylonjs/gui';
import { WeaponSystem } from '../WeaponSystem.ts';
import { EffectManager } from '../EffectManager.ts';
import { AudioManager } from '../AudioManager.ts';
import { Ragdoll } from '../ragdoll_copy.js';
import { GameManager } from '../GameManager.ts';
import { CameraShaker } from '../CameraShaker.ts';
import {
  PlayerAnimationEntry,
  PlayerAnimationName,
  PlayerAnimationRegistry,
} from './PlayerAnimations.ts';

// ===== JUMP PHASE STATE MACHINE =====
enum JumpPhase {
  GROUNDED = 'GROUNDED',
  RISING = 'RISING',
  FALLING = 'FALLING',
  PRE_LANDING = 'PRE_LANDING', // Landing anim playing, awaiting physics contact
}

export class PlayerController {
  blinkInterval?: number;
  body: PhysicsBody;
  camera: Camera;
  cameraShaker: CameraShaker | null = null;
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
  gameManager: GameManager | null = null;
  healthText: TextBlock | null;
  healthUI: AdvancedDynamicTexture | null;
  inputEnabled: boolean = true; // Flag para pausar input
  inputMap: Record<string, boolean>;
  invulnerabilityDuration: number;
  invulnerabilityTimer: number;
  isAttacking: boolean = false;
  isDancing: boolean = false;
  isDashing: boolean;
  isGrounded: boolean;
  isInvulnerable: boolean;
  isKnockedBack: boolean = false;
  isMoving: boolean = false;
  jumpBufferTime: number;
  jumpBufferTimer: number;
  jumpCutMultiplier: number;
  jumpForce: number;
  jumpKeyReleased: boolean;
  knockbackDuration: number;
  lastFacingDirection: Vector3;
  lastKnockbackDir: Vector3 = Vector3.Zero();
  maxHealth: number;
  mesh: Mesh;
  moveSpeed: number;
  originalScale: Vector3;
  playerAnimations: PlayerAnimationRegistry;
  physicsEngine: any;
  playerHeight: number;
  playerRadius: number;
  pogoForce: number;
  ragdoll: Ragdoll | null = null;
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
  private keyboardObserver: Observer<KeyboardInfo> | null = null;
  private pointerObserver: Observer<PointerInfo> | null = null;
  private updateObserver: Observer<Scene> | null = null;
  private afterAnimationsObserver: Observer<Scene> | null = null;
  private ecsLocomotionFacadeEnabled: boolean = false;

  // ===== JUMP PHASE STATE MACHINE =====
  // Single source of truth — replaces isLanding, landingAnticipated, stale _airTime checks.
  private jumpPhase: JumpPhase = JumpPhase.GROUNDED;
  private airTime: number = 0; // Seconds airborne in current hop
  private readonly minAirTime: number = 0.15; // Guard against spawn-frame flash
  private readonly fallingAnimDelay: number = 0.15; // Seconds before 'falling' anim plays

  // ===== GROUND DETECTION DEBOUNCE =====
  private groundLostTimer: number = 0; // Time since last valid ground contact
  private readonly groundLostGrace: number = 0.08; // 80ms grace before marking airborne
  private readonly COL_ENVIRONMENT: number = 0x0001; // Must match main.ts collision mask

  // ===== SISTEMA DE PUÑOS RÁPIDOS =====
  useLeftPunch: boolean = true; // Alternar entre puño izquierdo y derecho
  punchSpeed: number = 2; // Velocidad de reproducción de las animaciones de puño (más alto = más rápido)
  normalMoveSpeed: number = 8; // Guardar velocidad normal
  attackMoveSpeedMultiplier: number = 0.1; // Reducción de velocidad durante ataque (10%)
  punchHitboxDelay: number = 0.8; // Porcentaje de la animación para activar hitbox (15% para puños rápidos)
  animationGroups: Map<string, AnimationGroup> = new Map(); // Mapa de animation groups

  // ===== MAGNETISMO DE PUÑOS =====
  private magnetismRange: number = 4; // Distancia máxima para activar el magnetismo (unidades del mundo)
  private magnetismLungeSpeed: number = 6; // Velocidad del lunge hacia el enemigo al atacar
  currentPlayingAnimation: string = 'idle'; // Animación actualmente en reproducción
  blendingSpeed: number = 0.1; // Velocidad de blending global (alta = rápida pero suave)

  // ===== ATTACK INPUT BUFFER =====
  private readonly MAX_ATTACK_QUEUE = 1;
  private attackQueue: string[] = [];

  constructor(
    camera: Camera,
    cameraShaker: CameraShaker = null,
    mesh: Mesh,
    playerAnimations: PlayerAnimationRegistry,
    scene: Scene,
  ) {
    this.mesh = mesh;
    this.camera = camera;
    this.scene = scene;
    this.playerAnimations = playerAnimations;
    this.body = mesh.physicsBody;
    this.physicsEngine = scene.getPhysicsEngine();
    this.cameraShaker = cameraShaker;

    this.moveSpeed = 8;
    this.jumpForce = 15;

    this.playerHeight = 2; // Altura de la cápsula
    this.playerRadius = 0.5;

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
    this.dashSpeed = 17;
    this.dashDuration = 0.7; // Segundos que dura el dash
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

    // ===== RAYCAST =====
    this.raycastResult = new PhysicsRaycastResult();

    // ===== RECOIL (RETROCESO) =====
    this.recoilForce = 8;
    this.pogoForce = 14;
    this.recoilVelocity = Vector3.Zero();
    this.recoilDecay = 10;

    // ===== SISTEMA DE SALUD =====
    this.maxHealth = 1000;
    this.currentHealth = this.maxHealth;
    this.isInvulnerable = false;
    this.invulnerabilityDuration = 1.5; // Segundos de invulnerabilidad tras daño
    this.invulnerabilityTimer = 0;
    this.blinkInterval = null;
    this.damageKnockbackForce = 12; // Fuerza de knockback al recibir daño
    this.knockbackDuration = 0.3; // Seconds player movement is suppressed after a hit

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
    this.weaponSystem = new WeaponSystem(this, this.scene, {
      damage: 1,
      attackDuration: 0.15,
      attackCooldown: 0,
      debug: true, // Cambiar a false para ocultar la hitbox
      cameraShaker: this.cameraShaker,
      hitboxOffset: 1.8,
    });

    console.log('WeaponSystem inicializado');
  }

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

    if (
      this.currentPlayingAnimation === name &&
      loop &&
      animGroup.isPlaying &&
      !forceReset
    ) {
      return;
    }

    console.log(
      `🎬 Reproduciendo: ${name} (loop: ${loop}, forceReset: ${forceReset})`,
    );

    this.animationGroups.forEach((otherAnimGroup, otherName) => {
      if (otherName !== name && otherAnimGroup.isPlaying) {
        otherAnimGroup.stop();
      }
    });

    animGroup.loopAnimation = loop;

    animGroup.start(loop, speedRatio, animGroup.from, animGroup.to, true);

    this.currentPlayingAnimation = name;
  }

  punch() {
    if (this.animationGroups.size === 0) {
      console.warn('AnimationGroups no configurados');
      return;
    }

    if (this.attackQueue.length >= this.MAX_ATTACK_QUEUE) {
      console.log(
        `🚫 Attack queue full (${this.MAX_ATTACK_QUEUE}), input discarded`,
      );
      return;
    }

    if (!this.isGrounded) {
      this.attackQueue.push('flying_kick');
    } else {
      const punchAnimation = this.useLeftPunch ? 'punch_L' : 'punch_R';
      this.useLeftPunch = !this.useLeftPunch;

      this.attackQueue.push(punchAnimation);
      console.log(
        `📥 Queued: ${punchAnimation} (queue size: ${this.attackQueue.length})`,
      );
    }

    if (!this.isAttacking) {
      this.drainAttackQueue();
    }
  }

  private drainAttackQueue() {
    const next = this.attackQueue.shift();
    if (next) {
      console.log(
        `👊 Ejecutando: ${next} (remaining: ${this.attackQueue.length})`,
      );
      this.executeFastPunch(next);
    } else {
      this.returnToIdleOrRun();
    }
  }

  autoAim(animationName: string) {
    const target = this.getClosestAliveEnemy(this.magnetismRange);
    if (target) {
      const playerPos = this.mesh.getAbsolutePosition();
      const enemyPos = target.getPosition();
      const dir = enemyPos.subtract(playerPos);
      dir.y = 0;
      const distXZ = dir.length();
      if (distXZ > 0.01) {
        dir.x /= distXZ;
        dir.z /= distXZ;
        const angle = Math.atan2(dir.x, dir.z);
        this.targetRotation = Quaternion.FromEulerAngles(0, angle, 0);
        // Snap inmediato del modelo para que el ataque apunte al enemigo desde el frame 0
        const modelRoot = this.getAnimationEntry(animationName)?.root;
        if (modelRoot) {
          if (!modelRoot.rotationQuaternion) {
            modelRoot.rotationQuaternion = Quaternion.Identity();
          }
          modelRoot.rotationQuaternion = this.targetRotation.clone();
        }
        // Lunge físico hacia el enemigo (preservar velocidad vertical para gravedad)
        const currentY = this.body?.getLinearVelocity().y ?? 0;
        this.body?.setLinearVelocity(
          new Vector3(
            dir.x * this.magnetismLungeSpeed,
            currentY,
            dir.z * this.magnetismLungeSpeed,
          ),
        );
      }
    }
  }

  executeFastPunch(animationName: string) {
    // Guardia: nunca interrumpir un ataque en curso
    if (this.isAttacking) {
      console.warn('executeFastPunch called while already attacking — skipped');
      return;
    }

    // Marcar que estamos atacando
    this.isAttacking = true;

    this.autoAim(animationName);

    // Obtener el animation group
    const animGroup = this.animationGroups.get(animationName);

    if (!animGroup) {
      console.warn(`❌ Animación '${animationName}' no encontrada`);
      this.isAttacking = false;
      this.drainAttackQueue();
      return;
    }

    // ===== REPRODUCIR CON VELOCIDAD RÁPIDA =====
    // forceReset = true para que el golpe empiece desde el frame 0
    // punchSpeed hace que la animación sea más rápida
    AudioManager.play('player_punch');
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

  activateHitbox() {
    if (!this.weaponSystem) {
      return;
    }
    this.weaponSystem.activateHitbox();
  }

  onFastPunchEnd() {
    if (this.weaponSystem) {
      this.weaponSystem.deactivateHitbox();
    }

    this.isAttacking = false;

    this.drainAttackQueue();
  }

  returnToIdleOrRun() {
    if (this.animationGroups.size === 0) return;

    const moveDirection = this.getMoveDirection();
    const targetAnim = moveDirection.length() > 0.1 ? 'run' : 'idle';

    console.log(`🔄 Volviendo a: ${targetAnim}`);

    this.playSmoothAnimation(targetAnim, true, false);
  }

  setupAnimationHandler() {
    if (Object.keys(this.playerAnimations).length === 0) {
      console.warn('Player animations no disponibles');
      return;
    }

    this.setupAnimations();
    console.log('Sistema de animaciones inicializado');
  }

  setupAnimations() {
    console.log('🎬 Configurando blending en todas las animaciones...');

    this.animationGroups.clear();

    const animationEntries = Object.entries(this.playerAnimations) as [
      PlayerAnimationName,
      PlayerAnimationEntry,
    ][];

    animationEntries.forEach(([animName, animEntry]) => {
      if (animEntry) {
        const animGroup = animEntry.animationGroup;

        animGroup.enableBlending = true;
        animGroup.blendingSpeed = this.blendingSpeed;

        animGroup.normalize(0, animGroup.to);

        this.animationGroups.set(animName, animGroup);
      }
    });

    // ===== PREVENT T-POSE ON FIRST FRAME =====
    const idleAg = this.animationGroups.get('idle');
    if (idleAg) {
      idleAg.start(true, 1.0, idleAg.from, idleAg.to, false);
      this.currentPlayingAnimation = 'idle';
    }
  }

  setupInput() {
    if (this.keyboardObserver || this.pointerObserver) {
      return;
    }

    this.keyboardObserver = this.scene.onKeyboardObservable.add(
      (kbInfo: KeyboardInfo) => {
        if (!this.inputEnabled) {
          return; // Ignorar input si está pausado
        }

        const key = kbInfo.event.key.toLowerCase();

        // KEYDOWN
        if (kbInfo.type === 1) {
          this.inputMap[key] = true;

          if (key === ' ') {
            this.jumpBufferTimer = this.jumpBufferTime;
            this.jumpKeyReleased = false;
          }

          if (key === 'shift' && this.dashCooldownTimer <= 0) {
            this.startDash();
          }

          if (key === 'k') {
            this.isDancing = !this.isDancing;
          }
          // KEYUP
        } else if (kbInfo.type === 2) {
          this.inputMap[key] = false;

          // Variable Jump: detectar cuando suelta la tecla
          if (key === ' ') {
            this.jumpKeyReleased = true;
          }
        }
      },
    );

    this.pointerObserver = this.scene.onPointerObservable.add(
      (pointerInfo: PointerInfo) => {
        if (!this.inputEnabled) {
          return; // Ignorar input si está pausado
        }

        // Tipo 1 = POINTERDOWN
        if (pointerInfo.type === 1 && pointerInfo.event.button === 0) {
          this.punch();
        }
      },
    );
  }

  setupPhysics() {
    if (!this.body) {
      console.error('El mesh del jugador necesita un PhysicsBody');
      return;
    }

    // Bloquear rotación angular para evitar volcarse
    this.body.setAngularVelocity(new Vector3(0, 0, 0));
    this.body.disablePreStep = false;

    this.body.setMassProperties({
      mass: 1,
      inertia: new Vector3(0, 0, 0),
    });
  }

  setupUpdate() {
    if (!this.updateObserver) {
      this.updateObserver = this.scene.onBeforeRenderObservable.add(() => {
        if (this.ecsLocomotionFacadeEnabled) {
          return;
        }

        this.update();
      });
    }

    if (this.afterAnimationsObserver) {
      return;
    }

    this.afterAnimationsObserver = this.scene.onAfterAnimationsObservable.add(
      () => {
        if (!this.mesh.skeleton) {
          return;
        }

        const scale = this.isAttacking ? 1.5 : 1;
        const bones = this.mesh.skeleton.bones.filter((b) =>
          /arm/i.test(b.name),
        );
        bones.forEach((b) => {
          const tn = b.getTransformNode();
          if (tn) {
            tn.scaling.setAll(scale);
          }
        });
      },
    );
  }

  public enableEcsLocomotionFacade() {
    if (this.ecsLocomotionFacadeEnabled) {
      return;
    }

    this.ecsLocomotionFacadeEnabled = true;

    if (this.keyboardObserver) {
      this.scene.onKeyboardObservable.remove(this.keyboardObserver);
      this.keyboardObserver = null;
    }

    if (this.pointerObserver) {
      this.scene.onPointerObservable.remove(this.pointerObserver);
      this.pointerObserver = null;
    }

    if (this.updateObserver) {
      this.scene.onBeforeRenderObservable.remove(this.updateObserver);
      this.updateObserver = null;
    }
  }

  public runLegacyPostEcsUpdate(moveDirection: Vector3, deltaTime: number) {
    if (!this.body) {
      return;
    }

    this.updateInvulnerability(deltaTime);

    const currentVelocity = this.body.getLinearVelocity();
    this.updateJumpPhase(currentVelocity, deltaTime);
    this.updateAnimation(moveDirection, currentVelocity);
  }

  public applyEcsBridgeSnapshot(snapshot: {
    jumpPhase: string;
    airTime: number;
    groundLostTimer: number;
  }) {
    this.jumpPhase = snapshot.jumpPhase as JumpPhase;
    this.airTime = snapshot.airTime;
    this.groundLostTimer = snapshot.groundLostTimer;
  }

  public getEcsBridgeSnapshot() {
    return {
      jumpPhase: this.jumpPhase,
      airTime: this.airTime,
      minAirTime: this.minAirTime,
      fallingAnimDelay: this.fallingAnimDelay,
      groundLostTimer: this.groundLostTimer,
      groundLostGrace: this.groundLostGrace,
    };
  }

  update() {
    if (this.ecsLocomotionFacadeEnabled) {
      return;
    }

    if (!this.body) {
      return;
    }

    const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

    this.updateInvulnerability(deltaTime);
    this.wasGrounded = this.isGrounded;
    this.checkGrounded();
    this.updateCoyoteTime(deltaTime);

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= deltaTime;
    }

    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= deltaTime;
    }

    if (this.isDashing) {
      this.updateDash(deltaTime);
      return;
    }

    const currentVelocity = this.body.getLinearVelocity();
    const moveDirection = this.getMoveDirection();

    if (moveDirection.length() > 0.1) {
      this.lastFacingDirection = moveDirection.clone();
    }

    if (this.isKnockedBack) {
      this.knockbackDuration -= deltaTime;

      if (this.knockbackDuration <= 0) {
        this.isKnockedBack = false;
      }

      this.body.setAngularVelocity(new Vector3(0, 0, 0));
      return;
    }

    if (this.isAttacking && !this.isGrounded && moveDirection.length() > 0.1) {
      return;
    }

    if (this.recoilVelocity.length() > 0.1) {
      this.recoilVelocity = this.recoilVelocity.scale(
        1 - this.recoilDecay * deltaTime,
      );
    } else {
      this.recoilVelocity = Vector3.Zero();
    }

    const effectiveMoveSpeed = this.isAttacking
      ? this.moveSpeed * this.attackMoveSpeedMultiplier
      : this.moveSpeed;

    this.body.setLinearVelocity(
      new Vector3(
        moveDirection.x * effectiveMoveSpeed + this.recoilVelocity.x,
        currentVelocity.y,
        moveDirection.z * effectiveMoveSpeed + this.recoilVelocity.z,
      ),
    );
    this.body.setAngularVelocity(new Vector3(0, 0, 0));

    this.updateRotation(moveDirection, deltaTime);
    this.handleJump(currentVelocity);
    this.handleVariableJump();
    this.updateJumpPhase(currentVelocity, deltaTime);
    this.updateAnimation(moveDirection, currentVelocity);
  }

  /**
   * Sistema de animaciones con blending
   * Actualiza la animación según el estado del jugador
   */
  updateAnimation(moveDirection: Vector3, velocity: Vector3) {
    if (this.animationGroups.size === 0) {
      return;
    }

    if (this.isAttacking) {
      return;
    }
    // PRE_LANDING: landing anim is running — allow movement to cancel it early
    if (this.jumpPhase === JumpPhase.PRE_LANDING) {
      if (this.isGrounded && moveDirection.length() > 0.1) {
        // Player started running — skip the rest of the landing clip
        this.jumpPhase = JumpPhase.GROUNDED;
        const landingAg = this.animationGroups.get('land');
        if (landingAg) {
          landingAg.onAnimationGroupEndObservable.clear();
        }
      } else {
        return;
      }
    }

    let targetAnimation: string;
    let animSpeed: number;

    if (this.isDashing) {
      targetAnimation = 'dash';
      animSpeed = 1.5;
    } else if (this.currentHealth <= 0) {
      targetAnimation = 'dead';
      animSpeed = 1.0;
    } else if (this.jumpPhase === JumpPhase.RISING) {
      // Ascending — scale anim speed to vertical velocity
      targetAnimation = 'jump';
      animSpeed = Math.max(0.5, (velocity.y / this.jumpForce) * 1.2);
    } else if (this.jumpPhase === JumpPhase.FALLING) {
      if (this.airTime >= this.fallingAnimDelay) {
        // Extended airtime — switch to falling anim
        targetAnimation = 'falling';
        animSpeed = Math.min(1.0, Math.abs(velocity.y) / 10);
      } else {
        // Near apex — keep jump anim playing slowly
        targetAnimation = 'jump';
        animSpeed = 0.3;
      }
    } else if (moveDirection.length() > 0.1) {
      targetAnimation = 'run';
      animSpeed = 1.0;
    } else if (this.isDancing) {
      targetAnimation = 'macarena';
      animSpeed = 1.0;
    } else {
      targetAnimation = 'idle';
      animSpeed = 1.0;
    }

    // ===== WALKING SOUND =====
    const shouldWalk = targetAnimation === 'run' && this.isGrounded;
    if (shouldWalk) {
      AudioManager.playLoop('player_walk');
    }

    if (this.currentPlayingAnimation !== targetAnimation) {
      this.playSmoothAnimation(targetAnimation, true, false);
    }

    const currentAnimGroup = this.animationGroups.get(targetAnimation);
    if (currentAnimGroup && currentAnimGroup.isPlaying) {
      currentAnimGroup.speedRatio = animSpeed;
    }
  }

  isSurface(node: TransformNode): boolean {
    const body = node?.physicsBody;
    if (!body) return false;
    const shape = body.shape;
    if (!shape) return false;
    return (shape.filterMembershipMask & this.COL_ENVIRONMENT) !== 0;
  }

  // ===== GROUND CHECK CON RAYCAST =====
  checkGrounded() {
    const playerPos = this.mesh.position.clone();
    const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

    // Punto de inicio del rayo (centro del jugador)
    const rayStart = new Vector3(playerPos.x, playerPos.y, playerPos.z);

    // Punto final del rayo (hacia abajo)
    // Longitud = mitad de altura + un poco de margen
    const rayLength = this.playerHeight / 2 + 0.55;
    const rayEnd = new Vector3(
      playerPos.x,
      playerPos.y - rayLength,
      playerPos.z,
    );

    // Realizar el raycast usando el motor de física
    this.physicsEngine.raycastToRef(rayStart, rayEnd, this.raycastResult);

    // Si el rayo golpea una superficie válida (environment collision mask)
    if (this.raycastResult.hasHit) {
      const hitBody = this.raycastResult.body;

      if (this.isSurface(hitBody.transformNode)) {
        this.isGrounded = true;
        this.groundLostTimer = 0;
        return;
      }
    }

    // Grace period: don't immediately mark as airborne to prevent single-frame flickers
    this.groundLostTimer += deltaTime;
    if (this.groundLostTimer >= this.groundLostGrace) {
      this.isGrounded = false;
    }
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
    return this.isGrounded || this.coyoteTimer > 0;
  }

  getMoveDirection() {
    const forward = this.camera.getDirection(Vector3.Forward());
    const right = this.camera.getDirection(Vector3.Right());

    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    const direction = Vector3.Zero();

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

  handleJump(currentVelocity: Vector3) {
    const shouldJump = this.jumpBufferTimer > 0 && this.canJump();

    if (!shouldJump) {
      return;
    }

    const jumpVelocity = new Vector3(
      currentVelocity.x,
      this.jumpForce,
      currentVelocity.z,
    );
    this.body.setLinearVelocity(jumpVelocity);

    this.jumpBufferTimer = 0;
    this.coyoteTimer = 0;
    this.jumpPhase = JumpPhase.RISING;
    this.airTime = 0;

    AudioManager.play('player_jump');

    const dustPos = this.mesh.getAbsolutePosition().clone();
    dustPos.y -= this.playerHeight / 2;
    EffectManager.showDust(dustPos, {
      count: 12,
      duration: 0.35,
      direction: 'up',
    });
  }

  // ===== VARIABLE JUMP (cortar altura al soltar) =====
  handleVariableJump() {
    const currentVelocity = this.body.getLinearVelocity();
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
  updateRotation(moveDirection: Vector3, deltaTime: number) {
    if (moveDirection.length() <= 0.1) return;

    const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);
    this.targetRotation = Quaternion.FromEulerAngles(0, targetAngle, 0);

    const modelRoot = this.getAnimationEntry(
      this.currentPlayingAnimation,
    )?.root;

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

  private getAnimationEntry(name: string): PlayerAnimationEntry | undefined {
    return this.playerAnimations[name as PlayerAnimationName];
  }

  // ===== DASH =====
  startDash() {
    const animationName = 'dash';
    const animGroup = this.animationGroups.get(animationName);

    if (animGroup) {
      this.playSmoothAnimation(animationName, false, true, 1.5);
    } else {
      console.warn(`Animación de dash '${animationName}' no encontrada`);
    }

    this.isDashing = true;
    this.dashTimer = this.dashDuration;
    this.dashCooldownTimer = this.dashCooldown;

    // Cancelar ataques pendientes al iniciar el dash
    this.attackQueue = [];
    this.isAttacking = false;
    this.isAttacking = false;

    AudioManager.play('player_dash');

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
    const dashVelocity = new Vector3(
      this.dashDirection.x * this.dashSpeed,
      -10, // makes the player go back to the ground if dashing in the air
      this.dashDirection.z * this.dashSpeed,
    );
    this.body.setLinearVelocity(dashVelocity);

    this.dashTimer -= deltaTime;

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

  // ===== EVENTOS =====
  onLand() {
    this.airTime = 0;

    const dustPos = this.mesh.getAbsolutePosition().clone();
    dustPos.y -= this.playerHeight / 2;
    EffectManager.showDust(dustPos, {
      count: 20,
      duration: 0.5,
      direction: 'radial',
    });

    if (this.cameraShaker) this.cameraShaker.shakeSoft();

    if (this.jumpPhase === JumpPhase.PRE_LANDING) {
      // Anticipation already started the anim — observable will set GROUNDED when it ends
      return;
    }

    // Short hop: anticipation never fired — play landing now as fallback
    this.jumpPhase = JumpPhase.PRE_LANDING;
    const landingAg = this.animationGroups.get('land');
    if (landingAg) {
      // forceReset: false — let blending smooth the entry, no skeleton snap
      this.playSmoothAnimation('land', false, false, 1.0);
      landingAg.onAnimationGroupEndObservable.clear();
      landingAg.onAnimationGroupEndObservable.addOnce(() => {
        this.jumpPhase = JumpPhase.GROUNDED;
      });
    } else {
      this.jumpPhase = JumpPhase.GROUNDED;
    }
  }

  /**
   * Central jump/fall/landing state machine — single source of truth.
   * Called every frame from update(). Owns all phase transitions.
   */
  private updateJumpPhase(velocity: Vector3, deltaTime: number) {
    // ── Physics landing detected ───────────────────────────────────
    if (this.isGrounded && !this.wasGrounded) {
      this.onLand();
      return;
    }

    // ── Already on ground ─────────────────────────────────────────
    if (this.isGrounded) {
      this.airTime = 0;
      // Don't override PRE_LANDING — its observable handles the GROUNDED transition
      if (this.jumpPhase !== JumpPhase.PRE_LANDING) {
        this.jumpPhase = JumpPhase.GROUNDED;
      }
      return;
    }

    // ── Airborne ──────────────────────────────────────────────────
    this.airTime += deltaTime;

    switch (this.jumpPhase) {
      case JumpPhase.GROUNDED:
        // Walked off a ledge without jumping
        this.jumpPhase = JumpPhase.FALLING;
        break;

      case JumpPhase.RISING:
        // Transition to falling once past the apex
        if (velocity.y <= 0 && this.airTime > this.minAirTime) {
          this.jumpPhase = JumpPhase.FALLING;
        }
        break;

      case JumpPhase.FALLING:
        // Check if ground is close enough to start landing anim early
        if (velocity.y < -0.5) {
          this.checkLandingAnticipation();
        }
        break;

      case JumpPhase.PRE_LANDING:
        // Landing anim is playing — wait for observable or physics contact
        break;
    }
  }

  /**
   * Short downward raycast. If ground is within _landingAnticipationDist,
   * transitions to PRE_LANDING and starts the landing clip early so its
   * falling-intro lines up with actual physics contact.
   * Tune _landingAnticipationDist to adjust lead time.
   */
  private checkLandingAnticipation() {
    if (!this.raycastResult.hasHit || this.raycastResult.body === this.body) {
      return;
    }

    // Only anticipate landing on actual environment surfaces
    if (!this.isSurface(this.raycastResult.body.transformNode)) {
      return;
    }

    this.jumpPhase = JumpPhase.PRE_LANDING;
    const landingAg = this.animationGroups.get('land');

    if (!landingAg) {
      return;
    }

    // forceReset: false — smooth blend-in, prevents skeleton snap to frame 0
    this.playSmoothAnimation('land', false, false, 1.0);
    landingAg.onAnimationGroupEndObservable.clear();
    landingAg.onAnimationGroupEndObservable.addOnce(() => {
      // Anim ended: go to GROUNDED if on ground, back to FALLING if still airborne
      if (this.jumpPhase === JumpPhase.PRE_LANDING) {
        this.jumpPhase = this.isGrounded
          ? JumpPhase.GROUNDED
          : JumpPhase.FALLING;
      }
    });
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

  setMagnetismRange(range: number) {
    this.magnetismRange = range;
  }

  setMagnetismLungeSpeed(speed: number) {
    this.magnetismLungeSpeed = speed;
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
  applyRecoil(hitDirection: Vector3, enemyPosition: Vector3) {
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
   * Devuelve el enemigo vivo más cercano dentro de maxRange (distancia XZ),
   * o null si no hay ninguno en rango.
   */
  private getClosestAliveEnemy(maxRange: number): any | null {
    const enemies: any[] = this.weaponSystem?.enemies ?? [];
    const playerPos = this.mesh.getAbsolutePosition();
    let closest: any = null;
    let closestDist = maxRange;

    for (const enemy of enemies) {
      if (!enemy.isAlive()) continue;
      const ePos = enemy.getPosition();
      const dx = ePos.x - playerPos.x;
      const dz = ePos.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= closestDist) {
        closestDist = dist;
        closest = enemy;
      }
    }

    return closest;
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
  takeDamage(amount: number, damageSourcePosition: Vector3 | null = null) {
    const playerPos = this.mesh.getAbsolutePosition();
    const knockbackDir = damageSourcePosition
      ? playerPos.subtract(damageSourcePosition).normalize()
      : new Vector3(0, 0, 0);

    // ===== KNOCKBACK (always applied, even when dead or invulnerable) =====
    if (damageSourcePosition && this.body) {
      this.lastKnockbackDir = knockbackDir.clone();
      this.body.applyImpulse(
        knockbackDir.scale(this.damageKnockbackForce),
        playerPos,
      );
      this.recoilVelocity = Vector3.Zero(); // Don't let recoil fight the impulse
      this.isKnockedBack = true;
      this.knockbackDuration = 0.5;
    }

    // ===== BLOOD SPLASH =====
    const torsoPos = playerPos.clone();
    torsoPos.y += 1.0; // aim at chest
    EffectManager.showBloodSplash(torsoPos, {
      intensity: 'hit',
      direction: knockbackDir.length() > 0.01 ? knockbackDir : undefined,
    });

    this.playSmoothAnimation('stumble_back', false, true);

    if (this.isInvulnerable || this.currentHealth <= 0) {
      console.log('Damage ignored (invulnerable or dead)');
      return;
    }

    AudioManager.play('player_take_damage');

    this.currentHealth -= amount;

    console.log(`Player hit! Health: ${this.currentHealth}/${this.maxHealth}`);

    this.updateHealthUI();

    if (this.currentHealth <= 0) {
      this.die();
      return;
    }

    this.startInvulnerability();

    if (this.cameraShaker) {
      this.cameraShaker.shakeHard();
    }
  }

  startInvulnerability() {
    this.isInvulnerable = true;
    this.invulnerabilityTimer = this.invulnerabilityDuration;
    this.startBlinking();
  }

  startBlinking() {
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
    this.mesh.visibility = 1;
  }

  updateInvulnerability(deltaTime: number) {
    if (!this.isInvulnerable) return;

    this.invulnerabilityTimer -= deltaTime;

    if (this.invulnerabilityTimer <= 0) {
      this.isInvulnerable = false;
      this.stopBlinking();
    }
  }

  die() {
    if (this.ragdoll) {
      this.ragdoll.ragdoll();
      // Use setTimeout(0) so Havok has one tick to register the DYNAMIC motion type.
      const impulse = this.lastKnockbackDir.scale(
        this.damageKnockbackForce * 5,
      );
      const appPoint = this.mesh.getAbsolutePosition();
      setTimeout(() => {
        for (const agg of this.ragdoll.getAggregates()) {
          agg.body?.applyImpulse(impulse, appPoint);
        }
      }, 0);
    }

    this.stopBlinking();
    this.isDashing = false;
    this.attackQueue = [];
    this.isAttacking = false;

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

    this.currentHealth = this.maxHealth;
    this.updateHealthUI();

    this.mesh.position = this.spawnPoint.clone();

    if (this.body) {
      this.body.setLinearVelocity(Vector3.Zero());
      this.body.setAngularVelocity(Vector3.Zero());
    }

    this.startInvulnerability();

    console.log('Player respawned!');
  }

  initRagdoll(skeleton: Skeleton, armatureNode: Mesh) {
    if (!skeleton || !armatureNode) {
      console.error('Ragdoll setup failed: skeleton or armatureNode not found');
      return;
    }

    // Por alguna razon el scaling del Armature es 0.09
    // y se hace enorme si lo escalo a 1.7 (raro)
    armatureNode.scaling = new Vector3(0.017, 0.017, 0.017);

    const config = [
      { bones: ['mixamorig:Hips'], size: 0.45, boxOffset: 0.01 },
      {
        bones: ['mixamorig:Spine2'],
        size: 0.4,
        height: 0.6,
        boxOffset: 0.05,
        boneOffsetAxis: Axis.Z,
        min: -1,
        max: 1,
        rotationAxis: Axis.Z,
      },
      // Arms
      {
        bones: ['mixamorig:LeftArm', 'mixamorig:RightArm'],
        depth: 0.1,
        size: 0.1,
        width: 0.5,
        rotationAxis: Axis.Y,
        boxOffset: 0.1,
        boneOffsetAxis: Axis.Y,
      },
      {
        bones: ['mixamorig:LeftForeArm', 'mixamorig:RightForeArm'],
        depth: 0.1,
        size: 0.1,
        width: 0.5,
        rotationAxis: Axis.Y,
        min: -1,
        max: 1,
        boxOffset: 0.12,
        boneOffsetAxis: Axis.Y,
      },
      // Legs
      {
        bones: ['mixamorig:LeftUpLeg', 'mixamorig:RightUpLeg'],
        depth: 0.1,
        size: 0.2,
        width: 0.08,
        height: 0.7,
        rotationAxis: Axis.Y,
        min: -1,
        max: 1,
        boxOffset: 0.2,
        boneOffsetAxis: Axis.Y,
      },
      {
        bones: ['mixamorig:LeftLeg', 'mixamorig:RightLeg'],
        depth: 0.08,
        size: 0.3,
        width: 0.1,
        height: 0.4,
        rotationAxis: Axis.Y,
        min: -1,
        max: 1,
        boxOffset: 0.2,
        boneOffsetAxis: Axis.Y,
      },
      {
        bones: ['mixamorig:LeftHand', 'mixamorig:RightHand'],
        depth: 0.2,
        size: 0.2,
        width: 0.2,
        rotationAxis: Axis.Y,
        min: -1,
        max: 1,
        boxOffset: 0.1,
        boneOffsetAxis: Axis.Y,
      },
      // Head
      {
        bones: ['mixamorig:Head'],
        size: 0.4,
        boxOffset: 0,
        boneOffsetAxis: Axis.Y,
        min: -1,
        max: 1,
        rotationAxis: Axis.Z,
      },
      // Feet
      {
        bones: ['mixamorig:LeftFoot', 'mixamorig:RightFoot'],
        depth: 0.1,
        size: 0.1,
        width: 0.2,
        rotationAxis: Axis.Y,
        min: -1,
        max: 1,
        boxOffset: 0.05,
        boneOffsetAxis: Axis.Y,
      },
    ];

    const COL_RAGDOLL = 0x0004;
    const COL_ENVIRONMENT = 0x0001;

    this.ragdoll = new Ragdoll(skeleton, armatureNode, config);

    for (const agg of this.ragdoll.getAggregates()) {
      if (agg.shape) {
        agg.shape.filterMembershipMask = COL_RAGDOLL;
        agg.shape.filterCollideMask = COL_ENVIRONMENT;
      }
    }
    console.log('Ragdoll initialized');
  }

  /**
   * ===== GAME STATE CONTROL =====
   * Métodos para pausar/reanudar el input y movimiento del jugador
   */
  public setGameManager(gameManager: GameManager) {
    this.gameManager = gameManager;
  }

  public enableInput() {
    this.inputEnabled = true;
  }

  public detachControl() {
    this.inputEnabled = false;
    // Limpiar inputs activos
    this.inputMap = {};
    this.isDashing = false;
  }
}
