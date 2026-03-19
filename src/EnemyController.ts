import {
  Vector3,
  Quaternion,
  Color3,
  PhysicsAggregate,
  PhysicsShapeType,
  PhysicsRaycastResult,
  MeshBuilder,
  StandardMaterial,
  AnimationGroup,
  Mesh,
  AbstractMesh,
  Scene,
  TransformNode,
  Matrix,
  Axis,
} from '@babylonjs/core';
import { HitboxSystem } from './HitboxSystem';
import { AudioManager } from './AudioManager.ts';
import { Ragdoll } from './ragdoll_copy.js';

// ===== ESTADOS DE IA =====
export enum EnemyState {
  PATROL = 'PATROL',
  CHASE = 'CHASE',
  ATTACK = 'ATTACK',
  HIT = 'HIT',
  DEAD = 'DEAD',
}

// ===== CONFIGURACIÓN =====
export interface EnemyConfig {
  attackCooldown?: number;
  attackRange?: number;
  chaseGiveUpRange?: number;
  chaseSpeed?: number;
  contactDamage?: number;
  debug?: boolean;
  hp?: number;
  knockbackForce?: number;
  mass?: number;
  modelOffsetY?: number;
  modelScale?: number;
  patrolSpeed?: number;
  stunDuration?: number;
  visionRange?: number;
}

const DEFAULT_CONFIG: Required<EnemyConfig> = {
  attackCooldown: 1.5,
  attackRange: 2,
  chaseGiveUpRange: 14,
  chaseSpeed: 5,
  contactDamage: 1,
  debug: false,
  hp: 3,
  knockbackForce: 15,
  mass: 2,
  modelOffsetY: -1,
  modelScale: 1.6,
  patrolSpeed: 2,
  stunDuration: 0.5,
  visionRange: 8,
};

export class EnemyController {
  // ===== REFERENCES =====
  body: any; // PhysicsBody de la cápsula
  meshes: AbstractMesh[]; // Todos los meshes del modelo
  physicsAggregate: PhysicsAggregate | null = null;
  physicsCapsule: Mesh; // Cápsula invisible para física
  physicsEngine: any;
  playerRef: any; // Referencia al PlayerController
  root: TransformNode; // Root del modelo instanciado
  scene: Scene;

  // ===== ANIMATION GROUPS =====
  animations: Map<string, AnimationGroup> = new Map();
  currentAnimName: string = '';

  // ===== STATE MACHINE =====
  currentState: EnemyState = EnemyState.PATROL;
  previousState: EnemyState = EnemyState.PATROL;

  // ===== STATS =====
  maxHP: number;
  hp: number;
  config: Required<EnemyConfig>;

  // ===== PATROL =====
  patrolTarget: Vector3 = Vector3.Zero();
  patrolWaitTimer: number = 0;
  patrolRadius: number = 6;

  // ===== CHASE =====
  distanceToPlayer: number = Infinity;

  // ===== ATTACK =====
  attackCooldownTimer: number = 0;
  isAttackAnimPlaying: boolean = false;

  // ===== HIT =====
  stunTimer: number = 0;

  // ===== CONTACT DAMAGE =====
  canDamagePlayer: boolean = true;
  damageCooldownTimer: number = 0;
  damageCooldown: number = 0.8;

  // ===== PHYSICS RAYCAST =====
  edgeRayResult: PhysicsRaycastResult = new PhysicsRaycastResult();
  wallRayResult: PhysicsRaycastResult = new PhysicsRaycastResult();

  // ===== STUCK / WALL DETECTION =====
  private _lastPosition: Vector3 = Vector3.Zero();
  private _stuckTimer: number = 0;
  private _stuckThreshold: number = 0.4; // segundos sin moverse para considerar atascado
  private _stuckDistMin: number = 0.05; // distancia mínima para considerar movimiento

  // ===== SMOOTH ROTATION =====
  private _targetYAngle: number = 0;
  private _rotationSpeed: number = 8; // velocidad de giro (rad/s factor)

  // ===== UPDATE OBSERVER =====
  private _updateObserver: any = null;
  private _alive: boolean = true;
  private _updateEnabled: boolean = true; // Para pausar/reanudar actualizaciones

