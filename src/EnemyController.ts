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
} from '@babylonjs/core';
import { HitboxSystem } from './HitboxSystem';
import { RagdollSystem } from './RagdollSystem';

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

  // ===== RAGDOLL SYSTEM =====
  private _ragdoll: RagdollSystem | null = null;

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

    // ===== INIT RAGDOLL =====
    this._initRagdoll();

    console.log('[EnemyController] Creado con estado PATROL');
  }

  // ==========================================================
  //  PHYSICS CAPSULE
  // ==========================================================
  private _createPhysicsCapsule(): Mesh {
    const capsule = MeshBuilder.CreateCapsule(
      'enemyCapsule',
      { height: 2, radius: 0.5 },
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

    return capsule;
  }

  // ==========================================================
  //  DEBUG VISUALS
  // ==========================================================
  private _setupDebugVisuals() {
    // Círculo de visión
    this.visionCircle = MeshBuilder.CreateTorus(
      'visionCircle',
      {
        diameter: this.config.visionRange * 2,
        thickness: 0.05,
        tessellation: 48,
      },
      this.scene,
    );
    this.visionCircle.parent = this.physicsCapsule;
    this.visionCircle.position.y = 0.05;
    const mat = new StandardMaterial('visionMat', this.scene);
    mat.emissiveColor = new Color3(1, 1, 0);
    mat.disableLighting = true;
    mat.alpha = 0.3;
    this.visionCircle.material = mat;
  }

  // ==========================================================
  //  RAGDOLL INIT
  // ==========================================================
  private _initRagdoll() {
    // Find skeleton AND the skinned mesh that owns it
    let skeleton: any = null;
    let skinnedMesh: AbstractMesh | null = null;
    for (const m of this.meshes) {
      if ((m as any).skeleton) {
        skeleton = (m as any).skeleton;
        skinnedMesh = m;
        break;
      }
    }
    if (!skeleton || !skinnedMesh) {
      console.warn('[EnemyController] No skeleton found, ragdoll disabled');
      return;
    }

    this._ragdoll = new RagdollSystem(this.root, this.scene, {
      modelScale: this.config.modelScale,
      debug: this.config.debug,
    });
    this._ragdoll.init(skeleton, skinnedMesh);
    console.log('[EnemyController] Ragdoll initialized');
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
        this._statePatrol();
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
        this.playAnimation('running', true);
        break;

      case EnemyState.ATTACK: {
        this._hasHitPlayerThisAttack = false;
        this.isAttackAnimPlaying = true;
        this._attackStartTime = performance.now() / 1000; // Guardar tiempo inicial
        this._stop();
        this.playAnimation('attack', false, 1.2);

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
      }

      case EnemyState.HIT:
        this.stunTimer = this.config.stunDuration;
        this._stop();
        this.playAnimation('hit', false);
        break;

      case EnemyState.DEAD:
        this._onDead();
        break;
    }
  }

  // ==========================================================
  //  DISTANCE / COLLISION HELPERS
  // ==========================================================
  private _updateDistanceToPlayer() {
    if (!this.playerRef?.mesh) {
      this.distanceToPlayer = Infinity;
      return;
    }
    const playerPos = this.playerRef.mesh.getAbsolutePosition();
    const pos = this.physicsCapsule.position;
    this.distanceToPlayer = Vector3.Distance(
      new Vector3(pos.x, 0, pos.z),
      new Vector3(playerPos.x, 0, playerPos.z),
    );
  }

  private _checkPlayerCollision() {
    if (!this.playerRef || !this.canDamagePlayer) return;
    if (this.distanceToPlayer > 1.5) return;

    this.canDamagePlayer = false;
    this.damageCooldownTimer = this.damageCooldown;

    const enemyPos = this.physicsCapsule.position;
    this.playerRef.takeDamage(this.config.contactDamage, enemyPos);
  }

  // ==========================================================
  //  MOVEMENT HELPERS
  // ==========================================================
  private _stop() {
    if (!this.body) return;
    const vel = this.body.getLinearVelocity();
    this.body.setLinearVelocity(new Vector3(0, vel.y, 0));
  }

  private _moveInDirection(dir: Vector3, speed: number) {
    if (!this.body) return;
    const vel = this.body.getLinearVelocity();
    this.body.setLinearVelocity(
      new Vector3(dir.x * speed, vel.y, dir.z * speed),
    );
  }

  private _faceDirection(dir: Vector3) {
    this._targetYAngle = Math.atan2(dir.x, dir.z);
  }

  // ==========================================================
  //  SMOOTH ROTATION
  // ==========================================================
  private _updateSmoothRotation(dt: number) {
    if (!this.root.rotationQuaternion) return;

    const targetQuat = Quaternion.FromEulerAngles(0, this._targetYAngle, 0);
    Quaternion.SlerpToRef(
      this.root.rotationQuaternion,
      targetQuat,
      Math.min(1, this._rotationSpeed * dt),
      this.root.rotationQuaternion,
    );
  }

  // ==========================================================
  //  STUCK DETECTION
  // ==========================================================
  private _updateStuckDetection(dt: number) {
    const pos = this.physicsCapsule.position;
    const distMoved = Vector3.Distance(pos, this._lastPosition);

    if (distMoved < this._stuckDistMin) {
      this._stuckTimer += dt;
      if (this._stuckTimer >= this._stuckThreshold) {
        // Enemy is stuck — pick new patrol target
        this._stuckTimer = 0;
        this.pickNewPatrolTarget();
      }
    } else {
      this._stuckTimer = 0;
    }

    this._lastPosition = pos.clone();
  }

  // ==========================================================
  //  PUBLIC API
  // ==========================================================
  public setPlayerRef(playerController: any) {
    this.playerRef = playerController;
  }

  public takeDamage(amount: number, sourcePosition: Vector3) {
    if (!this._alive) return;

    this.hp -= amount;
    console.log(`[EnemyController] HP: ${this.hp}/${this.maxHP}`);

    // Knockback
    if (this.body && sourcePosition) {
      const pos = this.physicsCapsule.position;
      const knockDir = pos.subtract(sourcePosition);
      knockDir.y = 0;
      knockDir.normalize();
      const force = knockDir.scale(this.config.knockbackForce);
      this.body.setLinearVelocity(
        new Vector3(force.x, this.body.getLinearVelocity().y + 2, force.z),
      );
    }

    // Transition to HIT or DEAD
    if (this.hp <= 0) {
      this.hp = 0;
      this.changeState(EnemyState.DEAD);
    } else {
      this.changeState(EnemyState.HIT);
    }
  }

  // ==========================================================
  //  DEBUG GUI SUPPORT (getters/setters & methods)
  // ==========================================================
  get patrolSpeed(): number {
    return this.config.patrolSpeed;
  }
  set patrolSpeed(value: number) {
    this.config.patrolSpeed = value;
  }

  get chaseSpeed(): number {
    return this.config.chaseSpeed;
  }
  set chaseSpeed(value: number) {
    this.config.chaseSpeed = value;
  }

  get visionRange(): number {
    return this.config.visionRange;
  }
  set visionRange(value: number) {
    this.config.visionRange = value;
    this.setVisionRange(value);
  }

  get debugMode(): boolean {
    return this.config.debug;
  }
  set debugMode(value: boolean) {
    this.config.debug = value;
    this.setDebugMode(value);
  }

  public setVisionRange(value: number) {
    this.config.visionRange = value;
    // Update vision circle if it exists
    if (this.visionCircle) {
      this.visionCircle.dispose();
      this.visionCircle = null;
      if (this.config.debug) {
        this._setupDebugVisuals();
      }
    }
  }

  public setDebugMode(value: boolean) {
    this.config.debug = value;
    if (value && !this.visionCircle) {
      this._setupDebugVisuals();
    } else if (!value && this.visionCircle) {
      this.visionCircle.dispose();
      this.visionCircle = null;
    }
  }

  // ==========================================================
  //  STATE: PATROL
  // ==========================================================
  private _statePatrol() {
    // Detectar jugador → CHASE
    if (this.distanceToPlayer < this.config.visionRange) {
      this.changeState(EnemyState.CHASE);
      return;
    }

    // Moverse hacia el patrol 
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
  //  STATE: DEAD (REPLACE ENTIRE METHOD)
  // ==========================================================
  private _onDead() {
    this._alive = false;

    // 1. Freeze current animation pose and clear callbacks
    for (const ag of this.animations.values()) {
      ag.onAnimationGroupEndObservable.clear();
      if (ag.isPlaying) {
        ag.pause(); // Freeze at current frame (stop() resets to bind pose)
      }
    }

    // 2. Get knockback velocity BEFORE disabling the capsule
    let knockbackVelocity = Vector3.Zero();
    if (this.body) {
      knockbackVelocity = this.body.getLinearVelocity().clone();
    }

    // 3. Capture capsule world position BEFORE disposing it
    const capsuleWorldPos = this.physicsCapsule.getAbsolutePosition().clone();

    // 4. Dispose the movement capsule physics (root is still parented to it)
    this.physicsCapsule.isVisible = false;
    this.physicsCapsule.checkCollisions = false;
    if (this.physicsAggregate) {
      this.physicsAggregate.dispose();
      this.physicsAggregate = null;
      this.body = null;
    }

    // 5. Activate ragdoll — this will re-parent root from capsule to ragdoll body
    //    Pass the capsule world position so the ragdoll spawns exactly where the enemy was
    if (this._ragdoll) {
      this._ragdoll.enable(knockbackVelocity, capsuleWorldPos, this.config.modelOffsetY);
    }

    // 6. Disable collisions on visual meshes
    for (const m of this.meshes) {
      m.checkCollisions = false;
      m.isPickable = false;
    }

    // 7. Disable attack hitbox
    if (this._attackHitboxSystem) {
      this._attackHitboxSystem.setEnabled(false);
    }

    // 8. Clean up debug visuals
    if (this.visionCircle) {
      this.visionCircle.dispose();
      this.visionCircle = null;
    }

    // 9. Remove AI update observer
    if (this._updateObserver) {
      this.scene.onBeforeRenderObservable.remove(this._updateObserver);
      this._updateObserver = null;
    }

    // 10. Fade out and dispose after 4 seconds
    this._scheduleFadeAndDispose(4.0);

    console.log('[EnemyController] DEAD — ragdoll activated');
  }

  /**
   * Fade out meshes over time, then dispose everything.
   */
  private _scheduleFadeAndDispose(totalSeconds: number) {
    const fadeStartTime = totalSeconds * 0.6; // Start fading at 60% of total time
    let elapsed = 0;

    const observer = this.scene.onBeforeRenderObservable.add(() => {
      elapsed += this.scene.getEngine().getDeltaTime() / 1000;

      // Fade out meshes during the last portion
      if (elapsed >= fadeStartTime) {
        const fadeProgress =
          (elapsed - fadeStartTime) / (totalSeconds - fadeStartTime);
        const alpha = Math.max(0, 1 - fadeProgress);

        for (const m of this.meshes) {
          m.visibility = alpha;
        }
      }

      // Final dispose
      if (elapsed >= totalSeconds) {
        this.scene.onBeforeRenderObservable.remove(observer);

        for (const m of this.meshes) {
          m.isVisible = false;
        }

        this.root.setEnabled(false);
        this.dispose();
      }
    });
  }

  // ==========================================================
  //  DISPOSE (UPDATED)
  // ==========================================================
  dispose() {
    this._alive = false;

    if (this._updateObserver) {
      this.scene.onBeforeRenderObservable.remove(this._updateObserver);
      this._updateObserver = null;
    }

    // Stop all animations
    for (const ag of this.animations.values()) {
      ag.stop();
    }

    // Dispose ragdoll
    if (this._ragdoll) {
      this._ragdoll.dispose();
      this._ragdoll = null;
    }

    // Dispose attack hitbox
    if (this._attackHitboxSystem) {
      this._attackHitboxSystem.dispose();
      this._attackHitboxSystem = null;
    }

    if (this.visionCircle) {
      this.visionCircle.dispose();
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
