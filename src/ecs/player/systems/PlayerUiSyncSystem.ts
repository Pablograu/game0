import type { EcsSystem } from "../../core/System.ts";
import type { World } from "../../core/World.ts";
import { PlayerHealthStateComponent } from "../components/index.ts";

export class PlayerUiSyncSystem implements EcsSystem {
  readonly name = "PlayerUiSyncSystem";
  readonly order = 70;

  update(world: World): void {
    const entityIds = world.query(PlayerHealthStateComponent);

    for (const entityId of entityIds) {
      const health = world.getComponent(entityId, PlayerHealthStateComponent);
      if (!health?.healthText) {
        continue;
      }

      health.healthText.text = `Vidas: ${health.currentHealth}`;

      if (health.currentHealth <= 1) {
        health.healthText.color = "red";
      } else if (health.currentHealth <= 2) {
        health.healthText.color = "orange";
      } else {
        health.healthText.color = "white";
      }
    }
  }
}
