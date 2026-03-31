import {
  KeyboardEventTypes,
  PointerEventTypes,
  type KeyboardInfo,
  type Observer,
  type PointerInfo,
} from '@babylonjs/core';
import type { EntityId } from '../../core/Entity.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  PlayerCombatStateComponent,
  PlayerControlStateComponent,
  PlayerGroundingStateComponent,
  PlayerHealthStateComponent,
  PlayerPhysicsViewRefsComponent,
} from '../components/index.ts';
import { PlayerCombatMode, PlayerLifeState } from '../PlayerStateEnums.ts';

interface PlayerInputObserverHandles {
  keyboardObserver: Observer<KeyboardInfo>;
  pointerObserver: Observer<PointerInfo>;
}

export class PlayerInputSystem implements EcsSystem {
  readonly name = 'PlayerInputSystem';
  readonly order = 10;

  private readonly observers = new Map<EntityId, PlayerInputObserverHandles>();

  update(world: World): void {
    const entityIds = world.query(
      PlayerCombatStateComponent,
      PlayerControlStateComponent,
      PlayerGroundingStateComponent,
      PlayerHealthStateComponent,
      PlayerPhysicsViewRefsComponent,
    );

    for (const entityId of entityIds) {
      this.ensureObservers(world, entityId);

      const combat = world.getComponent(entityId, PlayerCombatStateComponent);
      const control = world.getComponent(entityId, PlayerControlStateComponent);
      const health = world.getComponent(entityId, PlayerHealthStateComponent);

      if (!combat || !control || !health) {
        continue;
      }

      control.inputEnabled =
        control.inputEnabled && health.lifeState === PlayerLifeState.ALIVE;

      if (!control.inputEnabled) {
        control.inputMap = {};
        control.moveInputX = 0;
        control.moveInputZ = 0;
        control.dashRequested = false;
        control.attackRequested = false;
        control.danceToggleRequested = false;
        continue;
      }

      control.moveInputX =
        Number(!!control.inputMap.d) - Number(!!control.inputMap.a);
      control.moveInputZ =
        Number(!!control.inputMap.w) - Number(!!control.inputMap.s);

      if (control.danceToggleRequested) {
        combat.isDancing = !combat.isDancing;
        if (!combat.isAttacking) {
          combat.mode = combat.isDancing
            ? PlayerCombatMode.DANCING
            : PlayerCombatMode.IDLE;
        }
        control.danceToggleRequested = false;
      }
    }
  }

  private ensureObservers(world: World, entityId: EntityId) {
    if (this.observers.has(entityId)) {
      return;
    }

    const physicsRefs = world.getComponent(
      entityId,
      PlayerPhysicsViewRefsComponent,
    );

    if (!physicsRefs) {
      return;
    }

    const keyboardObserver = physicsRefs.scene.onKeyboardObservable.add(
      (kbInfo) => {
        const control = world.getComponent(
          entityId,
          PlayerControlStateComponent,
        );
        const grounding = world.getComponent(
          entityId,
          PlayerGroundingStateComponent,
        );

        if (!control || !grounding || !control.inputEnabled) {
          return;
        }

        const key = kbInfo.event.key.toLowerCase();

        if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
          control.inputMap[key] = true;

          if (key === ' ') {
            grounding.jumpBufferTimer = grounding.jumpBufferTime;
            control.jumpBufferTimer = grounding.jumpBufferTimer;
            control.jumpKeyReleased = false;
          }

          if (key === 'shift') {
            control.dashRequested = true;
          }

          if (key === 'k') {
            control.danceToggleRequested = true;
          }

          return;
        }

        if (kbInfo.type === KeyboardEventTypes.KEYUP) {
          control.inputMap[key] = false;

          if (key === ' ') {
            control.jumpKeyReleased = true;
          }
        }
      },
    );

    const pointerObserver = physicsRefs.scene.onPointerObservable.add(
      (pointerInfo) => {
        const control = world.getComponent(
          entityId,
          PlayerControlStateComponent,
        );

        if (!control || !control.inputEnabled) {
          return;
        }

        if (
          pointerInfo.type === PointerEventTypes.POINTERDOWN &&
          pointerInfo.event.button === 0
        ) {
          control.attackRequested = true;
        }
      },
    );

    this.observers.set(entityId, {
      keyboardObserver,
      pointerObserver,
    });
  }
}
