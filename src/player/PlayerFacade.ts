import type { Mesh, Quaternion, Skeleton, Vector3 } from '@babylonjs/core';
import type { PlayerAnimationRegistry } from './PlayerAnimations.ts';
import type { PlayerController } from './PlayerController.ts';

export interface PlayerGameOverHandler {
  gameOver(): void;
}

export interface PlayerInputControllerApi {
  pauseInput(): void;
  resumeInput(): void;
}

export interface PlayerCombatTargetApi {
  takeDamage(amount: number, damageSourcePosition?: Vector3 | null): void;
  getCollisionMesh(): Mesh;
  getWorldPosition(): Vector3;
}

export interface PlayerTuningConfig {
  moveSpeed?: number;
  jumpForce?: number;
  dashSpeed?: number;
  magnetismRange?: number;
  coyoteTime?: number;
}

export interface PlayerSetupApi {
  configureTuning(config: PlayerTuningConfig): void;
  connectGameOverHandler(handler: PlayerGameOverHandler | null): void;
  initializeRagdoll(skeleton: Skeleton, armatureNode: Mesh): void;
}

export interface PlayerDebugAnimationHandlerApi {
  play(animationName: string, options?: { loop?: boolean }): void;
  setBlendDuration(value: number): void;
}

export interface PlayerDebugApi {
  moveSpeed: number;
  jumpForce: number;
  dashSpeed: number;
  targetAngle: number;
  targetRotation: Quaternion;
  currentHealth: number;
  maxHealth: number;
  isInvulnerable: boolean;
  mesh: Mesh & { animationModels?: PlayerAnimationRegistry };
  animationHandler?: PlayerDebugAnimationHandlerApi;
}

export interface PlayerFacade {
  readonly input: PlayerInputControllerApi;
  readonly setup: PlayerSetupApi;
  readonly debug: PlayerDebugApi;
}

export function createPlayerFacade(
  playerController: PlayerController,
): PlayerFacade {
  return {
    input: createPlayerInputControllerApi(playerController),
    setup: createPlayerSetupApi(playerController),
    debug: createPlayerDebugApi(playerController),
  };
}

function createPlayerInputControllerApi(
  playerController: PlayerController,
): PlayerInputControllerApi {
  return {
    pauseInput() {
      playerController.pauseInput();
    },
    resumeInput() {
      playerController.resumeInput();
    },
  };
}

function createPlayerSetupApi(
  playerController: PlayerController,
): PlayerSetupApi {
  return {
    configureTuning(config: PlayerTuningConfig) {
      playerController.configureTuning(config);
    },
    connectGameOverHandler(handler: PlayerGameOverHandler | null) {
      playerController.connectGameOverHandler(handler);
    },
    initializeRagdoll(skeleton: Skeleton, armatureNode: Mesh) {
      playerController.initializeRagdoll(skeleton, armatureNode);
    },
  };
}

function createPlayerDebugApi(
  playerController: PlayerController,
): PlayerDebugApi {
  return {
    get moveSpeed() {
      return playerController.moveSpeed;
    },
    set moveSpeed(value: number) {
      playerController.moveSpeed = value;
      playerController.normalMoveSpeed = value;
    },
    get jumpForce() {
      return playerController.jumpForce;
    },
    set jumpForce(value: number) {
      playerController.jumpForce = value;
    },
    get dashSpeed() {
      return playerController.dashSpeed;
    },
    set dashSpeed(value: number) {
      playerController.dashSpeed = value;
    },
    get targetAngle() {
      return playerController.targetAngle;
    },
    set targetAngle(value: number) {
      playerController.targetAngle = value;
    },
    get targetRotation() {
      return playerController.targetRotation;
    },
    set targetRotation(value: Quaternion) {
      playerController.targetRotation = value;
    },
    get currentHealth() {
      return playerController.currentHealth;
    },
    set currentHealth(value: number) {
      playerController.currentHealth = value;
    },
    get maxHealth() {
      return playerController.maxHealth;
    },
    set maxHealth(value: number) {
      playerController.maxHealth = value;
    },
    get isInvulnerable() {
      return playerController.isInvulnerable;
    },
    set isInvulnerable(value: boolean) {
      playerController.isInvulnerable = value;
    },
    get mesh() {
      return playerController.mesh as Mesh & {
        animationModels?: PlayerAnimationRegistry;
      };
    },
    get animationHandler() {
      return {
        play(animationName: string, options?: { loop?: boolean }) {
          playerController.playSmoothAnimation(
            animationName,
            options?.loop ?? true,
            true,
          );
        },
        setBlendDuration(value: number) {
          playerController.blendingSpeed = value;
          playerController.animationGroups.forEach((animationGroup) => {
            animationGroup.blendingSpeed = value;
          });
        },
      };
    },
  };
}
