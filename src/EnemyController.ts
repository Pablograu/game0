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
} from '@babylonjs/core';

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
  modelScale: 2,
  patrolSpeed: 2,
  stunDuration: 0.5,
  visionRange: 8,
};

export class EnemyController {
  // ===== REFERENCES =====
  scene: Scene;
  physicsEngine: any;
  root: TransformNode; // Root del modelo instanciado
  meshes: AbstractMesh[]; // Todos los meshes del modelo
  physicsCapsule: Mesh; // Cápsula invisible para física
  body: any; // PhysicsBody de la cápsula
  physicsAggregate: PhysicsAggregate | null = null;
  playerRef: any; // Referencia al PlayerController

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

  // ===== DEBUG =====
  visionCircle: Mesh | null = null;

  // ===== UPDATE OBSERVER =====
  private _updateObserver: any = null;
  private _alive: boolean = true;

  // ===== COMPAT: WeaponSystem usa enemy.mesh =====
  get mesh(): Mesh {
    return this.physicsCapsule;
  }

  constructor(
    root: TransformNode,
    meshes: AbstractMesh[],
    animationGroups: AnimationGroup[],
    scene: Scene,
    config: EnemyConfig = {},
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
    this.physicsCapsule = this.createPhysicsCapsule();
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
      this.setupDebugVisuals();
    }

    // Empezar animación
    this.playAnimation('walking', true);

    // Update loop
    this._updateObserver = this.scene.onBeforeRenderObservable.add(() => {
      this.update();
    });

    // Metadata para detección de golpes
    this.physicsCapsule.metadata = { type: 'enemy', instance: this };
    for (const m of this.meshes) {
      m.metadata = { type: 'enemy', instance: this };
    }

