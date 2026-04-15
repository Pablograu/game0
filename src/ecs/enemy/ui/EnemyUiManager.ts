import type { Scene, TransformNode } from '@babylonjs/core';
import { AdvancedDynamicTexture } from '@babylonjs/gui';
import type { EntityId } from '../../core/Entity.ts';
import { EnemyUiView } from './EnemyUiView.ts';

const HEALTH_LERP_SPEED = 10;
const FADE_IN_SPEED = 14;
const FADE_OUT_SPEED = 10;
const MIN_VISIBLE_ALPHA = 0.02;
const MIN_DISTANCE_SCALE = 0.8;
const DISTANCE_SCALE_FALLOFF = 0.2;

type ManualVisibility = 'auto' | 'show' | 'hide';

export interface EnemyUiRegistration {
  mesh: TransformNode;
  displayName: string;
  linkOffsetY: number;
  baseScale: number;
  maxVisibleDistance: number;
  damageRevealDuration: number;
}

export interface EnemyUiSyncState extends EnemyUiRegistration {
  entityId: EntityId;
  currentHealth: number;
  maxHealth: number;
  distanceToPlayer: number;
  isEngaged: boolean;
  targeted?: boolean;
}

export interface EnemyUiApi {
  registerEnemy(entityId: EntityId, registration: EnemyUiRegistration): void;
  unregisterEnemy(entityId: EntityId): void;
  updateHealth(entityId: EntityId, current: number, max: number): void;
  showUI(entityId: EntityId): void;
  hideUI(entityId: EntityId): void;
  setTarget(entityId: EntityId, targeted: boolean): void;
  beginFrame(): void;
  syncEnemy(state: EnemyUiSyncState): void;
  update(deltaTime: number): void;
  endFrame(): void;
  dispose(): void;
}

interface EnemyUiEntry extends EnemyUiRegistration {
  view: EnemyUiView;
  targetHealthRatio: number;
  displayedHealthRatio: number;
  currentAlpha: number;
  targetAlpha: number;
  recentDamageTimer: number;
  manualTargeted: boolean;
  manualVisibility: ManualVisibility;
  distanceToPlayer: number;
  lastSeenFrame: number;
}

export class EnemyUiManager implements EnemyUiApi {
  private readonly uiTexture: AdvancedDynamicTexture;
  private readonly entries = new Map<EntityId, EnemyUiEntry>();
  private readonly pool: EnemyUiView[] = [];
  private readonly allViews = new Set<EnemyUiView>();
  private frameId = 0;

