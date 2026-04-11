import { AnimationGroup, TransformNode } from "@babylonjs/core";

export const PLAYER_ANIMATION_NAMES = [
  "idle",
  "run",
  "jump",
  "punch_L",
  "punch_R",
  "macarena",
  "dash",
  "dead",
  "falling",
  "hit",
  "land",
  "walk",
  "flying_kick",
  "stumble_back",
  "idle_assault_rifle",
  "run_assault_rifle",
  "aim_assault_rifle",
  "shoot_assault_rifle",
  "reload",
] as const;

export type PlayerAnimationName = (typeof PLAYER_ANIMATION_NAMES)[number];

export interface PlayerAnimationEntry {
  root: TransformNode;
  animationGroup: AnimationGroup;
}

export type PlayerAnimationRegistry = Partial<
  Record<PlayerAnimationName, PlayerAnimationEntry>
>;

export function createPlayerAnimationRegistry(
  root: TransformNode,
  animationGroups: Partial<
    Record<PlayerAnimationName, AnimationGroup | undefined>
  >,
): PlayerAnimationRegistry {
  const registry: PlayerAnimationRegistry = {};

  for (const animationName of PLAYER_ANIMATION_NAMES) {
    const animationGroup = animationGroups[animationName];

    if (!animationGroup) {
      continue;
    }

    registry[animationName] = {
      root,
      animationGroup,
    };
  }

  return registry;
}
