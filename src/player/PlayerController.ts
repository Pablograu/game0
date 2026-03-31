import type {
  Camera,
  Mesh,
  PhysicsBody,
  Quaternion,
  Skeleton,
  Vector3,
} from '@babylonjs/core';
import type { AdvancedDynamicTexture, TextBlock } from '@babylonjs/gui';
import type { ComponentType } from '../ecs/core/Component.ts';
import type { EntityId } from '../ecs/core/Entity.ts';
import type { World } from '../ecs/core/World.ts';
import {
  PlayerAnimationStateComponent,
  PlayerCombatStateComponent,
  PlayerControlStateComponent,
  PlayerGameOverHandlerComponent,
  PlayerGameplayConfigComponent,
  PlayerGroundingStateComponent,
  PlayerHealthStateComponent,
  PlayerLocomotionStateComponent,
  PlayerPhysicsViewRefsComponent,
  PlayerRagdollStateComponent,
  PlayerSpawnStateComponent,
  PlayerSurvivabilityRequestComponent,
  PlayerWeaponStateComponent,
} from '../ecs/player/components/index.ts';
import { createPlayerRagdoll } from './playerRuntime.ts';
import type {
  PlayerGameOverHandler,
  PlayerTuningConfig,
} from './PlayerFacade.ts';
import type { PlayerAnimationRegistry } from './PlayerAnimations.ts';

export class PlayerController {
  constructor(
    private readonly world: World,
    private readonly entityId: EntityId,
  ) {}

  get mesh(): Mesh {
    return this.getPhysicsRefs().mesh;
  }

  get body(): PhysicsBody | null {
    return this.getPhysicsRefs().body;
  }

  get camera(): Camera | null {
    return this.getPhysicsRefs().camera;
  }

  get cameraShaker() {
    return this.getPhysicsRefs().cameraShaker;
  }

  get scene() {
    return this.getPhysicsRefs().scene;
  }

  get moveSpeed(): number {
    return this.getConfig().moveSpeed;
  }

  set moveSpeed(value: number) {
    const config = this.getConfig();
    const locomotion = this.getLocomotion();
    config.moveSpeed = value;
    locomotion.moveSpeed = value;
    locomotion.normalMoveSpeed = value;
  }

  get normalMoveSpeed(): number {
    return this.getLocomotion().normalMoveSpeed;
  }

  set normalMoveSpeed(value: number) {
    const config = this.getConfig();
    const locomotion = this.getLocomotion();
    config.moveSpeed = value;
    locomotion.normalMoveSpeed = value;
    locomotion.moveSpeed = value;
  }

  get jumpForce(): number {
    return this.getConfig().jumpForce;
  }

  set jumpForce(value: number) {
    this.getConfig().jumpForce = value;
    this.getGrounding().jumpForce = value;
  }

  get dashSpeed(): number {
    return this.getConfig().dashSpeed;
  }

  set dashSpeed(value: number) {
    this.getConfig().dashSpeed = value;
    this.getLocomotion().dashSpeed = value;
  }

  get targetAngle(): number {
    return this.getLocomotion().targetAngle;
  }

  set targetAngle(value: number) {
    this.getLocomotion().targetAngle = value;
  }

  get targetRotation(): Quaternion {
    return this.getLocomotion().targetRotation;
  }

  set targetRotation(value: Quaternion) {
    this.getLocomotion().targetRotation = value;
  }

  get currentHealth(): number {
    return this.getHealth().currentHealth;
  }

  set currentHealth(value: number) {
    this.getHealth().currentHealth = value;
  }

  get maxHealth(): number {
    return this.getHealth().maxHealth;
  }

  set maxHealth(value: number) {
    this.getHealth().maxHealth = value;
  }

  get isInvulnerable(): boolean {
    return this.getHealth().isInvulnerable;
  }

  set isInvulnerable(value: boolean) {
    this.getHealth().isInvulnerable = value;
  }

  get inputEnabled(): boolean {
    return this.getControl().inputEnabled;
  }