  constructor(scene: Scene) {
    this.uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      'enemyUiOverlay',
      true,
      scene,
    );
  }

  registerEnemy(entityId: EntityId, registration: EnemyUiRegistration): void {
    const entry = this.ensureEntry(entityId, registration);
    this.applyRegistration(entry, registration);
  }

  unregisterEnemy(entityId: EntityId): void {
    const entry = this.entries.get(entityId);
    if (!entry) {
      return;
    }

    this.releaseEntry(entityId, entry);
  }

  updateHealth(entityId: EntityId, current: number, max: number): void {
    const entry = this.entries.get(entityId);
    if (!entry) {
      return;
    }

    const nextRatio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;

    if (nextRatio + 0.001 < entry.targetHealthRatio) {
      entry.recentDamageTimer = entry.damageRevealDuration;
    }

    entry.targetHealthRatio = nextRatio;
  }

  showUI(entityId: EntityId): void {
    const entry = this.entries.get(entityId);
    if (!entry) {
      return;
    }

    entry.manualVisibility = 'show';
    entry.targetAlpha = 1;
  }

  hideUI(entityId: EntityId): void {
    const entry = this.entries.get(entityId);
    if (!entry) {
      return;
    }

    entry.manualVisibility = 'hide';
    entry.targetAlpha = 0;
  }

  setTarget(entityId: EntityId, targeted: boolean): void {
    const entry = this.entries.get(entityId);
    if (!entry) {
      return;
    }

    entry.manualTargeted = targeted;
  }

  beginFrame(): void {
    this.frameId += 1;
  }

  syncEnemy(state: EnemyUiSyncState): void {
    const entry = this.ensureEntry(state.entityId, state);
    entry.lastSeenFrame = this.frameId;
    this.applyRegistration(entry, state);
    this.updateHealth(state.entityId, state.currentHealth, state.maxHealth);

    if (typeof state.targeted === 'boolean') {
      entry.manualTargeted = state.targeted;
    }

    entry.distanceToPlayer = state.distanceToPlayer;

    const shouldShow = this.resolveShouldShow(entry, state.isEngaged);
    entry.targetAlpha = shouldShow ? 1 : 0;
  }

  update(deltaTime: number): void {
    for (const entry of this.entries.values()) {
      if (entry.recentDamageTimer > 0) {
        entry.recentDamageTimer = Math.max(
          0,
          entry.recentDamageTimer - deltaTime,
        );
      }

      entry.displayedHealthRatio = this.damp(
        entry.displayedHealthRatio,
        entry.targetHealthRatio,
        HEALTH_LERP_SPEED,
        deltaTime,
      );
      entry.currentAlpha = this.damp(
        entry.currentAlpha,
        entry.targetAlpha,
        entry.targetAlpha > entry.currentAlpha ? FADE_IN_SPEED : FADE_OUT_SPEED,
        deltaTime,
      );

      if (
        Math.abs(entry.displayedHealthRatio - entry.targetHealthRatio) < 0.001
      ) {
        entry.displayedHealthRatio = entry.targetHealthRatio;
      }

      if (Math.abs(entry.currentAlpha - entry.targetAlpha) < 0.001) {
        entry.currentAlpha = entry.targetAlpha;
      }

      entry.view.setHealthRatio(entry.displayedHealthRatio);
      entry.view.setAlpha(entry.currentAlpha);
      entry.view.setScale(this.computeDistanceScale(entry));
      entry.view.setVisible(
        entry.currentAlpha > MIN_VISIBLE_ALPHA ||
          entry.targetAlpha > MIN_VISIBLE_ALPHA,
      );
    }
  }

  endFrame(): void {
    for (const [entityId, entry] of this.entries) {
      if (entry.lastSeenFrame === this.frameId) {
        continue;
      }

      this.releaseEntry(entityId, entry);
    }
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      entry.view.detach(this.uiTexture);
    }

    this.entries.clear();
    this.pool.length = 0;

    for (const view of this.allViews) {
      view.dispose();
    }

    this.allViews.clear();
    this.uiTexture.dispose();
  }

  private ensureEntry(
    entityId: EntityId,
    registration: EnemyUiRegistration,
  ): EnemyUiEntry {
    const existing = this.entries.get(entityId);
    if (existing) {
      return existing;
    }

    const view = this.acquireView();
    view.attach(this.uiTexture, registration.mesh, registration.linkOffsetY);
    view.setName(registration.displayName);
    view.setHealthRatio(1);
    view.setScale(registration.baseScale);
    view.setAlpha(0);
    view.setVisible(false);

    const entry: EnemyUiEntry = {
      ...registration,
      view,
      targetHealthRatio: 1,
      displayedHealthRatio: 1,
      currentAlpha: 0,
      targetAlpha: 0,
      recentDamageTimer: 0,
      manualTargeted: false,
      manualVisibility: 'auto',
      distanceToPlayer: Number.POSITIVE_INFINITY,
      lastSeenFrame: this.frameId,
    };

    this.entries.set(entityId, entry);
    return entry;
  }

  private applyRegistration(
    entry: EnemyUiEntry,
    registration: EnemyUiRegistration,
  ): void {
    entry.mesh = registration.mesh;
    entry.displayName = registration.displayName;
    entry.linkOffsetY = registration.linkOffsetY;
    entry.baseScale = registration.baseScale;
    entry.maxVisibleDistance = registration.maxVisibleDistance;
    entry.damageRevealDuration = registration.damageRevealDuration;

    entry.view.attach(
      this.uiTexture,
      registration.mesh,
      registration.linkOffsetY,
    );
    entry.view.setName(registration.displayName);
    entry.view.setLinkOffsetY(registration.linkOffsetY);
  }

  private resolveShouldShow(entry: EnemyUiEntry, isEngaged: boolean): boolean {
    if (entry.manualVisibility === 'hide') {
      return false;
    }

    const inRange =
      Number.isFinite(entry.distanceToPlayer) &&
      entry.distanceToPlayer <= entry.maxVisibleDistance;

    if (entry.manualVisibility === 'show') {
      return inRange;
    }

    return (
      inRange &&
      (entry.manualTargeted || isEngaged || entry.recentDamageTimer > 0)
    );
  }

  private computeDistanceScale(entry: EnemyUiEntry): number {
    if (
      !Number.isFinite(entry.distanceToPlayer) ||
      entry.maxVisibleDistance <= 0
    ) {
      return entry.baseScale;
    }

    const normalized = Math.max(
      0,
      Math.min(1, entry.distanceToPlayer / entry.maxVisibleDistance),
    );
    const scaled = entry.baseScale * (1 - normalized * DISTANCE_SCALE_FALLOFF);
    return Math.max(entry.baseScale * MIN_DISTANCE_SCALE, scaled);
  }

  private damp(
    current: number,
    target: number,
    speed: number,
    deltaTime: number,
  ): number {
    if (current === target) {
      return target;
    }

    if (deltaTime <= 0) {
      return current;
    }

    const factor = 1 - Math.exp(-speed * deltaTime);
    return current + (target - current) * factor;
  }

  private acquireView(): EnemyUiView {
    const view = this.pool.pop() ?? new EnemyUiView();
    this.allViews.add(view);
    return view;
  }

  private releaseEntry(entityId: EntityId, entry: EnemyUiEntry): void {
    entry.view.detach(this.uiTexture);
    entry.view.reset();
    this.pool.push(entry.view);
    this.entries.delete(entityId);
  }
}