  // ===== COMPAT: WeaponSystem usa enemy.mesh =====
  get mesh(): Mesh {
    return this.physicsCapsule;
  }

  // ===== ATTACK HITBOX =====
  private _attackHitboxSystem: HitboxSystem | null = null;
  private _hasHitPlayerThisAttack: boolean = false;
  // ===== ATTACK TIMING =====
  private _hitboxActivationTime: number = 1; // segundos desde inicio del ataque
  private _attackStartTime: number = 0;

  // ===== DEBUG =====
  visionCircle: Mesh | null = null;

  // ===== RAGDOLL =====
  ragdoll: any = null;
  lastKnockbackDir: Vector3 = Vector3.Zero();

  constructor(
    animationGroups: AnimationGroup[],
    config: EnemyConfig = {},
    meshes: AbstractMesh[],
    root: TransformNode,
    scene: Scene,
  ) {
    this.scene = scene;
    this.physicsEngine = scene.getPhysicsEngine();
    this.root = root;
    this.meshes = meshes;

    // Merge config con defaults
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.maxHP = this.config.hp;
    this.hp = this.maxHP;

    // Mapear animation groups por nombre (lowercase)
    for (const ag of animationGroups) {
      const name = ag.name.toLowerCase();
      this.animations.set(name, ag);
      ag.stop();
    }
    console.log('[EnemyController] Animaciones mapeadas:', [
      ...this.animations.keys(),
    ]);

    // Crear cápsula de física
    this.physicsCapsule = this._createPhysicsCapsule();
    this.body = this.physicsCapsule.physicsBody;

    // Parenting: modelo sigue a la cápsula
    this.root.parent = this.physicsCapsule;
    this.root.position = new Vector3(0, this.config.modelOffsetY, 0);

    // Escalar modelo
    const s = this.config.modelScale;
    this.root.scaling = new Vector3(s, s, s);

    // Forzar uso de rotationQuaternion (los GLB lo necesitan, rotation.y se ignora si hay quaternion)
    this.root.rotationQuaternion = Quaternion.Identity();
    this._lastPosition = this.physicsCapsule.position.clone();

    // Primer patrol target
    this.pickNewPatrolTarget();

    // Debug
    if (this.config.debug) {
      this._setupDebugVisuals();
    }

    // Empezar animación
    this.playAnimation('walking', true);

    // Update loop
    this._updateObserver = this.scene.onBeforeRenderObservable.add(() => {
      this._update();
    });

    // Metadata para detección de golpes
    this.physicsCapsule.metadata = { type: 'enemy', instance: this };
    for (const m of this.meshes) {
      m.metadata = { type: 'enemy', instance: this };
    }

    // Crear hitbox de ataque
    this._createAttackHitbox();

    console.log('[EnemyController] Creado con estado PATROL');
  }

  // ==========================================================
  //  PHYSICS CAPSULE
  // ==========================================================
  private _createPhysicsCapsule(): Mesh {
    const capsule = MeshBuilder.CreateCapsule(
      'enemyCapsule',
      { height: 2.5, radius: 0.5 },
      this.scene,
    );
    capsule.isVisible = false;
    // Usar root.position directamente (getAbsolutePosition puede ser 0,0,0 si la world matrix no se computó)
    capsule.position = this.root.position.clone();
    capsule.checkCollisions = true;

    this.physicsAggregate = new PhysicsAggregate(
      capsule,
      PhysicsShapeType.CAPSULE,
      {
        mass: this.config.mass,
        restitution: 0.1,
        friction: 0.8,
      },
      this.scene,
    );

    // Bloquear rotación
    capsule.physicsBody!.setMassProperties({
      mass: this.config.mass,
      inertia: new Vector3(0, 0, 0),
    });

    // ===== COLLISION FILTER =====
    // Membership: COL_ENEMY (0x0008)
    // Collide with: COL_ENVIRONMENT (0x0001) only.
    // Must NOT collide with COL_PLAYER (0x0002) — contact damage is handled by
    // intersectsMesh in _checkPlayerCollision(), not by physics. Allowing physics
    // collision with the player capsule causes the enemy to physically push/overlap
    // the player in unwanted ways.
    // Must NOT collide with COL_RAGDOLL (0x0004) — ragdoll ANIMATED bodies would
    // prop the capsule up at spawn height and prevent gravity from working.
    if (this.physicsAggregate.shape) {
      this.physicsAggregate.shape.filterMembershipMask = 0x0008; // COL_ENEMY
      this.physicsAggregate.shape.filterCollideMask = 0x0001; // COL_ENVIRONMENT only
    }

    return capsule;
  }

