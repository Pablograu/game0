import type { Mesh, Quaternion, Skeleton, Vector3 } from '@babylonjs/core';
import type { ComponentType } from '../core/Component.ts';
import type { World } from '../core/World.ts';
import type { EntityId } from '../core/Entity.ts';
import {
  PlayerAnimationStateComponent,
  PlayerCombatStateComponent,
  PlayerControlStateComponent,
  PlayerGameplayConfigComponent,
  PlayerGroundingStateComponent,
  PlayerHealthStateComponent,
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerRagdollStateComponent,
  PlayerSurvivabilityRequestComponent,
} from './components/index.ts';
import type { PlayerAnimationRegistry } from './runtime/PlayerAnimations.ts';
import { createPlayerRagdoll } from './runtime/playerRuntime.ts';

export interface PlayerCombatTargetApi {
  takeDamage(amount: number, damageSourcePosition?: Vector3 | null): void;
  getCollisionMesh(): Mesh;
  getWorldPosition(): Vector3;
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

export function createPlayerDebugApi(
  world: World,
  entityId: EntityId,
): PlayerDebugApi {
  const getRequiredComponent = <T>(
    componentType: ComponentType<T>,
    name: string,
  ) => {
    const component = world.getComponent(entityId, componentType) as
      | T
      | undefined;

    if (!component) {
      throw new Error(`${name} is missing from player entity ${entityId}.`);
    }

    return component;
  };

  const getPhysicsRefs = () =>
    getRequiredComponent<PlayerPhysicsViewRefsComponent>(
      PlayerPhysicsViewRefsComponent,
      'PlayerPhysicsViewRefsComponent',
    );

  const getAnimation = () =>
    getRequiredComponent<PlayerAnimationStateComponent>(
      PlayerAnimationStateComponent,
      'PlayerAnimationStateComponent',
    );

  const getConfig = () =>
    getRequiredComponent<PlayerGameplayConfigComponent>(
      PlayerGameplayConfigComponent,
      'PlayerGameplayConfigComponent',
    );

  const getLocomotion = () =>
    getRequiredComponent<PlayerLocomotionStateComponent>(
      PlayerLocomotionStateComponent,
      'PlayerLocomotionStateComponent',
    );

  const getGrounding = () =>
    getRequiredComponent<PlayerGroundingStateComponent>(
      PlayerGroundingStateComponent,
      'PlayerGroundingStateComponent',
    );

  const getHealth = () =>
    getRequiredComponent<PlayerHealthStateComponent>(
      PlayerHealthStateComponent,
      'PlayerHealthStateComponent',
    );

  return {
    get moveSpeed() {
      return getConfig().moveSpeed;
    },
    set moveSpeed(value: number) {
      const config = getConfig();
      const locomotion = getLocomotion();
      config.moveSpeed = value;
      locomotion.moveSpeed = value;
      locomotion.normalMoveSpeed = value;
    },
    get jumpForce() {
      return getConfig().jumpForce;
    },
    set jumpForce(value: number) {
      getConfig().jumpForce = value;
      getGrounding().jumpForce = value;
    },
    get dashSpeed() {
      return getConfig().dashSpeed;
    },
    set dashSpeed(value: number) {
      getConfig().dashSpeed = value;
      getLocomotion().dashSpeed = value;
    },
    get targetAngle() {
      return getLocomotion().targetAngle;
    },
    set targetAngle(value: number) {
      getLocomotion().targetAngle = value;
    },
    get targetRotation() {
      return getLocomotion().targetRotation;
    },
    set targetRotation(value: Quaternion) {
      getLocomotion().targetRotation = value;
    },
    get currentHealth() {
      return getHealth().currentHealth;
    },
    set currentHealth(value: number) {
      getHealth().currentHealth = value;
    },
    get maxHealth() {
      return getHealth().maxHealth;
    },
    set maxHealth(value: number) {
      getHealth().maxHealth = value;
    },
    get isInvulnerable() {
      return getHealth().isInvulnerable;
    },
    set isInvulnerable(value: boolean) {
      getHealth().isInvulnerable = value;
    },
    get mesh() {
      return getPhysicsRefs().mesh as Mesh & {
        animationModels?: PlayerAnimationRegistry;
      };
    },
    get animationHandler() {
      return {
        play(animationName: string, options?: { loop?: boolean }) {
          const animation = getAnimation();
          const animationGroup = animation.animationGroups.get(animationName);
          if (!animationGroup) {
            return;
          }

          for (const [
            otherName,
            otherAnimationGroup,
          ] of animation.animationGroups) {
            if (otherName !== animationName && otherAnimationGroup.isPlaying) {
              otherAnimationGroup.stop();
            }
          }

          animationGroup.loopAnimation = options?.loop ?? true;
          animationGroup.start(
            options?.loop ?? true,
            1,
            animationGroup.from,
            animationGroup.to,
            true,
          );
          animation.currentAnimation = animationName;
          animation.activeSpeedRatio = 1;
        },
        setBlendDuration(value: number) {
          const animation = getAnimation();
          animation.blendingSpeed = value;
          for (const animationGroup of animation.animationGroups.values()) {
            animationGroup.blendingSpeed = value;
          }
        },
      };
    },
  };
}

export function createPlayerCombatTargetApi(
  world: World,
  entityId: EntityId,
): PlayerCombatTargetApi {
  const getPhysicsRefs = () => {
    const component = world.getComponent(
      entityId,
      PlayerPhysicsViewRefsComponent,
    );

    if (!component) {
      throw new Error(
        `PlayerPhysicsViewRefsComponent is missing from player entity ${entityId}.`,
      );
    }

    return component;
  };

  const getRequests = () => {
    const component = world.getComponent(
      entityId,
      PlayerSurvivabilityRequestComponent,
    );

    if (!component) {
      throw new Error(
        `PlayerSurvivabilityRequestComponent is missing from player entity ${entityId}.`,
      );
    }

    return component;
  };

  return {
    takeDamage(amount: number, damageSourcePosition: Vector3 | null = null) {
      getRequests().damageRequests.push({
        amount,
        damageSourcePosition: damageSourcePosition?.clone() ?? null,
      });
    },
    getCollisionMesh() {
      return getPhysicsRefs().mesh;
    },
    getWorldPosition() {
      return getPhysicsRefs().mesh.getAbsolutePosition().clone();
    },
  };
}

export function initializePlayerRagdoll(
  world: World,
  entityId: EntityId,
  skeleton: Skeleton,
  armatureNode: Mesh,
) {
  const ragdoll = world.getComponent(entityId, PlayerRagdollStateComponent);

  if (!ragdoll) {
    throw new Error(
      `PlayerRagdollStateComponent is missing from player entity ${entityId}.`,
    );
  }

  disposeRagdoll(ragdoll.ragdoll);
  ragdoll.ragdollSkeleton = skeleton;
  ragdoll.ragdollArmatureNode = armatureNode;
  ragdoll.ragdoll = createPlayerRagdoll(skeleton, armatureNode);
}

export function configurePlayerTuning(
  world: World,
  entityId: EntityId,
  config: {
    moveSpeed?: number;
    jumpForce?: number;
    dashSpeed?: number;
    magnetismRange?: number;
    coyoteTime?: number;
  },
) {
  const gameplay = world.getComponent(entityId, PlayerGameplayConfigComponent);
  const locomotion = world.getComponent(
    entityId,
    PlayerLocomotionStateComponent,
  );
  const grounding = world.getComponent(entityId, PlayerGroundingStateComponent);
  const combat = world.getComponent(entityId, PlayerCombatStateComponent);

  if (!gameplay || !locomotion || !grounding || !combat) {
    throw new Error(
      `Player tuning components are missing from entity ${entityId}.`,
    );
  }

  if (config.moveSpeed !== undefined) {
    gameplay.moveSpeed = config.moveSpeed;
    locomotion.moveSpeed = config.moveSpeed;
    locomotion.normalMoveSpeed = config.moveSpeed;
  }

  if (config.jumpForce !== undefined) {
    gameplay.jumpForce = config.jumpForce;
    grounding.jumpForce = config.jumpForce;
  }

  if (config.dashSpeed !== undefined) {
    gameplay.dashSpeed = config.dashSpeed;
    locomotion.dashSpeed = config.dashSpeed;
  }

  if (config.magnetismRange !== undefined) {
    gameplay.magnetismRange = config.magnetismRange;
    combat.magnetismRange = config.magnetismRange;
  }

  if (config.coyoteTime !== undefined) {
    gameplay.coyoteTime = config.coyoteTime;
    grounding.coyoteTime = config.coyoteTime;
  }
}

export function pausePlayerInput(world: World, entityId: EntityId) {
  const control = world.getComponent(entityId, PlayerControlStateComponent);
  const locomotion = world.getComponent(
    entityId,
    PlayerLocomotionStateComponent,
  );

  if (!control || !locomotion) {
    throw new Error(
      `Player input components are missing from entity ${entityId}.`,
    );
  }

  control.inputEnabled = false;
  control.inputMap = {};
  control.moveInputX = 0;
  control.moveInputZ = 0;
  control.dashRequested = false;
  control.attackRequested = false;
  control.danceToggleRequested = false;
  locomotion.isDashing = false;
}

export function resumePlayerInput(world: World, entityId: EntityId) {
  const control = world.getComponent(entityId, PlayerControlStateComponent);

  if (!control) {
    throw new Error(
      `PlayerControlStateComponent is missing from entity ${entityId}.`,
    );
  }

  control.inputEnabled = true;
}

function disposeRagdoll(ragdoll: unknown | null) {
  if (!ragdoll || typeof ragdoll !== 'object' || !('dispose' in ragdoll)) {
    return;
  }

  (ragdoll as { dispose(): void }).dispose();
}