    console.log('[EnemyController] Creado con estado PATROL');
  }

  // ==========================================================
  //  PHYSICS CAPSULE
  // ==========================================================
  private createPhysicsCapsule(): Mesh {
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
  private update() {
    if (!this._alive || !this.body) return;
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
    this.updateDistanceToPlayer();

    // Colisión por contacto
    this.checkPlayerCollision();

    // Bloquear rotación angular
    this.body.setAngularVelocity(Vector3.Zero());

    // Smooth rotation
    this.updateSmoothRotation(dt);

    // Stuck detection (solo en PATROL y CHASE)
    if (
      this.currentState === EnemyState.PATROL ||
      this.currentState === EnemyState.CHASE
    ) {
      this.updateStuckDetection(dt);
    }

    // ===== STATE MACHINE =====
    switch (this.currentState) {
      case EnemyState.PATROL:
        this.statePatrol(dt);
        break;
      case EnemyState.CHASE:
        this.stateChase(dt);
        break;
      case EnemyState.ATTACK:
        this.stateAttack(dt);
        break;
      case EnemyState.HIT:
        this.stateHit(dt);
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
    console.log('<<< state>>>', state);
    switch (state) {
      case EnemyState.PATROL:
        this.pickNewPatrolTarget();
        this.playAnimation('walking', true);
        break;

      case EnemyState.CHASE:
        this.playAnimation('running', true);
        break;

      case EnemyState.ATTACK:
        this.isAttackAnimPlaying = true;
        this.stop();
        this.playAnimation('attack', false, 1.2);

        // Callback cuando termina la animación de ataque
        const attackAg = this.animations.get('attack');
        if (attackAg) {
          attackAg.onAnimationGroupEndObservable.clear();
          attackAg.onAnimationGroupEndObservable.addOnce(() => {
            this.isAttackAnimPlaying = false;
            this.attackCooldownTimer = this.config.attackCooldown;

            // Decidir siguiente estado
            if (
              this.distanceToPlayer <= this.config.attackRange &&
              this.attackCooldownTimer <= 0
            ) {
              // Atacar de nuevo inmediatamente (raro, por si el cooldown es 0)
              this.changeState(EnemyState.ATTACK);
            } else {
              this.changeState(EnemyState.CHASE);
            }
          });
        }
        break;

      case EnemyState.HIT:
        this.stunTimer = this.config.stunDuration;
        this.stop();
        this.playAnimation('hit', false);
        break;

      case EnemyState.DEAD:
        this.onDead();
        break;
    }
  }

  // ==========================================================
  //  STATE: PATROL
  // ==========================================================
  private statePatrol(_dt: number) {
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
    this.moveInDirection(dir, this.config.patrolSpeed);
    this.faceDirection(dir);
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
  private stateChase(_dt: number) {
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
      this.moveInDirection(dir, this.config.chaseSpeed);
      this.faceDirection(dir);
    }
  }

  // ==========================================================
  //  STATE: ATTACK
  // ==========================================================
  private stateAttack(_dt: number) {
    // Mantenerse quieto mientras ataca, la animación callback resuelve
    this.stop();
  }

  // ==========================================================
  //  STATE: HIT
  // ==========================================================
  private stateHit(dt: number) {
    this.stunTimer -= dt;
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
  private onDead() {
    this._alive = false;

    // 1. Limpiar TODOS los observables de animación PRIMERO para evitar que
    //    callbacks de estados anteriores (ATTACK, HIT) disparen transiciones.
    for (const ag of this.animations.values()) {
      ag.onAnimationGroupEndObservable.clear();
      ag.stop();
    }

    // 2. Detener movimiento (body todavía válido aquí)
    if (this.body) {
      this.body.setLinearVelocity(Vector3.Zero());
      this.body.setAngularVelocity(Vector3.Zero());
    }

    // 3. Reproducir 'falling' directamente, SIN pasar por playAnimation,
    //    para evitar que se llame a prevAg.stop() (que dispara observables)
    //    y evitar el sistema de blending.
    let fallingAg = this.animations.get('falling');
    if (!fallingAg) {
      // Búsqueda parcial de fallback
      for (const [key, value] of this.animations) {
        if (
          key.includes('fall') ||
          key.includes('dying') ||
          key.includes('death')
        ) {
          fallingAg = value;
          break;
        }
      }
    }
    if (fallingAg) {
      fallingAg.loopAnimation = false;
      fallingAg.start(false, 1.0, fallingAg.from, fallingAg.to, false);
      this.currentAnimName = fallingAg.name.toLowerCase();
    }

    // 4. Desactivar física y colisiones
    if (this.physicsAggregate) {
      this.physicsAggregate.dispose();
      this.physicsAggregate = null;
    }
    this.physicsCapsule.checkCollisions = false;
    for (const m of this.meshes) {
      m.checkCollisions = false;
      m.isPickable = false;
    }

    // 5. Limpiar debug
    if (this.visionCircle) {
      this.visionCircle.dispose();
      this.visionCircle = null;
    }

    // 6. Eliminar update observer
    if (this._updateObserver) {
      this.scene.onBeforeRenderObservable.remove(this._updateObserver);
      this._updateObserver = null;
    }

    // 7. Calcular duración real de la animación falling (frames / fps)
    //    y programar dispose con un timer simple (sin tocar materiales,
    //    que son compartidos entre instancias).
    let waitSeconds = 3.0; // fallback si no hay animación
    if (fallingAg) {
      // Las animaciones GLB corren a 60fps por defecto
      const frames = fallingAg.to - fallingAg.from;
      waitSeconds = frames / 60 + 2.0; // duración + 2 s en el suelo
    }
    this._scheduleDispose(waitSeconds);

    console.log(
      `[EnemyController] DEAD — dispose en ${waitSeconds.toFixed(1)}s`,
    );
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
  private moveInDirection(dir: Vector3, speed: number) {
    const currentVel = this.body.getLinearVelocity();
    this.body.setLinearVelocity(
      new Vector3(dir.x * speed, currentVel.y, dir.z * speed),
    );
  }

  private stop() {
    const currentVel = this.body.getLinearVelocity();
    this.body.setLinearVelocity(new Vector3(0, currentVel.y, 0));
  }

  private faceDirection(dir: Vector3) {
    this._targetYAngle = Math.atan2(dir.x, dir.z);
  }

  private updateSmoothRotation(dt: number) {
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

  private updateStuckDetection(dt: number) {
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
        this.dodgeObstacle();
      }
    }
  }

  private dodgeObstacle() {
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
    this.moveInDirection(dodge, this.config.chaseSpeed);
    this.faceDirection(dodge);
  }

  // ==========================================================
  //  DISTANCE & COLLISION
  // ==========================================================
  private updateDistanceToPlayer() {
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

  private checkPlayerCollision() {
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
      const kb = knockbackDirection
        .normalize()
        .scale(this.config.knockbackForce);
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

  setVisionRange(range: number) {
    this.config.visionRange = range;
    if (this.visionCircle) {
      this.visionCircle.dispose();
      this.visionCircle = null;
    }
    if (this.config.debug) {
      this.setupDebugVisuals();
    }
  }

  setDebugMode(enabled: boolean) {
    this.config.debug = enabled;
    if (enabled && !this.visionCircle) {
      this.setupDebugVisuals();
    } else if (!enabled && this.visionCircle) {
      this.visionCircle.dispose();
      this.visionCircle = null;
    }
  }

  // ==========================================================
  //  DEBUG
  // ==========================================================
  private setupDebugVisuals() {
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

    if (this.physicsAggregate) {
      this.physicsAggregate.dispose();
    }

    this.physicsCapsule.dispose();
    this.root.dispose();

    console.log('[EnemyController] Disposed');
  }
}