  // ==========================================================
  //  ANIMATION SYSTEM
  // ==========================================================
  playAnimation(name: string, loop: boolean, speed: number = 1.0) {
    // No reiniciar si ya se está reproduciendo
    if (this.currentAnimName === name) {
      const ag = this.animations.get(name);
      if (ag && ag.isPlaying) return;
    }

    // Detener la animación anterior con blending
    const prevAg = this.animations.get(this.currentAnimName);
    if (prevAg && prevAg.isPlaying) {
      prevAg.stop();
    }

    let ag = this.animations.get(name);

    // Si no se encontró exacta, buscar por coincidencia parcial (ej: 'walk' dentro de 'walking')
    if (!ag) {
      for (const [key, value] of this.animations) {
        if (key.includes(name) || name.includes(key)) {
          ag = value;
          console.log(
            `[EnemyController] Animación '${name}' → match parcial '${key}'`,
          );
          break;
        }
      }
    }

    if (!ag) {
      console.warn(
        `[EnemyController] Animación '${name}' no encontrada. Disponibles: [${[...this.animations.keys()].join(', ')}]`,
      );
      return;
    }

    // Configurar blending
    ag.enableBlending = true;
    ag.blendingSpeed = 4; // Transición rápida y suave

    ag.loopAnimation = loop;
    ag.start(loop, speed, ag.from, ag.to, false);

    this.currentAnimName = name;
  }

  // ==========================================================
  //  MAIN UPDATE
  // ==========================================================
  private _update() {
    if (!this._alive || !this.body || !this._updateEnabled) {
      return;
    }
    const dt = this.scene.getEngine().getDeltaTime() / 1000;

    // Cooldown de daño al jugador
    if (this.damageCooldownTimer > 0) {
      this.damageCooldownTimer -= dt;
      if (this.damageCooldownTimer <= 0) this.canDamagePlayer = true;
    }

    // Cooldown de ataque
    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= dt;
    }

    // Calcular distancia al jugador
    this._updateDistanceToPlayer();

    // Colisión por contacto
    this._checkPlayerCollision();

    // Bloquear rotación angular
    this.body.setAngularVelocity(Vector3.Zero());

    // Smooth rotation
    this._updateSmoothRotation(dt);

    // ===== SINCRONIZAR HITBOX CON ANIMACIÓN =====
    if (this.isAttackAnimPlaying && !this._attackHitboxSystem?.isEnabled()) {
      const elapsedTime = performance.now() / 1000 - this._attackStartTime;

      // Activar hitbox cuando llega al tiempo configurado
      if (elapsedTime >= this._hitboxActivationTime) {
        this._attackHitboxSystem?.setEnabled(true);
      }
    }

    // Actualizar posición del hitbox
    if (this._attackHitboxSystem?.isEnabled()) {
      this._updateAttackHitboxPosition();
      this._checkAttackHit();
    }

    // Stuck detection (solo en PATROL y CHASE)
    if (
      this.currentState === EnemyState.PATROL ||
      this.currentState === EnemyState.CHASE
    ) {
      this._updateStuckDetection(dt);
    }