  set inputEnabled(value: boolean) {
    this.getControl().inputEnabled = value;
  }

  get inputMap(): Record<string, boolean> {
    return this.getControl().inputMap;
  }

  set inputMap(value: Record<string, boolean>) {
    this.getControl().inputMap = value;
  }

  get jumpKeyReleased(): boolean {
    return this.getControl().jumpKeyReleased;
  }

  set jumpKeyReleased(value: boolean) {
    this.getControl().jumpKeyReleased = value;
  }

  get currentPlayingAnimation(): string {
    return this.getAnimation().currentAnimation;
  }

  get blendingSpeed(): number {
    return this.getAnimation().blendingSpeed;
  }

  set blendingSpeed(value: number) {
    const animation = this.getAnimation();
    animation.blendingSpeed = value;
    for (const animationGroup of animation.animationGroups.values()) {
      animationGroup.blendingSpeed = value;
    }
  }

  get animationGroups() {
    return this.getAnimation().animationGroups;
  }

  get playerAnimations(): PlayerAnimationRegistry {
    return this.getAnimation().animationRegistry;
  }

  get healthUI(): AdvancedDynamicTexture | null {
    return this.getHealth().healthUI;
  }

  get healthText(): TextBlock | null {
    return this.getHealth().healthText;
  }

  get weaponSystem() {
    return this.getWeapon().weaponSystem;
  }

  get ragdoll() {
    return this.getRagdoll().ragdoll;
  }

  set ragdoll(value: unknown | null) {
    this.getRagdoll().ragdoll = value;
  }

  get gameManager(): PlayerGameOverHandler | null {
    return this.getGameOverHandler().handler;
  }

  set gameManager(handler: PlayerGameOverHandler | null) {
    this.getGameOverHandler().handler = handler;
  }

  pauseInput() {
    const control = this.getControl();
    const locomotion = this.getLocomotion();
    control.inputEnabled = false;
    control.inputMap = {};
    control.moveInputX = 0;
    control.moveInputZ = 0;
    control.dashRequested = false;
    control.attackRequested = false;
    control.danceToggleRequested = false;
    locomotion.isDashing = false;
  }

  resumeInput() {
    this.getControl().inputEnabled = true;
  }

  enableInput() {
    this.resumeInput();
  }

  detachControl() {
    this.pauseInput();
  }

  takeDamage(amount: number, damageSourcePosition: Vector3 | null = null) {
    this.getRequests().damageRequests.push({
      amount,
      damageSourcePosition: damageSourcePosition?.clone() ?? null,
    });
  }

  die() {
    this.getRequests().deathRequested = true;
  }

  respawn() {
    this.getRequests().respawnRequested = true;
  }

  configureTuning(config: PlayerTuningConfig) {
    if (config.moveSpeed !== undefined) {
      this.moveSpeed = config.moveSpeed;
    }

    if (config.jumpForce !== undefined) {
      this.jumpForce = config.jumpForce;
    }

    if (config.dashSpeed !== undefined) {
      this.dashSpeed = config.dashSpeed;
    }

    if (config.magnetismRange !== undefined) {
      this.getCombat().magnetismRange = config.magnetismRange;
      this.getConfig().magnetismRange = config.magnetismRange;
    }

    if (config.coyoteTime !== undefined) {
      this.getGrounding().coyoteTime = config.coyoteTime;
      this.getConfig().coyoteTime = config.coyoteTime;
    }
  }

  registerEnemy(enemy: unknown) {
    this.getWeapon().weaponSystem?.registerEnemy(enemy);
  }

  registerEnemies(enemies: unknown[]) {
    for (const enemy of enemies) {
      this.registerEnemy(enemy);
    }
  }

  connectGameOverHandler(handler: PlayerGameOverHandler | null) {
    this.getGameOverHandler().handler = handler;
  }

