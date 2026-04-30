import {
  ArcRotateCamera,
  Bone,
  Quaternion,
  type Observer,
  type Scene,
} from '@babylonjs/core';
import type { EcsSystem } from '../../core/System.ts';
import type { World } from '../../core/World.ts';
import {
  PlayerPhysicsViewRefsComponent,
  PlayerRagdollStateComponent,
  PlayerRangedStateComponent,
} from '../components/index.ts';
import { PlayerRagdollMode } from '../PlayerStateEnums.ts';

// How much of the camera's vertical angle maps to body pitch (0-1).
// 1.0 = body fully tracks camera; 0.6 = 60% tracking.
const BEND_SCALE = 0.6;

// Lerp speed for transitioning the bend on/off.
const LERP_SPEED = 8;

// Mixamo spine bone names from bottom to top.
const SPINE_BONE_NAMES = [
  'mixamorig:Spine',
  'mixamorig:Spine1',
  'mixamorig:Spine2',
];

// How much of the total bend each bone carries (must be bottom-to-top to match SPINE_BONE_NAMES).
// Upper spine carries more so shoulders/chest move most, hips move least.
const BONE_WEIGHTS = [0.2, 0.3, 0.5];

/**
 * Procedurally tilts the player's spine bones to match the camera's vertical (beta) angle.
 * Active only while aiming; smoothly lerps to/from flat when aiming starts/stops.
 *
 * Bone manipulation must happen AFTER the animation system writes bone transforms each frame,
 * so this system registers a scene.onAfterAnimationsObservable observer on first run instead
 * of modifying bones directly inside update().
 */
export class PlayerSpineBendSystem implements EcsSystem {
  readonly name = 'PlayerSpineBendSystem';
  readonly order = 67;

  private currentBend = 0;
  private spineBones: Bone[] = [];
  private scene: Scene | null = null;
  private observer: Observer<Scene> | null = null;
  private initialized = false;

  update(world: World, deltaTime: number): void {
    const entityIds = world.query(
      PlayerPhysicsViewRefsComponent,
      PlayerRangedStateComponent,
      PlayerRagdollStateComponent,
    );

    for (const entityId of entityIds) {
      const refs = world.getComponent(
        entityId,
        PlayerPhysicsViewRefsComponent,
      )!;
      const ranged = world.getComponent(entityId, PlayerRangedStateComponent)!;
      const ragdoll = world.getComponent(
        entityId,
        PlayerRagdollStateComponent,
      )!;

      if (!refs.mesh) continue;
      if (ragdoll.mode === PlayerRagdollMode.ACTIVE) continue;

      if (!this.initialized) {
        this.init(refs);
      }

      const camera = refs.camera as ArcRotateCamera | undefined;
      const isAiming = ranged.isAiming;

      // beta = PI/2  → horizontal (neutral, bend = 0)
      // beta < PI/2  → camera tilted up   → positive bend (spine leans back)
      // beta > PI/2  → camera tilted down → negative bend (spine leans forward)
      const targetBend =
        isAiming && camera ? (Math.PI / 2 - camera.beta) * BEND_SCALE : 0;

      const lerpFactor = Math.min(1, LERP_SPEED * deltaTime);
      this.currentBend += (targetBend - this.currentBend) * lerpFactor;
    }
  }

  private init(refs: PlayerPhysicsViewRefsComponent): void {
    this.initialized = true;

    const skeleton = refs.mesh.skeleton;
    if (!skeleton) return;

    this.spineBones = SPINE_BONE_NAMES.map((name) =>
      skeleton.bones.find((b) => b.name === name),
    ).filter((b): b is Bone => b !== undefined);

    if (this.spineBones.length === 0) {
      console.warn(
        '[PlayerSpineBendSystem] No spine bones found. Check bone names.',
      );
      return;
    }

    this.scene = refs.mesh.getScene();

    this.observer = this.scene.onAfterAnimationsObservable.add(() => {
      if (Math.abs(this.currentBend) < 0.0001) return;

      for (let i = 0; i < this.spineBones.length; i++) {
        const bone = this.spineBones[i];
        const tn = bone.getTransformNode();
        if (!tn?.rotationQuaternion) continue;

        const weight = BONE_WEIGHTS[i] ?? 1 / this.spineBones.length;
        const bendAngle = this.currentBend * weight;

        // Compose pitch offset on top of the animation-evaluated rotation.
        // multiplyInPlace is safe: the animation system copyFrom's a fresh value
        // into rotationQuaternion each frame before this observer fires.
        tn.rotationQuaternion.multiplyInPlace(
          Quaternion.FromEulerAngles(bendAngle, 0, 0),
        );
      }
    });
  }

  dispose(): void {
    if (this.observer && this.scene) {
      this.scene.onAfterAnimationsObservable.remove(this.observer);
      this.observer = null;
    }
  }
}
