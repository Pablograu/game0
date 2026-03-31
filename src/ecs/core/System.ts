import type { World } from './World.ts';

export interface EcsSystem {
  readonly name: string;
  readonly order?: number;
  update(world: World, deltaTime: number): void;
}