  initializeRagdoll(skeleton: Skeleton, armatureNode: Mesh) {
    const ragdoll = this.getRagdoll();
    this.disposeRagdoll(ragdoll.ragdoll);
    ragdoll.ragdollSkeleton = skeleton;
    ragdoll.ragdollArmatureNode = armatureNode;
    ragdoll.ragdoll = createPlayerRagdoll(skeleton, armatureNode);
  }

  resetRagdollForRespawn() {
    const ragdoll = this.getRagdoll();
    this.disposeRagdoll(ragdoll.ragdoll);
    ragdoll.ragdoll = createPlayerRagdoll(
      ragdoll.ragdollSkeleton,
      ragdoll.ragdollArmatureNode,
    );
  }

  playSmoothAnimation(
    name: string,
    loop: boolean = true,
    forceReset: boolean = false,
    speedRatio: number = 1,
  ) {
    const animation = this.getAnimation();
    const animationGroup = animation.animationGroups.get(name);
    if (!animationGroup) {
      return;
    }

    if (
      animation.currentAnimation === name &&
      loop &&
      animationGroup.isPlaying &&
      !forceReset
    ) {
      return;
    }

    for (const [otherName, otherAnimationGroup] of animation.animationGroups) {
      if (otherName !== name && otherAnimationGroup.isPlaying) {
        otherAnimationGroup.stop();
      }
    }

    animationGroup.loopAnimation = loop;
    animationGroup.start(
      loop,
      speedRatio,
      animationGroup.from,
      animationGroup.to,
      true,
    );
    animation.currentAnimation = name;
    animation.activeSpeedRatio = speedRatio;
  }

  private getPhysicsRefs() {
    return this.getRequiredComponent(
      PlayerPhysicsViewRefsComponent,
      'PlayerPhysicsViewRefsComponent',
    );
  }

  private getControl() {
    return this.getRequiredComponent(
      PlayerControlStateComponent,
      'PlayerControlStateComponent',
    );
  }

  private getCombat() {
    return this.getRequiredComponent(
      PlayerCombatStateComponent,
      'PlayerCombatStateComponent',
    );
  }

  private getGrounding() {
    return this.getRequiredComponent(
      PlayerGroundingStateComponent,
      'PlayerGroundingStateComponent',
    );
  }

  private getHealth() {
    return this.getRequiredComponent(
      PlayerHealthStateComponent,
      'PlayerHealthStateComponent',
    );
  }

  private getLocomotion() {
    return this.getRequiredComponent(
      PlayerLocomotionStateComponent,
      'PlayerLocomotionStateComponent',
    );
  }

  private getAnimation() {
    return this.getRequiredComponent(
      PlayerAnimationStateComponent,
      'PlayerAnimationStateComponent',
    );
  }

  private getConfig() {
    return this.getRequiredComponent(
      PlayerGameplayConfigComponent,
      'PlayerGameplayConfigComponent',
    );
  }

  private getRagdoll() {
    return this.getRequiredComponent(
      PlayerRagdollStateComponent,
      'PlayerRagdollStateComponent',
    );
  }

  private getRequests() {
    return this.getRequiredComponent(
      PlayerSurvivabilityRequestComponent,
      'PlayerSurvivabilityRequestComponent',
    );
  }

  private getWeapon() {
    return this.getRequiredComponent(
      PlayerWeaponStateComponent,
      'PlayerWeaponStateComponent',
    );
  }

  private getGameOverHandler() {
    return this.getRequiredComponent(
      PlayerGameOverHandlerComponent,
      'PlayerGameOverHandlerComponent',
    );
  }

  private getRequiredComponent<T>(
    componentType: ComponentType<T>,
    name: string,
  ): T {
    const component = this.world.getComponent(this.entityId, componentType);
    if (!component) {
      throw new Error(`Missing ${name} on player entity ${this.entityId}.`);
    }

    return component;
  }

  private disposeRagdoll(ragdoll: unknown | null) {
    if (!ragdoll || typeof ragdoll !== 'object' || !('dispose' in ragdoll)) {
      return;
    }

    (ragdoll as { dispose(): void }).dispose();
  }
}
