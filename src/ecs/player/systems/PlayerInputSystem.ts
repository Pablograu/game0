import {
  KeyboardEventTypes,
  PointerEventTypes,
  type KeyboardInfo,
  type Observer,
  type PointerInfo,
} from '@babylonjs/core';
import { LegacyPlayerRefsComponent } from '../../components/LegacyPlayerRefsComponent.ts';
import type { EntityId } from '../../core/Entity.ts';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  PlayerCombatStateComponent,
  PlayerControlStateComponent,
  PlayerGroundingStateComponent,
  PlayerHealthStateComponent,
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
      LegacyPlayerRefsComponent,
      PlayerCombatStateComponent,
      PlayerControlStateComponent,
      PlayerGroundingStateComponent,
      PlayerHealthStateComponent,
    );

    for (const entityId of entityIds) {
      this.ensureObservers(world, entityId);

      const refs = world.getComponent(entityId, LegacyPlayerRefsComponent);
      const combat = world.getComponent(entityId, PlayerCombatStateComponent);
      const control = world.getComponent(entityId, PlayerControlStateComponent);
      const health = world.getComponent(entityId, PlayerHealthStateComponent);

      if (!refs || !combat || !control || !health) {
        continue;
      }

      control.inputEnabled =
        refs.controller.inputEnabled &&
        health.lifeState === PlayerLifeState.ALIVE;

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

    const refs = world.getComponent(entityId, LegacyPlayerRefsComponent);

    if (!refs) {
      return;
    }

    const keyboardObserver = refs.scene.onKeyboardObservable.add((kbInfo) => {
      const control = world.getComponent(entityId, PlayerControlStateComponent);
      const grounding = world.getComponent(
        entityId,
        PlayerGroundingStateComponent,
      );
      const currentRefs = world.getComponent(
        entityId,
        LegacyPlayerRefsComponent,
      );

      if (!control || !grounding || !currentRefs?.controller.inputEnabled) {
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
    });

    const pointerObserver = refs.scene.onPointerObservable.add(
      (pointerInfo) => {
        const control = world.getComponent(
          entityId,
          PlayerControlStateComponent,
        );
        const currentRefs = world.getComponent(
          entityId,
          LegacyPlayerRefsComponent,
        );

        if (!control || !currentRefs?.controller.inputEnabled) {
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
