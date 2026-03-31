import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Matrix,
  Quaternion,
  Observer,
} from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { HitboxSystem } from './HitboxSystem';
import { AudioManager } from './AudioManager.ts';

export class WeaponSystem {
  attackCooldown: number;
  attackDuration: number;
  attackTimer: number;
  cameraShaker: any;
  cooldownTimer: number;
  damage: number;
  debugMode: boolean;
  enemies: any[];
  externalControlEnabled: boolean;
  hitboxOffset: number;
  hitboxSize: Vector3;
  hitboxSystem: HitboxSystem | null = null;
  hitEnemiesThisSwing: Set<any>;
  hitObjectsThisSwing: Set<any>;
  isAttacking: boolean;
  physicsEngine: any;
  player: any;
  playerBody: any;
  playerKnockback: number;
  playerMesh: any;
  scene: any;
  updateObserver: Observer<Scene> | null = null;

  constructor(playerController: any, scene: any, options: any = {}) {
    this.player = playerController;
    this.playerMesh = playerController.mesh;
    this.playerBody = playerController.body;
    this.scene = scene;

    // Configuración del ataque
    this.damage = options.damage || 1;
    this.attackDuration = options.attackDuration || 0.2;
    this.attackCooldown = options.attackCooldown || 0.4;
    this.hitboxSize = options.hitboxSize || new Vector3(1.5, 1, 1.5);
    this.hitboxOffset = options.hitboxOffset || 1.2;
    this.playerKnockback = options.playerKnockback || 3;

    // Estado
    this.isAttacking = false;
    this.attackTimer = 0;
    this.cooldownTimer = 0;
    this.hitEnemiesThisSwing = new Set();
    this.hitObjectsThisSwing = new Set();
    this.externalControlEnabled = false;

    // Lista de enemigos en la escena
    this.enemies = [];

    // Referencia al motor de física para raycast
    this.physicsEngine = scene.getPhysicsEngine();

    // CameraShaker (opcional)
    this.cameraShaker = options.cameraShaker || null;

    // Debug: mostrar hitbox
    this.debugMode = options.debug || false;

    this.createHitbox();
    this.setupUpdate();
  }

  createHitbox() {
    this.hitboxSystem = new HitboxSystem(
      'playerWeaponHitbox',
      this.hitboxSize,
      this.scene,
      this.debugMode,
    );
  }

  setupUpdate() {
    if (this.updateObserver) {
      return;
    }

    this.updateObserver = this.scene.onBeforeRenderObservable.add(() => {
      this.update();
    });
  }

  update() {
    if (this.externalControlEnabled) {
      return;
    }

    const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

    // Actualizar cooldown
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= deltaTime;
    }

    // ===== ACTUALIZAR POSICIÓN DEL HITBOX =====
    if (this.hitboxSystem?.isEnabled()) {
      this.updateHitboxPosition();
    }

    // Actualizar ataque activo
    if (this.isAttacking) {
      this.attackTimer -= deltaTime;

      // Detectar colisiones con enemigos
      this.checkHits();

      // Terminar ataque
      if (this.attackTimer <= 0) {
        this.endAttack();
      }
    }
  }

  /**
   * Actualiza la posición del hitbox frente al jugador
   */
  updateHitboxPosition() {
    const playerPos = this.playerMesh.getAbsolutePosition();

    // Obtener la rotación actual del jugador (targetRotation es la que se usa para rotar)
    const playerRotation =
      this.player?.targetRotation ||
      this.playerMesh.rotationQuaternion ||
      Quaternion.Identity();

    // Obtener dirección forward usando la rotación del jugador
    const rotMatrix = new Matrix();
    playerRotation.toRotationMatrix(rotMatrix);
    const forwardDirection = Vector3.TransformCoordinates(
      new Vector3(0, 0, 1),
      rotMatrix,
    );

    // Posicionar hitbox frente al jugador
    this.hitboxSystem?.setPosition(
      new Vector3(playerPos.x, playerPos.y + 1, playerPos.z),
      this.hitboxOffset,
      forwardDirection,
    );

    // Rotar hitbox igual que el jugador
    this.hitboxSystem?.setRotation(playerRotation);
  }

  checkHits() {
    // Iterar sobre todos los enemigos registrados
    for (const enemy of this.enemies) {
      if (!enemy || !enemy.mesh) continue;

      // Evitar golpear al mismo enemigo múltiples veces
      if (this.hitEnemiesThisSwing.has(enemy)) {
        continue;
      }

      // Detectar colisión
      if (this.hitboxSystem?.intersectsMesh(enemy.mesh, false)) {
        this.onHitEnemy(enemy);
      }
    }
  }

  // ===== ENEMY REGISTRATION =====
  /**
   * Registra un enemigo para que sea detectado por los ataques
   */
  registerEnemy(enemy: any) {
    if (!this.enemies.includes(enemy)) {
      this.enemies.push(enemy);
      console.log(`✅ Enemy registered: ${this.enemies.length} total`);
    }
  }

  enableExternalControl() {
    if (this.updateObserver) {
      this.scene.onBeforeRenderObservable.remove(this.updateObserver);
      this.updateObserver = null;
    }

    this.externalControlEnabled = true;
    this.endAttack();
  }

  disableExternalControl() {
    this.externalControlEnabled = false;
    this.setupUpdate();
  }

  onHitEnemy(enemy: any) {
    if (!enemy) return;

    this.hitEnemiesThisSwing.add(enemy);

    console.log(`💥 Hit enemy! Damage: ${this.damage}`);

    AudioManager.play('player_punch');

    // Aplicar daño
    if (enemy.takeDamage) {
      const playerPos = this.playerMesh.getAbsolutePosition();
      enemy.takeDamage(this.damage, playerPos);
    }

    // Camera shake feedback
    if (this.cameraShaker) {
      this.cameraShaker.shakeMedium();
    }
  }

  endAttack() {
    this.isAttacking = false;
    this.attackTimer = 0;
    this.hitboxSystem?.setEnabled(false);
    this.hitEnemiesThisSwing.clear();
    this.hitObjectsThisSwing.clear();

    console.log('⚔️ Attack ended');
  }

  // ===== MÉTODOS DE ACTIVACIÓN =====
  activateHitbox() {
    this.isAttacking = true;
    this.attackTimer = this.attackDuration;
    this.hitEnemiesThisSwing.clear();
    this.hitObjectsThisSwing.clear();
    this.hitboxSystem?.setEnabled(true);

    console.log('¡Hitbox activada!');
  }

  deactivateHitbox() {
    this.isAttacking = false;
    this.attackTimer = 0;
    this.hitboxSystem?.setEnabled(false);
  }

  setDebugMode(enabled: boolean) {
    this.debugMode = enabled;
    this.hitboxSystem?.setDebugMode(enabled);
  }

  dispose() {
    if (this.updateObserver) {
      this.scene.onBeforeRenderObservable.remove(this.updateObserver);
      this.updateObserver = null;
    }

    if (this.hitboxSystem) {
      this.hitboxSystem.dispose();
      this.hitboxSystem = null;
    }
  }

  // Getter de compatibilidad (por si algo accede a WeaponSystem.hitbox directamente)
  get hitbox() {
    return this.hitboxSystem?.getMesh() || null;
  }
}