    // ===== STATE MACHINE =====
    switch (this.currentState) {
      case EnemyState.PATROL:
        this._statePatrol(dt);
        break;
      case EnemyState.CHASE:
        this._stateChase();
        break;
      case EnemyState.ATTACK:
        this._stateAttack();
        break;
      case EnemyState.HIT:
        this._stateHit(dt);
        break;
      case EnemyState.DEAD:
        // No hacer nada, el update se limpiará
        break;
    }
  }

  // ==========================================================
  //  STATE TRANSITIONS
  // ==========================================================
  private changeState(newState: EnemyState) {
    if (this.currentState === newState) {
      return;
    }
    // No permitir transiciones una vez muerto
    if (this.currentState === EnemyState.DEAD) {
      return;
    }
    this.previousState = this.currentState;
    this.currentState = newState;
    console.log(`[EnemyController] ${this.previousState} → ${newState}`);
    this.onEnterState(newState);
  }

  private onEnterState(state: EnemyState) {
    switch (state) {
      case EnemyState.PATROL:
        this.pickNewPatrolTarget();
        this.playAnimation('walking', true);
        break;

      case EnemyState.CHASE:
        // Alert sound only on first detection (coming from PATROL)
        if (this.previousState === EnemyState.PATROL) {
          AudioManager.play('enemy_alert');
        }
        this.playAnimation('running', true);
        break;

      case EnemyState.ATTACK:
        this._hasHitPlayerThisAttack = false;
        this.isAttackAnimPlaying = true;
        this._attackStartTime = performance.now() / 1000; // Guardar tiempo inicial
        this._stop();
        this.playAnimation('attack', false, 1.2);
        AudioManager.play('enemy_attack');

        const attackAg = this.animations.get('attack');
        if (attackAg) {
          attackAg.onAnimationGroupEndObservable.clear();
          attackAg.onAnimationGroupEndObservable.addOnce(() => {
            this._attackHitboxSystem?.setEnabled(false);
            this.isAttackAnimPlaying = false;
            this.attackCooldownTimer = this.config.attackCooldown;

            if (
              this.distanceToPlayer <= this.config.attackRange &&
              this.attackCooldownTimer <= 0
            ) {
              this.changeState(EnemyState.ATTACK);
            } else {
              this.changeState(EnemyState.CHASE);
            }
          });
        }
        break;

      case EnemyState.HIT:
        this.stunTimer = this.config.stunDuration;
        this._stop();
        this.playAnimation('hit', false);
        AudioManager.play('enemy_hit');
        break;

      case EnemyState.DEAD:
        AudioManager.play('enemy_death');
        this._onDead();
        break;
    }
  }

  // ==========================================================
  //  STATE: PATROL
  // ==========================================================
  private _statePatrol(dt: number) {
    // Detectar jugador → CHASE
    if (this.distanceToPlayer < this.config.visionRange) {
      this.changeState(EnemyState.CHASE);
      return;
    }

    // Moverse hacia el patrol target
    const pos = this.physicsCapsule.position;
    const dir = this.patrolTarget.subtract(pos);
    dir.y = 0;
    const dist = dir.length();

    if (dist < 1.0) {
      // Llegó al target, elegir otro
      this.pickNewPatrolTarget();
      return;
    }

    dir.normalize();
    this._moveInDirection(dir, this.config.patrolSpeed);
    this._faceDirection(dir);
  }

  private pickNewPatrolTarget() {
    const pos = this.physicsCapsule.position;
    const angle = Math.random() * Math.PI * 2;
    const radius = 3 + Math.random() * this.patrolRadius;
    this.patrolTarget = new Vector3(
      pos.x + Math.cos(angle) * radius,
      pos.y,
      pos.z + Math.sin(angle) * radius,
    );
  }

  // ==========================================================
  //  STATE: CHASE
  // ==========================================================
  private _stateChase() {
    // Jugador fuera de rango → PATROL
    if (this.distanceToPlayer > this.config.chaseGiveUpRange) {
      this.changeState(EnemyState.PATROL);
      return;
    }

    // Jugador en rango de ataque y cooldown listo → ATTACK
    if (
      this.distanceToPlayer <= this.config.attackRange &&
      this.attackCooldownTimer <= 0
    ) {
      this.changeState(EnemyState.ATTACK);
      return;
    }

    // Perseguir al jugador
    if (!this.playerRef?.mesh) return;
    const playerPos = this.playerRef.mesh.getAbsolutePosition();
    const pos = this.physicsCapsule.position;
    const dir = new Vector3(playerPos.x - pos.x, 0, playerPos.z - pos.z);

    if (dir.length() > 0.1) {
      dir.normalize();
      this._moveInDirection(dir, this.config.chaseSpeed);
      this._faceDirection(dir);
    }
  }

  // ==========================================================
  //  STATE: ATTACK
  // ==========================================================
  private _stateAttack() {
    // Mantenerse quieto mientras ataca, la animación callback resuelve
    this._stop();
  }

  // ==========================================================
  //  ATTACK HITBOX SYSTEM
  // ==========================================================
  private _createAttackHitbox() {
    this._attackHitboxSystem = new HitboxSystem(
      `enemyAttackHitbox_${Math.random().toString(36).substr(2, 9)}`,
      new Vector3(1.5, 1.5, 1.5),
      this.scene,
      this.config.debug,
    );
  }

  private _updateAttackHitboxPosition() {
    if (!this._attackHitboxSystem || !this._attackHitboxSystem.isEnabled()) {
      return;
    }

    const pos = this.physicsCapsule.position;

    let forwardDir = new Vector3(0, 0, 1);
    if (this.root.rotationQuaternion) {
      const rotMatrix = new Matrix();
      this.root.rotationQuaternion.toRotationMatrix(rotMatrix);
      forwardDir = Vector3.TransformCoordinates(
        new Vector3(0, 0, 1),
        rotMatrix,
      );
    }

    this._attackHitboxSystem.setPosition(pos, 1.2, forwardDir);
    this._attackHitboxSystem.setRotation(this.root.rotationQuaternion);
  }

  private _checkAttackHit() {
    if (
      !this._attackHitboxSystem?.isEnabled() ||
      !this.playerRef ||
      this._hasHitPlayerThisAttack
    ) {
      return;
    }

    const playerMesh = this.playerRef.mesh;
    if (!playerMesh) {
      return;
    }

    // Detectar colisión hitbox ↔ jugador
    if (this._attackHitboxSystem.intersectsMesh(playerMesh, false)) {
      this._onHitPlayer();
    }
  }

  private _onHitPlayer() {
    if (!this.playerRef || this._hasHitPlayerThisAttack) return;

    this._hasHitPlayerThisAttack = true;

    console.log(`💥 [Enemy] Hit player! Damage: ${this.config.contactDamage}`);

    // Aplicar daño al jugador
    const enemyPos = this.physicsCapsule.position;
    this.playerRef.takeDamage(this.config.contactDamage, enemyPos);
  }

  // ==========================================================
  //  STATE: HIT
  // ==========================================================
  private _stateHit(dt: number) {
    this.stunTimer -= dt;
    this._stop();
    if (this.stunTimer <= 0) {
      // Salir de stun
      if (this.hp <= 0) {
        this.changeState(EnemyState.DEAD);
      } else {
        this.changeState(EnemyState.CHASE);
      }
    }
  }

  // ==========================================================
  //  STATE: DEAD
  // ==========================================================
  private _onDead() {
    this._alive = false;

    // 1. Stop all animations and clear callbacks to prevent state transitions
    for (const ag of this.animations.values()) {
      ag.onAnimationGroupEndObservable.clear();
      ag.stop();
    }

    // 2. Activate ragdoll if initialised, otherwise fall back to capsule topple
    if (this.ragdoll) {
      this.ragdoll.ragdoll();

      // Apply the knockback impulse to every bone body.
      // setTimeout(0) gives Havok one tick to register DYNAMIC motion type.
      const impulse = this.lastKnockbackDir.scale(this.config.knockbackForce * 1.5);
      const appPoint = this.physicsCapsule.getAbsolutePosition();
      setTimeout(() => {
        for (const agg of this.ragdoll.getAggregates()) {
          agg.body?.applyImpulse(impulse, appPoint);
        }
      }, 0);
    } else {
      // Fallback: unlock inertia and topple the capsule
      if (this.body) {
        const currentVel = this.body.getLinearVelocity();
        this.body.setMassProperties({
          mass: this.config.mass,
          inertia: new Vector3(0.4, 0.1, 0.4),
        });
        const toppleAxis = new Vector3(-currentVel.z, 0, currentVel.x);
        if (toppleAxis.length() > 0.01) toppleAxis.normalize();
        else toppleAxis.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        this.body.setAngularVelocity(toppleAxis.scale(6));
        this.body.applyImpulse(new Vector3(0, 20, 0), this.physicsCapsule.getAbsolutePosition());
      }
    }

    // 3. Disable collisions and pickability on visual meshes
    for (const m of this.meshes) {
      m.checkCollisions = false;
      m.isPickable = false;
    }

    // 4. Clean up debug visuals
    if (this.visionCircle) {
      this.visionCircle.dispose();
      this.visionCircle = null;
    }

    // 5. Remove AI update observer
    if (this._updateObserver) {
      this.scene.onBeforeRenderObservable.remove(this._updateObserver);
      this._updateObserver = null;
    }

    // 6. After settling, schedule visual dispose
    this._scheduleDispose(4.0);

    console.log('[EnemyController] DEAD — ragdoll activated');
  }

  // ==========================================================
  //  RAGDOLL
  // ==========================================================
  /**
   * Initialises the Ragdoll for this enemy.
   * Call once after the enemy is spawned (done automatically by EnemyFactory).
   * Uses the same Mixamo bone config as the PlayerController.
   * If ragdoll boxes appear mis-scaled, adjust armatureNode.scaling before calling.
   */
  initRagdoll(skeleton: any, armatureNode: any) {
    if (!skeleton || !armatureNode) {
      console.warn('[EnemyController] Ragdoll skipped: skeleton or armatureNode missing');
      return;
    }

    const config = [
      { bones: ['mixamorig7:Hips'], size: 0.45, boxOffset: 0.01 },
      {
        bones: ['mixamorig7:Spine2'],
        size: 0.4, height: 0.6, boxOffset: 0.05,
        boneOffsetAxis: Axis.Z, min: -1, max: 1, rotationAxis: Axis.Z,
      },
      {
        bones: ['mixamorig7:LeftArm', 'mixamorig7:RightArm'],
        depth: 0.1, size: 0.1, width: 0.5,
        rotationAxis: Axis.Y, boxOffset: 0.10, boneOffsetAxis: Axis.Y,
      },
      {
        bones: ['mixamorig7:LeftForeArm', 'mixamorig7:RightForeArm'],
        depth: 0.1, size: 0.1, width: 0.5,
        rotationAxis: Axis.Y, min: -1, max: 1, boxOffset: 0.12, boneOffsetAxis: Axis.Y,
      },
      {
        bones: ['mixamorig7:LeftUpLeg', 'mixamorig7:RightUpLeg'],
        depth: 0.1, size: 0.2, width: 0.08, height: 0.7,
        rotationAxis: Axis.Y, min: -1, max: 1, boxOffset: 0.2, boneOffsetAxis: Axis.Y,
      },
      {
        bones: ['mixamorig7:LeftLeg', 'mixamorig7:RightLeg'],
        depth: 0.08, size: 0.3, width: 0.1, height: 0.4,
        rotationAxis: Axis.Y, min: -1, max: 1, boxOffset: 0.2, boneOffsetAxis: Axis.Y,
      },
      {
        bones: ['mixamorig7:LeftHand', 'mixamorig7:RightHand'],
        depth: 0.2, size: 0.2, width: 0.2,
        rotationAxis: Axis.Y, min: -1, max: 1, boxOffset: 0.1, boneOffsetAxis: Axis.Y,
      },
      {
        bones: ['mixamorig7:Head'],
        size: 0.4, boxOffset: 0, boneOffsetAxis: Axis.Y,
        min: -1, max: 1, rotationAxis: Axis.Z,
      },
      {
        bones: ['mixamorig7:LeftFoot', 'mixamorig7:RightFoot'],
        depth: 0.1, size: 0.1, width: 0.2,
        rotationAxis: Axis.Y, min: -1, max: 1, boxOffset: 0.05, boneOffsetAxis: Axis.Y,
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

    console.log('[EnemyController] Ragdoll initialised');
  }

  /**
   * Programa el dispose del enemigo tras `seconds` segundos.
   * Oculta los meshes y destruye el objeto sin tocar materiales compartidos.
   */
  private _scheduleDispose(seconds: number) {
    let elapsed = 0;
    const observer = this.scene.onBeforeRenderObservable.add(() => {
      elapsed += this.scene.getEngine().getDeltaTime() / 1000;
      if (elapsed >= seconds) {
        this.scene.onBeforeRenderObservable.remove(observer);
        // Ocultar todos los meshes antes de dispose
        for (const m of this.meshes) {
          m.isVisible = false;
        }
        this.root.setEnabled(false);
        this.dispose();
      }
    });
  }

  // ==========================================================
  //  MOVEMENT HELPERS
  // ==========================================================
  private _moveInDirection(dir: Vector3, speed: number) {
    const currentVel = this.body.getLinearVelocity();
    this.body.setLinearVelocity(
      new Vector3(dir.x * speed, currentVel.y, dir.z * speed),
    );
  }

  private _stop() {
    const currentVel = this.body.getLinearVelocity();
    this.body.setLinearVelocity(new Vector3(0, currentVel.y, 0));
  }

  private _faceDirection(dir: Vector3) {
    this._targetYAngle = Math.atan2(dir.x, dir.z);
  }

  private _updateSmoothRotation(dt: number) {
    if (!this.root.rotationQuaternion) return;

    // Interpolar suavemente hacia el ángulo objetivo
    const targetQuat = Quaternion.FromEulerAngles(0, this._targetYAngle, 0);
    Quaternion.SlerpToRef(
      this.root.rotationQuaternion,
      targetQuat,
      Math.min(1, this._rotationSpeed * dt),
      this.root.rotationQuaternion,
    );
  }

  private _updateStuckDetection(dt: number) {
    const pos = this.physicsCapsule.position;
    const dx = pos.x - this._lastPosition.x;
    const dz = pos.z - this._lastPosition.z;
    const movedDist = Math.sqrt(dx * dx + dz * dz);

    if (movedDist < this._stuckDistMin) {
      this._stuckTimer += dt;
    } else {
      this._stuckTimer = 0;
    }

    this._lastPosition.copyFrom(pos);

    // Si está atascado, elegir nueva dirección
    if (this._stuckTimer >= this._stuckThreshold) {
      this._stuckTimer = 0;
      if (this.currentState === EnemyState.PATROL) {
        this.pickNewPatrolTarget();
      } else if (this.currentState === EnemyState.CHASE) {
        // Intentar rodear el obstáculo: moverse perpendicular al jugador
        this._dodgeObstacle();
      }
    }
  }

  private _dodgeObstacle() {
    if (!this.playerRef?.mesh) return;
    const playerPos = this.playerRef.mesh.getAbsolutePosition();
    const pos = this.physicsCapsule.position;
    const toPlayer = new Vector3(
      playerPos.x - pos.x,
      0,
      playerPos.z - pos.z,
    ).normalize();

    // Elegir lado aleatorio (perpendicular izquierda o derecha)
    const side = Math.random() > 0.5 ? 1 : -1;
    const dodge = new Vector3(-toPlayer.z * side, 0, toPlayer.x * side);

    // Moverse lateralmente brevemente
    this._moveInDirection(dodge, this.config.chaseSpeed);
    this._faceDirection(dodge);
  }

  // ==========================================================
  //  DISTANCE & COLLISION
  // ==========================================================
  private _updateDistanceToPlayer() {
    if (!this.playerRef?.mesh) {
      this.distanceToPlayer = Infinity;
      return;
    }
    const ep = this.physicsCapsule.position;
    const pp = this.playerRef.mesh.getAbsolutePosition();
    const dx = pp.x - ep.x;
    const dz = pp.z - ep.z;
    this.distanceToPlayer = Math.sqrt(dx * dx + dz * dz);
  }

  private _checkPlayerCollision() {
    if (!this.playerRef || !this.canDamagePlayer) return;
    if (
      this.currentState === EnemyState.DEAD ||
      this.currentState === EnemyState.HIT
    )
      return;

    const playerMesh = this.playerRef.mesh;
    if (!playerMesh) return;

    if (this.physicsCapsule.intersectsMesh(playerMesh, false)) {
      const myPos = this.physicsCapsule.getAbsolutePosition();
      this.playerRef.takeDamage(this.config.contactDamage, myPos);
      this.canDamagePlayer = false;
      this.damageCooldownTimer = this.damageCooldown;
    }
  }

  // ==========================================================
  //  PUBLIC API
  // ==========================================================

  /**
   * Aplica daño al enemigo. Entra en estado HIT con stun.
   */
  takeDamage(amount: number, knockbackDirection?: Vector3): boolean {
    if (!this._alive || this.currentState === EnemyState.DEAD) return false;

    this.hp -= amount;
    console.log(`[EnemyController] Hit! HP: ${this.hp}/${this.maxHP}`);

    // Knockback
    if (knockbackDirection && this.body) {
      this.lastKnockbackDir = knockbackDirection.normalize().clone();
      const kb = this.lastKnockbackDir.scale(this.config.knockbackForce);
      kb.y = this.config.knockbackForce * 0.3;
      this.body.applyImpulse(kb, this.physicsCapsule.getAbsolutePosition());
    }

    // Entrar en HIT (o DEAD si no queda vida)
    if (this.hp <= 0) {
      this.hp = 0;
      this.changeState(EnemyState.DEAD);
      return true; // murió
    }

    this.changeState(EnemyState.HIT);
    return false;
  }

  setPlayerRef(player: any) {
    this.playerRef = player;
  }

  isAlive(): boolean {
    return this._alive;
  }

  getState(): EnemyState {
    return this.currentState;
  }

  getPosition(): Vector3 {
    return this.physicsCapsule.position.clone();
  }

  setVisionRange(range: number) {
    this.config.visionRange = range;
    if (this.visionCircle) {
      this.visionCircle.dispose();
      this.visionCircle = null;
    }
    if (this.config.debug) {
      this._setupDebugVisuals();
    }
  }

  setDebugMode(enabled: boolean) {
    this.config.debug = enabled;
    if (enabled && !this.visionCircle) {
      this._setupDebugVisuals();
    } else if (!enabled && this.visionCircle) {
      this.visionCircle.dispose();
      this.visionCircle = null;
    }
  }

  // ==========================================================
  //  DEBUG
  // ==========================================================
  private _setupDebugVisuals() {
    this.visionCircle = MeshBuilder.CreateDisc(
      'visionRange',
      { radius: this.config.visionRange, tessellation: 32 },
      this.scene,
    );

    const mat = new StandardMaterial('visionMat', this.scene);
    mat.diffuseColor = new Color3(1, 1, 0);
    mat.alpha = 0.15;
    mat.backFaceCulling = false;
    this.visionCircle.material = mat;

    this.visionCircle.rotation.x = Math.PI / 2;
    this.visionCircle.position.y = 0.05;
    this.visionCircle.parent = this.physicsCapsule;
    this.visionCircle.isPickable = false;
    this.visionCircle.checkCollisions = false;
  }

  // ===== COMPAT: DebugGUI uses these directly =====
  get patrolSpeed() {
    return this.config.patrolSpeed;
  }
  set patrolSpeed(v: number) {
    this.config.patrolSpeed = v;
  }
  get chaseSpeed() {
    return this.config.chaseSpeed;
  }
  set chaseSpeed(v: number) {
    this.config.chaseSpeed = v;
  }
  get visionRange() {
    return this.config.visionRange;
  }
  set visionRange(v: number) {
    this.config.visionRange = v;
  }
  get debugMode() {
    return this.config.debug;
  }
  set debugMode(v: boolean) {
    this.config.debug = v;
  }

  // ==========================================================
  //  DISPOSE
  // ==========================================================
  dispose() {
    this._alive = false;

    if (this._updateObserver) {
      this.scene.onBeforeRenderObservable.remove(this._updateObserver);
      this._updateObserver = null;
    }

    // Detener todas las animaciones
    for (const ag of this.animations.values()) {
      ag.stop();
    }

    if (this.visionCircle) {
      this.visionCircle.dispose();
    }

    if (this.ragdoll) {
      this.ragdoll.dispose();
      this.ragdoll = null;
    }

    if (this.physicsAggregate) {
      this.physicsAggregate.dispose();
    }

    this.physicsCapsule.dispose();
    this.root.dispose();

    console.log('[EnemyController] Disposed');
  }

  /**
   * ===== GAME STATE CONTROL =====
   * Pausar/reanudar actualizaciones de IA sin detener el enemigo completamente
   */
  public enableUpdate() {
    this._updateEnabled = true;
  }

  public disableUpdate() {
    this._updateEnabled = false;
  }
}
