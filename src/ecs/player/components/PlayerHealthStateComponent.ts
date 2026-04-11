import { createComponentType } from "../../core/Component.ts";
import { PlayerLifeState } from "../PlayerStateEnums.ts";

export interface PlayerHealthStateComponent {
  lifeState: PlayerLifeState;
  currentHealth: number;
  maxHealth: number;
  isInvulnerable: boolean;
  invulnerabilityDuration: number;
  invulnerabilityTimer: number;
  blinkActive: boolean;
  blinkTimer: number;
  blinkInterval: number;
  respawnDelay: number;
  respawnTimer: number;
}

export const PlayerHealthStateComponent =
  createComponentType<PlayerHealthStateComponent>("PlayerHealthStateComponent");
