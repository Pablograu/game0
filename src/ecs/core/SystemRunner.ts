import type { EcsSystem } from './System.ts';
import type { World } from './World.ts';

export class SystemRunner {
  private systems: EcsSystem[] = [];

  add(system: EcsSystem) {
    this.systems.push(system);
    this.systems.sort((left, right) => {
      return (left.order ?? 0) - (right.order ?? 0);
    });
  }

  remove(systemName: string) {
    this.systems = this.systems.filter((system) => system.name !== systemName);
  }

  update(world: World, deltaTime: number) {
    for (const system of this.systems) {
      system.update(world, deltaTime);
    }
  }

  getSystems(): readonly EcsSystem[] {
    return this.systems;
  }
}
